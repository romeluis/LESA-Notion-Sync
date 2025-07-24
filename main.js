// main.js
import { CronJob } from "cron";
import { synthesizeEvents } from "./notion.js";
import { syncEvents } from "./database.js";

/**
 * Runs one full sync: fetch from Notion, then upsert into MySQL.
 */
async function runSync() {
  console.log("🚀 Starting Notion → SQL sync…");
  const events = await synthesizeEvents();
  console.log(`🗂️  Got ${events.length} events, now syncing…`);
  await syncEvents(events);
  console.log("✅ Sync complete! 💅");
}

// 1️⃣ Run immediately on startup
runSync().catch(err => {
  console.error("🔥 Error in initial sync:", err);
});

// 2️⃣ Schedule hourly sync at minute 0
const job = new CronJob("0 * * * *", () => {
  console.log("⏰ Hourly sync triggered");
  runSync().catch(err => {
    console.error("🔥 Error in scheduled sync:", err);
  });
});

// 3️⃣ Start the cron job
job.start();
console.log("✨ Scheduler started: syncing every hour on the hour");
