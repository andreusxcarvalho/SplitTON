import os
import threading
from flask import Flask, request, jsonify
from bot import start_bot
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# ===== Mini App API endpoints =====

@app.route("/register", methods=["POST"])
def register_user():
    data = request.json
    email = data.get("email")
    if not email:
        return jsonify({"error": "Missing email"}), 400
    # call Supabase OTP magic link
    from supabase import create_client
    supabase = create_client(os.getenv("PROJECT_URL"), os.getenv("DATABASE_API_KEY"))
    auth = supabase.auth.sign_in_with_otp({"email": email})
    return jsonify({"message": "OTP sent to email"}), 200


@app.route("/verify", methods=["POST"])
def verify_user():
    data = request.json
    email = data.get("email")
    otp = data.get("otp")
    if not email or not otp:
        return jsonify({"error": "Missing email or otp"}), 400
    from supabase import create_client
    supabase = create_client(os.getenv("PROJECT_URL"), os.getenv("DATABASE_API_KEY"))
    session = supabase.auth.verify_otp({"email": email, "token": otp, "type": "email"})
    if session.user:
        return jsonify({"message": "Verified!", "user_id": session.user.id}), 200
    else:
        return jsonify({"error": "Invalid OTP"}), 400

# Run Telegram Bot in another thread
def run_bot():
    start_bot()


if __name__ == "__main__":
    threading.Thread(target=run_bot, daemon=True).start()
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
