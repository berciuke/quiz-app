const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const quizRoutes = require('./routes/quiz.routes');
const questionRoutes = require('./routes/question.routes');
const categoryRoutes = require('./routes/category.routes');
const tagRoutes = require('./routes/tag.routes');
const sessionRoutes = require('./routes/session.routes');
const groupRoutes = require('./routes/group.routes');

const app = express();

// Middleware
app.use(helmet()); // Bezpieczeństwo
app.use(cors()); // CORS
app.use(express.json({ limit: '10mb' })); // Parsing JSON
app.use(express.urlencoded({ extended: true }));

// Logging middleware (only if not in test environment)
if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    service: 'quiz-service',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/quizzes', quizRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api', questionRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

module.exports = app; 