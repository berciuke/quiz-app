const { body } = require('express-validator');

const groupValidation = [
  body('name')
    .notEmpty()
    .withMessage('Group name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Group name must be between 2 and 100 characters')
    .trim(),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters')
    .trim(),
  
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean'),
  
  body('members')
    .optional()
    .isArray()
    .withMessage('Members must be an array')
    .custom((members) => {
      if (members && members.some(member => typeof member !== 'string')) {
        throw new Error('All members must be user IDs (strings)');
      }
      return true;
    })
];

const addMemberValidation = [
  body('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .isString()
    .withMessage('User ID must be a string')
    .trim()
];

const updateGroupValidation = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Group name must be between 2 and 100 characters')
    .trim(),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters')
    .trim(),
  
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean')
];

module.exports = {
  groupValidation,
  addMemberValidation,
  updateGroupValidation
}; 