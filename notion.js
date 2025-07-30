// notion.js
import { Client } from "@notionhq/client";
import { Event } from "./event.js";
import fetch from "node-fetch";  

// 🔑 Make sure NOTION_TOKEN and NOTION_EVENTS_DB_ID are set as env vars on your server
const notion = new Client({ auth: process.env.NOTION_TOKEN, fetch });
const eventsDatabaseId = process.env.NOTION_EVENTS_DB_ID;
const membersDatabaseId = process.env.NOTION_MEMBERS_DB_ID;

/**
 * Queries your Notion database and logs each page object.
 */
export async function printNotionContents() {
  try {
    let allPages = [];
    let cursor = undefined;

    do {
      const response = await notion.databases.query({
        database_id: eventsDatabaseId,
        start_cursor: cursor,
        page_size: 30
      });
      allPages = allPages.concat(response.results);
      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);

    console.log(`✨ Retrieved ${allPages.length} pages from Notion:`);
    allPages.forEach((page, i) => {
      console.log(`\n📄 Page #${i + 1}:`);
      console.dir(page, { depth: null });
    });
  } catch (error) {
    console.error("🔥 Error fetching from Notion:", error);
  }
}

/**
 * Queries your Notion database and creates Event objects for each entry
 */
export async function synthesizeEvents() {
  try {
    let allPages = [];
    let allEvents = [];
    let cursor = undefined;

    do {
      const response = await notion.databases.query({
        database_id: eventsDatabaseId,
        start_cursor: cursor,
        page_size: 100
      });
      allPages = allPages.concat(response.results);
      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);

    console.log(`✨ Retrieved ${allPages.length} pages from Notion:`);
    allPages.forEach(page => {
  // 1️⃣ Skip cancelled:
  const statusName = page.properties['Event Status'].status?.name;
  if (statusName === 'Event Cancelled') return;

  // 2️⃣ ID (unique_id → number)
  const id = page.properties.id.unique_id.number;

  // 3️⃣ Name (title → plain_text)
  const name = page.properties['Event Name']
    .title[0]?.plain_text ?? 'NO NAME';

  // 4️⃣ Emoji (icon → emoji)
  const emoji = page.icon?.emoji ?? '';

  // 5️⃣ Description (rich_text → plain_text)
  const description = page.properties['Event Description']
    .rich_text[0]?.plain_text ?? 'NONE';

  // 6️⃣ Location (rich_text → plain_text)
  const location = page.properties.Location
    .rich_text[0]?.plain_text ?? 'TBA';

  // 7️⃣ Organizer (select → name)
  const type = page.properties.Organizer
    .select?.name ?? '';

  // 8️⃣ Organization (rich_text → plain_text)
  const organization = page.properties.Organization
    .rich_text[0]?.plain_text ?? null;

  // 9️⃣ Cost (number)
  const price = page.properties.Cost.number ?? 0;

  // 🔟 Requires Registration & Registration Form (checkbox + url)
  const requiresReg = page.properties['Requires Registration'].select?.name ?? 'No';
  const regUrl = page.properties['Registration Form'].url;
  const link = requiresReg === 'No' ? '0' : (requiresReg === 'LESA Registration' ? '2' : (regUrl ?? '1'));

  // 1️⃣1️⃣ Calendar Invite Link (url)
  const calendarLink = page.properties['Calendar Invite Link'].url ?? 'NONE';

  // 1️⃣2️⃣ CPSIF Funded (checkbox)
  const isCpsifFunded = page.properties['Is CPSIF Funded'].checkbox;

  // 1️⃣3️⃣ Event Date & Time parsing
  const dateProp = page.properties['Event Date & Time'].date;
  let day, month, year, startHour, startMinute, endHour, endMinute;
  if (dateProp) {
    const start = new Date(dateProp.start);
    const end   = dateProp.end ? new Date(dateProp.end) : null;
    const sameDay = end && start.toDateString() === end.toDateString();

    if (!end || !sameDay) {
      day = 0;
      month = start.getMonth() + 1;
      year = start.getFullYear();
      startHour = startMinute = endHour = endMinute = 0;
    } else {
      day = start.getDate();
      month = start.getMonth() + 1;
      year = start.getFullYear();
      startHour = start.getHours();
      startMinute = start.getMinutes();
      endHour = end.getHours();
      endMinute = end.getMinutes();
    }
  } else {
    day = month = year = startHour = startMinute = endHour = endMinute = 0;
  }

  // 1️⃣4️⃣ Build your Event
  const event = new Event({
    id,
    name,
    emoji,
    description,
    location,
    type,
    organization,
    day,
    month,
    year,
    startHour,
    startMinute,
    endHour,
    endMinute,
    price,
    link,
    calendarLink,
    isCpsifFunded,
  });

  allEvents.push(event);
});

    return allEvents;
  } catch (error) {
    console.error("🔥 Error fetching from Notion:", error);
  }
}

/**
 * Queries LESA database and syncs members
 */
export async function syncMembers() {
  try {
    // Validate required environment variables
    if (!membersDatabaseId) {
      throw new Error("NOTION_MEMBERS_DB_ID environment variable is not set");
    }
    
    console.log("🚀 Starting members sync from MySQL to Notion...");
    
    // 1. Get all members from MySQL database
    const { query } = await import("./database.js");
    const mysqlMembers = await query(
      `SELECT 
        id, given_name, surname_name, preferred_name, uoft_email, 
        student_number, student_status, faculty, college, program, 
        year_of_study, country, registration_date, last_update
      FROM members 
      ORDER BY id`
    );
    
    console.log(`📊 Found ${mysqlMembers.length} members in MySQL database`);
    
    // 2. Get all members from Notion database
    let notionMembers = [];
    let cursor = undefined;
    
    do {
      const response = await notion.databases.query({
        database_id: membersDatabaseId,
        start_cursor: cursor,
        page_size: 100
      });
      notionMembers = notionMembers.concat(response.results);
      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);
    
    console.log(`📄 Found ${notionMembers.length} members in Notion database`);
    
    // 3. Create a map of existing Notion members by their Student ID for quick lookup
    const notionMemberMap = new Map();
    notionMembers.forEach(page => {
      const studentId = page.properties["Student ID"]?.number;
      if (studentId) {
        notionMemberMap.set(studentId, page);
      }
    });
    
    // 4. Process each MySQL member
    let insertCount = 0;
    let updateCount = 0;
    let skippedCount = 0;
    
    for (const member of mysqlMembers) {
      try {
        const existingNotionPage = notionMemberMap.get(member.student_number);
        
        if (!existingNotionPage) {
          // New member - insert into Notion
          await insertMemberToNotion(member);
          insertCount++;
        } else {
          // Existing member - check if update is needed
          const needsUpdate = checkIfMemberNeedsUpdate(member, existingNotionPage);
          if (needsUpdate) {
            await updateMemberInNotion(member, existingNotionPage);
            updateCount++;
          } else {
            skippedCount++;
          }
        }
      } catch (error) {
        console.error(`❌ Error processing member ${member.id} (Student ID: ${member.student_number}): ${error.message}`);
        // Continue with other members even if one fails
        skippedCount++;
      }
    }
    
    console.log(`✅ Members sync complete!`);
    console.log(`   📝 Inserted: ${insertCount} new members`);
    console.log(`   🔄 Updated: ${updateCount} existing members`);
    console.log(`   ⏭️ Skipped: ${skippedCount} unchanged members`);
    
  } catch (error) {
    console.error("🔥 Error syncing members:", error);
    throw error;
  }
}

/**
 * Helper function to insert a new member into Notion
 */
async function insertMemberToNotion(member) {
  try {
    // console.log(`🔍 Processing member ${member.id} (Student ID: ${member.student_number}): ${member.given_name} ${member.surname_name}`);
    // console.log(`📅 Registration date: ${member.registration_date}`);
    // console.log(`📅 Last update: ${member.last_update}`);
    
    const properties = buildNotionMemberProperties(member);
    
    await notion.pages.create({
      parent: {
        database_id: membersDatabaseId,
      },
      properties
    });
    
    console.log(`✅ Inserted member: ${member.given_name} ${member.surname_name} (Student ID: ${member.student_number}, MySQL ID: ${member.id})`);
  } catch (error) {
    console.error(`❌ Failed to insert member ${member.id} (Student ID: ${member.student_number}):`, error.message);
    throw error;
  }
}

/**
 * Helper function to update an existing member in Notion
 */
async function updateMemberInNotion(member, existingPage) {
  try {
    const properties = buildNotionMemberProperties(member);
    
    // Keep existing Events Registered as mentioned in requirements
    delete properties['Events Registered'];
    
    await notion.pages.update({
      page_id: existingPage.id,
      properties
    });
    
    console.log(`🔄 Updated member: ${member.given_name} ${member.surname_name} (Student ID: ${member.student_number}, MySQL ID: ${member.id})`);
  } catch (error) {
    console.error(`❌ Failed to update member ${member.id} (Student ID: ${member.student_number}):`, error.message);
    throw error;
  }
}

/**
 * Helper function to build Notion properties object from MySQL member data
 */
function buildNotionMemberProperties(member) {
  const properties = {
    "Id": {
      number: member.id
    },
    "First Name": {
      title: [
        {
          type: "text",
          text: {
            content: member.given_name || ""
          }
        }
      ]
    },
    "Last Name": {
      rich_text: [
        {
          type: "text",
          text: {
            content: member.surname_name || ""
          }
        }
      ]
    },
    "Preferred Name": {
      rich_text: member.preferred_name ? [
        {
          type: "text",
          text: {
            content: member.preferred_name
          }
        }
      ] : []
    },
    "UofT Email": member.uoft_email ? {
      email: member.uoft_email
    } : undefined,
    "Student ID": {
      number: member.student_number
    },
    "Student Status": member.student_status ? {
      select: { name: member.student_status }
    } : undefined,
    "Faculty": member.faculty ? {
      select: { name: member.faculty }
    } : undefined,
    "College/Campus": member.college ? {
      select: { name: member.college }
    } : undefined,
    "Program": {
      rich_text: member.program ? [
        {
          type: "text",
          text: {
            content: member.program
          }
        }
      ] : []
    },
    "Year of Study": member.year_of_study ? {
      select: { name: member.year_of_study }
    } : undefined,
    "Nationality": {
      rich_text: member.country ? [
        {
          type: "text",
          text: {
            content: member.country
          }
        }
      ] : []
    }
  };

  // Only add date properties if they have valid values
  const registrationDate = formatDateForNotion(member.registration_date);
  if (registrationDate) {
    properties["Date of Registration"] = {
      date: {
        start: registrationDate
      }
    };
  }

  // For last_update, use registration_date if last_update is invalid/0
  let lastUpdateDate = formatDateForNotion(member.last_update);
  if (!lastUpdateDate && registrationDate) {
    // console.log(`Using registration date for last_update for member ${member.id}`);
    lastUpdateDate = registrationDate;
  }
  
  if (lastUpdateDate) {
    properties["Last Update"] = {
      date: {
        start: lastUpdateDate
      }
    };
  }

  // Remove undefined properties
  Object.keys(properties).forEach(key => {
    if (properties[key] === undefined) {
      delete properties[key];
    }
  });

  return properties;
}

/**
 * Helper function to format date for Notion API
 */
function formatDateForNotion(date) {
  if (!date) return null;
  
  // Handle various date formats that might come from MySQL
  let dateObj;
  if (date instanceof Date) {
    // If it's already a Date object, check if it's valid first
    if (isNaN(date.getTime())) {
      return null; // Don't log warning for already invalid Date objects
    }
    dateObj = date;
  } else if (typeof date === 'string') {
    // Handle special cases like "0000-00-00 00:00:00" from MySQL
    if (date.startsWith('0000-00-00') || date === '0' || date.trim() === '') {
      return null;
    }
    dateObj = new Date(date);
  } else if (typeof date === 'number') {
    // Handle timestamp numbers, but 0 means no date
    if (date === 0) {
      return null;
    }
    dateObj = new Date(date * 1000); // Assuming Unix timestamp
  } else {
    console.warn(`Unexpected date type: ${typeof date}, value: ${date}`);
    return null;
  }
  
  if (isNaN(dateObj.getTime())) {
    // Only log warning if the original input wasn't already an invalid Date
    if (!(date instanceof Date)) {
      console.warn(`Invalid date format: ${date}`);
    }
    return null;
  }
  
  // Return full ISO string for Notion
  return dateObj.toISOString();
}

/**
 * Helper function to check if a member needs updating in Notion
 */
function checkIfMemberNeedsUpdate(mysqlMember, notionPage) {
  // Helper to safely get text content from rich_text property
  const getRichTextContent = (prop) => {
    return prop?.rich_text?.[0]?.text?.content || "";
  };
  
  // Helper to safely get text content from title property
  const getTitleContent = (prop) => {
    return prop?.title?.[0]?.text?.content || "";
  };
  
  // Helper to safely get select name
  const getSelectName = (prop) => {
    return prop?.select?.name || "";
  };
  
  // Helper to safely get date string  
  const getDateString = (prop) => {
    return prop?.date?.start || "";
  };
  
  const props = notionPage.properties;
  
  // Compare each field (excluding Id since we use Student ID as unique identifier)
  const fieldChecks = {
    firstName: getTitleContent(props["First Name"]) !== (mysqlMember.given_name || ""),
    lastName: getRichTextContent(props["Last Name"]) !== (mysqlMember.surname_name || ""),
    preferredName: getRichTextContent(props["Preferred Name"]) !== (mysqlMember.preferred_name || ""),
    email: (props["UofT Email"]?.email || "") !== (mysqlMember.uoft_email || ""),
    status: getSelectName(props["Student Status"]) !== (mysqlMember.student_status || ""),
    faculty: getSelectName(props["Faculty"]) !== (mysqlMember.faculty || ""),
    campus: getSelectName(props["College/Campus"]) !== (mysqlMember.college || ""),
    program: getRichTextContent(props["Program"]) !== (mysqlMember.program || ""),
    yearOfStudy: getSelectName(props["Year of Study"]) !== (mysqlMember.year_of_study || ""),
    nationality: getRichTextContent(props["Nationality"]) !== (mysqlMember.country || ""),
    registrationDate: getDateString(props["Date of Registration"]) !== (formatDateForNotion(mysqlMember.registration_date) || "")
  };
  
  // Handle last_update comparison with fallback to registration_date
  let expectedLastUpdate = formatDateForNotion(mysqlMember.last_update);
  if (!expectedLastUpdate) {
    expectedLastUpdate = formatDateForNotion(mysqlMember.registration_date) || "";
  }
  fieldChecks.lastUpdate = getDateString(props["Last Update"]) !== expectedLastUpdate;
  
  // Check if any field needs updating
  const needsUpdate = Object.values(fieldChecks).some(check => check);
  
  // Debug logging for members that need updates
  if (needsUpdate) {
    console.log(`🔍 Member ${mysqlMember.student_number} needs update. Changed fields:`);
    Object.entries(fieldChecks).forEach(([field, hasChanged]) => {
      if (hasChanged) {
        let notionValue, mysqlValue;
        switch(field) {
          case 'firstName':
            notionValue = getTitleContent(props["First Name"]);
            mysqlValue = mysqlMember.given_name || "";
            break;
          case 'lastName':
            notionValue = getRichTextContent(props["Last Name"]);
            mysqlValue = mysqlMember.surname_name || "";
            break;
          case 'preferredName':
            notionValue = getRichTextContent(props["Preferred Name"]);
            mysqlValue = mysqlMember.preferred_name || "";
            break;
          case 'email':
            notionValue = props["UofT Email"]?.email || "";
            mysqlValue = mysqlMember.uoft_email || "";
            break;
          case 'status':
            notionValue = getSelectName(props["Student Status"]);
            mysqlValue = mysqlMember.student_status || "";
            break;
          case 'faculty':
            notionValue = getSelectName(props["Faculty"]);
            mysqlValue = mysqlMember.faculty || "";
            break;
          case 'campus':
            notionValue = getSelectName(props["College/Campus"]);
            mysqlValue = mysqlMember.college || "";
            break;
          case 'program':
            notionValue = getRichTextContent(props["Program"]);
            mysqlValue = mysqlMember.program || "";
            break;
          case 'yearOfStudy':
            notionValue = getSelectName(props["Year of Study"]);
            mysqlValue = mysqlMember.year_of_study || "";
            break;
          case 'nationality':
            notionValue = getRichTextContent(props["Nationality"]);
            mysqlValue = mysqlMember.country || "";
            break;
          case 'registrationDate':
            notionValue = getDateString(props["Date of Registration"]);
            mysqlValue = formatDateForNotion(mysqlMember.registration_date) || "";
            break;
          case 'lastUpdate':
            notionValue = getDateString(props["Last Update"]);
            mysqlValue = expectedLastUpdate;
            break;
        }
        console.log(`   ${field}: Notion="${notionValue}" vs MySQL="${mysqlValue}"`);
      }
    });
  }
  
  return needsUpdate;
}

/**
 * Test function to sync just one member for debugging
 */
export async function testSyncSingleMember(studentId) {
  try {
    console.log(`🧪 Testing sync for student ID: ${studentId}`);
    
    // Validate required environment variables
    if (!membersDatabaseId) {
      throw new Error("NOTION_MEMBERS_DB_ID environment variable is not set");
    }
    
    // Get single member from MySQL by student_number
    const { query } = await import("./database.js");
    const mysqlMembers = await query(
      `SELECT 
        id, given_name, surname_name, preferred_name, uoft_email, 
        student_number, student_status, faculty, college, program, 
        year_of_study, country, registration_date, last_update
      FROM members 
      WHERE student_number = ?`,
      [studentId]
    );
    
    if (mysqlMembers.length === 0) {
      console.log(`❌ No member found with Student ID: ${studentId}`);
      return;
    }
    
    const member = mysqlMembers[0];
    console.log("📊 Member data:", member);
    
    // Check if member exists in Notion
    const response = await notion.databases.query({
      database_id: membersDatabaseId,
      filter: {
        property: "Student ID",
        number: {
          equals: studentId
        }
      }
    });
    
    if (response.results.length === 0) {
      console.log("🆕 Member not found in Notion, inserting...");
      await insertMemberToNotion(member);
    } else {
      console.log("🔄 Member found in Notion, checking for updates...");
      const existingPage = response.results[0];
      const needsUpdate = checkIfMemberNeedsUpdate(member, existingPage);
      
      if (needsUpdate) {
        console.log("✅ Update needed, updating member...");
        await updateMemberInNotion(member, existingPage);
      } else {
        console.log("⏭️ No update needed, member is already up to date");
      }
    }
    
    console.log("✅ Test complete!");
    
  } catch (error) {
    console.error("🔥 Error in test sync:", error);
    throw error;
  }
}