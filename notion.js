// notion.js
import { Client } from "@notionhq/client";

// 🔑 Make sure NOTION_TOKEN and NOTION_DB_ID are set as env vars on your server
console.log("Code:" + process.env.NOTION_TOKEN)
console.log("Code:" + process.env.NOTION_DB_ID)
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
        database_id: databaseId
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