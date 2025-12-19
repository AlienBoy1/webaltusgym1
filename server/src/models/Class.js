import mongoose from 'mongoose'

const classSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['yoga', 'spinning', 'crossfit', 'pilates', 'boxing', 'zumba', 'hiit', 'stretching', 'other'],
    required: true
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'all_levels'],
    default: 'all_levels'
  },
  duration: {
    type: Number,
    required: true // in minutes
  },
  maxCapacity: {
    type: Number,
    required: true
  },
  enrolled: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    enrolledAt: { type: Date, default: Date.now },
    completedAt: Date
  }],
  waitlist: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    addedAt: { type: Date, default: Date.now }
  }],
  schedule: {
    dayOfWeek: { type: Number, min: 0, max: 6 }, // 0 = Sunday
    startTime: String, // "18:00"
    recurring: { type: Boolean, default: true }
  },
  specificDate: Date, // For non-recurring classes
  location: {
    type: String,
    default: 'Sala Principal'
  },
  equipment: [String],
  cancelled: {
    type: Boolean,
    default: false
  },
  cancelReason: String,
  image: String,
  createdAt: { type: Date, default: Date.now }
})

export default mongoose.model('Class', classSchema)

