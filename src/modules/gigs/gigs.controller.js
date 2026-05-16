const supabase = require('../../config/supabase');

const gigsController = {

  // Employer assigns a worker to a job (creates the gig)
  assignWorker: async (req, res) => {
    try {
      const { job_id, worker_id } = req.body;

      // Verify job is still open
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('status, budget_amount')
        .eq('id', job_id)
        .single();

      if (jobError || !job) return res.status(404).json({ error: 'Job not found' });
      if (job.status !== 'open') return res.status(400).json({ error: 'Job is no longer open' });

      // Create gig
      const { data: gig, error: gigError } = await supabase
        .from('gigs')
        .insert([{ job_id, worker_id, status: 'assigned', escrow_status: 'pending' }])
        .select()
        .single();

      if (gigError) throw gigError;

      // Mark job as filled
      await supabase.from('jobs').update({ status: 'filled' }).eq('id', job_id);

      res.status(201).json(gig);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Worker clicks "Start Work"
  startGig: async (req, res) => {
    try {
      const { gig_id } = req.body;

      const { data, error } = await supabase
        .from('gigs')
        .update({ status: 'started', clock_in_time: new Date().toISOString(), tracking_enabled: true })
        .eq('id', gig_id)
        .eq('status', 'assigned') // Only start if currently assigned
        .select()
        .single();

      if (error || !data) return res.status(400).json({ error: 'Could not start gig. Check gig status.' });
      res.json(data);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Worker clicks "Finish Work" — triggers dual-confirm flow
  completeGig: async (req, res) => {
    try {
      const { gig_id, completer } = req.body; // completer: 'worker' | 'employer'

      const { data: gig, error: gigError } = await supabase
        .from('gigs')
        .select('*')
        .eq('id', gig_id)
        .single();

      if (gigError || !gig) return res.status(404).json({ error: 'Gig not found' });

      const updates = {};

      if (completer === 'worker') updates.worker_confirmed = true;
      if (completer === 'employer') updates.employer_confirmed = true;

      // If both confirmed, mark as completed and stop tracking
      const workerDone = completer === 'worker' || gig.worker_confirmed;
      const employerDone = completer === 'employer' || gig.employer_confirmed;

      if (workerDone && employerDone) {
        updates.status = 'completed';
        updates.clock_out_time = new Date().toISOString();
        updates.tracking_enabled = false;
      }

      const { data, error } = await supabase
        .from('gigs')
        .update(updates)
        .eq('id', gig_id)
        .select()
        .single();

      if (error) throw error;
      res.json({ gig: data, both_confirmed: workerDone && employerDone });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Get all gigs for a job
  getGigsByJob: async (req, res) => {
    try {
      const { job_id } = req.params;
      const { data, error } = await supabase
        .from('gigs')
        .select('*, users!worker_id(full_name, average_rating, track_record_score)')
        .eq('job_id', job_id);

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get all gigs for a worker
  getWorkerGigs: async (req, res) => {
    try {
      const { worker_id } = req.params;
      const { data, error } = await supabase
        .from('gigs')
        .select('*, jobs!job_id(title, category, budget_amount, location_lat, location_lng)')
        .eq('worker_id', worker_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Raise a dispute
  raiseDispute: async (req, res) => {
    try {
      const { gig_id, reason } = req.body;

      const { data, error } = await supabase
        .from('gigs')
        .update({ status: 'disputed', tracking_enabled: false })
        .eq('id', gig_id)
        .in('status', ['started', 'completed'])
        .select()
        .single();

      if (error || !data) return res.status(400).json({ error: 'Cannot dispute this gig' });
      res.json({ gig: data, reason });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
};

module.exports = gigsController;
