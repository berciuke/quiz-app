const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId: {
    type: Number,
    required: true,
    index: true
  },
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'paused', 'abandoned'],
    default: 'in-progress'
  },
  startedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  completedAt: {
    type: Date
  },
  pausedAt: {
    type: Date
  },
  timeSpent: {
    type: Number, // w sekundach
    default: 0
  },
  currentQuestionIndex: {
    type: Number,
    default: 0
  },
  answers: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true
    },
    selectedAnswers: [String],
    isCorrect: {
      type: Boolean,
      required: true
    },
    pointsAwarded: {
      type: Number,
      default: 0
    },
    timeSpent: {
      type: Number, // czas na odpowiedź w sekundach
      default: 0
    },
    answeredAt: {
      type: Date,
      default: Date.now
    }
  }],
  score: {
    type: Number,
    default: 0
  },
  maxScore: {
    type: Number,
    default: 0
  },
  accuracy: {
    type: Number, // procent poprawnych odpowiedzi
    default: 0
  },
  bonusPoints: {
    type: Number,
    default: 0
  },
  // Dla osiągnięć
  perfectScore: {
    type: Boolean,
    default: false
  },
  speedBonus: {
    type: Boolean,
    default: false
  },
  firstAttempt: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indeksy dla wydajności
sessionSchema.index({ userId: 1, status: 1 });
sessionSchema.index({ quizId: 1, status: 1 });
sessionSchema.index({ completedAt: -1 });
sessionSchema.index({ score: -1 });
sessionSchema.index({ userId: 1, completedAt: -1 });

// Metody instancji
sessionSchema.methods.calculateScore = function() {
  this.score = this.answers.reduce((total, answer) => total + answer.pointsAwarded, 0);
  
  if (this.answers.length > 0) {
    const correctAnswers = this.answers.filter(answer => answer.isCorrect).length;
    this.accuracy = (correctAnswers / this.answers.length) * 100;
    this.perfectScore = this.accuracy === 100;
  }
  
  return this.score;
};

sessionSchema.methods.addAnswer = function(questionId, selectedAnswers, isCorrect, points, timeSpent) {
  this.answers.push({
    questionId,
    selectedAnswers,
    isCorrect,
    pointsAwarded: points,
    timeSpent,
    answeredAt: new Date()
  });
  
  this.calculateScore();
  this.currentQuestionIndex++;
};

sessionSchema.methods.pause = function() {
  this.status = 'paused';
  this.pausedAt = new Date();
};

sessionSchema.methods.resume = function() {
  this.status = 'in-progress';
  this.pausedAt = null;
};

sessionSchema.methods.complete = function() {
  this.status = 'completed';
  this.completedAt = new Date();
  this.timeSpent = Math.floor((this.completedAt - this.startedAt) / 1000);
  this.calculateScore();
  
  // Sprawdź speed bonus (jeśli ukończony szybciej niż średni czas)
  const avgTimePerQuestion = 30; // sekund
  const expectedTime = this.answers.length * avgTimePerQuestion;
  this.speedBonus = this.timeSpent < expectedTime * 0.75; // 25% szybciej
};

sessionSchema.methods.abandon = function() {
  this.status = 'abandoned';
  this.completedAt = new Date();
  this.timeSpent = Math.floor((this.completedAt - this.startedAt) / 1000);
};

// Metody statyczne
sessionSchema.statics.getUserStats = function(userId) {
  return this.aggregate([
    {
      $match: { 
        userId: userId,
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$userId',
        totalQuizzes: { $sum: 1 },
        totalScore: { $sum: '$score' },
        averageScore: { $avg: '$score' },
        averageAccuracy: { $avg: '$accuracy' },
        totalTimeSpent: { $sum: '$timeSpent' },
        perfectScores: { 
          $sum: { $cond: ['$perfectScore', 1, 0] }
        },
        speedBonuses: {
          $sum: { $cond: ['$speedBonus', 1, 0] }
        }
      }
    }
  ]);
};

sessionSchema.statics.getCategoryStats = function(userId, category) {
  return this.aggregate([
    {
      $lookup: {
        from: 'quizzes',
        localField: 'quizId',
        foreignField: '_id',
        as: 'quiz'
      }
    },
    {
      $unwind: '$quiz'
    },
    {
      $lookup: {
        from: 'categories',
        localField: 'quiz.category',
        foreignField: '_id',
        as: 'categoryInfo'
      }
    },
    {
      $unwind: '$categoryInfo'
    },
    {
      $match: {
        userId: userId,
        status: 'completed',
        'categoryInfo.name': category
      }
    },
    {
      $group: {
        _id: '$categoryInfo.name',
        totalQuizzes: { $sum: 1 },
        averageScore: { $avg: '$score' },
        bestScore: { $max: '$score' },
        totalTimeSpent: { $sum: '$timeSpent' },
        averageAccuracy: { $avg: '$accuracy' }
      }
    }
  ]);
};

module.exports = mongoose.model('Session', sessionSchema); 