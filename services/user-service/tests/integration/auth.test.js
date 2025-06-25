const request = require('supertest');
const app = require('../../src/index');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

describe('Auth Endpoints', () => {
  beforeEach(async () => {
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe('POST /api/auth/register', () => {
    const validUserData = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Jan',
      lastName: 'Kowalski'
    };

    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toMatchObject({
        email: validUserData.email,
        firstName: validUserData.firstName,
        lastName: validUserData.lastName,
        role: 'student'
      });
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should not register user with existing email', async () => {
      await request(app)
        .post('/api/auth/register')
        .send(validUserData);

      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('już istnieje');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: '123' 
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Błąd walidacji');
      expect(response.body.error.details).toBeInstanceOf(Array);
    });

    it('should register user with instructor role', async () => {
      const instructorData = {
        ...validUserData,
        email: 'instructor@example.com',
        role: 'instructor'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(instructorData)
        .expect(201);

      expect(response.body.data.user.role).toBe('instructor');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash('password123', 12);
      await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: hashedPassword,
          firstName: 'Jan',
          lastName: 'Kowalski',
          role: 'student'
        }
      });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should not login with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrong@example.com',
          password: 'password123'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Nieprawidłowe dane logowania');
    });

    it('should not login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Nieprawidłowe dane logowania');
    });

    it('should not login inactive user', async () => {
      await prisma.user.update({
        where: { email: 'test@example.com' },
        data: { isActive: false }
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('dezaktywowane');
    });

    it('should update lastLoginAt on successful login', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(200);

      const user = await prisma.user.findUnique({
        where: { email: 'test@example.com' }
      });

      expect(user.lastLoginAt).toBeDefined();
    });
  });

  describe('GET /api/auth/verify', () => {
    let token;
    let userId;

    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash('password123', 12);
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: hashedPassword,
          firstName: 'Jan',
          lastName: 'Kowalski',
          role: 'student'
        }
      });

      userId = user.id;
      token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
    });

    it('should verify valid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.valid).toBe(true);
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid or expired token');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Authentication required - Bearer token missing');
    });

    it('should reject token for inactive user', async () => {
      await prisma.user.update({
        where: { id: userId },
        data: { isActive: false }
      });

      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('nieaktywny');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash('password123', 12);
      await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: hashedPassword,
          firstName: 'Jan',
          lastName: 'Kowalski'
        }
      });
    });

         it('should send reset token for existing email', async () => {
       const response = await request(app)
         .post('/api/auth/forgot-password')
         .send({ email: 'test@example.com' })
         .expect(200);

       expect(response.body.success).toBe(true);
       expect(response.body.data.message).toContain('został wysłany');
       expect(response.body.data.resetToken).toBeDefined(); 
     });

         it('should return success even for non-existing email', async () => {
       const response = await request(app)
         .post('/api/auth/forgot-password')
         .send({ email: 'nonexistent@example.com' })
         .expect(200);

       expect(response.body.success).toBe(true);
       expect(response.body.data.message).toContain('został wysłany');
     });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Błąd walidacji');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    let resetToken;
    let userId;

    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash('password123', 12);
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: hashedPassword,
          firstName: 'Jan',
          lastName: 'Kowalski'
        }
      });

      userId = user.id;
      resetToken = jwt.sign(
        { userId: user.id, type: 'password-reset' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
    });

    it('should reset password with valid token', async () => {
      const newPassword = 'newpassword123';

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: newPassword
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('pomyślnie zresetowane');

      const user = await prisma.user.findUnique({ where: { id: userId } });
      const isPasswordValid = await bcrypt.compare(newPassword, user.password);
      expect(isPasswordValid).toBe(true);
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          newPassword: 'newpassword123'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('nieprawidłowy lub wygasł');
    });

    it('should reject wrong token type', async () => {
      const wrongTypeToken = jwt.sign(
        { userId: userId, type: 'email-verification' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: wrongTypeToken,
          newPassword: 'newpassword123'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('nieprawidłowy typ');
    });

    it('should validate new password', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: '123' 
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Błąd walidacji');
    });
  });
}); 