# bot.py
import os
import tempfile
import logging
import uuid
from typing import List, Optional
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo, Bot
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, CallbackQueryHandler, ContextTypes, ConversationHandler, filters
from supabase import create_client
from aiagent import set_api_key, process_transaction, ParsedTransactions, TransactionInfo
from speech_to_text import speech_to_text
from dotenv import load_dotenv

load_dotenv()

# ---------------- CONFIG ----------------
SUPABASE_URL = os.getenv("PROJECT_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("DATABASE_API_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "receipts")
GOOGLE_GENAI_KEY = os.getenv("GEMINI_API_KEY")
TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

# ---------------- INITIALIZE ----------------
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
set_api_key(GOOGLE_GENAI_KEY)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MINIAPP_URL = os.getenv("MINIAPP_URL")

# Conversation states for friend request
AWAITING_NICKNAME = 1

# Global bot application (for sending messages outside handlers)
bot_app = None

# Create a standalone Bot instance for sending notifications from server.py
notification_bot = Bot(token=TELEGRAM_TOKEN)

# ---------------- HELPERS ----------------
def get_profile_by_telegram_id(telegram_id: int) -> Optional[dict]:
    """Return profile row for a given telegram_id, or None if not found."""
    try:
        resp = supabase.table("profiles").select("*").eq("telegram_id", telegram_id).limit(1).execute()
        return resp.data[0] if resp.data else None
    except Exception as e:
        logger.error("Supabase error fetching profile: %s", e)
        return None

def get_friends_for_owner(owner_profile_id: str) -> List[dict]:
    """Return list of friend rows for owner (owner_id is profile.id)."""
    try:
        resp = supabase.table("friends").select("*").eq("user_id", owner_profile_id).execute()
        return resp.data or []
    except Exception as e:
        logger.error("Supabase error fetching friends: %s", e)
        return []

def resolve_name_to_profile_id(owner_profile_id: str, name: str, telegram_from_id: int) -> Optional[str]:
    """
    Resolve a name from AI output to a profiles.id (uuid).
    - "You" => the current user's profile.id (by telegram id)
    - otherwise => look up in friends table for the owner by nickname (case-insensitive)
    Returns profiles.id (uuid) or None if not found.
    """
    # Normalize
    name_norm = name.strip().lower()
    if name_norm in ("you", "me", "yourself"):
        profile = get_profile_by_telegram_id(telegram_from_id)
        return profile["id"] if profile else None

    # Find friend by nickname for this owner
    try:
        resp = supabase.table("friends").select("friend_user_id, nickname").eq("user_id", owner_profile_id).ilike("nickname", name).limit(1).execute()
        if resp.data:
            return resp.data[0]["friend_user_id"]
    except Exception as e:
        logger.error("Supabase error resolving friend nickname: %s", e)
        return None

    # As a fallback, try match by profiles.telegram_id if name looks like an integer
    try:
        maybe_tid = int(name)
        p = supabase.table("profiles").select("id").eq("telegram_id", maybe_tid).limit(1).execute()
        if p.data:
            return p.data[0]["id"]
    except Exception:
        pass

    return None

def get_telegram_id_from_profile_id(profile_id: str) -> Optional[int]:
    """Return telegram_id for a given profile UUID, or None if not found."""
    try:
        resp = supabase.table("profiles").select("telegram_id").eq("id", profile_id).limit(1).execute()
        if resp.data and resp.data[0].get("telegram_id"):
            return resp.data[0]["telegram_id"]
        return None
    except Exception as e:
        logger.error("Supabase error fetching telegram_id: %s", e)
        return None

def upload_local_file_to_storage(local_path: str, dest_filename: str) -> Optional[str]:
    """
    Upload local file to Supabase storage bucket and return a signed URL (short-lived).
    Returns signed url string or None on error.
    """
    try:
        with open(local_path, "rb") as f:
            up = supabase.storage.from_(SUPABASE_BUCKET).upload(dest_filename, f)
            # supabase-py may return response dict with 'error' key
            if up and isinstance(up, dict) and up.get("error"):
                logger.error("Supabase storage upload error: %s", up["error"])
                return None
        # create signed url valid for e.g. 1 hour (3600s)
        signed = supabase.storage.from_(SUPABASE_BUCKET).create_signed_url(dest_filename, 3600)
        if signed and isinstance(signed, dict) and signed.get("signedURL"):
            return signed["signedURL"]
        # fallback to public url if bucket public and get_public_url available
        public = supabase.storage.from_(SUPABASE_BUCKET).get_public_url(dest_filename)
        if public and isinstance(public, dict) and public.get("publicURL"):
            return public["publicURL"]
        return None
    except Exception as e:
        logger.exception("Error uploading to storage: %s", e)
        return None

def insert_transaction_and_children(creator_profile_id: str,
                                    source_type: str,
                                    source_path: Optional[str],
                                    txn_info: TransactionInfo,
                                    telegram_from_id: int) -> str:
    """
    Insert a single TransactionInfo into DB:
      - transactions
      - transaction_participants
      - transaction_items
    txn_info: an instance of TransactionInfo (from ai_agent)
    Returns: transaction_id (uuid as string)
    """
    # Resolve payer and payee to profile UUIDs
    payer_profile_id = resolve_name_to_profile_id(creator_profile_id, txn_info.from_friend, telegram_from_id)
    payee_profile_id = resolve_name_to_profile_id(creator_profile_id, txn_info.to_friend, telegram_from_id)

    if not payer_profile_id or not payee_profile_id:
        raise ValueError(f"Could not resolve payer/payee: '{txn_info.from_friend}' -> {payer_profile_id}, '{txn_info.to_friend}' -> {payee_profile_id}")

    # Build transaction record
    txn_payload = {
        "creator_id": creator_profile_id,
        "source_type": source_type,
        "source_path": source_path,
        "total_amount": float(txn_info.amount),
        "description": txn_info.item or None
    }

    try:
        tx_res = supabase.table("transactions").insert(txn_payload).execute()
        txn_row = tx_res.data[0]
        txn_id = txn_row["id"]
    except Exception as e:
        logger.error("Error inserting transaction: %s", e)
        raise RuntimeError("DB error inserting transaction")

    # Insert participant row (one payer -> one payee)
    part_payload = {
        "transaction_id": txn_id,
        "payer_id": payer_profile_id,
        "payee_id": payee_profile_id,
        "amount": float(txn_info.amount),
        "status": "pending"
    }
    
    try:
        part_res = supabase.table("transaction_participants").insert(part_payload).execute()
        participant_id = part_res.data[0]["id"]
    except Exception as e:
        logger.error("Error inserting participant: %s", e)
        raise RuntimeError("DB error inserting participant")

    # Insert item record (linked to participant)
    item_payload = {
        "participant_id": participant_id,
        "item_name": txn_info.item or "Unknown",
        "item_price": float(txn_info.amount),
        "category": txn_info.category.value if hasattr(txn_info, "category") else None
    }
    
    try:
        item_res = supabase.table("transaction_items").insert(item_payload).execute()
    except Exception as e:
        logger.error("Error inserting transaction item: %s", e)
        raise RuntimeError("DB error inserting transaction item")
    
    return txn_id

def delete_transaction(transaction_id: str) -> bool:
    """
    Delete a transaction and all related records (cascade should handle children).
    Returns True on success, False on error.
    """
    try:
        # Delete transaction_items first (they reference participant_id)
        participants_resp = supabase.table("transaction_participants").select("id").eq("transaction_id", transaction_id).execute()
        participant_ids = [p["id"] for p in participants_resp.data] if participants_resp.data else []
        
        for pid in participant_ids:
            supabase.table("transaction_items").delete().eq("participant_id", pid).execute()
        
        # Delete participants
        supabase.table("transaction_participants").delete().eq("transaction_id", transaction_id).execute()
        
        # Delete transaction
        supabase.table("transactions").delete().eq("id", transaction_id).execute()
        
        return True
    except Exception as e:
        logger.error("Error deleting transaction %s: %s", transaction_id, e)
        return False

async def send_notification_to_party(context: ContextTypes.DEFAULT_TYPE, 
                                     telegram_id: int, 
                                     transaction_id: str,
                                     creator_name: str,
                                     txn_info: TransactionInfo,
                                     payer_name: str,
                                     payee_name: str) -> None:
    """
    Send notification to a party involved in a transaction.
    Shows transaction details with a Reject button.
    """
    try:
        category_str = txn_info.category.value if hasattr(txn_info, 'category') and txn_info.category else "N/A"
        
        message_text = (
            f"📬 *New transaction from {creator_name}:*\n\n"
            f"{payer_name} → {payee_name}: ${txn_info.amount:.2f}\n"
            f"Item: {txn_info.item or 'N/A'}\n"
            f"Category: {category_str}\n"
        )
        
        keyboard = [[InlineKeyboardButton("✗ Reject", callback_data=f"reject_txn:{transaction_id}")]]
        
        await context.bot.send_message(
            chat_id=telegram_id,
            text=message_text,
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
    except Exception as e:
        logger.error("Error sending notification to telegram_id %s: %s", telegram_id, e)

async def send_friend_request_notification(telegram_id: int, 
                                           requester_email: str,
                                           friend_record_id: str,
                                           requester_user_id: str) -> None:
    """
    Send friend request notification to a user.
    Shows requester email with Accept/Reject buttons.
    """
    try:
        message_text = (
            f"👥 *Friend Request*\n\n"
            f"{requester_email} wants to add you as a friend.\n\n"
            f"Please set a name for them:"
        )
        
        keyboard = [
            [
                InlineKeyboardButton("✓ Accept", callback_data=f"accept_friend:{friend_record_id}:{requester_user_id}"),
                InlineKeyboardButton("✗ Reject", callback_data=f"reject_friend:{friend_record_id}")
            ]
        ]
        
        await notification_bot.send_message(
            chat_id=telegram_id,
            text=message_text,
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
    except Exception as e:
        logger.error("Error sending friend request notification to telegram_id %s: %s", telegram_id, e)

# ---------------- COMMAND HANDLERS ----------------
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    text = (
        "👋 *Welcome to SplitAI Bot*\n\n"
        "Send a receipt (image + caption) or text describing a payment and I'll record transactions for you.\n\n"
        "If you don't have an account yet, open the mini app and register."
    )
    # Use web_app parameter to open as proper Telegram Mini App (not browser link)
    keyboard = [[InlineKeyboardButton("Open Mini App", web_app=WebAppInfo(url=MINIAPP_URL))]]
    await context.bot.send_message(chat_id=chat_id, text=text, parse_mode="Markdown", reply_markup=InlineKeyboardMarkup(keyboard))

# ---------------- MESSAGE HANDLER ----------------
async def handle_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Handles incoming messages:
     - text
     - image with caption
    Calls ai_agent.process_transaction(...) and shows confirmation.
    """
    message = update.message
    chat_id = message.chat.id
    from_user = message.from_user
    telegram_from_id = from_user.id

    # 1) Ensure user has a profile in our DB
    profile = get_profile_by_telegram_id(telegram_from_id)
    if not profile:
        await message.reply_text("You don't have an account yet. Please register via the mini app first.")
        return
    owner_profile_id = profile["id"]  # uuid

    # 2) Build possible_friends list: include "You" and owner's friend nicknames
    friends_rows = get_friends_for_owner(owner_profile_id)
    friend_nicknames = [r["nickname"] for r in friends_rows]
    possible_friends = ["You"] + friend_nicknames

    try:
        parsed: Optional[ParsedTransactions] = None
        source_type = "text"
        stored_receipt_url = None

        # TEXT
        if message.text and not message.photo:
            text = message.text
            parsed = process_transaction("text", text, possible_friends)

        # PHOTO + CAPTION (image)
        elif message.photo and message.caption:
            # download best quality
            photo = message.photo[-1]
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
            await photo.get_file().download_to_drive(tmp.name)
            tmp.close()
            # upload to supabase storage
            dest_filename = f"{owner_profile_id}/{os.path.basename(tmp.name)}"
            signed_url = upload_local_file_to_storage(tmp.name, dest_filename)
            stored_receipt_url = signed_url
            # Use caption as context
            caption = message.caption
            parsed = process_transaction("image", (tmp.name, caption), possible_friends)
            source_type = "image"

            # cleanup local file
            try:
                os.unlink(tmp.name)
            except Exception:
                pass

        # PHOTO WITHOUT CAPTION
        elif message.photo and not message.caption:
            await message.reply_text("Please add a caption to your image describing the transaction.")
            return

        # VOICE MESSAGE (convert to text)
        elif message.voice or message.audio:
            # Download voice/audio file
            if message.voice:
                file_obj = message.voice
                file_ext = ".ogg"
            else:
                file_obj = message.audio
                file_ext = ".mp3"
            
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=file_ext)
            file = await file_obj.get_file()
            await file.download_to_drive(tmp.name)
            tmp.close()
            
            # Convert speech to text
            try:
                transcribed_text = speech_to_text(tmp.name)
                parsed = process_transaction("text", transcribed_text, possible_friends)
                source_type = "voice"
            except Exception as e:
                logger.error(f"Error transcribing audio: {e}")
                await message.reply_text("❌ Could not transcribe audio. Please try again.")
                return
            finally:
                # cleanup local file
                try:
                    os.unlink(tmp.name)
                except Exception:
                    pass

        else:
            # Silently ignore other message types (videos, stickers, etc.)
            return

        # If AI returned no transactions
        if not parsed or not parsed.transactions:
            await message.reply_text("Invalid or no transactions found in input.")
            return

        # Store parsed data in context.user_data with unique key
        unique_key = str(uuid.uuid4())
        context.user_data[f"pending_txns_{unique_key}"] = {
            "transactions": parsed.transactions,
            "source_type": source_type,
            "source_path": stored_receipt_url,
            "owner_profile_id": owner_profile_id,
            "telegram_from_id": telegram_from_id
        }

        # Build confirmation message
        confirmation_text = "📝 *Please confirm these transactions:*\n\n"
        for i, txn in enumerate(parsed.transactions, 1):
            category_str = txn.category.value if hasattr(txn, 'category') and txn.category else "N/A"
            confirmation_text += (
                f"{i}. {txn.from_friend} → {txn.to_friend}: ${txn.amount:.2f}\n"
                f"   Item: {txn.item or 'N/A'}\n"
                f"   Category: {category_str}\n\n"
            )

        # Add confirmation buttons
        keyboard = [
            [
                InlineKeyboardButton("✓ Confirm All", callback_data=f"confirm_all:{unique_key}"),
                InlineKeyboardButton("✗ Cancel All", callback_data=f"cancel_all:{unique_key}")
            ]
        ]

        await message.reply_text(
            text=confirmation_text,
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )

    except Exception as e:
        logger.exception("Error handling input: %s", e)
        await message.reply_text(f"❌ Error: {str(e)}")

# ---------------- CALLBACK HANDLERS ----------------
async def confirm_all_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle confirmation of all transactions by creator."""
    query = update.callback_query
    await query.answer()
    
    # Parse callback data
    callback_data = query.data
    if not callback_data.startswith("confirm_all:"):
        await query.edit_message_text("❌ Invalid callback data")
        return
    
    unique_key = callback_data.split(":", 1)[1]
    data_key = f"pending_txns_{unique_key}"
    
    # Retrieve stored data
    if data_key not in context.user_data:
        await query.edit_message_text("❌ Transaction data expired. Please try again.")
        return
    
    pending_data = context.user_data[data_key]
    transactions = pending_data["transactions"]
    source_type = pending_data["source_type"]
    source_path = pending_data["source_path"]
    owner_profile_id = pending_data["owner_profile_id"]
    telegram_from_id = pending_data["telegram_from_id"]
    
    try:
        # Get creator's profile info for notifications
        creator_profile = get_profile_by_telegram_id(telegram_from_id)
        creator_name = creator_profile.get("username", "Someone") if creator_profile else "Someone"
        
        # Insert each transaction and send notifications
        inserted_txns = []
        for txn in transactions:
            # Insert to DB
            txn_id = insert_transaction_and_children(
                creator_profile_id=owner_profile_id,
                source_type=source_type,
                source_path=source_path,
                txn_info=txn,
                telegram_from_id=telegram_from_id
            )
            
            # Store transaction info for notifications
            inserted_txns.append({
                "id": txn_id,
                "txn_info": txn
            })
        
        # Update confirmation message
        await query.edit_message_text(f"✅ Recorded {len(inserted_txns)} transaction(s)!")
        
        # Send notifications to other parties
        for item in inserted_txns:
            txn_id = item["id"]
            txn_info = item["txn_info"]
            
            # Resolve payer and payee profile IDs
            payer_profile_id = resolve_name_to_profile_id(owner_profile_id, txn_info.from_friend, telegram_from_id)
            payee_profile_id = resolve_name_to_profile_id(owner_profile_id, txn_info.to_friend, telegram_from_id)
            
            if not payer_profile_id or not payee_profile_id:
                logger.warning("Could not resolve payer/payee for notification")
                continue
            
            # Get telegram IDs for both parties
            payer_telegram_id = get_telegram_id_from_profile_id(payer_profile_id)
            payee_telegram_id = get_telegram_id_from_profile_id(payee_profile_id)
            
            # Send notification to payer (if not the creator)
            if payer_telegram_id and payer_telegram_id != telegram_from_id:
                await send_notification_to_party(
                    context=context,
                    telegram_id=payer_telegram_id,
                    transaction_id=txn_id,
                    creator_name=creator_name,
                    txn_info=txn_info,
                    payer_name=txn_info.from_friend,
                    payee_name=txn_info.to_friend
                )
            
            # Send notification to payee (if not the creator)
            if payee_telegram_id and payee_telegram_id != telegram_from_id:
                await send_notification_to_party(
                    context=context,
                    telegram_id=payee_telegram_id,
                    transaction_id=txn_id,
                    creator_name=creator_name,
                    txn_info=txn_info,
                    payer_name=txn_info.from_friend,
                    payee_name=txn_info.to_friend
                )
        
        # Cleanup stored data
        del context.user_data[data_key]

    except Exception as e:
        logger.exception("Error confirming transactions: %s", e)
        await query.edit_message_text(f"❌ Error: {str(e)}")

async def cancel_all_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle cancellation of all transactions by creator."""
    query = update.callback_query
    await query.answer()
    
    # Parse callback data
    callback_data = query.data
    if not callback_data.startswith("cancel_all:"):
        await query.edit_message_text("❌ Invalid callback data")
        return
    
    unique_key = callback_data.split(":", 1)[1]
    data_key = f"pending_txns_{unique_key}"
    
    # Cleanup stored data
    if data_key in context.user_data:
        del context.user_data[data_key]
    
    await query.edit_message_text("❌ Cancelled")

async def reject_transaction_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle rejection of a transaction by a participant."""
    query = update.callback_query
    await query.answer()
    
    # Parse callback data
    callback_data = query.data
    if not callback_data.startswith("reject_txn:"):
        await query.edit_message_text("❌ Invalid callback data")
        return
    
    transaction_id = callback_data.split(":", 1)[1]
    rejector_telegram_id = query.from_user.id
    
    try:
        # Get transaction details before deleting (for notification to creator)
        txn_resp = supabase.table("transactions").select("*, transaction_participants(*, transaction_items(*))").eq("id", transaction_id).limit(1).execute()
        
        if not txn_resp.data:
            await query.edit_message_text("❌ Transaction not found")
            return
        
        txn_data = txn_resp.data[0]
        creator_id = txn_data["creator_id"]
        total_amount = txn_data["total_amount"]
        description = txn_data.get("description", "N/A")
        
        # Get participants info for notification
        participants = txn_data.get("transaction_participants", [])
        participant_info = ""
        if participants:
            part = participants[0]
            payer_id = part.get("payer_id")
            payee_id = part.get("payee_id")
            amount = part.get("amount", total_amount)
            
            # Get names (simple lookup - you might want to improve this)
            participant_info = f"Amount: ${amount:.2f}"
        
        # Delete the transaction
        if delete_transaction(transaction_id):
            # Update the notification message
            await query.edit_message_text("❌ You rejected this transaction")
            
            # Notify the creator
            creator_telegram_id = get_telegram_id_from_profile_id(creator_id)
            if creator_telegram_id:
                rejector_profile = get_profile_by_telegram_id(rejector_telegram_id)
                rejector_name = rejector_profile.get("username", "Someone") if rejector_profile else "Someone"
                
                notification_text = (
                    f"⚠️ *{rejector_name} rejected a transaction:*\n\n"
                    f"{participant_info}\n"
                    f"Description: {description}"
                )
                
                await context.bot.send_message(
                    chat_id=creator_telegram_id,
                    text=notification_text,
                    parse_mode="Markdown"
                )
        else:
            await query.edit_message_text("❌ Error deleting transaction")
            
    except Exception as e:
        logger.exception("Error rejecting transaction: %s", e)
        await query.edit_message_text(f"❌ Error: {str(e)}")

async def accept_friend_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle acceptance of a friend request. Prompts for nickname."""
    query = update.callback_query
    await query.answer()
    
    # Parse callback data: accept_friend:<friend_record_id>:<requester_user_id>
    callback_data = query.data
    if not callback_data.startswith("accept_friend:"):
        await query.edit_message_text("❌ Invalid callback data")
        return ConversationHandler.END
    
    parts = callback_data.split(":")
    if len(parts) != 3:
        await query.edit_message_text("❌ Invalid callback data format")
        return ConversationHandler.END
    
    friend_record_id = parts[1]
    requester_user_id = parts[2]
    
    # Store in context for later use
    context.user_data["pending_friend_accept"] = {
        "friend_record_id": friend_record_id,
        "requester_user_id": requester_user_id,
        "chat_id": query.message.chat_id,
        "message_id": query.message.message_id
    }
    
    # Ask for nickname
    await query.edit_message_text(
        "✓ *Friend request accepted!*\n\n"
        "Please reply with a nickname for this person:",
        parse_mode="Markdown"
    )
    
    return AWAITING_NICKNAME

async def reject_friend_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle rejection of a friend request. Deletes the friendship."""
    query = update.callback_query
    await query.answer()
    
    # Parse callback data: reject_friend:<friend_record_id>
    callback_data = query.data
    if not callback_data.startswith("reject_friend:"):
        await query.edit_message_text("❌ Invalid callback data")
        return
    
    friend_record_id = callback_data.split(":", 1)[1]
    
    try:
        # Delete the friend record
        resp = supabase.table("friends").delete().eq("id", friend_record_id).execute()
        
        # Get requester info to notify them
        if resp.data:
            # Notification could be added here if needed
            pass
        
        await query.edit_message_text("✗ *Friend request rejected*", parse_mode="Markdown")
        
    except Exception as e:
        logger.exception("Error rejecting friend request: %s", e)
        await query.edit_message_text(f"❌ Error: {str(e)}")

async def receive_nickname(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Receive nickname for accepted friend and create bidirectional friendship."""
    message = update.message
    nickname = message.text.strip()
    
    if not nickname:
        await message.reply_text("Please provide a valid nickname.")
        return AWAITING_NICKNAME
    
    # Get stored data
    pending_data = context.user_data.get("pending_friend_accept")
    if not pending_data:
        await message.reply_text("❌ Session expired. Please try again.")
        return ConversationHandler.END
    
    friend_record_id = pending_data["friend_record_id"]
    requester_user_id = pending_data["requester_user_id"]
    accepter_telegram_id = message.from_user.id
    
    try:
        # Get accepter's profile
        accepter_profile = get_profile_by_telegram_id(accepter_telegram_id)
        if not accepter_profile:
            await message.reply_text("❌ You don't have a profile. Please register first.")
            return ConversationHandler.END
        
        accepter_user_id = accepter_profile["id"]
        
        # Create reverse friendship (accepter -> requester)
        reverse_payload = {
            "user_id": accepter_user_id,
            "friend_user_id": requester_user_id,
            "nickname": nickname
        }
        
        reverse_resp = supabase.table("friends").insert(reverse_payload).execute()
        
        if not reverse_resp.data:
            await message.reply_text("❌ Failed to create friendship")
            return ConversationHandler.END
        
        # Get requester's email for confirmation message
        requester_resp = supabase.table("profiles").select("email").eq("id", requester_user_id).limit(1).execute()
        requester_email = requester_resp.data[0]["email"] if requester_resp.data else "Unknown"
        
        # Send confirmation
        await message.reply_text(
            f"✅ *Friendship established!*\n\n"
            f"You are now friends with {requester_email}\n"
            f"Nickname: {nickname}",
            parse_mode="Markdown"
        )
        
        # Notify the requester
        requester_telegram_id = get_telegram_id_from_profile_id(requester_user_id)
        if requester_telegram_id:
            accepter_email = accepter_profile.get("email", "Someone")
            await context.bot.send_message(
                chat_id=requester_telegram_id,
                text=f"✅ *{accepter_email} accepted your friend request!*",
                parse_mode="Markdown"
            )
        
        # Cleanup
        del context.user_data["pending_friend_accept"]
        
    except Exception as e:
        logger.exception("Error creating friendship: %s", e)
        await message.reply_text(f"❌ Error: {str(e)}")
        return ConversationHandler.END
    
    return ConversationHandler.END

async def cancel_nickname(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Cancel nickname input."""
    await update.message.reply_text("❌ Cancelled")
    if "pending_friend_accept" in context.user_data:
        del context.user_data["pending_friend_accept"]
    return ConversationHandler.END

def start_bot():
    """Start the Telegram bot (for use in server.py or standalone testing)."""
    global bot_app
    app = ApplicationBuilder().token(TELEGRAM_TOKEN).build()
    bot_app = app  # Store globally for send_friend_request_notification
    
    # Command handlers
    app.add_handler(CommandHandler("start", start))
    
    # Conversation handler for friend nickname input
    friend_conv_handler = ConversationHandler(
        entry_points=[CallbackQueryHandler(accept_friend_callback, pattern="^accept_friend:")],
        states={
            AWAITING_NICKNAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_nickname)]
        },
        fallbacks=[CommandHandler("cancel", cancel_nickname)],
        per_message=False,
        per_chat=True,
        per_user=True
    )
    app.add_handler(friend_conv_handler)
    
    # Callback query handlers
    app.add_handler(CallbackQueryHandler(confirm_all_callback, pattern="^confirm_all:"))
    app.add_handler(CallbackQueryHandler(cancel_all_callback, pattern="^cancel_all:"))
    app.add_handler(CallbackQueryHandler(reject_transaction_callback, pattern="^reject_txn:"))
    app.add_handler(CallbackQueryHandler(reject_friend_callback, pattern="^reject_friend:"))
    
    # Message handler (must be last to avoid conflicts)
    app.add_handler(MessageHandler(filters.ALL & ~filters.COMMAND, handle_input))

    logger.info("Bot starting (polling mode)...")
    app.run_polling()


if __name__ == "__main__":
    start_bot()
