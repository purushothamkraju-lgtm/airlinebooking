# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run db:setup   # one-time (or after a schema change): migrate + seed + auth tables
npm run dev         # Vite (hot reload, :5173) + Express API (:3001) together
npm run build       # vite build -> dist/
npm start           # production: one Express process serves dist/ + the API on :3001
npm run lint        # oxlint
```

There is no test suite/runner configured in this repo.

`db:setup` runs three idempotent, independently re-runnable steps in order —
use these individually when only one is needed:
```bash
npm run db:migrate    # applies server/db/schema.sql (CREATE TABLE/INDEX IF NOT EXISTS)
npm run db:seed       # upserts server/db/seedData.js into flights (ON CONFLICT DO UPDATE)
npm run auth:migrate  # creates Better Auth's own user/session/account/verification tables
```

Requires `.env` (copy from `.env.example`): `DATABASE_URL` (Neon Postgres,
pooled connection string), `BETTER_AUTH_SECRET` (`openssl rand -base64 32`),
`BETTER_AUTH_URL` (the app's own base URL, e.g. `http://localhost:3001`).

## Architecture

Single-process monolith: one Express app serves the JSON API **and**, in
production, the built React frontend, on one port — one Neon Postgres
database, no separate deploy pipelines. In dev, Vite's dev server (`:5173`)
proxies `/api/*` to Express (`:3001`, started via `node --watch`); in
production `npm start` serves `dist/` directly from the same process that
serves the API (`server/index.js` checks whether `dist/` exists to decide
which mode it's in). The frontend's `src/api/client.js` always calls
relative paths (`/api/...`) so the same code works in both modes.

Route registration order in `server/index.js` matters:
1. `/api/auth/*splat` (Better Auth's handler) — **before** `express.json()`,
   since it needs the raw request body itself. The `*splat` wildcard (not
   bare `*`) is required because this app is on Express 5.
2. `express.json()`
3. `/api/flights`, `/api/bookings` routers
4. `/api` 404 handler, scoped to the `/api` prefix only
5. (production only) `express.static(dist)` + SPA fallback to `index.html`

If the `/api` 404 handler were global instead of prefix-scoped, it would
swallow client-side routes (e.g. `/flight/3`) on a hard refresh in
production, since Express would never reach the static/SPA-fallback block.

### Data model and seat inventory

- `flights`: each row sells two independent fare classes (economy /
  business), each with its own `..._price` (integer cents), `..._total_seats`,
  and `..._seats_available`. There's no time-slot/double-booking problem
  here (a flight's schedule is fixed) — the risk is **overselling a fare
  class's seat pool** under concurrent bookings.
- That's prevented in `server/routes/bookings.js` with an atomic conditional
  `UPDATE flights SET x_seats_available = x_seats_available - $1 WHERE id =
  $2 AND x_seats_available >= $1`, inside a transaction alongside the
  `bookings` insert — not a check-then-insert, which would race. Cancelling
  a booking reverses this (adds the seats back). `seatsColumn`/`priceColumn`
  are chosen via a ternary over a hardcoded two-value whitelist
  (`FARE_CLASSES`) before being interpolated into SQL — never from raw
  request input.
- `bookings.user_id` ties a booking to a Better Auth account. It's a plain
  `TEXT` column with **no foreign key** into Better Auth's own `user`
  table — deliberately decoupled, since that table is managed entirely by
  Better Auth's own migrations (`npm run auth:migrate`).
- `BOOKING_SELECT` in `bookings.js` joins `flights` into every booking read
  so the frontend gets route/schedule info without a second round-trip.

### Authentication (Better Auth)

`server/auth.js` configures Better Auth with the app's existing `pg.Pool`
(`server/db/pool.js`) as its `database` — no separate ORM/connection. It
manages its own tables and is otherwise independent of `db:migrate`/`db:seed`.

- `server/middleware/requireAuth.js` — reads the session from cookies via
  `auth.api.getSession()`, attaches `req.user`, or 401s. Applied to booking
  creation, `GET /api/bookings/mine`, `GET /api/bookings/:id`, and cancel.
- A booking's `customer_name`/`customer_email` always come from
  `req.user.name`/`req.user.email` (the session), **never** from the request
  body — otherwise a signed-in user could submit a booking under an email
  they don't control.
- `GET /api/bookings/:id` and the cancel route check `row.user_id ===
  req.user.id` and return a plain 404 (not 403) on mismatch, so a guessed
  booking ID can't be used to probe whether it belongs to someone else.
- Frontend: `src/lib/auth-client.js` (`createAuthClient`, same-origin, no
  `baseURL`), `src/components/RequireAuth.jsx` gates `/book/:id`,
  `/booking-confirmation/:id`, and `/my-bookings` behind
  `authClient.useSession()` — browsing flights stays public.
- `signIn.email`/`signUp.email`/`signOut` return `{ data, error }`, not a
  thrown error — don't wrap them in try/catch.
- Testing the auth API directly with curl: session-mutating endpoints like
  `sign-out` 403 with "Missing or null Origin" unless you pass `-H "Origin:
  <BETTER_AUTH_URL>"`. Real browser `fetch()` sends this automatically on
  same-origin POSTs, so the app itself is unaffected.

### Frontend

No global "all flights" context — `Home.jsx` fetches its own search results
(via `searchFlights({ origin, destination, date })`, reflected in the URL's
query string through `useSearchParams`) and `FlightDetail.jsx` fetches a
single flight by id directly; a shared list context would go stale against
a server-side-filtered search anyway. `src/utils/format.js` centralizes
money/date/duration formatting used across multiple pages.

### Neon/Postgres specifics

- `server/db/pool.js` sets `ssl: { rejectUnauthorized: false }` (not `ssl:
  true`/omitted) — required against Neon's pooler on some Node versions,
  and throws immediately at import time if `DATABASE_URL` is unset.
- Money is stored as integer cents throughout, never float/NUMERIC.
