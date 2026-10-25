import { createAuthClient } from "better-auth/react";

// No baseURL — the auth routes are same-origin (proxied by Vite in dev,
// served by the same Express process in production), same as src/api/client.js.
export const authClient = createAuthClient();
