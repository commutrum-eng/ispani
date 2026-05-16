const supabase = require('../../config/supabase');

const escrowController = {

  // Employer deposits funds into escrow when assigning a gig
  createEscrow: async (req, res) => {
    try {
      const { gig_id, amount } = req.body;

      // Verify gig exists
      const { data: gig, error: gigError } = await supabase
        .from('gigs')
        .select('id, escrow_status')
        .eq('id', gig_id)
        .single();

      if (gigError || !gig) return res.status(404).json({ error: 'Gig not found' });
      if (gig.escrow_status !== 'pending') return res.status(400).json({ error: 'Escrow already created for this gig' });

      // Record the deposit transaction
      const { data: txn, error: txnError } = await supabase
        .from('escrow_transactions')
        .insert([{ gig_id, amount, transaction_type: 'deposit', status: 'completed' }])
        .select()
        .single();

      if (txnError) throw txnError;

      // Update gig escrow status to 'held'
      await supabase.from('gigs').update({ escrow_status: 'held' }).eq('id', gig_id);

      res.status(201).json({ message: 'Funds held in escrow', transaction: txn });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Release escrow to worker — triggered after both parties confirm job complete
  releaseEscrow: async (req, res) => {
    try {
      const { gig_id } = req.body;

      const { data: gig, error: gigError } = await supabase
        .from('gigs')
        .select('id, escrow_status, status, worker_id')
        .eq('id', gig_id)
        .single();

      if (gigError || !gig) return res.status(404).json({ error: 'Gig not found' });
      if (gig.status !== 'completed') return res.status(400).json({ error: 'Gig must be completed before releasing escrow' });
      if (gig.escrow_status !== 'held') return res.status(400).json({ error: 'Escrow is not in held state' });

      // Get deposit amount
      const { data: deposit } = await supabase
        .from('escrow_transactions')
        .select('amount')
        .eq('gig_id', gig_id)
        .eq('transaction_type', 'deposit')
        .single();

      const amount = deposit?.amount || 0;
      const commission = parseFloat((amount * 0.12).toFixed(2)); // 12% platform fee
      const workerPayout = parseFloat((amount - commission).toFixed(2));

      // Record payout and commission transactions
      await supabase.from('escrow_transactions').insert([
        { gig_id, amount: workerPayout, transaction_type: 'payout', status: 'completed' },
        { gig_id, amount: commission, transaction_type: 'commission', status: 'completed' }
      ]);

      // Update gig: escrow released, status paid
      await supabase.from('gigs').update({ escrow_status: 'released', status: 'paid' }).eq('id', gig_id);

      // Update worker completed gig count
      const { data: worker } = await supabase.from('users').select('completed_gigs_count, total_gigs_count').eq('id', gig.worker_id).single();
      if (worker) {
        await supabase.from('users').update({
          completed_gigs_count: (worker.completed_gigs_count || 0) + 1,
          total_gigs_count: (worker.total_gigs_count || 0) + 1
        }).eq('id', gig.worker_id);
      }

      res.json({ message: 'Escrow released', worker_payout: workerPayout, platform_commission: commission });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Refund escrow to employer — on dispute resolution
  refundEscrow: async (req, res) => {
    try {
      const { gig_id } = req.body;

      const { data: gig, error: gigError } = await supabase
        .from('gigs')
        .select('id, escrow_status, status')
        .eq('id', gig_id)
        .single();

      if (gigError || !gig) return res.status(404).json({ error: 'Gig not found' });
      if (gig.status !== 'disputed') return res.status(400).json({ error: 'Gig must be in disputed state to refund' });
      if (gig.escrow_status !== 'held') return res.status(400).json({ error: 'Escrow is not in held state' });

      const { data: deposit } = await supabase
        .from('escrow_transactions')
        .select('amount')
        .eq('gig_id', gig_id)
        .eq('transaction_type', 'deposit')
        .single();

      await supabase.from('escrow_transactions').insert([
        { gig_id, amount: deposit?.amount || 0, transaction_type: 'payout', status: 'completed' }
      ]);

      await supabase.from('gigs').update({ escrow_status: 'refunded' }).eq('id', gig_id);

      res.json({ message: 'Escrow refunded to employer', amount: deposit?.amount });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Get escrow status for a gig
  getEscrowStatus: async (req, res) => {
    try {
      const { gig_id } = req.params;
      const { data, error } = await supabase
        .from('escrow_transactions')
        .select('*')
        .eq('gig_id', gig_id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = escrowController;
