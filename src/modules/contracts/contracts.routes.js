const express = require('express');
const router = express.Router();
const contractsController = require('./contracts.controller');
const { authenticate, requireRole } = require('../../middleware/auth');

/**
 * COMPANY-DRIVEN ONLY — employers offer contracts, workers cannot self-promote.
 */

// Employer offers subscription-month or fixed-term contract to a worker
router.post('/offer', authenticate, requireRole('employer'), contractsController.offerContract);

// Get all contracts posted by an employer
router.get('/employer/:employer_id', authenticate, requireRole('employer'), contractsController.getEmployerContracts);

// Get all contract offers received by a worker
router.get('/worker/:worker_id', authenticate, requireRole('worker'), contractsController.getWorkerContracts);

// End or pause a contract (employer only)
router.patch('/:id/status', authenticate, requireRole('employer'), contractsController.updateContractStatus);

module.exports = router;
