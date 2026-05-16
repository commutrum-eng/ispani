const supabase = require('../../config/supabase');

/**
 * Contracts Module — COMPANY-DRIVEN ONLY.
 *
 * A worker CANNOT self-promote to subscription or contract.
 * Only the EMPLOYER can offer a subscription-month or fixed-term contract
 * to a worker they liked after a completed spot gig.
 */
const contractsController = {

  // Employer offers a subscription or contract to a worker after a gig
  offerContract: async (req, res) => {
    try {
      const {
        employer_id,
        worker_id,
        base_gig_id,        // The gig that led to this offer
        contract_type,       // 'subscription_month' | 'fixed_term'
        monthly_rate,
        start_date,
        end_date
      } = req.body;

      // Verify the base gig was completed and belongs to this employer/worker pair
      const { data: gig, error: gigError } = await supabase
        .from('gigs')
        .select('status, worker_id, jobs!job_id(employer_id)')
        .eq('id', base_gig_id)
        .single();

      if (gigError || !gig) return res.status(404).json({ error: 'Base gig not found' });
      if (!['completed', 'paid'].includes(gig.status)) {
        return res.status(400).json({ error: 'Contract can only be offered after a completed gig' });
      }
      if (gig.worker_id !== worker_id) {
        return res.status(403).json({ error: 'Worker does not match the gig worker' });
      }

      // Create contract
      const { data: contract, error } = await supabase
        .from('contracts')
        .insert([{
          employer_id,
          worker_id,
          base_gig_id,
          contract_type,
          monthly_rate,
          start_date,
          end_date,
          status: 'active'
        }])
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({
        message: `${contract_type === 'subscription_month' ? 'Subscription-month' : 'Fixed-term contract'} offered to worker`,
        contract
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Get all contracts for an employer (their hired workers)
  getEmployerContracts: async (req, res) => {
    try {
      const { employer_id } = req.params;
      const { data, error } = await supabase
        .from('contracts')
        .select('*, worker:worker_id(full_name, average_rating, track_record_score, skills)')
        .eq('employer_id', employer_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get all contracts for a worker (offers they have received)
  getWorkerContracts: async (req, res) => {
    try {
      const { worker_id } = req.params;
      const { data, error } = await supabase
        .from('contracts')
        .select('*, employer:employer_id(full_name, org_id), org:employer_id(organizations!org_id(name))')
        .eq('worker_id', worker_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // End or pause a contract
  updateContractStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body; // 'ended' | 'paused'

      if (!['ended', 'paused', 'active'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Use: active, paused, ended' });
      }

      const { data, error } = await supabase
        .from('contracts')
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

module.exports = contractsController;
