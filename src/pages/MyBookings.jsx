import { useEffect, useState } from "react";
import { cancelBooking, fetchMyBookings } from "../api/client";
import { formatDateTime, formatMoney } from "../utils/format";

// Route is wrapped in <RequireAuth>, so a session is guaranteed here — the
// API scopes /bookings/mine to the signed-in account's own bookings.
export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    fetchMyBookings()
      .then((data) => {
        setBookings(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  async function handleCancel(id) {
    setCancellingId(id);
    try {
      const updated = await cancelBooking(id);
      setBookings((prev) => prev.map((b) => (b.id === id ? updated : b)));
    } catch {
      /* leave the row as-is; a retry is just clicking cancel again */
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="container">
      <h1>My bookings</h1>

      {status === "loading" && <p className="empty-state">Loading…</p>}
      {status === "error" && <p className="empty-state">Couldn't load bookings.</p>}
      {status === "ready" && bookings.length === 0 && <p className="empty-state">No bookings yet.</p>}

      {status === "ready" && bookings.length > 0 && (
        <ul className="booking-list">
          {bookings.map((b) => (
            <li key={b.id} className="booking-row">
              <div>
                <strong>{b.id}</strong> — {b.flight.origin.code} → {b.flight.destination.code} (
                {b.flight.flightNumber})
                <br />
                {formatDateTime(b.flight.departureTime)} · {b.fareClass === "economy" ? "Economy" : "Business"} ·{" "}
                {b.passengerCount} passenger{b.passengerCount === 1 ? "" : "s"} · {formatMoney(b.totalPrice)}
                <br />
                Status: <span className={`badge badge-${b.status}`}>{b.status}</span>
              </div>
              {b.status === "confirmed" && (
                <button onClick={() => handleCancel(b.id)} disabled={cancellingId === b.id}>
                  {cancellingId === b.id ? "Cancelling…" : "Cancel"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
