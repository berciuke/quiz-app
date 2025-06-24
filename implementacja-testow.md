# Implementacja Testów - Quiz Service

## Spis Treści

1. [Analiza Testów User Service](#1-analiza-testów-user-service)
2. [Wnioski i Lekcje Wyciągnięte](#2-wnioski-i-lekcje-wyciągnięte)
3. [Strategia dla Quiz Service](#3-strategia-dla-quiz-service)
4. [Konfiguracja Środowiska](#4-konfiguracja-środowiska)
5. [Implementacja Krok po Kroku](#5-implementacja-krok-po-kroku)
6. [Struktura Testów](#6-struktura-testów)
7. [Helper Functions](#7-helper-functions)
8. [Testy Integracyjne](#8-testy-integracyjne)
9. [Automatyzacja i CI/CD](#9-automatyzacja-i-cicd)
10. [Najlepsze Praktyki](#10-najlepsze-praktyki)

---

## 1. Analiza Testów User Service

### 1.1 Co Działa Dobrze

#### ✅ **Struktura i Organizacja**
- **Logiczne grupowanie**: Testy podzielone na kategorie (auth, profile, achievements, rankings, stats)
- **Setup centralny**: Jeden plik setup.js z globalnymi helperami
- **Environment isolation**: Osobne środowisko testowe z .env.test
- **Clear test names**: Czytelne nazwy testów opisujące scenariusze

#### ✅ **Helper Functions**
```javascript
// Dobre rozwiązania z user-service:
global.testHelpers = {
  createTestUser: async (overrides = {}) => { /* ... */ },
  generateTestToken: (user) => { /* ... */ },
  createTestQuizHistory: async (userId, overrides = {}) => { /* ... */ },
  expectValidationError: (response, field) => { /* ... */ }
};
```

#### ✅ **Izolacja Testów**
- **Cleanup między testami**: Wyczyste tabele przed każdym testem
- **Unikalne dane**: Email counters, unique IDs
- **Transaction safety**: Użycie transakcji dla czyszczenia

#### ✅ **Comprehensive Coverage**
- **API endpoints**: Wszystkie endpointy są testowane
- **Authentication**: Kompletne testy uwierzytelniania
- **Business logic**: Testy logiki biznesowej (achievements, rankings)
- **Edge cases**: Obsługa błędów i przypadków brzegowych

### 1.2 Problemy i Zawiłości

#### ❌ **Nadmierna Komplikacja**

**Problem 1: Skomplikowany Setup Prisma**
```javascript
// Zbyt skomplikowane resetowanie bazy
beforeAll(async () => {
  try {
    await global.prisma.$queryRaw`SELECT 1`;
    console.log('✅ Testowa baza danych jest gotowa');
  } catch (error) {
    const { execSync } = require('child_process');
    execSync('npm run test:db:reset', { stdio: 'inherit' });
  }
});
```

**Problem 2: Nadmierne Mockowanie**
```javascript
// Zbyt dużo mocków w stats.test.js
jest.mock('axios');
axios.get.mockImplementation((url) => {
  if (url.includes(`/api/quizzes/${QUIZ_ID}/questions`)) {
    return Promise.resolve({ data: { questions: mockQuestions } });
  }
  // 10+ więcej warunków...
});
```

**Problem 3: Długie i Złożone Testy**
```javascript
// Test robiący zbyt dużo rzeczy naraz
it('should award multiple achievements at once', async () => {
  const sessionData = { accuracy: 100 };
  await global.testHelpers.createTestQuizHistory(testUser.id, { accuracy: 100 });
  const newAchievements = await checkAndAwardAchievements(testUser.id, sessionData);
  expect(newAchievements.length).toBeGreaterThanOrEqual(2);
  expect(newAchievements.some(a => a.name === achievementDefinitions.first_quiz.name)).toBe(true);
  expect(newAchievements.some(a => a.name === achievementDefinitions.perfectionist.name)).toBe(true);
});
```

#### ❌ **Performance Issues**
- **Duplicate bcrypt hashing**: Hasła hashowane przy każdym createTestUser
- **Serial test execution**: Brak paralelizacji gdzie możliwe
- **Heavy database operations**: Częste migracje i reset

#### ❌ **Maintenance Overhead**
- **Complex mocking logic**: Trudne do utrzymania mocki
- **Tight coupling**: Testy zbyt mocno powiązane z implementacją
- **Magic numbers**: Hardkodowane wartości bez konstant

---

## 2. Wnioski i Lekcje Wyciągnięte

### 2.1 Kluczowe Lekcje

#### 🎯 **Lekcja 1: Prostota > Kompletność**
- **Prostsze testy są łatwiejsze do utrzymania**
- **Jeden test = jeden scenariusz**
- **Mniej mocków = więcej prawdziwych testów**

#### 🎯 **Lekcja 2: Performance Ma Znaczenie**
- **Pre-computed test data**
- **Shared database setup**
- **Bulk operations gdzie możliwe**

#### 🎯 **Lekcja 3: MongoDB != PostgreSQL**
- **Różne strategie czyszczenia**
- **ObjectId handling**
- **In-memory database dla testów**

#### 🎯 **Lekcja 4: Test Utilities**
- **Factory functions zamiast complex builders**
- **Константы dla test data**
- **Shared assertions**

### 2.2 Strategia Uproszczenia

#### 📋 **Uproszczenia dla Quiz Service**

1. **Użyj MongoDB Memory Server** zamiast prawdziwej bazy
2. **Factory pattern** dla test data
3. **Minimal mocking** - tylko external services
4. **Focused tests** - jeden test na funkcjonalność
5. **Shared test constants**
6. **Parallel execution** gdzie bezpieczne

---

## 3. Strategia dla Quiz Service

### 3.1 Architektura Testów

```
quiz-service/
├── tests/
│   ├── setup.js              # Global setup z MongoDB Memory Server
│   ├── factories/             # Data factories
│   │   ├── quiz.factory.js
│   │   ├── question.factory.js
│   │   ├── session.factory.js
│   │   └── user.factory.js
│   ├── helpers/               # Test utilities
│   │   ├── auth.helper.js
│   │   └── db.helper.js
│   ├── integration/           # Integration tests
│   │   ├── quiz.test.js
│   │   ├── question.test.js
│   │   ├── session.test.js
│   │   ├── category.test.js
│   │   ├── tag.test.js
│   │   └── group.test.js
│   └── unit/                  # Unit tests (jeśli potrzebne)
│       └── controllers/
├── .env.test                  # Test environment
└── package.json              # Test scripts
```

### 3.2 Główne Założenia

1. **MongoDB Memory Server** - szybkie, izolowane testy
2. **Factory Pattern** - consistent test data
3. **Minimal External Dependencies** - tylko niezbędne mocki
4. **Fast Cleanup** - collection-level clearing
5. **Parallel Safe** - gdzie możliwe

---

## 4. Konfiguracja Środowiska

### 4.1 Wymagane Pakiety

```json
{
  "devDependencies": {
    "jest": "^29.5.0",
    "supertest": "^6.3.3",
    "mongodb-memory-server": "^8.12.2",
    "@faker-js/faker": "^8.0.2"
  }
}
```

### 4.2 Environment Configuration

**.env.test**
```env
NODE_ENV=test
PORT=3003

# MongoDB Test Configuration
MONGODB_URI=mongodb://127.0.0.1:27017/quiz_app_test
DB_NAME=quiz_app_test

# JWT Configuration
JWT_SECRET=test-super-secret-jwt-key-for-tests-only

# Service URLs (mocked)
USER_SERVICE_URL=http://localhost:3002

# Test settings
TEST_TIMEOUT=30000
LOG_LEVEL=error
```

### 4.3 Jest Configuration

**jest.config.js**
```javascript
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 30000,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  testMatch: [
    '<rootDir>/tests/**/*.test.js'
  ]
};
```

---

## 5. Implementacja Krok po Kroku

### Faza 1: Setup i Infrastruktura (1-2 dni)

#### Krok 1: Instalacja Pakietów
```bash
cd ~/project-merge/quiz-app/services/quiz-service
npm install --save-dev jest supertest mongodb-memory-server @faker-js/faker
```

#### Krok 2: Utworzenie .env.test
```bash
# Utworzenie pliku środowiska testowego
cat > .env.test << 'EOF'
NODE_ENV=test
PORT=3003
MONGODB_URI=mongodb://127.0.0.1:27017/quiz_app_test
DB_NAME=quiz_app_test
JWT_SECRET=test-super-secret-jwt-key-for-tests-only
USER_SERVICE_URL=http://localhost:3002
TEST_TIMEOUT=30000
LOG_LEVEL=error
EOF
```

#### Krok 3: Package.json Scripts
```json
{
  "scripts": {
    "test": "NODE_ENV=test jest",
    "test:watch": "NODE_ENV=test jest --watch",
    "test:coverage": "NODE_ENV=test jest --coverage",
    "test:debug": "NODE_ENV=test node --inspect-brk node_modules/.bin/jest --runInBand"
  }
}
```

#### Krok 4: Global Setup
**tests/setup.js**
```javascript
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.test' });

let mongoServer;

// Global setup
beforeAll(async () => {
  // Start MongoDB Memory Server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Connect mongoose
  await mongoose.connect(mongoUri);
  console.log('🧪 Test MongoDB connected');
});

// Global cleanup
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  console.log('🧹 Test MongoDB disconnected');
});

// Clean between tests
beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Increase Jest timeout
jest.setTimeout(30000);
```

### Faza 2: Helper Functions (1 dzień)

#### Krok 5: Auth Helper
**tests/helpers/auth.helper.js**
```javascript
const jwt = require('jsonwebtoken');

const createMockUser = (overrides = {}) => ({
  id: 12345,
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'student',
  ...overrides
});

const generateToken = (user = null) => {
  const userData = user || createMockUser();
  return jwt.sign(userData, process.env.JWT_SECRET, { expiresIn: '1h' });
};

const getAuthHeaders = (user = null) => ({
  'Authorization': `Bearer ${generateToken(user)}`,
  'x-user-id': user?.id || '12345',
  'x-user-username': `${user?.firstName || 'Test'} ${user?.lastName || 'User'}`,
  'x-user-roles': user?.role || 'student'
});

module.exports = {
  createMockUser,
  generateToken,
  getAuthHeaders
};
```

#### Krok 6: Database Helper
**tests/helpers/db.helper.js**
```javascript
const mongoose = require('mongoose');

const clearCollections = async (...collectionNames) => {
  const collections = mongoose.connection.collections;
  
  if (collectionNames.length === 0) {
    // Clear all collections
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  } else {
    // Clear specific collections
    for (const name of collectionNames) {
      if (collections[name]) {
        await collections[name].deleteMany({});
      }
    }
  }
};

const getCollectionCounts = async () => {
  const collections = mongoose.connection.collections;
  const counts = {};
  
  for (const [name, collection] of Object.entries(collections)) {
    counts[name] = await collection.countDocuments();
  }
  
  return counts;
};

module.exports = {
  clearCollections,
  getCollectionCounts
};
```

### Faza 3: Factories (1 dzień)

#### Krok 7: Quiz Factory
**tests/factories/quiz.factory.js**
```javascript
const { faker } = require('@faker-js/faker');
const Quiz = require('../../src/models/Quiz');

const createQuizData = (overrides = {}) => ({
  title: faker.lorem.sentence(3),
  description: faker.lorem.paragraph(),
  difficulty: faker.helpers.arrayElement(['easy', 'medium', 'hard']),
  isPublic: true,
  createdBy: '12345',
  ...overrides
});

const createQuiz = async (overrides = {}) => {
  const quizData = createQuizData(overrides);
  return await Quiz.create(quizData);
};

const createMultipleQuizzes = async (count = 3, baseOverrides = {}) => {
  const quizzes = [];
  for (let i = 0; i < count; i++) {
    const quiz = await createQuiz({
      ...baseOverrides,
      title: `${baseOverrides.title || 'Test Quiz'} ${i + 1}`
    });
    quizzes.push(quiz);
  }
  return quizzes;
};

module.exports = {
  createQuizData,
  createQuiz,
  createMultipleQuizzes
};
```

#### Krok 8: Question Factory
**tests/factories/question.factory.js**
```javascript
const { faker } = require('@faker-js/faker');
const Question = require('../../src/models/Question');

const createQuestionData = (overrides = {}) => {
  const type = overrides.type || faker.helpers.arrayElement(['single', 'multiple', 'boolean', 'text']);
  
  let options = [];
  let correctAnswers = [];
  
  if (type === 'single' || type === 'multiple') {
    options = [
      faker.lorem.sentence(),
      faker.lorem.sentence(),
      faker.lorem.sentence(),
      faker.lorem.sentence()
    ];
    correctAnswers = type === 'single' ? [options[0]] : [options[0], options[1]];
  } else if (type === 'boolean') {
    options = ['Prawda', 'Fałsz'];
    correctAnswers = [faker.helpers.arrayElement(options)];
  }
  
  return {
    text: faker.lorem.sentence() + '?',
    type,
    options,
    correctAnswers,
    points: faker.number.int({ min: 1, max: 5 }),
    createdBy: '12345',
    ...overrides
  };
};

const createQuestion = async (overrides = {}) => {
  const questionData = createQuestionData(overrides);
  return await Question.create(questionData);
};

const createQuestionsForQuiz = async (quizId, count = 5, overrides = {}) => {
  const questions = [];
  for (let i = 0; i < count; i++) {
    const question = await createQuestion(overrides);
    questions.push(question);
  }
  return questions;
};

module.exports = {
  createQuestionData,
  createQuestion,
  createQuestionsForQuiz
};
```

### Faza 4: Integration Tests (2-3 dni)

#### Krok 9: Quiz Tests
**tests/integration/quiz.test.js**
```javascript
const request = require('supertest');
const app = require('../../src/index');
const { createQuiz, createMultipleQuizzes } = require('../factories/quiz.factory');
const { getAuthHeaders, createMockUser } = require('../helpers/auth.helper');
const { clearCollections } = require('../helpers/db.helper');

describe('Quiz API Integration Tests', () => {
  const authHeaders = getAuthHeaders();
  
  describe('POST /api/quizzes', () => {
    it('should create a new quiz', async () => {
      const quizData = {
        title: 'New Test Quiz',
        description: 'A test quiz description',
        difficulty: 'medium'
      };

      const response = await request(app)
        .post('/api/quizzes')
        .set(authHeaders)
        .send(quizData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(quizData.title);
    });
    
    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/quizzes')
        .set(authHeaders)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Błędy walidacji');
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

      expect(response.body.success).toBe(true);
      expect(response.body.data.quizzes).toHaveLength(5);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/quizzes?page=1&limit=2')
        .set(authHeaders)
        .expect(200);

      expect(response.body.data.quizzes).toHaveLength(2);
      expect(response.body.data.pagination.limit).toBe(2);
    });
  });
});
```

#### Krok 10: Session Tests (najprostsza wersja)
**tests/integration/session.test.js**
```javascript
const request = require('supertest');
const app = require('../../src/index');
const { createQuiz } = require('../factories/quiz.factory');
const { createQuestionsForQuiz } = require('../factories/question.factory');
const { getAuthHeaders } = require('../helpers/auth.helper');

describe('Session API Integration Tests', () => {
  const authHeaders = getAuthHeaders();
  let quiz, questions;

  beforeEach(async () => {
    quiz = await createQuiz();
    questions = await createQuestionsForQuiz(quiz._id, 3);
    
    // Update quiz with questions
    quiz.questions = questions.map(q => q._id);
    await quiz.save();
  });

  describe('POST /api/sessions/start/:quizId', () => {
    it('should start a new quiz session', async () => {
      const response = await request(app)
        .post(`/api/sessions/start/${quiz._id}`)
        .set(authHeaders)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.quizId.toString()).toBe(quiz._id.toString());
      expect(response.body.data.status).toBe('in-progress');
    });
  });
});
```

### Faza 5: Optymalizacja i Finalizacja (1 dzień)

#### Krok 11: Constants i Utilities
**tests/constants.js**
```javascript
module.exports = {
  // Test data constants
  DEFAULT_USER_ID: '12345',
  DEFAULT_QUIZ_TITLE: 'Test Quiz',
  
  // Quiz difficulties
  DIFFICULTIES: ['easy', 'medium', 'hard'],
  
  // Question types
  QUESTION_TYPES: ['single', 'multiple', 'boolean', 'text'],
  
  // Session statuses
  SESSION_STATUSES: ['in-progress', 'completed', 'paused', 'abandoned'],
  
  // Default pagination
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100
};
```

#### Krok 12: Shared Assertions
**tests/assertions.js**
```javascript
const expectValidationError = (response, expectedField = null) => {
  expect(response.status).toBe(400);
  expect(response.body.error).toBe('Błędy walidacji');
  
  if (expectedField) {
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        expect.stringMatching(new RegExp(expectedField, 'i'))
      ])
    );
  }
};

const expectPaginatedResponse = (response, expectedLength = null) => {
  expect(response.body.success).toBe(true);
  expect(response.body.data.pagination).toBeDefined();
  expect(response.body.data.pagination).toMatchObject({
    currentPage: expect.any(Number),
    itemsPerPage: expect.any(Number),
    totalItems: expect.any(Number),
    totalPages: expect.any(Number)
  });
  
  if (expectedLength !== null) {
    expect(response.body.data.items).toHaveLength(expectedLength);
  }
};

module.exports = {
  expectValidationError,
  expectPaginatedResponse
};
```

---

## 6. Struktura Testów

### 6.1 Hierarchia Testowania

```javascript
// Pattern dla każdego testu integration
describe('EntityName API Integration Tests', () => {
  // Setup per test suite
  beforeEach(() => {
    // Prepare common data
  });

  describe('HTTP_METHOD /api/path', () => {
    it('should handle success case', async () => {
      // Test happy path
    });
    
    it('should validate input', async () => {
      // Test validation
    });
    
    it('should handle authentication', async () => {
      // Test auth requirements
    });
  });
});
```

### 6.2 Test Naming Convention

```javascript
// ✅ Good naming
it('should create quiz with valid data')
it('should return 401 when user not authenticated')
it('should filter quizzes by category')

// ❌ Bad naming  
it('test quiz creation')
it('should work correctly')
it('test endpoint')
```

---

## 7. Helper Functions

### 7.1 Globalne Helpery

**tests/setup.js** (rozszerzenie)
```javascript
// Add to existing setup.js
global.testHelpers = {
  // Quick data creation
  createMockUser: require('./helpers/auth.helper').createMockUser,
  getAuthHeaders: require('./helpers/auth.helper').getAuthHeaders,
  
  // Database utilities
  clearCollections: require('./helpers/db.helper').clearCollections,
  getCollectionCounts: require('./helpers/db.helper').getCollectionCounts,
  
  // Assertion helpers
  expectValidationError: require('./assertions').expectValidationError,
  expectPaginatedResponse: require('./assertions').expectPaginatedResponse,
  
  // Quick object creation
  createQuiz: require('./factories/quiz.factory').createQuiz,
  createQuestion: require('./factories/question.factory').createQuestion
};
```

### 7.2 Usage Examples

```javascript
// In test files
const { createQuiz, getAuthHeaders, expectValidationError } = global.testHelpers;

it('should validate quiz creation', async () => {
  const response = await request(app)
    .post('/api/quizzes')
    .set(getAuthHeaders())
    .send({})
    .expect(400);
    
  expectValidationError(response, 'title');
});
```

---

## 8. Testy Integracyjne

### 8.1 Strategia Coverage

| Endpoint | Priority | Test Cases |
|----------|----------|------------|
| **Quizzes** | 🔴 High | CRUD, validation, search, filtering |
| **Questions** | 🔴 High | CRUD, types, validation |
| **Sessions** | 🔴 High | Start, answer, complete, pause |
| **Categories** | 🟡 Medium | CRUD, hierarchy |
| **Tags** | 🟡 Medium | CRUD, popular tags |
| **Groups** | 🟡 Medium | CRUD, membership |

### 8.2 Mock Strategy

#### External Services Only
```javascript
// ✅ Mock external services
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn()
}));

// ❌ Don't mock internal logic
// jest.mock('../src/controllers/quiz.controller');
```

#### User Service Communication
```javascript
// Mock only user service calls
const mockUserServiceResponse = {
  get: jest.fn().mockResolvedValue({
    data: { id: 12345, username: 'testuser' }
  })
};

// Setup in beforeEach
beforeEach(() => {
  axios.get.mockImplementation((url) => {
    if (url.includes('/api/users/')) {
      return mockUserServiceResponse.get();
    }
    return Promise.reject(new Error('Unmocked URL'));
  });
});
```

---

## 9. Automatyzacja i CI/CD

### 9.1 GitHub Actions

**.github/workflows/quiz-service-tests.yml**
```yaml
name: Quiz Service Tests

on:
  push:
    paths:
      - 'services/quiz-service/**'
  pull_request:
    paths:
      - 'services/quiz-service/**'

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    defaults:
      run:
        working-directory: services/quiz-service
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
        cache-dependency-path: services/quiz-service/package-lock.json
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
      
    - name: Generate coverage
      run: npm run test:coverage
      
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        directory: ./services/quiz-service/coverage
        flags: quiz-service
```

### 9.2 Pre-commit Hooks

**package.json**
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm test && npm run lint"
    }
  }
}
```

---

## 10. Najlepsze Praktyki

### 10.1 Test Organization

#### ✅ **DOs**
- **One concept per test** - jeden test, jedna funkcjonalność
- **Descriptive names** - nazwa opisuje dokładnie co testujemy
- **Arrange-Act-Assert** - struktura AAA w testach
- **Independent tests** - każdy test niezależny od innych
- **Fast feedback** - testy szybkie do wykonania

#### ❌ **DON'Ts**
- **No shared state** between tests
- **No hardcoded delays** - używaj waitFor zamiast setTimeout
- **No testing implementation** - testuj behavior, nie implementation
- **No complex setup** - prostota w przygotowaniu danych

### 10.2 Performance Tips

#### 🚀 **Optimization Strategies**

1. **Batch Operations**
```javascript
// ✅ Good - batch creation
const quizzes = await Quiz.insertMany([
  { title: 'Quiz 1', createdBy: '12345' },
  { title: 'Quiz 2', createdBy: '12345' },
  { title: 'Quiz 3', createdBy: '12345' }
]);

// ❌ Bad - sequential creation
for (let i = 0; i < 3; i++) {
  await Quiz.create({ title: `Quiz ${i}`, createdBy: '12345' });
}
```

2. **Collection-level Clearing**
```javascript
// ✅ Good - clear collections
beforeEach(async () => {
  await Promise.all([
    Quiz.deleteMany({}),
    Question.deleteMany({}),
    Session.deleteMany({})
  ]);
});

// ❌ Bad - individual deletions
beforeEach(async () => {
  const quizzes = await Quiz.find({});
  for (const quiz of quizzes) {
    await Quiz.findByIdAndDelete(quiz._id);
  }
});
```

3. **Parallel Test Execution**
```javascript
// jest.config.js
module.exports = {
  maxWorkers: '50%', // Używaj 50% CPU cores
  testTimeout: 30000
};
```

### 10.3 Maintenance

#### 📋 **Regular Tasks**

1. **Weekly**
   - Review test performance metrics
   - Update test data factories
   - Clean up obsolete tests

2. **Monthly**
   - Review coverage reports
   - Update dependencies
   - Optimize slow tests

3. **Per Release**
   - Full test suite execution
   - Coverage threshold check
   - Performance regression tests

---

## 11. Timeline i Milestones

### 11.1 Detailed Timeline

#### **Week 1: Setup & Infrastructure**
- **Day 1**: Environment setup, dependencies installation
- **Day 2**: Global setup configuration, MongoDB Memory Server
- **Day 3**: Helper functions and auth utilities
- **Day 4**: Factory functions for test data
- **Day 5**: First integration test (Quiz CRUD)

#### **Week 2: Core Tests**
- **Day 1**: Quiz API tests (complete)
- **Day 2**: Question API tests
- **Day 3**: Session API tests
- **Day 4**: Category and Tag tests
- **Day 5**: Group tests and cleanup

#### **Week 3: Optimization & CI/CD**
- **Day 1**: Performance optimization
- **Day 2**: Test reliability improvements
- **Day 3**: GitHub Actions setup
- **Day 4**: Coverage reporting
- **Day 5**: Documentation and final review

### 11.2 Success Metrics

#### 📊 **Target Metrics**
- **Coverage**: >80% line coverage
- **Performance**: <30s total test execution
- **Reliability**: <1% flaky test rate
- **Maintainability**: <5min to add new test

#### 📈 **Progress Tracking**
```bash
# Daily progress check
npm run test:coverage
npm run test -- --verbose
```

---

## 12. Quick Start Guide

### 12.1 Commands Summary

```bash
# Setup
cd ~/project-merge/quiz-app/services/quiz-service
npm install --save-dev jest supertest mongodb-memory-server @faker-js/faker

# Create test structure
mkdir -p tests/{factories,helpers,integration,unit}

# Run tests
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage
npm run test:debug          # Debug mode
```

### 12.2 First Test Template

```javascript
// tests/integration/example.test.js
const request = require('supertest');
const app = require('../../src/index');
const { getAuthHeaders } = require('../helpers/auth.helper');

describe('Example API Tests', () => {
  const authHeaders = getAuthHeaders();

  it('should work', async () => {
    const response = await request(app)
      .get('/api/health')
      .set(authHeaders)
      .expect(200);

    expect(response.body.status).toBe('ok');
  });
});
```

---

## Podsumowanie

### 🎯 **Kluczowe Korzyści Tego Podejścia**

1. **Prostota** - mniej boilerplate, więcej testów
2. **Szybkość** - MongoDB Memory Server + optimizations
3. **Niezawodność** - mniej mocków, więcej real tests
4. **Maintainability** - factory pattern + helper functions
5. **Skalowalność** - parallel execution ready

### 🚀 **Rozpocznij od:**

1. Setup środowiska testowego
2. Pierwszy test quiz API
3. Postupowe dodawanie coverage
4. Optymalizacja w trakcie rozwoju

Ten plan implementacji jest znacznie prostszy niż user-service, ale zachowuje wszystkie niezbędne funkcjonalności dla kompleksowego testowania quiz-service.
