# SkyBooker — Airline Booking Portal

A full-stack app: React + Vite frontend, Node/Express backend, Neon
(serverless Postgres) database — deployed as a single process.

Browse flights, pick economy or business fare class, and book seats for one
or more passengers. Airlines and routes are fictional sample data.

## Architecture

- `src/` — React frontend (Vite)
- `server/` — Express backend: a JSON REST API (`/api/flights`, `/api/bookings`)
  plus, in production, the built frontend itself
- `server/db/` — Postgres access: `pool.js` (connection), `schema.sql` /
  `migrate.js` (create tables), `seedData.js` / `seed.js` (populate the
  `flights` table with sample data)

There's no separate frontend/backend/database deployment to juggle:
`npm run build` compiles the React app into `dist/`, and the one Express
process (`npm start`) serves both that static build and the API — backed by
one Neon Postgres database — on a single port.

Each flight sells two fare classes (economy / business), each with its own
price and seat pool. Booking N seats decrements that pool with an atomic,
conditional `UPDATE ... WHERE seats_available >= N` (see
`server/routes/bookings.js`) — not a check-then-insert in application code —
so concurrent bookings can never oversell a flight. Cancelling a booking
restores its seats to the pool.

## Authentication

User accounts (sign up / sign in / sign out) are handled by
[Better Auth](https://www.better-auth.com), mounted at `/api/auth/*` in
`server/index.js` and configured in `server/auth.js` — it uses the same
Postgres pool as the rest of the app (`database: pool` in `server/auth.js`),
so it manages its own `user`/`session`/`account`/`verification` tables
alongside `flights`/`bookings`. Browsing flights is public; booking a flight
and viewing "My bookings" require a session (`src/components/RequireAuth.jsx`
guards those routes, and `server/middleware/requireAuth.js` guards the
matching API routes). A booking's contact name/email always come from the
signed-in account, never from the request body, so bookings can't be made
under an email you don't control.

## Database setup (one-time, per environment)

1. Create a free project at [console.neon.tech](https://console.neon.tech) if
   you don't have one.
2. In the project, go to **Connect** and copy the connection string (the
   pooled one, with `-pooler` in the hostname, is recommended).
3. `cp .env.example .env` and fill in `DATABASE_URL`, plus `BETTER_AUTH_SECRET`
   (generate one with `openssl rand -base64 32`) and `BETTER_AUTH_URL` (your
   app's own base URL, e.g. `http://localhost:3001`). `.env` is gitignored —
   it's never committed.
4. Create the tables and load sample data:
   ```bash
   npm run db:setup
   ```
   This runs `db:migrate` (flights/bookings schema), `db:seed` (sample
   flights), and `auth:migrate` (Better Auth's own tables) in sequence — all
   three are safe to re-run any time, individually or together.

## Develop

```bash
npm install
npm run db:setup   # first time only
npm run dev
```

This runs the Vite dev server (with hot reload, at http://localhost:5173)
alongside the Express API (http://localhost:3001) with one command; Vite
proxies `/api/*` requests to Express so there's no CORS setup needed.

## Build & run as one artifact

```bash
npm install
npm run db:setup   # first time only, or after a schema change
npm run build
npm start
```

`npm start` serves everything — UI and API, backed by Neon — from
`http://localhost:3001` (override the port with the `PORT` env var, which
most hosting platforms set automatically). This is the whole deployable
unit; just make sure `DATABASE_URL` is set in the deploy environment too.

## Not yet included

- Payments — this is a mock booking flow; no money moves.
- Password reset / email verification / social login — Better Auth supports
  all of these, but only email+password sign-up/sign-in is enabled here.
- Seat maps / seat selection — booking reserves N seats of a fare class, not
  specific seat numbers.
- Multi-leg / connecting itineraries — every booking is for one flight.
