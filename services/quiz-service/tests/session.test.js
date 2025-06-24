const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/index');
const Session = require('../src/models/Session');
const Quiz = require('../src/models/Quiz');
const Question = require('../src/models/Question');
const Category = require('../src/models/Category');

describe('Session Service', () => {
  let testQuizId, testQuestionId, testSessionId, testCategoryId;
  
  const mockUser = {
    id: 'test-user-123',
    username: 'testuser',
    roles: ['user']
  };

  const mockUser2 = {
    id: 'test-user-456',
    username: 'testuser2',
    roles: ['user']
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/quiz_test_db');
    }
  });

  beforeEach(async () => {
    // Wyczyść kolekcje
    await Session.deleteMany({});
    await Quiz.deleteMany({});
    await Question.deleteMany({});
    await Category.deleteMany({});

    // Stwórz testową kategorię
    const category = await Category.create({
      name: 'Test Category',
      description: 'Test category for sessions'
    });
    testCategoryId = category._id;

    // Stwórz testowe pytanie
    const question = await Question.create({
      question: 'What is 2 + 2?',
      type: 'single-choice',
      options: ['3', '4', '5', '6'],
      correctAnswer: '4',
      points: 1,
      difficulty: 'easy'
    });
    testQuestionId = question._id;

    // Stwórz testowy quiz
    const quiz = await Quiz.create({
      title: 'Test Quiz for Sessions',
      description: 'A quiz for testing sessions',
      category: testCategoryId,
      difficulty: 'medium',
      duration: 30,
      isPublic: true,
      isActive: true,
      language: 'pl',
      questions: [testQuestionId],
      timeLimit: 1800,
      passingScore: 60,
      createdBy: mockUser.id
    });
    testQuizId = quiz._id;
  });

  afterAll(async () => {
    await Session.deleteMany({});
    await Quiz.deleteMany({});
    await Question.deleteMany({});
    await Category.deleteMany({});
    await mongoose.connection.close();
  });

  describe('POST /api/sessions/start/:quizId', () => {
    it('should start a new session with valid quiz', async () => {
      const response = await request(app)
        .post(`/api/sessions/start/${testQuizId}`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .expect(201);

      expect(response.body.sessionId).toBeDefined();
      expect(response.body.quizId).toBe(testQuizId.toString());
      expect(response.body.status).toBe('in-progress');
      expect(response.body.totalQuestions).toBe(1);
      testSessionId = response.body.sessionId;
    });

    it('should not start session without authentication', async () => {
      await request(app)
        .post(`/api/sessions/start/${testQuizId}`)
        .expect(401);
    });

    it('should not start session for non-existent quiz', async () => {
      const fakeQuizId = new mongoose.Types.ObjectId();
      
      await request(app)
        .post(`/api/sessions/start/${fakeQuizId}`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .expect(404);
    });

    it('should not start session for inactive quiz', async () => {
      await Quiz.findByIdAndUpdate(testQuizId, { isActive: false });
      
      await request(app)
        .post(`/api/sessions/start/${testQuizId}`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .expect(400);
    });

    it('should not allow multiple active sessions for same user and quiz', async () => {
      // Stwórz pierwszą sesję
      await request(app)
        .post(`/api/sessions/start/${testQuizId}`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .expect(201);

      // Spróbuj stworzyć drugą
      const response = await request(app)
        .post(`/api/sessions/start/${testQuizId}`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .expect(400);

      expect(response.body.error).toContain('Active session already exists');
    });

    it('should reject invalid quiz ID format', async () => {
      await request(app)
        .post('/api/sessions/start/invalid-id')
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .expect(400);
    });
  });

  describe('POST /api/sessions/:sessionId/answer', () => {
    beforeEach(async () => {
      const response = await request(app)
        .post(`/api/sessions/start/${testQuizId}`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        });
      testSessionId = response.body.sessionId;
    });

    it('should submit correct answer', async () => {
      const response = await request(app)
        .post(`/api/sessions/${testSessionId}/answer`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .send({
          questionId: testQuestionId,
          selectedAnswers: ['4']
        })
        .expect(200);

      expect(response.body.correct).toBe(true);
      expect(response.body.currentScore).toBe(1);
      expect(response.body.answeredQuestions).toBe(1);
    });

    it('should submit incorrect answer', async () => {
      const response = await request(app)
        .post(`/api/sessions/${testSessionId}/answer`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .send({
          questionId: testQuestionId,
          selectedAnswers: ['3']
        })
        .expect(200);

      expect(response.body.correct).toBe(false);
      expect(response.body.currentScore).toBe(0);
      expect(response.body.answeredQuestions).toBe(1);
    });

    it('should not allow answer submission for other user\'s session', async () => {
      await request(app)
        .post(`/api/sessions/${testSessionId}/answer`)
        .set({
          'x-user-id': mockUser2.id,
          'x-user-username': mockUser2.username,
          'x-user-roles': mockUser2.roles.join(',')
        })
        .send({
          questionId: testQuestionId,
          selectedAnswers: ['4']
        })
        .expect(404);
    });

    it('should not allow duplicate answers for same question', async () => {
      // Pierwsza odpowiedź
      await request(app)
        .post(`/api/sessions/${testSessionId}/answer`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .send({
          questionId: testQuestionId,
          selectedAnswers: ['4']
        })
        .expect(200);

      // Druga odpowiedź na to samo pytanie
      await request(app)
        .post(`/api/sessions/${testSessionId}/answer`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .send({
          questionId: testQuestionId,
          selectedAnswers: ['3']
        })
        .expect(400);
    });

    it('should reject invalid answer format', async () => {
      await request(app)
        .post(`/api/sessions/${testSessionId}/answer`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .send({
          questionId: testQuestionId,
          selectedAnswers: []
        })
        .expect(400);
    });

    it('should reject invalid question ID', async () => {
      await request(app)
        .post(`/api/sessions/${testSessionId}/answer`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .send({
          questionId: 'invalid-id',
          selectedAnswers: ['4']
        })
        .expect(400);
    });
  });

  describe('POST /api/sessions/:sessionId/pause', () => {
    beforeEach(async () => {
      const response = await request(app)
        .post(`/api/sessions/start/${testQuizId}`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        });
      testSessionId = response.body.sessionId;
    });

    it('should pause active session', async () => {
      const response = await request(app)
        .post(`/api/sessions/${testSessionId}/pause`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .expect(200);

      expect(response.body.status).toBe('paused');
      expect(response.body.pausedAt).toBeDefined();
    });

    it('should not pause already paused session', async () => {
      // Zatrzymaj sesję
      await request(app)
        .post(`/api/sessions/${testSessionId}/pause`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        });

      // Spróbuj zatrzymać ponownie
      await request(app)
        .post(`/api/sessions/${testSessionId}/pause`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .expect(400);
    });
  });

  describe('POST /api/sessions/:sessionId/resume', () => {
    beforeEach(async () => {
      const response = await request(app)
        .post(`/api/sessions/start/${testQuizId}`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        });
      testSessionId = response.body.sessionId;

      // Zatrzymaj sesję
      await request(app)
        .post(`/api/sessions/${testSessionId}/pause`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        });
    });

    it('should resume paused session', async () => {
      const response = await request(app)
        .post(`/api/sessions/${testSessionId}/resume`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .expect(200);

      expect(response.body.status).toBe('in-progress');
      expect(response.body.resumedAt).toBeDefined();
    });

    it('should not resume active session', async () => {
      // Wznów sesję
      await request(app)
        .post(`/api/sessions/${testSessionId}/resume`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        });

      // Spróbuj wznowić ponownie
      await request(app)
        .post(`/api/sessions/${testSessionId}/resume`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .expect(400);
    });
  });

  describe('POST /api/sessions/:sessionId/finish', () => {
    beforeEach(async () => {
      const response = await request(app)
        .post(`/api/sessions/start/${testQuizId}`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        });
      testSessionId = response.body.sessionId;
    });

    it('should finish session and return results', async () => {
      // Odpowiedz na pytanie
      await request(app)
        .post(`/api/sessions/${testSessionId}/answer`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .send({
          questionId: testQuestionId,
          selectedAnswers: ['4']
        });

      const response = await request(app)
        .post(`/api/sessions/${testSessionId}/finish`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .expect(200);

      expect(response.body.results.totalScore).toBe(1);
      expect(response.body.results.correctAnswers).toBe(1);
      expect(response.body.results.totalQuestions).toBe(1);
      expect(response.body.results.scorePercentage).toBe(100);
      expect(response.body.results.passed).toBe(true);
      expect(response.body.results.timeTaken).toBeGreaterThan(0);
    });

    it('should not finish already finished session', async () => {
      // Zakończ sesję
      await request(app)
        .post(`/api/sessions/${testSessionId}/finish`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        });

      // Spróbuj zakończyć ponownie
      await request(app)
        .post(`/api/sessions/${testSessionId}/finish`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .expect(400);
    });

    it('should update quiz statistics when session finishes', async () => {
      const initialQuiz = await Quiz.findById(testQuizId);
      const initialPlayCount = initialQuiz.playCount;

      await request(app)
        .post(`/api/sessions/${testSessionId}/finish`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        });

      const updatedQuiz = await Quiz.findById(testQuizId);
      expect(updatedQuiz.playCount).toBe(initialPlayCount + 1);
      expect(updatedQuiz.lastPlayedAt).toBeDefined();
    });
  });

  describe('GET /api/sessions/:sessionId', () => {
    beforeEach(async () => {
      const response = await request(app)
        .post(`/api/sessions/start/${testQuizId}`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        });
      testSessionId = response.body.sessionId;
    });

    it('should get session details', async () => {
      const response = await request(app)
        .get(`/api/sessions/${testSessionId}`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .expect(200);

      expect(response.body._id).toBe(testSessionId);
      expect(response.body.userId).toBe(mockUser.id);
      expect(response.body.status).toBe('in-progress');
    });

    it('should not allow access to other user\'s session', async () => {
      await request(app)
        .get(`/api/sessions/${testSessionId}`)
        .set({
          'x-user-id': mockUser2.id,
          'x-user-username': mockUser2.username,
          'x-user-roles': mockUser2.roles.join(',')
        })
        .expect(404);
    });
  });

  describe('GET /api/sessions/user/sessions', () => {
    beforeEach(async () => {
      // Stwórz kilka sesji
      await Session.create([
        { quizId: testQuizId, userId: mockUser.id, status: 'finished' },
        { quizId: testQuizId, userId: mockUser.id, status: 'in-progress' },
        { quizId: testQuizId, userId: mockUser2.id, status: 'finished' }
      ]);
    });

    it('should get user sessions with pagination', async () => {
      const response = await request(app)
        .get('/api/sessions/user/sessions')
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .expect(200);

      expect(response.body.sessions).toHaveLength(2);
      expect(response.body.pagination.totalSessions).toBe(2);
    });

    it('should filter sessions by status', async () => {
      const response = await request(app)
        .get('/api/sessions/user/sessions?status=finished')
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .expect(200);

      expect(response.body.sessions).toHaveLength(1);
      expect(response.body.sessions[0].status).toBe('finished');
    });

    it('should support pagination parameters', async () => {
      const response = await request(app)
        .get('/api/sessions/user/sessions?page=1&limit=1')
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .expect(200);

      expect(response.body.sessions).toHaveLength(1);
      expect(response.body.pagination.currentPage).toBe(1);
      expect(response.body.pagination.totalPages).toBe(2);
    });
  });
}); 