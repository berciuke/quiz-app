const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

const validateObjectId = (paramName) => (req, res, next) => {
  const id = req.params[paramName];
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      error: 'Invalid ID format',
      message: `The ${paramName} must be a valid MongoDB ObjectId`
    });
  }
  
  next();
};

module.exports = {
  validateRequest,
  validateObjectId
}; 