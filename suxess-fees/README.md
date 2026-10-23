# Suxess Fees – School Payment Tracker

Web app for **Suxess Schools** (Main + Arepo + Ofada Mowe) to track student fee payments.

## Features

- Multi-campus support (Suxess Schools, Suxess Tutorial – Arepo, Suxess Tutorial – Ofada Mowe)
- Student management
- Record payments (cash, transfer, POS, etc.)
- Automatic outstanding balance calculation
- Printable receipts with school logo
- WhatsApp quick link for debtors
- Admin-only access

## Tech Stack

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Supabase (Auth + PostgreSQL)
- **Deploy**: Vercel (frontend) + Supabase (database)

## Deployment Guide

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Copy the **Project URL** and **anon public key**
3. Open **SQL Editor** and run the entire content of `supabase-schema.sql`
4. Go to **Authentication → Users** and create your first admin user (email + password)

### 2. Local Setup

```bash
git clone <your-repo>
cd suxess-fees
npm install
cp .env.example .env.local
```

Edit `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

```bash
npm run dev
```

Open http://localhost:3000

### 3. Deploy to Vercel

1. Push the code to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import the repo
3. Add the same two environment variables
4. Deploy

That’s it. Your app will be live.

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/          # Login page
│   └── (dashboard)/           # Protected pages
│       ├── page.tsx           # Dashboard
│       ├── students/
│       ├── payments/
│       ├── outstanding/
│       └── receipts/
├── components/
├── lib/supabase/
└── types/
```

## Logo

School logo is at `public/logo.png`.

## License

Private – for Suxess Schools use only.
