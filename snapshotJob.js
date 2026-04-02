const cron = require("node-cron");
const { snapshotAllTracked } = require("../services/snapshotService");

const CRON_SCHEDULE = process.env.SNAPSHOT_CRON || "0 */6 * * *"; // défaut : toutes les 6h

function startSnapshotJob() {
  if (!cron.validate(CRON_SCHEDULE)) {
    console.error(`❌ SNAPSHOT_CRON invalide : "${CRON_SCHEDULE}"`);
    return;
  }

  cron.schedule(CRON_SCHEDULE, async () => {
    console.log(`\n⏰ [${new Date().toISOString()}] Cron snapshot déclenché`);
    try {
      await snapshotAllTracked();
    } catch (err) {
      console.error("❌ Cron snapshot échoué :", err.message);
    }
  });

  console.log(`✅ Cron snapshot actif — schedule : "${CRON_SCHEDULE}"`);
}

module.exports = { startSnapshotJob };
