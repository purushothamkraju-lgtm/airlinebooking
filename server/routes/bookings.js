import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

const FARE_CLASSES = ["economy", "business"];
const MAX_PASSENGERS = 9;

// Joins the flight in on every read so the frontend never needs a second
// round-trip just to show the route/times for a booking. b.user_id is
// selected for the ownership check in GET /:id but left out of toJson.
const BOOKING_SELECT = `
  SELECT
    b.id, b.user_id, b.flight_id, b.fare_class, b.passenger_count, b.passenger_names,
    b.customer_name, b.customer_email, b.customer_phone, b.total_price,
    b.status, b.created_at,
    f.flight_number, f.airline,
    f.origin_city, f.origin_code, f.destination_city, f.destination_code,
    f.departure_time, f.arrival_time
  FROM bookings b
  JOIN flights f ON f.id = b.flight_id
`;

function toJson(row) {
  return {
    id: row.id,
    fareClass: row.fare_class,
    passengerCount: row.passenger_count,
    passengerNames: row.passenger_names,
    customer: { name: row.customer_name, email: row.customer_email, phone: row.customer_phone },
    totalPrice: row.total_price,
    status: row.status,
    createdAt: row.created_at,
    flight: {
      id: row.flight_id,
      flightNumber: row.flight_number,
      airline: row.airline,
      origin: { city: row.origin_city, code: row.origin_code },
      destination: { city: row.destination_city, code: row.destination_code },
      departureTime: row.departure_time,
      arrivalTime: row.arrival_time,
    },
  };
}

// The signed-in account's own bookings — this is "my bookings" now that
// there's a real session, replacing the old unauthenticated ?email= lookup.
router.get("/mine", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`${BOOKING_SELECT} WHERE b.user_id = $1 ORDER BY b.created_at DESC`, [
      req.user.id,
    ]);
    res.json(rows.map(toJson));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`${BOOKING_SELECT} WHERE b.id = $1`, [req.params.id]);
    // Same 404 whether the booking doesn't exist or belongs to someone else
    // — don't leak which case it is.
    if (rows.length === 0 || rows[0].user_id !== req.user.id) {
      return res.status(404).json({ error: "Booking not found" });
    }
    res.json(toJson(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  const { flightId, fareClass, passengerCount, passengerNames, customerPhone } = req.body ?? {};

  if (!Number.isInteger(flightId)) {
    return res.status(400).json({ error: "flightId is required" });
  }
  if (!FARE_CLASSES.includes(fareClass)) {
    return res.status(400).json({ error: "fareClass must be 'economy' or 'business'" });
  }
  if (!Number.isInteger(passengerCount) || passengerCount < 1 || passengerCount > MAX_PASSENGERS) {
    return res.status(400).json({ error: `passengerCount must be between 1 and ${MAX_PASSENGERS}` });
  }
  if (
    !Array.isArray(passengerNames) ||
    passengerNames.length !== passengerCount ||
    passengerNames.some((n) => !n?.trim())
  ) {
    return res.status(400).json({ error: "passengerNames must list a non-empty name for each passenger" });
  }
  if (!customerPhone?.trim()) {
    return res.status(400).json({ error: "customerPhone is required" });
  }

  // Both are server-validated literals from FARE_CLASSES above, never raw
  // request input, so interpolating them into the column name is safe.
  const seatsColumn = fareClass === "economy" ? "economy_seats_available" : "business_seats_available";
  const priceColumn = fareClass === "economy" ? "economy_price" : "business_price";
  const id = `PNR-${Date.now()}`;
  const cleanNames = passengerNames.map((n) => n.trim());
  // Contact name/email always come from the authenticated account, never
  // from the request body — otherwise a booking could be made under any
  // email, defeating the point of requiring sign-in.
  const customerName = req.user.name;
  const customerEmail = req.user.email;

  // Multi-step write (check seats, decrement, insert) -> transaction on a
  // dedicated client, not pool.query(). See reference/gotchas.md #6.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const flightResult = await client.query(`SELECT ${priceColumn} AS price FROM flights WHERE id = $1`, [
      flightId,
    ]);
    if (flightResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `Unknown flight id ${flightId}` });
    }
    const pricePerSeat = flightResult.rows[0].price;

    // Atomic, race-free seat decrement: the WHERE clause only matches (and
    // the UPDATE only succeeds) if enough seats remain, so two concurrent
    // bookings can't both succeed and oversell the flight. A pre-check
    // SELECT-then-UPDATE would race; this conditional UPDATE is the actual
    // guard. See reference/gotchas.md #8 (same principle as the time-slot
    // EXCLUDE constraint, applied to inventory instead of time ranges).
    const seatUpdate = await client.query(
      `UPDATE flights SET ${seatsColumn} = ${seatsColumn} - $1
       WHERE id = $2 AND ${seatsColumn} >= $1
       RETURNING id`,
      [passengerCount, flightId]
    );
    if (seatUpdate.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: `Not enough ${fareClass} seats available on this flight` });
    }

    const totalPrice = pricePerSeat * passengerCount;

    await client.query(
      `INSERT INTO bookings
         (id, user_id, flight_id, fare_class, passenger_count, passenger_names, customer_name, customer_email, customer_phone, total_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        req.user.id,
        flightId,
        fareClass,
        passengerCount,
        cleanNames,
        customerName,
        customerEmail,
        customerPhone.trim(),
        totalPrice,
      ]
    );

    const { rows } = await client.query(`${BOOKING_SELECT} WHERE b.id = $1`, [id]);
    await client.query("COMMIT");
    res.status(201).json(toJson(rows[0]));
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

router.post("/:id/cancel", requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `UPDATE bookings SET status = 'cancelled'
       WHERE id = $1 AND user_id = $2 AND status = 'confirmed'
       RETURNING flight_id, fare_class, passenger_count`,
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Booking not found or already cancelled" });
    }

    const { flight_id, fare_class, passenger_count } = rows[0];
    const seatsColumn = fare_class === "economy" ? "economy_seats_available" : "business_seats_available";
    await client.query(`UPDATE flights SET ${seatsColumn} = ${seatsColumn} + $1 WHERE id = $2`, [
      passenger_count,
      flight_id,
    ]);

    const { rows: bookingRows } = await client.query(`${BOOKING_SELECT} WHERE b.id = $1`, [req.params.id]);
    await client.query("COMMIT");
    res.json(toJson(bookingRows[0]));
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

export default router;
