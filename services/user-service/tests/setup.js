const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.test' });

global.prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

jest.setTimeout(30000);

let emailCounter = 0;

beforeAll(async () => {
  if (!process.env.DATABASE_URL.includes('test')) {
    throw new Error('Nie używasz testowej bazy danych! Sprawdź DATABASE_URL w .env.test');
  }
  
  try {
    await global.prisma.$queryRaw`SELECT 1`;
    console.log('✅ Testowa baza danych jest gotowa');
  } catch (error) {
    console.log('🚀 Inicjalizacja bazy danych testowej...');
    
    const { execSync } = require('child_process');
    try {
      execSync('npm run test:db:reset', { stdio: 'inherit' });
      console.log('✅ Baza danych testowa zresetowana');
    } catch (error) {
      console.error('❌ Błąd podczas resetowania bazy danych testowej:', error.message);
      throw error;
    }
  }
});

afterAll(async () => {
  console.log('🧹 Rozłączanie z bazą danych...');
  await global.prisma.$disconnect();
});

beforeEach(async () => {
  await global.prisma.$transaction(async (tx) => {
    await tx.achievement.deleteMany({});
    await tx.quizHistory.deleteMany({});
    await tx.topicStats.deleteMany({});
    await tx.weeklyStats.deleteMany({});
    await tx.globalRanking.deleteMany({});
    await tx.weeklyRanking.deleteMany({});
    await tx.categoryRanking.deleteMany({});
    await tx.user.deleteMany({});
  });
  
  emailCounter = Date.now();
});

if (process.env.NODE_ENV === 'test') {
  const originalConsole = console;
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: originalConsole.warn,
    error: originalConsole.error,
  };
}

global.testHelpers = {
  createTestUserFast: async (overrides = {}) => {
    const uniqueEmail = overrides.email || `fast${++emailCounter}@test.com`;
    
    const userData = {
      email: uniqueEmail,
      password: '$2a$12$hashedpasswordforstesting',
      firstName: 'Fast',
      lastName: 'User',
      role: 'student',
      ...overrides,
      email: uniqueEmail
    };
    
    return await global.prisma.user.create({ data: userData });
  },
  
  createTestUser: async (overrides = {}) => {
    const bcrypt = require('bcryptjs');
    
    const uniqueEmail = overrides.email || `test${++emailCounter}@example.com`;
    
    const defaultUser = {
      email: uniqueEmail,
      password: await bcrypt.hash('Password123', 4),
      firstName: 'Test',
      lastName: 'User',
      role: 'student',
      ...overrides,
      email: uniqueEmail
    };
    
    return await global.prisma.user.create({
      data: defaultUser
    });
  },
  
  createTestUsersBatch: async (count, overrides = {}) => {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('Password123', 4);
    
    const users = [];
    for (let i = 0; i < count; i++) {
      users.push({
        email: `batch${++emailCounter}@test.com`,
        password: hashedPassword,
        firstName: `User${i}`,
        lastName: 'Test',
        role: 'student',
        ...overrides
      });
    }
    
    return await global.prisma.user.createMany({ 
      data: users,
      skipDuplicates: true
    });
  },
  
  generateTestToken: (user) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  },
  
  createTestQuizHistory: async (userId, overrides = {}) => {
    const uniqueQuizId = overrides.quizId || `60d5ecb54e51c92e15ad${++emailCounter}`;
    
    const defaultHistory = {
      userId,
      quizId: uniqueQuizId,
      quizTitle: 'Test Quiz',
      category: 'Test Category',
      score: 80,
      maxScore: 100,
      correctAnswers: 8,
      totalQuestions: 10,
      accuracy: 80.0,
      timeSpent: 300,
      difficulty: 'medium',
      pointsEarned: 80,
      bonusPoints: 0,
      ...overrides,
      quizId: uniqueQuizId
    };
    
    return await global.prisma.quizHistory.create({
      data: defaultHistory
    });
  },
  
  expectValidationError: (response, field) => {
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Błędy walidacji');
    if (field) {
      const translations = {
        'required': 'wymagany|wymagane|jest wymagany|jest wymagane',
        'email': 'email|format',
        'hasło': 'hasło|password',
        'litery': 'litery|letters',
        'rola': 'rola|role'
      };
      
      const pattern = translations[field.toLowerCase()] || field;
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.stringMatching(new RegExp(pattern, 'i'))
        ])
      );
    }
  },
  
  cleanupTables: async (...tableNames) => {
    for (const tableName of tableNames) {
      await global.prisma[tableName].deleteMany({});
    }
  },
  
  createMultipleUsers: async (count, baseOverrides = {}) => {
    const users = [];
    for (let i = 0; i < count; i++) {
      const user = await global.testHelpers.createTestUser({
        ...baseOverrides,
        email: `multiuser${++emailCounter}@example.com`,
        firstName: `User${i + 1}`
      });
      users.push(user);
    }
    return users;
  }
}; 