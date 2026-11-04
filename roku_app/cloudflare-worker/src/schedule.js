// ============================================================================
// Schedule API — Route handlers for schedule management and Live TV mode
// Import these into your main Worker index.js and add the /api/schedule route.
// ============================================================================

// Add this to the fetch() router in index.js:
//   if (path.startsWith("/api/schedule")) return await handleScheduleApi(env, url);

// ============================================================================
// handleScheduleApi — Main schedule route handler
// ============================================================================
async function handleScheduleApi(env, url) {
  const action = url.searchParams.get('action');
  const kv = env.SCHEDULE_KV;
  const contentKv = env.CHANNEL_KV; // reference to your content KV

  switch (action) {
    case 'add': return await handleScheduleAdd(kv, url);
    case 'list': return await handleScheduleList(kv, url);
    case 'list-weekly': return await handleScheduleListWeekly(kv, url);
    case 'remove': return await handleScheduleRemove(kv, url);
    case 'get': return await handleScheduleGet(kv, url);
    case 'set-live': return await handleSetLive(kv, env, url);
    case 'library': return await handleLibraryForSchedule(contentKv);
    case 'export': return await handleExportSchedule(kv, url);
    case 'import-schedule': return await handleImportSchedule(kv, url);
    case 'generate-weekly': return await handleGenerateWeekly(kv, url, contentKv);
    case 'now-playing': return await handleNowPlaying(kv, contentKv, url);
    case 'get-schedule': return await handleGetSchedule(kv, url);
    case 'get-now': return await handleGetNowPlaying(env, url);
    default: return new Response(JSON.stringify({ error: 'Unknown schedule action' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
}

// ============================================================================
// handleScheduleAdd — Add program(s) to the schedule
// Handles recurring: daily, weekly, one-time
// ============================================================================
async function handleScheduleAdd(kv, url) {
  const contentId = url.searchParams.get('contentId');
  const day = url.searchParams.get('day');
  const time = url.searchParams.get('time');
  const title = url.searchParams.get('title');
  const duration = parseInt(url.searchParams.get('duration') || '1800');
  const repeat = url.searchParams.get('repeat');
  const weeks = parseInt(url.searchParams.get('weeks') || '1');
  const category = url.searchParams.get('category');
  const priority = parseInt(url.searchParams.get('priority') || '0');

  if (!contentId) return new Response(JSON.stringify({ error: 'contentId required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const now = new Date();
  let scheduleEntries = [];

  // Generate schedule entries based on repeat rule
  if (repeat === 'daily') {
    // Every day for N weeks starting from today
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        const entryDate = new Date(now);
        entryDate.setDate(entryDate.getDate() + d + (w * 7));
        scheduleEntries.push(buildScheduleEntry(contentId, day, time, title, duration, entryDate, category, priority));
      }
    }
  } else if (repeat === 'weekly') {
    // Same day each week for N weeks
    for (let w = 0; w < weeks; w++) {
      const entryDate = new Date(now);
      entryDate.setDate(entryDate.getDate() + (w * 7));
      scheduleEntries.push(buildScheduleEntry(contentId, day, time, title, duration, entryDate, category, priority));
    }
  } else {
    // One time only
    scheduleEntries.push(buildScheduleEntry(contentId, day, time, title, duration, now, category, priority));
  }

  // Store each entry in KV
  const created = [];
  for (const entry of scheduleEntries) {
    const key = `schedule:${entry.scheduleId}`;
    await kv.put(key, JSON.stringify(entry));
    created.push(entry.scheduleId);
  }

  return new Response(JSON.stringify({
    created,
    scheduleId: created[0], // Return first for convenience
    summary: `${scheduleEntries.length} program(s) added for ${contentId}`
  }), { headers: { 'Content-Type': 'application/json' } });
}

// ============================================================================
// handleScheduleList — List schedule for a single date or "today"
// ============================================================================
async function handleScheduleList(kv, url) {
  const dateParam = url.searchParams.get('date') || '';
  const date = dateParam ? new Date(dateParam) : new Date();

  // Get today's date string (YYYY-MM-DD)
  const today = formatDate(date);

  // List all schedule entries, filter by today
  const keys = await kv.list({ prefix: `schedule:${today}:` });

  const entries = [];
  for (const key of keys.keys) {
    const raw = await kv.get(key.name);
    if (raw) {
      const entry = JSON.parse(raw);
      entries.push(entry);
    }
  }

  // Sort by start time
  entries.sort((a, b) => a.startTime.localeCompare(b.startTime));

  return new Response(JSON.stringify({ date: today, entries }), { headers: { 'Content-Type': 'application/json' } });
}

// ============================================================================
// handleScheduleListWeekly — List entire week's schedule
// ============================================================================
async function handleScheduleListWeekly(kv, url) {
  const weekStart = url.searchParams.get('weekStart') || formatDate(new Date());
  const startDate = new Date(weekStart);

  let allEntries = [];

  // Query each day of the week
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(startDate);
    dayDate.setDate(dayDate.getDate() + i);
    const dayStr = formatDate(dayDate);

    const keys = await kv.list({ prefix: `schedule:${dayStr}:` });
    for (const key of keys.keys) {
      const raw = await kv.get(key.name);
      if (raw) allEntries.push(JSON.parse(raw));
    }
  }

  // Sort by date+time
  allEntries.sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));

  return new Response(JSON.stringify({ weekStart: formatDate(startDate), entries: allEntries }), { headers: { 'Content-Type': 'application/json' } });
}

// ============================================================================
// handleScheduleRemove — Remove a schedule entry
// ============================================================================
async function handleScheduleRemove(kv, url) {
  const scheduleId = url.searchParams.get('scheduleId');
  if (!scheduleId) return new Response(JSON.stringify({ error: 'scheduleId required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  await kv.delete(`schedule:${scheduleId}`);
  return new Response(JSON.stringify({ scheduleId }), { headers: { 'Content-Type': 'application/json' } });
}

// ============================================================================
// handleScheduleGet — Get a single schedule entry
// ============================================================================
async function handleScheduleGet(kv, url) {
  const scheduleId = url.searchParams.get('scheduleId');
  if (!scheduleId) return new Response(JSON.stringify({ error: 'scheduleId required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const raw = await kv.get(`schedule:${scheduleId}`);
  if (!raw) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  return new Response(JSON.stringify(JSON.parse(raw)), { headers: { 'Content-Type': 'application/json' } });
}

// ============================================================================
// handleSetLive — Enable/disable live channel mode
// ============================================================================
async function handleSetLive(kv, env, url) {
  const enabled = url.searchParams.get('enabled') === '1';

  await kv.put('live:enabled', JSON.stringify({ enabled, updatedAt: new Date().toISOString() }));

  return new Response(JSON.stringify({ enabled }), { headers: { 'Content-Type': 'application/json' } });
}

// ============================================================================
// handleLibraryForSchedule — List available content for the schedule editor
// ============================================================================
async function handleLibraryForSchedule(contentKv) {
  const keys = await contentKv.list({ prefix: 'content:' });
  const contents = [];

  for (const key of keys.keys) {
    const raw = await contentKv.get(key.name);
    if (raw) {
      const item = JSON.parse(raw);
      contents.push({
        id: item.id,
        title: item.title || 'Untitled',
        category: item.category || 'general',
        location: item.location || '',
        duration: item.duration || 1800,
        streamUrl: item.streamUrl || ''
      });
    }
  }

  contents.sort((a, b) => a.title.localeCompare(b.title));

  return new Response(JSON.stringify({ contents }), { headers: { 'Content-Type': 'application/json' } });
}

// ============================================================================
// handleExportSchedule — Export all schedule data as JSON
// ============================================================================
async function handleExportSchedule(kv, url) {
  const keys = await kv.list({ prefix: 'schedule:' });
  const entries = [];

  for (const key of keys.keys) {
    const raw = await kv.get(key.name);
    if (raw) entries.push(JSON.parse(raw));
  }

  const live = await kv.get('live:enabled');
  const liveState = live ? JSON.parse(live) : { enabled: false };

  return new Response(JSON.stringify({ entries, live: liveState }), { headers: { 'Content-Type': 'application/json' } });
}

// ============================================================================
// handleImportSchedule — Import schedule from JSON (for backup/transfer)
// ============================================================================
async function handleImportSchedule(kv, url) {
  const dataParam = url.searchParams.get('data');
  if (!dataParam) return new Response(JSON.stringify({ error: 'data parameter required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const data = JSON.parse(dataParam);
  let imported = 0;

  for (const entry of data.entries) {
    const key = `schedule:${entry.scheduleId}`;
    await kv.put(key, JSON.stringify(entry));
    imported++;
  }

  if (data.live) {
    await kv.put('live:enabled', JSON.stringify(data.live));
  }

  return new Response(JSON.stringify({ imported }), { headers: { 'Content-Type': 'application/json' } });
}

// ============================================================================
// handleGenerateWeekly — Fill schedule gaps with fill-in content and live blocks
// ============================================================================
async function handleGenerateWeekly(kv, url, contentKv) {
  const weekStartParam = url.searchParams.get('weekStart') || formatDate(new Date());
  const startDate = new Date(weekStartParam);

  // Get all existing content IDs
  const contentKeys = await contentKv.list({ prefix: 'content:' });
  const contentIds = [];
  for (const key of contentKeys.keys) {
    const raw = await contentKv.get(key.name);
    if (raw) {
      const item = JSON.parse(raw);
      contentIds.push(item.id);
    }
  }

  if (contentIds.length === 0) {
    return new Response(JSON.stringify({ error: 'No content available to generate schedule', totalSlots: 0 }), { headers: { 'Content-Type': 'application/json' } });
  }

  let totalSlots = 0;
  let gaps = 0;
  let liveBlocks = 0;

  // For each day of the week, check for gaps and fill them
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(startDate);
    dayDate.setDate(dayDate.getDate() + i);
    const dayStr = formatDate(dayDate);

    // Get existing entries for this day
    const existingKeys = await kv.list({ prefix: `schedule:${dayStr}:` });
    let existing = [];
    for (const key of existingKeys.keys) {
      const raw = await kv.get(key.name);
      if (raw) existing.push(JSON.parse(raw));
    }

    existing.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Define standard channel hours (e.g., 6 AM to midnight)
    const dayStart = '06:00';
    const dayEnd = '00:00';

    // Find gaps between existing programs
    const gaps = findGaps(existing, dayStart, dayEnd);

    // Fill gaps with fill-in content (loop through content library)
    let contentIdx = 0;
    for (const gap of gaps) {
      const fillContentId = contentIds[contentIdx % contentIds.length];
      contentIdx++;
      gaps.push(buildScheduleEntry(fillContentId, '', gap.start, gap.end, gap.duration, dayDate, 'general', 0, true));
    }

    // Add live blocks (e.g., daily "Community Update" at 12:00)
    const liveEntry = buildScheduleEntry(
      contentIds[0], 'Wednesday', '12:00', 'Weekly Community Update', 300,
      dayDate, 'live', 1, false
    );
    liveEntry.isLive = true;
    liveBlocks++;
  }

  // Store all generated entries
  const entries = [];
  for (const entry of gaps) {
    const key = `schedule:${entry.scheduleId}`;
    await kv.put(key, JSON.stringify(entry));
    entries.push(entry.scheduleId);
  }

  return new Response(JSON.stringify({ totalSlots, gaps, liveBlocks }), { headers: { 'Content-Type': 'application/json' } });
}

// ============================================================================
// handleNowPlaying — Get what should be playing RIGHT NOW (Live TV mode)
// ============================================================================
async function handleNowPlaying(kv, contentKv, url) {
  // Check if live mode is enabled
  const liveRaw = await kv.get('live:enabled');
  const liveState = liveRaw ? JSON.parse(liveRaw) : { enabled: false };

  if (!liveState.enabled) {
    return new Response(JSON.stringify({ liveEnabled: false }), { headers: { 'Content-Type': 'application/json' } });
  }

  const now = new Date();
  const today = formatDate(now);
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Get today's schedule
  const keys = await kv.list({ prefix: `schedule:${today}:` });
  const entries = [];

  for (const key of keys.keys) {
    const raw = await kv.get(key.name);
    if (raw) entries.push(JSON.parse(raw));
  }

  // Find the current program
  entries.sort((a, b) => a.startTime.localeCompare(b.startTime));

  let currentProgram = null;
  let nextProgram = null;

  let lastEndTime = null;
  for (const entry of entries) {
    const start = entry.startTime;
    const endMinutes = Math.floor((entry.duration || 0) / 60);
    const [h, m] = start.split(':').map(Number);
    const end = `${String(h + Math.floor((m + endMinutes) / 60)).padStart(2, '0')}:${String((m + endMinutes) % 60).padStart(2, '0')}`;

    if (currentTime >= start && (currentTime < end || entry.duration > 3600)) {
      // This program is currently airing
      currentProgram = { ...entry, endTime: end, isCurrent: true };
    }

    if (!nextProgram && start > currentTime) {
      nextProgram = { ...entry, isNext: true };
    }

    lastEndTime = end;
  }

  // If no scheduled program is playing right now, find the next one
  if (!currentProgram) {
    // Look for a fill-in or default content
    if (nextProgram) {
      currentProgram = { ...nextProgram, isCurrent: true, isDefault: true };
    } else {
      // No content today — use last program from yesterday or first program
      if (entries.length > 0) {
        currentProgram = { ...entries[0], isCurrent: true, isDefault: true };
      }
    }
  }

  // Get content metadata from content KV
  if (currentProgram && currentProgram.contentId) {
    const contentRaw = await contentKv.get(`content:${currentProgram.contentId}`);
    if (contentRaw) {
      const content = JSON.parse(contentRaw);
      currentProgram.content = content;
    }
  }

  return new Response(JSON.stringify({
    liveEnabled: true,
    currentTime,
    currentProgram,
    nextProgram
  }), { headers: { 'Content-Type': 'application/json' } });
}

// ============================================================================
// handleGetSchedule — Get the full schedule (for Roku UI)
// ============================================================================
async function handleGetSchedule(kv, url) {
  const day = url.searchParams.get('day') || formatDate(new Date());

  const keys = await kv.list({ prefix: `schedule:${day}:` });
  const entries = [];

  for (const key of keys.keys) {
    const raw = await kv.get(key.name);
    if (raw) entries.push(JSON.parse(raw));
  }

  entries.sort((a, b) => a.startTime.localeCompare(b.startTime));

  return new Response(JSON.stringify({ date: day, entries }), { headers: { 'Content-Type': 'application/json' } });
}

// ============================================================================
// handleGetNowPlaying — Simplified "what's playing now" for Roku
// ============================================================================
async function handleGetNowPlaying(env, url) {
  return handleNowPlaying(env.SCHEDULE_KV, env.CHANNEL_KV, url);
}

// ============================================================================
// Build a single schedule entry
// ============================================================================
function buildScheduleEntry(contentId, day, time, title, duration, date, category, priority, isFill = false) {
  const scheduleId = `sched_${formatDate(date)}_${time.replace(':', '')}_${contentId}`;
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const actualDay = day || dayNames[date.getDay()];

  return {
    scheduleId,
    contentId,
    day: actualDay,
    date: formatDate(date),
    startTime: time || '00:00',
    duration: duration || 1800,
    title: title || '',
    category: category || 'general',
    priority: priority || 0,
    isFill: isFill,
    isLive: false,
    created: new Date().toISOString()
  };
}

// ============================================================================
// Find gaps in a day's schedule
// ============================================================================
function findGaps(entries, dayStart, dayEnd) {
  const gaps = [];

  if (entries.length === 0) {
    // No programs — entire day is a gap
    const totalMinutes = (timeToMinutes(dayEnd) - timeToMinutes(dayStart));
    return [{ start: dayStart, end: dayEnd, duration: totalMinutes * 60 }];
  }

  // Gap before first program
  if (entries[0].startTime > dayStart) {
    gaps.push({ start: dayStart, end: entries[0].startTime, duration: (timeToMinutes(entries[0].startTime) - timeToMinutes(dayStart)) * 60 });
  }

  // Gaps between programs
  for (let i = 0; i < entries.length - 1; i++) {
    const endMinutes = Math.floor((entries[i].duration || 0) / 60);
    const [h, m] = entries[i].startTime.split(':').map(Number);
    const programEnd = `${String(h + Math.floor((m + endMinutes) / 60)).padStart(2, '0')}:${String((m + endMinutes) % 60).padStart(2, '0')}`;

    if (entries[i + 1].startTime > programEnd) {
      const gapDur = (timeToMinutes(entries[i + 1].startTime) - timeToMinutes(programEnd)) * 60;
      gaps.push({ start: programEnd, end: entries[i + 1].startTime, duration: gapDur });
    }
  }

  // Gap after last program until dayEnd
  const last = entries[entries.length - 1];
  const lastEndMinutes = Math.floor((last.duration || 0) / 60);
  const [lh, lm] = last.startTime.split(':').map(Number);
  const programEnd = `${String(lh + Math.floor((lm + lastEndMinutes) / 60)).padStart(2, '0')}:${String((lm + lastEndMinutes) % 60).padStart(2, '0')}`;

  if (programEnd < dayEnd) {
    gaps.push({ start: programEnd, end: dayEnd, duration: (timeToMinutes(dayEnd) - timeToMinutes(programEnd)) * 60 });
  }

  return gaps;
}

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}
