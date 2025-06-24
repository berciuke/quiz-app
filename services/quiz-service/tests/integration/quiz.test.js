const request = require('supertest');
const app = require('../../src/app');
const { createQuiz, createMultipleQuizzes, createQuizWithQuestions } = require('../factories/quiz.factory');
const { createCategory } = require('../factories/category.factory');
const { getAuthHeaders, createMockUser } = require('../helpers/auth.helper');

describe('Quiz API Integration Tests', () => {
  const authHeaders = getAuthHeaders();
  
  describe('POST /api/quizzes', () => {
    it('should create a new quiz', async () => {
      const category = await createCategory();
      const quizData = {
        title: 'New Test Quiz',
        description: 'A test quiz description',
        difficulty: 'medium',
        category: category._id.toString()
      };

      const response = await request(app)
        .post('/api/quizzes')
        .set(authHeaders)
        .send(quizData)
        .expect(201);

      expect(response.body.message).toBe('Quiz created successfully');
      expect(response.body.quiz.title).toBe(quizData.title);
      expect(response.body.quiz.difficulty).toBe(quizData.difficulty);
      expect(response.body.quiz.createdBy).toBe('12345');
    });
    
    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/quizzes')
        .set(authHeaders)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });
    
    it('should require authentication', async () => {
      const category = await createCategory();
      const quizData = {
        title: 'Test Quiz',
        category: category._id.toString()
      };

      const response = await request(app)
        .post('/api/quizzes')
        .send(quizData)
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
    });
  });

  describe('GET /api/quizzes', () => {
    beforeEach(async () => {
      await createMultipleQuizzes(5);
    });

    it('should get all public quizzes', async () => {
      const response = await request(app)
        .get('/api/quizzes')
        .set(authHeaders)
        .expect(200);

      expect(response.body.quizzes).toHaveLength(5);
      expect(response.body.total).toBeDefined();
      expect(response.body.page).toBe(1);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/quizzes?page=1&limit=2')
        .set(authHeaders)
        .expect(200);

      expect(response.body.quizzes).toHaveLength(2);
      expect(response.body.limit).toBe(2);
      expect(response.body.page).toBe(1);
    });

    it('should filter by difficulty', async () => {
      await createQuiz({ difficulty: 'hard' });
      
      const response = await request(app)
        .get('/api/quizzes?difficulty=hard')
        .set(authHeaders)
        .expect(200);

      expect(response.body.quizzes).toBeDefined();
      response.body.quizzes.forEach(quiz => {
        expect(quiz.difficulty).toBe('hard');
      });
    });
  });

  describe('GET /api/quizzes/:id', () => {
    it('should get a specific quiz', async () => {
      const { quiz, questions } = await createQuizWithQuestions(3);

      const response = await request(app)
        .get(`/api/quizzes/${quiz._id}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.title).toBe(quiz.title);
      expect(response.body.questions).toHaveLength(3);
    });

    it('should return 404 for non-existent quiz', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      
      const response = await request(app)
        .get(`/api/quizzes/${fakeId}`)
        .set(authHeaders)
        .expect(404);

      expect(response.body.error).toBe('Quiz not found');
    });

    it('should return 400 for invalid quiz ID', async () => {
      const response = await request(app)
        .get('/api/quizzes/invalid-id')
        .set(authHeaders)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('PUT /api/quizzes/:id', () => {
    it('should update a quiz', async () => {
      const quiz = await createQuiz();
      const updateData = {
        title: 'Updated Quiz Title',
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/quizzes/${quiz._id}`)
        .set(authHeaders)
        .send(updateData)
        .expect(200);

      expect(response.body.message).toBe('Quiz updated successfully');
      expect(response.body.quiz.title).toBe(updateData.title);
      expect(response.body.quiz.description).toBe(updateData.description);
    });

    it('should not allow updating quiz by different user', async () => {
      const quiz = await createQuiz({ createdBy: '99999' });
      const updateData = { title: 'Hacked Title' };

      const response = await request(app)
        .put(`/api/quizzes/${quiz._id}`)
        .set(authHeaders)
        .send(updateData)
        .expect(403);

      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('DELETE /api/quizzes/:id', () => {
    it('should delete a quiz', async () => {
      const quiz = await createQuiz();

      const response = await request(app)
        .delete(`/api/quizzes/${quiz._id}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.message).toBe('Quiz deleted successfully');
    });

    it('should not allow deleting quiz by different user', async () => {
      const quiz = await createQuiz({ createdBy: '99999' });

      const response = await request(app)
        .delete(`/api/quizzes/${quiz._id}`)
        .set(authHeaders)
        .expect(403);

      expect(response.body.error).toBe('Access denied');
    });
  });
}); 