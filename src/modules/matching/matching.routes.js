const express = require('express');
const router = express.Router();
const matchingController = require('./matching.controller');
const { authenticate, requireRole } = require('../../middleware/auth');

// Worker updates their live location + active status
router.post('/location', authenticate, requireRole('worker'), matchingController.updateLocation);

// Employer triggers AI matching for a job
router.get('/matches', authenticate, requireRole('employer'), matchingController.findMatches);

module.exports = router;
