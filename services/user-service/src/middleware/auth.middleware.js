const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Brak tokenu autoryzacji' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('[verifyToken]', error.message);
    return res.status(401).json({ error: 'Nieprawidłowy token' });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Brak autoryzacji' });
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Brak uprawnień', 
        required: allowedRoles, 
        current: req.user.role 
      });
    }

    next();
  };
};

const requireAdmin = requireRole(['admin']);
const requireInstructor = requireRole(['instructor', 'admin']);

module.exports = {
  verifyToken,
  requireRole,
  requireAdmin,
  requireInstructor
}; 