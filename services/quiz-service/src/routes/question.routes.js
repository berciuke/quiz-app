const express = require('express');
const router = express.Router();
const questionController = require('../controllers/question.controller');
const { extractUser, requireAuth } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const {
  createQuestionValidation,
  updateQuestionValidation,
  questionIdValidation,
  paginationValidation
} = require('../validation/question.validation');

// Wszystkie endpointy wymagają autoryzacji
router.use(extractUser, requireAuth);

// Operacje CRUD na pytaniach
router.post('/quizzes/:quizId/questions', createQuestionValidation, validateRequest, questionController.addQuestionToQuiz);
router.get('/quizzes/:quizId/questions', questionController.getQuestionsForQuiz);
router.get('/questions/:id', questionIdValidation, validateRequest, questionController.getQuestionById);
router.put('/questions/:id', updateQuestionValidation, validateRequest, questionController.updateQuestion);
router.delete('/questions/:id', questionIdValidation, validateRequest, questionController.deleteQuestion);

// Pobieranie pytań użytkownika
router.get('/user/questions', paginationValidation, validateRequest, questionController.getUserQuestions);

module.exports = router; 