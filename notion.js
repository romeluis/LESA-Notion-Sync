// notion.js
import { Client } from "@notionhq/client";
import { Event } from "./event.js";

// 🔑 Make sure NOTION_TOKEN and NOTION_DB_ID are set as env vars on your server
const notion = new Client({ auth: process.env.NOTION_TOKEN });
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
        page_size: 100
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
    allPages.forEach((page, i) => {
      //Create event object
      if (page.properties['Event Status'].status.name !== 'Event Cancelled') {
        var id = page.properties.id.unique_id.number
        var name = page.properties['Event Name'].title[0].text.content
        var emoji = page.icon.emoji

        var description = 'NONE'
        if (page.properties['Event Description'].rich_text.length !== 0) {
          description = page.properties['Event Description'].rich_text[0].text.content
        }

        var location = 'TBA'
        if (page.properties['Location'].rich_text.length !== 0) {
          location = page.properties['Location'].rich_text[0].text.content
        }

        var type = page.properties['Organizer'].select.name
        var organization = null
        if (page.properties['Organization'].rich_text.length != 0) {
          organization = page.properties['Organization'].rich_text[0].text.content
        }

        var day = null
        var month = null
        var year = null
        var startHour = null
        var startMinute = null
        var endHour = null
        var endMinute = null
        // 🗓️ Parse Notion ‘Event Date & Time’ into your numeric fields
        const dateProp = page.properties['Event Date & Time'].date;
        if (dateProp) {
          const start = new Date(dateProp.start);
          // Notion returns `end: null` if there’s no end date
          const end   = dateProp.end ? new Date(dateProp.end) : null;

          // 1 & 3. Different-day or no-end-date → day=0, month/year from start, times=0
          if (!end || start.toDateString() !== end.toDateString()) {
            day         = 0;
            month       = start.getMonth() + 1;     // JS months are 0–11
            year        = start.getFullYear();
            startHour   = 0;
            startMinute = 0;
            endHour     = 0;
            endMinute   = 0;
          } else {
            // 2. Same day, different times → pull actual date + 24h times
            day         = start.getDate();
            month       = start.getMonth() + 1;
            year        = start.getFullYear();
            startHour   = start.getHours();
            startMinute = start.getMinutes();
            endHour     = end.getHours();
            endMinute   = end.getMinutes();
          }
        } else {
          // No date prop at all—optional fallback
          day = month = year = startHour = startMinute = endHour = endMinute = 0;
        }


        var price = page.properties['Cost'].number
        var link = '0'
        if (page.properties['Requires Registration'].checkbox) {
          if (page.properties['Registration Form'].url !== null) {
            link = page.properties['Registration Form'].url
          } else {
            link = '1'
          }
        }
        var calendarLink = 'NONE'
        if (page.properties['Calendar Invite Link'].url !== null) {
          calendarLink = page.properties['Calendar Invite Link'].url
        }
        var isCpsifFunded = page.properties['Is CPSIF Funded'].checkbox

        const event = new Event(id, name, emoji, description, location, type, organization, day, month, year, startHour, startMinute, endHour, endMinute, price, link, calendarLink, isCpsifFunded)
        allEvents.push(event)
      }
    });
    return allEvents;
  } catch (error) {
    console.error("🔥 Error fetching from Notion:", error);
  }
}