const extractUser = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  const username = req.headers['x-user-username'];
  const roles = req.headers['x-user-roles']?.split(',') || [];

  if (userId) {
    req.user = {
      id: userId,
      username: username,
      roles: roles
    };
  }

  next();
};

const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.roles.includes('admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = {
  extractUser,
  requireAuth,
  requireAdmin
}; 