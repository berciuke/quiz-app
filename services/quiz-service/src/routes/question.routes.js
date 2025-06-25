const express = require('express');
const router = express.Router();
const questionController = require('../controllers/question.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { validateRequest, validateObjectId } = require('../middleware/validation.middleware');
const {
  createQuestionValidation,
  updateQuestionValidation,
  questionIdValidation,
  paginationValidation
} = require('../validation/question.validation');

// Wszystkie endpointy wymagają autoryzacji
router.use(requireAuth);

// Operacje CRUD na pytaniach
router.get('/questions', validateRequest, questionController.getAllQuestions);
router.post('/quizzes/:quizId/questions', validateObjectId('quizId'), createQuestionValidation, validateRequest, questionController.addQuestionToQuiz);
router.get('/quizzes/:quizId/questions', validateObjectId('quizId'), questionController.getQuestionsForQuiz);
router.get('/questions/:id', validateObjectId('id'), questionIdValidation, validateRequest, questionController.getQuestionById);
router.put('/questions/:id', validateObjectId('id'), updateQuestionValidation, validateRequest, questionController.updateQuestion);
router.delete('/questions/:id', validateObjectId('id'), questionIdValidation, validateRequest, questionController.deleteQuestion);

// Pobieranie pytań użytkownika
router.get('/user/questions', paginationValidation, validateRequest, questionController.getUserQuestions);

module.exports = router; 