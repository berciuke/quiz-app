const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const {
  getGlobalRanking,
  getWeeklyRanking,
  getCategoryRanking,
  getAvailableCategories,
  getUserRankingStats,
  forceUpdateRankings
} = require('../controllers/rankings.controller');

// Wszystkie trasy wymagają autoryzacji
router.use(authMiddleware);

// GET /api/rankings/global - Ranking globalny
router.get('/global', getGlobalRanking);

// GET /api/rankings/weekly - Ranking tygodniowy
router.get('/weekly', getWeeklyRanking);

// GET /api/rankings/category/:category - Ranking kategorii
router.get('/category/:category', getCategoryRanking);

// GET /api/rankings/categories - Dostępne kategorie
router.get('/categories', getAvailableCategories);

// GET /api/rankings/user - Statystyki rankingowe użytkownika
router.get('/user', getUserRankingStats);

// POST /api/rankings/update - Wymuszenie aktualizacji rankingów (admin)
router.post('/update', forceUpdateRankings);

module.exports = router; 