const fetch = require("node-fetch");
const pool = require("../db/pool");

const BASE_URL = "https://api.brawlstars.com/v1";

// ─── Fetch générique vers l'API Brawl Stars ──────────────────────────────────
async function brawlFetch(endpoint) {
  const API_KEY = process.env.BRAWL_API_KEY; // ← lu à chaque requête
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Brawl API ${res.status}: ${body}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

// ─── Cache helpers ────────────────────────────────────────────────────────────
async function getCache(key) {
  try {
    const { rows } = await pool.query(
      `SELECT data, cached_at, ttl_seconds FROM api_cache WHERE cache_key = $1`,
      [key]
    );
    if (!rows.length) return null;
    const { data, cached_at, ttl_seconds } = rows[0];
    const age = (Date.now() - new Date(cached_at).getTime()) / 1000;
    if (age > ttl_seconds) return null; // expiré
    return data;
  } catch {
    return null; // cache KO → on continue sans
  }
}

async function setCache(key, data, ttl = 300) {
  try {
    await pool.query(
      `INSERT INTO api_cache (cache_key, data, ttl_seconds)
       VALUES ($1, $2, $3)
       ON CONFLICT (cache_key) DO UPDATE
       SET data = $2, cached_at = NOW(), ttl_seconds = $3`,
      [key, JSON.stringify(data), ttl]
    );
  } catch { /* silencieux */ }
}

// ─── Services publics ─────────────────────────────────────────────────────────

/** Profil complet d'un joueur */
async function getPlayer(tag) {
  const encoded = encodeURIComponent(`#${tag.replace(/^#/, "")}`);
  const cacheKey = `player:${tag}`;

  const cached = await getCache(cacheKey);
  if (cached) return { ...cached, _cached: true };

  const data = await brawlFetch(`/players/${encoded}`);
  await setCache(cacheKey, data, 120); // 2 min
  return data;
}

/** Brawlers d'un joueur */
async function getPlayerBrawlers(tag) {
  const player = await getPlayer(tag);
  return player.brawlers || [];
}

/** Historique de bataille */
async function getBattleLog(tag) {
  const encoded = encodeURIComponent(`#${tag.replace(/^#/, "")}`);
  const cacheKey = `battlelog:${tag}`;

  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const data = await brawlFetch(`/players/${encoded}/battlelog`);
  await setCache(cacheKey, data, 60); // 1 min (données fraîches)
  return data;
}

/** Catalogue de tous les brawlers */
async function getBrawlers() {
  const cached = await getCache("brawlers:all");
  if (cached) return cached;

  const data = await brawlFetch("/brawlers?limit=100");
  await setCache(data, "brawlers:all", 3600); // 1h
  await setCache("brawlers:all", data, 3600);
  return data;
}

/** Classement mondial ou par pays */
async function getRankings(country = "global") {
  const cacheKey = `rankings:${country}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const endpoint = country === "global"
    ? "/rankings/global/players?limit=200"
    : `/rankings/${country}/players?limit=200`;

  const data = await brawlFetch(endpoint);
  await setCache(cacheKey, data, 300); // 5 min
  return data;
}

/** Rotation des événements */
async function getEvents() {
  const cached = await getCache("events:rotation");
  if (cached) return cached;

  const data = await brawlFetch("/events/rotation");
  await setCache("events:rotation", data, 900); // 15 min
  return data;
}

/** Infos d'un club */
async function getClub(tag) {
  const encoded = encodeURIComponent(`#${tag.replace(/^#/, "")}`);
  const cacheKey = `club:${tag}`;

  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const data = await brawlFetch(`/clubs/${encoded}`);
  await setCache(cacheKey, data, 300);
  return data;
}

module.exports = { getPlayer, getPlayerBrawlers, getBattleLog, getBrawlers, getRankings, getEvents, getClub };
