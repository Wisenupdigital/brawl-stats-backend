require("dotenv").config();
const express = require("express");
const cors = require("cors");

const { errorHandler } = require("./middleware/errorHandler");
const playersRouter = require("./routes/players");
const { brawlersRouter, rankingsRouter, eventsRouter, clubsRouter } = require("./routes/misc");
const { startSnapshotJob } = require("./jobs/snapshotJob");
const pool = require("./db/pool");

// ─── App ──────────────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3001;

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Autorise les appels sans origin (ex: curl, Postman) en dev
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS bloqué pour : ${origin}`));
  },
  methods: ["GET", "POST", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected", ts: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "error", db: "disconnected" });
  }
});

// ─── Routes API ───────────────────────────────────────────────────────────────
app.use("/api/players",  playersRouter);
app.use("/api/brawlers", brawlersRouter);
app.use("/api/rankings", rankingsRouter);
app.use("/api/events",   eventsRouter);
app.use("/api/clubs",    clubsRouter);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: { status: 404, message: `Route inconnue : ${req.method} ${req.path}` } });
});

// ─── Erreurs ──────────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Démarrage ────────────────────────────────────────────────────────────────
async function start() {
  // Vérifie la connexion DB avant de démarrer
  try {
    await pool.query("SELECT 1");
    console.log("✅ PostgreSQL connecté");
  } catch (err) {
    console.error("❌ Impossible de se connecter à PostgreSQL :", err.message);
    console.error("   → Lance `npm run db:migrate` après avoir configuré DATABASE_URL dans .env");
    process.exit(1);
  }

  // Lance le cron de snapshots automatiques
  startSnapshotJob();

  app.listen(PORT, () => {
    console.log(`\n🚀 Brawl Stats Backend démarré sur http://localhost:${PORT}`);
    console.log(`   Routes disponibles :`);
    console.log(`   GET  /health`);
    console.log(`   GET  /api/players/:tag`);
    console.log(`   GET  /api/players/:tag/history?days=90`);
    console.log(`   GET  /api/players/:tag/battlelog`);
    console.log(`   POST /api/players/:tag/track`);
    console.log(`   GET  /api/brawlers`);
    console.log(`   GET  /api/rankings/:country`);
    console.log(`   GET  /api/events`);
    console.log(`   GET  /api/clubs/:tag\n`);
  });
}

start();
