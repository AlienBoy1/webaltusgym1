import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { FiAward, FiTrendingUp, FiTrendingDown } from 'react-icons/fi'
import { useAuthStore } from '../../store/authStore'
import api from '../../utils/api'
import TutorialHelpButton from '../../components/TutorialHelpButton'
import { TUTORIAL_IDS } from '../../tutorials/registry'
import BodyProfileCard from '../../components/body/BodyProfileCard'
import BodyProfileEditor from '../../components/body/BodyProfileEditor'
import BodyCheckInSheet from '../../components/body/BodyCheckInSheet'
import BodyCharts from '../../components/body/BodyCharts'
import BodyGoalsEditor from '../../components/body/BodyGoalsEditor'
import BodyRoutineGuide from '../../components/body/BodyRoutineGuide'
import BodyMetricExplainSheet from '../../components/body/BodyMetricExplainSheet'
import { isPaidEraLive } from '../../utils/membershipLifecycle'

export default function Progress() {
  const { user } = useAuthStore()
  const [summary, setSummary] = useState(null)
  const [charts, setCharts] = useState({
    weight: [],
    training: [],
    projection: [],
    coaching: []
  })
  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [checkInOpen, setCheckInOpen] = useState(false)
  const [explainId, setExplainId] = useState(null)
  const [goalsEditSignal, setGoalsEditSignal] = useState(0)
  const [totalBadges, setTotalBadges] = useState(0)
  const goalsRef = useRef(null)

  const units = user?.settings?.units || { weight: 'kg', height: 'cm' }
  const badges = user?.badges || []
  const xpTotal = user?.stats?.xp || 0

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sumRes, chartRes] = await Promise.all([
        api.get('/body/summary'),
        api.get('/body/charts')
      ])
      setSummary(sumRes.data)
      setCharts({
        weight: chartRes.data?.weight || [],
        training: chartRes.data?.training || [],
        projection: chartRes.data?.projection || [],
        coaching: chartRes.data?.coaching || []
      })
      setLocked(false)
    } catch (error) {
      if (error.response?.status === 403) {
        setLocked(true)
      }
      console.error('Progress body load:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    api
      .get('/users/badges/definitions')
      .then(({ data }) => setTotalBadges(Array.isArray(data) ? data.length : 0))
      .catch(() => setTotalBadges(0))
  }, [])

  const onSummarySaved = (data) => {
    setSummary(data)
    api
      .get('/body/charts')
      .then(({ data: c }) =>
        setCharts({
          weight: c?.weight || [],
          training: c?.training || [],
          projection: c?.projection || [],
          coaching: c?.coaching || []
        })
      )
      .catch(() => {})
  }

  const scrollToGoalsEdit = () => {
    setGoalsEditSignal((n) => n + 1)
    window.requestAnimationFrame(() => {
      goalsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    })
  }

  const showPremiumBanner =
    isPaidEraLive() &&
    user?.membership?.features &&
    user.membership.features.accessToBodyHealth === false

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-0 pb-24 sm:space-y-6 sm:pb-8">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl sm:text-3xl">Mi Progreso</h1>
          <TutorialHelpButton
            tutorialId={TUTORIAL_IDS.PROGRESS}
            message="Tutorial del hub: ficha, check-ins, gráficas de volumen, objetivos y guía QySi."
          />
        </div>
        <p className="text-xs text-[color:var(--text-muted)] sm:text-sm">
          Cuerpo, métricas educativas y avances · no es consejo médico
        </p>
      </header>

      {showPremiumBanner && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-100 sm:px-4 sm:py-3 sm:text-sm">
          Cuerpo y métricas está incluido en planes con esta función.
        </div>
      )}

      {locked ? (
        <div className="card py-10 text-center sm:py-12">
          <p className="mb-3 text-3xl">🔒</p>
          <p className="font-medium">Hub corporal no disponible en tu plan</p>
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">
            Renueva o actualiza tu membresía para usar métricas y guía educativa.
          </p>
        </div>
      ) : loading && !summary ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-dark-100 border-t-primary-500" />
        </div>
      ) : (
        <>
          <BodyProfileCard
            summary={summary}
            units={units}
            onEdit={() => setEditOpen(true)}
            onCheckIn={() => setCheckInOpen(true)}
            onExplain={setExplainId}
          />

          <div
            data-tour="tour-progress-stats"
            className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4"
          >
            {[
              {
                label: 'Entrenamientos',
                value: user?.stats?.totalWorkouts || 0,
                change: 'total',
                positive: true
              },
              {
                label: 'Mejor racha',
                value: `${user?.stats?.longestStreak || 0} d`,
                change: 'récord',
                positive: true
              },
              {
                label: 'Nivel',
                value: user?.stats?.level || 1,
                change: `${user?.stats?.xp || 0} XP`,
                positive: true
              },
              {
                label: 'Logros',
                value: `${badges.length}/${totalBadges || '…'}`,
                change: totalBadges ? `${Math.round((badges.length / totalBadges) * 100)}%` : '…',
                positive: true
              }
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="card !p-3 sm:!p-4"
              >
                <div className="mb-0.5 text-[11px] text-[color:var(--text-muted)] sm:text-sm">
                  {stat.label}
                </div>
                <div className="font-display text-xl sm:text-2xl">{stat.value}</div>
                <div
                  className={`mt-0.5 flex items-center gap-1 text-[11px] sm:text-sm ${
                    stat.positive ? 'text-accent-green' : 'text-red-500'
                  }`}
                >
                  {stat.positive ? <FiTrendingUp size={12} /> : <FiTrendingDown size={12} />}
                  {stat.change}
                </div>
              </motion.div>
            ))}
          </div>

          <BodyCharts
            weightSeries={charts.weight}
            trainingSeries={charts.training}
            projectionSeries={charts.projection}
            coaching={charts.coaching}
            units={units}
            onEditGoals={scrollToGoalsEdit}
          />

          <div ref={goalsRef}>
            <BodyGoalsEditor
              summary={summary}
              userStats={user?.stats}
              units={units}
              onSaved={onSummarySaved}
              forceEditSignal={goalsEditSignal}
            />
          </div>

          <BodyRoutineGuide summary={summary} />

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card"
            data-tour="tour-progress-badges"
          >
            <div className="mb-3 flex items-center gap-2 sm:mb-4">
              <FiAward className="text-accent-yellow" />
              <h2 className="font-display text-lg sm:text-xl">Logros</h2>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-6">
              {(badges.length ? badges : [{ id: 'empty', name: 'Sin logros', icon: '—' }])
                .slice(0, 12)
                .map((badge, idx) => (
                  <div
                    key={String(badge.id || badge._id || badge.name || 'badge') + '-' + idx}
                    className="rounded-xl p-2.5 text-center sm:p-3"
                    style={{ background: 'var(--bg-muted)' }}
                  >
                    <div className="mb-1 text-2xl sm:mb-2 sm:text-3xl">{badge.icon || '🏅'}</div>
                    <div className="truncate text-[10px] sm:text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {badge.name || badge.id}
                    </div>
                  </div>
                ))}
            </div>
            <p className="mt-3 text-center text-xs sm:mt-4 sm:text-sm" style={{ color: 'var(--text-muted)' }}>
              {badges.length} de {totalBadges || '…'} · XP {xpTotal}
            </p>
          </motion.div>
        </>
      )}

      <BodyProfileEditor
        open={editOpen}
        onClose={() => setEditOpen(false)}
        snapshot={summary?.snapshot}
        units={units}
        onSaved={onSummarySaved}
        onExplain={setExplainId}
      />
      <BodyCheckInSheet
        open={checkInOpen}
        onClose={() => setCheckInOpen(false)}
        units={units}
        defaultWeightKg={summary?.snapshot?.weightKg}
        onSaved={() => {
          load()
        }}
      />
      <BodyMetricExplainSheet
        open={Boolean(explainId)}
        educationId={explainId}
        onClose={() => setExplainId(null)}
      />
    </div>
  )
}
