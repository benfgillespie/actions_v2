# Task Tracker — Next.js + Vercel KV (Cloud Persistence)

This is a ready-to-deploy Next.js project that stores your task data in **Vercel KV** (Redis),
so your tasks persist across sessions, browsers, and devices.

## 1) Install and run locally (optional)
```bash
npm install
npm run dev
# open http://localhost:3000
```

> If you run locally, create `.env.local` from `.env.local.example` and fill the KV values (see below).

## 2) Create a Vercel project and connect KV
1. Go to **vercel.com → New Project → Import** this folder.
2. In your project, go to **Storage → Connect → KV** and create a KV store.
3. Go to **Settings → Environment Variables** and add the four KV variables Vercel provides:
   - `KV_URL`
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN`
4. **Redeploy**.

That’s it. Each visitor gets an anonymous cookie `anon_id`; their data is saved under a KV key like `task-tracker:<anon_id>`.

## Notes
- Your original `task-tracker.jsx` was placed into `components/TaskTracker.jsx`.
- We attempted to replace common `localStorage` useEffects with API-based persistence.
  If your UI doesn't seem to load/save correctly, tell ChatGPT and paste any console errors.
