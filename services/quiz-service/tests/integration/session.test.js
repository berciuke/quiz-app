const request = require('supertest');
const app = require('../../src/app');
const { createQuizWithQuestions } = require('../factories/quiz.factory');
const { createSession, createSessionWithAnswers } = require('../factories/session.factory');
const { getAuthHeaders } = require('../helpers/auth.helper');

describe('Session API Integration Tests', () => {
  const authHeaders = getAuthHeaders();
  let quiz, questions;

  beforeEach(async () => {
    const result = await createQuizWithQuestions(3);
    quiz = result.quiz;
    questions = result.questions;
  });

  describe('POST /api/sessions/start/:quizId', () => {
    it('should start a new quiz session', async () => {
      const response = await request(app)
        .post(`/api/sessions/start/${quiz._id}`)
        .set(authHeaders)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Sesja rozpoczęta pomyślnie');
      expect(response.body.data.sessionId).toBeDefined();
      expect(response.body.data.quiz.id.toString()).toBe(quiz._id.toString());
      expect(response.body.data.quiz.totalQuestions).toBe(3);
      expect(response.body.data.session.status).toBe('in-progress');
      expect(response.body.data.session.currentQuestionIndex).toBe(0);
    });

    it('should return existing session if user has active session', async () => {
      // Stwórz sesję
      const session = await createSession({ 
        userId: 12345, 
        quizId: quiz._id,
        status: 'in-progress'
      });

      const response = await request(app)
        .post(`/api/sessions/start/${quiz._id}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Kontynuacja istniejącej sesji');
      expect(response.body.data.sessionId.toString()).toBe(session._id.toString());
    });

    it('should return 404 for non-existent quiz', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      
      const response = await request(app)
        .post(`/api/sessions/start/${fakeId}`)
        .set(authHeaders)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Quiz nie został znaleziony');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post(`/api/sessions/start/${quiz._id}`)
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
    });
  });

  describe('GET /api/sessions/:sessionId/question', () => {
    let session;

    beforeEach(async () => {
      session = await createSession({ 
        userId: 12345, 
        quizId: quiz._id,
        status: 'in-progress',
        currentQuestionIndex: 0
      });
    });

    it('should get current question', async () => {
      const response = await request(app)
        .get(`/api/sessions/${session._id}/question`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.question).toBeDefined();
      expect(response.body.data.question.questionNumber).toBe(1);
      expect(response.body.data.question.totalQuestions).toBe(3);
      expect(response.body.data.question.text).toBeDefined();
      expect(response.body.data.question.options).toBeDefined();
      // Nie powinno zwracać poprawnych odpowiedzi
      expect(response.body.data.question.correctAnswers).toBeUndefined();
    });

    it('should return session info with question', async () => {
      const response = await request(app)
        .get(`/api/sessions/${session._id}/question`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.data.session.currentQuestionIndex).toBe(0);
      expect(response.body.data.session.answeredQuestions).toBe(0);
      expect(response.body.data.session.currentScore).toBe(0);
    });

    it('should return 404 for non-existent session', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      
      const response = await request(app)
        .get(`/api/sessions/${fakeId}/question`)
        .set(authHeaders)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Sesja nie została znaleziona');
    });

    it('should not allow access to other users session', async () => {
      const otherUserSession = await createSession({ 
        userId: 99999, 
        quizId: quiz._id,
        status: 'in-progress'
      });

      const response = await request(app)
        .get(`/api/sessions/${otherUserSession._id}/question`)
        .set(authHeaders)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Sesja nie została znaleziona');
    });
  });

  describe('POST /api/sessions/:sessionId/answer', () => {
    let session;

    beforeEach(async () => {
      session = await createSession({ 
        userId: 12345, 
        quizId: quiz._id,
        status: 'in-progress',
        currentQuestionIndex: 0,
        maxScore: questions.reduce((sum, q) => sum + q.points, 0)
      });
    });

    it('should submit correct answer', async () => {
      const firstQuestion = questions[0];
      const answerData = {
        questionId: firstQuestion._id,
        selectedAnswers: firstQuestion.correctAnswers,
        timeSpent: 15
      };

      const response = await request(app)
        .post(`/api/sessions/${session._id}/answer`)
        .set(authHeaders)
        .send(answerData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.correct).toBe(true);
      expect(response.body.data.pointsAwarded).toBe(firstQuestion.points);
      expect(response.body.data.currentScore).toBe(firstQuestion.points);
      expect(response.body.data.nextQuestionIndex).toBe(1);
    });

    it('should submit incorrect answer', async () => {
      const firstQuestion = questions[0];
      const answerData = {
        questionId: firstQuestion._id,
        selectedAnswers: ['wrong answer'],
        timeSpent: 10
      };

      const response = await request(app)
        .post(`/api/sessions/${session._id}/answer`)
        .set(authHeaders)
        .send(answerData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.correct).toBe(false);
      expect(response.body.data.pointsAwarded).toBe(0);
      expect(response.body.data.currentScore).toBe(0);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post(`/api/sessions/${session._id}/answer`)
        .set(authHeaders)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/sessions/:sessionId/complete', () => {
    it('should complete session', async () => {
      const { session } = await createSessionWithAnswers(3, { 
        userId: 12345,
        quizId: quiz._id 
      });

      const response = await request(app)
        .post(`/api/sessions/${session._id}/complete`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.session.score).toBeDefined();
      expect(response.body.data.session.accuracy).toBeDefined();
      expect(response.body.data.session.correctAnswers).toBeDefined();
    });
  });

  describe('GET /api/sessions/:sessionId', () => {
    it('should get session details', async () => {
      const { session } = await createSessionWithAnswers(2, { 
        userId: 12345,
        quizId: quiz._id 
      });

      const response = await request(app)
        .get(`/api/sessions/${session._id}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.session.id.toString()).toBe(session._id.toString());
      expect(response.body.data.session.answeredQuestions).toBe(2);
      expect(response.body.data.quiz).toBeDefined();
    });

    it('should not allow access to other users session', async () => {
      const { session } = await createSessionWithAnswers(2, { 
        userId: 99999,
        quizId: quiz._id 
      });

      const response = await request(app)
        .get(`/api/sessions/${session._id}`)
        .set(authHeaders)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Sesja nie została znaleziona');
    });
  });

  describe('POST /api/sessions/:sessionId/pause', () => {
    it('should pause active session', async () => {
      const session = await createSession({ 
        userId: 12345, 
        quizId: quiz._id,
        status: 'in-progress'
      });

      const response = await request(app)
        .post(`/api/sessions/${session._id}/pause`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('paused');
    });
  });

  describe('POST /api/sessions/:sessionId/resume', () => {
    it('should resume paused session', async () => {
      const session = await createSession({ 
        userId: 12345, 
        quizId: quiz._id,
        status: 'paused'
      });

      const response = await request(app)
        .post(`/api/sessions/${session._id}/resume`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('in-progress');
    });
  });
}); 