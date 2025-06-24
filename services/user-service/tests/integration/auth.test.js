const request = require('supertest');
const app = require('../../src/index');

describe('Authentication Integration Tests', () => {
  describe('POST /api/users/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'Password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const response = await request(app)
        .post('/api/users/register')
        .send(userData)
        .expect(201);

      expect(response.body.message).toBe('Użytkownik został zarejestrowany pomyślnie');
      expect(response.body.user).toMatchObject({
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: 'student'
      });
      expect(response.body.user.password).toBeUndefined();
      expect(response.body.user.id).toBeDefined();
    });

    it('should not register user with duplicate email', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'Password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      // Zarejestruj pierwszego użytkownika
      await request(app)
        .post('/api/users/register')
        .send(userData)
        .expect(201);

      // Spróbuj zarejestrować drugiego użytkownika z tym samym emailem
      const response = await request(app)
        .post('/api/users/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('Użytkownik z tym emailem już istnieje');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({})
        .expect(400);

      global.testHelpers.expectValidationError(response, 'required');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({
          email: 'invalid-email',
          password: 'Password123',
          firstName: 'John',
          lastName: 'Doe'
        })
        .expect(400);

      global.testHelpers.expectValidationError(response, 'email');
    });

    it('should validate password strength', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({
          email: 'test@example.com',
          password: 'weak',
          firstName: 'John',
          lastName: 'Doe'
        })
        .expect(400);

      global.testHelpers.expectValidationError(response, 'hasło');
    });

    it('should validate name format', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          firstName: '123Invalid',
          lastName: 'Doe'
        })
        .expect(400);

      global.testHelpers.expectValidationError(response, 'litery');
    });

    it('should register instructor role when specified', async () => {
      const userData = {
        email: 'instructor@example.com',
        password: 'Password123',
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'instructor'
      };

      const response = await request(app)
        .post('/api/users/register')
        .send(userData)
        .expect(201);

      expect(response.body.user.role).toBe('instructor');
    });

    it('should default to student role when not specified', async () => {
      const userData = {
        email: 'defaultrole@example.com',
        password: 'Password123',
        firstName: 'Default',
        lastName: 'Student'
      };

      const response = await request(app)
        .post('/api/users/register')
        .send(userData)
        .expect(201);

      expect(response.body.user.role).toBe('student');
    });

    it('should validate role values', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({
          email: 'invalidrole@example.com',
          password: 'Password123',
          firstName: 'Invalid',
          lastName: 'Role',
          role: 'invalid_role'
        })
        .expect(400);

      global.testHelpers.expectValidationError(response, 'rola');
    });
  });

  describe('POST /api/users/login', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await global.testHelpers.createTestUser({
        firstName: 'Login',
        lastName: 'Test'
      });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: testUser.email,
          password: 'Password123'
        })
        .expect(200);

      expect(response.body.token).toBeDefined();
      expect(response.body.user).toMatchObject({
        id: testUser.id,
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        role: testUser.role
      });
      expect(response.body.user.password).toBeUndefined();
    });

    it('should not login with invalid email', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123'
        })
        .expect(401);

      expect(response.body.error).toBe('Nieprawidłowy email lub hasło');
    });

    it('should not login with invalid password', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123'
        })
        .expect(401);

      expect(response.body.error).toBe('Nieprawidłowy email lub hasło');
    });

    it('should not login with inactive user', async () => {
      // Dezaktywuj użytkownika
      await global.prisma.user.update({
        where: { id: testUser.id },
        data: { isActive: false }
      });

      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: testUser.email,
          password: 'Password123'
        })
        .expect(401);

      expect(response.body.error).toBe('Nieprawidłowy email lub hasło');
    });

    it('should validate login input', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({})
        .expect(400);

      global.testHelpers.expectValidationError(response, 'required');
    });

    it('should validate email format in login', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: 'invalid-email-format',
          password: 'Password123'
        })
        .expect(400);

      global.testHelpers.expectValidationError(response, 'email');
    });

    it('should update lastLoginAt on successful login', async () => {
      const beforeLogin = new Date();
      
      await request(app)
        .post('/api/users/login')
        .send({
          email: testUser.email,
          password: 'Password123'
        })
        .expect(200);

      const updatedUser = await global.prisma.user.findUnique({
        where: { id: testUser.id }
      });

      expect(updatedUser.lastLoginAt).toBeDefined();
      expect(new Date(updatedUser.lastLoginAt)).toBeInstanceOf(Date);
      expect(new Date(updatedUser.lastLoginAt).getTime()).toBeGreaterThanOrEqual(beforeLogin.getTime());
    });

    it('should return JWT token with correct payload', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: testUser.email,
          password: 'Password123'
        })
        .expect(200);

      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
      
      expect(decoded).toMatchObject({
        id: testUser.id,
        email: testUser.email,
        role: testUser.role,
        firstName: testUser.firstName,
        lastName: testUser.lastName
      });
      expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
    });
  });

  describe('Token Validation', () => {
    let testUser, token;

    beforeEach(async () => {
      testUser = await global.testHelpers.createTestUser();
      token = global.testHelpers.generateTestToken(testUser);
    });

    it('should accept valid JWT token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.id).toBe(testUser.id);
    });

    it('should reject invalid JWT token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error).toBe('Nieprawidłowy token');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body.error).toBe('Brak tokenu autoryzacji');
    });

    it('should reject expired token', async () => {
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { id: testUser.id, email: testUser.email },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' } // Wygasły token
      );

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.error).toBe('Nieprawidłowy token');
    });

    it('should reject token with wrong signature', async () => {
      const jwt = require('jsonwebtoken');
      const wrongToken = jwt.sign(
        { id: testUser.id, email: testUser.email },
        'wrong-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${wrongToken}`)
        .expect(401);

      expect(response.body.error).toBe('Nieprawidłowy token');
    });

    it('should handle malformed Authorization header', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'InvalidFormat')
        .expect(401);

      expect(response.body.error).toBe('Nieprawidłowy token');
    });
  });
}); 