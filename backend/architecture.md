# Backend API Architecture

Complete documentation of all API endpoints with request/response formats, error handling, and usage examples.

**Base URL:** `https://splitton-ef215d77f9d0.herokuapp.com`

---

## Table of Contents
1. [Health Check](#1-health-check)
2. [Authentication](#2-authentication)
   - [Register User](#register-user)
   - [Verify OTP](#verify-otp)
3. [User Management](#3-user-management)
   - [List Friends](#list-friends)
   - [Add Friend](#add-friend)
4. [Transactions](#4-transactions)
   - [Get All Transactions](#get-all-transactions)
   - [Get Settlements](#get-settlements)
   - [Settle Transaction](#settle-transaction)
   - [Retrieve Transaction Image](#retrieve-transaction-image)
5. [Analytics](#5-analytics)
   - [Get Statistics](#get-statistics)
6. [Payments](#6-payments)
   - [Create Payment Link](#create-payment-link)
   - [Request Payment (Invoice)](#request-payment-invoice)
   - [Send Payment (Transfer)](#send-payment-transfer)

---

## 1. Health Check

### GET `/health`

Check if the server is running.

**Request:**
```http
GET /health
```

**Response:**
```json
{
  "status": "ok"
}
```

**Status Codes:**
- `200 OK` - Server is running

---

## 2. Authentication

### Register User

Send OTP to user's email for authentication.

**Endpoint:** `POST /register`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (Success):**
```json
{
  "message": "OTP sent to email"
}
```

**Response (Error):**
```json
{
  "error": "Missing email"
}
```

**Status Codes:**
- `200 OK` - OTP sent successfully
- `400 Bad Request` - Missing email or Supabase error

**Example:**
```bash
curl -X POST https://splitton-ef215d77f9d0.herokuapp.com/register \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com"}'
```

---

### Verify OTP

Verify the OTP and create/update user profile.

**Endpoint:** `POST /verify`

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456",
  "telegram_id": 123456789
}
```

**Parameters:**
- `email` (required) - User's email address
- `otp` (required) - 6-digit OTP code from email
- `telegram_id` (optional) - Telegram user ID from WebApp SDK

**Response (Success):**
```json
{
  "message": "Verified!",
  "user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (Error):**
```json
{
  "error": "Invalid OTP"
}
```

**Status Codes:**
- `200 OK` - Verification successful
- `400 Bad Request` - Missing parameters or invalid OTP

**Example:**
```bash
curl -X POST https://splitton-ef215d77f9d0.herokuapp.com/verify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "otp": "123456",
    "telegram_id": 123456789
  }'
```

---

## 3. User Management

### List Friends

Get list of friends for a user.

**Endpoint:** `GET /friends/<user_id>`

**Parameters:**
- `user_id` (path) - UUID of the user

**Response:**
```json
[
  {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "nickname": "Bob",
    "friend_user_id": "770e8400-e29b-41d4-a716-446655440000"
  },
  {
    "id": "880e8400-e29b-41d4-a716-446655440000",
    "nickname": "Charlie",
    "friend_user_id": "990e8400-e29b-41d4-a716-446655440000"
  }
]
```

**Status Codes:**
- `200 OK` - Friends retrieved successfully
- `500 Internal Server Error` - Database error

**Example:**
```bash
curl https://splitton-ef215d77f9d0.herokuapp.com/friends/550e8400-e29b-41d4-a716-446655440000
```

---

### Add Friend

Add a new friend by email and nickname.

**Endpoint:** `POST /friends/<user_id>`

**Parameters:**
- `user_id` (path) - UUID of the user

**Request Body:**
```json
{
  "email": "bob@example.com",
  "nickname": "Bob"
}
```

**Response (Success):**
```json
{
  "message": "Friend added"
}
```

**Response (Error - Friend Not Found):**
```json
{
  "error": "Friend not found. Make sure they have registered first."
}
```

**Response (Error - Missing Parameters):**
```json
{
  "error": "Missing email or nickname"
}
```

**Status Codes:**
- `200 OK` - Friend added successfully
- `400 Bad Request` - Missing parameters
- `404 Not Found` - Friend email not registered
- `500 Internal Server Error` - Database error

**Example:**
```bash
curl -X POST https://splitton-ef215d77f9d0.herokuapp.com/friends/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -d '{
    "email": "bob@example.com",
    "nickname": "Bob"
  }'
```

---

## 4. Transactions

### Get All Transactions

Retrieve all transactions (pending and paid) where user is involved.

**Endpoint:** `GET /transactions/<user_id>`

**Parameters:**
- `user_id` (path) - UUID of the user

**Response:**
```json
[
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440000",
    "payer_id": "550e8400-e29b-41d4-a716-446655440000",
    "payee_id": "770e8400-e29b-41d4-a716-446655440000",
    "amount": 25.50,
    "status": "paid",
    "item": "Lunch at Pizza Place",
    "category": "Food",
    "created_at": "2025-01-18T10:30:00Z",
    "paid_at": "2025-01-19T14:20:00Z"
  },
  {
    "id": "bb0e8400-e29b-41d4-a716-446655440000",
    "payer_id": "770e8400-e29b-41d4-a716-446655440000",
    "payee_id": "550e8400-e29b-41d4-a716-446655440000",
    "amount": 15.00,
    "status": "pending",
    "item": "Coffee",
    "category": "Food",
    "created_at": "2025-01-19T09:15:00Z",
    "paid_at": null
  }
]
```

**Fields:**
- `id` - Transaction participant ID (use for settling)
- `payer_id` - UUID of person who paid
- `payee_id` - UUID of person who owes
- `amount` - Amount owed
- `status` - "pending" or "paid"
- `item` - Item/expense name
- `category` - Category (Food, Transportation, etc.)
- `created_at` - When transaction was created
- `paid_at` - When transaction was settled (null if pending)

**Status Codes:**
- `200 OK` - Transactions retrieved successfully

**Example:**
```bash
curl https://splitton-ef215d77f9d0.herokuapp.com/transactions/550e8400-e29b-41d4-a716-446655440000
```

---

### Get Settlements

Retrieve only pending settlements for a user.

**Endpoint:** `GET /settlements/<user_id>`

**Parameters:**
- `user_id` (path) - UUID of the user

**Response:**
```json
[
  {
    "id": "cc0e8400-e29b-41d4-a716-446655440000",
    "payer_id": "550e8400-e29b-41d4-a716-446655440000",
    "payee_id": "770e8400-e29b-41d4-a716-446655440000",
    "amount": 18.75,
    "status": "pending",
    "transaction_id": null,
    "item": "Movie tickets",
    "category": "Entertainment",
    "created_at": "2025-01-19T18:00:00Z"
  }
]
```

**Note:** Only returns transactions where `status = "pending"`

**Status Codes:**
- `200 OK` - Settlements retrieved successfully

**Example:**
```bash
curl https://splitton-ef215d77f9d0.herokuapp.com/settlements/550e8400-e29b-41d4-a716-446655440000
```

---

### Settle Transaction

Mark a transaction as paid.

**Endpoint:** `POST /settle/<transaction_participant_id>`

**Parameters:**
- `transaction_participant_id` (path) - UUID of the transaction participant

**Request Body:** None required

**Response (Success):**
```json
{
  "message": "Settled successfully"
}
```

**Response (Error):**
```json
{
  "error": "Failed to settle transaction"
}
```

**Status Codes:**
- `200 OK` - Transaction settled successfully
- `500 Internal Server Error` - Database error

**Example:**
```bash
curl -X POST https://splitton-ef215d77f9d0.herokuapp.com/settle/cc0e8400-e29b-41d4-a716-446655440000
```

---

### Retrieve Transaction Image

Get source image/voice path for a transaction.

**Endpoint:** `GET /retrieve_image/<transaction_id>`

**Parameters:**
- `transaction_id` (path) - UUID of the transaction

**Response:**
```json
{
  "source_path": "https://storage.supabase.co/receipts/abc123.jpg",
  "source_type": "image"
}
```

**Fields:**
- `source_path` - URL to the receipt image or voice note
- `source_type` - "image", "text", or "voice"

**Response (Error):**
```json
{
  "error": "Transaction not found"
}
```

**Status Codes:**
- `200 OK` - Image info retrieved successfully
- `404 Not Found` - Transaction not found

**Example:**
```bash
curl https://splitton-ef215d77f9d0.herokuapp.com/retrieve_image/dd0e8400-e29b-41d4-a716-446655440000
```

---

## 5. Analytics

### Get Statistics

Get category-wise spending statistics for a user.

**Endpoint:** `GET /stats/<user_id>`

**Parameters:**
- `user_id` (path) - UUID of the user

**Response:**
```json
{
  "Food": 156.75,
  "Transportation": 45.00,
  "Entertainment": 89.50,
  "Shopping": 200.00
}
```

**Description:** Returns object where keys are category names and values are total amounts spent in that category.

**Status Codes:**
- `200 OK` - Statistics retrieved successfully

**Example:**
```bash
curl https://splitton-ef215d77f9d0.herokuapp.com/stats/550e8400-e29b-41d4-a716-446655440000
```

---

## 6. Payments

### Create Payment Link

**NEW SIMPLIFIED ENDPOINT** - Create payment link for settlement.

**Endpoint:** `POST /payment_notification`

**Request Body:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "amount": 25.50
}
```

**Parameters:**
- `user_id` (required) - UUID of the user
- `amount` (required) - Amount in USD to create payment for

**Response (Success):**
```json
{
  "payment_url": "https://pay.crypt.bot/app?invoice_id=ABCDEF123456"
}
```

**Response (Error):**
```json
{
  "error": "Missing user_id or amount"
}
```

**Status Codes:**
- `200 OK` - Payment link created successfully
- `400 Bad Request` - Missing parameters
- `500 Internal Server Error` - Payment service error

**Usage Flow:**
1. Frontend calls this endpoint with user_id and amount
2. Backend creates Crypto Pay invoice
3. Returns payment URL
4. Frontend opens URL in Telegram WebView
5. User completes payment
6. Frontend marks transaction as settled via `/settle/<id>`

**Example:**
```bash
curl -X POST https://splitton-ef215d77f9d0.herokuapp.com/payment_notification \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "amount": 25.50
  }'
```

---

### Request Payment (Invoice)

Create a payment invoice and send to payer via Telegram.

**Endpoint:** `POST /request-payment/<transaction_participant_id>`

**Parameters:**
- `transaction_participant_id` (path) - UUID of the transaction participant

**Request Body:** None required

**Response (Success):**
```json
{
  "message": "Payment request sent",
  "pay_url": "https://pay.crypt.bot/app?invoice_id=ABCDEF123456",
  "amount": 25.50
}
```

**Response (Error - Already Paid):**
```json
{
  "error": "Transaction already settled"
}
```

**Response (Error - No Telegram):**
```json
{
  "error": "Payer has no Telegram account linked"
}
```

**Status Codes:**
- `200 OK` - Payment request sent successfully
- `400 Bad Request` - Transaction already settled
- `404 Not Found` - Transaction not found
- `500 Internal Server Error` - Payment or notification error

**What It Does:**
1. Gets transaction details (payer, payee, amount)
2. Creates USDT payment invoice via Crypto Pay
3. Sends Telegram notification to payer with payment link
4. Payer receives message: "💰 Payment Request" with "Pay $X USDT" button

**Example:**
```bash
curl -X POST https://splitton-ef215d77f9d0.herokuapp.com/request-payment/cc0e8400-e29b-41d4-a716-446655440000
```

---

### Send Payment (Transfer)

Send USDT to payee and mark transaction as paid.

**Endpoint:** `POST /send-payment/<transaction_participant_id>`

**Parameters:**
- `transaction_participant_id` (path) - UUID of the transaction participant

**Request Body:** None required

**Response (Success):**
```json
{
  "message": "Payment sent successfully",
  "transfer_id": "TRANSFER_ABC123",
  "amount": 25.50
}
```

**Response (Error - Already Paid):**
```json
{
  "error": "Transaction already settled"
}
```

**Response (Error - No Telegram):**
```json
{
  "error": "Payee has no Telegram account linked"
}
```

**Status Codes:**
- `200 OK` - Payment sent successfully
- `400 Bad Request` - Transaction already settled
- `404 Not Found` - Transaction not found
- `500 Internal Server Error` - Payment or transfer error

**What It Does:**
1. Gets transaction details (payer, payee, amount)
2. Sends USDT transfer to payee's Telegram via Crypto Pay
3. Marks transaction as "paid" in database
4. Sends Telegram notification to payee: "✅ You received $X USDT"

**Example:**
```bash
curl -X POST https://splitton-ef215d77f9d0.herokuapp.com/send-payment/cc0e8400-e29b-41d4-a716-446655440000
```

---

## Error Handling

### Standard Error Response Format

All endpoints return errors in this format:

```json
{
  "error": "Descriptive error message"
}
```

### Common HTTP Status Codes

- `200 OK` - Request successful
- `400 Bad Request` - Invalid parameters or request
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server or database error

### Common Error Messages

**Authentication:**
- "Missing email"
- "Invalid OTP"
- "Verification failed"

**User Management:**
- "Missing email or nickname"
- "Friend not found. Make sure they have registered first."
- "Failed to add friend"

**Transactions:**
- "Transaction not found"
- "Failed to settle transaction"

**Payments:**
- "Missing user_id or amount"
- "Transaction already settled"
- "Payer has no Telegram account linked"
- "Payee has no Telegram account linked"
- "Failed to create payment link"

---

## Rate Limiting

Currently, no rate limiting is implemented. Consider implementing rate limiting for production use.

---

## CORS Configuration

The backend has CORS enabled for all routes to allow frontend requests from any origin.

---

## Data Flow Examples

### Complete User Journey: Alice owes Bob $25

**1. Alice views settlements:**
```http
GET /settlements/alice-uuid
```
Response shows she owes Bob $25 for lunch.

**2. Alice clicks "Pay" button:**

**Option A: Simplified Flow (NEW)**
```http
POST /payment_notification
{
  "user_id": "alice-uuid",
  "amount": 25.50
}
```
Returns payment URL → Opens in Telegram → Alice pays → Frontend marks settled:
```http
POST /settle/participant-id
```

**Option B: Direct Transfer**
```http
POST /send-payment/participant-id
```
Sends USDT to Bob, marks as paid, sends confirmation.

**3. Bob sees update:**
```http
GET /transactions/bob-uuid
```
Transaction now shows status: "paid" with paid_at timestamp.

---

## Database Queries

All endpoints query Supabase PostgreSQL. Key relationships:

- `profiles` ← `friends.user_id` (one-to-many)
- `profiles` ← `friends.friend_user_id` (one-to-many)
- `transactions` ← `transaction_participants.transaction_id` (one-to-many)
- `transaction_participants` ← `transaction_items.participant_id` (one-to-many)

---

## Security Considerations

1. **Authentication:** Uses Supabase Auth with OTP verification
2. **Authorization:** Users can only access their own data (filtered by user_id)
3. **API Keys:** All sensitive keys stored as environment variables
4. **HTTPS:** All communication over HTTPS
5. **Telegram Validation:** telegram_id linked to verified user accounts

---

## Performance Notes

- **Settlements endpoint** filters on status='pending' for efficiency
- **Transactions endpoint** returns all transactions (consider pagination for large datasets)
- **Friends endpoint** returns all friends (consider pagination if needed)

---

## Future Improvements

- [ ] Add pagination for transactions and friends
- [ ] Implement rate limiting
- [ ] Add webhook for Crypto Pay payment confirmations
- [ ] Add request validation middleware
- [ ] Implement caching for frequently accessed data
- [ ] Add comprehensive logging and monitoring

---

**Last Updated:** January 19, 2025  
**API Version:** 1.0.0  
**Backend URL:** https://splitton-ef215d77f9d0.herokuapp.com
