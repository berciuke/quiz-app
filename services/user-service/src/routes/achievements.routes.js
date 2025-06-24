const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.middleware');
const {
  getUserAchievements,
  getAchievementStats,
  getAllAvailableAchievements
} = require('../controllers/achievements.controller');

// Wszystkie trasy wymagają autoryzacji
router.use(verifyToken);

// GET /api/achievements - Pobierz osiągnięcia użytkownika
router.get('/', getUserAchievements);

// GET /api/achievements/stats - Pobierz statystyki osiągnięć
router.get('/stats', getAchievementStats);

// GET /api/achievements/available - Pobierz wszystkie dostępne osiągnięcia
router.get('/available', getAllAvailableAchievements);

module.exports = router; 