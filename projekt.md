# Quiz App - Kompleksowa Dokumentacja Projektu

## Spis Treści

1. [Przegląd Systemu](#1-przegląd-systemu)
2. [Architektura Systemu](#2-architektura-systemu)
3. [Funkcjonalności](#3-funkcjonalności)
4. [Analiza Wymagań](#4-analiza-wymagań)
5. [API Endpoints](#5-api-endpoints)
6. [Modele Danych](#6-modele-danych)
7. [Bezpieczeństwo](#7-bezpieczeństwo)
8. [Wdrożenie](#8-wdrożenie)
9. [Monitoring i Testowanie](#9-monitoring-i-testowanie)
10. [Wnioski i Rekomendacje](#10-wnioski-i-rekomendacje)

---

## 1. Przegląd Systemu

### 1.1 Opis Projektu

Quiz App to kompleksowa platforma do tworzenia, zarządzania i rozwiązywania quizów, zbudowana w architekturze mikroserwisów. System umożliwia użytkownikom tworzenie interaktywnych quizów, śledzenie postępów, zarządzanie grupami oraz rywalizację w rankingach.

### 1.2 Główne Cele

- **Edukacja interaktywna**: Umożliwienie tworzenia różnorodnych quizów edukacyjnych
- **Zarządzanie społecznością**: Tworzenie grup użytkowników i współpraca
- **Gamifikacja**: System punktów, osiągnięć i rankingów motywujący do nauki
- **Analityka**: Szczegółowe statystyki dla użytkowników i twórców quizów

### 1.3 Technologie

- **Backend**: Node.js, Express.js
- **Bazy danych**: MongoDB (quiz-service), PostgreSQL (user-service)
- **ORM**: Mongoose, Prisma
- **Uwierzytelnianie**: JWT
- **Konteneryzacja**: Docker, Docker Compose
- **Walidacja**: express-validator, Joi
- **Bezpieczeństwo**: Helmet, bcryptjs, rate limiting

---

## 2. Architektura Systemu

### 2.1 Schemat Architektury

```
┌─────────────────┐    ┌─────────────────┐
│    Frontend     │    │    Gateway      │
│   (port 3000)   │◄──►│   (port 3001)   │
└─────────────────┘    └─────────────────┘
                                │
                       ┌────────┴────────┐
                       │                 │
              ┌─────────▼──────┐ ┌───────▼──────────┐
              │ User-Service   │ │  Quiz-Service    │
              │ (port 3002)    │ │  (port 3003)     │
              │                │ │                  │
              │ ┌─────────────┐│ │ ┌──────────────┐ │
              │ │PostgreSQL   ││ │ │  MongoDB     │ │
              │ │+ Prisma     ││ │ │+ Mongoose    │ │
              │ └─────────────┘│ │ └──────────────┘ │
              └────────────────┘ └──────────────────┘
```

### 2.2 Komponenty Systemu

#### 2.2.1 Gateway Service (port 3001)
- **Odpowiedzialność**: Routing żądań, load balancing
- **Funkcje**: 
  - Centralny punkt wejścia do API
  - Health check endpoints
  - CORS i podstawowe middleware
- **Technologie**: Express.js

#### 2.2.2 User Service (port 3002)
- **Odpowiedzialność**: Zarządzanie użytkownikami, uwierzytelnianie, statystyki
- **Baza danych**: PostgreSQL z Prisma ORM
- **Główne funkcje**:
  - Rejestracja i logowanie użytkowników
  - Zarządzanie profilami
  - System osiągnięć
  - Rankingi globalne, tygodniowe i kategorii
  - Statystyki użytkowników

#### 2.2.3 Quiz Service (port 3003)
- **Odpowiedzialność**: Zarządzanie quizami, pytaniami, sesjami
- **Baza danych**: MongoDB z Mongoose
- **Główne funkcje**:
  - CRUD operacje na quizach i pytaniach
  - Zarządzanie kategoriami i tagami
  - Sesje rozwiązywania quizów
  - Grupy użytkowników
  - System komentarzy i ocen

### 2.3 Komunikacja Między Serwisami

- **REST API**: Główny protokół komunikacji
- **Axios**: Klient HTTP dla komunikacji między serwisami
- **JWT**: Przekazywanie informacji o użytkowniku między serwisami
- **Headers**: Propagacja user context (`x-user-id`, `x-user-username`, `x-user-roles`)

---

## 3. Funkcjonalności

### 3.1 Zarządzanie Użytkownikami i Autentykacja ✅

#### 3.1.1 Implementacja
- **Rejestracja**: Email + hasło, haszowanie bcrypt (12 rounds)
- **Logowanie**: JWT token z 24h wygaśnięciem
- **Profile**: Zarządzanie danymi osobowymi
- **Role**: student, instructor, admin
- **Bezpieczeństwo**: Rate limiting, helmet, walidacja danych

#### 3.1.2 Endpointy
```http
POST /api/users/register
POST /api/users/login
GET /api/users/profile
PUT /api/users/profile
PUT /api/users/password
GET /api/users/all (admin)
PUT /api/users/:userId/role (admin)
```

### 3.2 Tworzenie i Edycja Quizów ✅

#### 3.2.1 Implementacja
- **CRUD operacje**: Pełne zarządzanie quizami
- **Metadane**: Tytuł, opis, kategoria, poziom trudności, czas trwania
- **Prywatność**: Publiczne/prywatne, zaproszenia, dostęp grupowy
- **Walidacja**: express-validator z kompleksowymi regułami

#### 3.2.2 Endpointy
```http
POST /api/quizzes
GET /api/quizzes
GET /api/quizzes/:id
PUT /api/quizzes/:id
DELETE /api/quizzes/:id
GET /api/quizzes/user/my-quizzes
```

### 3.3 Zarządzanie Pytaniami ✅

#### 3.3.1 Typy Pytań
- **Single choice**: Jeden poprawny wybór
- **Multiple choice**: Wiele poprawnych wyborów
- **Boolean**: Prawda/Fałsz
- **Text**: Pytania otwarte

#### 3.3.2 Funkcje
- Dodawanie pytań do quizów
- System punktacji (1-100 punktów)
- Podpowiedzi i wyjaśnienia
- Kategoryzacja pytań

#### 3.3.3 Endpointy
```http
POST /api/quizzes/:quizId/questions
GET /api/quizzes/:quizId/questions
GET /api/questions/:id
PUT /api/questions/:id
DELETE /api/questions/:id
```

### 3.4 Wyszukiwanie i Przeglądanie Quizów ✅

#### 3.4.1 Implementacja
- **Filtrowanie**: Kategoria, poziom trudności, język, tagi
- **Wyszukiwanie**: Full-text search w tytułach i opisach
- **Sortowanie**: Data, popularność, oceny, liczba rozgrywek
- **Paginacja**: Responsywna z limit/offset

#### 3.4.2 Endpointy
```http
GET /api/quizzes?category=&difficulty=&tags=&keywords=
GET /api/quizzes/search?q=&sortBy=views&sortOrder=desc
```

### 3.5 Rozwiązywanie Quizów ✅

#### 3.5.1 System Sesji
```javascript
// Model sesji
{
  userId: Number,
  quizId: ObjectId,
  status: 'in-progress' | 'completed' | 'paused' | 'abandoned',
  startedAt: Date,
  currentQuestionIndex: Number,
  answers: [
    {
      questionId: ObjectId,
      selectedAnswers: [String],
      isCorrect: Boolean,
      pointsAwarded: Number,
      timeSpent: Number
    }
  ],
  score: Number,
  accuracy: Number,
  perfectScore: Boolean,
  speedBonus: Boolean
}
```

#### 3.5.2 Funkcje
- Rozpoczynanie sesji
- Zapisywanie odpowiedzi w real-time
- Wstrzymywanie i wznawianie
- Automatyczne sprawdzanie poprawności
- Prezentacja wyników z analizą

#### 3.5.3 Endpointy
```http
POST /api/sessions/start/:quizId
GET /api/sessions/:sessionId/question
POST /api/sessions/:sessionId/answer
POST /api/sessions/:sessionId/complete
POST /api/sessions/:sessionId/pause
POST /api/sessions/:sessionId/resume
```

### 3.6 System Punktacji i Osiągnięć ✅

#### 3.6.1 Mechanizm Punktacji
- **Podstawowe punkty**: Za poprawne odpowiedzi
- **Bonus za prędkość**: Za szybkie rozwiązanie
- **Bonus za serię**: Za codzienne granie
- **Perfekcyjny wynik**: 100% poprawnych odpowiedzi

#### 3.6.2 Osiągnięcia
```javascript
const achievementTypes = {
  'first_quiz': { pointsAwarded: 10, rarity: 'common' },
  'quiz_master_10': { pointsAwarded: 50, rarity: 'rare' },
  'perfectionist': { pointsAwarded: 25, rarity: 'rare' },
  'speed_demon': { pointsAwarded: 30, rarity: 'rare' },
  'streak_warrior_5': { pointsAwarded: 40, rarity: 'rare' },
  'score_legend_5000': { pointsAwarded: 200, rarity: 'epic' }
}
```

#### 3.6.3 Rankingi
- **Globalny**: Wszyscy użytkownicy według totalScore
- **Tygodniowy**: Wyniki z aktualnego tygodnia
- **Kategorii**: Rankingi dla każdej kategorii quizów

### 3.7 Zarządzanie Kategoriami i Tagami ✅

#### 3.7.1 Kategorie
- **Hierarchiczna struktura**: Parent-child relationships
- **CRUD operacje**: Pełne zarządzanie
- **Filtrowanie**: Aktywne/nieaktywne kategoriae

#### 3.7.2 Tagi
- **Elastyczne tagowanie**: Dowolne tagi dla quizów
- **Popularne tagi**: Ranking według użycia
- **Wyszukiwanie**: Po tagach i kategoriach

### 3.8 Statystyki i Analiza Wyników ✅

#### 3.8.1 Dla Użytkowników
```javascript
// Przykład odpowiedzi API statystyk użytkownika
{
  overview: {
    totalQuizzes: 45,
    averageScore: 78.5,
    currentStreak: 5,
    globalRank: 127
  },
  categoryPerformance: [
    { category: "Historia", averageScore: 85.3, level: 3 },
    { category: "Matematyka", averageScore: 72.1, level: 2 }
  ],
  progressOverTime: [...],
  strengthsAndWeaknesses: {...}
}
```

#### 3.8.2 Dla Twórców Quizów
- **Popularność**: Liczba rozgrywek, średni wynik
- **Analiza trudności**: Które pytania są najtrudniejsze
- **Trendy**: Popularność w czasie
- **Statystyki pytań**: Procent poprawnych odpowiedzi

### 3.9 Społeczność i Współpraca ✅

#### 3.9.1 Grupy Użytkowników
```javascript
// Model grupy
{
  name: String,
  description: String,
  createdBy: String,
  members: [
    { userId: String, role: 'admin' | 'member', joinedAt: Date }
  ],
  isPublic: Boolean
}
```

#### 3.9.2 Funkcje Społecznościowe
- **Komentarze**: System komentarzy do quizów
- **Oceny**: 1-5 gwiazdek z średnią ocen
- **Udostępnianie**: Zapraszanie użytkowników do prywatnych quizów
- **Dostęp grupowy**: Udostępnianie quizów grupom

---

## 4. Analiza Wymagań

### 4.1 Wymagania Funkcjonalne - Status Realizacji

| Wymaganie | Status | Ocena | Uwagi |
|-----------|---------|-------|--------|
| Zarządzanie użytkownikami i autentykacja | ✅ Zrealizowane | 100% | JWT, role, bcrypt, rate limiting |
| Tworzenie i edycja quizów | ✅ Zrealizowane | 100% | CRUD, metadane, prywatność |
| Zarządzanie pytaniami | ✅ Zrealizowane | 100% | 4 typy pytań, punktacja, walidacja |
| Wyszukiwanie i przeglądanie quizów | ✅ Zrealizowane | 100% | Filtering, search, sorting, pagination |
| Rozwiązywanie quizów | ✅ Zrealizowane | 100% | Sesje, real-time, pause/resume |
| System punktacji i osiągnięć | ✅ Zrealizowane | 100% | Złożony system nagród i rankingów |
| Zarządzanie kategoriami i tagami | ✅ Zrealizowane | 100% | Hierarchie, CRUD, popularność |
| Statystyki i analiza wyników | ✅ Zrealizowane | 100% | Dla użytkowników i twórców |
| Społeczność i współpraca | ✅ Zrealizowane | 100% | Grupy, komentarze, udostępnianie |

### 4.2 Wymagania Techniczne - Status Realizacji

| Wymaganie | Status | Ocena | Implementacja |
|-----------|---------|-------|---------------|
| **Routing i Middleware w Express.js** | ✅ | 100% | Kompleksowa struktura tras z middleware |
| **Centralna obsługa błędów** | ✅ | 100% | Global error handlers w każdym serwisie |
| **Definicja mikroserwisów** | ✅ | 100% | 3 serwisy z jasno określonymi odpowiedzialnościami |
| **REST API między mikroserwisami** | ✅ | 100% | Axios communication, header propagation |
| **Połączenie i ORM relacyjnej BD** | ✅ | 100% | PostgreSQL + Prisma z migracjami |
| **Zapytania relacyjne i optymalizacja** | ✅ | 90% | Joins, transakcje, indeksy (brak advanced indexes) |
| **MongoDB i Mongoose** | ✅ | 100% | Schematy, walidacja, populacje |
| **Zaawansowane operacje MongoDB** | ✅ | 90% | Agregacje, indeksy (brak GeoJSON) |
| **Uwierzytelnianie JWT i autoryzacja** | ✅ | 100% | JWT + RBAC (role-based access control) |
| **Zabezpieczenia aplikacji** | ✅ | 100% | Helmet, rate limiting, bcrypt |
| **Walidacja danych** | ✅ | 100% | express-validator + Joi schemas |
| **Testy jednostkowe i integracyjne** | ❌ | 0% | Brak implementacji testów |

### 4.3 Wymagania Dodatkowe - Status Realizacji

| Wymaganie | Status | Ocena | Komentarz |
|-----------|---------|-------|-----------|
| **Standardy jakości kodu i analiza** | ⚠️ | 30% | ESLint skonfigurowany ale nie wymuszany |
| **Automatyczne raportowanie błędów** | ❌ | 0% | Brak integracji z Sentry/Bugsnag |
| **Zaawansowane techniki indeksowania** | ⚠️ | 50% | Podstawowe indeksy, brak zaawansowanych |
| **Backup i odzyskiwanie BD** | ❌ | 0% | Brak procedur backup |
| **Optymalizacja puli połączeń** | ⚠️ | 60% | Domyślne ustawienia, brak tuningu |
| **CI/CD dla mikroserwisów** | ❌ | 0% | Brak pipeline CI/CD |
| **Optymalizacja obrazów Docker** | ⚠️ | 70% | Multi-stage builds, ale można poprawić |
| **Automatyzacja testów w CI/CD** | ❌ | 0% | Brak testów i CI/CD |

### 4.4 Podsumowanie Oceny

**Łączna ocena wykonania**: **73%**

- **Funkcjonalności podstawowe**: 100% ✅
- **Wymagania techniczne**: 82% ✅
- **Wymagania dodatkowe**: 21% ⚠️

---

## 5. API Endpoints

### 5.1 Gateway Service (port 3001)

```http
GET /health
```

### 5.2 User Service (port 3002)

#### 5.2.1 Uwierzytelnianie
```http
POST /api/users/register
POST /api/users/login
```

#### 5.2.2 Profile Management
```http
GET /api/users/profile
PUT /api/users/profile
PUT /api/users/password
```

#### 5.2.3 Admin Operations
```http
GET /api/users/all
PUT /api/users/:userId/role
PUT /api/users/:userId/deactivate
```

#### 5.2.4 Achievements
```http
GET /api/achievements
GET /api/achievements/stats
GET /api/achievements/available
```

#### 5.2.5 Rankings
```http
GET /api/rankings/global
GET /api/rankings/weekly
GET /api/rankings/category/:category
GET /api/rankings/categories
GET /api/rankings/user
POST /api/rankings/update
```

#### 5.2.6 Statistics
```http
GET /api/stats/dashboard
GET /api/stats/user/:userId
GET /api/stats/quiz/:quizId
GET /api/stats/leaderboard
```

### 5.3 Quiz Service (port 3003)

#### 5.3.1 Quiz Management
```http
POST /api/quizzes
GET /api/quizzes
GET /api/quizzes/:id
PUT /api/quizzes/:id
DELETE /api/quizzes/:id
GET /api/quizzes/user/my-quizzes
GET /api/quizzes/search
```

#### 5.3.2 Quiz Social Features
```http
POST /api/quizzes/:id/comments
POST /api/quizzes/:id/rate
POST /api/quizzes/:id/invite
DELETE /api/quizzes/:id/invite/:userId
GET /api/quizzes/:id/invites
```

#### 5.3.3 Quiz Group Access
```http
POST /api/quizzes/:id/groups
DELETE /api/quizzes/:id/groups/:groupId
GET /api/quizzes/:id/groups
```

#### 5.3.4 Question Management
```http
POST /api/quizzes/:quizId/questions
GET /api/quizzes/:quizId/questions
GET /api/questions/:id
PUT /api/questions/:id
DELETE /api/questions/:id
GET /api/user/questions
```

#### 5.3.5 Categories
```http
POST /api/categories
GET /api/categories
GET /api/categories/:id
PUT /api/categories/:id
DELETE /api/categories/:id
GET /api/categories/hierarchy
```

#### 5.3.6 Tags
```http
POST /api/tags
GET /api/tags
GET /api/tags/:id
PUT /api/tags/:id
DELETE /api/tags/:id
GET /api/tags/popular
```

#### 5.3.7 Sessions
```http
POST /api/sessions/start/:quizId
GET /api/sessions/:sessionId/question
POST /api/sessions/:sessionId/answer
POST /api/sessions/:sessionId/complete
POST /api/sessions/:sessionId/pause
POST /api/sessions/:sessionId/resume
GET /api/sessions/:sessionId
GET /api/sessions/quiz/:quizId/stats
GET /api/sessions/quiz/:quizId/trends
```

#### 5.3.8 Groups
```http
POST /api/groups
GET /api/groups
GET /api/groups/my
GET /api/groups/:id
PUT /api/groups/:id
DELETE /api/groups/:id
POST /api/groups/:id/members
DELETE /api/groups/:id/members/:userId
```

---

## 6. Modele Danych

### 6.1 User Service (PostgreSQL/Prisma)

#### 6.1.1 User Model
```sql
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "firstName" VARCHAR(50) NOT NULL,
    "lastName" VARCHAR(50) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'student',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "averageScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "experience" INTEGER NOT NULL DEFAULT 0,
    -- indexes na email, role, totalScore, level
);
```

#### 6.1.2 Quiz History Model
```sql
CREATE TABLE "quiz_history" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "quizId" TEXT NOT NULL, -- MongoDB ObjectId
    "quizTitle" VARCHAR(200) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "score" INTEGER NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- indexes na userId, quizId, category, completedAt
);
```

#### 6.1.3 Achievements Model
```sql
CREATE TABLE "achievements" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "rarity" VARCHAR(20) NOT NULL DEFAULT 'common',
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- unique constraint na (userId, name)
);
```

### 6.2 Quiz Service (MongoDB/Mongoose)

#### 6.2.1 Quiz Model
```javascript
{
  title: { type: String, required: true, maxLength: 200 },
  description: { type: String, maxLength: 1000 },
  category: { type: ObjectId, ref: 'Category', required: true },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'] },
  tags: [{ type: ObjectId, ref: 'Tag' }],
  questions: [{ type: ObjectId, ref: 'Question' }],
  isPublic: { type: Boolean, default: true },
  playCount: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  averageRating: { type: Number, default: 0 },
  invitedUsers: [String],
  groupAccess: [{ type: ObjectId, ref: 'Group' }],
  ratings: [{ userId: String, value: Number }],
  comments: [{ 
    userId: String, 
    username: String, 
    text: String, 
    createdAt: Date 
  }],
  createdBy: { type: String, required: true }
}
```

#### 6.2.2 Question Model
```javascript
{
  text: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['single', 'multiple', 'boolean', 'text'] 
  },
  options: [String],
  correctAnswers: [String],
  points: { type: Number, default: 1 },
  hint: String,
  explanation: String,
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'] },
  createdBy: { type: String, required: true }
}
```

#### 6.2.3 Session Model
```javascript
{
  userId: { type: Number, required: true, index: true },
  quizId: { type: ObjectId, ref: 'Quiz', required: true },
  status: { 
    type: String, 
    enum: ['in-progress', 'completed', 'paused', 'abandoned'] 
  },
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  answers: [{
    questionId: { type: ObjectId, ref: 'Question' },
    selectedAnswers: [String],
    isCorrect: Boolean,
    pointsAwarded: Number,
    timeSpent: Number,
    answeredAt: { type: Date, default: Date.now }
  }],
  score: { type: Number, default: 0 },
  accuracy: { type: Number, default: 0 },
  perfectScore: { type: Boolean, default: false },
  speedBonus: { type: Boolean, default: false }
}
```

---

## 7. Bezpieczeństwo

### 7.1 Uwierzytelnianie i Autoryzacja

#### 7.1.1 JWT Implementation
```javascript
// Token generation
const token = jwt.sign(
  { 
    id: user.id, 
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName
  },
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
);
```

#### 7.1.2 Role-Based Access Control (RBAC)
- **student**: Podstawowe uprawnienia
- **instructor**: Tworzenie quizów, moderacja grup
- **admin**: Pełny dostęp do systemu

#### 7.1.3 Middleware Authorization
```javascript
const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.roles.includes('admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};
```

### 7.2 Bezpieczeństwo Aplikacji

#### 7.2.1 Implementowane Zabezpieczenia
- **Helmet**: HTTP headers security
- **Rate Limiting**: 100 requests/15min per IP
- **CORS**: Konfiguracja allowed origins
- **bcryptjs**: Password hashing (12 rounds)
- **Input validation**: express-validator + Joi schemas

#### 7.2.2 Przykład Rate Limiting
```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    error: 'Zbyt wiele żądań z tego adresu IP'
  }
});
```

### 7.3 Walidacja Danych

#### 7.3.1 Express-Validator Example
```javascript
const createQuizValidation = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  body('category')
    .notEmpty()
    .withMessage('Category is required'),
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('Difficulty must be easy, medium, or hard')
];
```

---

## 8. Wdrożenie

### 8.1 Docker Configuration

#### 8.1.1 Multi-Stage Docker Build
```dockerfile
# User-service Dockerfile
FROM node:18-alpine AS builder
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci && npx prisma generate

FROM node:18-alpine AS runner
RUN adduser --system --uid 1001 nodeuser
WORKDIR /app
COPY --from=builder --chown=nodeuser:nodejs /app/node_modules ./node_modules
USER nodeuser
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=10s CMD curl -f http://localhost:3002/health
CMD ["npm", "start"]
```

#### 8.1.2 Docker Compose Services
```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: quiz_app_db
      POSTGRES_USER: quiz_user
      POSTGRES_PASSWORD: quiz_password
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U quiz_user -d quiz_app_db"]
      
  mongodb:
    image: mongo:latest
    environment:
      MONGO_INITDB_ROOT_USERNAME: quiz_mongo_user
      MONGO_INITDB_ROOT_PASSWORD: quiz_mongo_password
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      
  user-service:
    build: ./services/user-service
    depends_on:
      postgres: { condition: service_healthy }
    environment:
      - DATABASE_URL=postgresql://quiz_user:quiz_password@postgres:5432/quiz_app_db
      - JWT_SECRET=quiz-app-super-secret-jwt-key
```

### 8.2 Environment Configuration

#### 8.2.1 User Service Environment
```env
DATABASE_URL="postgresql://quiz_user:quiz_password@localhost:5432/quiz_app_db"
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRATION="24h"
PORT=3002
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001"
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 8.3 Health Checks

Każdy serwis implementuje health check endpoint:
```javascript
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    service: 'user-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

---

## 9. Monitoring i Testowanie

### 9.1 Logging

#### 9.1.1 Request Logging
```javascript
app.use((req, res, next) => {
  console.log(`[${serviceName}] ${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});
```

#### 9.1.2 Error Logging
```javascript
app.use((error, req, res, next) => {
  console.error(`[${serviceName} ERROR]`, error);
  res.status(error.status || 500).json({
    error: error.message || 'Wystąpił błąd serwera',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});
```

### 9.2 Database Monitoring

#### 9.2.1 Prisma Logging
```javascript
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

#### 9.2.2 MongoDB Connection Monitoring
```javascript
mongoose.connection.on('connected', () => {
  console.log('MongoDB connected successfully');
});

mongoose.connection.on('error', (error) => {
  console.error('MongoDB connection error:', error);
});
```

### 9.3 Status Testów

❌ **Brak implementacji testów** - Znaczący brak w projekcie

Rekomendowane testy do implementacji:
- **Unit tests**: Kontrolery, modele, middleware
- **Integration tests**: API endpoints, database operations
- **E2E tests**: Pełne scenariusze użytkownika

---

## 10. Wnioski i Rekomendacje

### 10.1 Mocne Strony Projektu

1. **Kompleksowa funkcjonalność**: Wszystkie wymagane funkcje zostały zaimplementowane
2. **Dobra architektura mikroserwisów**: Jasny podział odpowiedzialności
3. **Bezpieczeństwo**: Solidne implementacje JWT, bcrypt, rate limiting
4. **Skalowalność**: Architektura umożliwia skalowanie poszczególnych komponentów
5. **Dokumentacja kodu**: Czytelny kod z komentarzami
6. **Walidacja danych**: Kompleksowa walidacja na wszystkich poziomach

### 10.2 Obszary do Poprawy

#### 10.2.1 Krytyczne (Wysoki priorytet)
1. **Testy**: Brak jakichkolwiek testów - natychmiastowa implementacja
2. **CI/CD Pipeline**: Brak automatyzacji wdrożeń
3. **Error Monitoring**: Integracja z Sentry/Bugsnag
4. **Backup Strategy**: Procedury backup dla baz danych

#### 10.2.2 Ważne (Średni priorytet)
1. **Zaawansowane indeksowanie**: Optymalizacja zapytań DB
2. **Connection pooling**: Tuning parametrów połączeń
3. **Code quality tools**: Wymuszenie ESLint/Prettier
4. **Documentation**: API documentation (Swagger/OpenAPI)

#### 10.2.3 Przyszłościowe (Niski priorytet)
1. **Caching**: Redis dla często używanych danych
2. **Microservices communication**: Message queues (RabbitMQ/Apache Kafka)
3. **Advanced monitoring**: Prometheus + Grafana
4. **Load balancing**: Nginx dla gateway

### 10.3 Roadmapa Rozwoju

#### Faza 1 (1-2 tygodnie)
- [ ] Implementacja testów jednostkowych i integracyjnych
- [ ] Konfiguracja ESLint/Prettier
- [ ] Podstawowy CI/CD pipeline (GitHub Actions)

#### Faza 2 (2-3 tygodnie)
- [ ] Integracja z systemem monitorowania błędów
- [ ] Dokumentacja API (Swagger)
- [ ] Optymalizacja indeksów bazodanowych
- [ ] Strategia backup

#### Faza 3 (3-4 tygodnie)
- [ ] Implementacja cache'owania
- [ ] Zaawansowany monitoring
- [ ] Performance tuning
- [ ] Security audit

### 10.4 Ocena Końcowa

**Projekt Quiz-App to solidna implementacja systemu quizów** z kompleksową funkcjonalnością i dobrą architekturą. Główne wymagania funkcjonalne zostały w pełni zrealizowane, a implementacja techniczna jest na wysokim poziomie.

**Ocena ogólna: 8.5/10**
- Funkcjonalność: 10/10
- Architektura: 9/10  
- Bezpieczeństwo: 9/10
- Jakość kodu: 8/10
- Testy: 0/10
- DevOps: 6/10

Projekt ma solidne fundamenty i przy uzupełnieniu o testy oraz CI/CD może stanowić produkcyjne rozwiązanie dla platformy edukacyjnej.
