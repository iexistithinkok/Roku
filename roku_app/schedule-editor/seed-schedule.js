#!/usr/bin/env node
// ============================================================================
// seed-schedule.js — Seed your schedule with a realistic weekly pattern
// ============================================================================
// Run this ONCE to populate your schedule with a realistic weekly pattern:
//   - Morning news at 6 AM
//   - Community programs during the day
//   - Evening "prime time" shows
//   - Weekend special programming
//
// Usage: node seed-schedule.js
// Requires: WORKER_URL env variable
// ============================================================================

const WORKER_URL = process.env.WORKER_URL || "https://my-hyperlocal-channel.your-subdomain.workers.dev";

// Your content library — map these to your actual Cloudflare Stream video IDs
const CONTENT = {
  MORNING_NEWS: "001",        // Daily morning news (6:00 AM)
  LOCAL_WAY OF LIFE: "002",   // Documentary about your town
  COMMUNITY_HOUR: "003",       // Community board / public service
  EVENING_NEWS: "004",         // Evening news (6:00 PM)
  TALK_WITH_MAYOR: "005",      // Mayor interview series
  WEEKEND_FESTIVAL: "006",     // Festival coverage (weekends)
  YOUTH_SPOTLIGHT: "007",      // Student achievements (weekdays)
  LOCAL_BUSINESS: "008",       // Business profiles (weekdays)
  PRAIRIE_SPORTS: "009",       // High school sports highlights
  CULTURAL_HERITAGE: "010",    // Historical segments
  FOOD_TRAIL: "011",           // Local food scene
  NATURE_WALKS: "012"          // Nature/outdoor segments
};

// Weekly schedule — what airs when
const WEEKLY_SCHEDULE = [
  // ── MONDAY ──
  { day: "Monday",    time: "06:00",  content: "MORNING_NEWS",    duration: 900,  title: "Morning News",          priority: 0 },
  { day: "Monday",    time: "06:30",  content: "LOCAL_TRAIL",     duration: 300,  title: "Weather Brief",         priority: 0 },
  { day: "Monday",    time: "07:00",  content: "YOUTH_SPOTLIGHT", duration: 900,  title: "Youth Spotlight",       priority: 0 },
  { day: "Monday",    time: "07:30",  content: "COMMUNITY_HOUR",  duration: 1800, title: "Community Hour",        priority: 0 },
  { day: "Monday",    time: "08:00",  content: "LOCAL_BUSINESS",  duration: 1800, title: "Local Business Profile",priority: 0 },
  { day: "Monday",    time: "12:00",  content: "LOCAL_WAY_OF_LIFE", duration: 1800, title: "Local Way of Life",     priority: 1, isLive: true },
  { day: "Monday",    time: "18:00",  content: "EVENING_NEWS",    duration: 1800, title: "Evening News",          priority: 0 },
  { day: "Monday",    time: "18:30",  content: "TALK_WITH_MAYOR", duration: 1800, title: "Talk With the Mayor",   priority: 1 },

  // ── TUESDAY ──
  { day: "Tuesday",   time: "06:00",  content: "MORNING_NEWS",    duration: 900,  title: "Morning News",          priority: 0 },
  { day: "Tuesday",   time: "06:30",  content: "LOCAL_TRAIL",     duration: 300,  title: "Weather Brief",         priority: 0 },
  { day: "Tuesday",   time: "07:00",  content: "LOCAL_BUSINESS",  duration: 1800, title: "Business of the Week",  priority: 0 },
  { day: "Tuesday",   time: "07:30",  content: "COMMUNITY_HOUR",  duration: 1800, title: "Community Hour",        priority: 0 },
  { day: "Tuesday",   time: "08:00",  content: "CULTURAL_HERITAGE", duration: 1800, title: "Cultural Heritage",     priority: 0 },
  { day: "Tuesday",   time: "12:00",  content: "LOCAL_WAY_OF_LIFE", duration: 1800, title: "Local Way of Life",     priority: 1, isLive: true },
  { day: "Tuesday",   time: "18:00",  content: "EVENING_NEWS",    duration: 1800, title: "Evening News",          priority: 0 },
  { day: "Tuesday",   time: "18:30",  content: "FOOD_TRAIL",      duration: 1800, title: "Food Trail",            priority: 0 },

  // ── WEDNESDAY ──
  { day: "Wednesday", time: "06:00",  content: "MORNING_NEWS",    duration: 900,  title: "Morning News",          priority: 0 },
  { day: "Wednesday", time: "06:30",  content: "NATURE_WALKS",    duration: 300,  title: "Nature Walk Preview",   priority: 0 },
  { day: "Wednesday", time: "07:00",  content: "YOUTH_SPOTLIGHT", duration: 900,  title: "Youth Spotlight",       priority: 0 },
  { day: "Wednesday", time: "07:30",  content: "LOCAL_BUSINESS",  duration: 1800, title: "Business of the Week",  priority: 0 },
  { day: "Wednesday", time: "08:00",  content: "COMMUNITY_HOUR",  duration: 1800, title: "Community Hour",        priority: 0 },
  { day: "Wednesday", time: "12:00",  content: "LOCAL_WAY_OF_LIFE", duration: 1800, title: "Local Way of Life",     priority: 1, isLive: true },
  { day: "Wednesday", time: "18:00",  content: "EVENING_NEWS",    duration: 1800, title: "Evening News",          priority: 0 },
  { day: "Wednesday", time: "18:30",  content: "TALK_WITH_MAYOR", duration: 1800, title: "Talk With the Mayor",   priority: 1 },

  // ── THURSDAY ──
  { day: "Thursday",  time: "06:00",  content: "MORNING_NEWS",    duration: 900,  title: "Morning News",          priority: 0 },
  { day: "Thursday",  time: "06:30",  content: "LOCAL_TRAIL",     duration: 300,  title: "Weather Brief",         priority: 0 },
  { day: "Thursday",  time: "07:00",  content: "LOCAL_BUSINESS",  duration: 1800, title: "Business of the Week",  priority: 0 },
  { day: "Thursday",  time: "07:30",  content: "CULTURAL_HERITAGE", duration: 1800, title: "Cultural Heritage",     priority: 0 },
  { day: "Thursday",  time: "08:00",  content: "YOUTH_SPOTLIGHT", duration: 900,  title: "Youth Spotlight",       priority: 0 },
  { day: "Thursday",  time: "12:00",  content: "LOCAL_WAY_OF_LIFE", duration: 1800, title: "Local Way of Life",     priority: 1, isLive: true },
  { day: "Thursday",  time: "18:00",  content: "EVENING_NEWS",    duration: 1800, title: "Evening News",          priority: 0 },
  { day: "Thursday",  time: "18:30",  content: "NATURE_WALKS",    duration: 1800, title: "Nature Walks",          priority: 0 },

  // ── FRIDAY ──
  { day: "Friday",    time: "06:00",  content: "MORNING_NEWS",    duration: 900,  title: "Morning News",          priority: 0 },
  { day: "Friday",    time: "06:30",  content: "LOCAL_TRAIL",     duration: 300,  title: "Weather Brief",         priority: 0 },
  { day: "Friday",    time: "07:00",  content: "YOUTH_SPOTLIGHT", duration: 900,  title: "Youth Spotlight",       priority: 0 },
  { day: "Friday",    time: "07:30",  content: "FOOD_TRAIL",      duration: 1800, title: "Food Trail",            priority: 0 },
  { day: "Friday",    time: "08:00",  content: "COMMUNITY_HOUR",  duration: 1800, title: "Community Hour",        priority: 0 },
  { day: "Friday",    time: "12:00",  content: "LOCAL_WAY_OF_LIFE", duration: 1800, title: "Local Way of Life",     priority: 1, isLive: true },
  { day: "Friday",    time: "18:00",  content: "EVENING_NEWS",    duration: 1800, title: "Friday Evening News",   priority: 0 },
  { day: "Friday",    time: "18:30",  content: "PRAIRIE_SPORTS",  duration: 1800, title: "Friday Night Sports",   priority: 0 },

  // ── SATURDAY ──
  { day: "Saturday",  time: "07:00",  content: "WEEKEND_FESTIVAL", duration: 1800, title: "Weekend Festival Guide",priority: 0 },
  { day: "Saturday",  time: "07:30",  content: "NATURE_WALKS",    duration: 1800, title: "Weekend Nature Walks",  priority: 0 },
  { day: "Saturday",  time: "08:00",  content: "LOCAL_BUSINESS",  duration: 1800, title: "Local Business Profile",priority: 0 },
  { day: "Saturday",  time: "12:00",  content: "LOCAL_WAY_OF_LIFE", duration: 1800, title: "Local Way of Life",     priority: 1, isLive: true },
  { day: "Saturday",  time: "18:00",  content: "WEEKEND_FESTIVAL", duration: 1800, title: "Weekend Wrap-Up",       priority: 0 },

  // ── SUNDAY ──
  { day: "Sunday",    time: "08:00",  content: "MORNING_NEWS",    duration: 900,  title: "Sunday Morning News",   priority: 0 },
  { day: "Sunday",    time: "08:30",  content: "CULTURAL_HERITAGE", duration: 1800, title: "Cultural Heritage",     priority: 0 },
  { day: "Sunday",    time: "09:00",  content: "YOUTH_SPOTLIGHT", duration: 900,  title: "Youth Spotlight",       priority: 0 },
  { day: "Sunday",    time: "09:30",  content: "LOCAL_WAY_OF_LIFE", duration: 1800, title: "Local Way of Life",     priority: 0 },
  { day: "Sunday",    time: "12:00",  content: "LOCAL_WAY_OF_LIFE", duration: 1800, title: "Sunday Community",      priority: 1, isLive: true },
  { day: "Sunday",    time: "18:00",  content: "TALK_WITH_MAYOR", duration: 1800, title: "Sunday Talk",           priority: 0 },
];

async function seedSchedule() {
  console.log("Seeding schedule from: " + WORKER_URL);
  console.log(`  ${WEEKLY_SCHEDULE.length} programs to create`);
  console.log("");

  const results = [];
  let errors = 0;

  for (const program of WEEKLY_SCHEDULE) {
    const contentId = CONTENT[program.content] || program.content;
    const url = new URL(`${WORKER_URL}/api/schedule?action=add`);

    Object.entries({
      contentId,
      day: program.day,
      time: program.time,
      duration: (program.duration || 1800).toString(),
      title: program.title,
      repeat: "weekly",
      weeks: "12",
      category: program.isLive ? "live" : "general",
      priority: (program.priority || 0).toString()
    }).forEach(([k, v]) => url.searchParams.set(k, v));

    try {
      const res = await fetch(url.toString());
      const data = await res.json();

      if (data.error) {
        console.error(`  ✗ ${program.title}: ${data.error}`);
        errors++;
      } else {
        console.log(`  ✓ ${program.day} ${program.time} — ${program.title}`);
        results.push(program.title);
      }
    } catch (err) {
      console.error(`  ✗ ${program.title}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\nDone! Created ${results.length} schedule entries (${errors} errors)`);

  // Enable live channel mode
  const liveUrl = new URL(`${WORKER_URL}/api/schedule?action=set-live`);
  liveUrl.searchParams.set("enabled", "1");

  try {
    await fetch(liveUrl.toString());
    console.log("\n  ✓ Live channel mode ENABLED");
    console.log("  Your Roku channel will now follow this schedule in real time!");
  } catch (err) {
    console.error(`  Note: Could not enable live mode: ${err.message}`);
  }
}

seedSchedule();
