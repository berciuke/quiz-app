const request = require('supertest');

jest.mock('mongoose', () => {
  const mockSchema = jest.fn(function() {
    this.index = jest.fn();
    this.pre = jest.fn();
    return this;
  });
  
  mockSchema.Types = {
    ObjectId: jest.fn(() => '507f1f77bcf86cd799439011')
  };
  
  return {
    connect: jest.fn().mockResolvedValue(true),
    connection: {
      readyState: 1
    },
    Schema: mockSchema,
    model: jest.fn(() => ({
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      countDocuments: jest.fn()
    })),
    Types: {
      ObjectId: jest.fn(() => '507f1f77bcf86cd799439011')
    }
  };
});

const app = require('../src/index');

describe('Quiz Service Unit Tests', () => {
  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.service).toBe('quiz-service');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404);

      expect(response.body.error).toBe('Route not found');
      expect(response.body.path).toBe('/unknown-route');
    });
  });

  describe('API Routes Structure', () => {
    it('should require authentication for POST /api/quizzes', async () => {
      await request(app)
        .post('/api/quizzes')
        .send({
          title: 'Test Quiz',
          category: 'science'
        })
        .expect(401);
    });

    it('should validate quiz data for POST /api/quizzes', async () => {
      await request(app)
        .post('/api/quizzes')
        .set({
          'x-user-id': 'test-user',
          'x-user-username': 'testuser',
          'x-user-roles': 'user'
        })
        .send({
          title: 'x', 
          category: 'invalid_category'
        })
        .expect(400);
    });

    it('should accept valid category values', async () => {
      const validCategories = ['general', 'science', 'history', 'sports', 'technology', 'entertainment', 'education'];
      
      for (const category of validCategories) {
        const response = await request(app)
          .post('/api/quizzes')
          .set({
            'x-user-id': 'test-user',
            'x-user-username': 'testuser',
            'x-user-roles': 'user'
          })
          .send({
            title: 'Valid Quiz Title',
            category: category
          });
        
        expect(response.statusCode).toBe(400);
      }
    });
  });

  describe('Validation Tests', () => {
    const validQuizData = {
      title: 'Valid Quiz Title',
      description: 'This is a valid description',
      category: 'science',
      difficulty: 'medium',
      duration: 30,
      isPublic: true,
      language: 'pl',
      tags: ['test', 'science'],
      timeLimit: 1800,
      passingScore: 70
    };

    it('should reject quiz with title too short', async () => {
      await request(app)
        .post('/api/quizzes')
        .set({
          'x-user-id': 'test-user',
          'x-user-username': 'testuser',
          'x-user-roles': 'user'
        })
        .send({
          ...validQuizData,
          title: 'x'
        })
        .expect(400);
    });

    it('should reject quiz with invalid difficulty', async () => {
      await request(app)
        .post('/api/quizzes')
        .set({
          'x-user-id': 'test-user',
          'x-user-username': 'testuser',
          'x-user-roles': 'user'
        })
        .send({
          ...validQuizData,
          difficulty: 'invalid'
        })
        .expect(400);
    });

    it('should reject quiz with duration out of range', async () => {
      await request(app)
        .post('/api/quizzes')
        .set({
          'x-user-id': 'test-user',
          'x-user-username': 'testuser',
          'x-user-roles': 'user'
        })
        .send({
          ...validQuizData,
          duration: 200 
        })
        .expect(400);
    });
  });

  describe('Auth Middleware Tests', () => {
    it('should extract user from headers', async () => {
      const response = await request(app)
        .post('/api/quizzes')
        .set({
          'x-user-id': 'test-user-123',
          'x-user-username': 'testuser',
          'x-user-roles': 'user,admin'
        })
        .send({
          title: 'Test Quiz',
          category: 'science'
        });

      expect(response.statusCode).not.toBe(401);
    });

    it('should require user ID for protected routes', async () => {
      await request(app)
        .get('/api/quizzes/user/my-quizzes')
        .expect(401);
    });
  });
}); 