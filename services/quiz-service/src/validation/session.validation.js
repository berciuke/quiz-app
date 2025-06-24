const { body, param, query } = require('express-validator');

exports.validateSessionStart = [
  param('quizId')
    .isMongoId()
    .withMessage('Valid quiz ID is required')
];

exports.validateAnswerSubmit = [
  param('sessionId')
    .isMongoId()
    .withMessage('Valid session ID is required'),
  body('questionId')
    .isMongoId()
    .withMessage('Valid question ID is required'),
  body('selectedAnswers')
    .isArray({ min: 1 })
    .withMessage('At least one answer must be selected')
    .custom((value) => {
      if (!value.every(answer => typeof answer === 'string' && answer.trim().length > 0)) {
        throw new Error('All answers must be non-empty strings');
      }
      return true;
    })
];

exports.validateSessionAction = [
  param('sessionId')
    .isMongoId()
    .withMessage('Valid session ID is required')
];

exports.validateGetUserSessions = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('status')
    .optional()
    .isIn(['in-progress', 'paused', 'finished'])
    .withMessage('Status must be one of: in-progress, paused, finished')
]; 