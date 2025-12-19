import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  phone: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'trainer'],
    default: 'user'
  },
  avatar: {
    type: String,
    default: null
  },
  goal: {
    type: String,
    enum: ['muscle', 'weight', 'health', 'strength'],
    default: 'health'
  },
  membership: {
    plan: { type: String, enum: ['basic', 'premium', 'elite', 'annual'], default: 'basic' },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    status: { type: String, enum: ['active', 'expiring', 'expired'], default: 'active' }
  },
  stats: {
    totalWorkouts: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    totalCaloriesBurned: { type: Number, default: 0 },
    classesCompleted: { type: Number, default: 0 },
    challengesCompleted: { type: Number, default: 0 },
    socialInteractions: { type: Number, default: 0 }
  },
  badges: [{
    id: String,
    name: String,
    icon: String,
    earnedAt: { type: Date, default: Date.now }
  }],
  settings: {
    theme: { type: String, enum: ['dark', 'light', 'system'], default: 'dark' },
    language: { type: String, default: 'es' },
    notifications: {
      push: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      workoutReminders: { type: Boolean, default: true },
      membershipAlerts: { type: Boolean, default: true },
      socialActivity: { type: Boolean, default: true },
      challenges: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false }
    },
    privacy: {
      profilePublic: { type: Boolean, default: true },
      showProgress: { type: Boolean, default: true },
      showWorkouts: { type: Boolean, default: true },
      allowMessages: { type: Boolean, default: true }
    },
    workout: {
      restTimerDefault: { type: Number, default: 60 },
      autoStartTimer: { type: Boolean, default: true },
      vibration: { type: Boolean, default: true },
      sound: { type: Boolean, default: true },
      keepScreenOn: { type: Boolean, default: true }
    },
    accessibility: {
      reducedMotion: { type: Boolean, default: false },
      highContrast: { type: Boolean, default: false },
      fontSize: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' },
      voiceControl: { type: Boolean, default: false }
    },
    units: {
      weight: { type: String, enum: ['kg', 'lb'], default: 'kg' },
      distance: { type: String, enum: ['km', 'mi'], default: 'km' },
      height: { type: String, enum: ['cm', 'ft'], default: 'cm' }
    }
  },
  profile: {
    bio: { type: String, maxlength: 500 },
    birthDate: Date,
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_say'] },
    height: Number,
    weight: Number,
    targetWeight: Number,
    bodyFat: Number,
    fitnessLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'elite'], default: 'beginner' }
  },
  social: {
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    followRequests: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      requestedAt: { type: Date, default: Date.now }
    }],
    pendingRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  twoFactorSecret: String,
  twoFactorEnabled: { type: Boolean, default: false },
  pushSubscription: Object,
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: String,
  passwordResetToken: String,
  passwordResetExpires: Date,
  lastLogin: Date,
  onboardingCompleted: { type: Boolean, default: false },
  settings: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password)
}

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject()
  delete user.password
  delete user.twoFactorSecret
  delete user.emailVerificationToken
  delete user.passwordResetToken
  return user
}

// Static method to check if first user (for auto-admin)
userSchema.statics.isFirstUser = async function() {
  const count = await this.countDocuments()
  return count === 0
}

export default mongoose.model('User', userSchema)
