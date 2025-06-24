const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/index');
const Category = require('../src/models/Category');

describe('Category Management API', () => {
  let testCategory;
  let parentCategory;
  
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
    await Category.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/categories', () => {
    it('should create a category successfully', async () => {
      const categoryData = {
        name: 'Science',
        description: 'Science related quizzes'
      };

      const response = await request(app)
        .post('/api/categories')
        .set(authHeaders)
        .send(categoryData)
        .expect(201);

      expect(response.body.message).toBe('Category created successfully');
      expect(response.body.category.name).toBe(categoryData.name);
      expect(response.body.category.description).toBe(categoryData.description);
      expect(response.body.category.isActive).toBe(true);
      expect(response.body.category.parent).toBeNull();
    });

    it('should create a child category successfully', async () => {
      // Najpierw utwórz kategorię nadrzędną
      parentCategory = await Category.create({
        name: 'Science',
        description: 'Science related quizzes'
      });

      const childCategoryData = {
        name: 'Physics',
        description: 'Physics quizzes',
        parent: parentCategory._id
      };

      const response = await request(app)
        .post('/api/categories')
        .set(authHeaders)
        .send(childCategoryData)
        .expect(201);

      expect(response.body.category.name).toBe(childCategoryData.name);
      expect(response.body.category.parent.toString()).toBe(parentCategory._id.toString());
    });

    it('should reject category with invalid data', async () => {
      const invalidData = {
        name: '', // Empty name
        description: 'A'.repeat(600) // Too long description
      };

      const response = await request(app)
        .post('/api/categories')
        .set(authHeaders)
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should reject duplicate category names', async () => {
      await Category.create({
        name: 'Science',
        description: 'First science category'
      });

      const duplicateData = {
        name: 'Science',
        description: 'Second science category'
      };

      const response = await request(app)
        .post('/api/categories')
        .set(authHeaders)
        .send(duplicateData)
        .expect(400);

      expect(response.body.error).toBe('Failed to create category');
    });

    it('should require authentication', async () => {
      const categoryData = {
        name: 'Science',
        description: 'Science related quizzes'
      };

      await request(app)
        .post('/api/categories')
        .send(categoryData)
        .expect(401);
    });
  });

  describe('GET /api/categories', () => {
    beforeEach(async () => {
      // Utwórz testowe kategorie
      parentCategory = await Category.create({
        name: 'Science',
        description: 'Science related quizzes'
      });

      testCategory = await Category.create({
        name: 'Physics',
        description: 'Physics quizzes',
        parent: parentCategory._id
      });

      await Category.create({
        name: 'Inactive Category',
        description: 'This category is inactive',
        isActive: false
      });
    });

    it('should get all active categories', async () => {
      const response = await request(app)
        .get('/api/categories')
        .expect(200);

      expect(response.body).toHaveLength(2); // Only active categories
      expect(response.body.some(cat => cat.name === 'Science')).toBe(true);
      expect(response.body.some(cat => cat.name === 'Physics')).toBe(true);
      expect(response.body.some(cat => cat.name === 'Inactive Category')).toBe(false);
    });

    it('should get all categories including inactive when requested', async () => {
      const response = await request(app)
        .get('/api/categories?includeInactive=true')
        .expect(200);

      expect(response.body).toHaveLength(3); // All categories
      expect(response.body.some(cat => cat.name === 'Inactive Category')).toBe(true);
    });

    it('should populate parent category information', async () => {
      const response = await request(app)
        .get('/api/categories')
        .expect(200);

      const physicsCategory = response.body.find(cat => cat.name === 'Physics');
      expect(physicsCategory.parent).toBeDefined();
      expect(physicsCategory.parent.name).toBe('Science');
    });
  });

  describe('GET /api/categories/hierarchy', () => {
    beforeEach(async () => {
      // Utwórz hierarchię kategorii
      parentCategory = await Category.create({
        name: 'Science',
        description: 'Science related quizzes'
      });

      await Category.create({
        name: 'Physics',
        description: 'Physics quizzes',
        parent: parentCategory._id
      });

      await Category.create({
        name: 'Chemistry',
        description: 'Chemistry quizzes',
        parent: parentCategory._id
      });

      await Category.create({
        name: 'Mathematics',
        description: 'Math related quizzes'
      });
    });

    it('should return hierarchical category structure', async () => {
      const response = await request(app)
        .get('/api/categories/hierarchy')
        .expect(200);

      expect(response.body).toHaveLength(2); // Science and Mathematics as root categories

      const scienceCategory = response.body.find(cat => cat.name === 'Science');
      expect(scienceCategory.children).toBeDefined();
      expect(scienceCategory.children).toHaveLength(2); // Physics and Chemistry
    });
  });

  describe('GET /api/categories/:id', () => {
    beforeEach(async () => {
      testCategory = await Category.create({
        name: 'Science',
        description: 'Science related quizzes'
      });
    });

    it('should get category by id', async () => {
      const response = await request(app)
        .get(`/api/categories/${testCategory._id}`)
        .expect(200);

      expect(response.body.name).toBe(testCategory.name);
      expect(response.body.description).toBe(testCategory.description);
    });

    it('should return 404 for non-existent category', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/categories/${fakeId}`)
        .expect(404);

      expect(response.body.error).toBe('Category not found');
    });

    it('should return 400 for invalid category ID', async () => {
      const response = await request(app)
        .get('/api/categories/invalid-id')
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('PUT /api/categories/:id', () => {
    beforeEach(async () => {
      testCategory = await Category.create({
        name: 'Science',
        description: 'Science related quizzes'
      });
    });

    it('should update category successfully', async () => {
      const updateData = {
        name: 'Updated Science',
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/categories/${testCategory._id}`)
        .set(authHeaders)
        .send(updateData)
        .expect(200);

      expect(response.body.message).toBe('Category updated successfully');
      expect(response.body.category.name).toBe(updateData.name);
      expect(response.body.category.description).toBe(updateData.description);
    });

    it('should return 404 for non-existent category', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const updateData = {
        name: 'Updated Name'
      };

      const response = await request(app)
        .put(`/api/categories/${fakeId}`)
        .set(authHeaders)
        .send(updateData)
        .expect(404);

      expect(response.body.error).toBe('Category not found');
    });

    it('should require authentication', async () => {
      const updateData = {
        name: 'Updated Science'
      };

      await request(app)
        .put(`/api/categories/${testCategory._id}`)
        .send(updateData)
        .expect(401);
    });

    it('should validate update data', async () => {
      const invalidData = {
        name: '', // Empty name
        parent: 'invalid-id'
      };

      const response = await request(app)
        .put(`/api/categories/${testCategory._id}`)
        .set(authHeaders)
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('DELETE /api/categories/:id', () => {
    beforeEach(async () => {
      testCategory = await Category.create({
        name: 'Science',
        description: 'Science related quizzes'
      });
    });

    it('should delete category successfully', async () => {
      const response = await request(app)
        .delete(`/api/categories/${testCategory._id}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.message).toBe('Category deleted successfully');

      // Sprawdź czy kategoria została usunięta
      const deletedCategory = await Category.findById(testCategory._id);
      expect(deletedCategory).toBeNull();
    });

    it('should return 404 for non-existent category', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/categories/${fakeId}`)
        .set(authHeaders)
        .expect(404);

      expect(response.body.error).toBe('Category not found');
    });

    it('should require authentication', async () => {
      await request(app)
        .delete(`/api/categories/${testCategory._id}`)
        .expect(401);
    });
  });
}); 