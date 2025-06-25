const request = require('supertest');
const app = require('../../src/app');
const { createQuestion, createQuestionsForQuiz } = require('../factories/question.factory');
const { createQuiz } = require('../factories/quiz.factory');
const { getAuthHeaders } = require('../helpers/auth.helper');
const { clearCollections } = require('../helpers/db.helper');

describe('Question API Integration Tests', () => {
  const authHeaders = getAuthHeaders();
  const instructorHeaders = getAuthHeaders({ role: 'instructor' });
  const adminHeaders = getAuthHeaders({ role: 'admin' });
  const otherUserHeaders = getAuthHeaders({ id: '67890', email: 'other@test.com' });
  let quiz;
  
  beforeEach(async () => {
    await clearCollections();
    quiz = await createQuiz();
  });

  describe('POST /api/quizzes/:quizId/questions', () => {
    it('should add a single choice question to quiz', async () => {
      const questionData = {
        text: 'What is the capital of Poland?',
        type: 'single',
        options: ['Warsaw', 'Krakow', 'Gdansk', 'Poznan'],
        correctAnswers: ['Warsaw'],
        points: 2
      };

      const response = await request(app)
        .post(`/api/quizzes/${quiz._id}/questions`)
        .set(authHeaders)
        .send(questionData)
        .expect(201);

      expect(response.body.message).toBe('Question added successfully');
      expect(response.body.question.text).toBe(questionData.text);
      expect(response.body.question.type).toBe('single');
      expect(response.body.question.createdBy).toBe('12345');
    });

    it('should add a multiple choice question to quiz', async () => {
      const questionData = {
        text: 'Which of the following are programming languages?',
        type: 'multiple',
        options: ['JavaScript', 'HTML', 'Python', 'CSS'],
        correctAnswers: ['JavaScript', 'Python'],
        points: 3
      };

      const response = await request(app)
        .post(`/api/quizzes/${quiz._id}/questions`)
        .set(authHeaders)
        .send(questionData)
        .expect(201);

      expect(response.body.question.type).toBe('multiple');
      expect(response.body.question.correctAnswers).toHaveLength(2);
    });

    it('should add a boolean question to quiz', async () => {
      const questionData = {
        text: 'JavaScript is a compiled language',
        type: 'boolean',
        correctAnswers: ['Fałsz'],
        points: 1
      };

      const response = await request(app)
        .post(`/api/quizzes/${quiz._id}/questions`)
        .set(authHeaders)
        .send(questionData)
        .expect(201);

      expect(response.body.question.type).toBe('boolean');
      expect(response.body.question.options).toEqual(['Prawda', 'Fałsz']);
    });

    it('should add a text question to quiz', async () => {
      const questionData = {
        text: 'What does HTML stand for?',
        type: 'text',
        correctAnswers: ['HyperText Markup Language', 'Hypertext Markup Language'],
        points: 2
      };

      const response = await request(app)
        .post(`/api/quizzes/${quiz._id}/questions`)
        .set(authHeaders)
        .send(questionData)
        .expect(201);

      expect(response.body.question.type).toBe('text');
      expect(response.body.question.correctAnswers).toHaveLength(2);
    });

    it('should add question with hint and explanation', async () => {
      const questionData = {
        text: 'What is the time complexity of binary search?',
        type: 'single',
        options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'],
        correctAnswers: ['O(log n)'],
        hint: 'Think about how many elements are eliminated in each step',
        explanation: 'Binary search eliminates half of the remaining elements in each step',
        points: 3
      };

      const response = await request(app)
        .post(`/api/quizzes/${quiz._id}/questions`)
        .set(authHeaders)
        .send(questionData)
        .expect(201);

      expect(response.body.question.hint).toBe(questionData.hint);
      expect(response.body.question.explanation).toBe(questionData.explanation);
    });

    it('should add question with category and tags', async () => {
      const questionData = {
        text: 'Which method is used to add an element to the end of an array?',
        type: 'single',
        options: ['push()', 'pop()', 'shift()', 'unshift()'],
        correctAnswers: ['push()'],
        category: 'JavaScript',
        tags: ['arrays', 'methods'],
        difficulty: 'easy',
        points: 1
      };

      const response = await request(app)
        .post(`/api/quizzes/${quiz._id}/questions`)
        .set(authHeaders)
        .send(questionData)
        .expect(201);

      expect(response.body.question.category).toBe('JavaScript');
      expect(response.body.question.tags).toEqual(['arrays', 'methods']);
      expect(response.body.question.difficulty).toBe('easy');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post(`/api/quizzes/${quiz._id}/questions`)
        .set(authHeaders)
        .send({})
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should validate text length', async () => {
      // Too short text
      let response = await request(app)
        .post(`/api/quizzes/${quiz._id}/questions`)
        .set(authHeaders)
        .send({
          text: 'abc',
          type: 'single',
          options: ['A', 'B'],
          correctAnswers: ['A']
        })
        .expect(400);

      expect(response.body.error).toBeDefined();

      // Too long text
      response = await request(app)
        .post(`/api/quizzes/${quiz._id}/questions`)
        .set(authHeaders)
        .send({
          text: 'a'.repeat(1001),
          type: 'single',
          options: ['A', 'B'],
          correctAnswers: ['A']
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should validate question type', async () => {
      const response = await request(app)
        .post(`/api/quizzes/${quiz._id}/questions`)
        .set(authHeaders)
        .send({
          text: 'Valid question?',
          type: 'invalid-type',
          correctAnswers: ['answer']
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should validate options for choice questions', async () => {
      // Single choice with insufficient options
      let response = await request(app)
        .post(`/api/quizzes/${quiz._id}/questions`)
        .set(authHeaders)
        .send({
          text: 'Question with one option?',
          type: 'single',
          options: ['Only one'],
          correctAnswers: ['Only one']
        })
        .expect(400);

      expect(response.body.error).toContain('at least 2 options');

      // Multiple choice with insufficient options
      response = await request(app)
        .post(`/api/quizzes/${quiz._id}/questions`)
        .set(authHeaders)
        .send({
          text: 'Question with one option?',
          type: 'multiple',
          options: ['Only one'],
          correctAnswers: ['Only one']
        })
        .expect(400);

      expect(response.body.error).toContain('at least 2 options');
    });

    it('should validate correct answers', async () => {
      const response = await request(app)
        .post(`/api/quizzes/${quiz._id}/questions`)
        .set(authHeaders)
        .send({
          text: 'Question without correct answers?',
          type: 'single',
          options: ['A', 'B', 'C'],
          correctAnswers: []
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details.some(detail => detail.msg.includes('Correct answers are required'))).toBe(true);
    });

    it('should validate boolean question answers', async () => {
      const response = await request(app)
        .post(`/api/quizzes/${quiz._id}/questions`)
        .set(authHeaders)
        .send({
          text: 'Boolean question?',
          type: 'boolean',
          correctAnswers: ['Invalid answer']
        })
        .expect(400);

      expect(response.body.error).toContain('Prawda');
    });

    it('should validate points range', async () => {
      const response = await request(app)
        .post(`/api/quizzes/${quiz._id}/questions`)
        .set(authHeaders)
        .send({
          text: 'Question with invalid points?',
          type: 'single',
          options: ['A', 'B'],
          correctAnswers: ['A'],
          points: 101
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should validate difficulty values', async () => {
      const response = await request(app)
        .post(`/api/quizzes/${quiz._id}/questions`)
        .set(authHeaders)
        .send({
          text: 'Question with invalid difficulty?',
          type: 'single',
          options: ['A', 'B'],
          correctAnswers: ['A'],
          difficulty: 'impossible'
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
    
    it('should require authentication', async () => {
      await request(app)
        .post(`/api/quizzes/${quiz._id}/questions`)
        .send({ text: 'Test question?' })
        .expect(401);
    });

    it('should not allow adding questions to other users quiz', async () => {
      const otherUserQuiz = await createQuiz({ createdBy: 'other-user' });

      await request(app)
        .post(`/api/quizzes/${otherUserQuiz._id}/questions`)
        .set(authHeaders)
        .send({
          text: 'Test question?',
          type: 'single',
          options: ['A', 'B'],
          correctAnswers: ['A']
        })
        .expect(403);
    });

    it('should allow instructor to add questions to any quiz', async () => {
      const otherUserQuiz = await createQuiz({ createdBy: 'other-user' });

      const response = await request(app)
        .post(`/api/quizzes/${otherUserQuiz._id}/questions`)
        .set(instructorHeaders)
        .send({
          text: 'Instructor question?',
          type: 'single',
          options: ['A', 'B'],
          correctAnswers: ['A']
        })
        .expect(201);

      expect(response.body.question.text).toBe('Instructor question?');
    });

    it('should return 404 for non-existent quiz', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      await request(app)
        .post(`/api/quizzes/${fakeId}/questions`)
        .set(authHeaders)
        .send({
          text: 'Question for non-existent quiz?',
          type: 'single',
          options: ['A', 'B'],
          correctAnswers: ['A']
        })
        .expect(404);
    });
  });

  describe('GET /api/quizzes/:quizId/questions', () => {
    it('should get questions for a quiz', async () => {
      const question1 = await createQuestion();
      const question2 = await createQuestion({ text: 'Question 2?' });
      quiz.questions = [question1._id, question2._id];
      await quiz.save();

      const response = await request(app)
        .get(`/api/quizzes/${quiz._id}/questions`)
        .set(authHeaders)
        .expect(200);

      expect(response.body).toHaveLength(2);
    });

    it('should return questions in creation order', async () => {
      const questions = await createQuestionsForQuiz(3);
      quiz.questions = questions.map(q => q._id);
      await quiz.save();

      const response = await request(app)
        .get(`/api/quizzes/${quiz._id}/questions`)
        .set(authHeaders)
        .expect(200);

      expect(response.body).toHaveLength(3);
      expect(response.body[0].text).toBe('Test Question 1?');
      expect(response.body[1].text).toBe('Test Question 2?');
      expect(response.body[2].text).toBe('Test Question 3?');
    });

    it('should return empty array for quiz without questions', async () => {
      const response = await request(app)
        .get(`/api/quizzes/${quiz._id}/questions`)
        .set(authHeaders)
        .expect(200);

      expect(response.body).toHaveLength(0);
    });

    it('should return 404 for non-existent quiz', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      await request(app)
        .get(`/api/quizzes/${fakeId}/questions`)
        .set(authHeaders)
        .expect(404);
    });
  });

  describe('GET /api/questions/:id', () => {
    it('should get a specific question', async () => {
      const question = await createQuestion({
        text: 'Specific question?',
        hint: 'This is a hint',
        explanation: 'This is an explanation'
      });

      const response = await request(app)
        .get(`/api/questions/${question._id}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.text).toBe('Specific question?');
      expect(response.body.hint).toBe('This is a hint');
      expect(response.body.explanation).toBe('This is an explanation');
    });

    it('should return 404 for non-existent question', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      await request(app)
        .get(`/api/questions/${fakeId}`)
        .set(authHeaders)
        .expect(404);
    });

    it('should validate MongoDB ObjectId format', async () => {
      await request(app)
        .get('/api/questions/invalid-id')
        .set(authHeaders)
        .expect(400);
    });
  });

  describe('PUT /api/questions/:id', () => {
    it('should update own question', async () => {
      const question = await createQuestion();
      const updateData = { text: 'Updated question text?', points: 5 };

      const response = await request(app)
        .put(`/api/questions/${question._id}`)
        .set(authHeaders)
        .send(updateData)
        .expect(200);

      expect(response.body.question.text).toBe(updateData.text);
      expect(response.body.question.points).toBe(updateData.points);
    });

    it('should update question type and options', async () => {
      const question = await createQuestion({ type: 'single' });
      const updateData = {
        type: 'multiple',
        options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
        correctAnswers: ['Option 1', 'Option 3']
      };

      const response = await request(app)
        .put(`/api/questions/${question._id}`)
        .set(authHeaders)
        .send(updateData)
        .expect(200);

      expect(response.body.question.type).toBe('multiple');
      expect(response.body.question.correctAnswers).toHaveLength(2);
    });

    it('should update boolean question', async () => {
      const question = await createQuestion({ type: 'single' });
      const updateData = {
        type: 'boolean',
        correctAnswers: ['Prawda']
      };

      const response = await request(app)
        .put(`/api/questions/${question._id}`)
        .set(authHeaders)
        .send(updateData)
        .expect(200);

      expect(response.body.question.type).toBe('boolean');
      expect(response.body.question.options).toEqual(['Prawda', 'Fałsz']);
    });

    it('should update hint and explanation', async () => {
      const question = await createQuestion();
      const updateData = {
        hint: 'New hint',
        explanation: 'New explanation'
      };

      const response = await request(app)
        .put(`/api/questions/${question._id}`)
        .set(authHeaders)
        .send(updateData)
        .expect(200);

      expect(response.body.question.hint).toBe('New hint');
      expect(response.body.question.explanation).toBe('New explanation');
    });

    it('should update category and tags', async () => {
      const question = await createQuestion();
      const updateData = {
        category: 'New Category',
        tags: ['new-tag1', 'new-tag2'],
        difficulty: 'hard'
      };

      const response = await request(app)
        .put(`/api/questions/${question._id}`)
        .set(authHeaders)
        .send(updateData)
        .expect(200);

      expect(response.body.question.category).toBe('New Category');
      expect(response.body.question.tags).toEqual(['new-tag1', 'new-tag2']);
      expect(response.body.question.difficulty).toBe('hard');
    });

    it('should validate updated options', async () => {
      const question = await createQuestion();

      const response = await request(app)
        .put(`/api/questions/${question._id}`)
        .set(authHeaders)
        .send({
          type: 'single',
          options: ['Only one option']
        })
        .expect(400);

      expect(response.body.error).toContain('at least 2 options');
    });

    it('should validate boolean question answers', async () => {
      const question = await createQuestion();

      const response = await request(app)
        .put(`/api/questions/${question._id}`)
        .set(authHeaders)
        .send({
          type: 'boolean',
          correctAnswers: ['Invalid']
        })
        .expect(400);

      expect(response.body.error).toContain('Prawda');
    });

    it('should not allow updating other users questions', async () => {
      const question = await createQuestion({ createdBy: 'other-user' });

      await request(app)
        .put(`/api/questions/${question._id}`)
        .set(authHeaders)
        .send({ text: 'Hacked question?' })
        .expect(403);
    });

    it('should allow admin to update any question', async () => {
      const question = await createQuestion({ createdBy: 'other-user' });

      const response = await request(app)
        .put(`/api/questions/${question._id}`)
        .set(adminHeaders)
        .send({ text: 'Admin updated question?' })
        .expect(200);

      expect(response.body.question.text).toBe('Admin updated question?');
    });

    it('should return 404 for non-existent question', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      await request(app)
        .put(`/api/questions/${fakeId}`)
        .set(authHeaders)
        .send({ text: 'Update non-existent?' })
        .expect(404);
    });
  });

  describe('DELETE /api/questions/:id', () => {
    it('should delete own question', async () => {
      const question = await createQuestion();

      await request(app)
        .delete(`/api/questions/${question._id}`)
        .set(authHeaders)
        .expect(200);
    });

    it('should remove question from quiz', async () => {
      const question = await createQuestion();
      quiz.questions = [question._id];
      await quiz.save();

      await request(app)
        .delete(`/api/questions/${question._id}`)
        .set(authHeaders)
        .expect(200);

      // Verify question was removed from quiz
      const reloadedQuiz = await require('../../src/models/Quiz').findById(quiz._id);
      expect(reloadedQuiz.questions).toHaveLength(0);
    });

    it('should not allow deleting other users questions', async () => {
      const question = await createQuestion({ createdBy: 'other-user' });

      await request(app)
        .delete(`/api/questions/${question._id}`)
        .set(authHeaders)
        .expect(403);
    });

    it('should allow admin to delete any question', async () => {
      const question = await createQuestion({ createdBy: 'other-user' });

      await request(app)
        .delete(`/api/questions/${question._id}`)
        .set(adminHeaders)
        .expect(200);
    });

    it('should return 404 for non-existent question', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      await request(app)
        .delete(`/api/questions/${fakeId}`)
        .set(authHeaders)
        .expect(404);
    });
  });

  describe('GET /api/user/questions', () => {
    it('should get user questions with pagination', async () => {
      // Create 15 questions for the user
      for (let i = 0; i < 15; i++) {
        await createQuestion({ 
          text: `User question ${i + 1}?`,
          createdBy: '12345'
        });
      }

      const response = await request(app)
        .get('/api/user/questions?page=2&limit=5')
        .set(authHeaders)
        .expect(200);

      expect(response.body.questions).toHaveLength(5);
      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(5);
      expect(response.body.total).toBe(15);
    });

    it('should filter questions by type', async () => {
      await createQuestion({ type: 'single', createdBy: '12345' });
      await createQuestion({ type: 'multiple', createdBy: '12345' });
      await createQuestion({ type: 'boolean', createdBy: '12345' });

      const response = await request(app)
        .get('/api/user/questions?type=single')
        .set(authHeaders)
        .expect(200);

      expect(response.body.questions).toHaveLength(1);
      expect(response.body.questions[0].type).toBe('single');
    });

    it('should filter questions by category', async () => {
      await createQuestion({ category: 'Math', createdBy: '12345' });
      await createQuestion({ category: 'Science', createdBy: '12345' });

      const response = await request(app)
        .get('/api/user/questions?category=Math')
        .set(authHeaders)
        .expect(200);

      expect(response.body.questions).toHaveLength(1);
      expect(response.body.questions[0].category).toBe('Math');
    });

    it('should filter questions by difficulty', async () => {
      await createQuestion({ difficulty: 'easy', createdBy: '12345' });
      await createQuestion({ difficulty: 'hard', createdBy: '12345' });

      const response = await request(app)
        .get('/api/user/questions?difficulty=easy')
        .set(authHeaders)
        .expect(200);

      expect(response.body.questions).toHaveLength(1);
      expect(response.body.questions[0].difficulty).toBe('easy');
    });

    it('should combine multiple filters', async () => {
      await createQuestion({ 
        type: 'single', 
        category: 'Math', 
        difficulty: 'easy',
        createdBy: '12345' 
      });
      await createQuestion({ 
        type: 'multiple', 
        category: 'Math', 
        difficulty: 'easy',
        createdBy: '12345' 
      });

      const response = await request(app)
        .get('/api/user/questions?type=single&category=Math&difficulty=easy')
        .set(authHeaders)
        .expect(200);

      expect(response.body.questions).toHaveLength(1);
      expect(response.body.questions[0].type).toBe('single');
    });

    it('should return only users own questions', async () => {
      await createQuestion({ createdBy: '12345' });
      await createQuestion({ createdBy: 'other-user' });

      const response = await request(app)
        .get('/api/user/questions')
        .set(authHeaders)
        .expect(200);

      expect(response.body.questions).toHaveLength(1);
      expect(response.body.questions[0].createdBy).toBe('12345');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/user/questions')
        .expect(401);
    });
  });
}); 