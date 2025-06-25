const { prisma } = require('../config/db');

const achievementDefinitions = {
  'first_quiz': {
    type: 'milestone',
    name: 'Pierwszy quiz!',
    description: 'Ukończono pierwszy quiz w życiu',
    icon: '🎯',
    rarity: 'common',
    pointsAwarded: 10
  },
  'quiz_master_10': {
    type: 'milestone',
    name: 'Quiz Master',
    description: 'Ukończono 10 quizów',
    icon: '🏆',
    rarity: 'rare',
    pointsAwarded: 50
  },
  'quiz_legend_50': {
    type: 'milestone',
    name: 'Legenda quizów',
    description: 'Ukończono 50 quizów',
    icon: '👑',
    rarity: 'epic',
    pointsAwarded: 200
  },
  'quiz_god_100': {
    type: 'milestone',
    name: 'Bóg quizów',
    description: 'Ukończono 100 quizów',
    icon: '💎',
    rarity: 'legendary',
    pointsAwarded: 500
  },
  
  'perfectionist': {
    type: 'accuracy',
    name: 'Perfekcjonista',
    description: '100% poprawnych odpowiedzi w quizie',
    icon: '💯',
    rarity: 'rare',
    pointsAwarded: 25
  },
  'accuracy_master': {
    type: 'accuracy',
    name: 'Mistrz Precyzji',
    description: '10 quizów z 100% poprawnych odpowiedzi',
    icon: '🎖️',
    rarity: 'epic',
    pointsAwarded: 150
  },
  
  'speed_demon': {
    type: 'speed',
    name: 'Demon prędkości',
    description: 'Ukończono quiz w rekordowym czasie',
    icon: '⚡',
    rarity: 'rare',
    pointsAwarded: 30
  },
  
  'streak_warrior_5': {
    type: 'streak',
    name: 'Wojownik serii',
    description: '5 quizów w ciągu jednego dnia',
    icon: '🔥',
    rarity: 'rare',
    pointsAwarded: 40
  },
  'daily_dedication_7': {
    type: 'streak',
    name: 'Codzienne poświęcenie',
    description: 'Quiz każdego dnia przez tydzień',
    icon: '📅',
    rarity: 'epic',
    pointsAwarded: 100
  },
  
  'score_hunter_500': {
    type: 'score',
    name: 'Łowca punktów',
    description: 'Zdobyto 500 punktów',
    icon: '🏹',
    rarity: 'common',
    pointsAwarded: 20
  },
  'score_master_2000': {
    type: 'score',
    name: 'Mistrz punktów',
    description: 'Zdobyto 2000 punktów',
    icon: '🎯',
    rarity: 'rare',
    pointsAwarded: 75
  },
  'score_legend_5000': {
    type: 'score',
    name: 'Legenda punktów',
    description: 'Zdobyto 5000 punktów',
    icon: '🌟',
    rarity: 'epic',
    pointsAwarded: 200
  },
  
  'category_explorer': {
    type: 'category',
    name: 'Badacz kategorii',
    description: 'Ukończono quiz w 5 różnych kategoriach',
    icon: '🗺️',
    rarity: 'rare',
    pointsAwarded: 60
  },
  'category_master': {
    type: 'category',
    name: 'Mistrz kategorii',
    description: 'Średnia powyżej 80% w jednej kategorii (min. 10 quizów)',
    icon: '🧠',
    rarity: 'epic',
    pointsAwarded: 120
  }
};

const checkAndAwardAchievements = async (userId, sessionData = null) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        achievements: true,
        quizHistory: {
          orderBy: { completedAt: 'desc' }
        }
      }
    });

    if (!user) {
      throw new Error('Użytkownik nie znaleziony');
    }

    const existingAchievements = user.achievements.map(a => a.name);
    const newAchievements = [];

    for (const [key, definition] of Object.entries(achievementDefinitions)) {
      if (existingAchievements.includes(definition.name)) {
        continue;
      }

      const shouldAward = await checkAchievementCondition(key, definition, user, sessionData);
      
      if (shouldAward) {
        const achievement = await prisma.achievement.create({
          data: {
            userId: userId,
            type: definition.type,
            name: definition.name,
            description: definition.description,
            icon: definition.icon,
            rarity: definition.rarity,
            pointsAwarded: definition.pointsAwarded
          }
        });

        await prisma.user.update({
          where: { id: userId },
          data: {
            experience: {
              increment: definition.pointsAwarded
            }
          }
        });

        newAchievements.push(achievement);
      }
    }

    return newAchievements;
  } catch (error) {
    console.error('[checkAndAwardAchievements] Błąd:', error);
    throw error;
  }
};

const checkAchievementCondition = async (key, definition, user, sessionData) => {
  const { quizHistory } = user;
  
  switch (key) {
    case 'first_quiz':
      return quizHistory.length === 1;
      
    case 'quiz_master_10':
      return quizHistory.length === 10;
      
    case 'quiz_legend_50':
      return quizHistory.length === 50;
      
    case 'quiz_god_100':
      return quizHistory.length === 100;
      
    case 'perfectionist':
      return sessionData && sessionData.accuracy === 100;
      
    case 'accuracy_master':
      return quizHistory.filter(h => h.accuracy === 100).length === 10;
      
    case 'speed_demon':
      if (!sessionData) return false;
      const avgTimePerQuestion = 30; // sekund
      const expectedTime = sessionData.totalQuestions * avgTimePerQuestion;
      return sessionData.timeSpent < expectedTime * 0.5; // Ukończony w połowie oczekiwanego czasu
      
    case 'streak_warrior_5':
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const todayQuizzes = quizHistory.filter(h => 
        h.completedAt >= today && h.completedAt < tomorrow
      );
      return todayQuizzes.length === 5;
      
    case 'daily_dedication_7':
      return await checkDailyStreak(user.id, 7);
      
    case 'score_hunter_500':
      return user.totalScore >= 500;
      
    case 'score_master_2000':
      return user.totalScore >= 2000;
      
    case 'score_legend_5000':
      return user.totalScore >= 5000;
      
    case 'category_explorer':
      const uniqueCategories = new Set(quizHistory.map(h => h.category));
      return uniqueCategories.size >= 5;
      
    case 'category_master':
      return await checkCategoryMastery(user.id);
      
    default:
      return false;
  }
};

const checkDailyStreak = async (userId, requiredDays) => {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - requiredDays);
  daysAgo.setHours(0, 0, 0, 0);
  
  const recentHistory = await prisma.quizHistory.findMany({
    where: {
      userId: userId,
      completedAt: {
        gte: daysAgo
      }
    },
    orderBy: {
      completedAt: 'desc'
    }
  });
  
  for (let i = 0; i < requiredDays; i++) {
    const dayStart = new Date();
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    
    const dayQuizzes = recentHistory.filter(h => 
      h.completedAt >= dayStart && h.completedAt <= dayEnd
    );
    
    if (dayQuizzes.length === 0) {
      return false;
    }
  }
  
  return true;
};

const checkCategoryMastery = async (userId) => {
  const categoryStats = await prisma.quizHistory.groupBy({
    by: ['category'],
    where: {
      userId: userId
    },
    _count: {
      id: true
    },
    _avg: {
      accuracy: true
    },
    having: {
      id: {
        _count: {
          gte: 10
        }
      }
    }
  });
  
  return categoryStats.some(stat => stat._avg.accuracy >= 80);
};

const getUserAchievements = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const achievements = await prisma.achievement.findMany({
      where: { userId },
      orderBy: { unlockedAt: 'desc' }
    });
    
    res.json({
      success: true,
      data: achievements
    });
  } catch (error) {
    console.error('[getUserAchievements] Błąd:', error);
    res.status(500).json({
      success: false,
      error: 'Błąd pobierania osiągnięć'
    });
  }
};

const getAchievementStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const stats = await prisma.achievement.groupBy({
      by: ['rarity'],
      where: { userId },
      _count: {
        id: true
      }
    });
    
    const totalPoints = await prisma.achievement.aggregate({
      where: { userId },
      _sum: {
        pointsAwarded: true
      }
    });
    
    const totalAchievements = await prisma.achievement.count({
      where: { userId }
    });
    
    const availableAchievements = Object.keys(achievementDefinitions).length;
    
    res.json({
      success: true,
      data: {
        total: totalAchievements,
        available: availableAchievements,
        completion: Math.round((totalAchievements / availableAchievements) * 100),
        pointsEarned: totalPoints._sum.pointsAwarded || 0,
        byRarity: stats.reduce((acc, stat) => {
          acc[stat.rarity] = stat._count.id;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('[getAchievementStats] Błąd:', error);
    res.status(500).json({
      success: false,
      error: 'Błąd pobierania statystyk osiągnięć'
    });
  }
};

const getAllAvailableAchievements = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const userAchievements = await prisma.achievement.findMany({
      where: { userId },
      select: { name: true }
    });
    
    const unlockedNames = userAchievements.map(a => a.name);
    
    const allAchievements = Object.values(achievementDefinitions).map(def => ({
      ...def,
      unlocked: unlockedNames.includes(def.name)
    }));
    
    res.json({
      success: true,
      data: allAchievements
    });
  } catch (error) {
    console.error('[getAllAvailableAchievements] Błąd:', error);
    res.status(500).json({
      success: false,
      error: 'Błąd pobierania listy osiągnięć'
    });
  }
};

module.exports = {
  checkAndAwardAchievements,
  getUserAchievements,
  getAchievementStats,
  getAllAvailableAchievements,
  achievementDefinitions
}; 