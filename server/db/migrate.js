import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  await pool.query(schema);
  console.log("Schema is up to date.");
  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exitCode = 1;
});
