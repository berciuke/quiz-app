const request = require('supertest');
const app = require('../../src/index');
const { checkAndAwardAchievements, achievementDefinitions } = require('../../src/controllers/achievements.controller');

describe('Achievements Integration and Unit Tests', () => {
  let testUser, userToken;

  beforeEach(async () => {
    testUser = await global.testHelpers.createTestUser({
      firstName: 'Achiever',
      lastName: 'User'
    });
    userToken = global.testHelpers.generateTestToken(testUser);
  });

  describe('API Endpoints', () => {
    describe('GET /api/achievements', () => {
      it('should get user achievements', async () => {
        // Przyznaj osiągnięcie
        await global.prisma.achievement.create({
          data: {
            userId: testUser.id,
            type: 'test',
            name: 'Test Achievement',
            description: 'This is a test achievement',
            pointsAwarded: 10
          }
        });

        const response = await request(app)
          .get('/api/achievements')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].name).toBe('Test Achievement');
      });

      it('should return empty array when user has no achievements', async () => {
        const response = await request(app)
          .get('/api/achievements')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(0);
      });

      it('should require authentication', async () => {
        await request(app)
          .get('/api/achievements')
          .expect(401);
      });
    });

    describe('GET /api/achievements/stats', () => {
      it('should get achievement statistics', async () => {
        await global.prisma.achievement.create({
          data: {
            userId: testUser.id,
            type: 'milestone',
            name: 'Test Achievement',
            description: 'This is a test achievement',
            rarity: 'rare',
            pointsAwarded: 50
          }
        });

        const response = await request(app)
          .get('/api/achievements/stats')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          total: 1,
          available: Object.keys(achievementDefinitions).length,
          completion: expect.any(Number),
          pointsEarned: 50,
          byRarity: {
            rare: 1
          }
        });
      });

      it('should return zero stats for user with no achievements', async () => {
        const response = await request(app)
          .get('/api/achievements/stats')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          total: 0,
          available: Object.keys(achievementDefinitions).length,
          completion: 0,
          pointsEarned: 0,
          byRarity: {}
        });
      });
    });

    describe('GET /api/achievements/available', () => {
      it('should get all available achievements and mark unlocked ones', async () => {
        const achievementDef = achievementDefinitions['first_quiz'];
        await global.prisma.achievement.create({
          data: {
            userId: testUser.id,
            type: achievementDef.type,
            name: achievementDef.name,
            description: achievementDef.description,
            pointsAwarded: achievementDef.pointsAwarded
          }
        });

        const response = await request(app)
          .get('/api/achievements/available')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        const achievements = response.body.data;
        expect(achievements.length).toBe(Object.keys(achievementDefinitions).length);

        const unlockedAchievement = achievements.find(a => a.name === achievementDef.name);
        expect(unlockedAchievement).toBeDefined();
        expect(unlockedAchievement.unlocked).toBe(true);

        const lockedAchievement = achievements.find(a => a.name === achievementDefinitions['quiz_master_10'].name);
        expect(lockedAchievement).toBeDefined();
        expect(lockedAchievement.unlocked).toBe(false);
      });
    });
  });

  describe('Achievement Logic (Unit Tests)', () => {
    it('should award "first_quiz" achievement after first quiz', async () => {
      await global.testHelpers.createTestQuizHistory(testUser.id);
      
      const newAchievements = await checkAndAwardAchievements(testUser.id);
      
      expect(newAchievements).toHaveLength(1);
      expect(newAchievements[0].name).toBe(achievementDefinitions.first_quiz.name);

      const user = await global.prisma.user.findUnique({ where: { id: testUser.id } });
      expect(user.experience).toBe(achievementDefinitions.first_quiz.pointsAwarded);
    });

    it('should award "quiz_master_10" achievement after 10 quizzes', async () => {
      // Stwórz 10 quizów z unikalnymi ID
      for (let i = 0; i < 10; i++) {
        await global.testHelpers.createTestQuizHistory(testUser.id);
      }

      const newAchievements = await checkAndAwardAchievements(testUser.id);
      
      const achievement = newAchievements.find(a => a.name === achievementDefinitions.quiz_master_10.name);
      expect(achievement).toBeDefined();
    });

    it('should not award achievement if already present', async () => {
      // Stwórz quiz history
      await global.testHelpers.createTestQuizHistory(testUser.id);
      
      // Przyznaj ręcznie osiągnięcie
      const achievementDef = achievementDefinitions['first_quiz'];
      await global.prisma.achievement.create({
        data: {
          userId: testUser.id,
          type: achievementDef.type,
          name: achievementDef.name,
          description: achievementDef.description,
          pointsAwarded: achievementDef.pointsAwarded
        }
      });

      const newAchievements = await checkAndAwardAchievements(testUser.id);
      const firstQuizAchievement = newAchievements.find(a => a.name === achievementDef.name);
      expect(firstQuizAchievement).toBeUndefined();
    });

    it('should award "perfectionist" for a perfect score', async () => {
      const sessionData = {
        accuracy: 100,
      };

      await global.testHelpers.createTestQuizHistory(testUser.id, { accuracy: 100 });

      const newAchievements = await checkAndAwardAchievements(testUser.id, sessionData);

      const achievement = newAchievements.find(a => a.name === achievementDefinitions.perfectionist.name);
      expect(achievement).toBeDefined();
    });

    it('should award "score_legend_5000" when score is high enough', async () => {
      // Zaktualizuj punkty użytkownika
      await global.prisma.user.update({
        where: { id: testUser.id },
        data: { totalScore: 5000 }
      });

      await global.testHelpers.createTestQuizHistory(testUser.id);
      
      const newAchievements = await checkAndAwardAchievements(testUser.id);
      
      const achievement = newAchievements.find(a => a.name === achievementDefinitions.score_legend_5000.name);
      expect(achievement).toBeDefined();
    });
    
    it('should award "category_explorer" after quizzes in 5 different categories', async () => {
      const categories = ['Historia', 'Matematyka', 'Geografia', 'Biologia', 'Chemia'];
      for (const category of categories) {
        await global.testHelpers.createTestQuizHistory(testUser.id, { category });
      }

      const newAchievements = await checkAndAwardAchievements(testUser.id);
      const achievement = newAchievements.find(a => a.name === achievementDefinitions.category_explorer.name);
      expect(achievement).toBeDefined();
    });

    it('should award "accuracy_master" after 10 quizzes with 100% accuracy', async () => {
      for (let i = 0; i < 10; i++) {
        await global.testHelpers.createTestQuizHistory(testUser.id, { accuracy: 100 });
      }

      const newAchievements = await checkAndAwardAchievements(testUser.id, { accuracy: 100 });
      const achievement = newAchievements.find(a => a.name === achievementDefinitions.accuracy_master.name);
      expect(achievement).toBeDefined();
    });
    
    it('should award multiple achievements at once', async () => {
      // Ten quiz będzie pierwszym i jednocześnie perfekcyjnym
      const sessionData = { accuracy: 100 };
      await global.testHelpers.createTestQuizHistory(testUser.id, { accuracy: 100 });

      const newAchievements = await checkAndAwardAchievements(testUser.id, sessionData);
      
      expect(newAchievements.length).toBeGreaterThanOrEqual(2);
      expect(newAchievements.some(a => a.name === achievementDefinitions.first_quiz.name)).toBe(true);
      expect(newAchievements.some(a => a.name === achievementDefinitions.perfectionist.name)).toBe(true);
    });

    it('should handle edge cases gracefully', async () => {
      // Test z nieistniejącym użytkownikiem
      await expect(checkAndAwardAchievements(99999)).rejects.toThrow('Użytkownik nie znaleziony');
    });

    it('should award "speed_demon" for fast quiz completion', async () => {
      const sessionData = {
        accuracy: 80,
        totalQuestions: 10,
        timeSpent: 60 // Bardzo szybko (60 sekund dla 10 pytań)
      };

      await global.testHelpers.createTestQuizHistory(testUser.id, {
        totalQuestions: 10,
        timeSpent: 60
      });

      const newAchievements = await checkAndAwardAchievements(testUser.id, sessionData);
      const achievement = newAchievements.find(a => a.name === achievementDefinitions.speed_demon.name);
      expect(achievement).toBeDefined();
    });
  });
}); 