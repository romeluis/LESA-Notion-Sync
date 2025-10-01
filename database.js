import mysql from "mysql2/promise";

// Create a pool once at app startup
export const pool = mysql.createPool({
  host:            "server329.web-hosting.com", // your host
  port:            3306,
  user:            process.env.SQL_USER,
  password:        process.env.SQL_PASS,
  database:        "lesaueqw_lesadb",
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
 * Also deletes events from MySQL that are no longer in Notion.
 *
 * @param {Event[]} allEvents - array of Event objects
 */
export async function syncEvents(allEvents) {
  try {
    console.log(`⏳ Syncing ${allEvents.length} events to SQL…`);

    // Step 1: Upsert all events from Notion
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

    // Step 2: Delete events from MySQL that are no longer in Notion
    if (allEvents.length > 0) {
      const notionEventIds = allEvents.map(e => e.id);
      const placeholders = notionEventIds.map(() => '?').join(',');

      const deleteResult = await query(
        `DELETE FROM events WHERE id NOT IN (${placeholders})`,
        notionEventIds
      );

      if (deleteResult.affectedRows > 0) {
        console.log(`🗑️  Deleted ${deleteResult.affectedRows} events that are no longer in Notion`);
      }
    } else {
      // If no events in Notion, delete all events from MySQL
      const deleteResult = await query(`DELETE FROM events`);
      if (deleteResult.affectedRows > 0) {
        console.log(`🗑️  Deleted all ${deleteResult.affectedRows} events (Notion database is empty)`);
      }
    }

    console.log(`🎉 Done syncing ${allEvents.length} events!`);
  } catch (err) {
    console.error("🔥 Error syncing events:", err);
  }
}

/**
 * Gets all members from the MySQL database
 * @returns {Promise<Array>} Array of member objects
 */
export async function getAllMembers() {
  try {
    const members = await query(
      `SELECT 
        id, given_name, surname_name, preferred_name, uoft_email, 
        student_number, student_status, faculty, college, program, 
        year_of_study, country, registration_date, last_update
      FROM members 
      ORDER BY id`
    );
    
    console.log(`📊 Retrieved ${members.length} members from MySQL`);
    return members;
  } catch (err) {
    console.error("🔥 Error fetching members from MySQL:", err);
    throw err;
  }
}

/**
 * Gets all event registrations from the MySQL database
 * @returns {Promise<Array>} Array of registration objects with event_id and student_id
 */
export async function getAllEventRegistrations() {
  try {
    const registrations = await query(
      `SELECT event_id, student_id 
       FROM event_registration 
       ORDER BY student_id, event_id`
    );
    
    console.log(`📋 Retrieved ${registrations.length} event registrations from MySQL`);
    return registrations;
  } catch (err) {
    console.error("🔥 Error fetching event registrations from MySQL:", err);
    throw err;
  }
}

/**
 * Gets event registrations for a specific student
 * @param {number} studentId - The student ID to get registrations for
 * @returns {Promise<Array>} Array of event IDs the student is registered for
 */
export async function getEventRegistrationsForStudent(studentId) {
  try {
    const registrations = await query(
      `SELECT event_id 
       FROM event_registration 
       WHERE student_id = ?
       ORDER BY event_id`,
      [studentId]
    );
    
    return registrations.map(reg => reg.event_id);
  } catch (err) {
    console.error(`🔥 Error fetching event registrations for student ${studentId}:`, err);
    throw err;
  }
}