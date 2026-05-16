const express = require('express');
const router = express.Router();
const trackingController = require('./tracking.controller');
const { authenticate, requireRole } = require('../../middleware/auth');

// Worker clocks in (Start Work button)
router.post('/clock-in',  authenticate, requireRole('worker'), trackingController.clockIn);

// Worker clocks out (Finish Work button)
router.post('/clock-out', authenticate, requireRole('worker'), trackingController.clockOut);

// Worker streams live location during gig
router.post('/log',       authenticate, requireRole('worker'), trackingController.logLocation);

// Employer gets live location for an active gig
router.get('/live/:gig_id', authenticate, requireRole('employer'), trackingController.getLiveLocation);

module.exports = router;
