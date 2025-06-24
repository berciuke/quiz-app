const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/session.controller');
const { extractUser, requireAuth } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const {
  validateSessionStart,
  validateAnswerSubmit,
  validateSessionAction,
  validateGetUserSessions
} = require('../validation/session.validation');

// Wszystkie endpointy wymagają autoryzacji
router.use(extractUser);
router.use(requireAuth);

// Rozpoczynanie sesji
router.post('/start/:quizId', validateSessionStart, validateRequest, sessionController.startSession);

// Zarządzanie sesją
router.post('/:sessionId/answer', validateAnswerSubmit, validateRequest, sessionController.submitAnswer);
router.post('/:sessionId/pause', validateSessionAction, validateRequest, sessionController.pauseSession);
router.post('/:sessionId/resume', validateSessionAction, validateRequest, sessionController.resumeSession);
router.post('/:sessionId/finish', validateSessionAction, validateRequest, sessionController.finishSession);

// Pobieranie informacji o sesji
router.get('/:sessionId', validateSessionAction, validateRequest, sessionController.getSession);
router.get('/user/sessions', validateGetUserSessions, validateRequest, sessionController.getUserSessions);

module.exports = router; 