#!/usr/bin/env node
// ============================================================================
// schedule-cli.js — Command-line schedule editor for your Hyperlocal Channel
// ============================================================================
// Manage your TV schedule entirely from the command line.
// Schedules are stored in Cloudflare KV, and the Roku channel reads them live.
//
// Usage:
//   node schedule-cli.js add <contentId> --day Monday --time 18:00 --title "My Show"
//   node schedule-cli.js list --date 2025-11-15
//   node schedule-cli.js remove <scheduleId>
//   node schedule-cli.js set-live --status on|off
//   node schedule-cli.js export
//   node schedule-cli.js generate-weekly
// ============================================================================

const argv = process.argv.slice(2);
const command = argv[0];

// ─── Configuration ────────────────────────────────────────────────────────
const WORKER_URL = process.env.WORKER_URL || "https://my-hyperlocal-channel.your-subdomain.workers.dev";

// ─── Helper: call the Worker's schedule API ───────────────────────────────
async function scheduleApi(action, data = {}) {
  const url = new URL(`/api/schedule`, WORKER_URL);
  url.searchParams.set("action", action);
  Object.entries(data).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString());
  const body = await res.json();
  if (body.error) {
    console.error(`Error: ${body.error}`);
    process.exit(1);
  }
  return body;
}

// ─── "add" — Add a schedule entry ─────────────────────────────────────────
async function addSchedule(args) {
  const idx = args.indexOf("--");
  const contentId = args[0];
  const opts = {};
  if (idx > 0) {
    for (let i = 1; i < args.length; i++) {
      if (args[i].startsWith("--")) {
        const key = args[i].slice(2);
        const val = args[i + 1];
        if (val && !val.startsWith("--")) {
          opts[key] = val;
          i++;
        }
      }
    }
  }

  if (!contentId) {
    console.log("Usage: node schedule-cli.js add <contentId> [--day Mon] [--time 18:00] [--title \"Title\"] [--weeks 4] [--repeat daily|weekly]");
    console.log("\nExamples:");
    console.log('  node schedule-cli.js add 001 --day Monday --time 18:00 --title "Evening News"');
    console.log('  node schedule-cli.js add 002 --day Monday --time 18:30 --title "Community Update" --weeks 12');
    console.log('  node schedule-cli.js add 003 --time 19:00 --repeat daily --title "Weekend Recaps"');
    return;
  }

  const result = await scheduleApi("add", {
    contentId,
    day: opts.day || "",
    time: opts.time || "",
    title: opts.title || "",
    weeks: opts.weeks || "1",
    repeat: opts.repeat || ""
  });

  console.log(`✓ Scheduled: ${result.scheduleId} — ${result.summary}`);
}

// ─── "list" — List schedule entries ────────────────────────────────────────
async function listSchedule(args) {
  const dateArg = args.find(a => a === "--date" || a === "--today");
  const date = dateArg ? args[args.indexOf(dateArg) + 1] : "";

  const result = await scheduleApi("list", { date });

  if (result.entries.length === 0) {
    console.log("No scheduled entries for this period.");
    return;
  }

  console.log(`\n  Schedule: ${result.date || "Today"}  (${result.entries.length} programs)`);
  console.log("  " + "─".repeat(70));

  for (const entry of result.entries) {
    const start = entry.startTime || "";
    const title = entry.title || entry.contentId || "?";
    const duration = entry.duration ? ` (${entry.duration}s)` : "";
    console.log(`  ${start}  ${title}${duration}`);
  }
  console.log("");
}

// ─── "remove" — Remove a schedule entry ───────────────────────────────────
async function removeSchedule(args) {
  const scheduleId = args[0];
  if (!scheduleId) {
    console.log("Usage: node schedule-cli.js remove <scheduleId>");
    return;
  }

  const result = await scheduleApi("remove", { scheduleId });
  console.log(`✓ Removed: ${result.scheduleId}`);
}

// ─── "set-live" — Enable/disable live channel mode ────────────────────────
async function setLive(args) {
  const mode = args[0];
  if (!["on", "off"].includes(mode)) {
    console.log("Usage: node schedule-cli.js set-live <on|off>");
    return;
  }

  const result = await scheduleApi("set-live", { enabled: mode === "on" ? "1" : "0" });
  console.log(`✓ Live channel ${mode === "on" ? "ENABLED" : "DISABLED"}`);
}

// ─── "export" — Export schedule as JSON ────────────────────────────────────
async function exportSchedule(args) {
  const outputFile = args[0] || "schedule-export.json";
  const result = await scheduleApi("export");

  const fs = await import("fs");
  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
  console.log(`✓ Exported ${result.entries.length} entries to ${outputFile}`);
}

// ─── "generate-weekly" — Generate a full week schedule from existing rules ─
async function generateWeekly(args) {
  const result = await scheduleApi("generate-weekly");
  console.log(`✓ Generated ${result.totalSlots} slots for the week of ${result.weekStart}`);
  console.log(`  (with ${result.gaps} fill-in slots and ${result.liveBlocks} live blocks)`);
}

// ─── Main dispatcher ──────────────────────────────────────────────────────
const commands = { add: addSchedule, list: listSchedule, remove: removeSchedule, "set-live": setLive, export: exportSchedule, "generate-weekly": generateWeekly };
const cmd = commands[command];

if (cmd) {
  cmd(argv.slice(1));
} else {
  console.log("Schedule CLI — Manage your Hyperlocal Channel TV schedule");
  console.log("");
  console.log("Commands:");
  console.log("  add <contentId> [--day Mon] [--time 18:00] [--title \"Title\"] [--weeks 4] [--repeat daily|weekly|monthly]");
  console.log("  list [--date 2025-11-15]  (use --today for today's schedule)");
  console.log("  remove <scheduleId>");
  console.log("  set-live <on|off>  (turn live TV mode on or off)");
  console.log("  export [output.json]  (export schedule to file)");
  console.log("  generate-weekly  (fill gaps with fill-in content and live blocks)");
  console.log("");
  console.log("Set WORKER_URL env var to point to your Cloudflare Worker.");
  console.log("Default: https://my-hyperlocal-channel.your-subdomain.workers.dev");
}
