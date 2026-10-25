-- Airline booking portal schema.
--
-- Flights sell two fare classes (economy / business), each with its own
-- price and seat pool. A booking takes N seats of one fare class on one
-- flight. The risk isn't time-overlap (a flight's schedule is fixed) — it's
-- overselling a fare class beyond its seat pool under concurrent bookings.
-- That's prevented with an atomic conditional UPDATE in the booking route
-- (server/routes/bookings.js), backed here by CHECK constraints as a
-- defense-in-depth backstop against seats_available ever going negative or
-- above the total.

CREATE TABLE IF NOT EXISTS flights (
  id INTEGER PRIMARY KEY,
  flight_number TEXT NOT NULL,
  airline TEXT NOT NULL,
  origin_city TEXT NOT NULL,
  origin_code TEXT NOT NULL,
  destination_city TEXT NOT NULL,
  destination_code TEXT NOT NULL,
  departure_time TIMESTAMPTZ NOT NULL,
  arrival_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  aircraft TEXT NOT NULL,
  image TEXT NOT NULL,
  economy_price INTEGER NOT NULL,            -- cents
  economy_total_seats INTEGER NOT NULL,
  economy_seats_available INTEGER NOT NULL,
  business_price INTEGER NOT NULL,           -- cents
  business_total_seats INTEGER NOT NULL,
  business_seats_available INTEGER NOT NULL,
  CONSTRAINT flight_time_order CHECK (arrival_time > departure_time),
  CONSTRAINT economy_seats_in_range CHECK (
    economy_seats_available >= 0 AND economy_seats_available <= economy_total_seats
  ),
  CONSTRAINT business_seats_in_range CHECK (
    business_seats_available >= 0 AND business_seats_available <= business_total_seats
  )
);

CREATE INDEX IF NOT EXISTS flights_route_idx ON flights (origin_code, destination_code);
CREATE INDEX IF NOT EXISTS flights_departure_idx ON flights (departure_time);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  -- The authenticated account this booking belongs to (session.user.id from
  -- Better Auth — see server/auth.js). Deliberately not a foreign key into
  -- Better Auth's own "user" table: that table is managed by Better Auth's
  -- migrations, and coupling to its internal schema is unnecessary — this
  -- app only ever reads it as an opaque id.
  user_id TEXT NOT NULL,
  flight_id INTEGER NOT NULL REFERENCES flights (id),
  fare_class TEXT NOT NULL CHECK (fare_class IN ('economy', 'business')),
  passenger_count INTEGER NOT NULL CHECK (passenger_count >= 1 AND passenger_count <= 9),
  passenger_names TEXT[] NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  total_price INTEGER NOT NULL,              -- cents
  status TEXT NOT NULL DEFAULT 'confirmed',  -- confirmed | cancelled
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bookings_flight_id_idx ON bookings (flight_id);
CREATE INDEX IF NOT EXISTS bookings_user_id_idx ON bookings (user_id);
