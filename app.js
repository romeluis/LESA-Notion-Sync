// main.js
process.env.UNDICI_DISABLE_WASM = "1";

import { CronJob } from "cron";
import { synthesizeEvents, syncMembers, syncMemberRegistrations } from "./notion.js";
import { syncEvents } from "./database.js";

/**
 * Runs one full sync: fetch from Notion, then upsert into MySQL.
 * Each sync step runs independently so one failure doesn't block the others.
 */
async function runSync() {
  console.log("🚀 Starting Notion → SQL sync…");
  const errors = [];

  // Sync events
  try {
    const events = await synthesizeEvents();
    console.log(`🗂️  Got ${events.length} events, now syncing…`);
    await syncEvents(events);
    if (global.__syncTracker) global.__syncTracker.reportStepComplete('events');
  } catch (err) {
    console.error("🔥 Error syncing events:", err);
    errors.push(`Events: ${err.message}`);
    if (global.__syncTracker) global.__syncTracker.reportStepError('events', err.message);
  }

  // Sync members
  try {
    console.log("🔄 Now syncing members…");
    await syncMembers();
    if (global.__syncTracker) global.__syncTracker.reportStepComplete('members');
  } catch (err) {
    console.error("🔥 Error syncing members:", err);
    errors.push(`Members: ${err.message}`);
    if (global.__syncTracker) global.__syncTracker.reportStepError('members', err.message);
  }

  // Sync member event registrations
  try {
    console.log("🎯 Now syncing member event registrations…");
    await syncMemberRegistrations();
    if (global.__syncTracker) global.__syncTracker.reportStepComplete('registrations');
  } catch (err) {
    console.error("🔥 Error syncing registrations:", err);
    errors.push(`Registrations: ${err.message}`);
    if (global.__syncTracker) global.__syncTracker.reportStepError('registrations', err.message);
  }

  if (errors.length > 0) {
    console.error(`⚠️ Sync finished with ${errors.length} error(s):\n  ${errors.join('\n  ')}`);
    if (global.__syncTracker) global.__syncTracker.reportSyncError();
  } else {
    console.log("✅ Sync complete! 💅");
    if (global.__syncTracker) global.__syncTracker.reportSyncComplete();
  }
}

// 1️⃣ Run immediately on startup
runSync().catch(err => {
  console.error("🔥 Error in initial sync:", err);
});

// 2️⃣ Schedule sync every 10 minutes
const job = new CronJob("*/10 * * * *", () => {
  console.log("⏰ 10-minute sync triggered");
  runSync().catch(err => {
    console.error("🔥 Error in scheduled sync:", err);
  });
});

// 3️⃣ Start the cron job
job.start();
console.log("✨ Scheduler started: syncing every 10 minutes");
