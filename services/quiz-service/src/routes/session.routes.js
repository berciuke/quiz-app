const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth.middleware');
const { validateObjectId } = require('../middleware/validation.middleware');
const {
  startSession,
  getCurrentQuestion,
  submitAnswer,
  completeSession,
  pauseSession,
  resumeSession,
  getSessionDetails,
  getQuizSessionStats,
  getQuizTrends
} = require('../controllers/session.controller');

// Wszystkie trasy wymagają autoryzacji
router.use(requireAuth);

// POST /api/sessions/start/:quizId - Rozpoczęcie nowej sesji
router.post('/start/:quizId', validateObjectId('quizId'), startSession);

// GET /api/sessions/:sessionId/question - Pobierz aktualne pytanie
router.get('/:sessionId/question', validateObjectId('sessionId'), getCurrentQuestion);

// POST /api/sessions/:sessionId/answer - Zapisz odpowiedź na pytanie
router.post('/:sessionId/answer', validateObjectId('sessionId'), submitAnswer);

// POST /api/sessions/:sessionId/complete - Zakończ sesję
router.post('/:sessionId/complete', validateObjectId('sessionId'), completeSession);

// POST /api/sessions/:sessionId/pause - Wstrzymaj sesję
router.post('/:sessionId/pause', validateObjectId('sessionId'), pauseSession);

// POST /api/sessions/:sessionId/resume - Wznów sesję
router.post('/:sessionId/resume', validateObjectId('sessionId'), resumeSession);

// GET /api/sessions/:sessionId - Pobierz szczegóły sesji
router.get('/:sessionId', validateObjectId('sessionId'), getSessionDetails);

// GET /api/sessions/quiz/:quizId/stats - Statystyki sesji quizu
router.get('/quiz/:quizId/stats', validateObjectId('quizId'), getQuizSessionStats);

// GET /api/sessions/quiz/:quizId/trends - Trendy popularności quizu
router.get('/quiz/:quizId/trends', validateObjectId('quizId'), getQuizTrends);

module.exports = router; 