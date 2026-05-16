const supabase = require('../../config/supabase');

const reviewsController = {

  // Post a review after gig completion (both employer & worker can review)
  createReview: async (req, res) => {
    try {
      const { gig_id, reviewer_id, reviewee_id, rating, comment } = req.body;

      if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5' });

      // Verify gig is completed or paid
      const { data: gig, error: gigError } = await supabase
        .from('gigs')
        .select('status')
        .eq('id', gig_id)
        .single();

      if (gigError || !gig) return res.status(404).json({ error: 'Gig not found' });
      if (!['completed', 'paid'].includes(gig.status)) {
        return res.status(400).json({ error: 'Can only review after gig is completed' });
      }

      // Check for duplicate review from same reviewer for this gig
      const { data: existing } = await supabase
        .from('reviews')
        .select('id')
        .eq('gig_id', gig_id)
        .eq('reviewer_id', reviewer_id)
        .single();

      if (existing) return res.status(409).json({ error: 'You have already reviewed this gig' });

      // Insert review
      const { data: review, error } = await supabase
        .from('reviews')
        .insert([{ gig_id, reviewer_id, reviewee_id, rating, comment }])
        .select()
        .single();

      if (error) throw error;

      // Recalculate reviewee average rating & track_record_score
      const { data: allReviews } = await supabase
        .from('reviews')
        .select('rating')
        .eq('reviewee_id', reviewee_id);

      if (allReviews && allReviews.length > 0) {
        const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
        const { data: userStats } = await supabase
          .from('users')
          .select('completed_gigs_count, total_gigs_count')
          .eq('id', reviewee_id)
          .single();

        const completionRate = userStats?.total_gigs_count > 0
          ? (userStats.completed_gigs_count / userStats.total_gigs_count)
          : 0;

        // Track record score: 60% avg rating, 40% completion rate
        const trackRecordScore = (avg / 5 * 0.6 + completionRate * 0.4) * 100;

        await supabase.from('users').update({
          average_rating: parseFloat(avg.toFixed(2)),
          track_record_score: parseFloat(trackRecordScore.toFixed(2))
        }).eq('id', reviewee_id);
      }

      res.status(201).json(review);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Get all reviews for a user (worker or employer)
  getUserReviews: async (req, res) => {
    try {
      const { user_id } = req.params;
      const { data, error } = await supabase
        .from('reviews')
        .select('*, reviewer:reviewer_id(full_name, role), gig:gig_id(job_id)')
        .eq('reviewee_id', user_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get review summary stats for a user
  getReviewStats: async (req, res) => {
    try {
      const { user_id } = req.params;
      const { data: user, error } = await supabase
        .from('users')
        .select('average_rating, track_record_score, completed_gigs_count, total_gigs_count')
        .eq('id', user_id)
        .single();

      if (error) throw error;

      const completionRate = user.total_gigs_count > 0
        ? ((user.completed_gigs_count / user.total_gigs_count) * 100).toFixed(1)
        : '0.0';

      res.json({ ...user, completion_rate_percent: parseFloat(completionRate) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = reviewsController;
