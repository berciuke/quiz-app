const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  text: { 
    type: String, 
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['single', 'multiple', 'boolean', 'text'],
    default: 'single'
  },
  options: [String],  
  correctAnswers: [String],  
  points: {
    type: Number,
    default: 1,
    min: 0
  },
  explanation: String,
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  category: String,
  tags: [String],
  createdBy: { 
    type: String, 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('Question', questionSchema); 