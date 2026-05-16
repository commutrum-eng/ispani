const supabase = require('../../config/supabase');

const jobsController = {

  // Employer creates a new job posting
  createJob: async (req, res) => {
    try {
      const {
        employer_id, org_id, title, description, category,
        skills_required, budget_amount, location_lat, location_lng,
        is_urgent, duration_days
      } = req.body;

      // Verify employer belongs to the org
      if (org_id) {
        const { data: user, error: userError } = await supabase
          .from('users').select('org_id').eq('id', employer_id).single();
        if (userError || !user) return res.status(400).json({ error: 'Employer not found' });
        if (user.org_id !== org_id) return res.status(403).json({ error: 'Employer does not belong to this org' });
      }

      const { data, error } = await supabase
        .from('jobs')
        .insert([{ employer_id, org_id, title, description, category, skills_required,
                   budget_amount, location_lat, location_lng, is_urgent, duration_days, status: 'open' }])
        .select()
        .single();

      if (error) throw error;
      res.status(201).json(data);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Get all jobs with optional filters
  getJobs: async (req, res) => {
    try {
      const { status, category, is_urgent } = req.query;
      let query = supabase.from('jobs').select('*');

      if (status)    query = query.eq('status', status);
      if (category)  query = query.eq('category', category);
      if (is_urgent) query = query.eq('is_urgent', is_urgent === 'true');

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get a single job with employer + org info
  getJobById: async (req, res) => {
    try {
      const { id } = req.params;
      const { data, error } = await supabase
        .from('jobs')
        .select('*, users!employer_id(full_name), organizations!org_id(name)')
        .eq('id', id)
        .single();

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(404).json({ error: 'Job not found' });
    }
  },

  // Employer updates job status (e.g., cancel a job)
  updateJobStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const allowed = ['open', 'filled', 'completed', 'cancelled'];

      if (!allowed.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Allowed: ${allowed.join(', ')}` });
      }

      const { data, error } = await supabase
        .from('jobs')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
};

module.exports = jobsController;
