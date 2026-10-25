import { Router } from "express";
import { pool } from "../db/pool.js";

const router = Router();

function toJson(row) {
  return {
    id: row.id,
    flightNumber: row.flight_number,
    airline: row.airline,
    origin: { city: row.origin_city, code: row.origin_code },
    destination: { city: row.destination_city, code: row.destination_code },
    departureTime: row.departure_time,
    arrivalTime: row.arrival_time,
    durationMinutes: row.duration_minutes,
    aircraft: row.aircraft,
    image: row.image,
    economy: {
      price: row.economy_price,
      totalSeats: row.economy_total_seats,
      seatsAvailable: row.economy_seats_available,
    },
    business: {
      price: row.business_price,
      totalSeats: row.business_total_seats,
      seatsAvailable: row.business_seats_available,
    },
  };
}

// Supports ?origin=&destination=&date= for flight search on the Home page.
// All optional — with none given, every flight is returned.
router.get("/", async (req, res, next) => {
  try {
    const { origin, destination, date } = req.query;
    const conditions = [];
    const params = [];

    if (origin?.trim()) {
      params.push(`%${origin.trim()}%`);
      conditions.push(`(origin_city ILIKE $${params.length} OR origin_code ILIKE $${params.length})`);
    }
    if (destination?.trim()) {
      params.push(`%${destination.trim()}%`);
      conditions.push(`(destination_city ILIKE $${params.length} OR destination_code ILIKE $${params.length})`);
    }
    if (date?.trim()) {
      params.push(date.trim());
      conditions.push(`departure_time::date = $${params.length}::date`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(`SELECT * FROM flights ${where} ORDER BY departure_time`, params);
    res.json(rows.map(toJson));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM flights WHERE id = $1", [Number(req.params.id)]);
    if (rows.length === 0) return res.status(404).json({ error: "Flight not found" });
    res.json(toJson(rows[0]));
  } catch (err) {
    next(err);
  }
});

export default router;
