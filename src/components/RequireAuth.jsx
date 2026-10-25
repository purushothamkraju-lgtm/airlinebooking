import { Navigate, useLocation } from "react-router-dom";
import { authClient } from "../lib/auth-client";

// Gate for routes that need a signed-in account (booking, my bookings).
// Browsing flights stays public — only booking/managing bookings requires
// a session.
export default function RequireAuth({ children }) {
  const { data: session, isPending } = authClient.useSession();
  const location = useLocation();

  if (isPending) return <p className="container empty-state">Loading…</p>;
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}
