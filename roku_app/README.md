# Hyperlocal Roku Channel — Full Deployment Guide

A complete Roku channel backed by Cloudflare for locally-created, hyperlocal video content.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        YOUR LOCAL MACHINE                           │
│                                                                     │
│  Your Videos  ──upload──▶  Cloudflare R2 (storage, no egress fees)   │
│                         ──upload──▶  Cloudflare Stream (transcode+CDN) │
│                         ──manage──▶  Cloudflare KV (content metadata)  │
│                         ──hosted──▶  Cloudflare Worker (API)           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                          HTTPS (Cloudflare CDN)
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  YOUR ROKU CHANNEL (on the TV)                                      │
│                                                                     │
│  Roku App (our BrightScript code)                                   │
│    ├─ MainScene.brs  ──fetch──▶ /api/catalog                        │
│    ├─ Utilities.brs  ──search──▶ /api/search                        │
│    └─ VideoPlayer  ──play  ──▶ Cloudflare Stream HLS manifest        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## What You Get

| Layer | Cloudflare | Purpose |
|-------|------------|---------|
| **Storage** | R2 (free, no egress) | Store video files |
| **Transcoding** | Stream (starts free) | Auto-transcode to HLS/MP4 |
| **Delivery** | Cloudflare CDN (global) | Fast playback anywhere |
| **API** | Worker (free tier) | Roku catalog + search |
| **Metadata** | KV (free tier) | Video info, categories, locations |

| Layer | Roku | Purpose |
|-------|------|---------|
| **UI** | SceneGraph (XML) | RowList grid, navigation |
| **Logic** | BrightScript | API calls, playback |
| **Components** | Custom | ContentCard, utilities |

---

## Part 1: Set Up Your Cloudflare Stack

### Step 1: Create Your Cloudflare Account

1. Go to [cloudflare.com](https://cloudflare.com) and sign up (free)
2. Add your domain (or use a `.workers.dev` subdomain — free)

### Step 2: Install Wrangler (Cloudflare CLI)

```bash
npm install -g wrangler
wrangler login  # Authenticate with Cloudflare
```

### Step 3: Create an R2 Bucket for Videos

```bash
# Create the bucket
cloudflare r2 bucket create my-channels-videos

# List buckets (verify it was created)
cloudflare r2 bucket list
```

### Step 4: Create a KV Namespace for Metadata

```bash
# Create a KV namespace
cloudflare kv namespace create channel_metadata

# Note the OUTPUT_ID — you'll put this in wrangler.toml
```

### Step 5: Upload Your Videos

#### Option A: Direct to R2 (simplest, works if you don't need transcoding)

```bash
# Upload a video file to R2
cloudflare r2 object upload my-channels-videos news/downtown-festival.mp4 \
  ~/videos/downtown-festival.mp4

# Upload a poster/thumbnail
cloudflare r2 object upload my-channels-videos posters/festival.jpg \
  ~/images/festival-poster.jpg
```

#### Option B: Upload to Cloudflare Stream (recommended for Roku)

```bash
# Upload video to Stream (auto-transcodes to HLS + MP4 variants)
curl -X POST "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/videos" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -F "file=@~/videos/downtown-festival.mp4"

# Response includes a video ID: {"result":{"id":"abc123def456",...}}

# Get the manifest URL
curl "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/videos/abc123def456" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Response includes "passthroughStreams.url" — that's your HLS link
# Use this URL in your Roku channel:
# https://watchcloud.net/abc123def456/master.m3u8
```

### Step 6: Add Content Metadata to KV

```bash
# Upload your wrangler.toml and deploy the Worker first (see Part 2)
# Then populate metadata:

wrangler kv key put "content:001" --json '{
  "id": "001",
  "title": "Downtown Street Festival 2025",
  "description": "Annual street festival on Main Street featuring local vendors, live music, and arts and crafts. Coverage of the entire event.",
  "posterUrl": "https://my-channels-videos.r2.cloudflarestorage.com/posters/festival.jpg",
  "streamUrl": "https://watchcloud.net/abc123def456/master.m3u8",
  "streamFormat": "hls",
  "contentType": "video",
  "duration": 1800,
  "category": "events",
  "location": "Downtown District",
  "date": "2025-11-01",
  "keywords": ["festival", "downtown", "main street", "community", "live music"],
  "isNew": true
}'

wrangler kv key put "content:002" --json '{
  "id": "002",
  "title": "City Council Meeting — Nov 5",
  "description": "Full coverage of the November city council meeting including zoning ordinance discussions and public comment period.",
  "streamUrl": "https://watchcloud.net/xyz789master.m3u8",
  "duration": 7200,
  "category": "news",
  "location": "City Hall",
  "date": "2025-11-05",
  "keywords": ["city council", "zoning", "government", "public meeting", "local news"]
}'

# You can batch-import using wrangler kv bulk:
# 1. Create a JSON file: metadata.json
# 2. Run: wrangler kv bulk put
```

**Example `metadata.json` for bulk import:**

```json
[
  {
    "key": "content:001",
    "value": "{\"id\":\"001\",\"title\":\"Downtown Street Festival 2025\",\"description\":\"Annual street festival on Main Street.\",\"posterUrl\":\"https://my-channels-videos.r2.cloudflarestorage.com/posters/festival.jpg\",\"streamUrl\":\"https://watchcloud.net/abc123/master.m3u8\",\"duration\":1800,\"category\":\"events\",\"location\":\"Downtown District\",\"date\":\"2025-11-01\",\"keywords\":[\"festival\",\"downtown\",\"main street\"]}"
  },
  {
    "key": "content:002",
    "value": "{\"id\":\"002\",\"title\":\"City Council Meeting\",\"description\":\"Full council meeting coverage.\",\"streamUrl\":\"https://watchcloud.net/xyz789/master.m3u8\",\"duration\":7200,\"category\":\"news\",\"location\":\"City Hall\",\"date\":\"2025-11-05\",\"keywords\":[\"council\",\"zoning\",\"government\"]}"
  }
]
```

```bash
wrangler kv bulk put metadata.json
```

### Step 7: Create a Poster Image

```bash
# Recommended size: 600×315 (for 1080p Roku) or 1280×720 (for 4K)
# Place in roku_app/images/icon.png
```

---

## Part 2: Deploy the Cloudflare Worker

```bash
cd roku_app/cloudflare-worker

# Edit wrangler.toml — replace your actual IDs
#   - your-kv-namespace-id (from Step 3 output)
#   - your-roku-channel-guid (from your Roku Developer dashboard)

# Deploy the Worker
wrangler deploy

# Verify it's running
curl https://my-hyperlocal-channel.your-subdomain.workers.dev/api/catalog
# Should return your catalog JSON
```

---

## Part 3: Deploy to Your Roku

### Step 1: Set Up Your Roku Developer Account

1. Go to [dev.roku.com](https://developer.roku.com)
2. Sign up (free)
3. Install the **Roku Developer** app on your Roku device
4. Get your Roku's IP address:
   ```
   Settings → System → About → Network → IP address
   ```

### Step 2: Edit Your Manifest

```bash
cd roku_app

# Edit manifest — update these:
#   title=My Hyperlocal Channel
#   version=1.0.0
#   debug=yes  ← keep this for development
```

### Step 3: Upload to Your Roku

```bash
# Upload your roku_app folder to the emulator
curl -F "image=@." http://YOUR_ROKU_IP/plugin/load?password=rokudev

# Or use the Developer app's built-in upload
```

### Step 4: Update the Worker URL

In `roku_app/components/MainScene.brs`, line ~30:

```brightscript
' Replace with your actual Worker URL:
m.apiBaseUrl = "https://my-hyperlocal-channel.your-subdomain.workers.dev"
```

### Step 5: Test on Your Roku

1. Launch your channel from the Roku home screen
2. It should fetch the catalog from your Cloudflare Worker
3. Navigate with the remote — use the arrow keys
4. Press OK to play a video

### Step 6: Debug

```bash
# View Roku logs in real-time
curl http://YOUR_ROKU_IP/plugin/log

# Or use the Developer app's debug console
```

---

## Part 4: Hyperlocal Strategy

This setup is designed for **hyperlocal programming** — content specific to small areas.

### Content Organization

```
metadata.json entries:
├── content:001  → "Downtown District" → events
├── content:002  → "City Hall"         → news
├── content:003  → "Riverside Park"    → community
├── content:004  → "School District 7" → education
└── content:005  → "Old Town"          → history
```

### Roku UI Rows (Suggested Layout)

```
[ Latest ]  [ Downtown District ]  [ City Hall ]  [ Parks & Rec ]
  row 0         row 1 (location)       row 2 (location)  row 3 (category)

[ News ]  [ Community ]  [ Interviews ]  [ Search Bar ]
  row 4     row 5           row 6          (keyboard)
```

### How to Make It Hyperlocal

1. **Geo-tag everything** — use the `location` field for neighborhood/district
2. **Build location-based rows** — use `/api/feed/location/:name` 
3. **Let viewers filter** — add a "Browse by Location" screen
4. **Submit community content** — add a submission feature (Worker endpoint for POST)
5. **Multi-channel setup** — one Worker, many channels by location:
   - `channel-downtown` → `/api/feed/location/Downtown+District`
   - `channel-westside` → `/api/feed/location/Westside`
   - `channel-suburbs` → `/api/feed/location/Suburbs`

### Example: Multi-Channel Setup

Each Roku channel is just a different Roku configuration pointing to the same Worker:

```
Channel: "Downtown Live"
  → Worker URL: https://my-hyperlocal-channel.your-subdomain.workers.dev
  → Roku loads catalog
  → /api/feed/location/Downtown+District filters the same KV data

Channel: "Westside Channel"  
  → Same Worker URL
  → /api/feed/location/Westside filters different subset

Same backend. Different Roku UI configurations.
```

---

## Cost Breakdown (Free Tiers)

| Service | Free Tier | What You Get |
|---------|-----------|--------------|
| **R2 Storage** | 10 GB | ~50-100 videos (100MB-200MB each) |
| **Cloudflare Stream** | 10,000 min/month | ~166 hours of video, auto-transcoded |
| **Cloudflare Worker** | 100,000 requests/day | Handles Roku catalog + search queries |
| **Cloudflare KV** | 10 GB stored | Thousands of metadata entries |
| **Cloudflare CDN** | Unlimited bandwidth | Global video delivery |
| **Roku Developer** | Free | Publish to Roku Channel Store |

**Estimated monthly cost: $0** (until you exceed free tiers)

---

## Project Files

```
roku_app/
├── manifest                          # App metadata
├── README.md                         # This file
├── BRIGHTSCRIPT_REFERENCE.md         # Language cheat sheet
│
├── components/
│   ├── main.brs                      # Entry point
│   ├── MainScene.xml                 # UI layout (XML SceneGraph)
│   ├── MainScene.brs                 # App logic + API connection
│   │
│   ├── custom_components/
│   │   ├── ContentCard.xml           # Reusable card component
│   │   └── ContentCard.brs           # Card behavior (focus effects)
│   │
│   └── utils/
│       └── Utilities.brs             # Cloudflare API helpers
│
├── cloudflare-worker/
│   ├── wrangler.toml                 # Worker config (fill in your IDs)
│   └── src/
│       └── index.js                  # Full Worker API (Roku catalog + search)
│
├── images/                           # App icon + posters
└── resources/
    └── en_us/
        └── strings.xml               # Localizable text
```

---

## Quick Commands Reference

```bash
# Cloudflare — R2 (video storage)
cloudflare r2 bucket create <name>
cloudflare r2 object upload <bucket> <path> <local-file>
cloudflare r2 object download <bucket> <path> <local-file>

# Cloudflare — Stream (transcode + CDN)
curl -X POST "https://api.cloudflare.com/.../videos" \
  -F "file=@video.mp4"
curl "https://api.cloudflare.com/.../videos/<id>" \
  -H "Authorization: Bearer <TOKEN>"

# Cloudflare — KV (metadata)
wrangler kv key put "content:001" --json '{"key":"value"}'
wrangler kv key get "content:001"
wrangler kv key delete "content:001"

# Cloudflare — Worker (API)
wrangler deploy                  # Deploy Worker
wrangler tail                   # View live logs

# Roku — Upload and test
curl -F "image=@." http://<roku-ip>/plugin/load?password=rokudev
curl http://<roku-ip>/plugin/log  # View logs
```

---

## Next Steps to Get Live

1. [ ] Create Cloudflare account → [cloudflare.com](https://cloudflare.com)
2. [ ] Create R2 bucket + KV namespace (CLI commands above)
3. [ ] Upload your first 3-5 videos to Stream
4. [ ] Add metadata to KV (use the examples above)
5. [ ] Deploy the Worker (`wrangler deploy`)
6. [ ] Update `MainScene.brs` with your Worker URL
7. [ ] Upload to Roku emulator and test
8. [ ] Add more channels by location (optional)
9. [ ] Publish to Roku Channel Store (free)

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Roku can't reach Worker | Check `m.apiBaseUrl` in MainScene.brs; ensure Worker is deployed |
| Videos won't play | Verify Stream manifest returns valid HLS; Roku needs H.264 video |
| No content shows | Check KV has entries; curl `/api/catalog` to debug |
| Search returns nothing | Verify keyword fields exist in metadata |
| Roku log shows "error" | Check curl response: `curl http://<roku-ip>/plugin/log` |
