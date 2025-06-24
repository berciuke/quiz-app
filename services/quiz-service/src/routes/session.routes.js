const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const {
  startSession,
  getCurrentQuestion,
  submitAnswer,
  completeSession,
  pauseSession,
  resumeSession,
  getSessionDetails
} = require('../controllers/session.controller');

// Wszystkie trasy wymagają autoryzacji
router.use(authMiddleware);

// POST /api/sessions/start/:quizId - Rozpoczęcie nowej sesji
router.post('/start/:quizId', startSession);

// GET /api/sessions/:sessionId/question - Pobierz aktualne pytanie
router.get('/:sessionId/question', getCurrentQuestion);

// POST /api/sessions/:sessionId/answer - Zapisz odpowiedź na pytanie
router.post('/:sessionId/answer', submitAnswer);

// POST /api/sessions/:sessionId/complete - Zakończ sesję
router.post('/:sessionId/complete', completeSession);

// POST /api/sessions/:sessionId/pause - Wstrzymaj sesję
router.post('/:sessionId/pause', pauseSession);

// POST /api/sessions/:sessionId/resume - Wznów sesję
router.post('/:sessionId/resume', resumeSession);

// GET /api/sessions/:sessionId - Pobierz szczegóły sesji
router.get('/:sessionId', getSessionDetails);

module.exports = router; 