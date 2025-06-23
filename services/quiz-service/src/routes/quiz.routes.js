const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quiz.controller');
const { extractUser, requireAuth } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const {
  createQuizValidation,
  updateQuizValidation,
  quizIdValidation,
  commentValidation,
  ratingValidation,
  paginationValidation
} = require('../validation/quiz.validation');

// Publiczne endpointy
router.get('/', paginationValidation, validateRequest, quizController.getAllQuizzes);
router.get('/search', paginationValidation, validateRequest, quizController.searchQuizzes);
router.get('/:id', extractUser, quizIdValidation, validateRequest, quizController.getQuizById);

// Endpointy wymagające autoryzacji
router.use(extractUser, requireAuth); // Middleware dla wszystkich kolejnych endpointów

router.post('/', createQuizValidation, validateRequest, quizController.createQuiz);
router.get('/user/my-quizzes', quizController.getUserQuizzes);
router.put('/:id', updateQuizValidation, validateRequest, quizController.updateQuiz);
router.delete('/:id', quizIdValidation, validateRequest, quizController.deleteQuiz);

// Interakcje społecznościowe
router.post('/:id/comments', commentValidation, validateRequest, quizController.addComment);
router.post('/:id/rate', ratingValidation, validateRequest, quizController.rateQuiz);

module.exports = router; 