import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchFlight } from "../api/client";
import { formatDateTime, formatDuration, formatMoney } from "../utils/format";

export default function FlightDetail() {
  const { id } = useParams();
  const [flight, setFlight] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
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

  return (
    <div className="container">
      <h1>
        {flight.origin.city} ({flight.origin.code}) → {flight.destination.city} ({flight.destination.code})
      </h1>
      <p className="flight-summary">
        {flight.airline} · Flight {flight.flightNumber} · {flight.aircraft}
      </p>
      <p className="flight-summary">
        Departs {formatDateTime(flight.departureTime)} · Arrives {formatDateTime(flight.arrivalTime)} ·{" "}
        {formatDuration(flight.durationMinutes)}
      </p>

      <div className="fare-grid">
        <FareCard label="Economy" fare={flight.economy} to={`/book/${flight.id}?class=economy`} />
        <FareCard label="Business" fare={flight.business} to={`/book/${flight.id}?class=business`} />
      </div>
    </div>
  );
}

function FareCard({ label, fare, to }) {
  const soldOut = fare.seatsAvailable === 0;
  return (
    <div className="fare-card">
      <h3>{label}</h3>
      <p className="fare-price">{formatMoney(fare.price)}</p>
      <p className="fare-seats">
        {soldOut ? "Sold out" : `${fare.seatsAvailable} seat${fare.seatsAvailable === 1 ? "" : "s"} left`}
      </p>
      {soldOut ? (
        <button className="button" disabled>
          Sold out
        </button>
      ) : (
        <Link to={to} className="button">
          Book {label}
        </Link>
      )}
    </div>
  );
}
