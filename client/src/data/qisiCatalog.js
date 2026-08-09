/**
 * QySi default catalog — 5 variantes × focos × niveles.
 * Shared shape for client UI and server seed.
 */

/** Stable ids for seed/adopt. */
let _seq = 0
function ex(name, sets, reps) {
  _seq += 1
  return { id: `qisi-ex-${_seq}`, name, sets, reps }
}

function level(id, name, durationMin, restNote, exercises, notes = '') {
  return { id, name, durationMin, restNote, exercises, notes }
}

export const QISI_VARIANTS = [
  {
    id: 'gym',
    name: 'En Gimnasio',
    shortName: 'Gimnasio',
    emoji: '🏋️',
    color: 'primary',
    description: 'Uso de máquinas y pesas libres',
    programs: [
      {
        id: 'upper',
        name: 'Tren Superior',
        subtitle: 'Pecho, Espalda, Hombros, Brazos',
        levels: [
          level(
            'beginner',
            'Principiante',
            40,
            'Descanso: 90s entre series',
            [
              ex('Press de banca en máquina', 3, 12),
              ex('Jalón al pecho en polea', 3, 12),
              ex('Press militar con mancuernas', 3, 10),
              ex('Curl de bíceps en polea', 3, 12)
            ]
          ),
          level(
            'intermediate',
            'Intermedio',
            55,
            'Descanso: 60s entre series',
            [
              ex('Press de banca con barra', 4, 10),
              ex('Remo con barra', 4, 10),
              ex('Elevaciones laterales con mancuernas', 4, 12),
              ex('Curl de bíceps con barra', 4, 10),
              ex('Extensión de tríceps en polea', 4, 12)
            ]
          ),
          level(
            'advanced',
            'Avanzado',
            75,
            'Descanso: 45s entre series',
            [
              ex('Press de banca inclinado', 5, 8),
              ex('Dominadas lastradas', 5, 8),
              ex('Press militar con barra de pie', 5, 8),
              ex('Superserie: Curl de bíceps inclinado', 4, 10),
              ex('Superserie: Rompecráneos con barra EZ', 4, 10)
            ]
          )
        ]
      },
      {
        id: 'lower',
        name: 'Tren Inferior',
        subtitle: 'Piernas y Glúteos',
        levels: [
          level(
            'beginner',
            'Principiante',
            40,
            'Descanso: 90s entre series',
            [
              ex('Prensa de piernas', 3, 12),
              ex('Extensión de cuádriceps en máquina', 3, 12),
              ex('Curl femoral acostado', 3, 12),
              ex('Elevación de talones sentado', 3, 15)
            ]
          ),
          level(
            'intermediate',
            'Intermedio',
            55,
            'Descanso: 60s entre series',
            [
              ex('Sentadilla libre con barra', 4, 10),
              ex('Peso muerto rumano', 4, 10),
              ex('Zancadas con mancuernas (por pierna)', 4, 12),
              ex('Elevación de talones de pie', 4, 15)
            ]
          ),
          level(
            'advanced',
            'Avanzado',
            75,
            'Descanso: 60s entre series',
            [
              ex('Sentadilla búlgara con mancuernas pesadas', 5, 8),
              ex('Peso muerto convencional', 5, 5),
              ex('Hip thrust con barra', 5, 10),
              ex('Superserie: Extensión de cuádriceps', 4, 12),
              ex('Superserie: Curl femoral', 4, 12)
            ]
          )
        ]
      },
      {
        id: 'core',
        name: 'Core',
        subtitle: 'Abdomen y Zona Lumbar',
        levels: [
          level(
            'beginner',
            'Principiante',
            20,
            'Descanso: 60s entre series',
            [
              ex('Crunch abdominal clásico', 3, 15),
              ex('Plancha frontal estática', 3, '30s'),
              ex('Hiperextensiones lumbares', 3, 12)
            ]
          ),
          level(
            'intermediate',
            'Intermedio',
            30,
            'Descanso: 45s entre series',
            [
              ex('Elevación de piernas colgado en barra', 4, 12),
              ex('Plancha lateral (por lado)', 4, '45s'),
              ex('Rueda abdominal con rodillas apoyadas', 4, 10)
            ]
          ),
          level(
            'advanced',
            'Avanzado',
            40,
            'Descanso: 30s entre series',
            [
              ex('Toes to bar (Pies a la barra)', 5, 12),
              ex('Rueda abdominal estricta desde los pies', 5, 10),
              ex('Bandera humana (progresiones isométricas)', 5, '20s')
            ]
          )
        ]
      }
    ]
  },
  {
    id: 'home',
    name: 'En Casa',
    shortName: 'Casa',
    emoji: '🏠',
    color: 'cyan',
    description: 'Sin equipo o equipo básico (botellas / mochila)',
    programs: [
      {
        id: 'upper',
        name: 'Tren Superior',
        subtitle: 'Peso corporal y objetos cotidianos',
        levels: [
          level(
            'beginner',
            'Principiante',
            30,
            'Descanso: 60s entre series',
            [
              ex('Flexiones de pecho con rodillas apoyadas', 3, 10),
              ex('Remo con botellas de agua o mochila', 3, 15),
              ex('Elevaciones laterales con botellas', 3, 12)
            ]
          ),
          level(
            'intermediate',
            'Intermedio',
            45,
            'Descanso: 45s entre series',
            [
              ex('Flexiones de pecho clásicas', 4, 12),
              ex('Flexiones diamante (enfoque tríceps)', 4, 10),
              ex('Dominadas en marco de puerta o remo invertido', 4, 10)
            ]
          ),
          level(
            'advanced',
            'Avanzado',
            60,
            'Descanso: 45s entre series',
            [
              ex('Flexiones declinadas con pies en una silla', 5, 15),
              ex('Flexiones haciendo el pino contra la pared', 5, 8),
              ex('Dominadas explosivas o flexiones a una mano asistidas', 5, 8)
            ]
          )
        ]
      },
      {
        id: 'lower',
        name: 'Tren Inferior',
        subtitle: 'Piernas y glúteos en casa',
        levels: [
          level(
            'beginner',
            'Principiante',
            30,
            'Descanso: 60s entre series',
            [
              ex('Sentadillas al aire (peso corporal)', 3, 15),
              ex('Puente de glúteo en el suelo', 3, 15),
              ex('Zancadas estáticas (por pierna)', 3, 10)
            ]
          ),
          level(
            'intermediate',
            'Intermedio',
            45,
            'Descanso: 45s entre series',
            [
              ex('Sentadillas con salto', 4, 15),
              ex('Zancadas caminando por el pasillo (por pierna)', 4, 12),
              ex('Puente de glúteo a una pierna', 4, 12),
              ex('Elevación de gemelo en el borde de un escalón', 4, 20)
            ]
          ),
          level(
            'advanced',
            'Avanzado',
            60,
            'Descanso: 45s entre series',
            [
              ex('Pistol squats (asistida, por pierna)', 5, 8),
              ex('Sentadilla búlgara con salto', 5, 10),
              ex('Saltos al cajón o a una silla firme', 5, 12)
            ]
          )
        ]
      },
      {
        id: 'core',
        name: 'Core',
        subtitle: 'Abdomen en casa',
        levels: [
          level(
            'beginner',
            'Principiante',
            20,
            'Descanso: 60s entre series',
            [
              ex('Abdominales mariposa', 3, 15),
              ex('Toques a los talones alternos', 3, 20),
              ex('Plancha estática en antebrazos', 3, '30s')
            ]
          ),
          level(
            'intermediate',
            'Intermedio',
            30,
            'Descanso: 45s entre series',
            [
              ex('Bicicletas abdominales (toques totales)', 4, 40),
              ex('Tijeras verticales acostado', 4, '30s'),
              ex('Plancha con toque de hombros', 4, 20)
            ]
          ),
          level(
            'advanced',
            'Avanzado',
            40,
            'Descanso: 30s entre series',
            [
              ex('V-ups (Abdominales en V)', 5, 15),
              ex('Hollow body hold (posición canoa)', 5, '45s'),
              ex('Plancha dinámica (codos a manos)', 5, 20)
            ]
          )
        ]
      }
    ]
  },
  {
    id: 'calisthenics',
    name: 'Calistenia',
    shortName: 'Calistenia',
    emoji: '🤸',
    color: 'purple',
    description: 'Control del peso corporal en barras / parques',
    programs: [
      {
        id: 'upper',
        name: 'Tren Superior',
        subtitle: 'Barras y fuerza relativa',
        levels: [
          level(
            'beginner',
            'Principiante',
            40,
            'Descanso: 90s entre series',
            [
              ex('Dominadas australianas (remo en barra baja)', 3, 10),
              ex('Flexiones inclinadas (manos en banco)', 3, 12),
              ex('Fondos en banco tríceps', 3, 10)
            ]
          ),
          level(
            'intermediate',
            'Intermedio',
            55,
            'Descanso: 60s entre series',
            [
              ex('Dominadas pronas estrictas', 4, 8),
              ex('Fondos en barras paralelas', 4, 10),
              ex('Flexiones explosivas con palmada', 4, 10),
              ex('Muscle-up asistido con banda elástica', 4, 5)
            ]
          ),
          level(
            'advanced',
            'Avanzado',
            75,
            'Descanso: 90s entre series',
            [
              ex('Muscle-ups estrictos sin impulso', 5, 5),
              ex('Front lever (isometría)', 5, '15s'),
              ex('Flexiones en pino libres (sin pared)', 5, 8),
              ex('Dominadas a una mano asistidas', 5, 5)
            ]
          )
        ]
      },
      {
        id: 'lower',
        name: 'Tren Inferior',
        subtitle: 'Piernas y unilateral',
        levels: [
          level(
            'beginner',
            'Principiante',
            40,
            'Descanso: 60s entre series',
            [
              ex('Sentadillas profundas', 3, 15),
              ex('Zancadas búlgaras en banco bajo del parque (por pierna)', 3, 10),
              ex('Elevación de gemelos en el suelo', 3, 20)
            ]
          ),
          level(
            'intermediate',
            'Intermedio',
            55,
            'Descanso: 60s entre series',
            [
              ex('Sentadilla del patinador / Skater squat (por pierna)', 4, 8),
              ex('Zancadas con salto alterno (totales)', 4, 20),
              ex('Curl nórdico reteniendo la caída', 4, 5)
            ]
          ),
          level(
            'advanced',
            'Avanzado',
            70,
            'Descanso: 60s entre series',
            [
              ex('Pistol squats sin asistencia (por pierna)', 5, 10),
              ex('Curl nórdico completo', 5, 6),
              ex('Saltos explosivos de rodillas a pies', 5, 8)
            ]
          )
        ]
      },
      {
        id: 'core',
        name: 'Core',
        subtitle: 'Tensión integral',
        levels: [
          level(
            'beginner',
            'Principiante',
            30,
            'Descanso: 60s entre series',
            [
              ex('L-sit en el suelo con piernas encogidas', 3, '15s'),
              ex('Plancha hollow', 3, '30s'),
              ex('Elevación de rodillas colgado de la barra', 3, 10)
            ]
          ),
          level(
            'intermediate',
            'Intermedio',
            45,
            'Descanso: 60s entre series',
            [
              ex('L-sit estricto en paralelas', 4, '15s'),
              ex('Dragon flag (solo bajada lenta)', 4, 5),
              ex('Elevación de pies a la barra rectos', 4, 10)
            ]
          ),
          level(
            'advanced',
            'Avanzado',
            60,
            'Descanso: 90s entre series',
            [
              ex('Front lever estricto', 5, '10s'),
              ex('Dragon flag completo', 5, 8),
              ex('Press to handstand (desde L-sit)', 5, 3)
            ]
          )
        ]
      }
    ]
  },
  {
    id: 'running',
    name: 'Running',
    shortName: 'Running',
    emoji: '🏃',
    color: 'green',
    description: 'Sistemas de energía y mecánica de piernas',
    programs: [
      {
        id: 'speed',
        name: 'Velocidad y Explosividad',
        subtitle: 'Fuerza de piernas y potencia',
        levels: [
          level(
            'beginner',
            'Principiante',
            30,
            'Descanso entre sprints: 90s caminando',
            [
              ex('Trote de calentamiento', 1, '10 min'),
              ex('Sprints cortos 50m al 80%', 6, '50m'),
              ex('Trote suave de recuperación', 1, '10 min')
            ]
          ),
          level(
            'intermediate',
            'Intermedio',
            45,
            'Descanso entre series: 2 min trote muy suave',
            [
              ex('Calentamiento', 1, '10 min'),
              ex('Series 400m al 90%', 6, '400m'),
              ex('Trote de recuperación', 1, '10 min')
            ]
          ),
          level(
            'advanced',
            'Avanzado',
            60,
            'Descanso entre sprints: 3 min caminando',
            [
              ex('Calentamiento', 1, '10 min'),
              ex('Sprints de 100m al 100%', 10, '100m'),
              ex('Multisaltos pliométricos en pista', 5, '20m')
            ]
          )
        ]
      },
      {
        id: 'endurance',
        name: 'Resistencia Cardiovascular',
        subtitle: 'Fondo y oxidación de grasas',
        levels: [
          level(
            'beginner',
            'Principiante',
            40,
            'Ritmo conversacional, sin descanso intermedio',
            [
              ex('Método CaCo: caminar ágil', 4, '5 min'),
              ex('Método CaCo: correr muy suave', 4, '5 min')
            ],
            'Repetir el bloque caminar-correr 4 veces.'
          ),
          level(
            'intermediate',
            'Intermedio',
            60,
            'Sin detenerse',
            [ex('Carrera continua ritmo moderado (Zona 3)', 1, '10 km')]
          ),
          level(
            'advanced',
            'Avanzado',
            90,
            'Sin descansos',
            [
              ex('Tirada larga Zona 2 (primeros km)', 1, '10 km'),
              ex('Ritmo competición Zona 4 (km finales)', 1, '5-10 km')
            ],
            'Tirada de 15 a 20 km en total.'
          )
        ]
      },
      {
        id: 'strength',
        name: 'Fuerza Específica',
        subtitle: 'Cuestas y estabilidad en carrera',
        levels: [
          level(
            'beginner',
            'Principiante',
            35,
            'Al terminar el bloque de carrera',
            [
              ex('Carrera continua en terreno ondulado', 1, '20 min'),
              ex('Planchas', 3, '30s'),
              ex('Sentadillas al aire', 3, 15)
            ]
          ),
          level(
            'intermediate',
            'Intermedio',
            50,
            'Bajar caminando para recuperar',
            [
              ex('Cuesta 100m subida fuerte', 8, '100m'),
              ex('Zancadas al terminar', 4, 20)
            ]
          ),
          level(
            'advanced',
            'Avanzado',
            70,
            'Recuperación entre cuestas según terreno',
            [
              ex('Trail / cuestas largas intensas (~3-4 min)', 6, 'subida'),
              ex('Saltos al cajón', 5, 15),
              ex('Rueda abdominal', 5, 15)
            ]
          )
        ]
      }
    ]
  },
  {
    id: 'fullbody',
    name: 'Full Body',
    shortName: 'Full Body',
    emoji: '⚡',
    color: 'primary',
    description: 'Cuerpo completo por sesión',
    programs: [
      {
        id: 'strength',
        name: 'Fuerza Global',
        subtitle: 'Pesos o tensión alta en todo el cuerpo',
        levels: [
          level(
            'beginner',
            'Principiante',
            45,
            'Descanso: 90s entre series',
            [
              ex('Goblet squat (mancuerna pesada)', 3, 12),
              ex('Press militar sentado', 3, 10),
              ex('Peso muerto con mancuernas', 3, 12),
              ex('Remo con mancuernas', 3, 12)
            ]
          ),
          level(
            'intermediate',
            'Intermedio',
            60,
            'Descanso: 90s entre series',
            [
              ex('Sentadilla trasera con barra libre', 4, 8),
              ex('Press de banca', 4, 8),
              ex('Dominadas estrictas', 4, 8),
              ex('Press militar de pie con barra', 4, 8)
            ]
          ),
          level(
            'advanced',
            'Avanzado',
            75,
            'Descanso: 120s entre series',
            [
              ex('Levantamiento olímpico (Clean & Jerk)', 5, 5),
              ex('Sentadilla frontal con barra', 5, 6),
              ex('Dominadas lastradas', 5, 6),
              ex('Fondos en paralelas lastrados', 5, 6)
            ]
          )
        ]
      },
      {
        id: 'hiit',
        name: 'Acondicionamiento Metabólico',
        subtitle: 'HIIT · Alta intensidad',
        levels: [
          level(
            'beginner',
            'Principiante',
            25,
            '30s entre ejercicios, 2 min entre vueltas',
            [
              ex('Circuito · Jumping jacks', 3, 15),
              ex('Circuito · Sentadillas', 3, 10),
              ex('Circuito · Flexiones de rodillas', 3, 10),
              ex('Circuito · Plancha', 3, '20s')
            ],
            '3 vueltas del circuito.'
          ),
          level(
            'intermediate',
            'Intermedio',
            40,
            'EMOM · descansa el resto del minuto',
            [
              ex('EMOM Min 1: Burpees', 5, 15),
              ex('EMOM Min 2: Zancadas con salto', 5, 20),
              ex('EMOM Min 3: Flexiones', 5, 15),
              ex('EMOM Min 4: Plancha estática', 5, '45s')
            ],
            'EMOM de 20 minutos (ciclo de 4 minutos × 5).'
          ),
          level(
            'advanced',
            'Avanzado',
            45,
            'Descanso solo si es estrictamente necesario',
            [
              ex('AMRAP · Dominadas', 1, 10),
              ex('AMRAP · Flexiones', 1, 20),
              ex('AMRAP · Sentadillas', 1, 30),
              ex('AMRAP · Saltos dobles de cuerda', 1, 40)
            ],
            'AMRAP de 20 minutos: tantas rondas como puedas.'
          )
        ]
      },
      {
        id: 'endurance',
        name: 'Resistencia Muscular y Estabilidad',
        subtitle: 'Tensión sostenida y control',
        levels: [
          level(
            'beginner',
            'Principiante',
            35,
            'Descanso: 60s entre series',
            [
              ex('Paseo del granjero', 3, '30s'),
              ex('Escaladores (Mountain climbers)', 3, '30s'),
              ex('Elevación de pelvis', 3, 15),
              ex('Remo con banda elástica', 3, 15)
            ]
          ),
          level(
            'intermediate',
            'Intermedio',
            50,
            'Descanso: 45s entre series',
            [
              ex('Kettlebell swings', 4, 20),
              ex('Flexiones spiderman', 4, 12),
              ex('Saltos de longitud estáticos', 4, 10),
              ex('Remo invertido', 4, 12)
            ]
          ),
          level(
            'advanced',
            'Avanzado',
            60,
            'Descanso: 60s entre series',
            [
              ex('Man-makers (flexión + remo + squat clean + press)', 5, 10),
              ex('Turkish get-up (por lado)', 5, 5),
              ex('Burpees saltando sobre una barra', 5, 15)
            ]
          )
        ]
      }
    ]
  }
]

export function flattenQiSiCatalog() {
  const rows = []
  for (const variant of QISI_VARIANTS) {
    for (const program of variant.programs) {
      for (const lvl of program.levels) {
        const catalogId = `${variant.id}-${program.id}-${lvl.id}`
        rows.push({
          catalogId,
          localId: `qisi-${catalogId}`,
          name: `QySi · ${variant.shortName} · ${program.name} · ${lvl.name}`,
          color: variant.color,
          variantId: variant.id,
          variantName: variant.name,
          programId: program.id,
          programName: program.name,
          levelId: lvl.id,
          levelName: lvl.name,
          durationMin: lvl.durationMin,
          restNote: lvl.restNote,
          notes: lvl.notes || '',
          exercises: lvl.exercises.map((e, i) => ({
            ...e,
            id: `qisi-${catalogId}-${i + 1}`
          }))
        })
      }
    }
  }
  return rows
}

export function findQiSiCatalogItem(catalogId) {
  return flattenQiSiCatalog().find((r) => r.catalogId === catalogId) || null
}

export function getQiSiLevelGuide() {
  return [
    {
      id: 'beginner',
      name: 'Principiante',
      tip: 'Ideal si llevas poco tiempo, vuelves de una pausa o priorizas técnica y consistencia.'
    },
    {
      id: 'intermediate',
      name: 'Intermedio',
      tip: 'Si ya entrenas con regularidad y controlas la forma en los básicos.'
    },
    {
      id: 'advanced',
      name: 'Avanzado',
      tip: 'Para quien busca intensidad alta, progresiones exigentes y sesiones más largas.'
    }
  ]
}
