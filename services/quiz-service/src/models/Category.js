const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true
  },
  description: { 
    type: String,
    trim: true
  },
  parent: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category', 
    default: null 
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// name już ma unique: true więc nie potrzebuje osobnego indeksu
categorySchema.index({ parent: 1 });

module.exports = mongoose.model('Category', categorySchema); 