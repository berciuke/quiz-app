const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.middleware');
const {
  getUserStats,
  getQuizStats,
  getLeaderboard,
  getDashboardStats
} = require('../controllers/stats.controller');

// Wszystkie trasy wymagają autoryzacji
router.use(verifyToken);

// GET /api/stats/dashboard - Statystyki dashboardowe
router.get('/dashboard', getDashboardStats);

// GET /api/stats/user/:userId - Szczegółowe statystyki użytkownika
router.get('/user/:userId', getUserStats);

// GET /api/stats/quiz/:quizId - Statystyki quizu dla twórców
router.get('/quiz/:quizId', getQuizStats);

// GET /api/stats/leaderboard - Rankingi globalne
router.get('/leaderboard', getLeaderboard);

module.exports = router; 