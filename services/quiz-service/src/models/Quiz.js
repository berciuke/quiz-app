const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true,
    trim: true,
    maxLength: 200
  },
  description: { 
    type: String,
    trim: true,
    maxLength: 1000
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  difficulty: { 
    type: String, 
    enum: ['easy', 'medium', 'hard'], 
    default: 'medium' 
  },
  duration: { 
    type: Number, // w minutach
    min: 1,
    max: 180
  },
  isPublic: { 
    type: Boolean, 
    default: true 
  },
  isActive: {
    type: Boolean,
    default: true
  },
  language: { 
    type: String, 
    default: 'pl' 
  },
  tags: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tag'
    }
  ],
  questions: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question'
    }
  ],
  playCount: { 
    type: Number, 
    default: 0 
  },
  views: { 
    type: Number, 
    default: 0 
  },
  timeLimit: { 
    type: Number // w sekundach
  },
  passingScore: {
    type: Number,
    default: 60,
    min: 0,
    max: 100
  },
  invitedUsers: [String],
  groupAccess: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group'
    }
  ],
  // Pola dla sortowania według popularności
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  ratingCount: {
    type: Number,
    default: 0
  },
  lastPlayedAt: {
    type: Date
  },
  weeklyPlayCount: {
    type: Number,
    default: 0
  },
  monthlyPlayCount: {
    type: Number,
    default: 0
  },
  ratings: [
    {
      userId: { type: String, required: true },
      value: { type: Number, min: 1, max: 5 }
    }
  ],
  comments: [
    {
      userId: { type: String, required: true },
      username: { type: String, required: true },
      text: { type: String, required: true },
      createdAt: { type: Date, default: Date.now }
    }
  ],
  createdBy: { 
    type: String, 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Indeksy dla wyszukiwania i sortowania
quizSchema.index({ category: 1, difficulty: 1 });
quizSchema.index({ createdBy: 1 });
quizSchema.index({ isPublic: 1, isActive: 1 });
quizSchema.index({ tags: 1 });
quizSchema.index({ groupAccess: 1 });
quizSchema.index({ invitedUsers: 1 });
quizSchema.index({ title: 'text', description: 'text' });
quizSchema.index({ views: -1, playCount: -1 });
quizSchema.index({ averageRating: -1, ratingCount: -1 });
quizSchema.index({ createdAt: -1 });
quizSchema.index({ lastPlayedAt: -1 });
quizSchema.index({ weeklyPlayCount: -1 });
quizSchema.index({ monthlyPlayCount: -1 });

quizSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Metoda do obliczania średniej oceny
quizSchema.methods.calculateAverageRating = function() {
  if (this.ratings.length === 0) {
    this.averageRating = 0;
    this.ratingCount = 0;
  } else {
    const sum = this.ratings.reduce((acc, rating) => acc + rating.value, 0);
    this.averageRating = sum / this.ratings.length;
    this.ratingCount = this.ratings.length;
  }
};

module.exports = mongoose.model('Quiz', quizSchema); 