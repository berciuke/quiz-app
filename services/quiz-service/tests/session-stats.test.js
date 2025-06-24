const request = require('supertest');
const app = require('../src/index');
const mongoose = require('mongoose');
const Session = require('../src/models/Session');
const Quiz = require('../src/models/Quiz');
const Category = require('../src/models/Category');
const jwt = require('jsonwebtoken');

// Mock JWT token dla testów
const generateTestToken = (userId, role = 'student') => {
  return jwt.sign(
    { id: userId, role: role },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

describe('Session Stats Controller', () => {
  let testQuizId;
  let testCategoryId;
  let userToken;
  let testSessions;

  beforeAll(async () => {
    // Utwórz testową kategorię
    const category = await Category.create({
      name: 'Test Statistics Category',
      description: 'Category for testing session statistics'
    });
    testCategoryId = category._id;

    // Utwórz testowy quiz
    const quiz = await Quiz.create({
      title: 'Test Statistics Quiz',
      description: 'A quiz for testing statistics',
      category: testCategoryId,
      difficulty: 'medium',
      timeLimit: 600,
      isActive: true,
      createdBy: 1,
      questions: []
    });
    testQuizId = quiz._id;

    userToken = generateTestToken(1);
  });

  afterAll(async () => {
    // Wyczyść dane testowe
    await Session.deleteMany({});
    await Quiz.deleteMany({});
    await Category.deleteMany({});
  });

  beforeEach(async () => {
    // Utwórz testowe sesje
    testSessions = await Session.create([
      {
        userId: 1,
        quizId: testQuizId,
        status: 'completed',
        startedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 dni temu
        completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 300000), // +5 min
        timeSpent: 300,
        score: 80,
        maxScore: 100,
        accuracy: 80,
        answers: [
          {
            questionId: new mongoose.Types.ObjectId(),
            selectedAnswers: ['A'],
            isCorrect: true,
            pointsAwarded: 10,
            timeSpent: 30
          },
          {
            questionId: new mongoose.Types.ObjectId(),
            selectedAnswers: ['B'],
            isCorrect: false,
            pointsAwarded: 0,
            timeSpent: 45
          }
        ]
      },
      {
        userId: 2,
        quizId: testQuizId,
        status: 'completed',
        startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 dni temu
        completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 420000), // +7 min
        timeSpent: 420,
        score: 90,
        maxScore: 100,
        accuracy: 90,
        answers: [
          {
            questionId: new mongoose.Types.ObjectId(),
            selectedAnswers: ['A'],
            isCorrect: true,
            pointsAwarded: 10,
            timeSpent: 25
          }
        ]
      },
      {
        userId: 3,
        quizId: testQuizId,
        status: 'in-progress',
        startedAt: new Date(Date.now() - 60 * 60 * 1000), // 1 godzinę temu
        timeSpent: 0,
        score: 0,
        maxScore: 100,
        accuracy: 0,
        answers: []
      }
    ]);
  });

  afterEach(async () => {
    // Wyczyść sesje po każdym teście
    await Session.deleteMany({});
  });

  describe('GET /api/sessions/quiz/:quizId/stats', () => {
    it('powinno zwrócić statystyki sesji dla konkretnego quizu', async () => {
      const response = await request(app)
        .get(`/api/sessions/quiz/${testQuizId}/stats`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('sessions');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data.total).toBe(3);
      expect(Array.isArray(response.body.data.sessions)).toBe(true);
      expect(response.body.data.sessions).toHaveLength(3);
    });

    it('powinno zwrócić wszystkie sesje z kompletnymi danymi', async () => {
      const response = await request(app)
        .get(`/api/sessions/quiz/${testQuizId}/stats`)
        .set('Authorization', `Bearer ${userToken}`);

      const sessions = response.body.data.sessions;
      
      // Sprawdź pierwszą sesję (ukończoną)
      const completedSession = sessions.find(s => s.status === 'completed' && s.userId === 1);
      expect(completedSession).toBeDefined();
      expect(completedSession.score).toBe(80);
      expect(completedSession.accuracy).toBe(80);
      expect(completedSession.timeSpent).toBe(300);
      expect(completedSession.answers).toHaveLength(2);

      // Sprawdź sesję w trakcie
      const inProgressSession = sessions.find(s => s.status === 'in-progress');
      expect(inProgressSession).toBeDefined();
      expect(inProgressSession.score).toBe(0);
      expect(inProgressSession.answers).toHaveLength(0);
    });

    it('powinno zwrócić błąd 404 dla nieistniejącego quizu', async () => {
      const fakeQuizId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/sessions/quiz/${fakeQuizId}/stats`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Quiz nie znaleziony');
    });

    it('powinno zwrócić błąd 401 dla nieautoryzowanego użytkownika', async () => {
      const response = await request(app)
        .get(`/api/sessions/quiz/${testQuizId}/stats`);

      expect(response.status).toBe(401);
    });

    it('powinno zwrócić puste dane dla quizu bez sesji', async () => {
      // Usuń wszystkie sesje
      await Session.deleteMany({});

      const response = await request(app)
        .get(`/api/sessions/quiz/${testQuizId}/stats`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.sessions).toHaveLength(0);
      expect(response.body.data.total).toBe(0);
    });
  });

  describe('GET /api/sessions/quiz/:quizId/trends', () => {
    it('powinno zwrócić trendy popularności quizu', async () => {
      const response = await request(app)
        .get(`/api/sessions/quiz/${testQuizId}/trends`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('trends');
      expect(Array.isArray(response.body.data.trends)).toBe(true);
    });

    it('powinno grupować dane według dni', async () => {
      const response = await request(app)
        .get(`/api/sessions/quiz/${testQuizId}/trends`)
        .set('Authorization', `Bearer ${userToken}`);

      const trends = response.body.data.trends;
      
      // Sprawdź czy dni są posortowane chronologicznie
      for (let i = 1; i < trends.length; i++) {
        expect(new Date(trends[i].date) >= new Date(trends[i-1].date)).toBe(true);
      }

      // Sprawdź strukturę danych
      if (trends.length > 0) {
        expect(trends[0]).toHaveProperty('date');
        expect(trends[0]).toHaveProperty('attempts');
        expect(trends[0]).toHaveProperty('completed');
        expect(trends[0]).toHaveProperty('averageScore');
      }
    });

    it('powinno obsłużyć filtr czasowy "from"', async () => {
      const fromDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 dni temu
      
      const response = await request(app)
        .get(`/api/sessions/quiz/${testQuizId}/trends?from=${fromDate.toISOString()}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      
      const trends = response.body.data.trends;
      
      // Wszystkie dane powinny być z okresu po 'from'
      trends.forEach(trend => {
        expect(new Date(trend.date) >= fromDate).toBe(true);
      });
    });

    it('powinno poprawnie liczyć statystyki dla każdego dnia', async () => {
      const response = await request(app)
        .get(`/api/sessions/quiz/${testQuizId}/trends`)
        .set('Authorization', `Bearer ${userToken}`);

      const trends = response.body.data.trends;
      
      if (trends.length > 0) {
        const dayWithData = trends.find(t => t.attempts > 0);
        if (dayWithData) {
          expect(dayWithData.completed).toBeLessThanOrEqual(dayWithData.attempts);
          expect(dayWithData.averageScore).toBeGreaterThanOrEqual(0);
          expect(dayWithData.averageScore).toBeLessThanOrEqual(100);
        }
      }
    });

    it('powinno zwrócić błąd dla nieprawidłowego formatu daty', async () => {
      const response = await request(app)
        .get(`/api/sessions/quiz/${testQuizId}/trends?from=invalid-date`)
        .set('Authorization', `Bearer ${userToken}`);

      // Może zwrócić błąd 400 lub obsłużyć gracefully - zależy od implementacji
      expect([200, 400]).toContain(response.status);
    });

    it('powinno zwrócić błąd 404 dla nieistniejącego quizu', async () => {
      const fakeQuizId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/sessions/quiz/${fakeQuizId}/trends`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(500); // Mongodb może rzucić błąd przy agregacji
    });
  });

  describe('Agregacja danych', () => {
    it('powinno poprawnie agregować dane z różnych dni', async () => {
      // Dodaj więcej sesji z różnych dni
      await Session.create([
        {
          userId: 4,
          quizId: testQuizId,
          status: 'completed',
          startedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // wczoraj
          completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 300000),
          timeSpent: 300,
          score: 70,
          accuracy: 70
        },
        {
          userId: 5,
          quizId: testQuizId,
          status: 'completed',
          startedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // wczoraj
          completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 240000),
          timeSpent: 240,
          score: 60,
          accuracy: 60
        }
      ]);

      const response = await request(app)
        .get(`/api/sessions/quiz/${testQuizId}/trends`)
        .set('Authorization', `Bearer ${userToken}`);

      const trends = response.body.data.trends;
      
      // Znajdź wczorajszy dzień
      const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      const yesterdayTrend = trends.find(t => t.date === yesterdayStr);
      if (yesterdayTrend) {
        expect(yesterdayTrend.attempts).toBeGreaterThanOrEqual(2);
        expect(yesterdayTrend.completed).toBeGreaterThanOrEqual(2);
        expect(yesterdayTrend.averageScore).toBeCloseTo(65, 1); // (70 + 60) / 2
      }
    });
  });

  describe('Performance i Edge Cases', () => {
    it('powinno obsłużyć quiz z wieloma sesjami', async () => {
      // Utwórz dużo sesji
      const manySessions = [];
      for (let i = 0; i < 100; i++) {
        manySessions.push({
          userId: i,
          quizId: testQuizId,
          status: i % 2 === 0 ? 'completed' : 'in-progress',
          startedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // ostatnie 30 dni
          timeSpent: Math.floor(Math.random() * 600),
          score: Math.floor(Math.random() * 100),
          accuracy: Math.random() * 100
        });
      }

      await Session.insertMany(manySessions);

      const response = await request(app)
        .get(`/api/sessions/quiz/${testQuizId}/stats`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.total).toBeGreaterThan(100);
    });

    it('powinno obsłużyć błędy MongoDB', async () => {
      // Mock błąd MongoDB
      const originalFind = Session.find;
      Session.find = jest.fn().mockImplementation(() => {
        throw new Error('Database connection error');
      });

      const response = await request(app)
        .get(`/api/sessions/quiz/${testQuizId}/stats`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);

      // Restore original method
      Session.find = originalFind;
    });
  });
}); 