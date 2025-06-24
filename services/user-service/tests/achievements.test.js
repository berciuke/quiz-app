const request = require('supertest');
const app = require('../src/index');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// Mock JWT token dla testów
const generateTestToken = (userId, role = 'student') => {
  return jwt.sign(
    { id: userId, role: role },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

describe('Achievements Controller', () => {
  let testUser;
  let userToken;

  beforeAll(async () => {
    // Utwórz testowego użytkownika
    testUser = await prisma.user.create({
      data: {
        email: 'test-achievements@example.com',
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
        role: 'student',
        totalScore: 1000,
        totalQuizzesPlayed: 15,
        averageScore: 85.5,
        experience: 150
      }
    });

    userToken = generateTestToken(testUser.id);
  });

  afterAll(async () => {
    // Wyczyść dane testowe
    await prisma.achievement.deleteMany({
      where: { userId: testUser.id }
    });
    await prisma.quizHistory.deleteMany({
      where: { userId: testUser.id }
    });
    await prisma.user.delete({
      where: { id: testUser.id }
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Wyczyść osiągnięcia przed każdym testem
    await prisma.achievement.deleteMany({
      where: { userId: testUser.id }
    });
  });

  describe('GET /api/achievements', () => {
    it('powinno zwrócić listę osiągnięć użytkownika', async () => {
      // Utwórz przykładowe osiągnięcie
      await prisma.achievement.create({
        data: {
          userId: testUser.id,
          type: 'milestone',
          name: 'Pierwszy quiz!',
          description: 'Ukończono pierwszy quiz w życiu',
          icon: '🎯',
          rarity: 'common',
          pointsAwarded: 10
        }
      });

      const response = await request(app)
        .get('/api/achievements')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        name: 'Pierwszy quiz!',
        description: 'Ukończono pierwszy quiz w życiu',
        icon: '🎯',
        rarity: 'common',
        pointsAwarded: 10
      });
    });

    it('powinno zwrócić pustą listę dla użytkownika bez osiągnięć', async () => {
      const response = await request(app)
        .get('/api/achievements')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });

    it('powinno zwrócić błąd 401 dla nieautoryzowanego użytkownika', async () => {
      const response = await request(app)
        .get('/api/achievements');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/achievements/stats', () => {
    it('powinno zwrócić statystyki osiągnięć użytkownika', async () => {
      // Utwórz różne osiągnięcia
      await prisma.achievement.createMany({
        data: [
          {
            userId: testUser.id,
            type: 'milestone',
            name: 'Pierwszy quiz!',
            description: 'Test',
            rarity: 'common',
            pointsAwarded: 10
          },
          {
            userId: testUser.id,
            type: 'accuracy',
            name: 'Perfekcjonista',
            description: 'Test',
            rarity: 'rare',
            pointsAwarded: 25
          },
          {
            userId: testUser.id,
            type: 'score',
            name: 'Łowca punktów',
            description: 'Test',
            rarity: 'epic',
            pointsAwarded: 50
          }
        ]
      });

      const response = await request(app)
        .get('/api/achievements/stats')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        total: 3,
        pointsEarned: 85,
        byRarity: {
          common: 1,
          rare: 1,
          epic: 1
        }
      });
      expect(response.body.data.completion).toBeGreaterThan(0);
    });
  });

  describe('GET /api/achievements/available', () => {
    it('powinno zwrócić wszystkie dostępne osiągnięcia z informacją o odblokowaniu', async () => {
      // Utwórz jedno osiągnięcie
      await prisma.achievement.create({
        data: {
          userId: testUser.id,
          type: 'milestone',
          name: 'Pierwszy quiz!',
          description: 'Test',
          rarity: 'common',
          pointsAwarded: 10
        }
      });

      const response = await request(app)
        .get('/api/achievements/available')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Sprawdź czy zawiera informację o odblokowaniu
      const firstQuizAchievement = response.body.data.find(a => a.name === 'Pierwszy quiz!');
      expect(firstQuizAchievement).toBeDefined();
      expect(firstQuizAchievement.unlocked).toBe(true);

      // Sprawdź czy nieodblokowane osiągnięcie ma unlocked: false
      const unlockedAchievement = response.body.data.find(a => a.unlocked === false);
      expect(unlockedAchievement).toBeDefined();
    });
  });

  describe('Achievement Logic Tests', () => {
    it('powinno przyznać osiągnięcie "Pierwszy quiz!" po ukończeniu pierwszego quizu', async () => {
      const { checkAndAwardAchievements } = require('../src/controllers/achievements.controller');

      // Utwórz historię quizu
      await prisma.quizHistory.create({
        data: {
          userId: testUser.id,
          quizId: 'test-quiz-id',
          quizTitle: 'Test Quiz',
          category: 'Test',
          score: 80,
          maxScore: 100,
          correctAnswers: 8,
          totalQuestions: 10,
          accuracy: 80,
          timeSpent: 300,
          difficulty: 'medium',
          pointsEarned: 80
        }
      });

      const newAchievements = await checkAndAwardAchievements(testUser.id);

      expect(newAchievements).toHaveLength(1);
      expect(newAchievements[0]).toMatchObject({
        name: 'Pierwszy quiz!',
        type: 'milestone'
      });
    });

    it('powinno przyznać osiągnięcie "Perfekcjonista" za 100% dokładność', async () => {
      const { checkAndAwardAchievements } = require('../src/controllers/achievements.controller');

      const sessionData = {
        accuracy: 100,
        score: 100,
        totalQuestions: 10,
        timeSpent: 300
      };

      const newAchievements = await checkAndAwardAchievements(testUser.id, sessionData);

      const perfectionist = newAchievements.find(a => a.name === 'Perfekcjonista');
      expect(perfectionist).toBeDefined();
      expect(perfectionist.type).toBe('accuracy');
    });

    it('powinno przyznać osiągnięcie punktowe na podstawie totalScore użytkownika', async () => {
      const { checkAndAwardAchievements } = require('../src/controllers/achievements.controller');

      // Zaktualizuj użytkownika aby miał 500+ punktów
      await prisma.user.update({
        where: { id: testUser.id },
        data: { totalScore: 500 }
      });

      const newAchievements = await checkAndAwardAchievements(testUser.id);

      const scoreHunter = newAchievements.find(a => a.name === 'Łowca punktów');
      expect(scoreHunter).toBeDefined();
      expect(scoreHunter.type).toBe('score');
    });

    it('powinno przyznać osiągnięcie "Demon prędkości" za szybkie ukończenie', async () => {
      const { checkAndAwardAchievements } = require('../src/controllers/achievements.controller');

      const sessionData = {
        accuracy: 80,
        score: 80,
        totalQuestions: 10,
        timeSpent: 150 // Bardzo szybko (10 pytań w 150 sekund = 15 sekund na pytanie)
      };

      const newAchievements = await checkAndAwardAchievements(testUser.id, sessionData);

      const speedDemon = newAchievements.find(a => a.name === 'Demon prędkości');
      expect(speedDemon).toBeDefined();
      expect(speedDemon.type).toBe('speed');
    });

    it('nie powinno przyznawać tego samego osiągnięcia dwa razy', async () => {
      const { checkAndAwardAchievements } = require('../src/controllers/achievements.controller');

      // Utwórz historię pierwszego quizu
      await prisma.quizHistory.create({
        data: {
          userId: testUser.id,
          quizId: 'test-quiz-id-1',
          quizTitle: 'Test Quiz 1',
          category: 'Test',
          score: 80,
          maxScore: 100,
          correctAnswers: 8,
          totalQuestions: 10,
          accuracy: 80,
          timeSpent: 300,
          difficulty: 'medium',
          pointsEarned: 80
        }
      });

      // Pierwsze wywołanie - powinno przyznać osiągnięcie
      const firstCall = await checkAndAwardAchievements(testUser.id);
      expect(firstCall.length).toBeGreaterThan(0);

      // Drugie wywołanie - nie powinno przyznać tego samego osiągnięcia
      const secondCall = await checkAndAwardAchievements(testUser.id);
      const duplicateFirstQuiz = secondCall.find(a => a.name === 'Pierwszy quiz!');
      expect(duplicateFirstQuiz).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('powinno obsłużyć błąd dla nieistniejącego użytkownika', async () => {
      const { checkAndAwardAchievements } = require('../src/controllers/achievements.controller');

      await expect(checkAndAwardAchievements(99999)).rejects.toThrow('Użytkownik nie znaleziony');
    });
  });
}); 