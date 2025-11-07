# MathArcade — 100 connected math games on Next.js

This repo now scaffolds a new experience where ~100 math mini-games share authentication, a unified progress map, and persistent storage on Vercel-friendly services.

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

Create a `.env.local` file with your Auth.js + Vercel KV secrets:

```bash
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace-me
GITHUB_ID=...
GITHUB_SECRET=...
KV_URL=...
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
KV_REST_API_READ_ONLY_TOKEN=...
```

> During local development the progress store falls back to an in-memory map, so you can explore the UI without KV configured. For production, connect Vercel KV (recommended) or swap `lib/progress-store.js` with Vercel Postgres if you prefer relational records.

## Architecture overview

- **Next.js App Router** with `/games` and `/games/[slug]` routes for hosting up to 100 experiences. Metadata for every slot lives in `lib/games.js`. Add a new game by supplying a `loader` that dynamically imports your React component.
- **Authentication** is handled by NextAuth/Auth.js (`app/api/auth/[...nextauth]/route.js`). GitHub OAuth is pre-configured; replace or add providers in `lib/authOptions.js`.
- **Progress tracking** flows through `/api/progress`. Each signed-in player stores stats per game plus cross-game totals. Production writes go to Vercel KV, while local mode uses an in-memory map automatically.
- **Example game**: `components/games/PlaceValuePractice.jsx` is the provided template (imported from the original `example.jsx`). It reports `score`, `accuracy`, `questionsAnswered`, `streak`, and elapsed time through the shared `onProgress` callback so every run is persisted.
- **Stage 1 Connected Practice**: `components/games/StageOnePractice.jsx` lets learners hop between Stage 1 topics (place value, time, negatives, powers, BIDMAS, factors, fractions, coordinates) without leaving the screen. Each topic wires in a Maths Genie helper video link and highlights it after three misses in a row.
- **UI**: `app/page.jsx` is a marketing/overview page with live progress cards. `/games` lists all slots, and `/games/[slug]` loads the corresponding component only when available, showing a “coming soon” state otherwise.

## Recommended Vercel services

- **Vercel KV (Redis)** – already integrated for user progress storage. It’s perfect for key/value JSON blobs keyed by `math-arcade:progress:<userId>`, keeps reads fast, and requires zero schema management.
- **Optional: Vercel Postgres** – if you later need analytics, cohorts, or SQL joins across classrooms, swap `lib/progress-store.js` for a Postgres-backed implementation. The rest of the app (API routes, hooks, and UI) won’t need changes.

## Adding new games

1. Drop the React component into `components/games/YourGame.jsx`. Accept an `onProgress` prop and fire it whenever you want to persist stats (see `PlaceValuePractice` for a reference).
2. Add an entry in `lib/games.js`:
   ```js
   {
     slug: "fractions-master",
     title: "Fractions Master",
     subject: "Fractions",
     difficulty: 3,
     estimatedMinutes: 7,
     status: "live",
     loader: () => import("@/components/games/FractionsMaster"),
   }
   ```
3. The dynamic route, stats panel, and persistence pipeline will wire themselves up automatically.

### Image-dependent topics

When a worksheet relies on visuals we haven’t rebuilt yet (e.g. Stage 1 pictograms), log it in `docs/image-dependent-topics.md`. The Stage 1 practice hub automatically references that list so learners know why a topic is missing.

## Deploying to Vercel

1. Push the repo to GitHub and import it at `vercel.com/new`.
2. In **Settings → Environment Variables**, add the values listed in `.env.local`.
3. In **Storage → Connect**, create a KV store (or Postgres if you swap implementations).
4. Deploy. Each authenticated user now has synced progress across every game.

Let me know when you’re ready to flesh out the additional games or if you want a Postgres schema for richer analytics. The scaffolding is ready for either direction. 🎯
