# PB+ Pickleball Score Board

Organizers create pickleball tournaments and get a 6-character join code. Players join with the code (solo or with one partner). The organizer runs a random draw that builds the fixtures (Round Robin, Knockout, or Group Stage + Knockout). An umpire scores one match with a match code, and everyone sees standings, the bracket and live scores.

**Stack:** Next.js 16 (App Router) · PostgreSQL on Neon · Drizzle ORM · deployed on Vercel · code on GitHub.

## Run it on your laptop

You don't need Neon for this. Without `DATABASE_URL` the app uses **PGlite**, a real Postgres stored in the `.pglite` folder.

```bash
npm install
cp .env.example .env.local        # then put a random value in AUTH_SECRET
npm run db:push                    # create the tables
npm run db:seed                    # demo accounts + sample tournaments (optional)
npm run dev                        # open http://localhost:3000
```

On the login page, **Try demo** logs in as the demo organizer or player (created by `db:seed`).

## Put it online (GitHub → Neon → Vercel)

### 1. Neon (database)
1. Sign up at [neon.tech](https://neon.tech) and create a project (pick the Singapore region, closest to Malaysia).
2. Open **Connect** and copy the connection string (`postgresql://…`).
3. Paste it into `.env.local` as `DATABASE_URL=…`, then create the tables on Neon:
   ```bash
   npm run db:push
   npm run db:seed    # optional: demo data for presentations
   ```

### 2. GitHub (code)
Create an empty repository on GitHub (for example `pbplus-web`), then in this folder:
```bash
git init
git add .
git commit -m "PB+ score board"
git branch -M main
git remote add origin https://github.com/<your-username>/pbplus-web.git
git push -u origin main
```
`.env.local` and the `.pglite` folder are in `.gitignore`, so your secrets and local database stay off GitHub.

### 3. Vercel (website)
1. Sign up at [vercel.com](https://vercel.com) with your GitHub account → **Add New… → Project** → import `pbplus-web`.
2. Under **Environment Variables** add:
   - `DATABASE_URL`: the Neon connection string
   - `AUTH_SECRET`: a new long random value (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`)
   - `DEMO_LOGIN`: `on` while presenting, `off` for real use
3. Click **Deploy**. Every `git push` to `main` updates the live site automatically.

When you change `src/db/schema.ts`, run `npm run db:push` with the Neon `DATABASE_URL` to update the tables.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the app locally |
| `npm run build` | Production build (what Vercel runs) |
| `npm run db:push` | Create or update the tables (Neon if `DATABASE_URL` is set, otherwise local PGlite) |
| `npm run db:seed` | Reset the demo accounts and sample tournaments |
| `npm run db:studio` | Browse the database in your browser |
| `npm run typecheck` / `npm run lint` | Check the code |

## How the code is organised

| Path | Purpose |
|---|---|
| `src/lib/tournament.ts` | Random draw, fixtures, bracket, standings (pure logic, shared by server and browser) |
| `src/lib/scoring.ts` | Pickleball rally scoring, sets, undo |
| `src/db/schema.ts` | Tables: users, tournaments, teams, matches |
| `src/lib/session.ts`, `src/lib/dal.ts` | Login cookies and who-can-see-what checks |
| `src/app/actions/` | Server actions (sign up, join, generate fixtures, score…), each re-checking permissions |
| `src/app/**/page.tsx` | Screens: landing, role, signup, login, dashboard, create, Pair, Match, scoreboard |

## Notes and limits
- Live scores refresh every 4 seconds (Vercel doesn't keep live connections open). For instant updates, add Pusher or Ably later.
- Passwords are hashed with bcrypt and sessions are signed cookies. Umpires need no account: a match code opens only that match.
- Neon's free plan pauses the database after a few idle minutes, so the first page after a break can take a second or two longer.
