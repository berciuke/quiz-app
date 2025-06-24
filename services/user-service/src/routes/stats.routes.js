const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const {
  getUserStats,
  getCategoryStats,
  processCompletedQuiz
} = require('../controllers/stats.controller');

// Wszystkie trasy wymagają autoryzacji
router.use(authMiddleware);

// GET /api/stats - Pobierz pełne statystyki użytkownika
router.get('/', getUserStats);

// GET /api/stats/category/:category - Statystyki konkretnej kategorii
router.get('/category/:category', getCategoryStats);

// POST /api/stats/quiz-completed - Przetwórz zakończony quiz
router.post('/quiz-completed', processCompletedQuiz);

module.exports = router; 