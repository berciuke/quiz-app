const { faker } = require('@faker-js/faker');
const Session = require('../../src/models/Session');
const { createQuizWithQuestions } = require('./quiz.factory');

const createSessionData = async (overrides = {}) => {
  // Utwórz quiz jeśli nie został podany
  let quizId = overrides.quizId;
  if (!quizId) {
    const { quiz } = await createQuizWithQuestions(3);
    quizId = quiz._id;
  }

  return {
    userId: 12345,
    quizId,
    status: 'in-progress',
    startedAt: new Date(),
    timeSpent: 0,
    currentQuestionIndex: 0,
    answers: [],
    score: 0,
    maxScore: 0,
    accuracy: 0,
    bonusPoints: 0,
    perfectScore: false,
    speedBonus: false,
    firstAttempt: true,
    ...overrides
  };
};

const createSession = async (overrides = {}) => {
  const sessionData = await createSessionData(overrides);
  return await Session.create(sessionData);
};

const createSessionWithAnswers = async (answersCount = 3, overrides = {}) => {
  const { quiz, questions } = await createQuizWithQuestions(answersCount);
  const session = await createSession({
    ...overrides,
    quizId: quiz._id,
    maxScore: questions.reduce((sum, q) => sum + q.points, 0)
  });
  
  // Dodaj odpowiedzi
  for (let i = 0; i < answersCount; i++) {
    const question = questions[i];
    const isCorrect = faker.datatype.boolean();
    const points = isCorrect ? question.points : 0;
    
    session.addAnswer(
      question._id,
      isCorrect ? question.correctAnswers : ['wrong answer'],
      isCorrect,
      points,
      faker.number.int({ min: 5, max: 30 })
    );
  }
  
  await session.save();
  return { session, quiz, questions };
};

const createCompletedSession = async (overrides = {}) => {
  const { session, quiz, questions } = await createSessionWithAnswers(3, overrides);
  
  session.complete();
  await session.save();
  
  return { session, quiz, questions };
};

const createMultipleSessions = async (count = 3, baseOverrides = {}) => {
  const sessions = [];
  for (let i = 0; i < count; i++) {
    const session = await createSession({
      ...baseOverrides,
      userId: baseOverrides.userId || 12345 + i
    });
    sessions.push(session);
  }
  return sessions;
};

module.exports = {
  createSessionData,
  createSession,
  createSessionWithAnswers,
  createCompletedSession,
  createMultipleSessions
}; 