const Joi = require('joi');

const validEmail = Joi.string()
  .email()
  .min(5)
  .max(100)
  .required()
  .messages({
    'string.email': 'Email musi mieć prawidłowy format',
    'string.min': 'Email musi mieć co najmniej {#limit} znaków',
    'string.max': 'Email może mieć maksymalnie {#limit} znaków',
    'any.required': 'Email jest wymagany'
  });

const validPassword = Joi.string()
  .min(6)
  .max(100)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  .required()
  .messages({
    'string.min': 'Hasło musi mieć co najmniej {#limit} znaków',
    'string.max': 'Hasło może mieć maksymalnie {#limit} znaków',
    'string.pattern.base': 'Hasło musi zawierać przynajmniej jedną małą literę, jedną wielką literę i jedną cyfrę',
    'any.required': 'Hasło jest wymagane'
  });

const validName = Joi.string()
  .min(2)
  .max(50)
  .pattern(/^[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s]+$/)
  .required()
  .messages({
    'string.min': 'Imię/nazwisko musi mieć co najmniej {#limit} znaki',
    'string.max': 'Imię/nazwisko może mieć maksymalnie {#limit} znaków',
    'string.pattern.base': 'Imię/nazwisko może zawierać tylko litery i spacje',
    'any.required': 'To pole jest wymagane'
  });

const validRole = Joi.string()
  .valid('student', 'instructor', 'admin')
  .default('student')
  .messages({
    'any.only': 'Rola musi być jedną z: student, instructor, admin'
  });

const registerSchema = Joi.object({
  email: validEmail,
  password: validPassword,
  firstName: validName,
  lastName: validName,
  role: validRole
})
.options({
  stripUnknown: true,
  abortEarly: false
})
.messages({
  'object.unknown': 'Pole "{#label}" nie jest dozwolone'
});

const loginSchema = Joi.object({
  email: validEmail,
  password: Joi.string()
    .required()
    .messages({
      'string.base': 'Hasło musi być tekstem',
      'string.empty': 'Hasło nie może być puste',
      'any.required': 'Hasło jest wymagane'
    })
})
.options({
  stripUnknown: true,
  abortEarly: false
})
.messages({
  'object.unknown': 'Pole "{#label}" nie jest dozwolone'
});

const updateProfileSchema = Joi.object({
  firstName: validName.optional(),
  lastName: validName.optional()
})
.options({
  stripUnknown: true,
  abortEarly: false
})
.min(1)
.messages({
  'object.unknown': 'Pole "{#label}" nie jest dozwolone',
  'object.min': 'Należy podać przynajmniej jedno pole do aktualizacji'
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string()
    .required()
    .messages({
      'string.base': 'Obecne hasło musi być tekstem',
      'string.empty': 'Obecne hasło nie może być puste',
      'any.required': 'Obecne hasło jest wymagane'
    }),
  newPassword: validPassword
})
.options({
  stripUnknown: true,
  abortEarly: false
})
.messages({
  'object.unknown': 'Pole "{#label}" nie jest dozwolone'
});

module.exports = {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema
}; 