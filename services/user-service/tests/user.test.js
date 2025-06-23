const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('../src/index');
const { prisma } = require('../src/config/db');

const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPass123',
  firstName: 'Jan',
  lastName: 'Kowalski',
  role: 'student'
};

const ADMIN_USER = {
  email: 'admin@example.com',
  password: 'AdminPass123',
  firstName: 'Admin',
  lastName: 'Test',
  role: 'admin'
};

let testUserToken;
let adminToken;
let testUserId;
let adminUserId;

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName
    },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '24h' }
  );
};

describe('User Service API', () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe('POST /api/users/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send(TEST_USER)
        .expect(201);

      expect(response.body.message).toBe('Użytkownik został zarejestrowany pomyślnie');
      expect(response.body.user.email).toBe(TEST_USER.email);
      expect(response.body.user.firstName).toBe(TEST_USER.firstName);
      expect(response.body.user.lastName).toBe(TEST_USER.lastName);
      expect(response.body.user.role).toBe(TEST_USER.role);
      expect(response.body.user.password).toBeUndefined();
    });

    it('should not register user with existing email', async () => {
      await request(app)
        .post('/api/users/register')
        .send(TEST_USER);

      const response = await request(app)
        .post('/api/users/register')
        .send(TEST_USER)
        .expect(400);

      expect(response.body.error).toBe('Użytkownik z tym emailem już istnieje');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({
          email: 'invalid-email',
          password: '123',
          firstName: '',
          lastName: 'Test'
        })
        .expect(400);

      expect(response.body.error).toBe('Błędy walidacji');
      expect(response.body.details).toBeInstanceOf(Array);
      expect(response.body.details.length).toBeGreaterThan(0);
    });

    it('should set default role to student', async () => {
      const userWithoutRole = { ...TEST_USER };
      delete userWithoutRole.role;

      const response = await request(app)
        .post('/api/users/register')
        .send(userWithoutRole)
        .expect(201);

      expect(response.body.user.role).toBe('student');
    });
  });

  describe('POST /api/users/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/users/register')
        .send(TEST_USER);
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: TEST_USER.email,
          password: TEST_USER.password
        })
        .expect(200);

      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe(TEST_USER.email);
      expect(response.body.user.role).toBe(TEST_USER.role);
    });

    it('should not login with invalid password', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: TEST_USER.email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.error).toBe('Nieprawidłowy email lub hasło');
    });

    it('should not login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: 'nonexistent@example.com',
          password: TEST_USER.password
        })
        .expect(401);

      expect(response.body.error).toBe('Nieprawidłowy email lub hasło');
    });

    it('should validate login input', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: 'invalid-email',
          password: ''
        })
        .expect(400);

      expect(response.body.error).toBe('Błędy walidacji');
    });
  });

  describe('Protected Routes', () => {
    beforeEach(async () => {
      const testUserResponse = await request(app)
        .post('/api/users/register')
        .send(TEST_USER);
      
      const adminResponse = await request(app)
        .post('/api/users/register')
        .send(ADMIN_USER);

      testUserId = testUserResponse.body.user.id;
      adminUserId = adminResponse.body.user.id;

      testUserToken = generateToken({
        id: testUserId,
        email: TEST_USER.email,
        role: TEST_USER.role,
        firstName: TEST_USER.firstName,
        lastName: TEST_USER.lastName
      });

      adminToken = generateToken({
        id: adminUserId,
        email: ADMIN_USER.email,
        role: ADMIN_USER.role,
        firstName: ADMIN_USER.firstName,
        lastName: ADMIN_USER.lastName
      });
    });

    describe('GET /api/users/profile', () => {
      it('should get user profile with valid token', async () => {
        const response = await request(app)
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${testUserToken}`)
          .expect(200);

        expect(response.body.email).toBe(TEST_USER.email);
        expect(response.body.firstName).toBe(TEST_USER.firstName);
        expect(response.body.lastName).toBe(TEST_USER.lastName);
        expect(response.body.password).toBeUndefined();
      });

      it('should return 401 without token', async () => {
        const response = await request(app)
          .get('/api/users/profile')
          .expect(401);

        expect(response.body.error).toBe('Brak tokenu autoryzacji');
      });

      it('should return 401 with invalid token', async () => {
        const response = await request(app)
          .get('/api/users/profile')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);

        expect(response.body.error).toBe('Nieprawidłowy token');
      });
    });

    describe('PUT /api/users/profile', () => {
      it('should update user profile', async () => {
        const updateData = {
          firstName: 'Updated',
          lastName: 'Name'
        };

        const response = await request(app)
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${testUserToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.message).toBe('Profil został zaktualizowany pomyślnie');
        expect(response.body.user.firstName).toBe(updateData.firstName);
        expect(response.body.user.lastName).toBe(updateData.lastName);
      });

      it('should validate update data', async () => {
        const response = await request(app)
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${testUserToken}`)
          .send({
            firstName: '',
            lastName: 'ValidName'
          })
          .expect(400);

        expect(response.body.error).toBe('Błędy walidacji');
      });
    });

    describe('PUT /api/users/password', () => {
      it('should change password with valid current password', async () => {
        const response = await request(app)
          .put('/api/users/password')
          .set('Authorization', `Bearer ${testUserToken}`)
          .send({
            currentPassword: TEST_USER.password,
            newPassword: 'NewPass123'
          })
          .expect(200);

        expect(response.body.message).toBe('Hasło zostało zmienione pomyślnie');

        const loginResponse = await request(app)
          .post('/api/users/login')
          .send({
            email: TEST_USER.email,
            password: 'NewPass123'
          })
          .expect(200);

        expect(loginResponse.body.token).toBeDefined();
      });

      it('should not change password with wrong current password', async () => {
        const response = await request(app)
          .put('/api/users/password')
          .set('Authorization', `Bearer ${testUserToken}`)
          .send({
            currentPassword: 'wrongpassword',
            newPassword: 'NewPass123'
          })
          .expect(400);

        expect(response.body.error).toBe('Obecne hasło jest nieprawidłowe');
      });
    });

    describe('Admin Routes', () => {
      describe('GET /api/users/all', () => {
        it('should get all users for admin', async () => {
          const response = await request(app)
            .get('/api/users/all')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

          expect(response.body.users).toBeInstanceOf(Array);
          expect(response.body.users.length).toBe(2); // test user + admin
          expect(response.body.pagination).toBeDefined();
        });

        it('should deny access for non-admin users', async () => {
          const response = await request(app)
            .get('/api/users/all')
            .set('Authorization', `Bearer ${testUserToken}`)
            .expect(403);

          expect(response.body.error).toBe('Brak uprawnień');
        });

        it('should support pagination and filtering', async () => {
          const response = await request(app)
            .get('/api/users/all?page=1&limit=1&role=student')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

          expect(response.body.users.length).toBe(1);
          expect(response.body.users[0].role).toBe('student');
          expect(response.body.pagination.page).toBe(1);
          expect(response.body.pagination.limit).toBe(1);
        });
      });

      describe('PUT /api/users/:userId/role', () => {
        it('should update user role for admin', async () => {
          const response = await request(app)
            .put(`/api/users/${testUserId}/role`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ role: 'instructor' })
            .expect(200);

          expect(response.body.message).toBe('Rola użytkownika została zaktualizowana');
          expect(response.body.user.role).toBe('instructor');
        });

        it('should prevent admin from changing own role', async () => {
          const response = await request(app)
            .put(`/api/users/${adminUserId}/role`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ role: 'student' })
            .expect(400);

          expect(response.body.error).toBe('Nie możesz zmienić własnej roli');
        });

        it('should validate role value', async () => {
          const response = await request(app)
            .put(`/api/users/${testUserId}/role`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ role: 'invalid-role' })
            .expect(400);

          expect(response.body.error).toBe('Nieprawidłowa rola');
        });
      });

      describe('PUT /api/users/:userId/deactivate', () => {
        it('should deactivate user for admin', async () => {
          const response = await request(app)
            .put(`/api/users/${testUserId}/deactivate`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

          expect(response.body.message).toBe('Użytkownik został dezaktywowany');
          
          const loginResponse = await request(app)
            .post('/api/users/login')
            .send({
              email: TEST_USER.email,
              password: TEST_USER.password
            })
            .expect(401);

          expect(loginResponse.body.error).toBe('Nieprawidłowy email lub hasło');
        });

        it('should prevent admin from deactivating themselves', async () => {
          const response = await request(app)
            .put(`/api/users/${adminUserId}/deactivate`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(400);

          expect(response.body.error).toBe('Nie możesz dezaktywować własnego konta');
        });
      });
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.service).toBe('user-service');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/users/non-existent')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(404);

      expect(response.body.error).toBe('Endpoint nie został znaleziony');
    });
  });
}); 