# Custom 5v5

League of Legends custom game randomizer for friend groups. Randomize teams, lanes, and champions with fearless draft rules.

## Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- A Supabase account (free tier works)

## Setup

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to Project Settings > API
3. Copy the **Project URL** and **anon/public key**

### 2. Run the database schema

1. In your Supabase dashboard, go to SQL Editor
2. Paste the contents of `supabase/schema.sql` and run it
3. This creates the `players`, `games`, `game_players`, and `daily_fearless` tables

### 3. Configure environment variables

Create `.env.local` in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Install and run

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. Push this repo to GitHub
2. Import the repo on [vercel.com](https://vercel.com)
3. Add the two environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
4. Deploy

## Champion Images

Champion images are loaded from Riot's free public Data Dragon CDN. No API key is needed. The app uses static champion data (version 14.24.1) and does not call any external APIs.

## Fearless Draft

Champions used in confirmed games are automatically banned for the rest of the calendar day. The ban list resets at midnight (database timezone). No cron job is needed.

## Riot API Key (Future Use)

If you want to extend this app with live game data in the future:

1. Go to [developer.riotgames.com](https://developer.riotgames.com)
2. Sign in with your Riot account
3. Register a new application for a Personal API Key
4. Personal keys are limited to 20 requests per second, 100 per 2 minutes
