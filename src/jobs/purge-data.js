const { purgeOldTrackingData } = require('../utils/popia');

async function runJob() {
  const startTime = new Date();
  console.log(`[${startTime.toISOString()}] Starting scheduled purge job...`);
  
  try {
    await purgeOldTrackingData();
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    console.log(`[${endTime.toISOString()}] Purge job completed successfully in ${duration}s.`);
    process.exit(0);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Purge job failed:`, error);
    process.exit(1);
  }
}

runJob();
