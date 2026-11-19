const express = require('express');
const controller = require('../controllers/AdminController');
const { requireAdmin } = require('../middleware/auth');
const { memberPortraitUpload } = require('../middleware/memberPortraitUpload');
const { asyncHandler } = require('../services/http');

const router = express.Router();

router.use(...requireAdmin);
router.get('/overview', asyncHandler(controller.overview));
router.get('/reviews', asyncHandler(controller.adminReviews));
router.post('/users', asyncHandler(controller.createUser));
router.delete('/reviews/:id', asyncHandler(controller.deleteReview));
router.post('/movies', asyncHandler(controller.addMovie));
router.delete('/movies/:id', asyncHandler(controller.deleteMovie));
router.get('/members', asyncHandler(controller.listMembers));
router.post('/members', memberPortraitUpload, asyncHandler(controller.addMember));
router.put('/members/:id', memberPortraitUpload, asyncHandler(controller.updateMember));
router.delete('/members/:id', asyncHandler(controller.deleteMember));

module.exports = router;