const { prisma } = require('../config/db');
const axios = require('axios');

const QUIZ_SERVICE_URL = process.env.QUIZ_SERVICE_URL || 'http://quiz-service:3003';

exports.getUserStats = async (req, res) => {
  try {
    const { userId } = req.params;
    const { timeframe = 'all' } = req.query;

    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Brak uprawnień do tych statystyk' 
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        totalScore: true,
        averageScore: true,
        totalQuizzesPlayed: true,
        currentStreak: true,
        bestStreak: true,
        level: true,
        experience: true
      }
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'Użytkownik nie znaleziony' 
      });
    }

    let dateFilter = {};
    if (timeframe === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      dateFilter = { completedAt: { gte: oneWeekAgo } };
    } else if (timeframe === 'month') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      dateFilter = { completedAt: { gte: oneMonthAgo } };
    }

    const quizHistory = await prisma.quizHistory.findMany({
      where: {
        userId: parseInt(userId),
        ...dateFilter
      },
      orderBy: { completedAt: 'desc' },
      take: 50
    });

    const categoryStats = await prisma.topicStats.findMany({
      where: { userId: parseInt(userId) },
      orderBy: { averageScore: 'desc' }
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const progressData = await prisma.quizHistory.groupBy({
      by: ['completedAt'],
      where: {
        userId: parseInt(userId),
        completedAt: { gte: thirtyDaysAgo }
      },
      _sum: {
        score: true,
        pointsEarned: true
      },
      _avg: {
        accuracy: true
      },
      _count: {
        id: true
      }
    });

    const strengthsAndWeaknesses = await analyzePerformance(parseInt(userId));

    const userRank = await prisma.globalRanking.findFirst({
      where: { userId: parseInt(userId) },
      select: { rank: true }
    });

    const recentAchievements = await prisma.achievement.findMany({
      where: { userId: parseInt(userId) },
      orderBy: { unlockedAt: 'desc' },
      take: 5
    });

    res.json({
      success: true,
      data: {
        user,
        overview: {
          totalQuizzes: quizHistory.length || user.totalQuizzesPlayed,
          averageScore: user.averageScore,
          totalScore: user.totalScore,
          currentStreak: user.currentStreak,
          bestStreak: user.bestStreak,
          level: user.level,
          experience: user.experience,
          globalRank: userRank?.rank || null
        },
        categoryPerformance: categoryStats,
        progressOverTime: formatProgressData(progressData),
        recentHistory: quizHistory.slice(0, 10),
        strengthsAndWeaknesses,
        recentAchievements
      }
    });

  } catch (error) {
    console.error('[getUserStats] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Błąd pobierania statystyk użytkownika' 
    });
  }
};

exports.getQuizStats = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quizResponse = await axios.get(`${QUIZ_SERVICE_URL}/api/quizzes/${quizId}`);
    const quiz = quizResponse.data;

    if (quiz.createdBy !== req.user.id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Brak uprawnień do statystyk tego quizu' 
      });
    }

    const sessions = await getQuizSessions(quizId);

    if (!sessions || sessions.length === 0) {
      return res.json({
        success: true,
        data: {
          quiz: { id: quizId, title: quiz.title },
          overview: {
            totalAttempts: 0,
            averageScore: 0,
            averageAccuracy: 0,
            averageTimeSpent: 0,
            completionRate: 0
          },
          difficultyAnalysis: null,
          popularityTrends: [],
          questionAnalysis: []
        }
      });
    }

    const totalAttempts = sessions.length;
    const completedSessions = sessions.filter(s => s.status === 'completed');
    const completionRate = (completedSessions.length / totalAttempts) * 100;

    const averageScore = completedSessions.length > 0 
      ? completedSessions.reduce((sum, s) => sum + s.score, 0) / completedSessions.length 
      : 0;

    const averageAccuracy = completedSessions.length > 0
      ? completedSessions.reduce((sum, s) => sum + s.accuracy, 0) / completedSessions.length
      : 0;

    const averageTimeSpent = completedSessions.length > 0
      ? completedSessions.reduce((sum, s) => sum + s.timeSpent, 0) / completedSessions.length
      : 0;

    const difficultyAnalysis = analyzeDifficulty(completedSessions, quiz);

    const popularityTrends = await getPopularityTrends(quizId);

    const questionAnalysis = await analyzeQuestions(quizId, completedSessions);

    res.json({
      success: true,
      data: {
        quiz: {
          id: quizId,
          title: quiz.title,
          category: quiz.category,
          difficulty: quiz.difficulty
        },
        overview: {
          totalAttempts,
          completionRate: Math.round(completionRate * 100) / 100,
          averageScore: Math.round(averageScore * 100) / 100,
          averageAccuracy: Math.round(averageAccuracy * 100) / 100,
          averageTimeSpent: Math.round(averageTimeSpent)
        },
        difficultyAnalysis,
        popularityTrends,
        questionAnalysis
      }
    });

  } catch (error) {
    console.error('[getQuizStats] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Błąd pobierania statystyk quizu' 
    });
  }
};

exports.getLeaderboard = async (req, res) => {
  try {
    const { type = 'global', category, limit = 10 } = req.query;

    let ranking = [];

    if (type === 'global') {
      ranking = await prisma.globalRanking.findMany({
        take: parseInt(limit),
        orderBy: { rank: 'asc' }
      });
    } else if (type === 'weekly') {
      const currentWeekStart = getWeekStart(new Date());
      ranking = await prisma.weeklyRanking.findMany({
        where: { weekStartDate: currentWeekStart },
        take: parseInt(limit),
        orderBy: { rank: 'asc' }
      });
    } else if (type === 'category' && category) {
      ranking = await prisma.categoryRanking.findMany({
        where: { category },
        take: parseInt(limit),
        orderBy: { rank: 'asc' }
      });
    }

    res.json({
      success: true,
      data: {
        type,
        category: category || null,
        ranking
      }
    });

  } catch (error) {
    console.error('[getLeaderboard] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Błąd pobierania rankingu' 
    });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        totalScore: true,
        averageScore: true,
        totalQuizzesPlayed: true,
        currentStreak: true,
        level: true,
        experience: true
      }
    });

    const recentQuizzes = await prisma.quizHistory.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      take: 5
    });

    const weekStart = getWeekStart(new Date());
    const weeklyStats = await prisma.weeklyStats.findUnique({
      where: {
        userId_weekStartDate: {
          userId,
          weekStartDate: weekStart
        }
      }
    });

    const topCategories = await prisma.topicStats.findMany({
      where: { userId },
      orderBy: { averageScore: 'desc' },
      take: 3
    });

    const userRank = await prisma.globalRanking.findFirst({
      where: { userId },
      select: { rank: true }
    });

    const nextAchievement = await getNextAchievement(userId);

    res.json({
      success: true,
      data: {
        user,
        recentQuizzes,
        weeklyStats: weeklyStats || {
          quizzesPlayed: 0,
          totalScore: 0,
          averageScore: 0,
          timeSpent: 0
        },
        topCategories,
        globalRank: userRank?.rank || null,
        nextAchievement
      }
    });

  } catch (error) {
    console.error('[getDashboardStats] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Błąd pobierania statystyk dashboard' 
    });
  }
};

async function analyzePerformance(userId) {
  const categoryStats = await prisma.topicStats.findMany({
    where: { userId },
    orderBy: { averageScore: 'desc' }
  });

  const strengths = categoryStats.slice(0, 3).map(stat => ({
    category: stat.category,
    averageScore: stat.averageScore,
    totalQuizzes: stat.totalQuizzes
  }));

  const weaknesses = categoryStats.slice(-3).reverse().map(stat => ({
    category: stat.category,
    averageScore: stat.averageScore,
    totalQuizzes: stat.totalQuizzes,
    improvement: Math.max(0, 75 - stat.averageScore)
  }));

  return { strengths, weaknesses };
}

function formatProgressData(progressData) {
  return progressData.map(day => ({
    date: day.completedAt,
    totalScore: day._sum.score || 0,
    pointsEarned: day._sum.pointsEarned || 0,
    averageAccuracy: Math.round((day._avg.accuracy || 0) * 100) / 100,
    quizzesCompleted: day._count.id
  }));
}

async function getQuizSessions(quizId) {
  try {
    const response = await axios.get(`${QUIZ_SERVICE_URL}/api/sessions/quiz/${quizId}/stats`);
    return response.data.sessions || [];
  } catch (error) {
    console.error('Error fetching quiz sessions:', error.message);
    return [];
  }
}

function analyzeDifficulty(sessions, quiz) {
  if (sessions.length === 0) return null;

  const avgScore = sessions.reduce((sum, s) => sum + s.score, 0) / sessions.length;
  const avgAccuracy = sessions.reduce((sum, s) => sum + s.accuracy, 0) / sessions.length;
  
  let actualDifficulty = 'medium';
  if (avgAccuracy > 80) actualDifficulty = 'easy';
  else if (avgAccuracy < 50) actualDifficulty = 'hard';

  return {
    expectedDifficulty: quiz.difficulty,
    actualDifficulty,
    averageScore: Math.round(avgScore * 100) / 100,
    averageAccuracy: Math.round(avgAccuracy * 100) / 100,
    recommendation: actualDifficulty !== quiz.difficulty 
      ? `Quiz wydaje się być ${actualDifficulty} zamiast ${quiz.difficulty}`
      : 'Poziom trudności jest odpowiedni'
  };
}

async function getPopularityTrends(quizId) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    const response = await axios.get(`${QUIZ_SERVICE_URL}/api/sessions/quiz/${quizId}/trends?from=${thirtyDaysAgo.toISOString()}`);
    return response.data.trends || [];
  } catch (error) {
    console.error('Error fetching popularity trends:', error.message);
    return [];
  }
}

async function analyzeQuestions(quizId, sessions) {
  try {
    const response = await axios.get(`${QUIZ_SERVICE_URL}/api/quizzes/${quizId}/questions`);
    const questions = response.data.questions || [];

    return questions.map(question => {
      const questionAnswers = sessions.flatMap(s => 
        s.answers?.filter(a => a.questionId?.toString() === question._id?.toString()) || []
      );

      const correctAnswers = questionAnswers.filter(a => a.isCorrect).length;
      const totalAnswers = questionAnswers.length;
      const successRate = totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0;

      let difficulty = 'medium';
      if (successRate > 80) difficulty = 'easy';
      else if (successRate < 40) difficulty = 'hard';

      const result = {
        questionId: question._id,
        question: question.question,
        successRate: Math.round(successRate * 100) / 100,
        totalAttempts: totalAnswers,
        difficulty,
        needsReview: successRate < 30
      };
      
      return result;
    });
  } catch (error) {
    console.error('Error analyzing questions:', error.message);
    return [];
  }
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

async function getNextAchievement(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      totalScore: true,
      totalQuizzesPlayed: true,
      currentStreak: true
    }
  });

  const userAchievements = await prisma.achievement.findMany({
    where: { userId },
    select: { name: true }
  });

  const unlockedNames = userAchievements.map(a => a.name);

  if (!unlockedNames.includes('Początkujący') && user.totalQuizzesPlayed >= 5) {
    return {
      name: 'Początkujący',
      description: 'Ukończ 5 quizów',
      progress: Math.min(user.totalQuizzesPlayed, 5),
      target: 5
    };
  }

  if (!unlockedNames.includes('Łowca punktów') && user.totalScore >= 500) {
    return {
      name: 'Łowca punktów',
      description: 'Zdobądź 500 punktów',
      progress: Math.min(user.totalScore, 500),
      target: 500
    };
  }

  return null;
} 