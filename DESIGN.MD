# DESIGN.md - UI/UX Guidelines & Design System

## 1. Design Philosophy & Overview
This document defines the design system for the application. The visual language is heavily inspired by **Banco Plata** (a modern, sleek, premium neo-bank). 

**Core Characteristics:**
- **Premium Neo-banking Feel:** Minimalist, high-contrast, uncluttered, and highly trustworthy.
- **Base Theme:** Dark mode by default (deep blacks and rich grays) to make the accent colors pop and reduce eye strain.
- **Signature Accent:** A rich emerald green gradient (`bg-gradient-to-r from-emerald-500 to-emerald-900`).
- **Shapes:** Soft, large border radiuses (`rounded-2xl`, `rounded-3xl`) for cards and containers, giving a tactile, modern mobile-app feel.
- **Typography:** Clean, geometric sans-serif (Inter, SF Pro, or Roboto). High readability with strict hierarchy.

**Instruction for Agents:** 
When generating UI code (React, Vue, HTML/CSS), strictly adhere to the Tailwind CSS classes and design principles outlined in this document. Do not invent new color palettes.

---

## 2. Color Palette (Tailwind CSS)

### Backgrounds & Surfaces
The app uses a layered dark theme to create depth.
- **App Background (Base):** `bg-black` or `bg-zinc-950`
- **Card / Surface (Level 1):** `bg-zinc-900`
- **Elevated Surface (Level 2):** `bg-zinc-800`
- **Borders/Dividers:** `border-zinc-800` or `border-zinc-700/50`

### Brand & Accents
The signature gradient must be used for primary actions, account balance cards, and key highlights.
- **Primary Gradient (Backgrounds):** `bg-gradient-to-r from-emerald-500 to-emerald-900`
- **Primary Gradient (Text):** `bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-emerald-700`
- **Interactive Hover State:** `hover:brightness-110 transition-all duration-200`
- **Muted Accent (for subtle highlights):** `bg-emerald-900/20 text-emerald-400`

### Typography Colors
- **Primary Text (Headings, Main Balances):** `text-white`
- **Secondary Text (Subtitles, Dates, Categories):** `text-zinc-400`
- **Tertiary Text (Placeholders, Muted info):** `text-zinc-500`

### Semantic Colors
- **Income / Positive:** `text-emerald-400`
- **Expense / Negative:** `text-white` (Keep neutral to avoid user anxiety, or use `text-zinc-300`)
- **Error / Destructive:** `text-rose-500` `bg-rose-500/10`
- **Warning:** `text-amber-500`

---

## 3. Typography & Spacing

### Fonts
- **Family:** `font-sans` (Default to Inter, system-ui, or SF Pro).
- **Tracking:** Use `tracking-tight` for large headings (balances) and `tracking-normal` for body text.

### Hierarchy Rules
- **Main Balance (Hero):** `text-5xl font-bold tracking-tighter text-white`
- **Section Titles:** `text-xl font-semibold text-white mb-4`
- **Card Titles (e.g., Transaction Name):** `text-base font-medium text-white`
- **Small Info / Meta:** `text-sm text-zinc-400 font-normal`

### Spacing & Layout
- Mobile-first approach. Wrap the main app container in `max-w-md mx-auto min-h-screen bg-black`.
- Standard screen padding: `px-4 py-6` or `p-5`.
- Gap between stacked cards: `space-y-3` or `gap-3`.

---

## 4. Core Components

### A. The "Plata" Main Account Card
This represents the user's main wallet or virtual card. It should be the visual centerpiece.
```html
<div class="bg-gradient-to-r from-emerald-500 to-emerald-900 rounded-[32px] p-6 text-white shadow-lg shadow-emerald-900/20 relative overflow-hidden">
  <!-- Subtle glass overlay/shine effect -->
  <div class="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
  <div class="relative z-10">
    <p class="text-emerald-100 text-sm font-medium mb-1">Total Balance</p>
    <h1 class="text-4xl font-bold tracking-tight mb-8">₽ 124,500.00</h1>
    <div class="flex justify-between items-end">
      <p class="text-sm font-medium opacity-80">Honest Month</p>
      <!-- Optional Mastercard/Visa circles or icon -->
    </div>
  </div>
</div>