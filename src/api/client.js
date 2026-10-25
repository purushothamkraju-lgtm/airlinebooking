const BASE_URL = "/api";

// Always relative — works against the Vite dev proxy and the production
// same-origin Express server with zero branching. See reference/gotchas.md #11.
async function handleResponse(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export function searchFlights({ origin, destination, date } = {}) {
  const params = new URLSearchParams();
  if (origin) params.set("origin", origin);
  if (destination) params.set("destination", destination);
  if (date) params.set("date", date);
  const qs = params.toString();
  return fetch(`${BASE_URL}/flights${qs ? `?${qs}` : ""}`).then(handleResponse);
}

export function fetchFlight(id) {
  return fetch(`${BASE_URL}/flights/${id}`).then(handleResponse);
}

export function createBooking(payload) {
  return fetch(`${BASE_URL}/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(handleResponse);
}

export function fetchBooking(id) {
  return fetch(`${BASE_URL}/bookings/${id}`).then(handleResponse);
}

export function fetchMyBookings() {
  return fetch(`${BASE_URL}/bookings/mine`).then(handleResponse);
}

export function cancelBooking(id) {
  return fetch(`${BASE_URL}/bookings/${id}/cancel`, { method: "POST" }).then(handleResponse);
}
