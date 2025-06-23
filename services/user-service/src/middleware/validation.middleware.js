const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    
    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      return res.status(400).json({
        error: 'Błędy walidacji',
        details: errorMessages
      });
    }
    
    req.body = value;
    next();
  };
};

module.exports = { validateRequest }; 