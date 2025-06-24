const Session = require('../models/Session');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');

exports.startSession = async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user.id;

    // Sprawdź czy quiz istnieje i jest aktywny
    const quiz = await Quiz.findById(quizId).populate('questions');
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (!quiz.isActive) {
      return res.status(400).json({ error: 'Quiz is not active' });
    }

    // Sprawdź czy nie ma już aktywnej sesji dla tego użytkownika i quizu
    const existingSession = await Session.findOne({
      userId,
      quizId,
      status: { $in: ['in-progress', 'paused'] }
    });

    if (existingSession) {
      return res.status(400).json({ 
        error: 'Active session already exists for this quiz',
        sessionId: existingSession._id
      });
    }

    const session = new Session({
      quizId,
      userId,
      status: 'in-progress',
      answers: [],
      startedAt: new Date(),
    });

    await session.save();
    
    res.status(201).json({
      sessionId: session._id,
      quizId: session.quizId,
      status: session.status,
      startedAt: session.startedAt,
      totalQuestions: quiz.questions.length,
      timeLimit: quiz.timeLimit
    });
  } catch (err) {
    console.error('[startSession] Error:', err.message);
    res.status(500).json({ error: 'Failed to start session' });
  }
};

exports.submitAnswer = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { questionId, selectedAnswers } = req.body;
    const userId = req.user.id;

    const session = await Session.findOne({ _id: sessionId, userId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'in-progress') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    // Sprawdź czy odpowiedź na to pytanie już nie została udzielona
    const existingAnswer = session.answers.find(
      answer => answer.questionId.toString() === questionId
    );
    
    if (existingAnswer) {
      return res.status(400).json({ error: 'Answer for this question already submitted' });
    }

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Sprawdź poprawność odpowiedzi
    let isCorrect = false;
    if (question.type === 'single-choice') {
      isCorrect = selectedAnswers.length === 1 && 
                 question.correctAnswer === selectedAnswers[0];
    } else if (question.type === 'multiple-choice') {
      isCorrect = Array.isArray(question.correctAnswers) &&
                 Array.isArray(selectedAnswers) &&
                 selectedAnswers.length === question.correctAnswers.length &&
                 selectedAnswers.every(ans => question.correctAnswers.includes(ans));
    } else if (question.type === 'true-false') {
      isCorrect = selectedAnswers.length === 1 && 
                 question.correctAnswer === selectedAnswers[0];
    }

    // Dodaj odpowiedź do sesji
    session.answers.push({
      questionId,
      selectedAnswers,
      isCorrect,
    });

    // Aktualizuj wynik
    if (isCorrect) {
      session.score += question.points || 1;
    }

    await session.save();

    res.json({
      correct: isCorrect,
      currentScore: session.score,
      answeredQuestions: session.answers.length,
      totalQuestions: await Question.countDocuments({ quiz: session.quizId })
    });
  } catch (err) {
    console.error('[submitAnswer] Error:', err.message);
    res.status(500).json({ error: 'Failed to submit answer' });
  }
};

exports.pauseSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await Session.findOne({ _id: sessionId, userId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'in-progress') {
      return res.status(400).json({ error: 'Cannot pause inactive session' });
    }

    session.status = 'paused';
    session.pausedAt = new Date();
    await session.save();

    res.json({ 
      message: 'Session paused successfully',
      sessionId: session._id,
      status: session.status,
      pausedAt: session.pausedAt
    });
  } catch (err) {
    console.error('[pauseSession] Error:', err.message);
    res.status(500).json({ error: 'Failed to pause session' });
  }
};

exports.resumeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await Session.findOne({ _id: sessionId, userId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'paused') {
      return res.status(400).json({ error: 'Session can only be resumed from paused state' });
    }

    session.status = 'in-progress';
    session.resumedAt = new Date();
    await session.save();

    res.json({ 
      message: 'Session resumed successfully',
      sessionId: session._id,
      status: session.status,
      resumedAt: session.resumedAt
    });
  } catch (err) {
    console.error('[resumeSession] Error:', err.message);
    res.status(500).json({ error: 'Failed to resume session' });
  }
};

exports.finishSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await Session.findOne({ _id: sessionId, userId })
      .populate('quizId', 'title questions passingScore');
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status === 'finished') {
      return res.status(400).json({ error: 'Session already finished' });
    }

    session.status = 'finished';
    session.finishedAt = new Date();
    await session.save();

    // Oblicz wyniki
    const totalQuestions = session.answers.length;
    const correctAnswers = session.answers.filter(a => a.isCorrect).length;
    const scorePercentage = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    const passed = scorePercentage >= (session.quizId.passingScore || 60);

    // Aktualizuj statystyki quizu
    await Quiz.findByIdAndUpdate(session.quizId, {
      $inc: { playCount: 1 },
      lastPlayedAt: new Date()
    });

    res.json({
      message: 'Quiz completed successfully',
      results: {
        sessionId: session._id,
        totalScore: session.score,
        totalQuestions,
        correctAnswers,
        scorePercentage,
        passed,
        timeTaken: Math.round((session.finishedAt - session.startedAt) / 1000), // w sekundach
        quizTitle: session.quizId.title
      }
    });
  } catch (err) {
    console.error('[finishSession] Error:', err.message);
    res.status(500).json({ error: 'Failed to finish session' });
  }
};

exports.getSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await Session.findOne({ _id: sessionId, userId })
      .populate('quizId', 'title description questions timeLimit')
      .populate('answers.questionId', 'question type options');
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session);
  } catch (err) {
    console.error('[getSession] Error:', err.message);
    res.status(500).json({ error: 'Failed to get session' });
  }
};

exports.getUserSessions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;

    const filter = { userId };
    if (status) {
      filter.status = status;
    }

    const sessions = await Session.find(filter)
      .populate('quizId', 'title description')
      .sort({ startedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Session.countDocuments(filter);

    res.json({
      sessions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalSessions: total
      }
    });
  } catch (err) {
    console.error('[getUserSessions] Error:', err.message);
    res.status(500).json({ error: 'Failed to get user sessions' });
  }
};