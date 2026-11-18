const express = require('express');
const { listReviews, addReview } = require('../controllers/ReviewController');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../services/http');

const router = express.Router();

router.get('/', asyncHandler(listReviews));
router.post('/', requireAuth, asyncHandler(addReview));

module.exports = router;
