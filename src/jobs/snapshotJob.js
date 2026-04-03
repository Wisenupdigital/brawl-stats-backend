const cron = require("node-cron");
const { snapshotAllTracked } = require("../services/snapshotService");

const CRON_SCHEDULE = process.env.SNAPSHOT_CRON || "*/30 * * * *";

function startSnapshotJob() {
  if (!cron.validate(CRON_SCHEDULE)) {
    console.error(`Cron invalide : "${CRON_SCHEDULE}"`);
    return;
  }
  cron.schedule(CRON_SCHEDULE, async () => {
    console.log(`[${new Date().toISOString()}] Snapshot declenche`);
    try {
      await snapshotAllTracked();
    } catch (err) {
      console.error("Snapshot echoue :", err.message);
    }
  });
  console.log(`Cron snapshot actif : "${CRON_SCHEDULE}"`);
}

module.exports = { startSnapshotJob };
