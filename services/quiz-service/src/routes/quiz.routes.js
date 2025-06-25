const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quiz.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const {
  createQuizValidation,
  updateQuizValidation,
  quizIdValidation,
  commentValidation,
  ratingValidation,
  inviteUserValidation,
  paginationValidation
} = require('../validation/quiz.validation');

// Publiczne endpointy
router.get('/', paginationValidation, validateRequest, quizController.getAllQuizzes);
router.get('/search', paginationValidation, validateRequest, quizController.searchQuizzes);

// Endpointy wymagające autoryzacji
router.use(requireAuth); // Middleware dla wszystkich kolejnych endpointów

router.get('/:id', quizIdValidation, validateRequest, quizController.getQuizById);

router.post('/', createQuizValidation, validateRequest, quizController.createQuiz);
router.get('/user/my-quizzes', quizController.getUserQuizzes);
router.put('/:id', updateQuizValidation, validateRequest, quizController.updateQuiz);
router.delete('/:id', quizIdValidation, validateRequest, quizController.deleteQuiz);

// Interakcje społecznościowe
router.post('/:id/comments', commentValidation, validateRequest, quizController.addComment);
router.post('/:id/rate', ratingValidation, validateRequest, quizController.rateQuiz);

// Zapraszanie użytkowników
router.post('/:id/invite', inviteUserValidation, validateRequest, quizController.inviteUser);
router.delete('/:id/invite/:userId', quizIdValidation, validateRequest, quizController.removeInvite);
router.get('/:id/invites', quizIdValidation, validateRequest, quizController.getQuizInvites);

// Zarządzanie dostępem grup
router.post('/:id/groups', quizIdValidation, validateRequest, quizController.addGroupAccess);
router.delete('/:id/groups/:groupId', quizIdValidation, validateRequest, quizController.removeGroupAccess);
router.get('/:id/groups', quizIdValidation, validateRequest, quizController.getQuizGroupAccess);

// Endpoint do aktualizacji statystyk
router.patch('/:id/increment-playcount', quizIdValidation, validateRequest, quizController.incrementPlayCount);

module.exports = router; 