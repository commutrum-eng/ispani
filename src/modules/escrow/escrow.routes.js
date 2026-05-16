const express = require('express');
const router = express.Router();
const escrowController = require('./escrow.controller');
const { authenticate, requireRole } = require('../../middleware/auth');

// Employer deposits funds into escrow when assigning gig
router.post('/create',  authenticate, requireRole('employer'), escrowController.createEscrow);

// Release funds to worker after both confirm job complete
router.post('/release', authenticate, escrowController.releaseEscrow);

// Refund employer on dispute resolution (admin resolves)
router.post('/refund',  authenticate, requireRole('admin'), escrowController.refundEscrow);

// Get escrow transaction history for a gig
router.get('/:gig_id',  authenticate, escrowController.getEscrowStatus);

module.exports = router;
