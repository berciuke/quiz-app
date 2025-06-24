const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Question',
  },
  selectedAnswers: {
    type: [String],
    required: true,
  },
  isCorrect: {
    type: Boolean,
    required: true,
  },
  answeredAt: {
    type: Date,
    default: Date.now,
  },
});

const sessionSchema = new mongoose.Schema(
  {
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Quiz',
    },
    userId: {
      type: String,
      required: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    pausedAt: Date,
    resumedAt: Date,
    finishedAt: Date,
    status: {
      type: String,
      enum: ['in-progress', 'paused', 'finished'],
      default: 'in-progress',
    },
    currentQuestion: {
      type: Number,
      default: 0,
    },
    answers: {
      type: [answerSchema],
      default: [],
    },
    score: {
      type: Number,
      default: 0,
    },
    expiresAt: { 
      type: Date,
      // Automatyczne wygaśnięcie sesji po 24 godzinach jeśli nie zostanie zakończona
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000)
    },
  },
  { timestamps: true },
);

// Indeksy dla wydajności
sessionSchema.index({ userId: 1 });
sessionSchema.index({ quizId: 1 });
sessionSchema.index({ userId: 1, quizId: 1 });
sessionSchema.index({ status: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Session', sessionSchema); 