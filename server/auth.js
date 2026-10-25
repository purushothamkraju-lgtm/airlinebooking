import "dotenv/config";
import { betterAuth } from "better-auth";
import { pool } from "./db/pool.js";

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error(
    "BETTER_AUTH_SECRET is not set. Copy .env.example to .env and fill in a random secret (e.g. `openssl rand -base64 32`)."
  );
}

// Passing the existing pg.Pool directly (rather than a separate ORM) lets
// Better Auth manage its own tables (user, session, account, verification)
// through the same connection pool the rest of the app already uses.
export const auth = betterAuth({
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
  },
});
