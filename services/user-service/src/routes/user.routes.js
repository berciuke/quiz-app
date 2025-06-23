const express = require('express');
const router = express.Router();

const userController = require('../controllers/user.controller');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const { 
  registerSchema, 
  loginSchema, 
  updateProfileSchema,
  changePasswordSchema 
} = require('../validation/user.validation');

// Public routes - rejestracja i logowanie
router.post('/register', validateRequest(registerSchema), userController.register);
router.post('/login', validateRequest(loginSchema), userController.login);

// Protected routes - wymagają tokenu JWT
router.use(verifyToken);

// User profile management
router.get('/profile', userController.getProfile);
router.put('/profile', validateRequest(updateProfileSchema), userController.updateProfile);
router.put('/password', validateRequest(changePasswordSchema), userController.changePassword);

// Admin only routes
router.get('/all', requireAdmin, userController.getAllUsers);
router.put('/:userId/role', requireAdmin, userController.updateUserRole);
router.put('/:userId/deactivate', requireAdmin, userController.deactivateUser);

module.exports = router; 