const redis = require('../../config/redis');
const supabase = require('../../config/supabase');

/**
 * Matching Engine — 3-level AI matching:
 * Level 1: Geo-proximity via Redis GEOSEARCH (replaces deprecated GEORADIUS)
 * Level 2: Skill + category overlap via Supabase
 * Level 3: Weighted performance score (proximity + rating + completion + skill level)
 *
 * Radius expansion: tries 10km → 50km → 100km until matches found.
 */

const RADIUS_EXPANSION = [10, 50, 100]; // km

async function findNearbyWorkers(redis, lng, lat, radiusKm) {
  // Use GEOSEARCH (Redis 6.2+) instead of deprecated GEORADIUS
  return await redis.call(
    'GEOSEARCH',
    'workers:locations',
    'FROMLONLAT', lng, lat,
    'BYRADIUS', radiusKm, 'km',
    'ASC',
    'WITHCOORD',
    'WITHDIST',
    'COUNT', 100
  );
}

const matchingController = {

  // Update worker location and mark them active/inactive
  updateLocation: async (req, res) => {
    try {
      const { worker_id, lat, lng, is_active } = req.body;

      if (!redis) return res.status(503).json({ error: 'Redis not available' });

      if (is_active) {
        await redis.geoadd('workers:locations', lng, lat, worker_id);
        await redis.sadd('workers:active', worker_id);
      } else {
        await redis.zrem('workers:locations', worker_id);
        await redis.srem('workers:active', worker_id);
      }

      // Persist to Supabase for durability
      await supabase
        .from('users')
        .update({ current_lat: lat, current_lng: lng })
        .eq('id', worker_id);

      res.json({ message: 'Location updated successfully' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Find best-matched workers for a job
  findMatches: async (req, res) => {
    try {
      const { job_id } = req.query;

      if (!redis) return res.status(503).json({ error: 'Redis not available' });

      // 1. Get job details
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', job_id)
        .single();

      if (jobError || !job) return res.status(404).json({ error: 'Job not found' });

      // 2. Level 1: Radius expansion — 10km → 50km → 100km
      let nearbyRaw = [];
      let usedRadius = 10;

      for (const radius of RADIUS_EXPANSION) {
        nearbyRaw = await findNearbyWorkers(redis, job.location_lng, job.location_lat, radius);
        if (nearbyRaw && nearbyRaw.length > 0) {
          usedRadius = radius;
          break;
        }
      }

      if (!nearbyRaw || nearbyRaw.length === 0) {
        return res.json({ matches: [], radius_used_km: null, message: 'No workers found within 100km' });
      }

      // Parse GEOSEARCH result: [name, distance, [lon, lat]]
      const workerDistMap = {};
      nearbyRaw.forEach(entry => {
        const workerId = entry[0];
        const distance = parseFloat(entry[1]);
        workerDistMap[workerId] = distance;
      });

      const workerIds = Object.keys(workerDistMap);

      // Filter to only ACTIVE workers
      const activeWorkers = await redis.smembers('workers:active');
      const activeSet = new Set(activeWorkers);
      const activeWorkerIds = workerIds.filter(id => activeSet.has(id));

      if (activeWorkerIds.length === 0) {
        return res.json({ matches: [], radius_used_km: usedRadius, message: 'No active workers nearby' });
      }

      // 3. Level 2: Skill & category matching via Supabase
      let query = supabase
        .from('users')
        .select('id, full_name, role, skills, skill_levels, categories, average_rating, completed_gigs_count, total_gigs_count, track_record_score, id_verified')
        .in('id', activeWorkerIds)
        .eq('role', 'worker');

      if (job.skills_required && job.skills_required.length > 0) {
        query = query.overlaps('skills', job.skills_required);
      }

      const { data: profiles, error: profilesError } = await query;
      if (profilesError) throw profilesError;
      if (!profiles || profiles.length === 0) {
        return res.json({ matches: [], radius_used_km: usedRadius, message: 'No workers with matching skills found' });
      }

      // 4. Level 3: Weighted performance score
      const rankedWorkers = profiles.map(profile => {
        const distance = workerDistMap[profile.id] || usedRadius;

        // Normalize scores 0-1
        const proximityScore = Math.max(0, 1 - distance / usedRadius);
        const ratingScore = (profile.average_rating || 0) / 5;
        const completionRate = profile.total_gigs_count > 0
          ? profile.completed_gigs_count / profile.total_gigs_count
          : 0;
        const trackRecordScore = (profile.track_record_score || 0) / 100;

        // Skill level bonus: average level of matched skills / 5
        const skillLevels = profile.skill_levels || {};
        const matchedSkills = (job.skills_required || []).filter(s => skillLevels[s]);
        const avgSkillLevel = matchedSkills.length > 0
          ? matchedSkills.reduce((sum, s) => sum + (skillLevels[s] || 1), 0) / matchedSkills.length / 5
          : 0.2; // default if no levels set

        // Weighted composite score
        // Proximity: 25%, Rating: 25%, Completion: 20%, Track record: 15%, Skill level: 15%
        const compositeScore = (
          proximityScore * 0.25 +
          ratingScore * 0.25 +
          completionRate * 0.20 +
          trackRecordScore * 0.15 +
          avgSkillLevel * 0.15
        );

        return {
          ...profile,
          distance_km: parseFloat(distance.toFixed(2)),
          composite_score: parseFloat((compositeScore * 100).toFixed(1)),
          skill_match_count: matchedSkills.length,
          skill_match_ratio: job.skills_required?.length > 0
            ? parseFloat((matchedSkills.length / job.skills_required.length).toFixed(2))
            : 1
        };
      });

      // Sort by composite score descending
      rankedWorkers.sort((a, b) => b.composite_score - a.composite_score);

      res.json({ matches: rankedWorkers, radius_used_km: usedRadius, total_found: rankedWorkers.length });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = matchingController;
