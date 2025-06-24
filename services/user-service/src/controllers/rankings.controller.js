const { prisma } = require('../config/db');

const getWeekStart = (date = new Date()) => {
  const weekStart = new Date(date);
  const day = weekStart.getDay() || 7; // niedziela = 7
  weekStart.setDate(weekStart.getDate() - day + 1);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
};

// Aktualizacja rankingu globalnego
const updateGlobalRanking = async () => {
  try {
    // Pobierz aktualnych użytkowników z podstawowymi statystykami
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        totalQuizzesPlayed: {
          gt: 0
        }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        totalScore: true,
        averageScore: true,
        totalQuizzesPlayed: true,
        level: true
      },
      orderBy: [
        { totalScore: 'desc' },
        { averageScore: 'desc' },
        { totalQuizzesPlayed: 'desc' }
      ]
    });

    // Usuń stary ranking
    await prisma.globalRanking.deleteMany({});

    // Stwórz nowy ranking
    const rankingData = users.map((user, index) => ({
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      totalScore: user.totalScore,
      averageScore: user.averageScore,
      quizzesPlayed: user.totalQuizzesPlayed,
      level: user.level,
      rank: index + 1
    }));

    if (rankingData.length > 0) {
      await prisma.globalRanking.createMany({
        data: rankingData
      });
    }

    return rankingData.length;
  } catch (error) {
    console.error('[updateGlobalRanking] Błąd:', error);
    throw error;
  }
};

// Aktualizacja rankingu tygodniowego
const updateWeeklyRanking = async () => {
  try {
    const weekStart = getWeekStart();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Pobierz statystyki tygodniowe
    const weeklyStats = await prisma.quizHistory.groupBy({
      by: ['userId'],
      where: {
        completedAt: {
          gte: weekStart,
          lt: weekEnd
        }
      },
      _sum: {
        score: true
      },
      _count: {
        id: true
      },
      _avg: {
        score: true
      }
    });

    // Pobierz dane użytkowników
    const userIds = weeklyStats.map(stat => stat.userId);
    const users = await prisma.user.findMany({
      where: {
        id: {
          in: userIds
        }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true
      }
    });

    // Usuń stary ranking dla tego tygodnia
    await prisma.weeklyRanking.deleteMany({
      where: {
        weekStartDate: weekStart
      }
    });

    // Sortuj według totalScore i stwórz ranking
    const sortedStats = weeklyStats
      .map(stat => {
        const user = users.find(u => u.id === stat.userId);
        return {
          userId: stat.userId,
          userName: user ? `${user.firstName} ${user.lastName}` : 'Nieznany',
          weekStartDate: weekStart,
          totalScore: stat._sum.score || 0,
          quizzesPlayed: stat._count.id,
          averageScore: stat._avg.score || 0
        };
      })
      .sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
        return b.quizzesPlayed - a.quizzesPlayed;
      })
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }));

    if (sortedStats.length > 0) {
      await prisma.weeklyRanking.createMany({
        data: sortedStats
      });
    }

    return sortedStats.length;
  } catch (error) {
    console.error('[updateWeeklyRanking] Błąd:', error);
    throw error;
  }
};

const updateCategoryRanking = async (category) => {
  try {
    const categoryStats = await prisma.quizHistory.groupBy({
      by: ['userId'],
      where: {
        category: category
      },
      _sum: {
        score: true
      },
      _count: {
        id: true
      },
      _avg: {
        score: true,
        accuracy: true
      }
    });

    const userIds = categoryStats.map(stat => stat.userId);
    const users = await prisma.user.findMany({
      where: {
        id: {
          in: userIds
        }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true
      }
    });

    const topicStats = await prisma.topicStats.findMany({
      where: {
        userId: {
          in: userIds
        },
        category: category
      }
    });

    await prisma.categoryRanking.deleteMany({
      where: {
        category: category
      }
    });

    const sortedStats = categoryStats
      .map(stat => {
        const user = users.find(u => u.id === stat.userId);
        const topicStat = topicStats.find(ts => ts.userId === stat.userId);
        
        return {
          userId: stat.userId,
          userName: user ? `${user.firstName} ${user.lastName}` : 'Nieznany',
          category: category,
          totalScore: stat._sum.score || 0,
          averageScore: stat._avg.score || 0,
          quizzesPlayed: stat._count.id,
          level: topicStat ? topicStat.level : 1
        };
      })
      .sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
        return b.level - a.level;
      })
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }));

    if (sortedStats.length > 0) {
      await prisma.categoryRanking.createMany({
        data: sortedStats
      });
    }

    return sortedStats.length;
  } catch (error) {
    console.error('[updateCategoryRanking] Błąd:', error);
    throw error;
  }
};

const getGlobalRanking = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const ranking = await prisma.globalRanking.findMany({
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: { rank: 'asc' }
    });

    const total = await prisma.globalRanking.count();

    const userRank = await prisma.globalRanking.findFirst({
      where: { userId: req.user.id },
      select: { rank: true }
    });

    res.json({
      success: true,
      data: {
        ranking,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        },
        userRank: userRank?.rank || null
      }
    });
  } catch (error) {
    console.error('[getGlobalRanking] Błąd:', error);
    res.status(500).json({
      success: false,
      error: 'Błąd pobierania rankingu globalnego'
    });
  }
};

const getWeeklyRanking = async (req, res) => {
  try {
    const { page = 1, limit = 50, week } = req.query;
    const skip = (page - 1) * limit;
    
    const weekStart = week ? new Date(week) : getWeekStart();

    const ranking = await prisma.weeklyRanking.findMany({
      where: {
        weekStartDate: weekStart
      },
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: { rank: 'asc' }
    });

    const total = await prisma.weeklyRanking.count({
      where: {
        weekStartDate: weekStart
      }
    });

    const userRank = await prisma.weeklyRanking.findFirst({
      where: { 
        userId: req.user.id,
        weekStartDate: weekStart
      },
      select: { rank: true }
    });

    res.json({
      success: true,
      data: {
        ranking,
        weekStart,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        },
        userRank: userRank?.rank || null
      }
    });
  } catch (error) {
    console.error('[getWeeklyRanking] Błąd:', error);
    res.status(500).json({
      success: false,
      error: 'Błąd pobierania rankingu tygodniowego'
    });
  }
};

const getCategoryRanking = async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    if (!category) {
      return res.status(400).json({
        success: false,
        error: 'Kategoria jest wymagana'
      });
    }

    const ranking = await prisma.categoryRanking.findMany({
      where: {
        category: category
      },
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: { rank: 'asc' }
    });

    const total = await prisma.categoryRanking.count({
      where: {
        category: category
      }
    });

    const userRank = await prisma.categoryRanking.findFirst({
      where: { 
        userId: req.user.id,
        category: category
      },
      select: { rank: true }
    });

    res.json({
      success: true,
      data: {
        ranking,
        category,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        },
        userRank: userRank?.rank || null
      }
    });
  } catch (error) {
    console.error('[getCategoryRanking] Błąd:', error);
    res.status(500).json({
      success: false,
      error: 'Błąd pobierania rankingu kategorii'
    });
  }
};

// Pobranie dostępnych kategorii do rankingu
const getAvailableCategories = async (req, res) => {
  try {
    const categories = await prisma.quizHistory.groupBy({
      by: ['category'],
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    });

    res.json({
      success: true,
      data: categories.map(cat => ({
        name: cat.category,
        quizCount: cat._count.id
      }))
    });
  } catch (error) {
    console.error('[getAvailableCategories] Błąd:', error);
    res.status(500).json({
      success: false,
      error: 'Błąd pobierania kategorii'
    });
  }
};

const getUserRankingStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const globalRank = await prisma.globalRanking.findFirst({
      where: { userId },
      select: { rank: true, totalScore: true }
    });

    const weekStart = getWeekStart();
    const weeklyRank = await prisma.weeklyRanking.findFirst({
      where: { 
        userId,
        weekStartDate: weekStart
      },
      select: { rank: true, totalScore: true }
    });

    const categoryRanks = await prisma.categoryRanking.findMany({
      where: { userId },
      select: { 
        category: true, 
        rank: true, 
        totalScore: true,
        level: true
      },
      orderBy: { rank: 'asc' },
      take: 5
    });

    const weeklyHistory = [];
    for (let i = 0; i < 4; i++) {
      const pastWeekStart = getWeekStart();
      pastWeekStart.setDate(pastWeekStart.getDate() - (i * 7));
      
      const weekRank = await prisma.weeklyRanking.findFirst({
        where: {
          userId,
          weekStartDate: pastWeekStart
        },
        select: { rank: true, totalScore: true }
      });
      
      weeklyHistory.push({
        weekStart: pastWeekStart,
        rank: weekRank?.rank || null,
        score: weekRank?.totalScore || 0
      });
    }

    res.json({
      success: true,
      data: {
        global: {
          rank: globalRank?.rank || null,
          score: globalRank?.totalScore || 0
        },
        weekly: {
          rank: weeklyRank?.rank || null,
          score: weeklyRank?.totalScore || 0,
          weekStart
        },
        categories: categoryRanks,
        weeklyHistory: weeklyHistory.reverse()
      }
    });
  } catch (error) {
    console.error('[getUserRankingStats] Błąd:', error);
    res.status(500).json({
      success: false,
      error: 'Błąd pobierania statystyk rankingowych'
    });
  }
};

const forceUpdateRankings = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Brak uprawnień'
      });
    }

    const { type } = req.body;

    let result = {};

    if (!type || type === 'global') {
      const globalCount = await updateGlobalRanking();
      result.global = `Zaktualizowano ${globalCount} pozycji`;
    }

    if (!type || type === 'weekly') {
      const weeklyCount = await updateWeeklyRanking();
      result.weekly = `Zaktualizowano ${weeklyCount} pozycji`;
    }

    if (!type || type === 'categories') {
      const categories = await prisma.quizHistory.groupBy({
        by: ['category']
      });
      
      let categoryCount = 0;
      for (const cat of categories) {
        const count = await updateCategoryRanking(cat.category);
        categoryCount += count;
      }
      result.categories = `Zaktualizowano ${categoryCount} pozycji w ${categories.length} kategoriach`;
    }

    res.json({
      success: true,
      message: 'Rankingi zostały zaktualizowane',
      details: result
    });
  } catch (error) {
    console.error('[forceUpdateRankings] Błąd:', error);
    res.status(500).json({
      success: false,
      error: 'Błąd aktualizacji rankingów'
    });
  }
};

module.exports = {
  updateGlobalRanking,
  updateWeeklyRanking,
  updateCategoryRanking,
  getGlobalRanking,
  getWeeklyRanking,
  getCategoryRanking,
  getAvailableCategories,
  getUserRankingStats,
  forceUpdateRankings,
  getWeekStart
}; 