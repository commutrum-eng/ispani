const express = require('express');
const router = express.Router();
const reviewsController = require('./reviews.controller');
const { authenticate } = require('../../middleware/auth');

// Post a review — both worker and employer can review each other after gig
router.post('/', authenticate, reviewsController.createReview);

// Get all reviews for a specific user — public (visible on profile)
router.get('/user/:user_id',  reviewsController.getUserReviews);

// Get review summary stats — public (trust score, completion rate)
router.get('/stats/:user_id', reviewsController.getReviewStats);

module.exports = router;
