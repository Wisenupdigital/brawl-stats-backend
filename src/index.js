require("dotenv").config();
const express = require("express");
const cors = require("cors");

const { errorHandler } = require("./middleware/errorHandler");
const playersRouter = require("./routes/players");
const { brawlersRouter, rankingsRouter, eventsRouter, clubsRouter } = require("./routes/misc");
const { startSnapshotJob } = require("./jobs/snapshotJob");
const pool = require("./db/pool");

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin))
      return cb(null, true);
    cb(new Error(`CORS bloqué pour : ${origin}`));
  },
  methods: ["GET", "POST", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

app.get("/myip", async (req, res) => {
  const r = await fetch("https://api.ipify.org?format=json");
  const d = await r.json();
  res.json(d);
});

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected", ts: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "error", db: "disconnected" });
  }
});

app.use("/api/players",  playersRouter);
app.use("/api/brawlers", brawlersRouter);
app.use("/api/rankings", rankingsRouter);
app.use("/api/events",   eventsRouter);
app.use("/api/clubs",    clubsRouter);

app.use((req, res) => {
  res.status(404).json({ error: { status: 404, message: `Route inconnue : ${req.method} ${req.path}` } });
});

app.use(errorHandler);

// ─── Whitelist automatique Supercell ─────────────────────────────────────────
async function updateSupercellWhitelist() {
  const email    = process.env.SUPERCELL_EMAIL;
  const password = process.env.SUPERCELL_PASSWORD;
  const keyName  = process.env.SUPERCELL_KEY_NAME;

  if (!email || !password || !keyName) {
    console.log("⚠️  SUPERCELL_EMAIL/PASSWORD/KEY_NAME manquants → whitelist ignorée");
    return;
  }

  try {
    // 1. IP actuelle
    const ipRes = await fetch("https://api.ipify.org?format=json");
    const { ip } = await ipRes.json();
    console.log(`🌐 IP actuelle : ${ip}`);

    // 2. Login Supercell
    const loginRes = await fetch("https://developer.brawlstars.com/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const loginData = await loginRes.json();
    if (!loginData.status?.message?.includes("ok")) {
      throw new Error(`Login échoué : ${JSON.stringify(loginData)}`);
    }
    const cookie = loginRes.headers.get("set-cookie");

    // 3. Liste des clés
    const keysRes = await fetch("https://developer.brawlstars.com/api/apikey/list", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({}),
    });
    const { keys } = await keysRes.json();
    const key = keys?.find(k => k.name === keyName);
    if (!key) throw new Error(`Clé "${keyName}" introuvable parmi : ${keys?.map(k => k.name).join(", ")}`);

    // 4. Mise à jour avec la nouvelle IP
    const updateRes = await fetch("https://developer.brawlstars.com/api/apikey/update", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        id:          key.id,
        name:        key.name,
        description: key.description || "",
        cidrRanges:  [ip],
        scopes:      key.scopes,
      }),
    });
    const updateData = await updateRes.json();
    console.log(`✅ Whitelist mise à jour → ${ip}`, updateData?.status?.message || "");
  } catch (err) {
    console.error("❌ Whitelist update échouée :", err.message);
  }
}

// ─── Démarrage ────────────────────────────────────────────────────────────────
async function start() {
  try {
    await pool.query("SELECT 1");
    console.log("✅ PostgreSQL connecté");
  } catch (err) {
    console.error("❌ PostgreSQL introuvable :", err.message);
    process.exit(1);
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tracked_players (
        id SERIAL PRIMARY KEY,
        tag VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(100),
        added_at TIMESTAMPTZ DEFAULT NOW(),
        last_seen TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS trophy_snapshots (
        id SERIAL PRIMARY KEY,
        player_tag VARCHAR(20) NOT NULL REFERENCES tracked_players(tag) ON DELETE CASCADE,
        trophies INTEGER NOT NULL,
        highest_trophies INTEGER,
        exp_level INTEGER,
        snapshot_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_snapshots_tag_time
        ON trophy_snapshots (player_tag, snapshot_at DESC);
      CREATE TABLE IF NOT EXISTS api_cache (
        cache_key VARCHAR(255) PRIMARY KEY,
        data JSONB NOT NULL,
        cached_at TIMESTAMPTZ DEFAULT NOW(),
        ttl_seconds INTEGER DEFAULT 300
      );
    `);
    console.log("✅ Tables créées");
  } catch (err) {
    console.error("❌ Migration échouée :", err.message);
  }

  // Whitelist au démarrage — non bloquant
  await updateSupercellWhitelist();

  startSnapshotJob();
  app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  });
}

start();
