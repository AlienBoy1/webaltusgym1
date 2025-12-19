import { openDB } from 'idb'

const DB_NAME = 'altus-gym-db'
const DB_VERSION = 1

export const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Workouts store
      if (!db.objectStoreNames.contains('workouts')) {
        const workoutStore = db.createObjectStore('workouts', { keyPath: 'id', autoIncrement: true })
        workoutStore.createIndex('date', 'date')
        workoutStore.createIndex('synced', 'synced')
      }
      
      // Posts store (for offline social)
      if (!db.objectStoreNames.contains('posts')) {
        const postStore = db.createObjectStore('posts', { keyPath: 'id', autoIncrement: true })
        postStore.createIndex('synced', 'synced')
      }
      
      // User data cache
      if (!db.objectStoreNames.contains('userData')) {
        db.createObjectStore('userData', { keyPath: 'key' })
      }
    }
  })
}

export const saveWorkoutOffline = async (workout) => {
  const db = await initDB()
  return db.add('workouts', { ...workout, synced: false, date: new Date().toISOString() })
}

export const getUnsyncedWorkouts = async () => {
  const db = await initDB()
  return db.getAllFromIndex('workouts', 'synced', false)
}

export const markWorkoutSynced = async (id) => {
  const db = await initDB()
  const workout = await db.get('workouts', id)
  if (workout) {
    workout.synced = true
    return db.put('workouts', workout)
  }
}

export const cacheUserData = async (key, data) => {
  const db = await initDB()
  return db.put('userData', { key, data, timestamp: Date.now() })
}

export const getCachedUserData = async (key) => {
  const db = await initDB()
  return db.get('userData', key)
}

