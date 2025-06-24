const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/index');
const Quiz = require('../src/models/Quiz');
const Question = require('../src/models/Question');

describe('Question Management API', () => {
  let testQuiz;
  let testQuestion;
  
  const mockUser = {
    id: 'test-user-123',
    username: 'testuser',
    roles: ['user']
  };
  
  const authHeaders = {
    'x-user-id': mockUser.id,
    'x-user-username': mockUser.username,
    'x-user-roles': mockUser.roles.join(',')
  };

  beforeAll(async () => {
    // Sprawdź czy połączenie już istnieje
    if (mongoose.connection.readyState === 0) {
      const mongoUri = process.env.MONGO_TEST_URI || 'mongodb://localhost:27017/quiz-app-test';
      await mongoose.connect(mongoUri);
    }
  });

  beforeEach(async () => {
    // Wyczyść kolekcje przed każdym testem
    await Quiz.deleteMany({});
    await Question.deleteMany({});

    // Utwórz testowy quiz
    testQuiz = await Quiz.create({
      title: 'Test Quiz',
      description: 'Test Description',
      category: 'general',
      difficulty: 'medium',
      isPublic: true,
      createdBy: mockUser.id
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/quizzes/:quizId/questions', () => {
    it('should create a single choice question successfully', async () => {
      const questionData = {
        text: 'What is the capital of Poland?',
        type: 'single',
        options: ['Warsaw', 'Krakow', 'Gdansk', 'Wroclaw'],
        correctAnswers: ['Warsaw'],
        points: 2,
        hint: 'It is the largest city in Poland',
        difficulty: 'easy',
        category: 'geography'
      };

      const response = await request(app)
        .post(`/api/quizzes/${testQuiz._id}/questions`)
        .set(authHeaders)
        .send(questionData)
        .expect(201);

      expect(response.body.message).toBe('Question added successfully');
      expect(response.body.question.text).toBe(questionData.text);
      expect(response.body.question.type).toBe(questionData.type);
      expect(response.body.question.options).toEqual(questionData.options);
      expect(response.body.question.correctAnswers).toEqual(questionData.correctAnswers);
      expect(response.body.question.points).toBe(questionData.points);
      expect(response.body.question.hint).toBe(questionData.hint);

      // Sprawdź czy pytanie zostało dodane do quizu
      const updatedQuiz = await Quiz.findById(testQuiz._id);
      expect(updatedQuiz.questions).toHaveLength(1);
    });

    it('should create a multiple choice question successfully', async () => {
      const questionData = {
        text: 'Which of these are programming languages?',
        type: 'multiple',
        options: ['JavaScript', 'Python', 'Apple', 'Java'],
        correctAnswers: ['JavaScript', 'Python', 'Java'],
        points: 3
      };

      const response = await request(app)
        .post(`/api/quizzes/${testQuiz._id}/questions`)
        .set(authHeaders)
        .send(questionData)
        .expect(201);

      expect(response.body.question.type).toBe('multiple');
      expect(response.body.question.correctAnswers).toHaveLength(3);
    });

    it('should create a boolean question successfully', async () => {
      const questionData = {
        text: 'The Earth is round.',
        type: 'boolean',
        correctAnswers: ['Prawda'],
        points: 1
      };

      const response = await request(app)
        .post(`/api/quizzes/${testQuiz._id}/questions`)
        .set(authHeaders)
        .send(questionData)
        .expect(201);

      expect(response.body.question.type).toBe('boolean');
      expect(response.body.question.options).toEqual(['Prawda', 'Fałsz']);
      expect(response.body.question.correctAnswers).toEqual(['Prawda']);
    });

    it('should create a text question successfully', async () => {
      const questionData = {
        text: 'What is the result of 2 + 2?',
        type: 'text',
        correctAnswers: ['4', 'four'],
        points: 1
      };

      const response = await request(app)
        .post(`/api/quizzes/${testQuiz._id}/questions`)
        .set(authHeaders)
        .send(questionData)
        .expect(201);

      expect(response.body.question.type).toBe('text');
      expect(response.body.question.correctAnswers).toEqual(['4', 'four']);
    });

    it('should return 404 for non-existent quiz', async () => {
      const fakeQuizId = new mongoose.Types.ObjectId();
      const questionData = {
        text: 'Test question',
        type: 'single',
        options: ['A', 'B'],
        correctAnswers: ['A']
      };

      await request(app)
        .post(`/api/quizzes/${fakeQuizId}/questions`)
        .set(authHeaders)
        .send(questionData)
        .expect(404);
    });

    it('should return 403 when user tries to add question to someone else\'s quiz', async () => {
      // Utwórz quiz innego użytkownika
      const otherUserQuiz = await Quiz.create({
        title: 'Other User Quiz',
        category: 'general',
        createdBy: 'other-user-456'
      });

      const questionData = {
        text: 'Test question',
        type: 'single',
        options: ['A', 'B'],
        correctAnswers: ['A']
      };

      const response = await request(app)
        .post(`/api/quizzes/${otherUserQuiz._id}/questions`)
        .set(authHeaders)
        .send(questionData)
        .expect(403);

      expect(response.body.error).toBe('Access denied');
    });

    it('should require options for single and multiple choice questions', async () => {
      const questionData = {
        text: 'Test question',
        type: 'single',
        options: ['A'], // Only one option
        correctAnswers: ['A']
      };

      const response = await request(app)
        .post(`/api/quizzes/${testQuiz._id}/questions`)
        .set(authHeaders)
        .send(questionData)
        .expect(400);

      expect(response.body.error).toContain('at least 2 options');
    });
  });

  describe('GET /api/quizzes/:quizId/questions', () => {
    beforeEach(async () => {
      // Dodaj kilka pytań testowych
      const questions = await Question.create([
        {
          text: 'Question 1',
          type: 'single',
          options: ['A', 'B'],
          correctAnswers: ['A'],
          createdBy: mockUser.id
        },
        {
          text: 'Question 2',
          type: 'multiple',
          options: ['A', 'B', 'C'],
          correctAnswers: ['A', 'B'],
          createdBy: mockUser.id
        }
      ]);

      // Dodaj pytania do quizu
      testQuiz.questions = questions.map(q => q._id);
      await testQuiz.save();
    });

    it('should return all questions for a quiz', async () => {
      const response = await request(app)
        .get(`/api/quizzes/${testQuiz._id}/questions`)
        .set(authHeaders)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].text).toBe('Question 1');
      expect(response.body[1].text).toBe('Question 2');
    });
  });

  describe('GET /api/questions/:id', () => {
    beforeEach(async () => {
      testQuestion = await Question.create({
        text: 'Test Question',
        type: 'single',
        options: ['A', 'B'],
        correctAnswers: ['A'],
        createdBy: mockUser.id
      });
    });

    it('should return a specific question', async () => {
      const response = await request(app)
        .get(`/api/questions/${testQuestion._id}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.text).toBe('Test Question');
      expect(response.body.type).toBe('single');
    });

    it('should return 404 for non-existent question', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .get(`/api/questions/${fakeId}`)
        .set(authHeaders)
        .expect(404);
    });
  });

  describe('PUT /api/questions/:id', () => {
    beforeEach(async () => {
      testQuestion = await Question.create({
        text: 'Original Question',
        type: 'single',
        options: ['A', 'B'],
        correctAnswers: ['A'],
        createdBy: mockUser.id
      });
    });

    it('should update question successfully', async () => {
      const updateData = {
        text: 'Updated Question',
        points: 5,
        hint: 'New hint'
      };

      const response = await request(app)
        .put(`/api/questions/${testQuestion._id}`)
        .set(authHeaders)
        .send(updateData)
        .expect(200);

      expect(response.body.message).toBe('Question updated successfully');
      expect(response.body.question.text).toBe('Updated Question');
      expect(response.body.question.points).toBe(5);
      expect(response.body.question.hint).toBe('New hint');
    });

    it('should return 403 when user tries to update someone else\'s question', async () => {
      // Utwórz pytanie innego użytkownika
      const otherUserQuestion = await Question.create({
        text: 'Other User Question',
        type: 'single',
        options: ['A', 'B'],
        correctAnswers: ['A'],
        createdBy: 'other-user-456'
      });

      const updateData = { text: 'Hacked question' };

      const response = await request(app)
        .put(`/api/questions/${otherUserQuestion._id}`)
        .set(authHeaders)
        .send(updateData)
        .expect(403);

      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('DELETE /api/questions/:id', () => {
    beforeEach(async () => {
      testQuestion = await Question.create({
        text: 'Question to delete',
        type: 'single',
        options: ['A', 'B'],
        correctAnswers: ['A'],
        createdBy: mockUser.id
      });

      // Dodaj pytanie do quizu
      testQuiz.questions.push(testQuestion._id);
      await testQuiz.save();
    });

    it('should delete question successfully', async () => {
      const response = await request(app)
        .delete(`/api/questions/${testQuestion._id}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.message).toBe('Question deleted successfully');

      // Sprawdź czy pytanie zostało usunięte
      const deletedQuestion = await Question.findById(testQuestion._id);
      expect(deletedQuestion).toBeNull();

      // Sprawdź czy pytanie zostało usunięte z quizu
      const updatedQuiz = await Quiz.findById(testQuiz._id);
      expect(updatedQuiz.questions).not.toContain(testQuestion._id);
    });

    it('should return 403 when user tries to delete someone else\'s question', async () => {
      const otherUserQuestion = await Question.create({
        text: 'Other User Question',
        type: 'single',
        options: ['A', 'B'],
        correctAnswers: ['A'],
        createdBy: 'other-user-456'
      });

      const response = await request(app)
        .delete(`/api/questions/${otherUserQuestion._id}`)
        .set(authHeaders)
        .expect(403);

      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('GET /api/user/questions', () => {
    beforeEach(async () => {
      // Utwórz pytania dla różnych użytkowników
      await Question.create([
        {
          text: 'User Question 1',
          type: 'single',
          options: ['A', 'B'],
          correctAnswers: ['A'],
          category: 'science',
          difficulty: 'easy',
          createdBy: mockUser.id
        },
        {
          text: 'User Question 2',
          type: 'multiple',
          options: ['A', 'B', 'C'],
          correctAnswers: ['A', 'B'],
          category: 'history',
          difficulty: 'hard',
          createdBy: mockUser.id
        },
        {
          text: 'Other User Question',
          type: 'boolean',
          correctAnswers: ['Prawda'],
          createdBy: 'other-user-456'
        }
      ]);
    });

    it('should return user\'s questions with pagination', async () => {
      const response = await request(app)
        .get('/api/user/questions?page=1&limit=10')
        .set(authHeaders)
        .expect(200);

      expect(response.body.questions).toHaveLength(2);
      expect(response.body.total).toBe(2);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);

      // Sprawdź czy tylko pytania użytkownika są zwracane
      response.body.questions.forEach(question => {
        expect(question.createdBy).toBe(mockUser.id);
      });
    });

    it('should filter questions by type', async () => {
      const response = await request(app)
        .get('/api/user/questions?type=single')
        .set(authHeaders)
        .expect(200);

      expect(response.body.questions).toHaveLength(1);
      expect(response.body.questions[0].type).toBe('single');
    });

    it('should filter questions by category', async () => {
      const response = await request(app)
        .get('/api/user/questions?category=science')
        .set(authHeaders)
        .expect(200);

      expect(response.body.questions).toHaveLength(1);
      expect(response.body.questions[0].category).toBe('science');
    });

    it('should filter questions by difficulty', async () => {
      const response = await request(app)
        .get('/api/user/questions?difficulty=easy')
        .set(authHeaders)
        .expect(200);

      expect(response.body.questions).toHaveLength(1);
      expect(response.body.questions[0].difficulty).toBe('easy');
    });
  });

  describe('Question Types Validation', () => {
    it('should handle boolean questions with correct options', async () => {
      const questionData = {
        text: 'JavaScript is a programming language.',
        type: 'boolean',
        correctAnswers: ['Prawda']
      };

      const response = await request(app)
        .post(`/api/quizzes/${testQuiz._id}/questions`)
        .set(authHeaders)
        .send(questionData)
        .expect(201);

      expect(response.body.question.options).toEqual(['Prawda', 'Fałsz']);
    });

    it('should reject boolean questions with invalid correct answer', async () => {
      const questionData = {
        text: 'Test boolean question',
        type: 'boolean',
        correctAnswers: ['Maybe'] // Invalid for boolean
      };

      const response = await request(app)
        .post(`/api/quizzes/${testQuiz._id}/questions`)
        .set(authHeaders)
        .send(questionData)
        .expect(400);

      expect(response.body.error).toContain('Prawda');
    });
  });
}); 