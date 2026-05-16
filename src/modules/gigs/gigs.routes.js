const express = require('express');
const router = express.Router();
const gigsController = require('./gigs.controller');
const { authenticate, requireRole } = require('../../middleware/auth');

// Employer assigns a worker to a job
router.post('/assign',   authenticate, requireRole('employer'), gigsController.assignWorker);

// Worker starts the gig
router.post('/start',    authenticate, requireRole('worker'), gigsController.startGig);

// Either party confirms job completion (dual-confirm)
router.post('/complete', authenticate, gigsController.completeGig);

// Either party raises a dispute
router.post('/dispute',  authenticate, gigsController.raiseDispute);

// Get gigs for a job (employer view)
router.get('/job/:job_id',       authenticate, gigsController.getGigsByJob);

// Get gigs for a worker (worker history)
router.get('/worker/:worker_id', authenticate, gigsController.getWorkerGigs);

module.exports = router;
