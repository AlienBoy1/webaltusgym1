import mongoose from 'mongoose'

const membershipSchema = new mongoose.Schema({
  plan: {
    type: String,
    enum: ['basic', 'premium', 'elite', 'annual'],
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    required: true,
    default: 0
  },
  duration: {
    type: Number, // in days or months depending on durationUnit
    required: true,
    default: 30
  },
  durationUnit: {
    type: String,
    enum: ['days', 'months'],
    default: 'days'
  },
  benefits: [{
    type: String
  }],
  features: {
    accessToClasses: { type: Boolean, default: true },
    accessToChallenges: { type: Boolean, default: true },
    accessToSocial: { type: Boolean, default: true },
    accessToChat: { type: Boolean, default: true },
    accessToReports: { type: Boolean, default: false },
    personalTrainer: { type: Boolean, default: false },
    nutritionPlan: { type: Boolean, default: false }
  },
  active: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true })

export default mongoose.model('Membership', membershipSchema)

