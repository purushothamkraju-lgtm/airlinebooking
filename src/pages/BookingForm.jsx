import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { createBooking, fetchFlight } from "../api/client";
import { authClient } from "../lib/auth-client";
import { formatDateTime, formatMoney } from "../utils/format";

const MAX_PASSENGERS = 9;

export default function BookingForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();

  const requestedClass = searchParams.get("class");
  const fareClass = requestedClass === "business" ? "business" : "economy";

  const [flight, setFlight] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error

  const [passengerCount, setPassengerCount] = useState(1);
  const [passengerNames, setPassengerNames] = useState([""]);
  const [customerPhone, setCustomerPhone] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchFlight(id)
      .then((data) => {
        if (cancelled) return;
        setFlight(data);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (status === "loading") return <p className="container empty-state">Loading…</p>;
  if (status === "error" || !flight) return <p className="container empty-state">Flight not found.</p>;

  const fare = flight[fareClass];
  const maxPassengers = Math.min(MAX_PASSENGERS, fare.seatsAvailable);

  function updatePassengerCount(nextCount) {
    const clamped = Math.max(1, Math.min(nextCount, Math.max(maxPassengers, 1)));
    setPassengerCount(clamped);
    setPassengerNames((prev) => {
      const next = prev.slice(0, clamped);
      while (next.length < clamped) next.push("");
      return next;
    });
  }

  function updatePassengerName(index, value) {
    setPassengerNames((prev) => prev.map((n, i) => (i === index ? value : n)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const booking = await createBooking({
        flightId: flight.id,
        fareClass,
        passengerCount,
        passengerNames,
        customerPhone,
      });
      navigate(`/booking-confirmation/${booking.id}`);
    } catch (err) {
      // A 409 from the seat-availability guard surfaces here as a normal
      // error message — show it inline, don't treat it as a crash.
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (fare.seatsAvailable === 0) {
    return (
      <div className="container">
        <h1>Book {flight.flightNumber}</h1>
        <p className="empty-state">
          Sorry, {fareClass} is sold out on this flight. Go back and try the other fare class.
        </p>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>
        Book {flight.origin.code} → {flight.destination.code}
      </h1>
      <p className="flight-summary">
        {flight.airline} {flight.flightNumber} · {formatDateTime(flight.departureTime)} ·{" "}
        {fareClass === "economy" ? "Economy" : "Business"} · {formatMoney(fare.price)} / seat
      </p>
      <p className="flight-summary">Booking as {session?.user?.name} ({session?.user?.email})</p>

      <form onSubmit={handleSubmit}>
        <label>
          Passengers
          <input
            type="number"
            min={1}
            max={maxPassengers}
            value={passengerCount}
            onChange={(e) => updatePassengerCount(Number(e.target.value) || 1)}
          />
        </label>

        <div className="passenger-fields">
          {passengerNames.map((name, i) => (
            <label key={i}>
              Passenger {i + 1} full name
              <input required value={name} onChange={(e) => updatePassengerName(i, e.target.value)} />
            </label>
          ))}
        </div>

        <label>
          Contact phone
          <input
            type="tel"
            required
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
          />
        </label>

        <p className="booking-total">Total: {formatMoney(fare.price * passengerCount)}</p>

        {submitError && (
          <p role="alert" className="form-error">
            {submitError}
          </p>
        )}
        <button type="submit" disabled={submitting}>
          {submitting ? "Booking…" : "Confirm booking"}
        </button>
      </form>
    </div>
  );
}
