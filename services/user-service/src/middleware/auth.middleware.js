const jwt = require('jsonwebtoken');

// Verify JWT token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false,
      error: { message: 'Authentication required - Bearer token missing' }
    });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id || decoded.userId,
      userId: decoded.id || decoded.userId,
      email: decoded.email,
      firstName: decoded.firstName,
      lastName: decoded.lastName,
      role: decoded.role,
      username: decoded.username || `${decoded.firstName || ''} ${decoded.lastName || ''}`.trim()
    };
    next();
  } catch (error) {
    console.error('[verifyToken]', error.message);
    return res.status(401).json({ 
      success: false,
      error: { message: 'Invalid or expired token' }
    });
  }
};

// Require specific role(s)
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        error: { message: 'Authentication required' }
      });
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false,
        error: { 
          message: 'Insufficient permissions',
          required: allowedRoles, 
          current: req.user.role 
        }
      });
    }

    next();
  };
};

// Helper middleware for common roles
const requireAdmin = requireRole(['admin']);
const requireInstructor = requireRole(['instructor', 'admin']);

module.exports = {
  verifyToken,
  requireRole,
  requireAdmin,
  requireInstructor
}; 