const { Router } = require("express");
const { asyncHandler } = require("../middleware/errorHandler");
const { getPlayer, getBattleLog } = require("../services/brawlService");
const { getTrophyHistory, trackPlayer, untrackPlayer, getTrackedPlayers, snapshotPlayer } = require("../services/snapshotService");

const router = Router();

// GET /api/players — liste des joueurs suivis
router.get("/", asyncHandler(async (req, res) => {
  const players = await getTrackedPlayers();
  res.json(players);
}));

// GET /api/players/:tag — profil complet
router.get("/:tag", asyncHandler(async (req, res) => {
  const player = await getPlayer(req.params.tag);
  res.json(player);
}));

// GET /api/players/:tag/battlelog
router.get("/:tag/battlelog", asyncHandler(async (req, res) => {
  const log = await getBattleLog(req.params.tag);
  res.json(log);
}));

// GET /api/players/:tag/history?days=90&groupBy=week
router.get("/:tag/history", asyncHandler(async (req, res) => {
  const days = Math.min(365, Math.max(7, parseInt(req.query.days) || 90));
  const groupBy = req.query.groupBy || "day"; // day | week
  const history = await getTrophyHistory(req.params.tag, days, groupBy);
  res.json({ tag: req.params.tag, days, groupBy, history });
}));

// POST /api/players/:tag/track
router.post("/:tag/track", asyncHandler(async (req, res) => {
  const player = await trackPlayer(req.params.tag);
  res.status(201).json({ message: "Joueur ajoute au suivi", player });
}));

// DELETE /api/players/:tag/track
router.delete("/:tag/track", asyncHandler(async (req, res) => {
  await untrackPlayer(req.params.tag);
  res.json({ message: "Joueur retire du suivi" });
}));

// POST /api/players/:tag/snapshot
router.post("/:tag/snapshot", asyncHandler(async (req, res) => {
  const player = await snapshotPlayer(req.params.tag);
  res.json({ message: "Snapshot enregistre", player });
}));

module.exports = router;
