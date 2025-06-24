const Joi = require('joi');

const validateRegister = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().max(100).required().messages({
      'string.email': 'Email musi być prawidłowy',
      'string.max': 'Email nie może być dłuższy niż 100 znaków',
      'any.required': 'Email jest wymagany'
    }),
    password: Joi.string().min(8).max(128).required().messages({
      'string.min': 'Hasło musi mieć co najmniej 8 znaków',
      'string.max': 'Hasło nie może być dłuższe niż 128 znaków',
      'any.required': 'Hasło jest wymagane'
    }),
    firstName: Joi.string().min(2).max(50).required().messages({
      'string.min': 'Imię musi mieć co najmniej 2 znaki',
      'string.max': 'Imię nie może być dłuższe niż 50 znaków',
      'any.required': 'Imię jest wymagane'
    }),
    lastName: Joi.string().min(2).max(50).required().messages({
      'string.min': 'Nazwisko musi mieć co najmniej 2 znaki',
      'string.max': 'Nazwisko nie może być dłuższe niż 50 znaków',
      'any.required': 'Nazwisko jest wymagane'
    }),
    role: Joi.string().valid('student', 'instructor', 'admin').optional().messages({
      'any.only': 'Rola musi być jedną z: student, instructor, admin'
    })
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Błąd walidacji',
        details: error.details.map(detail => detail.message)
      }
    });
  }

  next();
};

const validateLogin = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Email musi być prawidłowy',
      'any.required': 'Email jest wymagany'
    }),
    password: Joi.string().required().messages({
      'any.required': 'Hasło jest wymagane'
    })
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Błąd walidacji',
        details: error.details.map(detail => detail.message)
      }
    });
  }

  next();
};

const validateForgotPassword = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Email musi być prawidłowy',
      'any.required': 'Email jest wymagany'
    })
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Błąd walidacji',
        details: error.details.map(detail => detail.message)
      }
    });
  }

  next();
};

const validateResetPassword = (req, res, next) => {
  const schema = Joi.object({
    token: Joi.string().required().messages({
      'any.required': 'Token jest wymagany'
    }),
    newPassword: Joi.string().min(8).max(128).required().messages({
      'string.min': 'Nowe hasło musi mieć co najmniej 8 znaków',
      'string.max': 'Nowe hasło nie może być dłuższe niż 128 znaków',
      'any.required': 'Nowe hasło jest wymagane'
    })
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Błąd walidacji',
        details: error.details.map(detail => detail.message)
      }
    });
  }

  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword
}; 