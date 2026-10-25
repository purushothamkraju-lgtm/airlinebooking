import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth.js";

// Attaches req.user from the session cookie, or rejects with 401. Routes
// that need to scope data to "the current customer" (creating a booking,
// listing/cancelling their own bookings) use this instead of a client-
// supplied email, which can't be trusted.
export async function requireAuth(req, res, next) {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) {
      return res.status(401).json({ error: "You must be signed in" });
    }
    req.user = session.user;
    next();
  } catch (err) {
    next(err);
  }
}
