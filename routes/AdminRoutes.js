const express = require('express');
const controller = require('../controllers/AdminController');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../services/http');

const router = express.Router();

router.use(...requireAdmin);
router.get('/overview', asyncHandler(controller.overview));
router.get('/reviews', asyncHandler(controller.adminReviews));
router.post('/users', asyncHandler(controller.createUser));
router.delete('/reviews/:id', asyncHandler(controller.deleteReview));
router.post('/movies', asyncHandler(controller.addMovie));
router.delete('/movies/:id', asyncHandler(controller.deleteMovie));

module.exports = router;