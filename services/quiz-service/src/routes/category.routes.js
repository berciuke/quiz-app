const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const { body, param } = require('express-validator');

// Walidacja dla kategorii
const categoryValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Category name must be between 2 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('parent')
    .optional()
    .isMongoId()
    .withMessage('Parent must be a valid category ID')
];

const categoryIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Category ID must be valid')
];

// Publiczne endpointy
router.get('/', categoryController.getCategories);
router.get('/hierarchy', categoryController.getCategoryHierarchy);
router.get('/:id', categoryIdValidation, validateRequest, categoryController.getCategoryById);

// Endpointy wymagające autoryzacji
router.use(requireAuth);

router.post('/', categoryValidation, validateRequest, categoryController.createCategory);
router.put('/:id', categoryIdValidation, categoryValidation, validateRequest, categoryController.updateCategory);
router.delete('/:id', categoryIdValidation, validateRequest, categoryController.deleteCategory);

module.exports = router; 