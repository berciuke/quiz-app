const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.test' });

// Globalna instancja Prisma dla testów
global.prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

// Zwiększony timeout dla bezpieczeństwa
jest.setTimeout(30000);

// Licznik dla unikalnych emaili
let emailCounter = 0;

// Setup przed wszystkimi testami - uruchom tylko raz!
beforeAll(async () => {
  // Upewnij się, że używamy testowej bazy danych
  if (!process.env.DATABASE_URL.includes('test')) {
    throw new Error('Nie używasz testowej bazy danych! Sprawdź DATABASE_URL w .env.test');
  }
  
  // Sprawdź czy baza już istnieje i jest gotowa
  try {
    await global.prisma.$queryRaw`SELECT 1`;
    console.log('✅ Testowa baza danych jest gotowa');
  } catch (error) {
    console.log('🚀 Inicjalizacja bazy danych testowej...');
    
    // Tylko jeśli baza nie istnieje, zresetuj ją
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

// Cleanup po wszystkich testach
afterAll(async () => {
  console.log('🧹 Rozłączanie z bazą danych...');
  await global.prisma.$disconnect();
});

// Szybkie czyszczenie między testami - bez resetowania schematu
beforeEach(async () => {
  // Używaj transakcji dla szybszego czyszczenia
  await global.prisma.$transaction(async (tx) => {
    // Wyczyść tabele w odpowiedniej kolejności (najpierw zależne, potem główne)
    await tx.achievement.deleteMany({});
    await tx.quizHistory.deleteMany({});
    await tx.topicStats.deleteMany({});
    await tx.weeklyStats.deleteMany({});
    await tx.globalRanking.deleteMany({});
    await tx.weeklyRanking.deleteMany({});
    await tx.categoryRanking.deleteMany({});
    await tx.user.deleteMany({});
  });
  
  // Reset counter dla każdego testu
  emailCounter = Date.now();
});

// Mockuj console.log w testach dla czystości outputu
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

// Helper funkcje dla testów
global.testHelpers = {
  // Szybkie tworzenie użytkownika bez pełnej walidacji (dla testów jednostkowych)
  createTestUserFast: async (overrides = {}) => {
    const uniqueEmail = overrides.email || `fast${++emailCounter}@test.com`;
    
    const userData = {
      email: uniqueEmail,
      password: '$2a$12$hashedpasswordforstesting', // Pre-hashed password
      firstName: 'Fast',
      lastName: 'User',
      role: 'student',
      ...overrides,
      email: uniqueEmail
    };
    
    return await global.prisma.user.create({ data: userData });
  },
  
  // Tworzy testowego użytkownika z unikalnym emailem (pełna walidacja)
  createTestUser: async (overrides = {}) => {
    const bcrypt = require('bcryptjs');
    
    // Generuj unikalny email jeśli nie podano
    const uniqueEmail = overrides.email || `test${++emailCounter}@example.com`;
    
    const defaultUser = {
      email: uniqueEmail,
      password: await bcrypt.hash('Password123', 4), // Zmniejszone rounds dla testów
      firstName: 'Test',
      lastName: 'User',
      role: 'student',
      ...overrides,
      email: uniqueEmail // Upewnij się, że email jest unikalny nawet z overrides
    };
    
    return await global.prisma.user.create({
      data: defaultUser
    });
  },
  
  // Batch creation for better performance
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
  
  // Generuje JWT token dla testów
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
  
  // Tworzy testową historię quizu z unikalnym quizId
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
  
  // Oczekuje błędu walidacji
  expectValidationError: (response, field) => {
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Błędy walidacji');
    if (field) {
      // Mapowanie angielskich słów kluczowych na polskie odpowiedniki
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
  
  // Pomocnicza funkcja do czyszczenia konkretnych tabel
  cleanupTables: async (...tableNames) => {
    for (const tableName of tableNames) {
      await global.prisma[tableName].deleteMany({});
    }
  },
  
  // Tworzy wielokrotnych użytkowników z unikalnymi emailami
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