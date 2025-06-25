const express = require('express');
const router = express.Router();
const tagController = require('../controllers/tag.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const { body, param, query } = require('express-validator');

// Walidacja dla tagów
const tagValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Tag name must be between 1 and 50 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Description must not exceed 200 characters')
];

const tagIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Tag ID must be valid')
];

const tagSearchValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

// Publiczne endpointy
router.get('/', tagSearchValidation, validateRequest, tagController.getTags);
router.get('/popular', tagController.getPopularTags);
router.get('/:id', tagIdValidation, validateRequest, tagController.getTagById);

// Endpointy wymagające autoryzacji
router.use(requireAuth);

router.post('/', tagValidation, validateRequest, tagController.createTag);
router.put('/:id', tagIdValidation, tagValidation, validateRequest, tagController.updateTag);
router.delete('/:id', tagIdValidation, validateRequest, tagController.deleteTag);

module.exports = router; 