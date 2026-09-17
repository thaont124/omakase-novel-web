const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  coverUrl: {
    type: String,
    required: true,
    default: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=400&q=80'
  },
  author: {
    type: String,
    default: 'Tác giả Omakase'
  },
  status: {
    type: String,
    enum: ['Đang tiến hành', 'Hoàn thành', 'Tạm ngưng'],
    default: 'Đang tiến hành'
  },
  genres: [{
    type: String
  }],
  description: {
    type: String,
    default: ''
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  views: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: String,
    default: 'admin'
  },
  updatedBy: {
    type: String,
    default: 'admin'
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

module.exports = mongoose.model('Story', storySchema);
