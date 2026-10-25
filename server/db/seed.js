import { pool } from "./pool.js";
import { flights } from "./seedData.js";

// seats_available is live inventory that bookings decrement — only set it on
// first insert (via the $14/$16 reuse below), never overwrite it on
// re-seed, or re-running this after real bookings exist would silently wipe
// out those seat reservations.
async function seed() {
  for (const f of flights) {
    await pool.query(
      `INSERT INTO flights (
         id, flight_number, airline, origin_city, origin_code,
         destination_city, destination_code, departure_time, arrival_time,
         duration_minutes, aircraft, image,
         economy_price, economy_total_seats, economy_seats_available,
         business_price, business_total_seats, business_seats_available
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14, $15, $16, $16)
       ON CONFLICT (id) DO UPDATE SET
         flight_number = EXCLUDED.flight_number,
         airline = EXCLUDED.airline,
         origin_city = EXCLUDED.origin_city,
         origin_code = EXCLUDED.origin_code,
         destination_city = EXCLUDED.destination_city,
         destination_code = EXCLUDED.destination_code,
         departure_time = EXCLUDED.departure_time,
         arrival_time = EXCLUDED.arrival_time,
         duration_minutes = EXCLUDED.duration_minutes,
         aircraft = EXCLUDED.aircraft,
         image = EXCLUDED.image,
         economy_price = EXCLUDED.economy_price,
         economy_total_seats = EXCLUDED.economy_total_seats,
         business_price = EXCLUDED.business_price,
         business_total_seats = EXCLUDED.business_total_seats`,
      [
        f.id,
        f.flightNumber,
        f.airline,
        f.originCity,
        f.originCode,
        f.destinationCity,
        f.destinationCode,
        f.departureTime,
        f.arrivalTime,
        f.durationMinutes,
        f.aircraft,
        f.image,
        f.economyPrice,
        f.economyTotalSeats,
        f.businessPrice,
        f.businessTotalSeats,
      ]
    );
  }
  console.log(`Seeded ${flights.length} flights.`);
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exitCode = 1;
});
