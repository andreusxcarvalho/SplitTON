import os
import uuid
from typing import Optional, Dict, Any
import httpx

CRYPTO_PAY_API_BASE = "https://pay.crypt.bot/api"

# Get API token from environment variable
CRYPTO_PAY_API_TOKEN = os.getenv("CRYPTO_PAY_API_TOKEN")


class CryptoPayClient:
    """Client for Crypto Pay API (CryptoBot)"""
    
    def __init__(self, api_token: str, *, timeout_seconds: float = 10.0) -> None:
        self._headers = {
            "Crypto-Pay-API-Token": api_token,
            "Content-Type": "application/json",
        }
        self._client = httpx.AsyncClient(
            base_url=CRYPTO_PAY_API_BASE, 
            headers=self._headers, 
            timeout=timeout_seconds
        )

    async def create_invoice(
        self,
        *,
        asset: str,
        amount: float,
        description: Optional[str] = None,
        payload: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a payment invoice"""
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
        """Send a transfer to a Telegram user"""
        json_body: Dict[str, Any] = {
            "user_id": user_id,
            "asset": asset,
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
        """Close the HTTP client"""
        await self._client.aclose()


async def create_payment_invoice(user_id: int, amount: float, description: str = None) -> str:
    """Create a USDT invoice and return the payment URL.

    Args:
        user_id: Telegram user id for payload correlation.
        amount: Amount in USDT to collect.
        description: Optional description for the invoice.

    Returns:
        The payment URL for the created invoice.
    """
    if not CRYPTO_PAY_API_TOKEN:
        raise RuntimeError("CRYPTO_PAY_API_TOKEN not configured")

    client = CryptoPayClient(CRYPTO_PAY_API_TOKEN)
    try:
        invoice = await client.create_invoice(
            asset="USDT",
            amount=amount,
            description=description or f"Payment of ${amount} USDT",
            payload=str(user_id),
        )
    finally:
        await client.aclose()

    pay_url = invoice.get("pay_url")
    if not pay_url:
        raise RuntimeError("Failed to generate payment link")
    
    return pay_url


async def send_usdt_transfer(telegram_id: int, amount: float, comment: str = None) -> Dict[str, Any]:
    """Send a USDT payment to a Telegram user via Crypto Pay transfer.

    Args:
        telegram_id: Telegram numeric user id (recipient).
        amount: Amount in USDT to send.
        comment: Optional comment for the transfer.

    Returns:
        The transfer result object from Crypto Pay API.
    """
    if not CRYPTO_PAY_API_TOKEN:
        raise RuntimeError("CRYPTO_PAY_API_TOKEN not configured")

    client = CryptoPayClient(CRYPTO_PAY_API_TOKEN)
    try:
        transfer = await client.transfer(
            user_id=telegram_id,
            asset="USDT",
            amount=amount,
            comment=comment,
        )
    finally:
        await client.aclose()

    return transfer
