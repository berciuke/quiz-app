const request = require('supertest');
const app = require('../../src/index');
const { 
  updateGlobalRanking, 
  updateWeeklyRanking,
  updateCategoryRanking,
  getWeekStart
} = require('../../src/controllers/rankings.controller');

describe('Rankings Integration and Unit Tests', () => {
  let user1, user2, user3, token1, token2, adminUser, adminToken;

  beforeEach(async () => {
    // Użytkownicy z różnymi wynikami używając nowej helper function
    [user1, user2, user3] = await global.testHelpers.createMultipleUsers(3);
    
    // Zaktualizuj użytkowników z różnymi wynikami
    user1 = await global.prisma.user.update({
      where: { id: user1.id },
      data: {
        firstName: 'Adam',
        lastName: 'Nowak',
        totalScore: 1000,
        totalQuizzesPlayed: 10,
        averageScore: 100
      }
    });
    
    user2 = await global.prisma.user.update({
      where: { id: user2.id },
      data: {
        firstName: 'Beata',
        lastName: 'Kowalska',
        totalScore: 2000,
        totalQuizzesPlayed: 20,
        averageScore: 100
      }
    });
    
    user3 = await global.prisma.user.update({
      where: { id: user3.id },
      data: {
        firstName: 'Czesław',
        lastName: 'Wiśniewski',
        totalScore: 500,
        totalQuizzesPlayed: 5,
        averageScore: 100
      }
    });
    
    adminUser = await global.testHelpers.createTestUser({
      role: 'admin',
      firstName: 'Admin',
      lastName: 'User'
    });

    token1 = global.testHelpers.generateTestToken(user1);
    token2 = global.testHelpers.generateTestToken(user2);
    adminToken = global.testHelpers.generateTestToken(adminUser);
    
    // Stwórz historię quizów
    await global.testHelpers.createTestQuizHistory(user1.id, { 
      category: 'Historia', 
      score: 100 
    });
    await global.testHelpers.createTestQuizHistory(user2.id, { 
      category: 'Historia', 
      score: 200 
    });
    await global.testHelpers.createTestQuizHistory(user2.id, { 
      category: 'Geografia', 
      score: 150 
    });
  });

  describe('Ranking Logic (Unit Tests)', () => {
    it('should update global ranking correctly', async () => {
      const count = await updateGlobalRanking();
      expect(count).toBe(3);

      const ranking = await global.prisma.globalRanking.findMany({
        orderBy: { rank: 'asc' }
      });

      expect(ranking).toHaveLength(3);
      expect(ranking[0].userId).toBe(user2.id); // Najwięcej punktów
      expect(ranking[0].rank).toBe(1);
      expect(ranking[1].userId).toBe(user1.id);
      expect(ranking[1].rank).toBe(2);
      expect(ranking[2].userId).toBe(user3.id);
      expect(ranking[2].rank).toBe(3);
    });

    it('should update weekly ranking correctly', async () => {
      const count = await updateWeeklyRanking();
      expect(count).toBe(2); // Tylko user1 i user2 grali
      
      const weekStart = getWeekStart();
      const ranking = await global.prisma.weeklyRanking.findMany({
        where: { weekStartDate: weekStart },
        orderBy: { rank: 'asc' }
      });

      expect(ranking).toHaveLength(2);
      expect(ranking[0].userId).toBe(user2.id);
      expect(ranking[0].rank).toBe(1);
      expect(ranking[0].totalScore).toBe(350);
      expect(ranking[1].userId).toBe(user1.id);
      expect(ranking[1].rank).toBe(2);
      expect(ranking[1].totalScore).toBe(100);
    });
    
    it('should update category ranking correctly', async () => {
      await global.prisma.topicStats.create({ 
        data: { 
          userId: user1.id, 
          category: 'Historia', 
          level: 2,
          averageScore: 100,
          totalQuizzes: 1
        } 
      });
      await global.prisma.topicStats.create({ 
        data: { 
          userId: user2.id, 
          category: 'Historia', 
          level: 3,
          averageScore: 200,
          totalQuizzes: 1
        } 
      });
      
      const count = await updateCategoryRanking('Historia');
      expect(count).toBe(2);
      
      const ranking = await global.prisma.categoryRanking.findMany({
        where: { category: 'Historia' },
        orderBy: { rank: 'asc' }
      });
      
      expect(ranking).toHaveLength(2);
      expect(ranking[0].userId).toBe(user2.id);
      expect(ranking[0].rank).toBe(1);
      expect(ranking[1].userId).toBe(user1.id);
      expect(ranking[1].rank).toBe(2);
    });
  });

  describe('API Endpoints', () => {
    beforeEach(async () => {
      // Wypełnij rankingi przed testami API
      await updateGlobalRanking();
      await updateWeeklyRanking();
      await updateCategoryRanking('Historia');
      await updateCategoryRanking('Geografia');
    });

    describe('GET /api/rankings/global', () => {
      it('should get global ranking', async () => {
        const response = await request(app)
          .get('/api/rankings/global')
          .set('Authorization', `Bearer ${token1}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.ranking).toHaveLength(3);
        expect(response.body.data.ranking[0].rank).toBe(1);
        expect(response.body.data.userRank).toBe(2); // user1 jest drugi
      });

      it('should support pagination', async () => {
        const response = await request(app)
          .get('/api/rankings/global?page=1&limit=2')
          .set('Authorization', `Bearer ${token1}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.ranking).toHaveLength(2);
        expect(response.body.data.pagination.currentPage).toBe(1);
        expect(response.body.data.pagination.itemsPerPage).toBe(2);
      });
    });

    describe('GET /api/rankings/weekly', () => {
      it('should get weekly ranking', async () => {
        const response = await request(app)
          .get('/api/rankings/weekly')
          .set('Authorization', `Bearer ${token2}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.ranking).toHaveLength(2);
        expect(response.body.data.userRank).toBe(1); // user2 jest pierwszy
        expect(response.body.data.weekStart).toBeDefined();
      });
    });
    
    describe('GET /api/rankings/category/:category', () => {
      it('should get category ranking', async () => {
        const response = await request(app)
          .get('/api/rankings/category/Historia')
          .set('Authorization', `Bearer ${token1}`)
          .expect(200);
          
        expect(response.body.success).toBe(true);
        expect(response.body.data.ranking).toHaveLength(2);
        expect(response.body.data.category).toBe('Historia');
        expect(response.body.data.userRank).toBe(2);
      });

      it('should require category parameter', async () => {
        // Test bez kategorii nie ma sensu, ale sprawdźmy błędną kategorię
        const response = await request(app)
          .get('/api/rankings/category/NonexistentCategory')
          .set('Authorization', `Bearer ${token1}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.ranking).toHaveLength(0);
      });
    });
    
    describe('GET /api/rankings/categories', () => {
      it('should get available categories for ranking', async () => {
        const response = await request(app)
          .get('/api/rankings/categories')
          .set('Authorization', `Bearer ${token1}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
        const historia = response.body.data.find(c => c.name === 'Historia');
        expect(historia.quizCount).toBe(2);
      });
    });

    describe('GET /api/rankings/user', () => {
      it('should get personal ranking stats for a user', async () => {
        const response = await request(app)
          .get('/api/rankings/user')
          .set('Authorization', `Bearer ${token1}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.global.rank).toBe(2);
        expect(response.body.data.weekly.rank).toBe(2);
        expect(response.body.data.categories).toHaveLength(1);
        expect(response.body.data.categories[0].category).toBe('Historia');
        expect(response.body.data.categories[0].rank).toBe(2);
        expect(response.body.data.weeklyHistory).toHaveLength(4);
      });
    });
    
    describe('POST /api/rankings/update', () => {
      it('should require admin role to force update', async () => {
        const response = await request(app)
          .post('/api/rankings/update')
          .set('Authorization', `Bearer ${token1}`)
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Brak uprawnień');
      });

      it('should allow admin to force update all rankings', async () => {
        // Wyzeruj jeden ranking, aby sprawdzić, czy się zaktualizuje
        await global.prisma.globalRanking.deleteMany({});
        
        const response = await request(app)
          .post('/api/rankings/update')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({}) // Bez type = aktualizuje wszystko
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.details.global).toContain('Zaktualizowano');
        expect(response.body.details.weekly).toContain('Zaktualizowano');
        expect(response.body.details.categories).toContain('Zaktualizowano');

        const ranking = await global.prisma.globalRanking.findMany();
        expect(ranking.length).toBeGreaterThan(0);
      });

      it('should allow admin to update specific ranking type', async () => {
        await global.prisma.globalRanking.deleteMany({});
        
        const response = await request(app)
          .post('/api/rankings/update')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ type: 'global' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.details.global).toContain('Zaktualizowano');
        expect(response.body.details.weekly).toBeUndefined();

        const ranking = await global.prisma.globalRanking.findMany();
        expect(ranking.length).toBeGreaterThan(0);
      });
    });
  });
}); 