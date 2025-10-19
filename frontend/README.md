# SplitTon - AI-Powered Expense Splitter

A Telegram Mini App for intelligent expense splitting with AI receipt parsing, multi-modal expense capture, cryptocurrency payments via Crypto Pay (USDT), and real-time settlement tracking.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 🌟 Features

### Core Functionality
- **🤖 AI Receipt Parsing** - Upload photos/voice notes, AI extracts items and amounts using Google Gemini
- **👥 Smart Expense Splitting** - Automatic equal splits with editable participant shares
- **💰 Crypto Payments** - Settle debts with USDT via Telegram's Crypto Pay integration
- **📊 Analytics Dashboard** - Category breakdowns, spending trends, and visual insights
- **🔐 Secure Authentication** - Email + OTP authentication via Supabase
- **📱 Telegram Native** - Full Telegram Mini App SDK integration with theme support

### User Experience
- **Multi-Modal Capture** - Add expenses via photo, text, or voice
- **Cash Flow Visualization** - Clear arrow-based visualization of who owes whom
- **Net Settlement** - Groups debts by person showing net amounts (Splitwise-style)
- **Session Persistence** - Stay logged in across app refreshes (30-day sessions)
- **Real-Time Sync** - Auto-refresh when Mini App reopens
- **Mobile-First Design** - Optimized for one-handed Telegram usage

## 🤖 Try It Now!

The app is **live on Telegram!** Start using SplitTon right away:

### How to Get Started

1. **Open Telegram** on your phone or desktop
2. **Search for** [@spliton_test_bot](https://t.me/spliton_test_bot) or click the link
3. **Send** `/start` to open the Mini App
4. **Sign up** with your email (you'll receive an OTP code)
5. **Start splitting expenses!**

### What You Can Do

Once you're in the app:

- **📸 Add Expenses** - Send a photo of your receipt and let AI parse it automatically
- **✍️ Text Input** - Type expense details like "I paid $50 for dinner with Alice and Bob"
- **🎤 Voice Notes** - Record expense details and AI will understand them
- **👥 Add Friends** - Connect with friends by their email to split expenses
- **💰 Settle Debts** - Pay with USDT via Crypto Pay directly in Telegram
- **📊 View Analytics** - See your spending breakdown by category

### Need Help?

- Send any message to the bot with expense details and AI will parse it
- The Mini App interface has 3 tabs: Transactions, Settlements, and Analytics
- All your data syncs in real-time across devices

**Bot Username:** [@spliton_test_bot](https://t.me/spliton_test_bot)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Telegram Mini App                        │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Transactions │  │  Settlements │  │   Analytics  │    │
│  │     Page     │  │     Page     │  │     Page     │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │         React + TypeScript + Tailwind CSS            │ │
│  │    Wouter Router | Zustand | React Query (v5)       │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Flask Backend (Heroku)                         │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  REST API Endpoints (see architecture.md)            │ │
│  │  • Auth (OTP) • Friends • Transactions • Payments    │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Supabase    │  │  Crypto Pay  │  │ Telegram Bot │    │
│  │  Client      │  │  API Client  │  │  (Polling)   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ↓                   ↓                   ↓
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Supabase    │    │  Crypto Pay  │    │   Telegram   │
│  PostgreSQL  │    │     API      │    │  Bot API     │
│  + Auth      │    │   (USDT)     │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
```

## 🚀 Tech Stack

### Frontend
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS with custom design system
- **Routing:** Wouter (minimalist React router)
- **State Management:** 
  - Zustand (client state)
  - TanStack Query v5 (server state)
- **UI Components:** Shadcn UI with Radix UI primitives
- **Charts:** Recharts
- **Telegram:** @twa-dev/sdk

### Backend
- **Framework:** Flask (Python)
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth (Email + OTP)
- **AI:** Google Gemini API (receipt parsing)
- **Payments:** Crypto Pay API (@CryptoBot)
- **Telegram:** python-telegram-bot
- **Deployment:** Heroku

## 📦 Installation

### Prerequisites
- Node.js 18+ (for frontend development on Replit)
- Python 3.9+ (for backend on Heroku)
- Supabase account
- Telegram Bot Token
- Crypto Pay API Token
- Google Gemini API Key

### Environment Variables

**Backend (.env on Heroku):**
```bash
# Supabase
PROJECT_URL=https://your-project.supabase.co
DATABASE_API_KEY=your_service_role_key

# Telegram
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
MINIAPP_URL=https://your-frontend-url.replit.app

# Crypto Pay
CRYPTO_PAY_API_TOKEN=your_crypto_pay_token

# AI
GEMINI_API_KEY=your_gemini_api_key
```

**Frontend (environment variables on Replit - not needed for most cases):**
- Frontend automatically connects to `https://splitton-ef215d77f9d0.herokuapp.com`

### Backend Setup (Heroku)

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/splitton.git
cd splitton
```

2. **Deploy to Heroku:**
```bash
# Install Heroku CLI if needed
# https://devcenter.heroku.com/articles/heroku-cli

heroku create splitton
heroku config:set PROJECT_URL=your_supabase_url
heroku config:set DATABASE_API_KEY=your_supabase_key
heroku config:set TELEGRAM_BOT_TOKEN=your_bot_token
heroku config:set CRYPTO_PAY_API_TOKEN=your_crypto_pay_token
heroku config:set GEMINI_API_KEY=your_gemini_key
heroku config:set MINIAPP_URL=your_frontend_url

git push heroku main
```

3. **Verify deployment:**
```bash
curl https://your-heroku-app.herokuapp.com/health
# Should return: {"status": "ok"}
```

### Frontend Setup (Replit)

1. **Open in Replit:**
   - Import this repository or upload as ZIP
   - Replit will auto-detect the environment

2. **Install dependencies:**
```bash
npm install
```

3. **Update API endpoint (if needed):**
   - Edit `client/src/lib/api.ts`
   - Change `API_BASE_URL` to your Heroku backend URL

4. **Run development server:**
```bash
npm run dev
```

5. **Configure Telegram Bot:**
   - Set Mini App URL in BotFather to your Replit URL

## 🗄️ Database Schema

### Tables

**profiles**
- `id` (uuid, primary key)
- `email` (text)
- `telegram_id` (bigint)
- `created_at` (timestamp)

**friends**
- `id` (uuid, primary key)
- `user_id` (uuid, foreign key → profiles.id)
- `friend_user_id` (uuid, foreign key → profiles.id)
- `nickname` (text)
- `created_at` (timestamp)

**transactions**
- `id` (uuid, primary key)
- `creator_id` (uuid, foreign key → profiles.id)
- `source_type` (text: 'image', 'text', 'voice')
- `source_path` (text)
- `created_at` (timestamp)

**transaction_participants**
- `id` (uuid, primary key)
- `transaction_id` (uuid, foreign key → transactions.id)
- `payer_id` (uuid, foreign key → profiles.id)
- `payee_id` (uuid, foreign key → profiles.id)
- `amount` (decimal)
- `status` (text: 'pending', 'paid')
- `created_at` (timestamp)
- `paid_at` (timestamp)

**transaction_items**
- `id` (uuid, primary key)
- `participant_id` (uuid, foreign key → transaction_participants.id)
- `item_name` (text)
- `item_price` (decimal)
- `category` (text: 'Food', 'Transportation', etc.)

## 🔐 Authentication Flow

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       │ 1. Enter email
       ↓
┌─────────────┐
│  Frontend   │──────2. POST /register──────┐
└──────┬──────┘                             │
       │                                    ↓
       │                            ┌───────────────┐
       │                            │   Supabase    │
       │                            │   Auth API    │
       │                            └───────┬───────┘
       │                                    │
       │ 3. OTP sent to email ←─────────────┘
       │
       │ 4. Enter OTP
       ↓
┌─────────────┐
│  Frontend   │──────5. POST /verify────────┐
└──────┬──────┘                             │
       │                                    ↓
       │                            ┌───────────────┐
       │                            │   Backend     │
       │                            │  (Validates)  │
       │                            └───────┬───────┘
       │                                    │
       │ 6. Returns user_id ←───────────────┘
       │
       │ 7. Save session (localStorage)
       ↓
┌─────────────┐
│ Logged In!  │
└─────────────┘
```

## 💳 Payment Flow

### Simplified Crypto Pay Integration

```
User clicks "Pay" button
       │
       ↓
POST /payment_notification
   { user_id, amount }
       │
       ↓
Crypto Pay creates invoice
       │
       ↓
Returns payment_url
       │
       ↓
Frontend opens URL (Telegram WebView)
       │
       ↓
User completes payment
       │
       ↓
Frontend marks transaction as settled
   POST /settle/{id}
       │
       ↓
Settlement disappears from UI
```

## 📱 Telegram Bot Commands

- `/start` - Initialize bot and open Mini App
- Send image/text/voice - AI parses and creates transaction

## 🎨 Design System

Following Telegram's design language:
- **Primary Color:** Telegram blue (#0088cc)
- **Typography:** Inter (UI), JetBrains Mono (currency)
- **Components:** Shadcn UI with Telegram-inspired styling
- **Interactions:** Smooth transitions, glass morphism effects
- **Mobile-First:** Optimized for one-handed usage

## 📝 API Documentation

See [architecture.md](./architecture.md) for complete API endpoint documentation with request/response examples.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- [Replit](https://replit.com) - Frontend development and hosting
- [Heroku](https://heroku.com) - Backend hosting
- [Supabase](https://supabase.com) - Database and authentication
- [Telegram](https://telegram.org) - Mini App platform
- [Crypto Pay](https://help.crypt.bot/crypto-pay-api) - Payment processing
- [Google Gemini](https://ai.google.dev) - AI receipt parsing

## 📞 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Contact via Telegram: [@andreuscarvalho](https://t.me/andreuscarvalho)

---

Built with ❤️ using Telegram Mini Apps
