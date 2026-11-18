const express = require('express');
const controller = require('../controllers/UserController');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../services/http');

const router = express.Router();

router.get('/session', optionalAuth, controller.session);
router.post('/auth/signup', asyncHandler(controller.signup));
router.post('/auth/signin', asyncHandler(controller.signin));
router.post('/auth/signout', controller.signout);
router.post('/auth/password', requireAuth, asyncHandler(controller.changePassword));

module.exports = router;