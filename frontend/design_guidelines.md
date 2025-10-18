# Design Guidelines: Money AI Splitter Telegram Mini App

## Design Approach

**Selected Approach:** Hybrid Design System + Reference-Based

**Primary References:**
- Telegram Mini Apps design language (native integration)
- Splitwise (expense splitting patterns)
- Revolut (financial clarity and trust)
- Material Design 3 (component foundation)

**Design Principles:**
1. **Instant Clarity** - Financial data must be scannable at a glance
2. **Trust Through Transparency** - Every calculation is visible and editable
3. **Frictionless Capture** - Minimize steps from receipt to split
4. **Mobile-First Precision** - Optimized for one-handed Telegram usage

---

## Core Design Elements

### A. Color Palette

**Light Mode:**
- **Primary:** 210 100% 50% (Telegram blue - trust, action)
- **Background:** 0 0% 98% (Clean canvas)
- **Surface:** 0 0% 100% (Cards, elevated elements)
- **Text Primary:** 220 15% 15%
- **Text Secondary:** 220 10% 45%
- **Success (Paid):** 142 76% 36%
- **Warning (Pending):** 38 92% 50%
- **Danger (Debt):** 0 84% 60%

**Dark Mode:**
- **Primary:** 210 100% 60% (Brighter for contrast)
- **Background:** 220 15% 10% (Telegram dark theme)
- **Surface:** 220 13% 14% (Subtle elevation)
- **Text Primary:** 0 0% 95%
- **Text Secondary:** 0 0% 65%
- **Success:** 142 71% 45%
- **Warning:** 38 92% 60%
- **Danger:** 0 84% 65%

### B. Typography

**Font Family:**
- Primary: 'Inter', system-ui, sans-serif (via Google Fonts CDN)
- Monospace: 'JetBrains Mono' for currency amounts (precision feel)

**Scale:**
- **Headline (Receipt Total):** 32px / 700 / -0.02em
- **Title (Page Headers):** 24px / 600 / -0.01em
- **Subtitle (Section Labels):** 18px / 600 / normal
- **Body (Transaction Details):** 15px / 400 / normal
- **Caption (Metadata):** 13px / 400 / normal
- **Currency Display:** 20px / 600 / tabular-nums

### C. Layout System

**Spacing Primitives:** Tailwind units of **2, 4, 8, 12, 16** (e.g., p-4, gap-8, mb-12)

**Container Structure:**
- Max width: 640px (mobile-optimized)
- Page padding: px-4 (16px sides)
- Bottom navigation clearance: pb-20 (80px for fixed nav)

**Grid Patterns:**
- Transaction list: Single column, gap-3
- Split participants: 2-column grid on larger screens (grid-cols-2 gap-4)
- Analytics categories: Auto-fit grid (grid-cols-[repeat(auto-fit,minmax(140px,1fr))])

### D. Component Library

**Navigation:**
- **Bottom Tab Bar** (fixed, 64px height, glass morphism effect with backdrop-blur-lg)
  - 5 icons: Home, Add, Summary, Settle, Analytics
  - Active state: Primary color with small indicator dot above
  - Inactive: Secondary text color
  
**Capture Bar:**
- Fixed bottom (above nav when on Add page)
- 3 capture methods in horizontal row: Camera (primary), Text input, Voice (disabled state shown)
- Height: 56px, rounded-t-2xl, shadow-lg
- Glass effect: bg-surface/95 backdrop-blur-md

**Cards:**
- **Receipt Card:** Rounded-2xl, p-4, shadow-sm, border-l-4 (category color)
  - Header: Total (large, bold) + Date + Category icon
  - Body: Itemized list (if available)
  - Footer: Participant avatars (overlapping circles, -space-x-2)
  
- **Participant Card:** Rounded-xl, p-3, border-2 (state-dependent)
  - Avatar + Username + Split amount
  - Edit icon (top-right)
  - States: Paid (green border), Owes (orange border), Even (neutral)

**Cash Flow Arrows:**
- SVG-based directed graph
- Arrow thickness: Proportional to debt amount
- Colors: Red (owes), Green (receives), with gradient
- Labels: Inline with arrow showing amount
- Layout: Vertical stack, centered, compact

**Buttons:**
- **Primary CTA:** bg-primary text-white rounded-full py-3 px-6 font-semibold shadow-md
- **Secondary:** bg-surface border-2 border-primary text-primary rounded-full py-3 px-6
- **Icon Buttons:** 48px square, rounded-full, ghost hover state
- **Settle Button:** Full-width, gradient from primary to 240 100% 45%, py-4, font-bold

**Modals:**
- Slide-up animation (from-bottom)
- Backdrop: bg-black/40 backdrop-blur-sm
- Content: Rounded-t-3xl, max-h-[90vh], overflow-scroll
- Handle: Centered gray pill at top (w-12 h-1 bg-gray-400 rounded-full)

**Forms:**
- Input fields: border-2 border-gray-300 rounded-xl px-4 py-3 focus:border-primary
- Currency inputs: Right-aligned, monospace font
- Participant selector: Multi-select chips (rounded-full, removable)
- Category picker: Icon grid (4 columns, colorful icons)

**Charts (Recharts):**
- **Pie Chart:** Pastel category colors, interactive hover tooltips, centered label showing total
- **Line Graph (Analytics):** Smooth curves, gradient fill below line, minimal grid
- Legend: Below chart, horizontal, with color dots

**Empty States:**
- Centered illustration placeholder (grayscale icon, 120px)
- Headline: "No expenses yet"
- Subtext: Action prompt
- CTA button below

### E. Interactions & Animations

**Micro-interactions:**
- Button press: scale-95 transform on active
- Card tap: Subtle scale-98 + shadow increase
- Tab switch: Slide transition (150ms ease-out)
- Modal appearance: Slide-up + fade-in (200ms)

**Loading States:**
- Skeleton screens for lists (pulse animation)
- Spinner for AI processing (primary color, 32px)
- Progress bar for photo upload (gradient, rounded-full)

**Gestures:**
- Swipe to delete transaction (red background reveal)
- Pull to refresh on home (Telegram-style spinner)

---

## Page-Specific Layouts

### Home Page
- **Header:** "Groups" title + Add group button
- **Group Cards:** Rounded-xl, shows: Group name, Total owed/owed to (bold), Member count
- **Recent Transactions:** Below groups, chronological list, "View All" link
- **Floating Action Button:** Bottom-right, primary color, "+" icon (56px circle)

### Add Expense Page
- **Preview Area:** Top 40% of screen, shows uploaded receipt image or placeholder
- **Form Section:** Scrollable, fields for: Total (large input), Date picker, Category selector, Note (optional)
- **Capture Bar:** Fixed bottom with 3 options
- **Submit Button:** Disabled state until total entered

### Split Summary Page
- **Receipt Info Card:** Top, shows total + AI confidence badge ("95% confident")
- **Participant List:** Editable cards, tap to adjust split percentage
- **Visual Split:** Horizontal bar chart showing split proportions by color
- **Cash Flow Section:** Arrow diagram below participants
- **Actions:** "Confirm Split" (primary) + "Edit Receipt" (secondary)

### Settle Page
- **Outstanding Debts:** Cards showing who owes whom, sorted by amount
- **TON Pay Section:** Mock TON wallet connect button + QR code placeholder
- **Settlement History:** Collapsed accordion, expands to show past settlements

### Analytics Page
- **Time Filter:** Segmented control (Week/Month/Year) at top
- **Total Spent Card:** Large number with trend indicator (↑ 12% from last month)
- **Category Pie Chart:** Center of page, interactive
- **Top Categories List:** Below chart, with icons and percentages
- **Spending Timeline:** Line graph at bottom

---

## Images

**No hero images needed** - This is a utility app focused on functionality over marketing.

**Icon Usage:**
- Use **Heroicons** (outline style) via CDN for all interface icons
- Category icons: Food (utensils), Transport (car), Entertainment (ticket), Shopping (bag), Bills (receipt), Other (dots)
- Navigation icons: Home (house), Plus (add), List (bars), Coins (TON), Chart (bar-chart)

**Avatar Placeholders:**
- Telegram profile pictures (circular, pulled from Telegram API)
- Fallback: Colored circles with initials (based on username hash)

**Receipt Images:**
- User-uploaded photos, displayed with rounded corners
- AI processing overlay: Semi-transparent with spinner during parse

---

## Accessibility & Responsiveness

- Minimum touch target: 44px
- Color contrast: WCAG AA compliant (4.5:1 for text)
- Dark mode: Consistent across all components, no stark whites
- Form inputs: Properly labeled, error states in red with clear messages
- Currency display: Always 2 decimal places, localized formatting

**Responsive Breakpoints:**
- Mobile: Base (up to 640px) - Single column, bottom nav
- Tablet: sm (640px+) - Slight padding increase, 2-column grids where applicable

This design creates a trustworthy, efficient expense-splitting experience that feels native to Telegram while incorporating best practices from leading financial apps.