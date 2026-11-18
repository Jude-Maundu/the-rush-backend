const express = require('express');
const { listMovies, getMovie } = require('../controllers/MovieController');
const { asyncHandler } = require('../services/http');

const router = express.Router();

router.get('/', asyncHandler(listMovies));
router.get('/:id', asyncHandler(getMovie));

module.exports = router;
