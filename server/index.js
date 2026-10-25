import "dotenv/config";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import flightsRouter from "./routes/flights.js";
import bookingsRouter from "./routes/bookings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, "..", "dist");
const distExists = fs.existsSync(distPath);

const app = express();
const PORT = process.env.PORT || 3001;

// Better Auth's handler must see the raw request body, so it's mounted
// before express.json() — a body-parsing middleware ahead of it would
// consume the stream and break sign-in/sign-up requests. Express 5's router
// needs a named wildcard (*splat), not the bare * that worked in Express 4.
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

app.use("/api/flights", flightsRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

// In production the built frontend (vite build -> dist/) is served by this
// same process, so the whole app is one deployable unit on one port. In dev,
// the Vite dev server handles the frontend on its own port and proxies /api
// here instead (see vite.config.js) — dist/ won't exist yet, so this block
// is skipped and this process only serves the API.
if (distExists) {
  app.use(express.static(distPath));
  app.use((req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  if (!distExists) {
    console.log("No dist/ build found — serving API only (run `npm run build` for the full app).");
  }
});
