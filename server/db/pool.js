import "dotenv/config";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and fill in your Neon connection string."
  );
}

// rejectUnauthorized:false avoids cert-chain validation issues some Node
// versions hit against Neon's pooler; Neon's connections are already
// encrypted (sslmode=require is baked into their connection strings).
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
