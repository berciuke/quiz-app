const { body, param, query } = require('express-validator');

const createQuizValidation = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
    
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .custom((value) => {
      // Może być zarówno stringiem (nazwa kategorii) jak i ObjectId
      if (typeof value === 'string' && value.length > 0) return true;
      if (value.match(/^[0-9a-fA-F]{24}$/)) return true;
      throw new Error('Category must be a valid name or ObjectId');
    }),
    
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('Difficulty must be easy, medium, or hard'),
    
  body('duration')
    .optional()
    .isInt({ min: 1, max: 180 })
    .withMessage('Duration must be between 1 and 180 minutes'),
    
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean'),
    
  body('language')
    .optional()
    .isLength({ min: 2, max: 5 })
    .withMessage('Language code must be between 2 and 5 characters'),
    
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
    
  body('tags.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters'),
    
  body('timeLimit')
    .optional()
    .isInt({ min: 30, max: 7200 })
    .withMessage('Time limit must be between 30 and 7200 seconds'),
    
  body('passingScore')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Passing score must be between 0 and 100')
];

const updateQuizValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid quiz ID'),
    
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
    
  body('category')
    .optional()
    .custom((value) => {
      // Może być zarówno stringiem (nazwa kategorii) jak i ObjectId
      if (typeof value === 'string' && value.length > 0) return true;
      if (value.match(/^[0-9a-fA-F]{24}$/)) return true;
      throw new Error('Category must be a valid name or ObjectId');
    }),
    
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('Difficulty must be easy, medium, or hard'),
    
  body('duration')
    .optional()
    .isInt({ min: 1, max: 180 })
    .withMessage('Duration must be between 1 and 180 minutes'),
    
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean'),
    
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
    
  body('tags.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters')
];

const quizIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid quiz ID')
];

const commentValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid quiz ID'),
    
  body('text')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Comment must be between 1 and 500 characters')
];

const ratingValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid quiz ID'),
    
  body('value')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5')
];

const inviteUserValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid quiz ID'),
    
  body('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .isString()
    .withMessage('User ID must be a string')
    .trim()
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
    
  query('sortBy')
    .optional()
    .isIn([
      'createdAt', 'views', 'playCount', 'title', 
      'averageRating', 'lastPlayedAt', 'weeklyPlayCount', 'monthlyPlayCount'
    ])
    .withMessage('Invalid sort field'),
    
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),

  query('category')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Category name must not be empty'),

  query('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('Difficulty must be easy, medium, or hard'),

  query('language')
    .optional()
    .isLength({ min: 2, max: 5 })
    .withMessage('Language code must be between 2 and 5 characters'),

  query('tags')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Tags parameter must not be empty'),

  query('keywords')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Keywords must be between 1 and 100 characters'),

  query('q')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters')
];

module.exports = {
  createQuizValidation,
  updateQuizValidation,
  quizIdValidation,
  commentValidation,
  ratingValidation,
  inviteUserValidation,
  paginationValidation
}; 