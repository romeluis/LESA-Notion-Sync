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

/**
 * Syncs an array of executive objects with the `team` SQL table.
 * Uses upsert logic (INSERT ... ON DUPLICATE KEY UPDATE).
 * Also deletes executives from MySQL that are no longer in Notion.
 *
 * @param {Object[]} allExecutives - array of executive objects
 */
export async function syncExecutives(allExecutives) {
  try {
    console.log(`⏳ Syncing ${allExecutives.length} executives to SQL…`);

    for (const e of allExecutives) {
      await query(
        `INSERT INTO team (
          id, displayOrder, fullName, position, country, program,
          bio, food, song, image
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          displayOrder = VALUES(displayOrder),
          fullName     = VALUES(fullName),
          position     = VALUES(position),
          country      = VALUES(country),
          program      = VALUES(program),
          bio          = VALUES(bio),
          food         = VALUES(food),
          song         = VALUES(song),
          image        = VALUES(image)`,
        [
          e.id,
          e.displayOrder,
          e.fullName,
          e.position,
          e.country,
          e.program,
          e.bio,
          e.food,
          e.song,
          e.image
        ]
      );
    }

    // Delete executives from MySQL that are no longer in Notion
    if (allExecutives.length > 0) {
      const notionIds = allExecutives.map(e => e.id);
      const placeholders = notionIds.map(() => '?').join(',');

      const deleteResult = await query(
        `DELETE FROM team WHERE id NOT IN (${placeholders})`,
        notionIds
      );

      if (deleteResult.affectedRows > 0) {
        console.log(`🗑️  Deleted ${deleteResult.affectedRows} executives no longer in Notion`);
      }
    } else {
      const deleteResult = await query(`DELETE FROM team`);
      if (deleteResult.affectedRows > 0) {
        console.log(`🗑️  Deleted all ${deleteResult.affectedRows} executives (Notion database is empty)`);
      }
    }

    console.log(`🎉 Done syncing ${allExecutives.length} executives!`);
  } catch (err) {
    console.error("🔥 Error syncing executives:", err);
    throw err;
  }
}

/**
 * Syncs an array of position objects with the `executive_positions` SQL table.
 * Uses upsert logic (INSERT ... ON DUPLICATE KEY UPDATE).
 * Also deletes positions from MySQL that are no longer in Notion.
 *
 * @param {Object[]} allPositions - array of position objects
 */
export async function syncPositions(allPositions) {
  try {
    console.log(`⏳ Syncing ${allPositions.length} positions to SQL…`);

    for (const p of allPositions) {
      await query(
        `INSERT INTO executive_positions (
          id, name, commitment, division, emoji, description,
          meetingTime, startDay, startMonth, startYear,
          endDay, endMonth, endYear, link
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name        = VALUES(name),
          commitment  = VALUES(commitment),
          division    = VALUES(division),
          emoji       = VALUES(emoji),
          description = VALUES(description),
          meetingTime = VALUES(meetingTime),
          startDay    = VALUES(startDay),
          startMonth  = VALUES(startMonth),
          startYear   = VALUES(startYear),
          endDay      = VALUES(endDay),
          endMonth    = VALUES(endMonth),
          endYear     = VALUES(endYear),
          link        = VALUES(link)`,
        [
          p.id, p.name, p.commitment, p.division, p.emoji, p.description,
          p.meetingTime, p.startDay, p.startMonth, p.startYear,
          p.endDay, p.endMonth, p.endYear, p.link
        ]
      );
    }

    // Delete positions from MySQL that are no longer in Notion
    if (allPositions.length > 0) {
      const notionIds = allPositions.map(p => p.id);
      const placeholders = notionIds.map(() => '?').join(',');

      const deleteResult = await query(
        `DELETE FROM executive_positions WHERE id NOT IN (${placeholders})`,
        notionIds
      );

      if (deleteResult.affectedRows > 0) {
        console.log(`🗑️  Deleted ${deleteResult.affectedRows} positions no longer in Notion`);
      }
    } else {
      const deleteResult = await query(`DELETE FROM executive_positions`);
      if (deleteResult.affectedRows > 0) {
        console.log(`🗑️  Deleted all ${deleteResult.affectedRows} positions (Notion database is empty)`);
      }
    }

    console.log(`🎉 Done syncing ${allPositions.length} positions!`);
  } catch (err) {
    console.error("🔥 Error syncing positions:", err);
    throw err;
  }
}