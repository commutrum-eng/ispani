const supabase = require('../../config/supabase');

/**
 * Workers Module
 * Skill levels are stored as JSONB: { "plumbing": 4, "electrical": 2 }
 * This gives each skill a level 1-5 without adding another table.
 */
const workersController = {

  // Get all available workers (role=worker, with skill/category filters)
  getWorkers: async (req, res) => {
    try {
      const { skill, category, min_rating, min_level } = req.query;

      let query = supabase
        .from('users')
        .select('id, full_name, skills, skill_levels, categories, average_rating, track_record_score, completed_gigs_count, total_gigs_count, id_verified, current_lat, current_lng')
        .eq('role', 'worker');

      if (skill) query = query.contains('skills', [skill]);
      if (category) query = query.contains('categories', [category]);
      if (min_rating) query = query.gte('average_rating', parseFloat(min_rating));

      const { data, error } = await query.order('track_record_score', { ascending: false });
      if (error) throw error;

      // Filter by skill level if requested
      let workers = data;
      if (min_level && skill) {
        const level = parseInt(min_level);
        workers = data.filter(w => {
          const levels = w.skill_levels || {};
          return (levels[skill] || 0) >= level;
        });
      }

      res.json(workers);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get a single worker profile
  getWorkerProfile: async (req, res) => {
    try {
      const { id } = req.params;
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, skills, skill_levels, categories, average_rating, track_record_score, completed_gigs_count, total_gigs_count, id_verified, org_id')
        .eq('id', id)
        .eq('role', 'worker')
        .single();

      if (error) return res.status(404).json({ error: 'Worker not found' });
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Update worker skill levels (1-5 per skill)
  updateSkillLevels: async (req, res) => {
    try {
      const { id } = req.params;
      const { skill_levels } = req.body; // e.g. { "plumbing": 4, "electrical": 2 }

      // Validate levels are 1-5
      for (const [skill, level] of Object.entries(skill_levels)) {
        if (level < 1 || level > 5) {
          return res.status(400).json({ error: `Skill level for "${skill}" must be between 1 and 5` });
        }
      }

      // Also sync the skills[] array
      const skillsList = Object.keys(skill_levels);

      const { data, error } = await supabase
        .from('users')
        .update({ skill_levels, skills: skillsList })
        .eq('id', id)
        .eq('role', 'worker')
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Update worker availability (marks them active/inactive in Redis via matching module)
  updateAvailability: async (req, res) => {
    try {
      const { id } = req.params;
      const { is_available } = req.body;

      // Just update in Supabase — actual geo-index update happens via /api/matching/location
      const { data, error } = await supabase
        .from('users')
        .update({ is_available })
        .eq('id', id)
        .eq('role', 'worker')
        .select('id, full_name, is_available')
        .single();

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
};

module.exports = workersController;
