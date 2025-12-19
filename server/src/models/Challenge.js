import mongoose from 'mongoose'

const challengeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: String,
  type: {
    type: String,
    enum: ['workouts', 'streak', 'calories', 'distance', 'weight_lifted', 'social', 'custom'],
    required: true
  },
  goal: {
    type: Number,
    required: true
  },
  unit: String,
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  participants: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    progress: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    completedAt: Date,
    joinedAt: { type: Date, default: Date.now }
  }],
  reward: {
    xp: { type: Number, default: 100 },
    badge: {
      id: String,
      name: String,
      icon: String
    }
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  image: String,
  featured: {
    type: Boolean,
    default: false
  },
  createdAt: { type: Date, default: Date.now }
})

export default mongoose.model('Challenge', challengeSchema)

