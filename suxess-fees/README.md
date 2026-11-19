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

## New features (attendance + messages)

After deploying code, run in Supabase SQL Editor:

1. `migration-daily-attendance-messages.sql` — creates `daily_attendance`, chat tables, and RLS.
2. Storage: create a **public** bucket named `chat-voice` (Storage → New bucket). Allow authenticated users to upload and public/authenticated read.

### Daily attendance
- Secretaries: **Daily Attendance** in the sidebar — enter how many students were present today.
- Director: top of the Dashboard shows present counts for each branch for today.

### Card renewals
- Long lists (Still valid, Due today, Expired, Older expired) are **collapsible** so the page stays neat. Urgent lists open by default when short.

### Messages
- **Messages** in the sidebar (all users).
- Director can start a chat with any secretary; text + voice notes.
- Realtime updates via Supabase Realtime (enable replication on `chat_messages` if needed).

### Attendance (Main vs Tutorial)
- **Suxess School (Main)** secretary: enter **present count per class**. Totals + class breakdown show on the director dashboard.
- **Arepo / Ofada Mowe**: single total only (unchanged).
- Run `migration-attendance-class-breakdown.sql` to add the `class_breakdown` JSON column.

### Message read status
- Unread badge on **Messages** in the sidebar and in the chat list.
- On your own messages: single check = sent, double check + “Seen” = the other person opened the chat.
- Enable Realtime on `chat_messages` and `chat_participants` in Supabase for live updates.


## Alpha (Director AI)

Admin-only assistant at **/ai**.

- Answers from **live Supabase data** (card renewals by branch, attendance, payments, outstanding, exams, students).
- Works **without** an API key via built-in data tools.
- For natural chat, set `XAI_API_KEY` (Grok) or `OPENAI_API_KEY` in `.env.local` / Vercel.
