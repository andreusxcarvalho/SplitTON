# bot.py
import os
import tempfile
import logging
from typing import List, Optional
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, ContextTypes, filters
from supabase import create_client
from aiagent import set_api_key, process_transaction, ParsedTransactions, TransactionInfo
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
                                    telegram_from_id: int) -> None:
    """
    Insert a single TransactionInfo into DB:
      - transactions
      - transaction_participants
      - transaction_items
    txn_info: an instance of TransactionInfo (from ai_agent)
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
        tx_res = supabase.table("transactions").insert(txn_payload).select("id").execute()
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
        part_res = supabase.table("transaction_participants").insert(part_payload).select("id").execute()
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
    Calls ai_agent.process_transaction(...) and persists results.
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

        else:
            await message.reply_text("Please send either plain text or an image with a caption (caption is required for images).")
            return

        # If AI returned no transactions
        if not parsed or not parsed.transactions:
            await message.reply_text("Invalid or no transactions found in input.")
            return

        # Insert each parsed TransactionInfo into DB
        inserted_count = 0
        for txn in parsed.transactions:
            # txn is pydantic TransactionInfo; ensure types
            insert_transaction_and_children(
                creator_profile_id=owner_profile_id,
                source_type=source_type,
                source_path=stored_receipt_url,
                txn_info=txn,
                telegram_from_id=telegram_from_id
            )
            inserted_count += 1

        await message.reply_text(f"✅ Recorded {inserted_count} transaction(s).")

    except Exception as e:
        logger.exception("Error handling input: %s", e)
        await message.reply_text(f"❌ Error: {str(e)}")

def start_bot():
    """Start the Telegram bot (for use in server.py or standalone testing)."""
    app = ApplicationBuilder().token(TELEGRAM_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.ALL & ~filters.COMMAND, handle_input))

    logger.info("Bot starting (polling mode)...")
    app.run_polling()


if __name__ == "__main__":
    start_bot()
