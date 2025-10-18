# Money AI Splitter - Telegram Mini App

## Overview
A Telegram Mini App for AI-powered expense splitting with receipt parsing, cash flow visualization, and TON settlement capabilities. Built with React, TypeScript, Express, and OpenAI integration.

## Project Structure

### Frontend (React + Vite + Tailwind CSS)
- **Pages:**
  - `/` - Home: Recent expenses, cash flow overview, outstanding balances
  - `/add` - Add Expense: Multi-modal capture (photo/text/voice), AI receipt parsing
  - `/summary` - Split Summary: Review split breakdown, edit participants, view cash flow
  - `/settle` - Settle: TON payment integration, settlement tracking
  - `/analytics` - Analytics: Category breakdown, spending trends, pie charts

- **Components:**
  - `CaptureBar` - Bottom bar with photo/text/voice capture options
  - `ReceiptCard` - Display expense details with category icons and participants
  - `CashFlowGraph` - Arrow-based visualization of who owes whom
  - `CategoryChart` - Recharts pie chart for category breakdown
  - `ConfirmModal` - Reusable confirmation dialog
  - `BottomNav` - Fixed bottom navigation for mobile-first design

### Backend (Express + TypeScript)
- **Authentication:** Email + OTP UI only (backend auth ready for Supabase integration)
- **Storage:** In-memory storage for expenses and splits (ready for PostgreSQL migration)
- **API Endpoints:**
  - `POST /api/parse-receipt` - OpenAI vision-based receipt parsing
  - `GET /api/expenses` - Fetch all expenses
  - `POST /api/expenses` - Create new expense with auto-split calculation
  - `GET /api/splits` - Fetch all payment splits
  - `PATCH /api/splits/:id` - Update settlement status

### State Management
- **Zustand Store:** Global state for expenses, splits, cash flow calculations
- **React Query:** Server state caching and synchronization

## Tech Stack
- **Frontend:** React 18, TypeScript, Wouter (routing), Tailwind CSS, Recharts
- **Backend:** Express, Multer (file uploads), OpenAI (via Replit AI Integrations)
- **Telegram:** @twa-dev/sdk for Mini App integration
- **State:** Zustand (client), React Query (server)

## Design System
Following Telegram's design language with:
- **Primary Color:** Telegram blue (#0088cc)
- **Typography:** Inter (UI), JetBrains Mono (currency)
- **Components:** Shadcn UI with custom Telegram-inspired styling
- **Interactions:** Smooth transitions, glass morphism effects, hover elevations
- **Mobile-First:** Optimized for one-handed Telegram usage

## Key Features
1. **AI Receipt Parsing:** Upload photos, AI extracts total, items, and suggests categories
2. **Smart Splitting:** Automatic equal split with editable participant shares
3. **Cash Flow Optimization:** Visual arrows showing who owes whom
4. **Category Analytics:** Pie charts and breakdowns by spending category
5. **TON Integration:** Mock settlement flow (ready for TON blockchain integration)
6. **Telegram Native:** Full Telegram Mini App SDK integration with theme support

## Development Workflow
```bash
npm install
npm run dev  # Starts both frontend (Vite) and backend (Express)
```

## Recent Changes
- **2025-01-18:** Complete navigation and data flow restructure
- **Navigation:** 3 tabs - Transactions, Settle, Stats (removed Add tab - data will come from Supabase)
- **Transactions Tab:** Shows SETTLED debts only (settled === amount)
- **Settle Tab:** Shows UNSETTLED debts only (amount > settled) with "You Owe" and "You're Owed" sections
- **Profile System:** 
  - Profile icon in top-right header (all pages except auth)
  - Add friends by nickname + email
  - Friends API: GET/POST/DELETE /api/friends
- **Data Flow:** Expenses from Supabase → Settle tab → Pay → Transactions tab
- **Auth Flow:** Email + OTP → redirects to /transactions (not /home)
- Email stored in `window.userEmail` for Supabase integration
- Individual debt tracking per expense with image/voice icons
- All API endpoints functional with proper error handling
- Ready to manipulate Settle, Transactions, and Analytics tabs for testing

## Next Steps
1. Implement backend API endpoints with OpenAI receipt parsing
2. Connect frontend to backend with full CRUD operations
3. Test end-to-end flows (upload → parse → split → settle)
4. Add persistent storage (PostgreSQL migration)
5. Integrate real TON wallet for blockchain settlements

## User Preferences
- Mobile-first design optimized for Telegram
- Emphasis on visual clarity for financial data
- Frictionless expense capture and splitting
- Trust through transparent calculations
