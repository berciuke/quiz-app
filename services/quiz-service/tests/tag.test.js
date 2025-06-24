const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/index');
const Tag = require('../src/models/Tag');
const Quiz = require('../src/models/Quiz');
const Category = require('../src/models/Category');

describe('Tag Management API', () => {
  let testTag;
  let testCategory;
  
  const mockUser = {
    id: 'test-user-123',
    username: 'testuser',
    roles: ['user']
  };
  
  const authHeaders = {
    'x-user-id': mockUser.id,
    'x-user-username': mockUser.username,
    'x-user-roles': mockUser.roles.join(',')
  };

  beforeAll(async () => {
    // Sprawdź czy połączenie już istnieje
    if (mongoose.connection.readyState === 0) {
      const mongoUri = process.env.MONGO_TEST_URI || 'mongodb://localhost:27017/quiz-app-test';
      await mongoose.connect(mongoUri);
    }
  });

  beforeEach(async () => {
    // Wyczyść kolekcje przed każdym testem
    await Tag.deleteMany({});
    await Quiz.deleteMany({});
    await Category.deleteMany({});

    // Utwórz kategorię testową
    testCategory = await Category.create({
      name: 'Science',
      description: 'Science related quizzes'
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/tags', () => {
    it('should create a tag successfully', async () => {
      const tagData = {
        name: 'javascript',
        description: 'JavaScript programming language'
      };

      const response = await request(app)
        .post('/api/tags')
        .set(authHeaders)
        .send(tagData)
        .expect(201);

      expect(response.body.message).toBe('Tag created successfully');
      expect(response.body.tag.name).toBe(tagData.name);
      expect(response.body.tag.description).toBe(tagData.description);
      expect(response.body.tag.isActive).toBe(true);
    });

    it('should reject tag with invalid data', async () => {
      const invalidData = {
        name: '', // Empty name
        description: 'A'.repeat(300) // Too long description
      };

      const response = await request(app)
        .post('/api/tags')
        .set(authHeaders)
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should reject duplicate tag names', async () => {
      await Tag.create({
        name: 'javascript',
        description: 'First JavaScript tag'
      });

      const duplicateData = {
        name: 'javascript',
        description: 'Second JavaScript tag'
      };

      const response = await request(app)
        .post('/api/tags')
        .set(authHeaders)
        .send(duplicateData)
        .expect(400);

      expect(response.body.error).toBe('Failed to create tag');
    });

    it('should require authentication', async () => {
      const tagData = {
        name: 'javascript',
        description: 'JavaScript programming language'
      };

      await request(app)
        .post('/api/tags')
        .send(tagData)
        .expect(401);
    });

    it('should trim tag name and description', async () => {
      const tagData = {
        name: '  javascript  ',
        description: '  JavaScript programming language  '
      };

      const response = await request(app)
        .post('/api/tags')
        .set(authHeaders)
        .send(tagData)
        .expect(201);

      expect(response.body.tag.name).toBe('javascript');
      expect(response.body.tag.description).toBe('JavaScript programming language');
    });
  });

  describe('GET /api/tags', () => {
    beforeEach(async () => {
      // Utwórz testowe tagi
      await Tag.create([
        { name: 'javascript', description: 'JavaScript programming' },
        { name: 'python', description: 'Python programming' },
        { name: 'react', description: 'React framework' },
        { name: 'inactive-tag', description: 'Inactive tag', isActive: false }
      ]);
    });

    it('should get all active tags', async () => {
      const response = await request(app)
        .get('/api/tags')
        .expect(200);

      expect(response.body.total).toBe(3); // Only active tags
      expect(response.body.tags).toHaveLength(3);
      expect(response.body.tags.some(tag => tag.name === 'javascript')).toBe(true);
      expect(response.body.tags.some(tag => tag.name === 'inactive-tag')).toBe(false);
    });

    it('should get all tags including inactive when requested', async () => {
      const response = await request(app)
        .get('/api/tags?includeInactive=true')
        .expect(200);

      expect(response.body.total).toBe(4); // All tags
      expect(response.body.tags.some(tag => tag.name === 'inactive-tag')).toBe(true);
    });

    it('should support search functionality', async () => {
      const response = await request(app)
        .get('/api/tags?search=java')
        .expect(200);

      expect(response.body.total).toBe(1);
      expect(response.body.tags[0].name).toBe('javascript');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/tags?page=1&limit=2')
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(2);
      expect(response.body.tags).toHaveLength(2);
      expect(response.body.total).toBe(3);
    });

    it('should sort tags alphabetically', async () => {
      const response = await request(app)
        .get('/api/tags')
        .expect(200);

      const tagNames = response.body.tags.map(tag => tag.name);
      expect(tagNames).toEqual(['javascript', 'python', 'react']);
    });
  });

  describe('GET /api/tags/popular', () => {
    beforeEach(async () => {
      // Utwórz tagi
      const jsTag = await Tag.create({ name: 'javascript', description: 'JavaScript' });
      const pythonTag = await Tag.create({ name: 'python', description: 'Python' });
      const reactTag = await Tag.create({ name: 'react', description: 'React' });

      // Utwórz quizy z tagami
      await Quiz.create([
        { 
          title: 'JS Quiz 1', 
          category: testCategory._id, 
          createdBy: mockUser.id,
          tags: [jsTag._id]
        },
        { 
          title: 'JS Quiz 2', 
          category: testCategory._id, 
          createdBy: mockUser.id,
          tags: [jsTag._id]
        },
        { 
          title: 'Python Quiz', 
          category: testCategory._id, 
          createdBy: mockUser.id,
          tags: [pythonTag._id]
        },
        { 
          title: 'React Quiz', 
          category: testCategory._id, 
          createdBy: mockUser.id,
          tags: [reactTag._id]
        }
      ]);
    });

    it('should return popular tags sorted by usage', async () => {
      const response = await request(app)
        .get('/api/tags/popular')
        .expect(200);

      expect(response.body).toHaveLength(3);
      expect(response.body[0].name).toBe('javascript');
      expect(response.body[0].usageCount).toBe(2);
      expect(response.body[1].usageCount).toBe(1);
      expect(response.body[2].usageCount).toBe(1);
    });

    it('should support limit parameter', async () => {
      const response = await request(app)
        .get('/api/tags/popular?limit=2')
        .expect(200);

      expect(response.body).toHaveLength(2);
    });
  });

  describe('GET /api/tags/:id', () => {
    beforeEach(async () => {
      testTag = await Tag.create({
        name: 'javascript',
        description: 'JavaScript programming language'
      });
    });

    it('should get tag by id', async () => {
      const response = await request(app)
        .get(`/api/tags/${testTag._id}`)
        .expect(200);

      expect(response.body.name).toBe(testTag.name);
      expect(response.body.description).toBe(testTag.description);
    });

    it('should return 404 for non-existent tag', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/tags/${fakeId}`)
        .expect(404);

      expect(response.body.error).toBe('Tag not found');
    });

    it('should return 400 for invalid tag ID', async () => {
      const response = await request(app)
        .get('/api/tags/invalid-id')
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('PUT /api/tags/:id', () => {
    beforeEach(async () => {
      testTag = await Tag.create({
        name: 'javascript',
        description: 'JavaScript programming language'
      });
    });

    it('should update tag successfully', async () => {
      const updateData = {
        name: 'javascript-updated',
        description: 'Updated JavaScript description'
      };

      const response = await request(app)
        .put(`/api/tags/${testTag._id}`)
        .set(authHeaders)
        .send(updateData)
        .expect(200);

      expect(response.body.message).toBe('Tag updated successfully');
      expect(response.body.tag.name).toBe(updateData.name);
      expect(response.body.tag.description).toBe(updateData.description);
    });

    it('should return 404 for non-existent tag', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const updateData = {
        name: 'updated-name'
      };

      const response = await request(app)
        .put(`/api/tags/${fakeId}`)
        .set(authHeaders)
        .send(updateData)
        .expect(404);

      expect(response.body.error).toBe('Tag not found');
    });

    it('should require authentication', async () => {
      const updateData = {
        name: 'updated-name'
      };

      await request(app)
        .put(`/api/tags/${testTag._id}`)
        .send(updateData)
        .expect(401);
    });

    it('should validate update data', async () => {
      const invalidData = {
        name: '', // Empty name
        description: 'A'.repeat(300) // Too long description
      };

      const response = await request(app)
        .put(`/api/tags/${testTag._id}`)
        .set(authHeaders)
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('DELETE /api/tags/:id', () => {
    beforeEach(async () => {
      testTag = await Tag.create({
        name: 'javascript',
        description: 'JavaScript programming language'
      });
    });

    it('should delete tag successfully', async () => {
      const response = await request(app)
        .delete(`/api/tags/${testTag._id}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.message).toBe('Tag deleted successfully');

      // Sprawdź czy tag został usunięty
      const deletedTag = await Tag.findById(testTag._id);
      expect(deletedTag).toBeNull();
    });

    it('should return 404 for non-existent tag', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/tags/${fakeId}`)
        .set(authHeaders)
        .expect(404);

      expect(response.body.error).toBe('Tag not found');
    });

    it('should require authentication', async () => {
      await request(app)
        .delete(`/api/tags/${testTag._id}`)
        .expect(401);
    });
  });

  describe('Tag filtering in quiz search', () => {
    beforeEach(async () => {
      // Utwórz tagi
      const jsTag = await Tag.create({ name: 'javascript', description: 'JavaScript' });
      const pythonTag = await Tag.create({ name: 'python', description: 'Python' });

      // Utwórz quizy z tagami
      await Quiz.create([
        { 
          title: 'JavaScript Basics', 
          category: testCategory._id, 
          createdBy: mockUser.id,
          tags: [jsTag._id],
          isPublic: true,
          isActive: true
        },
        { 
          title: 'Python Fundamentals', 
          category: testCategory._id, 
          createdBy: mockUser.id,
          tags: [pythonTag._id],
          isPublic: true,
          isActive: true
        },
        { 
          title: 'Mixed Languages', 
          category: testCategory._id, 
          createdBy: mockUser.id,
          tags: [jsTag._id, pythonTag._id],
          isPublic: true,
          isActive: true
        }
      ]);
    });

    it('should filter quizzes by single tag', async () => {
      const response = await request(app)
        .get('/api/quizzes/search?tags=javascript')
        .expect(200);

      expect(response.body.total).toBe(2); // JS Basics and Mixed Languages
      expect(response.body.quizzes.every(quiz => 
        quiz.tags.some(tag => tag.name === 'javascript')
      )).toBe(true);
    });

    it('should filter quizzes by multiple tags', async () => {
      const response = await request(app)
        .get('/api/quizzes/search?tags=javascript,python')
        .expect(200);

      expect(response.body.total).toBe(3); // All quizzes have at least one of these tags
    });
  });
}); 