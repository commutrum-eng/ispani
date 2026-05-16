const express = require('express');
const router = express.Router();
const usersController = require('./users.controller');
const { authenticate, requireRole } = require('../../middleware/auth');

// Public — user profile creation happens via Supabase Auth signup
// POST /api/users is called server-side after auth to create the DB record
router.post('/', usersController.createUser); // called internally on signup

// Protected
router.get('/',    authenticate, requireRole('admin'), usersController.getUsers);
router.get('/:id', authenticate, usersController.getUserById);
router.put('/:id', authenticate, usersController.updateUser);
router.delete('/:id', authenticate, requireRole('admin'), usersController.deleteUser);

module.exports = router;
