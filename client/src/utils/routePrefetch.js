/** Prefetch lazy route chunks on hover/focus so navigation feels instant. */
const loaders = {
  '/dashboard': () => import('../pages/user/Dashboard'),
  '/social': () => import('../pages/user/Social'),
  '/workouts': () => import('../pages/user/Workouts'),
  '/progress': () => import('../pages/user/Progress'),
  '/profile': () => import('../pages/user/Profile'),
  '/classes': () => import('../pages/user/Classes'),
  '/challenges': () => import('../pages/user/Challenges'),
  '/chat': () => import('../pages/user/Chat'),
  '/settings': () => import('../pages/user/Settings'),
  '/notifications': () => import('../pages/user/Notifications'),
  '/explore-routines': () => import('../pages/user/ExploreRoutines'),
  '/my-workouts': () => import('../pages/user/MyWorkouts'),
  '/my-challenges': () => import('../pages/user/MyChallenges')
}

const warmed = new Set()

export function prefetchRoute(path) {
  if (!path || warmed.has(path)) return
  const loader = loaders[path]
  if (!loader) return
  warmed.add(path)
  loader().catch(() => {
    warmed.delete(path)
  })
}
