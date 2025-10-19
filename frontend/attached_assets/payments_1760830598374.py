import asyncio
import os
import uuid
from typing import Optional, Dict, Any

import httpx
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes


CRYPTO_PAY_API_BASE = "https://pay.crypt.bot/api"

# Prefer environment variable; fall back to existing token for local/dev
CRYPTO_PAY_API_TOKEN = os.getenv(
    "CRYPTO_PAY_API_TOKEN",
    "475559:AAYZ1gi98dMjHGGIhL8uAndpG93HJIjeXTR",
)


class CryptoPayClient:
    def __init__(self, api_token: str, *, timeout_seconds: float = 10.0) -> None:
        self._headers = {
            "Crypto-Pay-API-Token": api_token,
            "Content-Type": "application/json",
        }
        self._client = httpx.AsyncClient(base_url=CRYPTO_PAY_API_BASE, headers=self._headers, timeout=timeout_seconds)

    async def create_invoice(
        self,
        *,
        asset: str,
        amount: float,
        description: Optional[str] = None,
        payload: Optional[str] = None,
    ) -> Dict[str, Any]:
        json_body: Dict[str, Any] = {
            "asset": asset,
            "amount": amount,
        }
        if description:
            json_body["description"] = description
        if payload:
            json_body["payload"] = payload

        resp = await self._client.post("/createInvoice", json=json_body)
        resp.raise_for_status()
        data = resp.json()
        # Expected format: { ok: true, result: { invoice_id, status, pay_url, ... } }
        if not data.get("ok"):
            raise RuntimeError(f"Crypto Pay API error: {data}")
        return data["result"]

    async def transfer(
        self,
        *,
        user_id: int,
        asset: str,
        amount: float,
        spend_id: Optional[str] = None,
        comment: Optional[str] = None,
        disable_send_notification: Optional[bool] = None,
    ) -> Dict[str, Any]:
        json_body: Dict[str, Any] = {
            "user_id": user_id,
            "asset": asset,
            # Some Crypto Pay endpoints prefer amount as string
            "amount": f"{amount:.8f}",
            "spend_id": spend_id or uuid.uuid4().hex,
        }
        if comment is not None:
            json_body["comment"] = comment
        if disable_send_notification is not None:
            json_body["disable_send_notification"] = disable_send_notification

        resp = await self._client.post("/transfer", json=json_body)
        resp.raise_for_status()
        data = resp.json()
        if not data.get("ok"):
            raise RuntimeError(f"Crypto Pay API error: {data}")
        return data["result"]

    async def aclose(self) -> None:
        await self._client.aclose()


async def collect_payment(user_id: int, amount: float) -> str:
    """Create a USDT invoice and return the payment URL.

    Args:
        user_id: Telegram user id for payload correlation.
        amount: Amount in USDT to collect.

    Returns:
        The payment URL for the created invoice.
    """
    if not CRYPTO_PAY_API_TOKEN:
        raise RuntimeError("Payment service not configured. Please set CRYPTO_PAY_API_TOKEN.")

    client = CryptoPayClient(CRYPTO_PAY_API_TOKEN)
    try:
        invoice = await client.create_invoice(
            asset="USDT",
            amount=amount,
            description=f"Payment of ${amount} in USDT",
            payload=str(user_id),
        )
    finally:
        await client.aclose()

    pay_url = invoice.get("pay_url")
    if not pay_url:
        raise RuntimeError("Failed to generate payment link")
    return pay_url


async def send_payment(chat_id: int, amount: float) -> Dict[str, Any]:
    """Send a USDT payment to a Telegram user via Crypto Pay transfer.

    Args:
        chat_id: Telegram numeric user id (recipient).
        amount: Amount in USDT to send.

    Returns:
        The transfer result object from Crypto Pay API.
    """
    if not CRYPTO_PAY_API_TOKEN:
        raise RuntimeError("Payment service not configured. Please set CRYPTO_PAY_API_TOKEN.")

    client = CryptoPayClient(CRYPTO_PAY_API_TOKEN)
    try:
        transfer = await client.transfer(
            user_id=chat_id,
            asset="USDT",
            amount=amount,
        )
    finally:
        await client.aclose()

    return transfer


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not CRYPTO_PAY_API_TOKEN:
        await update.message.reply_text("Payment service not configured. Please set CRYPTO_PAY_API_TOKEN.")
        return

    amount = 10
    user_id = update.effective_user.id if update.effective_user else 0
    try:
        pay_url = await collect_payment(user_id=user_id, amount=amount)
    except Exception as e:
        await update.message.reply_text(f"Failed to generate payment link. {e}")
        return

    keyboard = InlineKeyboardMarkup(
        [[InlineKeyboardButton(text=f"Pay ${amount} in USDT", url=pay_url)]]
    )
    await update.message.reply_text(
        "Please complete your payment:",
        reply_markup=keyboard,
    )


async def send(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not CRYPTO_PAY_API_TOKEN:
        await update.message.reply_text("Payment service not configured. Please set CRYPTO_PAY_API_TOKEN.")
        return

    target_user_id = 5226489180
    amount = 1
    try:
        transfer = await send_payment(chat_id=target_user_id, amount=amount)
        print(transfer)
    except httpx.HTTPStatusError as e:
        status = e.response.status_code if e.response is not None else None
        # Provide actionable hints on 403s which commonly happen with transfers
        if status == 403:
            try:
                api_err = e.response.json()
            except Exception:
                api_err = {"message": e.response.text if e.response is not None else str(e)}
            await update.message.reply_text(
                "Transfer forbidden (403). Possible causes:\n"
                "- Token lacks transfer permission or app not allowed to transfer\n"
                "- Insufficient balance in Crypto Pay app\n"
                "- Recipient hasn't started @CryptoBot or has no wallet\n"
                "- Wrong user_id (must be Telegram numeric ID)\n"
                f"Details: {api_err}"
            )
            return
        if status == 400:
            try:
                api_err = e.response.json()
            except Exception:
                api_err = {"message": e.response.text if e.response is not None else str(e)}
            await update.message.reply_text(
                "Bad request (400). Common reasons:\n"
                "- Amount format/precision invalid or below minimum for USDT\n"
                "- Asset not enabled in Crypto Pay app\n"
                "- Invalid user_id or parameters\n"
                f"Details: {api_err}"
            )
            return
        # Other HTTP errors
        await update.message.reply_text(f"Transfer failed: HTTP {status}: {e}")
        return
    finally:
        await client.aclose()

    tx_id = transfer.get("transfer_id") or transfer.get("request_id") or "unknown"
    await update.message.reply_text(f"Sent {amount} USDT to {target_user_id}. Transfer id: {tx_id}")


async def main() -> None:
    bot_token = "8367418602:AAFJOPYz5Osj_EJmOCsnkf4bfyo1tZcNBus"
    if not bot_token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is not set")

    app = ApplicationBuilder().token(bot_token).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("send", send))

    await app.initialize()
    await app.start()
    try:
        await app.updater.start_polling()
        # Keep running until Ctrl+C
        await asyncio.Event().wait()
    finally:
        await app.updater.stop()
        await app.stop()
        await app.shutdown()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass

