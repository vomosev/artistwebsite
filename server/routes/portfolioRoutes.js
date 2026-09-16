const express = require('express');
const {
  getProfile,
  updateProfile,
  listArtworks,
  getArtworkBySlug,
  createArtwork,
  updateArtwork,
  deleteArtwork,
} = require('../controllers/portfolioController');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

router.get('/api/profile', asyncHandler(getProfile));
router.put('/api/profile', requireAuth, asyncHandler(updateProfile));

router.get('/api/artworks', asyncHandler(listArtworks));
router.get('/api/artworks/:slug', asyncHandler(getArtworkBySlug));
router.post('/api/artworks', requireAuth, asyncHandler(createArtwork));
router.put('/api/artworks/:id', requireAuth, asyncHandler(updateArtwork));
router.delete('/api/artworks/:id', requireAuth, asyncHandler(deleteArtwork));

module.exports = router;