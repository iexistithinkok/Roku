// ============================================================================
// My Hyperlocal Channel — Cloudflare Worker (Clean)
// ============================================================================
// Serves: Roku catalog, schedule API, and R2 proxy uploads
// ============================================================================

import { handleScheduleApi } from './schedule.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    console.log(`[Worker] ${request.method} ${path}`);

    // === R2 PROXY UPLOAD (browser → Worker → R2) ===
    if (path === "/api/r2/proxy-upload") {
      return await handleProxyUploadRequest(env, request, url);
    }
    if (path === "/api/r2/completed") {
      return await handleR2UploadComplete(env, url);
    }

    // === SCHEDULE ROUTE ===
    if (path.startsWith("/api/schedule")) {
      return await handleScheduleApi(env, url);
    }

    // === CATALOG / SEARCH ===
    if (path === "/api/catalog" || path === "/api/catalog.json") {
      return await handleCatalog(env);
    }
    if (path === "/api/search" || path === "/api/search.json") {
      return await handleSearch(env, url);
    }
    if (path.startsWith("/api/content/")) {
      const id = path.split("/").pop().split("?")[0];
      return await handleContentById(id, env);
    }
    if (path === "/api/categories") {
      return await handleCategories(env);
    }
    if (path === "/api/locations") {
      return await handleLocations(env);
    }
    if (path === "/api/trending") {
      return await handleTrending(env);
    }
    if (path === "/api/feed/latest") {
      const limit = parseInt(url.searchParams.get("limit") || "10");
      return await handleLatest(env, limit);
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }
};

// ============================================================================
// R2 Proxy Upload — receives file from browser, stores in R2
// ============================================================================
async function handleProxyUploadRequest(env, request, url) {
  const bucket = env.VIDEOS_BUCKET;
  const key = url.searchParams.get("key");
  const contentType = url.searchParams.get("contentType") || "video/mp4";

  if (!key) return new Response(JSON.stringify({ error: "key required" }), { status: 400, headers: { "Content-Type": "application/json" } });

  const body = await request.arrayBuffer();
  await bucket.put(key, body, { httpMetadata: { contentType } });

  return new Response(JSON.stringify({ success: true, key, size: body.byteLength }), { headers: { "Content-Type": "application/json" } });
}

// ============================================================================
// R2 Upload Complete — mark metadata in KV
// ============================================================================
async function handleR2UploadComplete(env, url) {
  const contentId = url.searchParams.get("contentId");
  const r2Key = url.searchParams.get("r2Key");
  const title = url.searchParams.get("title") || "Untitled";
  const description = url.searchParams.get("description") || "";
  const category = url.searchParams.get("category") || "general";
  const location = url.searchParams.get("location") || "";
  const keywords = url.searchParams.get("keywords") || "";
  const date = url.searchParams.get("date") || formatDate(new Date());
  const duration = parseInt(url.searchParams.get("duration") || "0");

  const contentData = {
    id: contentId, title, description,
    posterUrl: "", streamUrl: `https://r2.video.cdn/${r2Key}`,
    streamFormat: "mp4", contentType: "video", length: duration,
    category, location, date,
    keywords: keywords.split(",").map(k => k.trim()),
    r2Key, isNew: true
  };

  await env.CHANNEL_KV.put(`content:${contentId}`, JSON.stringify(contentData));
  return new Response(JSON.stringify({ success: true, contentId }), { headers: { "Content-Type": "application/json" } });
}

// ============================================================================
// Catalog & Search (existing handlers)
// ============================================================================
async function handleCatalog(env) {
  const kv = env.CHANNEL_KV;
  const keys = await kv.list({ prefix: "content:" });
  const items = [];
  for (const key of keys.keys) {
    const raw = await kv.get(key.name);
    if (raw) items.push(JSON.parse(raw));
  }
  items.sort((a, b) => new Date(b.date || "1970").getTime() - new Date(a.date || "1970").getTime());
  return new Response(JSON.stringify({ catalog: { version: "1.0.0", content: items.map(buildRokuContentNode) } }), { headers: { "Content-Type": "application/json" } });
}

async function handleSearch(env, url) {
  const query = url.searchParams.get("q") || "";
  const kv = env.CHANNEL_KV;
  const keys = await kv.list({ prefix: "content:" });
  const qLower = query.toLowerCase().trim();
  const results = [];
  for (const key of keys.keys) {
    const raw = await kv.get(key.name);
    if (raw) {
      const item = JSON.parse(raw);
      const searchable = [item.title || "", item.description || "", (item.keywords || []).join(" "), item.location || ""].join(" ").toLowerCase();
      if (searchable.includes(qLower)) results.push(buildRokuContentNode(item));
    }
  }
  return new Response(JSON.stringify({ results }), { headers: { "Content-Type": "application/json" } });
}

async function handleContentById(id, env) {
  const kv = env.CHANNEL_KV;
  const raw = await kv.get(`content:${id}`);
  if (!raw) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  return new Response(JSON.stringify(buildRokuContentNode(JSON.parse(raw))), { headers: { "Content-Type": "application/json" } });
}

async function handleCategories(env) {
  const kv = env.CHANNEL_KV;
  const keys = await kv.list({ prefix: "content:" });
  const cats = new Set();
  for (const key of keys.keys) {
    const raw = await kv.get(key.name);
    if (raw) { const item = JSON.parse(raw); if (item.category) cats.add(item.category); }
  }
  return new Response(JSON.stringify({ categories: Array.from(cats).sort() }), { headers: { "Content-Type": "application/json" } });
}

async function handleLocations(env) {
  const kv = env.CHANNEL_KV;
  const keys = await kv.list({ prefix: "content:" });
  const locs = new Map();
  for (const key of keys.keys) {
    const raw = await kv.get(key.name);
    if (raw) { const item = JSON.parse(raw); if (item.location) locs.set(item.location, (locs.get(item.location) || 0) + 1); }
  }
  return new Response(JSON.stringify({ locations: Array.from(locs.entries()).map(([n, c]) => ({ name: n, count: c })).sort((a, b) => b.count - a.count) }), { headers: { "Content-Type": "application/json" } });
}

async function handleTrending(env) {
  const kv = env.CHANNEL_KV;
  const keys = await kv.list({ prefix: "content:" });
  const items = [];
  for (const key of keys.keys) {
    const raw = await kv.get(key.name);
    if (raw) items.push(JSON.parse(raw));
  }
  items.sort((a, b) => new Date(b.date || "1970").getTime() - new Date(a.date || "1970").getTime());
  return new Response(JSON.stringify({ content: items.slice(0, 10).map(buildRokuContentNode) }), { headers: { "Content-Type": "application/json" } });
}

async function handleLatest(env, limit) {
  const kv = env.CHANNEL_KV;
  const keys = await kv.list({ prefix: "content:" });
  const items = [];
  for (const key of keys.keys) {
    const raw = await kv.get(key.name);
    if (raw) items.push(JSON.parse(raw));
  }
  items.sort((a, b) => new Date(b.date || "1970").getTime() - new Date(a.date || "1970").getTime());
  return new Response(JSON.stringify({ content: items.slice(0, Math.min(limit, 50)).map(buildRokuContentNode) }), { headers: { "Content-Type": "application/json" } });
}

function buildRokuContentNode(item) {
  return {
    id: item.id || "", title: item.title || "Untitled", description: item.description || "",
    posterUrl: item.posterUrl || "", streamUrl: item.streamUrl || "",
    streamFormat: item.streamFormat || "mp4", contentType: "video",
    length: parseInt(item.duration || "0"), keywords: item.keywords || [],
    category: item.category || "other", location: item.location || "",
    date: item.date || ""
  };
}
