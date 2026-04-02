require("dotenv").config();
const pool = require("./pool");

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("🔧 Lancement des migrations...");

    await client.query(`
      -- Table des joueurs suivis
      CREATE TABLE IF NOT EXISTS tracked_players (
        id          SERIAL PRIMARY KEY,
        tag         VARCHAR(20) UNIQUE NOT NULL,   -- ex: #ABC123
        name        VARCHAR(100),
        added_at    TIMESTAMPTZ DEFAULT NOW(),
        last_seen   TIMESTAMPTZ DEFAULT NOW()
      );

      -- Historique des snapshots de trophées (une ligne par joueur par snapshot)
      CREATE TABLE IF NOT EXISTS trophy_snapshots (
        id              SERIAL PRIMARY KEY,
        player_tag      VARCHAR(20) NOT NULL REFERENCES tracked_players(tag) ON DELETE CASCADE,
        trophies        INTEGER NOT NULL,
        highest_trophies INTEGER,
        exp_level       INTEGER,
        snapshot_at     TIMESTAMPTZ DEFAULT NOW()
      );

      -- Index pour les requêtes fréquentes
      CREATE INDEX IF NOT EXISTS idx_snapshots_tag_time
        ON trophy_snapshots (player_tag, snapshot_at DESC);

      -- Cache des réponses API (évite de re-fetcher si déjà frais)
      CREATE TABLE IF NOT EXISTS api_cache (
        cache_key   VARCHAR(255) PRIMARY KEY,
        data        JSONB NOT NULL,
        cached_at   TIMESTAMPTZ DEFAULT NOW(),
        ttl_seconds INTEGER DEFAULT 300
      );
    `);

    console.log("✅ Migration terminée avec succès.");
  } catch (err) {
    console.error("❌ Erreur migration :", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
