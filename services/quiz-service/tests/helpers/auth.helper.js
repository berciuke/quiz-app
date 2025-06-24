const jwt = require('jsonwebtoken');

const createMockUser = (overrides = {}) => ({
  id: 12345,
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'student',
  ...overrides
});

const generateToken = (user = null) => {
  const userData = user || createMockUser();
  return jwt.sign(userData, process.env.JWT_SECRET, { expiresIn: '1h' });
};

const getAuthHeaders = (user = null) => ({
  'Authorization': `Bearer ${generateToken(user)}`,
  'x-user-id': user?.id || '12345',
  'x-user-username': `${user?.firstName || 'Test'} ${user?.lastName || 'User'}`,
  'x-user-roles': user?.role || 'student'
});

module.exports = {
  createMockUser,
  generateToken,
  getAuthHeaders
}; 