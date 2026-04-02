const { Router } = require("express");
const { asyncHandler } = require("../middleware/errorHandler");
const { getBrawlers, getRankings, getEvents, getClub } = require("../services/brawlService");

// ─── Brawlers ─────────────────────────────────────────────────────────────────
const brawlersRouter = Router();

brawlersRouter.get("/", asyncHandler(async (req, res) => {
  const data = await getBrawlers();
  res.json(data);
}));

// ─── Rankings ─────────────────────────────────────────────────────────────────
const rankingsRouter = Router();

// GET /api/rankings/:country — "global" ou code pays (FR, US, JP...)
rankingsRouter.get("/:country", asyncHandler(async (req, res) => {
  const { country } = req.params;
  const data = await getRankings(country);
  res.json(data);
}));

rankingsRouter.get("/", asyncHandler(async (req, res) => {
  const data = await getRankings("global");
  res.json(data);
}));

// ─── Events ───────────────────────────────────────────────────────────────────
const eventsRouter = Router();

eventsRouter.get("/", asyncHandler(async (req, res) => {
  const data = await getEvents();
  res.json(data);
}));

// ─── Clubs ────────────────────────────────────────────────────────────────────
const clubsRouter = Router();

clubsRouter.get("/:tag", asyncHandler(async (req, res) => {
  const data = await getClub(req.params.tag);
  res.json(data);
}));

module.exports = { brawlersRouter, rankingsRouter, eventsRouter, clubsRouter };
