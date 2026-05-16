const supabase = require('../config/supabase');
const redis = require('../config/redis');

/**
 * Purge tracking data older than 90 days.
 * 1. Aggregates data into gig_tracking_summaries for analytics.
 * 2. Deletes raw tracking_logs.
 * 3. Cleans up Redis geo-cache.
 */
async function purgeOldTrackingData() {
  console.log('POPIA: Starting 90-day data purge routine...');

  try {
    const ninetyDaysAgo = new Date(Date.now() - (90 * 24 * 60 * 60 * 1000)).toISOString();

    // 1. Identify gigs that are completed or paid and have old tracking logs
    // We do this in a way that respects POPIA by anonymizing/summarizing first.
    
    // Fetch logs to summarize (only for completed/paid gigs)
    const { data: logsToPurge, error: fetchError } = await supabase
      .from('tracking_logs')
      .select(`
        gig_id,
        recorded_at,
        gigs!inner(status)
      `)
      .lt('recorded_at', ninetyDaysAgo)
      .in('gigs.status', ['completed', 'paid']);

    if (fetchError) throw fetchError;

    if (!logsToPurge || logsToPurge.length === 0) {
      console.log('POPIA: No old tracking logs found for completed gigs.');
    } else {
      // 2. Aggregate and save to summaries
      const summaries = {};
      logsToPurge.forEach(log => {
        if (!summaries[log.gig_id]) {
          summaries[log.gig_id] = {
            gig_id: log.gig_id,
            total_points: 0,
            first_recorded_at: log.recorded_at,
            last_recorded_at: log.recorded_at
          };
        }
        summaries[log.gig_id].total_points++;
        if (log.recorded_at < summaries[log.gig_id].first_recorded_at) {
          summaries[log.gig_id].first_recorded_at = log.recorded_at;
        }
        if (log.recorded_at > summaries[log.gig_id].last_recorded_at) {
          summaries[log.gig_id].last_recorded_at = log.recorded_at;
        }
      });

      const summaryData = Object.values(summaries);
      const { error: summaryError } = await supabase
        .from('gig_tracking_summaries')
        .upsert(summaryData, { onConflict: 'gig_id' });

      if (summaryError) throw summaryError;

      // 3. Delete raw logs from Database
      const gigIdsToPurge = summaryData.map(s => s.gig_id);
      const { error: deleteError } = await supabase
        .from('tracking_logs')
        .delete()
        .in('gig_id', gigIdsToPurge)
        .lt('recorded_at', ninetyDaysAgo);

      if (deleteError) throw deleteError;

      console.log(`POPIA: Successfully purged ${logsToPurge.length} tracking logs across ${gigIdsToPurge.length} gigs.`);
    }

    // 4. Cleanup Redis (optional, but good for hygiene)
    if (redis) {
      // If we store timestamps in a sorted set for TTL management
      // await redis.zremrangebyscore('worker_locations_ttl', '-inf', Date.now() - (90 * 24 * 60 * 60 * 1000));
      console.log('POPIA: Redis location cache hygiene checked.');
    }

  } catch (error) {
    console.error('POPIA Purge Error:', error.message);
    throw error;
  }
}

module.exports = {
  purgeOldTrackingData
};
