const request = require('supertest');
const app = require('../../src/app');
const { createQuizWithQuestions } = require('../factories/quiz.factory');
const { createQuestion } = require('../factories/question.factory');
const { createSession, createSessionWithAnswers, createCompletedSession } = require('../factories/session.factory');
const { getAuthHeaders } = require('../helpers/auth.helper');
const { clearCollections } = require('../helpers/db.helper');

describe('Session API Integration Tests', () => {
  const authHeaders = getAuthHeaders();
  const otherUserHeaders = getAuthHeaders({ id: '67890', email: 'other@test.com' });
  let quiz, questions;

  beforeEach(async () => {
    await clearCollections();
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
      expect(response.body.data.sessionId).toBeDefined();
      expect(response.body.data.quiz.id.toString()).toBe(quiz._id.toString());
      expect(response.body.data.session.status).toBe('in-progress');
      expect(response.body.data.session.firstAttempt).toBe(true);
    });

    it('should return existing session if already in progress', async () => {
      // Start first session
      const firstResponse = await request(app)
        .post(`/api/sessions/start/${quiz._id}`)
        .set(authHeaders)
        .expect(201);

      // Try to start another session
      const secondResponse = await request(app)
        .post(`/api/sessions/start/${quiz._id}`)
        .set(authHeaders)
        .expect(200);

      expect(secondResponse.body.data.sessionId.toString())
        .toBe(firstResponse.body.data.sessionId.toString());
      expect(secondResponse.body.message).toContain('Kontynuacja');
    });

    it('should mark subsequent attempts correctly', async () => {
      // Complete first session
      const session = await createCompletedSession({ userId: 12345, quizId: quiz._id });

      // Start new session
      const response = await request(app)
        .post(`/api/sessions/start/${quiz._id}`)
        .set(authHeaders)
        .expect(201);

      expect(response.body.data.session.firstAttempt).toBe(false);
    });

    it('should handle private quiz access', async () => {
      const privateQuiz = await createQuizWithQuestions(2, { 
        isPublic: false,
        createdBy: 'other-user'
      });

      await request(app)
        .post(`/api/sessions/start/${privateQuiz.quiz._id}`)
        .set(authHeaders)
        .expect(403);
    });

    it('should allow access to invited user for private quiz', async () => {
      const privateQuiz = await createQuizWithQuestions(2, { 
        isPublic: false,
        createdBy: 'other-user',
        invitedUsers: ['12345']
      });

      const response = await request(app)
        .post(`/api/sessions/start/${privateQuiz.quiz._id}`)
        .set(authHeaders)
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should handle inactive quiz', async () => {
      quiz.isActive = false;
      await quiz.save();

      await request(app)
        .post(`/api/sessions/start/${quiz._id}`)
        .set(authHeaders)
        .expect(403);
    });

    it('should calculate max score correctly', async () => {
      // Update question points
      questions[0].points = 5;
      questions[1].points = 3;
      questions[2].points = 2;
      await Promise.all(questions.map(q => q.save()));

      const response = await request(app)
        .post(`/api/sessions/start/${quiz._id}`)
        .set(authHeaders)
        .expect(201);

      expect(response.body.data.quiz.maxScore).toBe(10); // 5+3+2
    });

    it('should increment quiz views', async () => {
      const initialViews = quiz.views || 0;

      await request(app)
        .post(`/api/sessions/start/${quiz._id}`)
        .set(authHeaders)
        .expect(201);

      const reloadedQuiz = await require('../../src/models/Quiz').findById(quiz._id);
      expect(reloadedQuiz.views).toBe(initialViews + 1);
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/sessions/start/${quiz._id}`)
        .expect(401);
    });

    it('should return 404 for non-existent quiz', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      await request(app)
        .post(`/api/sessions/start/${fakeId}`)
        .set(authHeaders)
        .expect(404);
    });
  });

  describe('GET /api/sessions/:sessionId/question', () => {
    let session;

    beforeEach(async () => {
      session = await createSession({ 
        userId: 12345, 
        quizId: quiz._id,
        status: 'in-progress',
        maxScore: questions.reduce((sum, q) => sum + q.points, 0)
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
      expect(response.body.data.question.correctAnswers).toBeUndefined();
    });

    it('should include question metadata', async () => {
      const response = await request(app)
        .get(`/api/sessions/${session._id}/question`)
        .set(authHeaders)
        .expect(200);

      const question = response.body.data.question;
      expect(question.id).toBeDefined();
      expect(question.text).toBeDefined();
      expect(question.type).toBeDefined();
      expect(question.options).toBeDefined();
      expect(question.points).toBeDefined();
    });

    it('should include session progress', async () => {
      const response = await request(app)
        .get(`/api/sessions/${session._id}/question`)
        .set(authHeaders)
        .expect(200);

      const sessionData = response.body.data.session;
      expect(sessionData.currentQuestionIndex).toBe(0);
      expect(sessionData.answeredQuestions).toBe(0);
      expect(sessionData.currentScore).toBe(0);
      expect(sessionData.timeSpent).toBeGreaterThanOrEqual(0);
    });

    it('should handle session with some answered questions', async () => {
      // Add an answer to move to next question
      session.addAnswer(questions[0]._id, ['Option A'], true, 1, 10);
      await session.save();

      const response = await request(app)
        .get(`/api/sessions/${session._id}/question`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.data.question.questionNumber).toBe(2);
      expect(response.body.data.session.answeredQuestions).toBe(1);
      expect(response.body.data.session.currentScore).toBe(1);
    });

    it('should handle completed session', async () => {
      // Answer all questions
      session.currentQuestionIndex = 3;
      await session.save();

      await request(app)
        .get(`/api/sessions/${session._id}/question`)
        .set(authHeaders)
        .expect(400);
    });

    it('should not allow access to other users session', async () => {
      const otherSession = await createSession({ 
        userId: 99999, 
        quizId: quiz._id
      });

      await request(app)
        .get(`/api/sessions/${otherSession._id}/question`)
        .set(authHeaders)
        .expect(404);
    });

    it('should not allow access to inactive session', async () => {
      session.status = 'completed';
      await session.save();

      await request(app)
        .get(`/api/sessions/${session._id}/question`)
        .set(authHeaders)
        .expect(400);
    });

    it('should return 404 for non-existent session', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      await request(app)
        .get(`/api/sessions/${fakeId}/question`)
        .set(authHeaders)
        .expect(404);
    });
  });

  describe('POST /api/sessions/:sessionId/answer', () => {
    let session;

    beforeEach(async () => {
      session = await createSession({ 
        userId: 12345, 
        quizId: quiz._id,
        status: 'in-progress',
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
      expect(response.body.data.correctAnswers).toEqual(firstQuestion.correctAnswers);
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
    });

    it('should handle multiple choice questions', async () => {
      const multipleQuestion = await createQuestion({
        type: 'multiple',
        options: ['A', 'B', 'C', 'D'],
        correctAnswers: ['A', 'C']
      });

      const answerData = {
        questionId: multipleQuestion._id,
        selectedAnswers: ['A', 'C'],
        timeSpent: 20
      };

      const response = await request(app)
        .post(`/api/sessions/${session._id}/answer`)
        .set(authHeaders)
        .send(answerData)
        .expect(200);

      expect(response.body.data.correct).toBe(true);
    });

    it('should handle partial multiple choice answers', async () => {
      const multipleQuestion = await createQuestion({
        type: 'multiple',
        options: ['A', 'B', 'C', 'D'],
        correctAnswers: ['A', 'C']
      });

      const answerData = {
        questionId: multipleQuestion._id,
        selectedAnswers: ['A'], // Only partial correct
        timeSpent: 15
      };

      const response = await request(app)
        .post(`/api/sessions/${session._id}/answer`)
        .set(authHeaders)
        .send(answerData)
        .expect(200);

      expect(response.body.data.correct).toBe(false);
    });

    it('should handle boolean questions', async () => {
      const boolQuestion = await createQuestion({
        type: 'boolean',
        options: ['Prawda', 'Fałsz'],
        correctAnswers: ['Prawda']
      });

      const answerData = {
        questionId: boolQuestion._id,
        selectedAnswers: ['Prawda'],
        timeSpent: 5
      };

      const response = await request(app)
        .post(`/api/sessions/${session._id}/answer`)
        .set(authHeaders)
        .send(answerData)
        .expect(200);

      expect(response.body.data.correct).toBe(true);
    });

    it('should handle text questions with case insensitive matching', async () => {
      const textQuestion = await createQuestion({
        type: 'text',
        correctAnswers: ['JavaScript', 'javascript']
      });

      const answerData = {
        questionId: textQuestion._id,
        selectedAnswers: ['JAVASCRIPT'],
        timeSpent: 25
      };

      const response = await request(app)
        .post(`/api/sessions/${session._id}/answer`)
        .set(authHeaders)
        .send(answerData)
        .expect(200);

      expect(response.body.data.correct).toBe(true);
    });

    it('should update session progress', async () => {
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

      expect(response.body.data.currentScore).toBe(firstQuestion.points);
      expect(response.body.data.answeredQuestions).toBe(1);
      expect(response.body.data.nextQuestionIndex).toBe(1);
    });

    it('should prevent duplicate answers', async () => {
      const firstQuestion = questions[0];
      const answerData = {
        questionId: firstQuestion._id,
        selectedAnswers: firstQuestion.correctAnswers,
        timeSpent: 15
      };

      // Submit first answer
      await request(app)
        .post(`/api/sessions/${session._id}/answer`)
        .set(authHeaders)
        .send(answerData)
        .expect(200);

      // Try to submit again
      await request(app)
        .post(`/api/sessions/${session._id}/answer`)
        .set(authHeaders)
        .send(answerData)
        .expect(400);
    });

    it('should validate required fields', async () => {
      // Missing questionId
      await request(app)
        .post(`/api/sessions/${session._id}/answer`)
        .set(authHeaders)
        .send({
          selectedAnswers: ['answer'],
          timeSpent: 10
        })
        .expect(400);

      // Missing selectedAnswers
      await request(app)
        .post(`/api/sessions/${session._id}/answer`)
        .set(authHeaders)
        .send({
          questionId: questions[0]._id,
          timeSpent: 10
        })
        .expect(400);

      // Empty selectedAnswers
      await request(app)
        .post(`/api/sessions/${session._id}/answer`)
        .set(authHeaders)
        .send({
          questionId: questions[0]._id,
          selectedAnswers: [],
          timeSpent: 10
        })
        .expect(400);
    });

    it('should handle non-existent question', async () => {
      const fakeQuestionId = '507f1f77bcf86cd799439011';

      await request(app)
        .post(`/api/sessions/${session._id}/answer`)
        .set(authHeaders)
        .send({
          questionId: fakeQuestionId,
          selectedAnswers: ['answer'],
          timeSpent: 10
        })
        .expect(404);
    });

    it('should not allow access to other users session', async () => {
      const otherSession = await createSession({ 
        userId: 99999, 
        quizId: quiz._id
      });

      await request(app)
        .post(`/api/sessions/${otherSession._id}/answer`)
        .set(authHeaders)
        .send({
          questionId: questions[0]._id,
          selectedAnswers: ['answer'],
          timeSpent: 10
        })
        .expect(404);
    });

    it('should not allow answers to inactive session', async () => {
      session.status = 'completed';
      await session.save();

      await request(app)
        .post(`/api/sessions/${session._id}/answer`)
        .set(authHeaders)
        .send({
          questionId: questions[0]._id,
          selectedAnswers: ['answer'],
          timeSpent: 10
        })
        .expect(400);
    });
  });

  describe('POST /api/sessions/:sessionId/complete', () => {
    it('should complete session', async () => {
      const session = await createSession({ 
        userId: 12345,
        quizId: quiz._id,
        status: 'in-progress',
        maxScore: questions.reduce((sum, q) => sum + q.points, 0)
      });

      // Add some answers
      session.addAnswer(questions[0]._id, ['Option A'], true, 1, 10);
      session.addAnswer(questions[1]._id, ['wrong'], false, 0, 15);
      session.addAnswer(questions[2]._id, ['Option A'], true, 1, 12);
      await session.save();

      const response = await request(app)
        .post(`/api/sessions/${session._id}/complete`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.session.score).toBe(2);
      expect(response.body.data.session.accuracy).toBeCloseTo(66.67, 1);
      expect(response.body.data.session.correctAnswers).toBe(2);
      expect(response.body.data.session.totalQuestions).toBe(3);
    });

    it('should handle perfect score', async () => {
      const session = await createSession({ 
        userId: 12345,
        quizId: quiz._id,
        status: 'in-progress',
        maxScore: 3
      });

      // All correct answers
      session.addAnswer(questions[0]._id, ['Option A'], true, 1, 10);
      session.addAnswer(questions[1]._id, ['Option A'], true, 1, 10);
      session.addAnswer(questions[2]._id, ['Option A'], true, 1, 10);
      await session.save();

      const response = await request(app)
        .post(`/api/sessions/${session._id}/complete`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.data.session.perfectScore).toBe(true);
      expect(response.body.data.session.accuracy).toBe(100);
    });

    it('should calculate speed bonus', async () => {
      const session = await createSession({ 
        userId: 12345,
        quizId: quiz._id,
        status: 'in-progress',
        startedAt: new Date(Date.now() - 30000) // 30 seconds ago
      });

      // Quick answers (should trigger speed bonus)
      session.addAnswer(questions[0]._id, ['Option A'], true, 1, 5);
      session.addAnswer(questions[1]._id, ['Option A'], true, 1, 5);
      session.addAnswer(questions[2]._id, ['Option A'], true, 1, 5);
      await session.save();

      const response = await request(app)
        .post(`/api/sessions/${session._id}/complete`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.data.session.speedBonus).toBe(true);
    });

    it('should increment quiz play count', async () => {
      const session = await createSession({ 
        userId: 12345,
        quizId: quiz._id,
        status: 'in-progress'
      });

      const initialPlayCount = quiz.playCount || 0;

      await request(app)
        .post(`/api/sessions/${session._id}/complete`)
        .set(authHeaders)
        .expect(200);

      const reloadedQuiz = await require('../../src/models/Quiz').findById(quiz._id);
      expect(reloadedQuiz.playCount).toBe(initialPlayCount + 1);
    });

    it('should handle already completed session', async () => {
      const session = await createCompletedSession({ 
        userId: 12345,
        quizId: quiz._id
      });

      await request(app)
        .post(`/api/sessions/${session.session._id}/complete`)
        .set(authHeaders)
        .expect(400);
    });

    it('should handle user service communication failure gracefully', async () => {
      const session = await createSession({ 
        userId: 12345,
        quizId: quiz._id,
        status: 'in-progress'
      });

      session.addAnswer(questions[0]._id, ['Option A'], true, 1, 10);
      await session.save();

      // The response should still succeed even if user-service is down
      const response = await request(app)
        .post(`/api/sessions/${session._id}/complete`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.session.score).toBe(1);
    });

    it('should not allow completing other users session', async () => {
      const otherSession = await createSession({ 
        userId: 99999,
        quizId: quiz._id
      });

      await request(app)
        .post(`/api/sessions/${otherSession._id}/complete`)
        .set(authHeaders)
        .expect(404);
    });

    it('should return 404 for non-existent session', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      await request(app)
        .post(`/api/sessions/${fakeId}/complete`)
        .set(authHeaders)
        .expect(404);
    });
  });

  describe('Session state management', () => {
    let session;

    beforeEach(async () => {
      session = await createSession({ 
        userId: 12345, 
        quizId: quiz._id,
        status: 'in-progress'
      });
    });

    it('should pause session', async () => {
      const response = await request(app)
        .post(`/api/sessions/${session._id}/pause`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.data.status).toBe('paused');
      expect(response.body.data.pausedAt).toBeDefined();
    });

    it('should resume paused session', async () => {
      // First pause
      await request(app)
        .post(`/api/sessions/${session._id}/pause`)
        .set(authHeaders)
        .expect(200);

      // Then resume
      const response = await request(app)
        .post(`/api/sessions/${session._id}/resume`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.data.status).toBe('in-progress');
    });

    it('should not pause already paused session', async () => {
      // Pause first
      await request(app)
        .post(`/api/sessions/${session._id}/pause`)
        .set(authHeaders)
        .expect(200);

      // Try to pause again
      await request(app)
        .post(`/api/sessions/${session._id}/pause`)
        .set(authHeaders)
        .expect(400);
    });

    it('should not resume non-paused session', async () => {
      await request(app)
        .post(`/api/sessions/${session._id}/resume`)
        .set(authHeaders)
        .expect(400);
    });

    it('should not pause completed session', async () => {
      session.status = 'completed';
      await session.save();

      await request(app)
        .post(`/api/sessions/${session._id}/pause`)
        .set(authHeaders)
        .expect(400);
    });

    it('should not allow state changes by other users', async () => {
      await request(app)
        .post(`/api/sessions/${session._id}/pause`)
        .set(otherUserHeaders)
        .expect(404);
    });
  });

  describe('GET /api/sessions/:sessionId', () => {
    it('should get session details', async () => {
      const session = await createSessionWithAnswers(2, { 
        userId: 12345,
        quizId: quiz._id
      });

      const response = await request(app)
        .get(`/api/sessions/${session.session._id}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.session.id).toBeDefined();
      expect(response.body.data.session.status).toBeDefined();
      expect(response.body.data.session.score).toBeDefined();
      expect(response.body.data.session.answeredQuestions).toBe(2);
      expect(response.body.data.quiz.id).toBeDefined();
    });

    it('should not allow access to other users session', async () => {
      const otherSession = await createSession({ 
        userId: 99999,
        quizId: quiz._id
      });

      await request(app)
        .get(`/api/sessions/${otherSession._id}`)
        .set(authHeaders)
        .expect(404);
    });

    it('should return 404 for non-existent session', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      await request(app)
        .get(`/api/sessions/${fakeId}`)
        .set(authHeaders)
        .expect(404);
    });
  });

  describe('Session Statistics', () => {
    it('should get quiz session stats', async () => {
      // Create multiple sessions for the quiz
      await createCompletedSession({ userId: 12345, quizId: quiz._id });
      await createCompletedSession({ userId: 67890, quizId: quiz._id });

      const response = await request(app)
        .get(`/api/sessions/quiz/${quiz._id}/stats`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessions).toHaveLength(2);
      expect(response.body.data.total).toBe(2);
    });

    it('should get quiz trends', async () => {
      // Create sessions on different days would require date manipulation
      const response = await request(app)
        .get(`/api/sessions/quiz/${quiz._id}/trends`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.trends).toBeDefined();
    });

    it('should filter trends by date', async () => {
      const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const response = await request(app)
        .get(`/api/sessions/quiz/${quiz._id}/trends?from=${fromDate}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent quiz stats', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      await request(app)
        .get(`/api/sessions/quiz/${fakeId}/stats`)
        .set(authHeaders)
        .expect(404);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed session ID', async () => {
      await request(app)
        .get('/api/sessions/invalid-id/question')
        .set(authHeaders)
        .expect(400);
    });

    it('should handle malformed quiz ID in session start', async () => {
      await request(app)
        .post('/api/sessions/start/invalid-id')
        .set(authHeaders)
        .expect(400);
    });

    it('should require authentication for all endpoints', async () => {
      const session = await createSession({ userId: 12345, quizId: quiz._id });

      // Test all endpoints require auth
      await request(app).post(`/api/sessions/start/${quiz._id}`).expect(401);
      await request(app).get(`/api/sessions/${session._id}/question`).expect(401);
      await request(app).post(`/api/sessions/${session._id}/answer`).send({}).expect(401);
      await request(app).post(`/api/sessions/${session._id}/complete`).expect(401);
      await request(app).post(`/api/sessions/${session._id}/pause`).expect(401);
      await request(app).post(`/api/sessions/${session._id}/resume`).expect(401);
      await request(app).get(`/api/sessions/${session._id}`).expect(401);
    });

    it('should handle session without questions', async () => {
      const emptyQuiz = await createQuizWithQuestions(0);

      const response = await request(app)
        .post(`/api/sessions/start/${emptyQuiz.quiz._id}`)
        .set(authHeaders)
        .expect(201);

      expect(response.body.data.quiz.totalQuestions).toBe(0);
    });

    it('should handle concurrent session operations', async () => {
      const session = await createSession({ 
        userId: 12345,
        quizId: quiz._id,
        status: 'in-progress'
      });

      const answerData = {
        questionId: questions[0]._id,
        selectedAnswers: ['Option A'],
        timeSpent: 10
      };

      // Simulate concurrent answer submissions
      const promises = [
        request(app)
          .post(`/api/sessions/${session._id}/answer`)
          .set(authHeaders)
          .send(answerData),
        request(app)
          .post(`/api/sessions/${session._id}/answer`)
          .set(authHeaders)
          .send(answerData)
      ];

      const responses = await Promise.allSettled(promises);
      
      // Check that at least one succeeded and one might have failed
      const successes = responses.filter(r => r.status === 'fulfilled' && r.value.status === 200);
      const failures = responses.filter(r => r.status === 'fulfilled' && r.value.status === 400);
      
      // Either one succeeds and one fails, or both succeed (depending on timing)
      expect(successes.length).toBeGreaterThanOrEqual(1);
      expect(successes.length + failures.length).toBe(2);
    });
  });
}); 