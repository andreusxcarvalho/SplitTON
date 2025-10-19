# Payment Integration Guide - Crypto Pay (USDT)

## Overview
Your SplitTon app now supports real cryptocurrency payments using **Crypto Pay API** (@CryptoBot on Telegram). Users can settle debts by sending/receiving USDT directly through Telegram.

## Architecture

### Components Added

1. **`server/payments.py`** - Crypto Pay API client
   - `CryptoPayClient` - HTTP client for Crypto Pay API
   - `create_payment_invoice()` - Creates payment invoices (for collecting money)
   - `send_usdt_transfer()` - Sends USDT transfers (for paying people)

2. **`server.py` - New Endpoints**
   - `POST /request-payment/<transaction_participant_id>` - Request payment (you're owed)
   - `POST /send-payment/<transaction_participant_id>` - Send payment (you owe)

3. **`bot_fixed.py` - Telegram Notifications**
   - `send_payment_request_notification()` - Sends invoice link via Telegram
   - `send_payment_sent_notification()` - Confirms payment received

## Environment Setup

### Required Environment Variable
```bash
CRYPTO_PAY_API_TOKEN=your_crypto_pay_token_here
```

### How to Get Your Token
1. Open Telegram and message [@CryptoBot](https://t.me/CryptoBot)
2. Send command `/app` to create a new app
3. Name your app (e.g., "SplitTon")
4. Copy the API token provided
5. Add it to your `.env` file or Heroku config vars

## API Endpoints

### 1. Payment Notification (Get Payment Link)

```http
POST /payment_notification
```

**Request Body:**
```json
{
  "user_id": "uuid-string",
  "amount": 25.50
}
```

**When to use:** User clicks "Pay" button on Settlements page

**What it does:**
1. Creates USDT payment invoice via Crypto Pay
2. Returns payment URL for user to complete payment
3. Frontend opens URL in new tab
4. Frontend marks transaction as settled

**Example Response:**
```json
{
  "payment_url": "https://pay.crypt.bot/..."
}
```

**Frontend Integration:**
```typescript
// In Settle.tsx
const paymentMutation = useMutation({
  mutationFn: async (data: { userId: string; amount: number; settlementIds: string[] }) => {
    // Get payment URL
    const response = await herokuApiRequest<{ payment_url: string }>(
      "POST",
      "/payment_notification",
      { user_id: data.userId, amount: data.amount }
    );
    
    // Open payment URL in new tab
    if (response.payment_url) {
      window.open(response.payment_url, '_blank');
    }
    
    // Mark settlements as paid
    await Promise.all(
      data.settlementIds.map(id => 
        herokuApiRequest("POST", `/settle/${id}`)
      )
    );
  },
  onSuccess: () => {
    toast({ title: "Payment link opened!" });
  },
});
```

## Payment Flow

### Simple Payment Flow: Alice owes Bob $25

```
1. Alice opens Settlements page
   └─> Sees "You owe Bob $25"

2. Alice clicks "Pay" button
   └─> Frontend calls: POST /payment_notification
       ├─> Request: { user_id: "alice-uuid", amount: 25 }
       └─> Response: { payment_url: "https://pay.crypt.bot/..." }

3. Frontend opens payment URL in new tab
   └─> Alice completes payment via @CryptoBot

4. Frontend marks transaction as settled
   └─> POST /settle/{settlement_id}
   └─> Transaction status → "paid"

5. Settlement disappears from Alice's "You Owe" list
```

### Key Points
- **Simple:** Click "Pay" → URL opens → Transaction marked settled
- **No Telegram notifications:** Payment handled entirely via Crypto Pay link
- **Instant settlement:** Transaction marked as paid immediately after opening link
- **User responsibility:** User must complete payment in opened tab

## Error Handling

### Common Errors

**"Payer/Payee has no Telegram account linked"**
- User hasn't registered through Telegram bot
- Solution: Ask them to open bot and send `/start`

**"Payment service not configured"**
- `CRYPTO_PAY_API_TOKEN` not set
- Solution: Add token to environment variables

**"Transfer forbidden (403)"**
- Recipient hasn't started @CryptoBot
- Insufficient balance in sender's Crypto Pay app
- Solution: Ask recipient to message @CryptoBot first

**"Transaction already settled"**
- Someone already paid this debt
- Solution: Refresh data and show updated status

## Telegram Notifications

### Friend Request
```
👋 New Friend Request

alice@example.com added you as a friend!

You can now split expenses together.
```

### Payment Request
```
💰 Payment Request

bob@example.com is requesting payment:
Amount: $25.50 USDT

Click the button below to complete the payment.

[💳 Pay $25.50 USDT]
```

### Payment Received
```
✅ Payment Received

You received $25.50 USDT from:
alice@example.com

Check your @CryptoBot wallet for the payment.
```

## Testing the Integration

### 1. Setup Test Environment
```bash
# Add to .env
CRYPTO_PAY_API_TOKEN=your_test_token
```

### 2. Test Payment Request
```bash
curl -X POST https://your-heroku-app.com/request-payment/{settlement_id}
```

Expected: Telegram message sent to payer with invoice link

### 3. Test Send Payment
```bash
curl -X POST https://your-heroku-app.com/send-payment/{settlement_id}
```

Expected: USDT transferred to payee, transaction marked as paid

## Frontend Integration Example

The `client/src/pages/Settle.tsx` is already updated with the payment flow:

```typescript
// Payment mutation (creates payment link and opens it)
const paymentMutation = useMutation({
  mutationFn: async (data: { userId: string; amount: number; settlementIds: string[] }) => {
    // Call payment_notification to get payment URL
    const response = await herokuApiRequest<{ payment_url: string }>(
      "POST",
      "/payment_notification",
      { user_id: data.userId, amount: data.amount }
    );
    
    // Open payment URL in new tab
    if (response.payment_url) {
      window.open(response.payment_url, '_blank');
    }
    
    // Mark all settlements as paid
    await Promise.all(
      data.settlementIds.map(id => 
        herokuApiRequest("POST", `/settle/${id}`)
      )
    );
    
    return response;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["settlements", userId] });
    queryClient.invalidateQueries({ queryKey: ["transactions", userId] });
    toast({
      title: "Payment link opened!",
      description: "Complete payment in the new tab and transaction will be marked as settled",
    });
  },
});

// Button handler
const handlePayment = async (group: GroupedSettlement) => {
  if (!userId) return;
  
  await paymentMutation.mutateAsync({
    userId,
    amount: Math.abs(group.netAmount),
    settlementIds: group.settlementIds,
  });
};
```

## Security Considerations

1. **API Token Protection**
   - Never commit `CRYPTO_PAY_API_TOKEN` to Git
   - Use environment variables only
   - Rotate tokens periodically

2. **User Validation**
   - Always verify `telegram_id` exists before operations
   - Check transaction status before processing
   - Validate amounts are positive

3. **Error Logging**
   - All payment operations logged with timestamps
   - Failed transfers logged with error details
   - Monitor logs for suspicious activity

## Deployment Checklist

- [ ] Add `CRYPTO_PAY_API_TOKEN` to Heroku config vars
- [ ] Deploy updated `server.py` to Heroku
- [ ] Deploy `server/payments.py` to Heroku
- [ ] Deploy updated `bot_fixed.py` to Heroku
- [ ] Test with small amounts first ($0.01 USDT)
- [ ] Monitor Heroku logs for errors
- [ ] Update frontend to use new endpoints

## Troubleshooting

**Problem:** "Module 'server.payments' not found"
**Solution:** Ensure `server/payments.py` exists on Heroku

**Problem:** "httpx module not found"
**Solution:** Add `httpx` to `requirements.txt`

**Problem:** Payments work locally but fail on Heroku
**Solution:** Check Heroku config vars have `CRYPTO_PAY_API_TOKEN`

**Problem:** User doesn't receive Telegram notification
**Solution:** Verify user's `telegram_id` is correct in database

## Next Steps

1. Update frontend Settle page with new payment buttons
2. Test payment flow end-to-end
3. Add payment history tracking
4. Implement webhook for payment confirmations (future enhancement)
5. Add support for other cryptocurrencies (TON, BTC, ETH)

## Resources

- [Crypto Pay API Docs](https://help.crypt.bot/crypto-pay-api)
- [@CryptoBot on Telegram](https://t.me/CryptoBot)
- [API Token Management](https://t.me/CryptoBot) - Send `/app`
