const request = require('supertest');
const app = require('../../src/app');
const { createQuiz, createQuizWithQuestions, createMultipleQuizzes } = require('../factories/quiz.factory');
const { createCategory } = require('../factories/category.factory');
const { createTag } = require('../factories/tag.factory');
const { getAuthHeaders } = require('../helpers/auth.helper');
const { clearCollections } = require('../helpers/db.helper');

describe('Quiz API Integration Tests', () => {
  const authHeaders = getAuthHeaders();
  const instructorHeaders = getAuthHeaders({ role: 'instructor' });
  const adminHeaders = getAuthHeaders({ role: 'admin' });
  const otherUserHeaders = getAuthHeaders({ id: '67890', email: 'other@test.com' });
  
  beforeEach(async () => {
    await clearCollections();
  });

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
      expect(response.body.quiz.createdBy).toBe('12345');
    });

    it('should create quiz with tags', async () => {
      const category = await createCategory();
      const quizData = {
        title: 'Tagged Quiz',
        description: 'Quiz with tags',
        category: category._id.toString(),
        tags: ['javascript', 'programming', 'web']
      };

      const response = await request(app)
        .post('/api/quizzes')
        .set(authHeaders)
        .send(quizData)
        .expect(201);

      expect(response.body.quiz.tags).toHaveLength(3);
    });

    it('should create quiz with string category name', async () => {
      const quizData = {
        title: 'Quiz with category name',
        description: 'Test',
        category: 'Programming'
      };

      const response = await request(app)
        .post('/api/quizzes')
        .set(authHeaders)
        .send(quizData)
        .expect(201);

      expect(response.body.quiz.category).toBeDefined();
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/quizzes')
        .set(authHeaders)
        .send({})
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should validate title length', async () => {
      const category = await createCategory();
      
      // Too short title
      let response = await request(app)
        .post('/api/quizzes')
        .set(authHeaders)
        .send({
          title: 'ab',
          category: category._id.toString()
        })
        .expect(400);

      expect(response.body.error).toBeDefined();

      // Too long title
      response = await request(app)
        .post('/api/quizzes')
        .set(authHeaders)
        .send({
          title: 'a'.repeat(201),
          category: category._id.toString()
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should validate difficulty values', async () => {
      const category = await createCategory();
      
      const response = await request(app)
        .post('/api/quizzes')
        .set(authHeaders)
        .send({
          title: 'Test Quiz',
          category: category._id.toString(),
          difficulty: 'invalid'
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should set default values correctly', async () => {
      const category = await createCategory();
      const quizData = {
        title: 'Minimal Quiz',
        category: category._id.toString()
      };

      const response = await request(app)
        .post('/api/quizzes')
        .set(authHeaders)
        .send(quizData)
        .expect(201);

      expect(response.body.quiz.difficulty).toBe('medium');
      expect(response.body.quiz.isPublic).toBe(true);
      expect(response.body.quiz.isActive).toBe(true);
      expect(response.body.quiz.language).toBe('en');
    });
    
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/quizzes')
        .send({ title: 'Test Quiz' })
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
    });
  });

  describe('GET /api/quizzes', () => {
    it('should get public quizzes', async () => {
      await createQuiz();
      await createQuiz({ title: 'Quiz 2' });

      const response = await request(app)
        .get('/api/quizzes')
        .set(authHeaders)
        .expect(200);

      expect(response.body.quizzes.length).toBeGreaterThanOrEqual(2);
      expect(response.body.total).toBeDefined();
    });

    it('should support pagination', async () => {
      await createMultipleQuizzes(15);

      const response = await request(app)
        .get('/api/quizzes?page=2&limit=5')
        .set(authHeaders)
        .expect(200);

      expect(response.body.quizzes).toHaveLength(5);
      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(5);
      expect(response.body.total).toBe(15);
    });

    it('should filter by category', async () => {
      const category1 = await createCategory({ name: 'Math' });
      const category2 = await createCategory({ name: 'Science' });
      
      await createQuiz({ category: category1._id });
      await createQuiz({ category: category2._id });

      const response = await request(app)
        .get('/api/quizzes?category=Math')
        .set(authHeaders)
        .expect(200);

      expect(response.body.quizzes).toHaveLength(1);
      expect(response.body.quizzes[0].category.name).toBe('Math');
    });

    it('should filter by difficulty', async () => {
      await createQuiz({ difficulty: 'easy' });
      await createQuiz({ difficulty: 'hard' });

      const response = await request(app)
        .get('/api/quizzes?difficulty=easy')
        .set(authHeaders)
        .expect(200);

      expect(response.body.quizzes).toHaveLength(1);
      expect(response.body.quizzes[0].difficulty).toBe('easy');
    });

    it('should filter by language', async () => {
      await createQuiz({ language: 'en' });
      await createQuiz({ language: 'es' });

      const response = await request(app)
        .get('/api/quizzes?language=en')
        .set(authHeaders)
        .expect(200);

      expect(response.body.quizzes).toHaveLength(1);
      expect(response.body.quizzes[0].language).toBe('en');
    });

    it('should sort by different fields', async () => {
      await createQuiz({ title: 'A Quiz', views: 100 });
      await createQuiz({ title: 'B Quiz', views: 200 });

      // Sort by views descending
      let response = await request(app)
        .get('/api/quizzes?sortBy=views&sortOrder=desc')
        .set(authHeaders)
        .expect(200);

      expect(response.body.quizzes[0].views).toBe(200);

      // Sort by title ascending
      response = await request(app)
        .get('/api/quizzes?sortBy=title&sortOrder=asc')
        .set(authHeaders)
        .expect(200);

      expect(response.body.quizzes[0].title).toBe('A Quiz');
    });

    it('should hide private quizzes from other users', async () => {
      await createQuiz({ isPublic: true });
      await createQuiz({ isPublic: false, createdBy: '67890' });

      const response = await request(app)
        .get('/api/quizzes')
        .set(authHeaders)
        .expect(200);

      expect(response.body.quizzes).toHaveLength(1);
      expect(response.body.quizzes[0].isPublic).toBe(true);
    });
  });

  describe('GET /api/quizzes/search', () => {
    it('should search by keywords', async () => {
      await createQuiz({ title: 'JavaScript Basics', description: 'Learn JS' });
      await createQuiz({ title: 'Python Advanced', description: 'Advanced Python' });

      const response = await request(app)
        .get('/api/quizzes/search?q=JavaScript')
        .set(authHeaders)
        .expect(200);

      expect(response.body.quizzes).toHaveLength(1);
      expect(response.body.quizzes[0].title).toContain('JavaScript');
    });

    it('should search by description', async () => {
      await createQuiz({ title: 'Quiz 1', description: 'Advanced concepts' });
      await createQuiz({ title: 'Quiz 2', description: 'Basic concepts' });

      const response = await request(app)
        .get('/api/quizzes/search?keywords=Advanced')
        .set(authHeaders)
        .expect(200);

      expect(response.body.quizzes).toHaveLength(1);
      expect(response.body.quizzes[0].description).toContain('Advanced');
    });

    it('should combine search with filters', async () => {
      const category = await createCategory({ name: 'Programming' });
      await createQuiz({ 
        title: 'JavaScript Easy', 
        category: category._id, 
        difficulty: 'easy' 
      });
      await createQuiz({ 
        title: 'JavaScript Hard', 
        category: category._id, 
        difficulty: 'hard' 
      });

      const response = await request(app)
        .get('/api/quizzes/search?q=JavaScript&category=Programming&difficulty=easy')
        .set(authHeaders)
        .expect(200);

      expect(response.body.quizzes).toHaveLength(1);
      expect(response.body.quizzes[0].difficulty).toBe('easy');
    });
  });

  describe('GET /api/quizzes/:id', () => {
    it('should get a specific quiz', async () => {
      const { quiz } = await createQuizWithQuestions(2);

      const response = await request(app)
        .get(`/api/quizzes/${quiz._id}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.title).toBe(quiz.title);
      expect(response.body.questions).toHaveLength(2);
    });

    it('should increment view count', async () => {
      const quiz = await createQuiz({ views: 5 });

      // First call
      await request(app)
        .get(`/api/quizzes/${quiz._id}`)
        .set(authHeaders)
        .expect(200);

      // Second call - check that views increased
      const response = await request(app)
        .get(`/api/quizzes/${quiz._id}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.views).toBeGreaterThanOrEqual(6); // Should be at least 6 (5 + 1)
    });

    it('should return 404 for non-existent quiz', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      
      await request(app)
        .get(`/api/quizzes/${fakeId}`)
        .set(authHeaders)
        .expect(404);
    });

    it('should deny access to private quiz for non-owner', async () => {
      const quiz = await createQuiz({ 
        isPublic: false, 
        createdBy: '67890' 
      });

      await request(app)
        .get(`/api/quizzes/${quiz._id}`)
        .set(authHeaders)
        .expect(403);
    });

    it('should allow owner access to private quiz', async () => {
      const quiz = await createQuiz({ 
        isPublic: false, 
        createdBy: '12345' 
      });

      const response = await request(app)
        .get(`/api/quizzes/${quiz._id}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.title).toBe(quiz.title);
    });

    it('should validate MongoDB ObjectId format', async () => {
      await request(app)
        .get('/api/quizzes/invalid-id')
        .set(authHeaders)
        .expect(400);
    });
  });

  describe('GET /api/quizzes/user/my-quizzes', () => {
    it('should get user quizzes', async () => {
      await createQuiz({ createdBy: '12345' });
      await createQuiz({ createdBy: '12345' });
      await createQuiz({ createdBy: '67890' });

      const response = await request(app)
        .get('/api/quizzes/user/my-quizzes')
        .set(authHeaders)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.every(q => q.createdBy === '12345')).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/quizzes/user/my-quizzes')
        .expect(401);
    });
  });

  describe('PUT /api/quizzes/:id', () => {
    it('should update own quiz', async () => {
      const quiz = await createQuiz();
      const updateData = { title: 'Updated Title' };

      const response = await request(app)
        .put(`/api/quizzes/${quiz._id}`)
        .set(authHeaders)
        .send(updateData)
        .expect(200);

      expect(response.body.quiz.title).toBe(updateData.title);
    });

    it('should update multiple fields', async () => {
      const quiz = await createQuiz();
      const updateData = {
        title: 'New Title',
        description: 'New Description',
        difficulty: 'hard',
        isPublic: false
      };

      const response = await request(app)
        .put(`/api/quizzes/${quiz._id}`)
        .set(authHeaders)
        .send(updateData)
        .expect(200);

      expect(response.body.quiz.title).toBe('New Title');
      expect(response.body.quiz.description).toBe('New Description');
      expect(response.body.quiz.difficulty).toBe('hard');
      expect(response.body.quiz.isPublic).toBe(false);
    });

    it('should update tags', async () => {
      const quiz = await createQuiz();
      const updateData = {
        tags: ['new-tag', 'another-tag']
      };

      const response = await request(app)
        .put(`/api/quizzes/${quiz._id}`)
        .set(authHeaders)
        .send(updateData)
        .expect(200);

      expect(response.body.quiz.tags).toHaveLength(2);
    });

    it('should not allow updating other users quiz', async () => {
      const quiz = await createQuiz({ createdBy: 'other-user' });

      await request(app)
        .put(`/api/quizzes/${quiz._id}`)
        .set(authHeaders)
        .send({ title: 'Hacked Title' })
        .expect(403);
    });

    it('should allow admin to update any quiz', async () => {
      const quiz = await createQuiz({ createdBy: 'other-user' });

      const response = await request(app)
        .put(`/api/quizzes/${quiz._id}`)
        .set(adminHeaders)
        .send({ title: 'Admin Updated' })
        .expect(200);

      expect(response.body.quiz.title).toBe('Admin Updated');
    });

    it('should validate update data', async () => {
      const quiz = await createQuiz();

      await request(app)
        .put(`/api/quizzes/${quiz._id}`)
        .set(authHeaders)
        .send({ difficulty: 'invalid' })
        .expect(400);
    });

    it('should return 404 for non-existent quiz', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      
      await request(app)
        .put(`/api/quizzes/${fakeId}`)
        .set(authHeaders)
        .send({ title: 'New Title' })
        .expect(404);
    });
  });

  describe('DELETE /api/quizzes/:id', () => {
    it('should delete own quiz', async () => {
      const quiz = await createQuiz();

      await request(app)
        .delete(`/api/quizzes/${quiz._id}`)
        .set(authHeaders)
        .expect(200);
    });

    it('should not allow deleting other users quiz', async () => {
      const quiz = await createQuiz({ createdBy: 'other-user' });

      await request(app)
        .delete(`/api/quizzes/${quiz._id}`)
        .set(authHeaders)
        .expect(403);
    });

    it('should allow admin to delete any quiz', async () => {
      const quiz = await createQuiz({ createdBy: 'other-user' });

      await request(app)
        .delete(`/api/quizzes/${quiz._id}`)
        .set(adminHeaders)
        .expect(200);
    });

    it('should return 404 for non-existent quiz', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      
      await request(app)
        .delete(`/api/quizzes/${fakeId}`)
        .set(authHeaders)
        .expect(404);
    });
  });

  describe('Quiz Comments', () => {
    it('should add comment to quiz', async () => {
      const quiz = await createQuiz();

      const response = await request(app)
        .post(`/api/quizzes/${quiz._id}/comments`)
        .set(authHeaders)
        .send({ text: 'Great quiz!' })
        .expect(201);

      expect(response.body.message).toBe('Comment added successfully');
      expect(response.body.comment.text).toBe('Great quiz!');
    });

    it('should validate comment text', async () => {
      const quiz = await createQuiz();

      // Empty comment
      await request(app)
        .post(`/api/quizzes/${quiz._id}/comments`)
        .set(authHeaders)
        .send({ text: '' })
        .expect(400);

      // Too long comment
      await request(app)
        .post(`/api/quizzes/${quiz._id}/comments`)
        .set(authHeaders)
        .send({ text: 'a'.repeat(501) })
        .expect(400);
    });

    it('should require authentication for comments', async () => {
      const quiz = await createQuiz();

      await request(app)
        .post(`/api/quizzes/${quiz._id}/comments`)
        .send({ text: 'Comment' })
        .expect(401);
    });
  });

  describe('Quiz Ratings', () => {
    it('should rate quiz', async () => {
      const quiz = await createQuiz();

      const response = await request(app)
        .post(`/api/quizzes/${quiz._id}/rate`)
        .set(authHeaders)
        .send({ value: 5 })
        .expect(200);

      expect(response.body.message).toBe('Rating saved successfully');
      expect(response.body.averageRating).toBeDefined();
    });

    it('should update existing rating', async () => {
      const quiz = await createQuiz();

      // First rating
      await request(app)
        .post(`/api/quizzes/${quiz._id}/rate`)
        .set(authHeaders)
        .send({ value: 3 })
        .expect(200);

      // Update rating
      const response = await request(app)
        .post(`/api/quizzes/${quiz._id}/rate`)
        .set(authHeaders)
        .send({ value: 5 })
        .expect(200);

      expect(response.body.averageRating).toBe(5);
    });

    it('should validate rating value', async () => {
      const quiz = await createQuiz();

      await request(app)
        .post(`/api/quizzes/${quiz._id}/rate`)
        .set(authHeaders)
        .send({ value: 6 })
        .expect(400);

      await request(app)
        .post(`/api/quizzes/${quiz._id}/rate`)
        .set(authHeaders)
        .send({ value: 0 })
        .expect(400);
    });
  });

  describe('Quiz Invitations', () => {
    it('should invite user to private quiz', async () => {
      const quiz = await createQuiz({ isPublic: false });

      const response = await request(app)
        .post(`/api/quizzes/${quiz._id}/invite`)
        .set(authHeaders)
        .send({ userId: '67890' })
        .expect(201);

      expect(response.body.message).toBe('User invited successfully');
      expect(response.body.invitedUsers).toContain('67890');
    });

    it('should not allow non-owner to invite', async () => {
      const quiz = await createQuiz({ createdBy: 'other-user' });

      await request(app)
        .post(`/api/quizzes/${quiz._id}/invite`)
        .set(authHeaders)
        .send({ userId: '67890' })
        .expect(403);
    });

    it('should remove invitation', async () => {
      const quiz = await createQuiz({ 
        isPublic: false,
        invitedUsers: ['67890']
      });

      await request(app)
        .delete(`/api/quizzes/${quiz._id}/invite/67890`)
        .set(authHeaders)
        .expect(200);
    });

    it('should get quiz invitations', async () => {
      const quiz = await createQuiz({ 
        isPublic: false,
        invitedUsers: ['67890', '11111']
      });

      const response = await request(app)
        .get(`/api/quizzes/${quiz._id}/invites`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.invitedUsers).toHaveLength(2);
    });
  });

  describe('Quiz Analytics', () => {
    it('should increment play count', async () => {
      const quiz = await createQuiz({ playCount: 5 });

      const response = await request(app)
        .patch(`/api/quizzes/${quiz._id}/increment-playcount`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.playCount).toBe(6);
    });
  });
}); 