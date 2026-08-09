import express from 'express'
import { authenticate } from '../middleware/auth.js'
import {
  adoptQiSiRoutine,
  ensureQiSiSystem,
  getQiSiProfileMapped,
  listQiSiCatalogRoutines
} from '../services/qisiService.js'
import { QISI_VARIANTS, getQiSiLevelGuide } from '../data/qisiCatalog.js'
import { QISI_HANDLE, QISI_MEANING, QISI_NAME, QISI_TAGLINE, QISI_USERNAME } from '../utils/qisi.js'

const router = express.Router()

/** Ensure QySi exists + launch story; return public profile identity. */
router.get('/me', authenticate, async (req, res) => {
  try {
    const profile = await getQiSiProfileMapped()
    res.json({
      profile,
      meta: {
        name: QISI_NAME,
        username: QISI_USERNAME,
        handle: QISI_HANDLE,
        meaning: QISI_MEANING,
        tagline: QISI_TAGLINE
      }
    })
  } catch (error) {
    console.error('QySi me error:', error)
    res.status(500).json({ message: 'No se pudo cargar QySi', error: error.message })
  }
})

/** Warm seed (idempotent). */
router.post('/ensure', authenticate, async (req, res) => {
  try {
    const profile = await ensureQiSiSystem()
    res.json({ ok: true, profile })
  } catch (error) {
    console.error('QySi ensure error:', error)
    res.status(500).json({ message: 'No se pudo inicializar QySi', error: error.message })
  }
})

router.get('/catalog', authenticate, async (req, res) => {
  try {
    const routines = await listQiSiCatalogRoutines()
    res.json({
      variants: QISI_VARIANTS.map((v) => ({
        id: v.id,
        name: v.name,
        shortName: v.shortName,
        emoji: v.emoji,
        color: v.color,
        description: v.description,
        programs: v.programs.map((p) => ({
          id: p.id,
          name: p.name,
          subtitle: p.subtitle,
          levels: p.levels.map((l) => ({
            id: l.id,
            name: l.name,
            durationMin: l.durationMin,
            restNote: l.restNote,
            notes: l.notes,
            exerciseCount: (l.exercises || []).length
          }))
        }))
      })),
      levelGuide: getQiSiLevelGuide(),
      routines
    })
  } catch (error) {
    console.error('QySi catalog error:', error)
    res.status(500).json({ message: 'No se pudo cargar el catálogo QySi', error: error.message })
  }
})

router.post('/adopt/:catalogId', authenticate, async (req, res) => {
  try {
    const adopted = await adoptQiSiRoutine(req.user.id, req.params.catalogId)
    res.status(201).json(adopted)
  } catch (error) {
    const status = error.status || 500
    if (status === 409) {
      return res.status(409).json({
        code: error.code || 'ALREADY_ADOPTED',
        message: error.message,
        existingId: error.existingId
      })
    }
    if (status === 404) {
      return res.status(404).json({ message: error.message })
    }
    console.error('QySi adopt error:', error)
    res.status(500).json({ message: 'No se pudo adoptar la rutina de QySi', error: error.message })
  }
})

export default router
