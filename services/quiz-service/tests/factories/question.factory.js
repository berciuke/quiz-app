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
  } else if (type === 'text') {
    correctAnswers = [faker.lorem.word()];
  }
  
  return {
    text: faker.lorem.sentence() + '?',
    type,
    options,
    correctAnswers,
    points: faker.number.int({ min: 1, max: 5 }),
    hint: faker.lorem.sentence(),
    explanation: faker.lorem.paragraph(),
    difficulty: faker.helpers.arrayElement(['easy', 'medium', 'hard']),
    category: faker.commerce.department(),
    tags: faker.lorem.words(3).split(' '),
    createdBy: '12345',
    ...overrides
  };
};

const createQuestion = async (overrides = {}) => {
  const questionData = createQuestionData(overrides);
  return await Question.create(questionData);
};

const createQuestionsForQuiz = async (count = 5, overrides = {}) => {
  const questions = [];
  for (let i = 0; i < count; i++) {
    const question = await createQuestion({
      ...overrides,
      text: `${overrides.text || 'Test Question'} ${i + 1}?`
    });
    questions.push(question);
  }
  return questions;
};

const createQuestionsByType = async (type, count = 3) => {
  const questions = [];
  for (let i = 0; i < count; i++) {
    const question = await createQuestion({ type });
    questions.push(question);
  }
  return questions;
};

module.exports = {
  createQuestionData,
  createQuestion,
  createQuestionsForQuiz,
  createQuestionsByType
}; 