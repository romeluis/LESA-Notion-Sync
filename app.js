// main.js
process.env.UNDICI_DISABLE_WASM = "1";

import { CronJob } from "cron";
import { synthesizeEvents, syncMembers, syncMemberRegistrations } from "./notion.js";
import { syncEvents } from "./database.js";

/**
 * Runs one full sync: fetch from Notion, then upsert into MySQL.
 */
async function runSync() {
  console.log("🚀 Starting Notion → SQL sync…");
  
  // Sync events
  const events = await synthesizeEvents();
  console.log(`🗂️  Got ${events.length} events, now syncing…`);
  await syncEvents(events);
  
  // Sync members
  console.log("🔄 Now syncing members…");
  await syncMembers();
  
  // Sync member event registrations
  console.log("🎯 Now syncing member event registrations…");
  await syncMemberRegistrations();
  
  console.log("✅ Sync complete! 💅");
  if (global.__syncTracker) global.__syncTracker.reportSyncComplete();
}

// 1️⃣ Run immediately on startup
runSync().catch(err => {
  console.error("🔥 Error in initial sync:", err);
  if (global.__syncTracker) global.__syncTracker.reportSyncError();
});

// 2️⃣ Schedule sync every 10 minutes
const job = new CronJob("*/10 * * * *", () => {
  console.log("⏰ 10-minute sync triggered");
  runSync().catch(err => {
    console.error("🔥 Error in scheduled sync:", err);
    if (global.__syncTracker) global.__syncTracker.reportSyncError();
  });
});

// 3️⃣ Start the cron job
job.start();
console.log("✨ Scheduler started: syncing every 10 minutes");
