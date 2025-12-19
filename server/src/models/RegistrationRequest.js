import mongoose from 'mongoose'

const registrationRequestSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed'],
    default: 'pending'
  },
  accessCode: {
    type: String,
    default: null
  },
  accessCodeAttempts: {
    type: Number,
    default: 0
  },
  maxAttempts: {
    type: Number,
    default: 3
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  approvedAt: Date,
  completedAt: Date,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  userData: {
    name: String,
    age: Number,
    weight: Number,
    height: Number,
    phone: String,
    membershipPlan: String,
    membershipDuration: Number
  }
}, { timestamps: true })

export default mongoose.model('RegistrationRequest', registrationRequestSchema)

