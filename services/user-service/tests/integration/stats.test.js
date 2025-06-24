const request = require('supertest');
const app = require('../../src/index');
const axios = require('axios');

// Mock axios
jest.mock('axios');

describe('Statistics Integration Tests', () => {
  let user, userToken, admin, adminToken;
  const QUIZ_ID = '60d5ecb54e51c92e15ad1234';

  beforeEach(async () => {
    user = await global.testHelpers.createTestUser({ 
      firstName: 'Stats',
      lastName: 'User'
    });
    userToken = global.testHelpers.generateTestToken(user);

    admin = await global.testHelpers.createTestUser({ 
      role: 'admin',
      firstName: 'Stats',
      lastName: 'Admin'
    });
    adminToken = global.testHelpers.generateTestToken(admin);

    // Dodaj historię quizów i statystyki
    await global.testHelpers.createTestQuizHistory(user.id, { 
      category: 'Historia', 
      score: 90, 
      accuracy: 90 
    });
    await global.testHelpers.createTestQuizHistory(user.id, { 
      category: 'Matematyka', 
      score: 70, 
      accuracy: 70 
    });
    
    await global.prisma.topicStats.create({ 
      data: { 
        userId: user.id, 
        category: 'Historia', 
        averageScore: 90,
        totalQuizzes: 1
      } 
    });
    await global.prisma.topicStats.create({ 
      data: { 
        userId: user.id, 
        category: 'Matematyka', 
        averageScore: 70,
        totalQuizzes: 1
      } 
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/stats/dashboard', () => {
    it('should return dashboard stats for the authenticated user', async () => {
      const response = await request(app)
        .get('/api/stats/dashboard')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.recentQuizzes).toHaveLength(2);
      expect(response.body.data.topCategories).toHaveLength(2);
      expect(response.body.data.topCategories[0].category).toBe('Historia');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/stats/dashboard')
        .expect(401);
    });

    it('should handle user with no quiz history', async () => {
      const newUser = await global.testHelpers.createTestUser({
        firstName: 'Empty',
        lastName: 'Stats'
      });
      const newToken = global.testHelpers.generateTestToken(newUser);

      const response = await request(app)
        .get('/api/stats/dashboard')
        .set('Authorization', `Bearer ${newToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.recentQuizzes).toHaveLength(0);
      expect(response.body.data.topCategories).toHaveLength(0);
    });
  });

  describe('GET /api/stats/user/:userId', () => {
    it("should return user's own stats", async () => {
      const response = await request(app)
        .get(`/api/stats/user/${user.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(user.id);
      expect(response.body.data.categoryPerformance).toHaveLength(2);
      expect(response.body.data.overview).toBeDefined();
    });

    it("should return another user's stats if requester is admin", async () => {
      const response = await request(app)
        .get(`/api/stats/user/${user.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(user.id);
      expect(response.body.data.categoryPerformance).toHaveLength(2);
    });

    it("should not return another user's stats if requester is not admin", async () => {
      const otherUser = await global.testHelpers.createTestUser({ 
        firstName: 'Other',
        lastName: 'User' 
      });
      
      await request(app)
        .get(`/api/stats/user/${otherUser.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should handle timeframe parameter', async () => {
      const response = await request(app)
        .get(`/api/stats/user/${user.id}?timeframe=week`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
    });

    it('should return 404 for non-existent user', async () => {
      await request(app)
        .get('/api/stats/user/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('GET /api/stats/quiz/:quizId', () => {
    let mockQuiz, mockSessions, mockQuestions;

    beforeEach(() => {
      // Definicja mocków wewnątrz beforeEach, aby mieć dostęp do 'user'
      mockQuiz = { 
        id: QUIZ_ID, 
        title: 'Test Quiz', 
        createdBy: user.id.toString(), // Właściciel
        category: 'Test',
        difficulty: 'medium'
      };

      mockSessions = [
        { 
          status: 'completed', 
          score: 80, 
          accuracy: 80, 
          timeSpent: 120, 
          answers: [{ questionId: 'q1', isCorrect: true }] 
        },
        { 
          status: 'completed', 
          score: 60, 
          accuracy: 60, 
          timeSpent: 150, 
          answers: [{ questionId: 'q1', isCorrect: false }] 
        },
        { status: 'abandoned' }
      ];
      
      mockQuestions = [{ _id: 'q1', question: 'What is 2+2?' }];

      axios.get.mockImplementation((url) => {
        // Check more specific URLs first
        if (url.includes(`/api/quizzes/${QUIZ_ID}/questions`)) {
          return Promise.resolve({ data: { questions: mockQuestions } });
        }
        if (url.includes(`/api/sessions/quiz/${QUIZ_ID}/stats`)) {
          return Promise.resolve({ data: { sessions: mockSessions } });
        }
        if (url.includes(`/api/sessions/quiz/${QUIZ_ID}/trends`)) {
          return Promise.resolve({ data: { trends: [] } });
        }
        if (url.includes(`/api/quizzes/${QUIZ_ID}`)) {
          return Promise.resolve({ data: mockQuiz });
        }
        return Promise.reject(new Error(`Not mocked: ${url}`));
      });
    });

    it("should return quiz stats for the quiz owner", async () => {
      const response = await request(app)
        .get(`/api/stats/quiz/${QUIZ_ID}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(axios.get).toHaveBeenCalledTimes(4);
      
      const { overview, difficultyAnalysis, questionAnalysis } = response.body.data;
      
      expect(overview).toMatchObject({
        totalAttempts: 3,
        completionRate: expect.any(Number),
        averageScore: 70,
        averageAccuracy: 70,
        averageTimeSpent: 135
      });
      expect(difficultyAnalysis.actualDifficulty).toBe('medium');
      expect(questionAnalysis).toHaveLength(1);
      expect(questionAnalysis[0].successRate).toBe(50);
    });

    it("should return quiz stats for an admin", async () => {
      // Resetuj mock przed testem administratora
      jest.clearAllMocks();
      axios.get.mockImplementation((url) => {
        // Check more specific URLs first
        if (url.includes(`/api/quizzes/${QUIZ_ID}/questions`)) {
          return Promise.resolve({ data: { questions: mockQuestions } });
        }
        if (url.includes(`/api/sessions/quiz/${QUIZ_ID}/stats`)) {
          return Promise.resolve({ data: { sessions: mockSessions } });
        }
        if (url.includes(`/api/sessions/quiz/${QUIZ_ID}/trends`)) {
          return Promise.resolve({ data: { trends: [] } });
        }
        if (url.includes(`/api/quizzes/${QUIZ_ID}`)) {
          return Promise.resolve({ data: mockQuiz });
        }
        return Promise.reject(new Error('Not mocked'));
      });

       const response = await request(app)
        .get(`/api/stats/quiz/${QUIZ_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(axios.get).toHaveBeenCalledTimes(4);
    });

    it("should deny access to non-owner, non-admin users", async () => {
      const otherUser = await global.testHelpers.createTestUser({ 
        firstName: 'Other',
        lastName: 'StatsUser' 
      });
      const otherToken = global.testHelpers.generateTestToken(otherUser);

      await request(app)
        .get(`/api/stats/quiz/${QUIZ_ID}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });

    it("should handle cases with no sessions gracefully", async () => {
      axios.get.mockImplementation((url) => {
        if (url.includes(`/api/quizzes/${QUIZ_ID}`)) return Promise.resolve({ data: mockQuiz });
        if (url.includes(`/api/sessions/quiz/${QUIZ_ID}/stats`)) return Promise.resolve({ data: { sessions: [] } });
        return Promise.reject(new Error('Not mocked'));
      });

      const response = await request(app)
        .get(`/api/stats/quiz/${QUIZ_ID}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data.overview.totalAttempts).toBe(0);
      expect(response.body.data.overview.averageScore).toBe(0);
    });

    it("should handle API errors gracefully", async () => {
      axios.get.mockImplementation(() => {
        return Promise.reject(new Error('Service unavailable'));
      });

      await request(app)
        .get(`/api/stats/quiz/${QUIZ_ID}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(500);
    });
  });

  describe('GET /api/stats/leaderboard', () => {
    beforeEach(async () => {
      // Przygotuj ranking
      await require('../../src/controllers/rankings.controller').updateGlobalRanking();
    });

    it('should return global leaderboard by default', async () => {
      const response = await request(app)
        .get('/api/stats/leaderboard')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
        
      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('global');
      expect(Array.isArray(response.body.data.ranking)).toBe(true);
    });

    it('should support different leaderboard types', async () => {
      await require('../../src/controllers/rankings.controller').updateWeeklyRanking();
      
      const response = await request(app)
        .get('/api/stats/leaderboard?type=weekly')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
        
      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('weekly');
    });

    it('should support category leaderboard', async () => {
      await require('../../src/controllers/rankings.controller').updateCategoryRanking('Historia');
      
      const response = await request(app)
        .get('/api/stats/leaderboard?type=category&category=Historia')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
        
      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('category');
      expect(response.body.data.category).toBe('Historia');
    });

    it('should support limit parameter', async () => {
      const response = await request(app)
        .get('/api/stats/leaderboard?limit=5')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
        
      expect(response.body.success).toBe(true);
      expect(response.body.data.ranking.length).toBeLessThanOrEqual(5);
    });
  });
}); 