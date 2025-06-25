const Session = require('../models/Session');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const Category = require('../models/Category');
const axios = require('axios');
const mongoose = require('mongoose');

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3002';

const startSession = async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user.id;

    const quiz = await Quiz.findById(quizId)
      .populate('questions')
      .populate('category');

    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: 'Quiz nie został znaleziony'
      });
    }

    if (!quiz.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Quiz nie jest aktywny'
      });
    }

    if (!quiz.isPublic && !quiz.invitedUsers.includes(userId)) {
      return res.status(403).json({
        success: false,
        error: 'Brak dostępu do tego quizu'
      });
    }

    // Sprawdź czy użytkownik nie ma już aktywnej sesji dla tego quizu
    const existingSession = await Session.findOne({
      userId: userId,
      quizId: quizId,
      status: { $in: ['in-progress', 'paused'] }
    });

    if (existingSession) {
      return res.json({
        success: true,
        message: 'Kontynuacja istniejącej sesji',
        data: {
          sessionId: existingSession._id,
          status: existingSession.status,
          currentQuestionIndex: existingSession.currentQuestionIndex,
          answeredQuestions: existingSession.answers.length,
          totalQuestions: quiz.questions.length,
          timeSpent: existingSession.timeSpent
        }
      });
    }

    // Sprawdź czy to pierwsza próba tego quizu przez użytkownika
    const previousAttempts = await Session.countDocuments({
      userId: userId,
      quizId: quizId,
      status: 'completed'
    });

    const firstAttempt = previousAttempts === 0;

    // Oblicz maksymalny możliwy wynik
    const maxScore = quiz.questions.reduce((total, question) => {
      return total + (question.points || 1);
    }, 0);

    // Stwórz nową sesję
    const session = new Session({
      userId: userId,
      quizId: quizId,
      status: 'in-progress',
      maxScore: maxScore,
      firstAttempt: firstAttempt,
      currentQuestionIndex: 0
    });

    await session.save();

    // Zwiększ licznik wyświetleń quizu
    await Quiz.findByIdAndUpdate(quizId, {
      $inc: { views: 1 },
      $set: { lastPlayedAt: new Date() }
    });

    res.status(201).json({
      success: true,
      message: 'Sesja rozpoczęta pomyślnie',
      data: {
        sessionId: session._id,
        quiz: {
          id: quiz._id,
          title: quiz.title,
          description: quiz.description,
          category: quiz.category.name,
          difficulty: quiz.difficulty,
          totalQuestions: quiz.questions.length,
          maxScore: maxScore,
          timeLimit: quiz.timeLimit
        },
        session: {
          status: session.status,
          currentQuestionIndex: session.currentQuestionIndex,
          startedAt: session.startedAt,
          firstAttempt: session.firstAttempt
        }
      }
    });
  } catch (error) {
    console.error('[startSession] Błąd:', error);
    res.status(500).json({
      success: false,
      error: 'Błąd rozpoczynania sesji'
    });
  }
};

// Pobranie aktualnego pytania z sesji
const getCurrentQuestion = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await Session.findOne({
      _id: sessionId,
      userId: userId
    }).populate('quizId');

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Sesja nie została znaleziona'
      });
    }

    if (session.status !== 'in-progress') {
      return res.status(400).json({
        success: false,
        error: 'Sesja nie jest aktywna'
      });
    }

    const quiz = await Quiz.findById(session.quizId).populate('questions');
    
    if (session.currentQuestionIndex >= quiz.questions.length) {
      return res.status(400).json({
        success: false,
        error: 'Wszystkie pytania zostały już odpowiedziane'
      });
    }

    const currentQuestion = quiz.questions[session.currentQuestionIndex];
    
    // Nie wyślij poprawnych odpowiedzi
    const questionData = {
      id: currentQuestion._id,
      text: currentQuestion.text,
      type: currentQuestion.type,
      options: currentQuestion.options,
      points: currentQuestion.points,
      hint: currentQuestion.hint,
      questionNumber: session.currentQuestionIndex + 1,
      totalQuestions: quiz.questions.length
    };

    res.json({
      success: true,
      data: {
        question: questionData,
        session: {
          currentQuestionIndex: session.currentQuestionIndex,
          answeredQuestions: session.answers.length,
          currentScore: session.score,
          timeSpent: Math.floor((new Date() - session.startedAt) / 1000)
        }
      }
    });
  } catch (error) {
    console.error('[getCurrentQuestion] Błąd:', error);
    res.status(500).json({
      success: false,
      error: 'Błąd pobierania pytania'
    });
  }
};

// Zapisanie odpowiedzi na pytanie
const submitAnswer = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { questionId, selectedAnswers, timeSpent } = req.body;
    const userId = req.user.id;

    // Walidacja
    if (!questionId || !selectedAnswers || !Array.isArray(selectedAnswers) || selectedAnswers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nieprawidłowe dane odpowiedzi'
      });
    }

    const session = await Session.findOne({
      _id: sessionId,
      userId: userId
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Sesja nie została znaleziona'
      });
    }

    if (session.status !== 'in-progress') {
      return res.status(400).json({
        success: false,
        error: 'Sesja nie jest aktywna'
      });
    }

    // Sprawdź czy nie odpowiedział już na to pytanie
    const existingAnswer = session.answers.find(
      answer => answer.questionId.toString() === questionId
    );

    if (existingAnswer) {
      return res.status(400).json({
        success: false,
        error: 'Odpowiedź na to pytanie została już udzielona'
      });
    }

    // Pobierz pytanie
    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        error: 'Pytanie nie zostało znalezione'
      });
    }

    // Sprawdź poprawność odpowiedzi
    let isCorrect = false;
    const correctAnswers = question.correctAnswers;

    if (question.type === 'single' || question.type === 'boolean') {
      isCorrect = selectedAnswers.length === 1 && 
                  correctAnswers.includes(selectedAnswers[0]);
    } else if (question.type === 'multiple') {
      isCorrect = selectedAnswers.length === correctAnswers.length &&
                  selectedAnswers.every(ans => correctAnswers.includes(ans)) &&
                  correctAnswers.every(ans => selectedAnswers.includes(ans));
    } else if (question.type === 'text') {
      // Dla pytań otwartych - porównanie tekstowe (case-insensitive)
      isCorrect = correctAnswers.some(correct => 
        selectedAnswers.some(selected => 
          selected.toLowerCase().trim() === correct.toLowerCase().trim()
        )
      );
    }

    const pointsAwarded = isCorrect ? (question.points || 1) : 0;

    // Dodaj odpowiedź do sesji
    session.addAnswer(questionId, selectedAnswers, isCorrect, pointsAwarded, timeSpent || 0);
    await session.save();

    res.json({
      success: true,
      data: {
        correct: isCorrect,
        pointsAwarded: pointsAwarded,
        correctAnswers: question.correctAnswers,
        explanation: question.explanation,
        currentScore: session.score,
        answeredQuestions: session.answers.length,
        nextQuestionIndex: session.currentQuestionIndex
      }
    });
  } catch (error) {
    console.error('[submitAnswer] Błąd:', error);
    res.status(500).json({
      success: false,
      error: 'Błąd zapisywania odpowiedzi'
    });
  }
};

// Zakończenie sesji quizu
const completeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await Session.findOne({
      _id: sessionId,
      userId: userId
    }).populate('quizId');

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Sesja nie została znaleziona'
      });
    }

    if (session.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Sesja została już zakończona'
      });
    }

    // Zakończ sesję
    session.complete();
    await session.save();

    // Aktualizuj statystyki quizu
    await Quiz.findByIdAndUpdate(session.quizId, {
      $inc: { playCount: 1 }
    });

    // Pobierz dane quizu i kategorii
    const quiz = await Quiz.findById(session.quizId).populate('category');
    
    // Przygotuj dane dla user-service
    const sessionData = {
      quizId: session.quizId.toString(),
      quizTitle: quiz.title,
      category: quiz.category.name,
      difficulty: quiz.difficulty,
      score: session.score,
      maxScore: session.maxScore,
      correctAnswers: session.answers.filter(a => a.isCorrect).length,
      totalQuestions: session.answers.length,
      accuracy: session.accuracy,
      timeSpent: session.timeSpent,
      speedBonus: session.speedBonus,
      firstAttempt: session.firstAttempt
    };

    // Wyślij dane do user-service do przetwarzania statystyk i osiągnięć
    try {
      const response = await axios.post(
        `${USER_SERVICE_URL}/api/stats/quiz-completed`,
        sessionData,
        {
          headers: {
            'Authorization': req.headers.authorization,
            'Content-Type': 'application/json'
          }
        }
      );

      const userServiceResult = response.data;

      res.json({
        success: true,
        message: 'Quiz zakończony pomyślnie',
        data: {
          session: {
            id: session._id,
            score: session.score,
            maxScore: session.maxScore,
            accuracy: session.accuracy,
            timeSpent: session.timeSpent,
            correctAnswers: session.answers.filter(a => a.isCorrect).length,
            totalQuestions: session.answers.length,
            speedBonus: session.speedBonus,
            perfectScore: session.perfectScore
          },
          userProgress: userServiceResult.data || {}
        }
      });
    } catch (userServiceError) {
      console.error('[completeSession] Błąd komunikacji z user-service:', userServiceError.message);
      
      // Zwróć podstawowe dane, nawet jeśli user-service nie odpowiada
      res.json({
        success: true,
        message: 'Quiz zakończony pomyślnie (błąd aktualizacji statystyk)',
        data: {
          session: {
            id: session._id,
            score: session.score,
            maxScore: session.maxScore,
            accuracy: session.accuracy,
            timeSpent: session.timeSpent,
            correctAnswers: session.answers.filter(a => a.isCorrect).length,
            totalQuestions: session.answers.length,
            speedBonus: session.speedBonus,
            perfectScore: session.perfectScore
          },
          userProgress: {
            pointsEarned: session.score,
            bonusPoints: 0,
            levelUp: false
          }
        }
      });
    }
  } catch (error) {
    console.error('[completeSession] Błąd:', error);
    res.status(500).json({
      success: false,
      error: 'Błąd zakończenia sesji'
    });
  }
};

// Wstrzymanie sesji
const pauseSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await Session.findOne({
      _id: sessionId,
      userId: userId
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Sesja nie została znaleziona'
      });
    }

    if (session.status !== 'in-progress') {
      return res.status(400).json({
        success: false,
        error: 'Nie można wstrzymać nieaktywnej sesji'
      });
    }

    session.pause();
    await session.save();

    res.json({
      success: true,
      message: 'Sesja została wstrzymana',
      data: {
        sessionId: session._id,
        status: session.status,
        pausedAt: session.pausedAt
      }
    });
  } catch (error) {
    console.error('[pauseSession] Błąd:', error);
    res.status(500).json({
      success: false,
      error: 'Błąd wstrzymania sesji'
    });
  }
};

// Wznowienie sesji
const resumeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await Session.findOne({
      _id: sessionId,
      userId: userId
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Sesja nie została znaleziona'
      });
    }

    if (session.status !== 'paused') {
      return res.status(400).json({
        success: false,
        error: 'Sesja nie jest wstrzymana'
      });
    }

    session.resume();
    await session.save();

    res.json({
      success: true,
      message: 'Sesja została wznowiona',
      data: {
        sessionId: session._id,
        status: session.status,
        currentQuestionIndex: session.currentQuestionIndex
      }
    });
  } catch (error) {
    console.error('[resumeSession] Błąd:', error);
    res.status(500).json({
      success: false,
      error: 'Błąd wznowienia sesji'
    });
  }
};

// Pobranie szczegółów sesji
const getSessionDetails = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await Session.findOne({
      _id: sessionId,
      userId: userId
    }).populate('quizId');

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Sesja nie została znaleziona'
      });
    }

    res.json({
      success: true,
      data: {
        session: {
          id: session._id,
          status: session.status,
          startedAt: session.startedAt,
          completedAt: session.completedAt,
          pausedAt: session.pausedAt,
          currentQuestionIndex: session.currentQuestionIndex,
          score: session.score,
          maxScore: session.maxScore,
          accuracy: session.accuracy,
          timeSpent: session.timeSpent,
          answeredQuestions: session.answers.length,
          perfectScore: session.perfectScore,
          speedBonus: session.speedBonus,
          firstAttempt: session.firstAttempt
        },
        quiz: {
          id: session.quizId._id,
          title: session.quizId.title
        }
      }
    });
  } catch (error) {
    console.error('[getSessionDetails] Błąd:', error);
    res.status(500).json({
      success: false,
      error: 'Błąd pobierania szczegółów sesji'
    });
  }
};

/**
 * GET /api/sessions/quiz/:quizId/stats - Statystyki sesji dla konkretnego quizu
 */
const getQuizSessionStats = async (req, res) => {
  try {
    const { quizId } = req.params;

    // Sprawdź czy quiz istnieje
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: 'Quiz nie znaleziony'
      });
    }

    // Pobierz wszystkie sesje tego quizu
    const sessions = await Session.find({ quizId }).lean();

    res.json({
      success: true,
      data: {
        sessions,
        total: sessions.length
      }
    });

  } catch (error) {
    console.error('[getQuizSessionStats] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Błąd pobierania statystyk sesji'
    });
  }
};

/**
 * GET /api/sessions/quiz/:quizId/trends - Trendy popularności quizu
 */
const getQuizTrends = async (req, res) => {
  try {
    const { quizId } = req.params;
    const { from } = req.query;

    let dateFilter = {};
    if (from) {
      dateFilter = { startedAt: { $gte: new Date(from) } };
    }

    const trends = await Session.aggregate([
      {
        $match: {
          quizId: new mongoose.Types.ObjectId(quizId),
          ...dateFilter
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$startedAt'
            }
          },
          attempts: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          averageScore: { $avg: '$score' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        trends: trends.map(trend => ({
          date: trend._id,
          attempts: trend.attempts,
          completed: trend.completed,
          averageScore: Math.round((trend.averageScore || 0) * 100) / 100
        }))
      }
    });

  } catch (error) {
    console.error('[getQuizTrends] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Błąd pobierania trendów'
    });
  }
};

module.exports = {
  startSession,
  getCurrentQuestion,
  submitAnswer,
  completeSession,
  pauseSession,
  resumeSession,
  getSessionDetails,
  getQuizSessionStats,
  getQuizTrends
};