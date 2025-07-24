import mysql from "mysql2/promise";

// Create a pool once at app startup
export const pool = mysql.createPool({
  host:            "server342.web-hosting.com", // your host
  port:            3306,
  user:            process.env.SQL_USER,
  password:        process.env.SQL_PASS,
  database:        "upgrnthc_db",
  charset:         "utf8mb4",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit:      0,

  // 👇 Tune your timeouts
  connectTimeout:  20000, // 20s to establish TCP+Auth handshake
  // handshakeTimeout is not directly exposed, but mysql2 uses connectTimeout

  // Optional keep-alive settings
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

// Helper: run parametrized queries easily
export async function query(sql, params) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * Syncs an array of Event instances with your SQL table.
 * Uses upsert logic (INSERT ... ON DUPLICATE KEY UPDATE).
 *
 * @param {Event[]} allEvents - array of Event objects
 */
export async function syncEvents(allEvents) {
  try {
    console.log(`⏳ Syncing ${allEvents.length} events to SQL…`);

    for (const e of allEvents) {
      await query(
        `INSERT INTO events (
          id, name, emoji, description, location, type, organization,
          day, month, year,
          startHour, startMinute, endHour, endMinute,
          price, link, calendarLink, isCpsifFunded
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name           = VALUES(name),
          emoji          = VALUES(emoji),
          description    = VALUES(description),
          location       = VALUES(location),
          type           = VALUES(type),
          organization   = VALUES(organization),
          day            = VALUES(day),
          month          = VALUES(month),
          year           = VALUES(year),
          startHour      = VALUES(startHour),
          startMinute    = VALUES(startMinute),
          endHour        = VALUES(endHour),
          endMinute      = VALUES(endMinute),
          price          = VALUES(price),
          link           = VALUES(link),
          calendarLink   = VALUES(calendarLink),
          isCpsifFunded  = VALUES(isCpsifFunded)`,
        [
          e.id,
          e.name,
          e.emoji,
          e.description,
          e.location,
          e.type,
          e.organization,
          e.day,
          e.month,
          e.year,
          e.startHour,
          e.startMinute,
          e.endHour,
          e.endMinute,
          e.price,
          e.link,
          e.calendarLink,
          e.isCpsifFunded
        ]
      );
    }

    console.log(`🎉 Done syncing ${allEvents.length} events!`);
  } catch (err) {
    console.error("🔥 Error syncing events:", err);
  }
}