const { Router } = require("express");
const { asyncHandler } = require("../middleware/errorHandler");
const { getPlayer, getBattleLog } = require("../services/brawlService");
const { getTrophyHistory, trackPlayer, untrackPlayer, getTrackedPlayers, snapshotPlayer } = require("../services/snapshotService");

const router = Router();

// GET /api/players/:tag — profil complet
router.get("/:tag", asyncHandler(async (req, res) => {
  const player = await getPlayer(req.params.tag);
  res.json(player);
}));

// GET /api/players/:tag/battlelog — historique de batailles
router.get("/:tag/battlelog", asyncHandler(async (req, res) => {
  const log = await getBattleLog(req.params.tag);
  res.json(log);
}));

// GET /api/players/:tag/history — courbe historique de trophées
// Query params: ?days=90 (défaut 90 jours)
router.get("/:tag/history", asyncHandler(async (req, res) => {
  const days = Math.min(365, Math.max(7, parseInt(req.query.days) || 90));
  const history = await getTrophyHistory(req.params.tag, days);
  res.json({ tag: req.params.tag, days, history });
}));

// POST /api/players/:tag/track — commence à suivre un joueur
router.post("/:tag/track", asyncHandler(async (req, res) => {
  const player = await trackPlayer(req.params.tag);
  res.status(201).json({ message: "Joueur ajouté au suivi", player });
}));

// DELETE /api/players/:tag/track — arrête de suivre un joueur
router.delete("/:tag/track", asyncHandler(async (req, res) => {
  await untrackPlayer(req.params.tag);
  res.json({ message: "Joueur retiré du suivi" });
}));

// GET /api/players — liste des joueurs suivis
router.get("/", asyncHandler(async (req, res) => {
  const players = await getTrackedPlayers();
  res.json(players);
}));

// POST /api/players/:tag/snapshot — snapshot manuel immédiat
router.post("/:tag/snapshot", asyncHandler(async (req, res) => {
  const player = await snapshotPlayer(req.params.tag);
  res.json({ message: "Snapshot enregistré", player });
}));

module.exports = router;
