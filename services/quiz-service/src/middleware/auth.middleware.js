const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'quiz-app-super-secret-jwt-key-production-change-me';

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'You must provide a valid Bearer token'
    });
  }

  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    req.user = {
      id: decoded.id || decoded.userId,
      email: decoded.email,
      firstName: decoded.firstName,
      lastName: decoded.lastName,
      role: decoded.role,
      roles: [decoded.role],
      username: decoded.username || `${decoded.firstName || ''} ${decoded.lastName || ''}`.trim()
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ 
      error: 'Authentication failed',
      message: 'Invalid or expired token'
    });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'You must be logged in to access this resource'
    });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Admin access required',
      message: 'You need administrator privileges to access this resource'
    });
  }
  
  next();
};

const requireInstructor = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'You must be logged in to access this resource'
    });
  }
  
  if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Instructor access required',
      message: 'You need instructor or administrator privileges to access this resource'
    });
  }
  
  next();
};

module.exports = {
  requireAuth,
  requireAdmin,
  requireInstructor
}; 