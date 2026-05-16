const supabase = require('../../config/supabase');

const trackingController = {

  // Worker clicks "Start Work" — enables live tracking
  clockIn: async (req, res) => {
    try {
      const { gig_id } = req.body;
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('gigs')
        .update({ clock_in_time: now, status: 'started', tracking_enabled: true })
        .eq('id', gig_id)
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Worker clicks "Finish Work" — disables live tracking
  clockOut: async (req, res) => {
    try {
      const { gig_id } = req.body;
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('gigs')
        .update({ clock_out_time: now, status: 'completed', tracking_enabled: false })
        .eq('id', gig_id)
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Worker streams their GPS position during an active gig
  logLocation: async (req, res) => {
    try {
      const { gig_id, lat, lng } = req.body;

      // POPIA: only log if tracking is enabled and gig is active
      const { data: gig, error: gigError } = await supabase
        .from('gigs')
        .select('tracking_enabled, status')
        .eq('id', gig_id)
        .single();

      if (gigError || !gig) throw new Error('Gig not found');
      if (!gig.tracking_enabled || gig.status !== 'started') {
        return res.status(403).json({ error: 'Tracking is not enabled for this gig' });
      }

      const { data, error } = await supabase
        .from('tracking_logs')
        .insert([{ gig_id, lat, lng }])
        .select()
        .single();

      if (error) throw error;
      res.status(201).json(data);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Employer gets the latest GPS position of the worker (live view)
  getLiveLocation: async (req, res) => {
    try {
      const { gig_id } = req.params;

      // Verify gig is currently active
      const { data: gig, error: gigError } = await supabase
        .from('gigs')
        .select('tracking_enabled, status, worker_id')
        .eq('id', gig_id)
        .single();

      if (gigError || !gig) return res.status(404).json({ error: 'Gig not found' });
      if (!gig.tracking_enabled) {
        return res.status(403).json({ error: 'Live tracking is not active for this gig' });
      }

      // Get the most recent location ping
      const { data: latest, error: locError } = await supabase
        .from('tracking_logs')
        .select('lat, lng, recorded_at')
        .eq('gig_id', gig_id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single();

      if (locError || !latest) {
        return res.status(404).json({ error: 'No location data yet' });
      }

      res.json({ gig_id, worker_id: gig.worker_id, ...latest });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = trackingController;
