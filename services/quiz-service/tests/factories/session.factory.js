const { faker } = require('@faker-js/faker');
const Session = require('../../src/models/Session');
const { createQuizWithQuestions } = require('./quiz.factory');
const mongoose = require('mongoose');

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
  const defaultSession = {
    userId: 12345,
    quizId: null, // Should be provided in overrides
    status: 'in-progress',
    currentQuestionIndex: 0,
    score: 0,
    timeSpent: 0,
    startedAt: new Date(),
    answers: [],
    maxScore: 3,
    firstAttempt: true,
    ...overrides
  };

  const session = new Session(defaultSession);
  return await session.save();
};

const createSessionWithAnswers = async (answerCount, overrides = {}) => {
  const session = await createSession(overrides);
  
  // Add sample answers with proper ObjectIds
  for (let i = 0; i < answerCount; i++) {
    session.addAnswer(
      new mongoose.Types.ObjectId(), // Proper ObjectId
      [`Answer ${i + 1}`],
      i % 2 === 0, // Alternate correct/incorrect
      i % 2 === 0 ? 1 : 0, // Points based on correctness
      10 + i * 2 // Increasing time spent
    );
  }

  await session.save();
  return { session, answerCount };
};

const createCompletedSession = async (overrides = {}) => {
  const session = await createSession({
    status: 'completed',
    currentQuestionIndex: 3,
    score: 2,
    timeSpent: 45,
    completedAt: new Date(),
    accuracy: 66.67,
    correctAnswersCount: 2,
    totalQuestions: 3,
    ...overrides
  });

  // Add some sample answers with proper ObjectIds
  session.addAnswer(new mongoose.Types.ObjectId(), ['Correct Answer'], true, 1, 15);
  session.addAnswer(new mongoose.Types.ObjectId(), ['Wrong Answer'], false, 0, 12);
  session.addAnswer(new mongoose.Types.ObjectId(), ['Correct Answer'], true, 1, 18);

  await session.save();
  return { session };
};

const createPausedSession = async (overrides = {}) => {
  const session = await createSession({
    status: 'paused',
    pausedAt: new Date(),
    ...overrides
  });

  return session;
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
  createSession,
  createSessionWithAnswers,
  createCompletedSession,
  createPausedSession
}; 