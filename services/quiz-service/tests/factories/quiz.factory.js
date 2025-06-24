const { faker } = require('@faker-js/faker');
const Quiz = require('../../src/models/Quiz');
const { createCategory } = require('./category.factory');
const { createQuestionsForQuiz } = require('./question.factory');

const createQuizData = async (overrides = {}) => {
  // Utwórz kategorię jeśli nie została podana
  let category = overrides.category;
  if (!category) {
    const categoryObj = await createCategory();
    category = categoryObj._id;
  }

  return {
    title: faker.lorem.sentence(3),
    description: faker.lorem.paragraph(),
    category,
    difficulty: faker.helpers.arrayElement(['easy', 'medium', 'hard']),
    duration: faker.number.int({ min: 5, max: 60 }),
    isPublic: true,
    isActive: true,
    language: 'en',
    tags: [],
    questions: [],
    playCount: faker.number.int({ min: 0, max: 100 }),
    views: faker.number.int({ min: 0, max: 200 }),
    timeLimit: faker.number.int({ min: 300, max: 3600 }),
    passingScore: faker.number.int({ min: 50, max: 90 }),
    invitedUsers: [],
    groupAccess: [],
    averageRating: faker.number.float({ min: 0, max: 5 }),
    ratingCount: faker.number.int({ min: 0, max: 50 }),
    weeklyPlayCount: faker.number.int({ min: 0, max: 20 }),
    monthlyPlayCount: faker.number.int({ min: 0, max: 80 }),
    ratings: [],
    comments: [],
    createdBy: '12345',
    ...overrides
  };
};

const createQuiz = async (overrides = {}) => {
  const quizData = await createQuizData(overrides);
  return await Quiz.create(quizData);
};

const createQuizWithQuestions = async (questionCount = 5, overrides = {}) => {
  const quiz = await createQuiz(overrides);
  const questions = await createQuestionsForQuiz(questionCount, { createdBy: quiz.createdBy });
  
  quiz.questions = questions.map(q => q._id);
  await quiz.save();
  
  return { quiz, questions };
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

const createQuizWithRatings = async (ratingsCount = 3, overrides = {}) => {
  const quiz = await createQuiz(overrides);
  
  for (let i = 0; i < ratingsCount; i++) {
    quiz.ratings.push({
      userId: `user-${i + 1}`,
      value: faker.number.int({ min: 1, max: 5 })
    });
  }
  
  quiz.calculateAverageRating();
  await quiz.save();
  
  return quiz;
};

module.exports = {
  createQuizData,
  createQuiz,
  createQuizWithQuestions,
  createMultipleQuizzes,
  createQuizWithRatings
}; 