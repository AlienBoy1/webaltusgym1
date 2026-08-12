import { motion } from 'framer-motion'
import { FiZap, FiChevronRight } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { openQySiAssistant } from '../QySiAssistant'

const REASON_COPY = {
  strength_or_gain: 'Priorizamos fuerza y compuestos del catálogo QySi.',
  weight_management: 'Mezcla de fuerza y opciones con más gasto (gimnasio, casa o running).',
  general_health: 'Enfoque equilibrado y sostenible para salud general.',
  balanced: 'Ruta equilibrada según tu ficha.',
  focus_muscle: 'Contexto de IMC bajo: prioriza ganar músculo con técnica sólida.'
}

export default function BodyRoutineGuide({ summary }) {
  const navigate = useNavigate()
  const tips = summary?.tips || []
  const hints = summary?.qysiHints || null

  const openQySi = () => {
    openQySiAssistant(hints)
    navigate('/workouts?qysi=1')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      data-tour="tour-progress-guide"
      className="card space-y-4"
    >
      <div>
        <h2 className="font-display text-xl flex items-center gap-2">
          <FiZap className="text-accent-cyan" /> Guía de rutina
        </h2>
        <p className="text-sm text-[color:var(--text-muted)]">
          Tips según tu ficha · recomendaciones del catálogo QySi
        </p>
      </div>

      <div className="space-y-3">
        {tips
          .filter((t) => t.id !== 'disclaimer')
          .map((tip) => (
            <div key={tip.id} className="rounded-xl border border-white/5 bg-white/[0.03] px-3.5 py-3">
              <p className="text-sm font-semibold text-primary-300">{tip.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-[color:var(--text-secondary)]">{tip.body}</p>
            </div>
          ))}
      </div>

      {hints && (
        <div className="rounded-xl border border-primary-500/25 bg-primary-500/10 px-3.5 py-3">
          <p className="text-sm font-medium text-primary-200">Sugerencia QySi</p>
          <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
            Nivel: <strong>{hints.suggestedLevelId}</strong>
            {hints.preferredVariants?.length
              ? ` · Variantes: ${hints.preferredVariants.join(', ')}`
              : ''}
          </p>
          <ul className="mt-2 space-y-1 text-xs text-[color:var(--text-muted)]">
            {(hints.reasonKeys || []).map((k) => (
              <li key={k}>· {REASON_COPY[k] || k}</li>
            ))}
          </ul>
        </div>
      )}

      <button type="button" onClick={openQySi} className="btn-primary flex w-full items-center justify-center gap-2">
        Ver sugerencias en QySi <FiChevronRight size={18} />
      </button>

      <p className="text-xs leading-relaxed text-[color:var(--text-muted)]">
        Contenido educativo. No sustituye valoración médica ni de un entrenador certificado.
      </p>
    </motion.div>
  )
}
