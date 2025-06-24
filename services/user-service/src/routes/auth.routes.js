const express = require('express');
const { verifyToken } = require('../middleware/auth.middleware');
const authController = require('../controllers/auth.controller');
const { validateRegister, validateLogin, validateForgotPassword, validateResetPassword } = require('../validation/auth.validation');

const router = express.Router();

// Rejestracja użytkownika
router.post('/register', validateRegister, authController.register);

// Logowanie użytkownika
router.post('/login', validateLogin, authController.login);

// Sprawdzenie tokenu
router.get('/verify', verifyToken, authController.verifyToken);

// Reset hasła - krok 1
router.post('/forgot-password', validateForgotPassword, authController.forgotPassword);

// Reset hasła - krok 2
router.post('/reset-password', validateResetPassword, authController.resetPassword);

module.exports = router; 