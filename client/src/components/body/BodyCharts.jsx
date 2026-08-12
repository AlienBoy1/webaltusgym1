import { useMemo, useState } from 'react'
import {
  AreaChart,
  Area,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts'
import { FiInfo, FiAlertCircle, FiCheckCircle, FiEdit3 } from 'react-icons/fi'
import { kgToDisplay } from '../../utils/bodyMetrics'

const tooltipStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  fontSize: 12
}

const TONE_STYLES = {
  info: 'border-white/10 bg-white/[0.03]',
  calm: 'border-amber-500/25 bg-amber-500/10',
  strategy: 'border-primary-500/25 bg-primary-500/10',
  positive: 'border-emerald-500/25 bg-emerald-500/10',
  action: 'border-cyan-500/25 bg-cyan-500/10'
}

const TONE_ICON = {
  info: FiInfo,
  calm: FiAlertCircle,
  strategy: FiInfo,
  positive: FiCheckCircle,
  action: FiEdit3
}

export default function BodyCharts({
  weightSeries = [],
  trainingSeries = [],
  projectionSeries = [],
  coaching = [],
  units,
  onEditGoals
}) {
  const [tab, setTab] = useState('weight')
  const weightUnit = units?.weight || 'kg'

  const weightData = useMemo(
    () =>
      (weightSeries || []).map((p) => ({
        date: p.date,
        weight: Number(kgToDisplay(p.weight, weightUnit)) || p.weight
      })),
    [weightSeries, weightUnit]
  )

  const trainingData = useMemo(() => {
    const proj = projectionSeries?.length ? projectionSeries : null
    if (proj) {
      return proj.map((p) => ({
        date: p.date,
        actual: p.actual,
        expected: p.expected,
        expectedLow: p.expectedLow,
        expectedHigh: p.expectedHigh,
        sessions: p.sessions,
        exercises: p.exercises,
        sets: p.sets,
        reps: p.reps,
        band: p.expectedHigh != null && p.expectedLow != null ? p.expectedHigh - p.expectedLow : null,
        projected: Boolean(p.projected)
      }))
    }
    return (trainingSeries || []).map((p) => ({
      date: p.date,
      actual: p.volumeScore,
      expected: null,
      expectedLow: null,
      expectedHigh: null,
      sessions: p.sessions,
      exercises: p.exercises,
      sets: p.sets,
      reps: p.reps
    }))
  }, [projectionSeries, trainingSeries])

  const hasTraining = (trainingSeries || []).length > 0 || trainingData.some((p) => p.actual != null)

  return (
    <div data-tour="tour-progress-charts" className="card overflow-hidden">
      <div className="mb-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-lg sm:text-xl">Evolución</h2>
          <p className="text-xs text-[color:var(--text-muted)] sm:text-sm">
            Peso corporal y volumen de entrenamientos reales
          </p>
        </div>
        <div className="flex w-full gap-1 rounded-xl bg-white/[0.04] p-1 sm:w-auto">
          {[
            { id: 'weight', label: 'Peso' },
            { id: 'training', label: 'Entrenamientos' }
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:flex-none sm:px-4 sm:text-sm ${
                tab === t.id
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'text-[color:var(--text-muted)] hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 h-56 sm:h-64 md:h-72" data-tour="tour-progress-chart-area">
        {tab === 'weight' ? (
          weightData.length === 0 ? (
            <EmptyChart message="Registra tu peso con “Registrar” para ver la evolución real." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weightData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="date" stroke="#666" fontSize={10} tickFormatter={(d) => String(d).slice(5)} />
                <YAxis
                  stroke="#666"
                  fontSize={10}
                  domain={['dataMin - 2', 'dataMax + 2']}
                  width={40}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: '#fff' }}
                  formatter={(v) => [`${v} ${weightUnit}`, 'Peso']}
                />
                <Area
                  type="monotone"
                  dataKey="weight"
                  stroke="var(--color-primary)"
                  fill="url(#weightGradient)"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          )
        ) : !hasTraining ? (
          <EmptyChart message="Completa entrenamientos: aquí verás sesiones, ejercicios, series y reps, más una proyección educativa de posibles resultados." />
        ) : (
            <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trainingData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="date" stroke="#666" fontSize={10} tickFormatter={(d) => String(d).slice(5)} />
              <YAxis stroke="#666" fontSize={10} width={36} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: '#fff' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const row = payload[0]?.payload || {}
                  return (
                    <div style={tooltipStyle} className="px-3 py-2">
                      <p className="mb-1 font-medium text-white">{label}</p>
                      {row.actual != null && (
                        <p className="text-[color:var(--text-secondary)]">Volumen real: {row.actual}</p>
                      )}
                      {row.expected != null && (
                        <p className="text-[color:var(--text-muted)]">
                          Proyección: {row.expectedLow}–{row.expectedHigh}
                        </p>
                      )}
                      {row.sessions != null && (
                        <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                          {row.sessions} sesión(es) · {row.exercises} ej. · {row.sets} series · {row.reps}{' '}
                          reps
                        </p>
                      )}
                      {row.projected && (
                        <p className="mt-1 text-[11px] text-primary-300">Horizonte educativo (sin dato real aún)</p>
                      )}
                    </div>
                  )
                }}
              />
              <Line
                type="monotone"
                dataKey="expectedLow"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={1}
                strokeDasharray="2 4"
                dot={false}
                name="Banda baja"
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="expectedHigh"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={1}
                strokeDasharray="2 4"
                dot={false}
                name="Banda alta"
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="expected"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
                name="Proyección"
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="var(--color-primary)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: 'var(--color-primary)' }}
                name="Volumen real"
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-4 space-y-2.5" data-tour="tour-progress-coaching">
        {tab !== 'training' ? (
          <p className="rounded-xl border border-white/5 bg-white/[0.03] px-3.5 py-3 text-xs leading-relaxed text-[color:var(--text-muted)] sm:text-sm">
            Cambia a <strong className="text-[color:var(--text-secondary)]">Entrenamientos</strong> para ver
            volumen real (sesiones, ejercicios, series y reps), una proyección educativa y consejos si el ritmo no
            es el esperado.
          </p>
        ) : (
          <>
            <p className="text-[11px] uppercase tracking-wide text-[color:var(--text-muted)]">
              Lectura estratégica
            </p>
            {(coaching || []).map((tip) => {
              const Icon = TONE_ICON[tip.tone] || FiInfo
              return (
                <div
                  key={tip.id}
                  className={`rounded-xl border px-3.5 py-3 ${TONE_STYLES[tip.tone] || TONE_STYLES.info}`}
                >
                  <div className="flex items-start gap-2.5">
                    <Icon className="mt-0.5 shrink-0 text-primary-300" size={16} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[color:var(--text-primary)]">{tip.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-[color:var(--text-secondary)] sm:text-sm">
                        {tip.body}
                      </p>
                      {tip.id === 'edit-goals' && onEditGoals && (
                        <button
                          type="button"
                          onClick={onEditGoals}
                          className="mt-2 text-xs font-medium text-primary-300 hover:text-primary-200"
                        >
                          Editar mis objetivos →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}

function EmptyChart({ message }) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-white/10 px-4 text-center sm:px-6">
      <div
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-full"
        style={{ background: 'rgba(var(--color-primary-rgb), 0.12)' }}
      >
        <FiInfo className="text-primary-400" size={18} />
      </div>
      <p className="max-w-sm text-xs leading-relaxed text-[color:var(--text-muted)] sm:text-sm">{message}</p>
    </div>
  )
}
