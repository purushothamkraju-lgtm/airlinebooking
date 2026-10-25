import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { searchFlights } from "../api/client";
import { formatDate, formatDuration, formatMoney, formatTime } from "../utils/format";

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [flights, setFlights] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState(null);

  const origin = searchParams.get("origin") ?? "";
  const destination = searchParams.get("destination") ?? "";
  const date = searchParams.get("date") ?? "";

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    searchFlights({ origin, destination, date })
      .then((data) => {
        if (cancelled) return;
        setFlights(data);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [origin, destination, date]);

  function handleSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const next = {};
    if (form.get("origin")?.trim()) next.origin = form.get("origin").trim();
    if (form.get("destination")?.trim()) next.destination = form.get("destination").trim();
    if (form.get("date")?.trim()) next.date = form.get("date").trim();
    setSearchParams(next);
  }

  return (
    <div className="container">
      <form className="search-form" onSubmit={handleSubmit}>
        <label>
          From
          <input name="origin" defaultValue={origin} placeholder="City or airport code" />
        </label>
        <label>
          To
          <input name="destination" defaultValue={destination} placeholder="City or airport code" />
        </label>
        <label>
          Date
          <input name="date" type="date" defaultValue={date} />
        </label>
        <button type="submit">Search flights</button>
      </form>

      {status === "loading" && <p className="empty-state">Loading…</p>}
      {status === "error" && <p className="empty-state">Couldn't load flights: {error}</p>}
      {status === "ready" && flights.length === 0 && (
        <p className="empty-state">No flights match your search.</p>
      )}

      {status === "ready" && flights.length > 0 && (
        <div className="flight-list">
          {flights.map((f) => {
            const lowestPrice = Math.min(f.economy.price, f.business.price);
            const soldOut = f.economy.seatsAvailable === 0 && f.business.seatsAvailable === 0;
            return (
              <Link key={f.id} to={`/flight/${f.id}`} className="flight-card">
                <div className="flight-card-route">
                  <span className="flight-card-code">{f.origin.code}</span>
                  <span className="flight-card-arrow">→</span>
                  <span className="flight-card-code">{f.destination.code}</span>
                </div>
                <div className="flight-card-meta">
                  <span>{f.airline} · {f.flightNumber}</span>
                  <span>{formatDate(f.departureTime)}</span>
                  <span>
                    {formatTime(f.departureTime)} – {formatTime(f.arrivalTime)} ({formatDuration(f.durationMinutes)})
                  </span>
                </div>
                <div className="flight-card-price">
                  {soldOut ? <span className="badge badge-soldout">Sold out</span> : (
                    <>From <strong>{formatMoney(lowestPrice)}</strong></>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
