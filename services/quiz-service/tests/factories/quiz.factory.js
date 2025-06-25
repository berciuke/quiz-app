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
    title: 'Test Quiz',
    description: 'A simple test quiz',
    category,
    difficulty: 'medium',
    isPublic: true,
    isActive: true,
    language: 'en',
    tags: [],
    questions: [],
    createdBy: '12345',
    ...overrides
  };
};

const createQuiz = async (overrides = {}) => {
  const quizData = await createQuizData(overrides);
  return await Quiz.create(quizData);
};

const createQuizWithQuestions = async (questionCount = 3, overrides = {}) => {
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