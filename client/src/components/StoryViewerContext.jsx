import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import StoriesRail from './StoriesRail'

const StoryViewerContext = createContext(null)

export function StoryViewerProvider({ children }) {
  const [openUserId, setOpenUserId] = useState(null)
  const [openStoryId, setOpenStoryId] = useState(null)

  const openUserStory = useCallback((userId) => {
    if (!userId) return
    setOpenStoryId(null)
    setOpenUserId(String(userId))
  }, [])

  const openStoryById = useCallback((storyId) => {
    if (!storyId) return
    setOpenUserId(null)
    setOpenStoryId(String(storyId))
  }, [])

  const closeUserStory = useCallback(() => {
    setOpenUserId(null)
    setOpenStoryId(null)
  }, [])

  const value = useMemo(
    () => ({ openUserStory, openStoryById, closeUserStory, openUserId, openStoryId }),
    [openUserStory, openStoryById, closeUserStory, openUserId, openStoryId]
  )

  return (
    <StoryViewerContext.Provider value={value}>
      {children}
      <StoriesRail
        showRail={false}
        forceOpenUserId={openUserId}
        forceOpenStoryId={openStoryId}
        onForceClose={closeUserStory}
      />
    </StoryViewerContext.Provider>
  )
}

export function useStoryViewer() {
  const ctx = useContext(StoryViewerContext)
  if (!ctx) {
    return {
      openUserStory: () => {},
      openStoryById: () => {},
      closeUserStory: () => {},
      openUserId: null,
      openStoryId: null
    }
  }
  return ctx
}
