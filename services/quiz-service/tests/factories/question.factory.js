const Question = require('../../src/models/Question');

const createQuestion = async (overrides = {}) => {
  const defaultQuestion = {
    text: 'Test question?',
    type: 'single',
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctAnswers: ['Option A'],
    points: 1,
    category: 'Test Category',
    tags: ['test'],
    difficulty: 'medium',
    createdBy: '12345',
    hint: undefined,
    explanation: undefined,
    ...overrides
  };

  // Auto-generate options for boolean questions
  if (defaultQuestion.type === 'boolean') {
    defaultQuestion.options = ['Prawda', 'Fałsz'];
    if (!overrides.correctAnswers) {
      defaultQuestion.correctAnswers = ['Prawda'];
    }
  }

  // Auto-remove options for text questions
  if (defaultQuestion.type === 'text') {
    delete defaultQuestion.options;
  }

  const question = new Question(defaultQuestion);
  return await question.save();
};

const createQuestionsForQuiz = async (count) => {
  const questions = [];
  for (let i = 0; i < count; i++) {
    const question = await createQuestion({
      text: `Test Question ${i + 1}?`,
      points: 1,
      category: `Category ${i + 1}`,
      difficulty: i % 3 === 0 ? 'easy' : i % 3 === 1 ? 'medium' : 'hard'
    });
    questions.push(question);
  }
  return questions;
};

module.exports = {
  createQuestion,
  createQuestionsForQuiz
}; 