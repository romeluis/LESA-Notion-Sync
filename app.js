// main.js
process.env.UNDICI_DISABLE_WASM = "1";

import { CronJob } from "cron";
import { synthesizeEvents, syncMembers, syncMemberRegistrations, synthesizeExecutives, synthesizePositions } from "./notion.js";
import { syncEvents, syncExecutives, syncPositions } from "./database.js";

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

  // Sync executive positions
  try {
    console.log("📋 Now syncing executive positions…");
    const positions = await synthesizePositions();
    console.log(`📋 Got ${positions.length} positions, now syncing…`);
    await syncPositions(positions);
    if (global.__syncTracker) global.__syncTracker.reportStepComplete('positions');
  } catch (err) {
    console.error("🔥 Error syncing positions:", err);
    errors.push(`Positions: ${err.message}`);
    if (global.__syncTracker) global.__syncTracker.reportStepError('positions', err.message);
  }

  if (errors.length > 0) {
    console.error(`⚠️ Sync finished with ${errors.length} error(s):\n  ${errors.join('\n  ')}`);
    if (global.__syncTracker) global.__syncTracker.reportSyncError();
  } else {
    console.log("✅ Sync complete! 💅");
    if (global.__syncTracker) global.__syncTracker.reportSyncComplete();
  }
}

/**
 * Syncs executives (portraits involve R2 uploads, so run less frequently).
 */
async function runExecSync() {
  console.log("👔 Starting executives sync…");
  try {
    const executives = await synthesizeExecutives();
    console.log(`👥 Got ${executives.length} executives, now syncing…`);
    await syncExecutives(executives);
    if (global.__syncTracker) global.__syncTracker.reportStepComplete('executives');
    console.log("✅ Executives sync complete!");
  } catch (err) {
    console.error("🔥 Error syncing executives:", err);
    if (global.__syncTracker) global.__syncTracker.reportStepError('executives', err.message);
  }
}

// 1️⃣ Run everything immediately on startup
runSync().catch(err => {
  console.error("🔥 Error in initial sync:", err);
});
runExecSync().catch(err => {
  console.error("🔥 Error in initial exec sync:", err);
});

// 2️⃣ Schedule main sync every 10 minutes
const job = new CronJob("*/10 * * * *", () => {
  console.log("⏰ 10-minute sync triggered");
  runSync().catch(err => {
    console.error("🔥 Error in scheduled sync:", err);
  });
});
job.start();

// 3️⃣ Schedule executives sync weekly (Monday at midnight)
const execJob = new CronJob("0 0 * * 1", () => {
  console.log("⏰ Weekly executives sync triggered");
  runExecSync().catch(err => {
    console.error("🔥 Error in scheduled exec sync:", err);
  });
});
execJob.start();

console.log("✨ Scheduler started: main sync every 10 min, executives weekly");
