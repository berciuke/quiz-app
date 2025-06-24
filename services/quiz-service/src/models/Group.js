const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxLength: 100
  },
  description: {
    type: String,
    trim: true,
    maxLength: 500
  },
  createdBy: { 
    type: String, 
    required: true 
  },
  members: [
    {
      userId: { type: String, required: true },
      role: { type: String, enum: ['admin', 'member'], default: 'member' },
      joinedAt: { type: Date, default: Date.now }
    }
  ],
  isPublic: {
    type: Boolean,
    default: false
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

// Indeksy
groupSchema.index({ createdBy: 1 });
groupSchema.index({ 'members.userId': 1 });
groupSchema.index({ name: 'text', description: 'text' });

groupSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Group', groupSchema); 