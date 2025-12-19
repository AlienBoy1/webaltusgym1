import mongoose from 'mongoose'

const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
})

const pollOptionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
})

const postSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    maxlength: 1000
  },
  images: [String],
  mood: {
    type: String,
    enum: ['happy', 'excited', 'proud', 'motivated', 'tired', 'focused', 'grateful', 'determined']
  },
  poll: {
    question: String,
    options: [pollOptionSchema],
    endsAt: Date
  },
  postType: {
    type: String,
    enum: ['text', 'image', 'poll', 'mood', 'mixed', 'badge'],
    default: 'text'
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [commentSchema],
  sharedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  },
  badgeData: {
    badgeId: String,
    badgeName: String,
    badgeIcon: String,
    earnedAt: Date
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

export default mongoose.model('Post', postSchema)
