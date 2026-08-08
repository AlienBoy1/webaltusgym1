/** Map DB rows to API shapes compatible with the existing frontend (_id aliases). */

export function mapProfile(row) {
  if (!row) return null
  return {
    _id: row.id,
    id: row.id,
    name: row.name,
    username: row.username || null,
    email: row.email,
    phone: row.phone,
    role: row.role,
    avatar: row.avatar,
    goal: row.goal,
    membership: row.membership || {},
    stats: row.stats || {},
    badges: row.badges || [],
    settings: row.settings || {},
    profile: row.profile || {},
    pushSubscription: row.push_subscription,
    onboardingCompleted: row.onboarding_completed,
    mustResetPassword: row.must_reset_password,
    lastLogin: row.last_login,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    social: row.social || { followers: [], following: [], followRequests: [], pendingRequests: [] }
  }
}

export function mapWorkout(row) {
  if (!row) return null
  let metrics = row.metrics || {}
  if ((!metrics || !Object.keys(metrics).length) && row.notes) {
    try {
      const parsed = JSON.parse(row.notes)
      if (parsed?.metrics) metrics = parsed.metrics
    } catch {
      /* plain notes */
    }
  }
  return {
    _id: row.id,
    id: row.id,
    user: row.user_id,
    name: row.name,
    exercises: row.exercises || [],
    duration: row.duration,
    caloriesBurned: row.calories_burned,
    notes: row.notes,
    metrics,
    completedAt: row.completed_at,
    createdAt: row.created_at
  }
}

export function mapPost(row, extras = {}) {
  if (!row) return null
  return {
    _id: row.id,
    id: row.id,
    user: extras.user || row.user_id,
    content: row.content,
    images: row.images || [],
    mood: row.mood,
    poll: row.poll,
    postType: row.post_type,
    badgeData: row.badge_data,
    workoutData: row.workout_data || extras.workoutData || null,
    sharedFrom: row.shared_from,
    likes: extras.likes || [],
    comments: extras.comments || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function mapStory(row, extras = {}) {
  if (!row) return null
  return {
    _id: row.id,
    id: row.id,
    user: extras.user || row.user_id,
    mediaType: row.media_type,
    mediaUrl: row.media_url,
    caption: row.caption || '',
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    reactions: extras.reactions || [],
    reactionCounts: extras.reactionCounts || {},
    myReaction: extras.myReaction || null,
    viewCount: extras.viewCount || 0,
    viewed: Boolean(extras.viewed)
  }
}

export function mapMessage(row) {
  if (!row) return null
  return {
    _id: row.id,
    id: row.id,
    from: row.from_user_id,
    to: row.to_user_id,
    content: row.content,
    read: row.read,
    createdAt: row.created_at
  }
}

export function mapNotification(row) {
  if (!row) return null
  return {
    _id: row.id,
    id: row.id,
    user: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    icon: row.icon,
    priority: row.priority,
    relatedUser: row.related_user_id,
    relatedData: row.related_data,
    read: row.read,
    pushed: row.pushed,
    createdAt: row.created_at
  }
}

export function mapClass(row, extras = {}) {
  if (!row) return null
  return {
    _id: row.id,
    id: row.id,
    name: row.name,
    description: row.description,
    instructor: extras.instructor || row.instructor_id,
    type: row.type,
    capacity: row.capacity,
    duration: row.duration,
    image: row.image,
    equipment: row.equipment || [],
    schedule: row.schedule || {},
    enrolled: extras.enrolled || [],
    waitlist: extras.waitlist || [],
    createdAt: row.created_at
  }
}

export function mapChallenge(row, extras = {}) {
  if (!row) return null
  const reward = row.reward || {}
  const goalMode = row.goal_mode || reward.goalMode || 'quantity'
  return {
    _id: row.id,
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type,
    goal: row.goal,
    unit: row.unit,
    goalMode,
    image: row.image,
    startDate: row.start_date,
    endDate: row.end_date,
    reward,
    createdBy: row.created_by,
    participants: extras.participants || [],
    createdAt: row.created_at
  }
}

export async function attachSocial(supabase, profileRow) {
  const userId = profileRow.id
  const [{ data: following }, { data: followers }, { data: outgoing }, { data: incoming }] = await Promise.all([
    supabase.from('follows').select('following_id').eq('follower_id', userId),
    supabase.from('follows').select('follower_id').eq('following_id', userId),
    supabase.from('follow_requests').select('to_user_id, created_at').eq('from_user_id', userId),
    supabase.from('follow_requests').select('from_user_id, created_at, id').eq('to_user_id', userId)
  ])

  return {
    ...profileRow,
    social: {
      following: (following || []).map((f) => f.following_id),
      followers: (followers || []).map((f) => f.follower_id),
      pendingRequests: (outgoing || []).map((f) => f.to_user_id),
      followRequests: (incoming || []).map((f) => ({
        user: f.from_user_id,
        requestedAt: f.created_at,
        _id: f.id
      }))
    }
  }
}
