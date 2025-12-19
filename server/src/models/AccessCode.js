import mongoose from 'mongoose'

const accessCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  registrationRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RegistrationRequest',
    required: true
  },
  used: {
    type: Boolean,
    default: false
  },
  usedAt: Date,
  usedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true })

export default mongoose.model('AccessCode', accessCodeSchema)

