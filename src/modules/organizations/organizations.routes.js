const express = require('express');
const router = express.Router();
const organizationsController = require('./organizations.controller');
const { authenticate, requireRole } = require('../../middleware/auth');

// Public
router.get('/',    organizationsController.getOrganizations);
router.get('/:id', organizationsController.getOrganizationById);

// Protected — admin only
router.post('/',    authenticate, requireRole('admin'), organizationsController.createOrganization);
router.put('/:id',  authenticate, requireRole('admin'), organizationsController.updateOrganization);
router.delete('/:id', authenticate, requireRole('admin'), organizationsController.deleteOrganization);

module.exports = router;
