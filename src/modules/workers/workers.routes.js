const express = require('express');
const router = express.Router();
const workersController = require('./workers.controller');
const { authenticate, requireRole } = require('../../middleware/auth');

// Public — employers browse worker profiles
router.get('/',    workersController.getWorkers);
router.get('/:id', workersController.getWorkerProfile);

// Protected — worker updates their own skill levels (1-5)
router.patch('/:id/skills',        authenticate, requireRole('worker'), workersController.updateSkillLevels);

// Protected — worker updates their own availability
router.patch('/:id/availability',  authenticate, requireRole('worker'), workersController.updateAvailability);

module.exports = router;
