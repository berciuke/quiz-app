const request = require('supertest');
const app = require('../../src/app');
const { createQuestion, createQuestionsByType } = require('../factories/question.factory');
const { createQuiz } = require('../factories/quiz.factory');
const { getAuthHeaders } = require('../helpers/auth.helper');

describe('Question API Integration Tests', () => {
  const authHeaders = getAuthHeaders();
  let quiz;
  
  beforeEach(async () => {
    // Każdy test potrzebuje quizu, bo pytania są zawsze częścią quizu
    quiz = await createQuiz();
  });

  describe('POST /api/quizzes/:quizId/questions', () => {
    it('should add a question to quiz', async () => {
      const questionData = {
        text: 'What is the capital of Poland?',
        type: 'single',
        options: ['Warsaw', 'Krakow', 'Gdansk', 'Poznan'],
        correctAnswers: ['Warsaw'],
        points: 2
      };

      const response = await request(app)
        .post(`/api/quizzes/${quiz._id}/questions`)
        .set(authHeaders)
        .send(questionData)
        .expect(201);

      expect(response.body.message).toBe('Question added successfully');
      expect(response.body.question.text).toBe(questionData.text);
      expect(response.body.question.type).toBe(questionData.type);
      expect(response.body.question.createdBy).toBe('12345');
    });
    
    it('should validate question type', async () => {
      const questionData = {
        text: 'Test question?',
        type: 'invalid-type',
        correctAnswers: ['answer']
      };

      const response = await request(app)
        .post(`/api/quizzes/${quiz._id}/questions`)
        .set(authHeaders)
        .send(questionData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });
    
    it('should require authentication', async () => {
      const questionData = {
        text: 'Test question?',
        type: 'single',
        correctAnswers: ['answer']
      };

      const response = await request(app)
        .post(`/api/quizzes/${quiz._id}/questions`)
        .send(questionData)
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
    });

    it('should not allow adding questions to other users quiz', async () => {
      const otherUserQuiz = await createQuiz({ createdBy: '99999' });
      const questionData = {
        text: 'Test question?',
        type: 'single',
        options: ['A', 'B'],
        correctAnswers: ['A']
      };

      const response = await request(app)
        .post(`/api/quizzes/${otherUserQuiz._id}/questions`)
        .set(authHeaders)
        .send(questionData)
        .expect(403);

      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('GET /api/quizzes/:quizId/questions', () => {
    it('should get questions for a quiz', async () => {
      // Dodaj kilka pytań do quizu
      const questions = await createQuestionsByType('single', 3);
      quiz.questions = questions.map(q => q._id);
      await quiz.save();

      const response = await request(app)
        .get(`/api/quizzes/${quiz._id}/questions`)
        .set(authHeaders)
        .expect(200);

      expect(response.body).toHaveLength(3);
      response.body.forEach(question => {
        expect(question.type).toBe('single');
      });
    });

    it('should return empty array for quiz with no questions', async () => {
      const response = await request(app)
        .get(`/api/quizzes/${quiz._id}/questions`)
        .set(authHeaders)
        .expect(200);

      expect(response.body).toHaveLength(0);
    });
  });

  describe('GET /api/questions/:id', () => {
    it('should get a specific question', async () => {
      const question = await createQuestion();

      const response = await request(app)
        .get(`/api/questions/${question._id}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.text).toBe(question.text);
      expect(response.body.type).toBe(question.type);
    });

    it('should return 404 for non-existent question', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      
      const response = await request(app)
        .get(`/api/questions/${fakeId}`)
        .set(authHeaders)
        .expect(404);

      expect(response.body.error).toBe('Question not found');
    });
  });

  describe('PUT /api/questions/:id', () => {
    it('should update a question', async () => {
      const question = await createQuestion();
      const updateData = {
        text: 'Updated question text?',
        points: 5
      };

      const response = await request(app)
        .put(`/api/questions/${question._id}`)
        .set(authHeaders)
        .send(updateData)
        .expect(200);

      expect(response.body.message).toBe('Question updated successfully');
      expect(response.body.question.text).toBe(updateData.text);
      expect(response.body.question.points).toBe(updateData.points);
    });

    it('should not allow updating other users questions', async () => {
      const question = await createQuestion({ createdBy: '99999' });
      const updateData = { text: 'Hacked question?' };

      const response = await request(app)
        .put(`/api/questions/${question._id}`)
        .set(authHeaders)
        .send(updateData)
        .expect(403);

      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('DELETE /api/questions/:id', () => {
    it('should delete a question', async () => {
      const question = await createQuestion();

      const response = await request(app)
        .delete(`/api/questions/${question._id}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.message).toBe('Question deleted successfully');
    });

    it('should not allow deleting other users questions', async () => {
      const question = await createQuestion({ createdBy: '99999' });

      const response = await request(app)
        .delete(`/api/questions/${question._id}`)
        .set(authHeaders)
        .expect(403);

      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('GET /api/user/questions', () => {
    it('should get user questions', async () => {
      await createQuestion({ createdBy: '12345' });
      await createQuestion({ createdBy: '12345' });
      await createQuestion({ createdBy: '99999' }); // inne użytkownik

      const response = await request(app)
        .get('/api/user/questions')
        .set(authHeaders)
        .expect(200);

             expect(response.body.questions).toHaveLength(2);
       expect(response.body.total).toBe(2);
       response.body.questions.forEach(question => {
         expect(question.createdBy).toBe('12345');
       });
    });
  });
}); 