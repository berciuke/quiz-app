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
    type: String,
    required: true,
    enum: ['general', 'science', 'history', 'sports', 'technology', 'entertainment', 'education']
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
  tags: [String],
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

quizSchema.index({ category: 1, difficulty: 1 });
quizSchema.index({ createdBy: 1 });
quizSchema.index({ isPublic: 1, isActive: 1 });

quizSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Quiz', quizSchema); 