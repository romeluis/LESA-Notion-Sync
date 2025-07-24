// notion.js
import { Client } from "@notionhq/client";
import { Event } from "./event.js";
import fetch from "node-fetch";  

// 🔑 Make sure NOTION_TOKEN and NOTION_DB_ID are set as env vars on your server
const notion = new Client({ auth: process.env.NOTION_TOKEN, fetch });
const databaseId = process.env.NOTION_DB_ID;

/**
 * Queries your Notion database and logs each page object.
 */
export async function printNotionContents() {
  try {
    let allPages = [];
    let cursor = undefined;

    do {
      const response = await notion.databases.query({
        database_id: databaseId,
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
        database_id: databaseId,
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
  const requiresReg = page.properties['Requires Registration'].checkbox;
  const regUrl = page.properties['Registration Form'].url;
  const link = requiresReg
    ? (regUrl ?? '1')
    : '0';

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