const { body, param, query } = require('express-validator');

const createQuestionValidation = [
  param('quizId')
    .isMongoId()
    .withMessage('Quiz ID must be a valid MongoDB ObjectId'),
    
  body('text')
    .notEmpty()
    .withMessage('Question text is required')
    .isLength({ min: 5, max: 1000 })
    .withMessage('Question text must be between 5 and 1000 characters')
    .trim(),
    
  body('type')
    .isIn(['single', 'multiple', 'boolean', 'text'])
    .withMessage('Question type must be one of: single, multiple, boolean, text'),
    
  body('options')
    .optional()
    .isArray({ min: 0 })
    .withMessage('Options must be an array'),
    
  body('options.*')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('Each option must be between 1 and 200 characters')
    .trim(),
    
  body('correctAnswers')
    .isArray({ min: 1 })
    .withMessage('Correct answers are required'),
    
  body('correctAnswers.*')
    .isLength({ min: 1, max: 200 })
    .withMessage('Each correct answer must be between 1 and 200 characters')
    .trim(),
    
  body('points')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Points must be an integer between 0 and 100'),
    
  body('hint')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Hint must not exceed 500 characters')
    .trim(),
    
  body('explanation')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Explanation must not exceed 1000 characters')
    .trim(),
    
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('Difficulty must be one of: easy, medium, hard'),
    
  body('category')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Category must be between 2 and 50 characters')
    .trim(),
    
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
    
  body('tags.*')
    .optional()
    .isLength({ min: 1, max: 30 })
    .withMessage('Each tag must be between 1 and 30 characters')
    .trim()
];

const updateQuestionValidation = [
  param('id')
    .isMongoId()
    .withMessage('Question ID must be a valid MongoDB ObjectId'),
    
  body('text')
    .optional()
    .notEmpty()
    .withMessage('Question text cannot be empty')
    .isLength({ min: 5, max: 1000 })
    .withMessage('Question text must be between 5 and 1000 characters')
    .trim(),
    
  body('type')
    .optional()
    .isIn(['single', 'multiple', 'boolean', 'text'])
    .withMessage('Question type must be one of: single, multiple, boolean, text'),
    
  body('options')
    .optional()
    .isArray({ min: 0 })
    .withMessage('Options must be an array'),
    
  body('options.*')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('Each option must be between 1 and 200 characters')
    .trim(),
    
  body('correctAnswers')
    .optional()
    .isArray({ min: 1 })
    .withMessage('Correct answers are required'),
    
  body('correctAnswers.*')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('Each correct answer must be between 1 and 200 characters')
    .trim(),
    
  body('points')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Points must be an integer between 0 and 100'),
    
  body('hint')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Hint must not exceed 500 characters')
    .trim(),
    
  body('explanation')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Explanation must not exceed 1000 characters')
    .trim(),
    
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('Difficulty must be one of: easy, medium, hard'),
    
  body('category')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Category must be between 2 and 50 characters')
    .trim(),
    
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
    
  body('tags.*')
    .optional()
    .isLength({ min: 1, max: 30 })
    .withMessage('Each tag must be between 1 and 30 characters')
    .trim()
];

const questionIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Question ID must be a valid MongoDB ObjectId')
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
    
  query('type')
    .optional()
    .isIn(['single', 'multiple', 'boolean', 'text'])
    .withMessage('Type must be one of: single, multiple, boolean, text'),
    
  query('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('Difficulty must be one of: easy, medium, hard'),
    
  query('category')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Category must be between 2 and 50 characters')
    .trim()
];

module.exports = {
  createQuestionValidation,
  updateQuestionValidation,
  questionIdValidation,
  paginationValidation
}; 