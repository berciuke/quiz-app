const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/index');
const Group = require('../src/models/Group');
const Quiz = require('../src/models/Quiz');
const Category = require('../src/models/Category');

describe('Group Management', () => {
  let mockUser, mockUser2, mockAdmin;
  let categoryId;

  beforeAll(async () => {
    // Połączenie z bazą testową
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/quiz-app-test');
    }

    // Stwórz kategorię testową
    const category = await Category.create({
      name: 'Test Category',
      description: 'Category for testing'
    });
    categoryId = category._id;
  });

  beforeEach(async () => {
    // Wyczyść kolekcje
    await Group.deleteMany({});
    await Quiz.deleteMany({});

    // Mock users
    mockUser = {
      id: 'user1',
      username: 'testuser1',
      roles: ['user']
    };

    mockUser2 = {
      id: 'user2',
      username: 'testuser2',
      roles: ['user']
    };

    mockAdmin = {
      id: 'admin1',
      username: 'admin',
      roles: ['admin']
    };
  });

  afterAll(async () => {
    await Group.deleteMany({});
    await Quiz.deleteMany({});
    await Category.deleteMany({});
    await mongoose.connection.close();
  });

  describe('POST /api/groups', () => {
    it('should create a new group', async () => {
      const groupData = {
        name: 'Test Group',
        description: 'A group for testing',
        isPublic: true
      };

      const response = await request(app)
        .post('/api/groups')
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .send(groupData)
        .expect(201);

      expect(response.body.group.name).toBe('Test Group');
      expect(response.body.group.createdBy).toBe(mockUser.id);
      expect(response.body.group.members).toHaveLength(1);
      expect(response.body.group.members[0].role).toBe('admin');
    });

    it('should create group with initial members', async () => {
      const groupData = {
        name: 'Test Group with Members',
        description: 'A group with initial members',
        members: [mockUser2.id],
        isPublic: false
      };

      const response = await request(app)
        .post('/api/groups')
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .send(groupData)
        .expect(201);

      expect(response.body.group.members).toHaveLength(2);
      expect(response.body.group.members[0].role).toBe('admin');
      expect(response.body.group.members[1].role).toBe('member');
    });

    it('should reject invalid group data', async () => {
      const invalidData = {
        name: '', // Zbyt krótka nazwa
        description: 'A' * 600 // Zbyt długi opis
      };

      await request(app)
        .post('/api/groups')
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .send(invalidData)
        .expect(400);
    });
  });

  describe('GET /api/groups', () => {
    let publicGroup, privateGroup, userGroup;

    beforeEach(async () => {
      publicGroup = await Group.create({
        name: 'Public Group',
        description: 'A public group',
        createdBy: mockUser2.id,
        isPublic: true,
        members: [{ userId: mockUser2.id, role: 'admin' }]
      });

      privateGroup = await Group.create({
        name: 'Private Group',
        description: 'A private group',
        createdBy: mockUser2.id,
        isPublic: false,
        members: [{ userId: mockUser2.id, role: 'admin' }]
      });

      userGroup = await Group.create({
        name: 'User Group',
        description: 'Group where user is member',
        createdBy: mockUser2.id,
        isPublic: false,
        members: [
          { userId: mockUser2.id, role: 'admin' },
          { userId: mockUser.id, role: 'member' }
        ]
      });
    });

    it('should return public groups and user groups', async () => {
      const response = await request(app)
        .get('/api/groups')
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .expect(200);

      expect(response.body.groups).toHaveLength(2); // publicGroup + userGroup
      expect(response.body.total).toBe(2);
    });

    it('should support search', async () => {
      const response = await request(app)
        .get('/api/groups?search=Public')
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .expect(200);

      expect(response.body.groups).toHaveLength(1);
      expect(response.body.groups[0].name).toBe('Public Group');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/groups?page=1&limit=1')
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .expect(200);

      expect(response.body.groups).toHaveLength(1);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(1);
    });
  });

  describe('GET /api/groups/my', () => {
    beforeEach(async () => {
      await Group.create({
        name: 'My Group',
        description: 'Group created by user',
        createdBy: mockUser.id,
        isPublic: true,
        members: [{ userId: mockUser.id, role: 'admin' }]
      });

      await Group.create({
        name: 'Member Group',
        description: 'Group where user is member',
        createdBy: mockUser2.id,
        isPublic: false,
        members: [
          { userId: mockUser2.id, role: 'admin' },
          { userId: mockUser.id, role: 'member' }
        ]
      });
    });

    it('should return user groups', async () => {
      const response = await request(app)
        .get('/api/groups/my')
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .expect(200);

      expect(response.body.groups).toHaveLength(2);
    });
  });

  describe('POST /api/groups/:id/members', () => {
    let groupId;

    beforeEach(async () => {
      const group = await Group.create({
        name: 'Test Group',
        description: 'Group for member testing',
        createdBy: mockUser.id,
        isPublic: true,
        members: [{ userId: mockUser.id, role: 'admin' }]
      });
      groupId = group._id;
    });

    it('should add member to group', async () => {
      const response = await request(app)
        .post(`/api/groups/${groupId}/members`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .send({ userId: mockUser2.id })
        .expect(200);

      expect(response.body.group.members).toHaveLength(2);
      expect(response.body.group.members[1].userId).toBe(mockUser2.id);
      expect(response.body.group.members[1].role).toBe('member');
    });

    it('should deny non-admin from adding members', async () => {
      await request(app)
        .post(`/api/groups/${groupId}/members`)
        .set({
          'x-user-id': mockUser2.id,
          'x-user-username': mockUser2.username,
          'x-user-roles': mockUser2.roles.join(',')
        })
        .send({ userId: 'someuser' })
        .expect(403);
    });

    it('should reject duplicate member', async () => {
      // Dodaj użytkownika pierwszy raz
      await request(app)
        .post(`/api/groups/${groupId}/members`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .send({ userId: mockUser2.id })
        .expect(200);

      // Próbuj dodać tego samego użytkownika ponownie
      await request(app)
        .post(`/api/groups/${groupId}/members`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .send({ userId: mockUser2.id })
        .expect(400);
    });
  });

  describe('DELETE /api/groups/:id/members/:userId', () => {
    let groupId;

    beforeEach(async () => {
      const group = await Group.create({
        name: 'Test Group',
        description: 'Group for member testing',
        createdBy: mockUser.id,
        isPublic: true,
        members: [
          { userId: mockUser.id, role: 'admin' },
          { userId: mockUser2.id, role: 'member' }
        ]
      });
      groupId = group._id;
    });

    it('should remove member from group', async () => {
      const response = await request(app)
        .delete(`/api/groups/${groupId}/members/${mockUser2.id}`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .expect(200);

      expect(response.body.group.members).toHaveLength(1);
    });

    it('should allow user to remove themselves', async () => {
      const response = await request(app)
        .delete(`/api/groups/${groupId}/members/${mockUser2.id}`)
        .set({
          'x-user-id': mockUser2.id,
          'x-user-username': mockUser2.username,
          'x-user-roles': mockUser2.roles.join(',')
        })
        .expect(200);

      expect(response.body.group.members).toHaveLength(1);
    });

    it('should prevent removing last admin', async () => {
      await request(app)
        .delete(`/api/groups/${groupId}/members/${mockUser.id}`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .expect(400);
    });
  });

  describe('Quiz Group Access Integration', () => {
    let quizId, groupId;

    beforeEach(async () => {
      // Stwórz grupę
      const group = await Group.create({
        name: 'Quiz Access Group',
        description: 'Group for quiz access testing',
        createdBy: mockUser.id,
        isPublic: false,
        members: [
          { userId: mockUser.id, role: 'admin' },
          { userId: mockUser2.id, role: 'member' }
        ]
      });
      groupId = group._id;

      // Stwórz prywatny quiz
      const quiz = await Quiz.create({
        title: 'Private Quiz',
        description: 'A private quiz for group testing',
        category: categoryId,
        difficulty: 'medium',
        isPublic: false,
        createdBy: mockUser.id,
        groupAccess: [groupId]
      });
      quizId = quiz._id;
    });

    it('should allow group member to access private quiz', async () => {
      const response = await request(app)
        .get(`/api/quizzes/${quizId}`)
        .set({
          'x-user-id': mockUser2.id,
          'x-user-username': mockUser2.username,
          'x-user-roles': mockUser2.roles.join(',')
        })
        .expect(200);

      expect(response.body.title).toBe('Private Quiz');
    });

    it('should deny non-group member access to private quiz', async () => {
      await request(app)
        .get(`/api/quizzes/${quizId}`)
        .set({
          'x-user-id': 'other-user',
          'x-user-username': 'otheruser',
          'x-user-roles': 'user'
        })
        .expect(403);
    });

    it('should add group access to quiz', async () => {
      // Stwórz nową grupę
      const newGroup = await Group.create({
        name: 'New Group',
        description: 'New group for testing',
        createdBy: mockUser.id,
        isPublic: false,
        members: [{ userId: mockUser.id, role: 'admin' }]
      });

      const response = await request(app)
        .post(`/api/quizzes/${quizId}/groups`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .send({ groupId: newGroup._id })
        .expect(201);

      expect(response.body.groupAccess).toHaveLength(2);
    });

    it('should remove group access from quiz', async () => {
      const response = await request(app)
        .delete(`/api/quizzes/${quizId}/groups/${groupId}`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .expect(200);

      expect(response.body.groupAccess).toHaveLength(0);
    });

    it('should get quiz group access list', async () => {
      const response = await request(app)
        .get(`/api/quizzes/${quizId}/groups`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .expect(200);

      expect(response.body.groupAccess).toHaveLength(1);
      expect(response.body.groupAccess[0].name).toBe('Quiz Access Group');
    });
  });

  describe('Quiz Invitation System', () => {
    let quizId;

    beforeEach(async () => {
      const quiz = await Quiz.create({
        title: 'Private Quiz for Invites',
        description: 'A private quiz for invitation testing',
        category: categoryId,
        difficulty: 'medium',
        isPublic: false,
        createdBy: mockUser.id,
        invitedUsers: []
      });
      quizId = quiz._id;
    });

    it('should invite user to quiz', async () => {
      const response = await request(app)
        .post(`/api/quizzes/${quizId}/invite`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .send({ userId: mockUser2.id })
        .expect(201);

      expect(response.body.invitedUsers).toContain(mockUser2.id);
    });

    it('should allow invited user to access quiz', async () => {
      // Najpierw zaproś użytkownika
      await request(app)
        .post(`/api/quizzes/${quizId}/invite`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .send({ userId: mockUser2.id });

      // Teraz sprawdź dostęp
      const response = await request(app)
        .get(`/api/quizzes/${quizId}`)
        .set({
          'x-user-id': mockUser2.id,
          'x-user-username': mockUser2.username,
          'x-user-roles': mockUser2.roles.join(',')
        })
        .expect(200);

      expect(response.body.title).toBe('Private Quiz for Invites');
    });

    it('should remove invite', async () => {
      // Najpierw zaproś
      await request(app)
        .post(`/api/quizzes/${quizId}/invite`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .send({ userId: mockUser2.id });

      // Usuń zaproszenie
      const response = await request(app)
        .delete(`/api/quizzes/${quizId}/invite/${mockUser2.id}`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .expect(200);

      expect(response.body.invitedUsers).not.toContain(mockUser2.id);
    });

    it('should get quiz invites list', async () => {
      // Zaproś użytkownika
      await request(app)
        .post(`/api/quizzes/${quizId}/invite`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .send({ userId: mockUser2.id });

      const response = await request(app)
        .get(`/api/quizzes/${quizId}/invites`)
        .set({
          'x-user-id': mockUser.id,
          'x-user-username': mockUser.username,
          'x-user-roles': mockUser.roles.join(',')
        })
        .expect(200);

      expect(response.body.invitedUsers).toContain(mockUser2.id);
    });

    it('should deny non-owner from managing invites', async () => {
      await request(app)
        .post(`/api/quizzes/${quizId}/invite`)
        .set({
          'x-user-id': mockUser2.id,
          'x-user-username': mockUser2.username,
          'x-user-roles': mockUser2.roles.join(',')
        })
        .send({ userId: 'someuser' })
        .expect(403);
    });
  });
}); 