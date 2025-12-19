import mongoose from 'mongoose'

const exerciseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sets: { type: Number, required: true },
  reps: { type: mongoose.Schema.Types.Mixed, required: true },
  weight: { type: Number },
  completed: { type: Boolean, default: false }
})

const workoutSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  exercises: [exerciseSchema],
  duration: Number, // in minutes
  caloriesBurned: Number,
  notes: String,
  completedAt: Date,
  createdAt: { type: Date, default: Date.now }
})

export default mongoose.model('Workout', workoutSchema)

