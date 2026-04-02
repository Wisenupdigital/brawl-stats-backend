const pool = require("../db/pool");
const { getPlayer } = require("./brawlService");

/**
 * Enregistre ou met à jour un joueur dans la table tracked_players,
 * puis insère un snapshot de ses trophées actuels.
 */
async function snapshotPlayer(tag) {
  const cleanTag = tag.replace(/^#/, "").toUpperCase();

  // 1. Récupère le profil live
  const player = await getPlayer(cleanTag);

  // 2. Upsert du joueur suivi
  await pool.query(
    `INSERT INTO tracked_players (tag, name, last_seen)
     VALUES ($1, $2, NOW())
     ON CONFLICT (tag) DO UPDATE
     SET name = $2, last_seen = NOW()`,
    [cleanTag, player.name]
  );

  // 3. Insère le snapshot
  await pool.query(
    `INSERT INTO trophy_snapshots (player_tag, trophies, highest_trophies, exp_level)
     VALUES ($1, $2, $3, $4)`,
    [cleanTag, player.trophies, player.highestTrophies, player.expLevel]
  );

  console.log(`📸 Snapshot enregistré : ${player.name} (${cleanTag}) → ${player.trophies} trophées`);
  return player;
}

/**
 * Retourne l'historique des snapshots d'un joueur,
 * avec un point par jour (le dernier de la journée).
 */
async function getTrophyHistory(tag, days = 90) {
  const cleanTag = tag.replace(/^#/, "").toUpperCase();

  const { rows } = await pool.query(
    `SELECT
       DATE_TRUNC('day', snapshot_at) AS day,
       MAX(trophies)                  AS trophies,
       MAX(highest_trophies)          AS highest_trophies,
       MAX(snapshot_at)               AS snapshot_at
     FROM trophy_snapshots
     WHERE player_tag = $1
       AND snapshot_at >= NOW() - INTERVAL '1 day' * $2
     GROUP BY DATE_TRUNC('day', snapshot_at)
     ORDER BY day ASC`,
    [cleanTag, days]
  );

  return rows;
}

/**
 * Liste tous les joueurs actuellement suivis.
 */
async function getTrackedPlayers() {
  const { rows } = await pool.query(
    `SELECT tag, name, added_at, last_seen FROM tracked_players ORDER BY last_seen DESC`
  );
  return rows;
}

/**
 * Ajoute un joueur au suivi (premier snapshot immédiat).
 */
async function trackPlayer(tag) {
  const cleanTag = tag.replace(/^#/, "").toUpperCase();
  // Vérifie que le joueur existe avant de le tracker
  const player = await snapshotPlayer(cleanTag);
  return player;
}

/**
 * Supprime un joueur du suivi (et son historique).
 */
async function untrackPlayer(tag) {
  const cleanTag = tag.replace(/^#/, "").toUpperCase();
  await pool.query(`DELETE FROM tracked_players WHERE tag = $1`, [cleanTag]);
}

/**
 * Lance un snapshot pour TOUS les joueurs suivis.
 * Appelé par le cron job.
 */
async function snapshotAllTracked() {
  const players = await getTrackedPlayers();
  console.log(`⏰ Cron : snapshot de ${players.length} joueur(s)...`);

  const results = await Promise.allSettled(
    players.map(p => snapshotPlayer(p.tag))
  );

  const ok = results.filter(r => r.status === "fulfilled").length;
  const ko = results.filter(r => r.status === "rejected").length;
  console.log(`✅ ${ok} snapshots OK | ❌ ${ko} échecs`);
}

module.exports = { snapshotPlayer, getTrophyHistory, getTrackedPlayers, trackPlayer, untrackPlayer, snapshotAllTracked };
