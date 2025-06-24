const request = require('supertest');
const app = require('../src/index');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const prisma = new PrismaClient();

// Mock axios dla zapytań do quiz-service
jest.mock('axios');
const mockedAxios = axios;

// Mock JWT token dla testów
const generateTestToken = (userId, role = 'student') => {
  return jwt.sign(
    { id: userId, role: role },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

describe('Stats Controller', () => {
  let testUser;
  let userToken;
  let adminToken;
  let testQuizHistory;

  beforeAll(async () => {
    // Utwórz testowego użytkownika
    testUser = await prisma.user.create({
      data: {
        email: 'test-stats@example.com',
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'Stats',
        role: 'student',
        totalScore: 500,
        totalQuizzesPlayed: 10,
        averageScore: 75.5,
        currentStreak: 3,
        bestStreak: 5,
        level: 2,
        experience: 150
      }
    });

    // Utwórz testową historię quizów
    testQuizHistory = await prisma.quizHistory.createMany({
      data: [
        {
          userId: testUser.id,
          quizId: '507f1f77bcf86cd799439011',
          quizTitle: 'Math Quiz',
          category: 'mathematics',
          score: 80,
          maxScore: 100,
          correctAnswers: 8,
          totalQuestions: 10,
          accuracy: 80.0,
          timeSpent: 300,
          difficulty: 'medium',
          pointsEarned: 80
        },
        {
          userId: testUser.id,
          quizId: '507f1f77bcf86cd799439012',
          quizTitle: 'Science Quiz',
          category: 'science',
          score: 90,
          maxScore: 100,
          correctAnswers: 9,
          totalQuestions: 10,
          accuracy: 90.0,
          timeSpent: 250,
          difficulty: 'easy',
          pointsEarned: 90
        }
      ]
    });

    // Utwórz statystyki kategorii
    await prisma.topicStats.createMany({
      data: [
        {
          userId: testUser.id,
          category: 'mathematics',
          totalQuizzes: 5,
          averageScore: 82.0,
          bestScore: 95,
          totalTimeSpent: 1500,
          level: 2,
          experience: 75
        },
        {
          userId: testUser.id,
          category: 'science',
          totalQuizzes: 3,
          averageScore: 88.5,
          bestScore: 98,
          totalTimeSpent: 900,
          level: 1,
          experience: 50
        }
      ]
    });

    // Utwórz globalne ranking
    await prisma.globalRanking.create({
      data: {
        userId: testUser.id,
        userName: `${testUser.firstName} ${testUser.lastName}`,
        totalScore: testUser.totalScore,
        averageScore: testUser.averageScore,
        quizzesPlayed: testUser.totalQuizzesPlayed,
        level: testUser.level,
        rank: 5
      }
    });

    userToken = generateTestToken(testUser.id);
    adminToken = generateTestToken(999, 'admin');
  });

  afterAll(async () => {
    // Wyczyść dane testowe
    await prisma.quizHistory.deleteMany({
      where: { userId: testUser.id }
    });
    await prisma.topicStats.deleteMany({
      where: { userId: testUser.id }
    });
    await prisma.globalRanking.deleteMany({
      where: { userId: testUser.id }
    });
    await prisma.weeklyStats.deleteMany({
      where: { userId: testUser.id }
    });
    await prisma.achievement.deleteMany({
      where: { userId: testUser.id }
    });
    await prisma.user.delete({
      where: { id: testUser.id }
    });
    await prisma.$disconnect();
  });

  describe('GET /api/stats/dashboard', () => {
    it('powinno zwrócić statystyki dashboardowe dla użytkownika', async () => {
      const response = await request(app)
        .get('/api/stats/dashboard')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('recentQuizzes');
      expect(response.body.data).toHaveProperty('weeklyStats');
      expect(response.body.data).toHaveProperty('topCategories');
      expect(response.body.data).toHaveProperty('globalRank');
      expect(response.body.data.globalRank).toBe(5);
    });

    it('powinno zwrócić błąd 401 dla nieautoryzowanego użytkownika', async () => {
      const response = await request(app)
        .get('/api/stats/dashboard');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/stats/user/:userId', () => {
    it('powinno zwrócić szczegółowe statystyki użytkownika', async () => {
      const response = await request(app)
        .get(`/api/stats/user/${testUser.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('overview');
      expect(response.body.data).toHaveProperty('categoryPerformance');
      expect(response.body.data).toHaveProperty('recentHistory');
      expect(response.body.data).toHaveProperty('strengthsAndWeaknesses');

      expect(response.body.data.user.id).toBe(testUser.id);
      expect(response.body.data.overview.totalScore).toBe(500);
      expect(response.body.data.categoryPerformance).toHaveLength(2);
    });

    it('powinno obsłużyć filtr czasowy "week"', async () => {
      const response = await request(app)
        .get(`/api/stats/user/${testUser.id}?timeframe=week`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('powinno zwrócić błąd 403 dla użytkownika bez uprawnień', async () => {
      const otherUserToken = generateTestToken(999);
      
      const response = await request(app)
        .get(`/api/stats/user/${testUser.id}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('admin powinien mieć dostęp do statystyk każdego użytkownika', async () => {
      const response = await request(app)
        .get(`/api/stats/user/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('powinno zwrócić błąd 404 dla nieistniejącego użytkownika', async () => {
      const response = await request(app)
        .get('/api/stats/user/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/stats/quiz/:quizId', () => {
    const testQuizId = '507f1f77bcf86cd799439011';

    beforeEach(() => {
      // Mock axios responses
      mockedAxios.get.mockReset();
    });

    it('powinno zwrócić statystyki quizu dla właściciela', async () => {
      // Mock quiz data
      mockedAxios.get
        .mockResolvedValueOnce({
          data: {
            _id: testQuizId,
            title: 'Test Quiz',
            category: 'mathematics',
            difficulty: 'medium',
            createdBy: testUser.id
          }
        })
        .mockResolvedValueOnce({
          data: {
            sessions: [
              {
                userId: testUser.id,
                status: 'completed',
                score: 80,
                accuracy: 80,
                timeSpent: 300,
                answers: [
                  { questionId: 'q1', isCorrect: true },
                  { questionId: 'q2', isCorrect: false }
                ]
              }
            ]
          }
        });

      const response = await request(app)
        .get(`/api/stats/quiz/${testQuizId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('quiz');
      expect(response.body.data).toHaveProperty('overview');
      expect(response.body.data).toHaveProperty('difficultyAnalysis');
      expect(response.body.data.quiz.id).toBe(testQuizId);
    });

    it('powinno zwrócić błąd 403 dla nieautoryzowanego użytkownika', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          _id: testQuizId,
          title: 'Test Quiz',
          createdBy: 999 // inny użytkownik
        }
      });

      const response = await request(app)
        .get(`/api/stats/quiz/${testQuizId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('powinno obsłużyć quiz bez sesji', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({
          data: {
            _id: testQuizId,
            title: 'Empty Quiz',
            createdBy: testUser.id
          }
        })
        .mockResolvedValueOnce({
          data: { sessions: [] }
        });

      const response = await request(app)
        .get(`/api/stats/quiz/${testQuizId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.overview.totalAttempts).toBe(0);
    });
  });

  describe('GET /api/stats/leaderboard', () => {
    it('powinno zwrócić globalny ranking', async () => {
      const response = await request(app)
        .get('/api/stats/leaderboard?type=global&limit=10')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('type', 'global');
      expect(response.body.data).toHaveProperty('ranking');
      expect(Array.isArray(response.body.data.ranking)).toBe(true);
    });

    it('powinno zwrócić ranking tygodniowy', async () => {
      // Utwórz tygodniowy ranking
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Poniedziałek

      await prisma.weeklyRanking.create({
        data: {
          userId: testUser.id,
          userName: `${testUser.firstName} ${testUser.lastName}`,
          weekStartDate: weekStart,
          totalScore: 200,
          quizzesPlayed: 5,
          averageScore: 40.0,
          rank: 3
        }
      });

      const response = await request(app)
        .get('/api/stats/leaderboard?type=weekly')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.type).toBe('weekly');
      
      // Cleanup
      await prisma.weeklyRanking.deleteMany({
        where: { userId: testUser.id }
      });
    });

    it('powinno zwrócić ranking kategorii', async () => {
      // Utwórz ranking kategorii
      await prisma.categoryRanking.create({
        data: {
          userId: testUser.id,
          userName: `${testUser.firstName} ${testUser.lastName}`,
          category: 'mathematics',
          totalScore: 500,
          averageScore: 75.0,
          quizzesPlayed: 10,
          level: 2,
          rank: 2
        }
      });

      const response = await request(app)
        .get('/api/stats/leaderboard?type=category&category=mathematics')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.type).toBe('category');
      expect(response.body.data.category).toBe('mathematics');
      
      // Cleanup
      await prisma.categoryRanking.deleteMany({
        where: { userId: testUser.id }
      });
    });
  });

  describe('Analiza wydajności', () => {
    it('powinno poprawnie analizować mocne i słabe strony', async () => {
      const response = await request(app)
        .get(`/api/stats/user/${testUser.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      const { strengthsAndWeaknesses } = response.body.data;
      
      expect(strengthsAndWeaknesses).toHaveProperty('strengths');
      expect(strengthsAndWeaknesses).toHaveProperty('weaknesses');
      expect(Array.isArray(strengthsAndWeaknesses.strengths)).toBe(true);
      expect(Array.isArray(strengthsAndWeaknesses.weaknesses)).toBe(true);

      // Science powinno być mocną stroną (wyższa średnia)
      const topStrength = strengthsAndWeaknesses.strengths[0];
      expect(topStrength.category).toBe('science');
      expect(topStrength.averageScore).toBe(88.5);
    });
  });

  describe('Error Handling', () => {
    it('powinno obsłużyć błędy połączenia z quiz-service', async () => {
      const testQuizId = '507f1f77bcf86cd799439011';
      
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const response = await request(app)
        .get(`/api/stats/quiz/${testQuizId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('powinno obsłużyć błędy bazy danych', async () => {
      // Mock Prisma error
      const originalFindUnique = prisma.user.findUnique;
      prisma.user.findUnique = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get(`/api/stats/user/${testUser.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);

      // Restore original method
      prisma.user.findUnique = originalFindUnique;
    });
  });
}); 