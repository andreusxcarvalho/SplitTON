import os
from datetime import datetime
from supabase import create_client
from flask import Flask, request, jsonify
from flask_cors import CORS
from bot import start_bot
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

SUPABASE_URL = os.getenv("PROJECT_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("DATABASE_API_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

MINIAPP_URL = os.getenv("MINIAPP_URL")

# ===== Health Check API endpoint =====
@app.route("/health", methods=["GET"])
def health_check():
    """Simple endpoint to confirm the server is running."""
    return jsonify({"status": "ok"}), 200

# ===== Mini App API endpoints =====
# 1) Register user
@app.route("/register", methods=["POST"])
def register_user():
    data = request.json
    email = data.get("email")
    print(f"REGISTER: {email}")
    if not email:
        return jsonify({"error": "Missing email"}), 400
    
    try:
        response = supabase.auth.sign_in_with_otp({"email": email})
        print(f"✅ OTP sent to: {email}")
        return jsonify({"message": "OTP sent to email"}), 200
    except Exception as e:
        print(f"❌ Supabase OTP Error: {str(e)}")
        return jsonify({"error": f"Failed to send OTP: {str(e)}"}), 400

# 2) Verify user
@app.route("/verify", methods=["POST"])
def verify_user():
    data = request.json
    email = data.get("email")
    otp = data.get("otp")
    telegram_id = data.get("telegram_id")  # Get telegram_id from frontend
    
    if not email or not otp:
        return jsonify({"error": "Missing email or otp"}), 400
    
    try:
        # Verify OTP with Supabase
        session = supabase.auth.verify_otp({"email": email, "token": otp, "type": "email"})
        
        if not session.user:
            return jsonify({"error": "Invalid OTP"}), 400
        
        user_id = session.user.id
        
        # Create or update profile in profiles table
        existing_profile = supabase.table("profiles").select("id").eq("id", user_id).execute()
        
        if not existing_profile.data:
            # Create new profile
            profile_data = {
                "id": user_id,
                "email": email,
                "telegram_id": telegram_id or 0  # Use provided telegram_id or fallback to 0
            }
            result = supabase.table("profiles").insert(profile_data).execute()
            print(f"✅ Created profile for user: {user_id} with telegram_id: {telegram_id}")
        else:
            # Update existing profile's telegram_id if provided
            if telegram_id:
                supabase.table("profiles").update({"telegram_id": telegram_id}).eq("id", user_id).execute()
                print(f"✅ Updated telegram_id for user: {user_id}")
        
        return jsonify({"message": "Verified!", "user_id": user_id}), 200
        
    except Exception as e:
        print(f"❌ Verification Error: {str(e)}")
        return jsonify({"error": f"Verification failed: {str(e)}"}), 400

# 3) Stats
@app.route("/stats/<user_id>", methods=["GET"])
def stats(user_id):
    # Get all transaction_items where user is either payer or payee
    resp = supabase.table("transaction_items")\
        .select("item_price, category, participant:participant_id(payer_id, payee_id, transaction_id)")\
        .execute()
    
    if not resp.data:
        return jsonify({}), 200
    
    # Filter only user's transactions
    stats_data = {}
    for item in resp.data:
        participant = item.get("participant")
        if not participant:
            continue
        
        # Only include if user is payer OR payee
        if participant.get("payer_id") == user_id or participant.get("payee_id") == user_id:
            cat = item.get("category", "Other")
            stats_data[cat] = stats_data.get(cat, 0) + float(item.get("item_price", 0))
    
    return jsonify(stats_data)

# 4) List friends
@app.route("/friends/<user_id>", methods=["GET"])
def list_friends(user_id):
    resp = supabase.table("friends").select("id, nickname, friend_user_id").eq("user_id", user_id).execute()
    
    if resp.data is None:
        return jsonify({"error": "Failed to retrieve friends"}), 500
    
    # Return formatted data matching frontend expectations
    friends = [{"id": str(f["id"]), "nickname": f["nickname"]} for f in resp.data]
    return jsonify(friends)

# 5) Add friend
@app.route("/friends/<user_id>", methods=["POST"])
def add_friend(user_id):
    data = request.json
    friend_email = data.get("email")
    nickname = data.get("nickname")
    
    if not friend_email or not nickname:
        return jsonify({"error": "Missing email or nickname"}), 400
    
    try:
        # Look up friend's profile_id by email in profiles table
        friend_resp = supabase.table("profiles").select("id").eq("email", friend_email).limit(1).execute()
        
        if not friend_resp.data:
            return jsonify({"error": "Friend not found. Make sure they have registered first."}), 404
        
        friend_user_id = friend_resp.data[0]["id"]

        # Insert friend relationship
        payload = {"user_id": user_id, "friend_user_id": friend_user_id, "nickname": nickname}
        resp = supabase.table("friends").insert(payload).execute()
        
        if not resp.data:
            return jsonify({"error": "Failed to add friend"}), 500
        
        print(f"✅ Friend added: {nickname} ({friend_email}) for user {user_id}")
        return jsonify({"message": "Friend added"}), 200
        
    except Exception as e:
        print(f"❌ Add friend error: {str(e)}")
        return jsonify({"error": f"Failed to add friend: {str(e)}"}), 500

# 6) Previous transactions
@app.route("/transactions/<user_id>", methods=["GET"])
def previous_transactions(user_id):
    # Get ONLY settled/paid transactions where user is payer or payee
    resp = supabase.table("transaction_participants")\
        .select("*, transaction:transaction_id(*)")\
        .eq("status", "paid")\
        .or_(f"payer_id.eq.{user_id},payee_id.eq.{user_id}")\
        .execute()
    
    if resp.data is None:
        return jsonify({"error": "Failed to retrieve transactions"}), 500
    
    transactions = []
    seen_transaction_ids = set()
    
    for row in resp.data:
        txn = row.get("transaction")
        if not txn:
            continue
        
        # Avoid duplicates (same transaction can have multiple participants)
        txn_id = txn.get("id")
        if txn_id in seen_transaction_ids:
            continue
        seen_transaction_ids.add(txn_id)
        
        transactions.append({
            "name": txn.get("description") or "Expense",
            "date": txn.get("created_at"),
            "source_type": txn.get("source_type"),
            "source_path": txn.get("source_path")
        })
    
    return jsonify(transactions)

# 7) Settlements (uncompleted transactions)
@app.route("/settlements/<user_id>", methods=["GET"])
def settlements(user_id):
    resp = supabase.table("transaction_participants")\
        .select("*")\
        .eq("status", "pending")\
        .or_(f"payer_id.eq.{user_id},payee_id.eq.{user_id}")\
        .execute()
    if resp.data is None:
        return jsonify({"error": "Failed to retrieve settlements"}), 500
    return jsonify(resp.data)

# 😍 Settle by TON
@app.route("/settle/<transaction_participant_id>", methods=["POST"])
def settle_by_ton(transaction_participant_id):
    # Mark as PAID (not completed) and use paid_at (not completed_at)
    resp = supabase.table("transaction_participants")\
        .update({"status": "paid", "paid_at": datetime.utcnow().isoformat()})\
        .eq("id", transaction_participant_id)\
        .execute()
    
    if resp.data is None or len(resp.data) == 0:
        return jsonify({"error": "Failed to settle transaction"}), 500
    
    # Return 200 with JSON (not 204) to match frontend expectations
    return jsonify({"message": "Settled successfully"}), 200

# 9) Image retrieval (for completed transactions)
@app.route("/retrieve_image/<transaction_id>", methods=["GET"])
def retrieve_image(transaction_id):
    resp = supabase.table("transactions").select("*").eq("id", transaction_id).limit(1).execute()
    if not resp.data:
        return jsonify({"error": "Transaction not found"}), 404
    txn = resp.data[0]
    return jsonify({"source_path": txn.get("source_path"), "source_type": txn.get("source_type")})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)