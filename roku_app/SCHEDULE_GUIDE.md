# Hyperlocal Channel — Schedule Quick Guide

## The Big Picture

```
You edit the schedule  →  Cloudflare Worker stores it  →  Roku reads it  →  TV plays it
        │                         │                           │              │
   CLI or Web UI          Cloudflare KV (fast)         Roku Live TV        Local TV
```

**You control what airs. The Roku channel follows.** No app redeploy needed.

---

## Three Ways to Manage Your Schedule

### 1. Schedule Editor Web UI (visual)

Open `roku_app/schedule-editor/schedule-editor.html` in a browser.

Update the Worker URL at the top, then:
- **Weekly Schedule tab** — see your entire week at a glance
- **Add Program** — pick content, set day/time, make it recurring
- **Content Library** — see what videos are available
- **Export/Import** — backup or transfer schedules

### 2. Command Line (fast, scriptable)

```bash
cd roku_app/schedule-editor

# Add a program
node schedule-cli.js add 001 --day Monday --time 18:00 --title "Evening News" --weeks 12

# Add daily recurring
node schedule-cli.js add 003 --time 07:00 --title "Community Hour" --repeat daily --weeks 4

# View today's schedule
node schedule-cli.js list --today

# View a specific week
node schedule-cli.js list --date 2025-11-15

# Remove a program
node schedule-cli.js remove sched_2025-11-15_1800_001

# Enable live TV mode on the Roku
node schedule-cli.js set-live on

# Export full schedule
node schedule-cli.js export schedule-nov.json

# Generate a full week (auto-fill gaps)
node schedule-cli.js generate-weekly
```

### 3. Seed Script (one-time setup)

```bash
export WORKER_URL="https://your-worker.workers.dev"
node seed-schedule.js
```

This creates a realistic full-week schedule with:
- Morning news at 6 AM (daily)
- Community programs midday (with live "Local Way of Life" block)
- Evening news + specialty shows
- Weekend special programming

---

## What Happens on the Roku

When a viewer launches your channel, they see TWO modes:

### 📺 Live TV Mode (default when enabled)
1. Roku asks: "What's playing NOW?" → `/api/schedule?action=now-playing`
2. Worker checks today's schedule, finds the current program
3. Roku plays that video via HLS (from Cloudflare Stream)
4. When it ends, Roku auto-loads the NEXT program in the schedule
5. "Now Playing" + "Next Up" overlays show on screen
6. Clock in the corner shows current time

### 📚 On-Demand Mode (when live TV is off)
1. Roku asks for the catalog → `/api/catalog`
2. Shows all your videos in a browsable grid
3. Viewer picks what to watch

---

## Schedule Data Structure (in Cloudflare KV)

```json
{
  "scheduleId": "sched_2025-11-15_1800_001",
  "contentId": "001",
  "day": "Monday",
  "date": "2025-11-15",
  "startTime": "18:00",
  "duration": 1800,
  "title": "Evening News",
  "category": "news",
  "priority": 0,
  "isFill": false,
  "isLive": false,
  "created": "2025-11-01T12:00:00.000Z"
}
```

---

## Schedule Editor — UI Tabs

| Tab | What it does |
|-----|-------------|
| **Weekly Schedule** | Color-coded view of your full week, with Edit/Delete per program |
| **Add Program** | Form: pick content, day, time, duration, title, category, priority, repeat frequency |
| **Content Library** | Your video library (from Cloudflare KV), shows what's available to schedule |
| **Export/Import** | Backup schedules to JSON files, restore them anywhere |

---

## Live TV Mode Toggle

```bash
# Enable (Roku follows schedule)
node schedule-cli.js set-live on

# Disable (Roku shows on-demand catalog)
node schedule-cli.js set-live off
```

When **ON**:
- The schedule MUST have programs covering the hours you want the channel to air
- Use `generate-weekly` to auto-fill gaps with fill-in content
- Set `isLive: true` on programs that are actual live events (e.g., "Town Council Meeting")

When **OFF**:
- Viewers browse your video library like YouTube
- No schedule enforcement

---

## Typical Weekly Pattern (Example)

```
MONDAY                    TUESDAY                  WEDNESDAY                  FRIDAY                  SATURDAY                  SUNDAY
06:00  Morning News       06:00  Morning News     06:00  Morning News     06:00  Morning News     07:00  Weekend Guide     08:00  Sunday News
06:30  Weather Brief      06:30  Weather Brief    06:30  Nature Preview   06:30  Weather Brief    07:30  Nature Walks      08:30  Heritage
07:00  Youth Spotlight    07:00  Business Week    07:00  Youth Spot.      07:00  Business Week    08:00  Local Business    09:00  Youth Spot.
07:30  Community Hour     07:30  Community Hr.    07:30  Business Week    07:30  Food Trail       09:30  Local Way of Life 09:30  Local Way of Life
08:00  Business Profile   08:00  Heritage         08:00  Community Hour   08:00  Community Hour   12:00  Local Way of Life 12:00  Sunday Community
12:00  Local Way of Life  12:00  Local Way of Life 12:00  Local Way of Life 12:00  Local Way of Life 18:00  Weekend Wrap-Up  18:00  Sunday Talk
18:00  Evening News       18:00  Evening News     18:00  Evening News     18:00  Fri. News          18:00  Friday Night
18:30  Mayor Interview    18:30  Food Trail       18:30  Mayor Interview  18:30  Sports           18:00  Community Hour
```

**Key design choices:**
- 6 AM start — early risers (parents, shift workers)
- 12 PM live block — "Community Way of Life" as flagship (broadcast live)
- 6 PM news — prime viewing
- 6:30 specialty — different show each night (news, sports, food, culture)
- Weekends — longer-form, community events

---

## Hyperlocal Tips

1. **One Worker, many channels** — Point different Roku channel configurations at different location filters:
   ```
   Downtown Channel  → /api/feed/location/Downtown+District
   Westside Channel  → /api/feed/location/Westside
   Suburbs Channel   → /api/feed/location/Suburbs
   ```

2. **Live events** — Mark them `isLive: true`. Roku shows a "LIVE" badge. Schedule them a few hours ahead.

3. **Fill-in content** — Use `generate-weekly` to auto-fill gaps with recycled content.

4. **Breaking news** — Add a program to schedule CLI with today's date and an early time. It overrides everything.

5. **Weekly recurring** — Most shows are weekly. Set `--repeat weekly --weeks 12` and you're set for 3 months.

6. **Daily recurring** — News, weather, and briefs should be `--repeat daily`.

---

## Common Commands Cheat Sheet

```bash
# Set your Worker URL
export WORKER_URL="https://your-worker.workers.dev"

# Add a one-time program
node schedule-cli.js add 005 --day Thursday --time 18:30 --title "Mayor Interview"

# Make it recurring (every Thursday for 8 weeks)
node schedule-cli.js add 005 --day Thursday --time 18:30 --title "Mayor Interview" --repeat weekly --weeks 8

# Make it daily (every day for 2 weeks)
node schedule-cli.js add 001 --time 06:00 --title "Morning News" --repeat daily --weeks 2

# View today's schedule
node schedule-cli.js list --today

# View next week
node schedule-cli.js list --date 2025-11-22

# Enable live TV
node schedule-cli.js set-live on

# Fill gaps with fill-in content
node schedule-cli.js generate-weekly

# Export for backup
node schedule-cli.js export my-schedule.json

# Import from backup
# (Edit the JSON, then use the Import tab in the web UI)
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Roku says "No content" | Check KV has entries: `wrangler kv key list --namespace <id>` |
| Wrong videos playing | Verify `contentId` matches your Stream video ID |
| Schedule not updating | Confirm `WORKER_URL` matches your deployed Worker |
| Live mode not working | Run `node schedule-cli.js set-live on` first |
| Programs missing from schedule | Check date format (YYYY-MM-DD) and day name (exact match) |
| Web UI not loading | Make sure Worker is deployed: `wrangler deploy` |
