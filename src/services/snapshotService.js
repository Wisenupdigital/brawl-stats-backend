const pool = require("../db/pool");
const { getPlayer } = require("./brawlService");

async function snapshotPlayer(tag) {
  const cleanTag = tag.replace(/^#/, "").toUpperCase();
  const player = await getPlayer(cleanTag);

  await pool.query(
    `INSERT INTO tracked_players (tag, name, last_seen)
     VALUES ($1, $2, NOW())
     ON CONFLICT (tag) DO UPDATE SET name = $2, last_seen = NOW()`,
    [cleanTag, player.name]
  );

  await pool.query(
    `INSERT INTO trophy_snapshots (player_tag, trophies, highest_trophies, exp_level)
     VALUES ($1, $2, $3, $4)`,
    [cleanTag, player.trophies, player.highestTrophies, player.expLevel]
  );

  console.log(`Snapshot: ${player.name} (${cleanTag}) -> ${player.trophies} trophees`);
  return player;
}

// Historique groupe par jour ou par semaine
async function getTrophyHistory(tag, days = 90, groupBy = "day") {
  const cleanTag = tag.replace(/^#/, "").toUpperCase();

  const trunc = groupBy === "week" ? "week" : "day";

  const { rows } = await pool.query(
    `SELECT
       DATE_TRUNC($1, snapshot_at)  AS period,
       MAX(trophies)                AS trophies,
       MIN(trophies)                AS trophies_min,
       MAX(highest_trophies)        AS highest_trophies,
       COUNT(*)                     AS snapshots,
       MAX(snapshot_at)             AS last_snapshot
     FROM trophy_snapshots
     WHERE player_tag = $2
       AND snapshot_at >= NOW() - INTERVAL '1 day' * $3
     GROUP BY DATE_TRUNC($1, snapshot_at)
     ORDER BY period ASC`,
    [trunc, cleanTag, days]
  );

  return rows;
}

async function getTrackedPlayers() {
  const { rows } = await pool.query(
    `SELECT tag, name, added_at, last_seen FROM tracked_players ORDER BY last_seen DESC`
  );
  return rows;
}

async function trackPlayer(tag) {
  const cleanTag = tag.replace(/^#/, "").toUpperCase();
  return snapshotPlayer(cleanTag);
}

async function untrackPlayer(tag) {
  const cleanTag = tag.replace(/^#/, "").toUpperCase();
  await pool.query(`DELETE FROM tracked_players WHERE tag = $1`, [cleanTag]);
}

async function snapshotAllTracked() {
  const players = await getTrackedPlayers();
  console.log(`Cron: snapshot de ${players.length} joueur(s)`);
  const results = await Promise.allSettled(players.map(p => snapshotPlayer(p.tag)));
  const ok = results.filter(r => r.status === "fulfilled").length;
  const ko = results.filter(r => r.status === "rejected").length;
  console.log(`${ok} OK | ${ko} echecs`);
}

module.exports = { snapshotPlayer, getTrophyHistory, getTrackedPlayers, trackPlayer, untrackPlayer, snapshotAllTracked };
