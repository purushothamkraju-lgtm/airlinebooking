import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchBooking } from "../api/client";
import { formatDateTime, formatMoney } from "../utils/format";

export default function BookingConfirmation() {
  const { bookingId } = useParams();
  const [booking, setBooking] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    fetchBooking(bookingId)
      .then((data) => {
        setBooking(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [bookingId]);

  if (status === "loading") return <p className="container empty-state">Loading…</p>;
  if (status === "error" || !booking) return <p className="container empty-state">Booking not found.</p>;

  const { flight } = booking;

  return (
    <div className="container">
      <h1>Booking confirmed</h1>
      <p className="pnr">PNR: {booking.id}</p>

      <p className="flight-summary">
        {flight.origin.city} ({flight.origin.code}) → {flight.destination.city} ({flight.destination.code})
      </p>
      <p className="flight-summary">
        {flight.airline} {flight.flightNumber} · Departs {formatDateTime(flight.departureTime)}
      </p>
      <p className="flight-summary">
        {booking.fareClass === "economy" ? "Economy" : "Business"} · {booking.passengerCount} passenger
        {booking.passengerCount === 1 ? "" : "s"}
      </p>

      <ul>
        {booking.passengerNames.map((name, i) => (
          <li key={i}>{name}</li>
        ))}
      </ul>

      <p className="booking-total">Total paid: {formatMoney(booking.totalPrice)}</p>

      <Link to="/my-bookings">View all my bookings</Link>
    </div>
  );
}
