const jwt = require('jsonwebtoken');

const createMockUser = (overrides = {}) => ({
  id: '12345',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'student',
  ...overrides
});

const generateToken = (user = null) => {
  const userData = user ? createMockUser(user) : createMockUser();
  const secret = process.env.JWT_SECRET || 'quiz-app-super-secret-jwt-key-production-change-me';
  return jwt.sign(userData, secret, { expiresIn: '1h' });
};

const getAuthHeaders = (user = null) => {
  const userData = user ? createMockUser(user) : createMockUser();
  return {
    'Authorization': `Bearer ${generateToken(user)}`,
    'x-user-id': userData.id,
    'x-user-username': `${userData.firstName} ${userData.lastName}`,
    'x-user-roles': userData.role
  };
};

module.exports = {
  createMockUser,
  generateToken,
  getAuthHeaders
}; 