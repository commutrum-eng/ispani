const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { authenticate } = require('../../middleware/auth');

router.post('/signup', authController.signup);
router.post('/login',  authController.login);
router.get('/me',      authenticate, authController.me);

module.exports = router;
