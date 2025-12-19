import mongoose from 'mongoose'

const attendanceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  checkIn: {
    type: Date,
    required: true,
    default: Date.now
  },
  checkOut: Date,
  duration: Number // in minutes
})

// Indexes for optimized queries
attendanceSchema.index({ user: 1, checkIn: -1 })
attendanceSchema.index({ checkIn: -1 })
attendanceSchema.index({ checkIn: 1, checkOut: 1 })

export default mongoose.model('Attendance', attendanceSchema)

