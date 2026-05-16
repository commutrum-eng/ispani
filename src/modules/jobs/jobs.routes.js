const express = require('express');
const router = express.Router();
const jobsController = require('./jobs.controller');
const { authenticate, requireRole } = require('../../middleware/auth');

// Public — workers and employers can browse open jobs
router.get('/',    jobsController.getJobs);
router.get('/:id', jobsController.getJobById);

// Protected — only employers can post jobs
router.post('/', authenticate, requireRole('employer'), jobsController.createJob);

// Accept a specific worker for a job (employer action — moves to gigs/assign)
router.patch('/:id/status', authenticate, requireRole('employer'), jobsController.updateJobStatus);

module.exports = router;
