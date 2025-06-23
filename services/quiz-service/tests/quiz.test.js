const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/index');
const Quiz = require('../src/models/Quiz');

describe('Quiz Service', () => {
  let testQuizId;
  const mockUser = {
    id: 'test-user-123',
    username: 'testuser',
    roles: ['user']
  };

  const mockAdmin = {
    id: 'admin-user-123',
    username: 'admin',
    roles: ['admin']
  };

  const sampleQuiz = {
    title: 'Test Quiz',
    description: 'This is a test quiz',
    category: 'science',
    difficulty: 'medium',
    duration: 30,
    isPublic: true,
    language: 'pl',
    tags: ['test', 'science']
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/quiz_test_db');
    }
  });

  beforeEach(async () => {
    await Quiz.deleteMany({});
  });

  afterAll(async () => {
    await Quiz.deleteMany({});
    await mongoose.connection.close();
  });

  describe('POST /api/quizzes', () => {
    it('should create a new quiz with valid data', async () => {
      const response = await request(app)
        .post('/api/quizzes')
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .send(sampleQuiz)
        .expect(201);

      expect(response.body.message).toBe('Quiz created successfully');
      expect(response.body.quiz.title).toBe(sampleQuiz.title);
      expect(response.body.quiz.createdBy).toBe(mockUser.id);
      testQuizId = response.body.quiz._id;
    });

    it('should reject quiz creation without authentication', async () => {
      await request(app)
        .post('/api/quizzes')
        .send(sampleQuiz)
        .expect(401);
    });

    it('should reject quiz with invalid title', async () => {
      const invalidQuiz = { ...sampleQuiz, title: 'x' }; // Too short
      
      await request(app)
        .post('/api/quizzes')
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .send(invalidQuiz)
        .expect(400);
    });

    it('should reject quiz with invalid category', async () => {
      const invalidQuiz = { ...sampleQuiz, category: 'invalid_category' };
      
      await request(app)
        .post('/api/quizzes')
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .send(invalidQuiz)
        .expect(400);
    });
  });

  describe('GET /api/quizzes', () => {
    beforeEach(async () => {
      await Quiz.create([
        { ...sampleQuiz, title: 'Public Quiz 1', createdBy: mockUser.id },
        { ...sampleQuiz, title: 'Public Quiz 2', createdBy: mockUser.id, difficulty: 'hard' },
        { ...sampleQuiz, title: 'Private Quiz', isPublic: false, createdBy: mockUser.id }
      ]);
    });

    it('should get all public quizzes', async () => {
      const response = await request(app)
        .get('/api/quizzes')
        .expect(200);

      expect(response.body.total).toBe(2);
      expect(response.body.quizzes).toHaveLength(2);
      expect(response.body.quizzes.every(quiz => quiz.isPublic)).toBe(true);
    });

    it('should filter quizzes by category', async () => {
      const response = await request(app)
        .get('/api/quizzes?category=science')
        .expect(200);

      expect(response.body.quizzes.every(quiz => quiz.category === 'science')).toBe(true);
    });

    it('should filter quizzes by difficulty', async () => {
      const response = await request(app)
        .get('/api/quizzes?difficulty=hard')
        .expect(200);

      expect(response.body.total).toBe(1);
      expect(response.body.quizzes[0].difficulty).toBe('hard');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/quizzes?page=1&limit=1')
        .expect(200);

      expect(response.body.limit).toBe(1);
      expect(response.body.quizzes).toHaveLength(1);
    });
  });

  describe('GET /api/quizzes/:id', () => {
    let publicQuizId, privateQuizId;

    beforeEach(async () => {
      const publicQuiz = await Quiz.create({ ...sampleQuiz, createdBy: mockUser.id });
      const privateQuiz = await Quiz.create({ 
        ...sampleQuiz, 
        title: 'Private Quiz', 
        isPublic: false, 
        createdBy: mockUser.id 
      });
      
      publicQuizId = publicQuiz._id;
      privateQuizId = privateQuiz._id;
    });

    it('should get public quiz without authentication', async () => {
      const response = await request(app)
        .get(`/api/quizzes/${publicQuizId}`)
        .expect(200);

      expect(response.body.title).toBe(sampleQuiz.title);
    });

    it('should get public quiz and increment views when authenticated', async () => {
      await request(app)
        .get(`/api/quizzes/${publicQuizId}`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username
        })
        .expect(200);

      const quiz = await Quiz.findById(publicQuizId);
      expect(quiz.views).toBe(1);
    });

    it('should deny access to private quiz for non-owner', async () => {
      await request(app)
        .get(`/api/quizzes/${privateQuizId}`)
        .set({
          'x-user-id': 'other-user',
          'x-user-username': 'otheruser'
        })
        .expect(403);
    });

    it('should allow owner access to private quiz', async () => {
      const response = await request(app)
        .get(`/api/quizzes/${privateQuizId}`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username
        })
        .expect(200);

      expect(response.body.title).toBe('Private Quiz');
    });

    it('should return 404 for non-existent quiz', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .get(`/api/quizzes/${fakeId}`)
        .expect(404);
    });
  });

  describe('PUT /api/quizzes/:id', () => {
    let quizId;

    beforeEach(async () => {
      const quiz = await Quiz.create({ ...sampleQuiz, createdBy: mockUser.id });
      quizId = quiz._id;
    });

    it('should update quiz by owner', async () => {
      const updateData = { title: 'Updated Quiz Title', difficulty: 'hard' };

      const response = await request(app)
        .put(`/api/quizzes/${quizId}`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .send(updateData)
        .expect(200);

      expect(response.body.quiz.title).toBe('Updated Quiz Title');
      expect(response.body.quiz.difficulty).toBe('hard');
    });

    it('should update quiz by admin', async () => {
      const updateData = { title: 'Admin Updated Quiz' };

      await request(app)
        .put(`/api/quizzes/${quizId}`)
        .set({
          'x-user-id': mockAdmin.id,
          'x-user-username': mockAdmin.username,
          'x-user-roles': mockAdmin.roles.join(',')
        })
        .send(updateData)
        .expect(200);
    });

    it('should deny update by non-owner non-admin', async () => {
      const updateData = { title: 'Unauthorized Update' };

      await request(app)
        .put(`/api/quizzes/${quizId}`)
        .set({
          'x-user-id': 'other-user',
          'x-user-username': 'otheruser',
          'x-user-roles': 'user'
        })
        .send(updateData)
        .expect(403);
    });
  });

  describe('DELETE /api/quizzes/:id', () => {
    let quizId;

    beforeEach(async () => {
      const quiz = await Quiz.create({ ...sampleQuiz, createdBy: mockUser.id });
      quizId = quiz._id;
    });

    it('should delete quiz by owner', async () => {
      await request(app)
        .delete(`/api/quizzes/${quizId}`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .expect(200);

      const deletedQuiz = await Quiz.findById(quizId);
      expect(deletedQuiz).toBeNull();
    });

    it('should delete quiz by admin', async () => {
      await request(app)
        .delete(`/api/quizzes/${quizId}`)
        .set({
          'x-user-id': mockAdmin.id,
          'x-user-username': mockAdmin.username,
          'x-user-roles': mockAdmin.roles.join(',')
        })
        .expect(200);
    });

    it('should deny deletion by non-owner non-admin', async () => {
      await request(app)
        .delete(`/api/quizzes/${quizId}`)
        .set({
          'x-user-id': 'other-user',
          'x-user-username': 'otheruser',
          'x-user-roles': 'user'
        })
        .expect(403);
    });
  });

  describe('GET /api/quizzes/search', () => {
    beforeEach(async () => {
      await Quiz.create([
        { ...sampleQuiz, title: 'JavaScript Basics', tags: ['javascript', 'programming'], createdBy: mockUser.id },
        { ...sampleQuiz, title: 'Python Advanced', tags: ['python', 'programming'], createdBy: mockUser.id },
        { ...sampleQuiz, title: 'History Quiz', category: 'history', createdBy: mockUser.id }
      ]);
    });

    it('should search quizzes by text query', async () => {
      const response = await request(app)
        .get('/api/quizzes/search?q=javascript')
        .expect(200);

      expect(response.body.total).toBe(1);
      expect(response.body.quizzes[0].title).toContain('JavaScript');
    });

    it('should search quizzes by tags', async () => {
      const response = await request(app)
        .get('/api/quizzes/search?tags=programming')
        .expect(200);

      expect(response.body.total).toBe(2);
    });

    it('should search quizzes by category', async () => {
      const response = await request(app)
        .get('/api/quizzes/search?category=history')
        .expect(200);

      expect(response.body.total).toBe(1);
      expect(response.body.quizzes[0].category).toBe('history');
    });
  });

  describe('POST /api/quizzes/:id/comments', () => {
    let quizId;

    beforeEach(async () => {
      const quiz = await Quiz.create({ ...sampleQuiz, createdBy: mockUser.id });
      quizId = quiz._id;
    });

    it('should add comment to quiz', async () => {
      const commentData = { text: 'Great quiz!' };

      const response = await request(app)
        .post(`/api/quizzes/${quizId}/comments`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .send(commentData)
        .expect(201);

      expect(response.body.comment.text).toBe('Great quiz!');
      expect(response.body.comment.userId).toBe(mockUser.id);
    });

    it('should reject empty comment', async () => {
      await request(app)
        .post(`/api/quizzes/${quizId}/comments`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .send({ text: '' })
        .expect(400);
    });
  });

  describe('POST /api/quizzes/:id/rate', () => {
    let quizId;

    beforeEach(async () => {
      const quiz = await Quiz.create({ ...sampleQuiz, createdBy: mockUser.id });
      quizId = quiz._id;
    });

    it('should rate quiz with valid rating', async () => {
      await request(app)
        .post(`/api/quizzes/${quizId}/rate`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .send({ value: 5 })
        .expect(200);

      const quiz = await Quiz.findById(quizId);
      expect(quiz.ratings).toHaveLength(1);
      expect(quiz.ratings[0].value).toBe(5);
    });

    it('should update existing rating', async () => {
      await request(app)
        .post(`/api/quizzes/${quizId}/rate`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .send({ value: 3 })
        .expect(200);

      await request(app)
        .post(`/api/quizzes/${quizId}/rate`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .send({ value: 5 })
        .expect(200);

      const quiz = await Quiz.findById(quizId);
      expect(quiz.ratings).toHaveLength(1);
      expect(quiz.ratings[0].value).toBe(5);
    });

    it('should reject invalid rating', async () => {
      await request(app)
        .post(`/api/quizzes/${quizId}/rate`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .send({ value: 6 })
        .expect(400);
    });
  });
}); 