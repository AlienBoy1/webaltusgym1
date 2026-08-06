/**
 * Catalog of app tutorials. Each tutorial has ordered spotlight steps.
 * target = data-tour attribute; null = centered tip after navigation.
 */

export const TUTORIAL_IDS = {
  QUICK_START: 'quick_start',
  PROFILE_EDIT: 'profile_edit',
  WORKOUTS: 'workouts',
  COMMUNITY: 'community',
  CHALLENGES: 'challenges',
  CLASSES: 'classes',
  INVITES: 'invites',
  PROGRESS: 'progress'
}

export const TUTORIAL_CATALOG = [
  {
    id: TUTORIAL_IDS.QUICK_START,
    title: 'Inicio rápido',
    short: 'Navegación general de la app',
    icon: '🚀',
    description: 'Conoce el menú, comunidad, entrenos, retos y accesos rápidos.',
    completionKey: 'qyntra_tutorial_done',
    settingsKey: 'tutorialCompleted',
    isDefaultOnboarding: true
  },
  {
    id: TUTORIAL_IDS.PROFILE_EDIT,
    title: 'Perfil y configuración',
    short: 'Avatar, portada y ajustes',
    icon: '👤',
    description: 'Edita tu foto, portada, insignias y llega a la configuración.',
    completionKey: 'qyntra_tutorial_profile_done',
    settingsKey: 'tutorialProfileCompleted'
  },
  {
    id: TUTORIAL_IDS.WORKOUTS,
    title: 'Entrenamientos',
    short: 'Crear e iniciar rutinas',
    icon: '💪',
    description: 'Crea rutinas, inicia una sesión y registra series.',
    completionKey: 'qyntra_tutorial_workouts_done',
    settingsKey: 'tutorialWorkoutsCompleted'
  },
  {
    id: TUTORIAL_IDS.COMMUNITY,
    title: 'Comunidad',
    short: 'Historias y publicaciones',
    icon: '🗣️',
    description: 'Publica, reacciona, comenta y comparte historias.',
    completionKey: 'qyntra_tutorial_community_done',
    settingsKey: 'tutorialCommunityCompleted'
  },
  {
    id: TUTORIAL_IDS.CHALLENGES,
    title: 'Retos',
    short: 'Crear, unirse y completar',
    icon: '🏆',
    description: 'Crea o únete a un reto e inicia tu progreso.',
    completionKey: 'qyntra_tutorial_challenges_done',
    settingsKey: 'tutorialChallengesCompleted'
  },
  {
    id: TUTORIAL_IDS.CLASSES,
    title: 'Clases',
    short: 'Horarios e inscripción',
    icon: '📅',
    description: 'Consulta la agenda e inscríbete a una clase.',
    completionKey: 'qyntra_tutorial_classes_done',
    settingsKey: 'tutorialClassesCompleted'
  },
  {
    id: TUTORIAL_IDS.INVITES,
    title: 'Invitaciones y promoción',
    short: 'Compartir perfil y avances',
    icon: '📣',
    description: 'Invita amigos, comparte tu perfil y promociona logros.',
    completionKey: 'qyntra_tutorial_invites_done',
    settingsKey: 'tutorialInvitesCompleted'
  },
  {
    id: TUTORIAL_IDS.PROGRESS,
    title: 'Progreso',
    short: 'Objetivos y gráficas',
    icon: '📈',
    description: 'Mide avances, mira estadísticas y celebra logros.',
    completionKey: 'qyntra_tutorial_progress_done',
    settingsKey: 'tutorialProgressCompleted'
  }
]

const QUICK_START_STEPS = [
  {
    id: 'dashboard',
    path: '/dashboard',
    target: 'nav-dashboard',
    title: 'Tu centro de mando',
    body: 'Aquí empieza cada sesión: resumen de actividad, accesos rápidos y lo esencial para entrenar sin fricción.'
  },
  {
    id: 'social',
    path: '/social',
    target: 'nav-social',
    title: 'Comunidad que empuja',
    body: 'Comparte hitos, reacciona, comenta y mantén la motivación con tu círculo en Qyntra.'
  },
  {
    id: 'workouts',
    path: '/workouts',
    target: 'nav-workouts',
    title: 'Entrenos a tu medida',
    body: 'Rutinas, sesiones y seguimiento de series: construye consistencia con un flujo claro.'
  },
  {
    id: 'progress',
    path: '/progress',
    target: 'nav-progress',
    title: 'Progreso con claridad',
    body: 'Visualiza avances, tendencias y logros. Mide lo que importa y celebra cada mejora.'
  },
  {
    id: 'profile',
    path: '/profile',
    target: 'nav-profile',
    title: 'Tu identidad en Qyntra',
    body: 'Perfil, insignias y presencia: personaliza cómo te ven y muestra tu trayectoria.'
  },
  {
    id: 'classes',
    path: '/classes',
    target: 'nav-classes',
    title: 'Clases del gimnasio',
    body: 'Consulta horarios, reserva cupo y organízate con las clases disponibles desde este acceso rápido.'
  },
  {
    id: 'challenges',
    path: '/challenges',
    target: 'nav-challenges',
    title: 'Retos que marcan ritmo',
    body: 'Compite, supera metas y suma energía. Los retos convierten el hábito en un juego serio.'
  },
  {
    id: 'chat',
    path: '/chat',
    target: 'nav-chat',
    title: 'Chat en un toque',
    body: 'Desde el encabezado abres mensajes con tu comunidad. Conversación rápida, sin salir del flujo.'
  },
  {
    id: 'notifications',
    path: '/notifications',
    target: 'nav-notifications',
    title: 'Nunca te pierdas nada',
    body: 'Avisos de la comunidad, actividad y recordatorios. Mantente al día con un vistazo.'
  },
  {
    id: 'avatar',
    path: '/dashboard',
    target: 'nav-avatar',
    title: 'Menú de tu cuenta',
    body: 'Al tocar tu foto abrés accesos rápidos: perfil, ajustes, invitaciones, tema y cierre de sesión.',
    openAvatarMenu: false
  },
  {
    id: 'menu-profile',
    path: '/dashboard',
    target: 'menu-profile',
    title: 'Ver perfil',
    body: 'Entra a tu perfil completo para editar datos, foto, cover y revisar tu progreso social.',
    openAvatarMenu: true
  },
  {
    id: 'menu-settings',
    path: '/dashboard',
    target: 'menu-settings',
    title: 'Configuración',
    body: 'Privacidad, apariencia, notificaciones y preferencias de la app. Todo centralizado aquí.',
    openAvatarMenu: true
  },
  {
    id: 'menu-invite',
    path: '/dashboard',
    target: 'menu-invite',
    title: 'Invitar a amigos',
    body: 'Comparte Qyntra con tu equipo. Las invitaciones ayudan a crecer tu comunidad de entrenamiento.',
    openAvatarMenu: true
  },
  {
    id: 'menu-theme',
    path: '/dashboard',
    target: 'menu-theme',
    title: 'Tema claro u oscuro',
    body: 'Cambia la apariencia al instante para entrenar cómodo de día o de noche.',
    openAvatarMenu: true
  },
  {
    id: 'menu-logout',
    path: '/dashboard',
    target: 'menu-logout',
    title: 'Cerrar sesión',
    body: 'Sal de tu cuenta con seguridad cuando termines. Podrás volver a entrar cuando quieras.',
    openAvatarMenu: true
  }
]

const PROFILE_STEPS = [
  {
    id: 'profile-hero',
    path: '/profile',
    target: 'tour-profile-cover',
    title: 'Tu portada',
    body: 'La imagen de fondo es tu portada. Toca editar para subir una foto que represente tu estilo en Qyntra.'
  },
  {
    id: 'profile-avatar',
    path: '/profile',
    target: 'tour-profile-avatar',
    title: 'Tu foto de perfil',
    body: 'Toca el avatar para ver o cambiar tu foto (y ver historias si tienes). Es lo primero que ve tu comunidad.'
  },
  {
    id: 'profile-edit',
    path: '/profile',
    target: 'tour-profile-edit',
    title: 'Editar perfil',
    body: 'Actualiza tu nombre, meta y datos visibles. Mantén tu perfil al día.'
  },
  {
    id: 'profile-share',
    path: '/profile',
    target: 'tour-profile-share',
    title: 'Compartir perfil',
    body: 'Genera una tarjeta nativa para enviar tu perfil e invitar a otros a seguirte.'
  },
  {
    id: 'profile-tutorials',
    path: '/profile',
    target: 'tour-profile-tutorials',
    title: 'Centro de tutoriales',
    body: 'Aquí abres todos los tutoriales de la app cuando quieras repasar una función.'
  },
  {
    id: 'profile-badges',
    path: '/profile',
    target: 'tour-profile-badges',
    title: 'Insignias',
    body: 'Tus logros desbloqueados. Ábrelas para ver detalles y compartirlas en comunidad.'
  },
  {
    id: 'profile-settings-hint',
    path: '/settings',
    target: null,
    title: 'Configuración de la app',
    body: 'Desde Configuración controlas privacidad, tema, notificaciones y preferencias. También puedes abrirla desde el menú de tu avatar.'
  }
]

const WORKOUT_STEPS = [
  {
    id: 'wo-nav',
    path: '/workouts',
    target: 'nav-workouts',
    title: 'Apartado Entrenos',
    body: 'Aquí gestionas rutinas y sesiones. Es el corazón del entrenamiento en Qyntra.'
  },
  {
    id: 'wo-intro',
    path: '/workouts',
    target: 'tour-workouts-create',
    title: 'Crear entrenamiento',
    body: 'Usa el botón de crear para armar una rutina con ejercicios, series y repeticiones a tu medida.'
  },
  {
    id: 'wo-start',
    path: '/workouts',
    target: 'tour-workouts-list',
    title: 'Iniciar una sesión',
    body: 'Elige una rutina guardada y toca iniciar. El cronómetro y el registro de series te acompañan en vivo.'
  },
  {
    id: 'wo-history',
    path: '/my-workouts',
    target: null,
    title: 'Historial de entrenamientos',
    body: 'Revisa el historial de sesiones completadas y vuelve a compartir tus avances con la comunidad.'
  }
]

const COMMUNITY_STEPS = [
  {
    id: 'co-nav',
    path: '/social',
    target: 'nav-social',
    title: 'Comunidad',
    body: 'El feed donde compartes logros, reacciones e historias con tu círculo.'
  },
  {
    id: 'co-stories',
    path: '/social',
    target: 'tour-stories-rail',
    title: 'Historias',
    body: 'Desliza la fila superior para ver estados. El + crea una historia con foto o video.'
  },
  {
    id: 'co-compose',
    path: '/social',
    target: 'tour-social-compose',
    title: 'Crear publicación',
    body: 'Escribe, añade fotos, encuesta o estado de ánimo y comparte con quienes te siguen.'
  },
  {
    id: 'co-react',
    path: '/social',
    target: 'tour-social-feed',
    title: 'Reaccionar y comentar',
    body: 'Mantén pulsado el corazón para más reacciones. Comenta, responde y comparte publicaciones.'
  }
]

const CHALLENGE_STEPS = [
  {
    id: 'ch-nav',
    path: '/challenges',
    target: 'nav-challenges',
    title: 'Retos',
    body: 'Compite por metas con XP según el tipo de reto.'
  },
  {
    id: 'ch-create',
    path: '/challenges',
    target: 'tour-challenges-create',
    title: 'Crear un reto',
    body: 'Define título, tipo, objetivo y fechas. Cada tipo otorga XP distinto.'
  },
  {
    id: 'ch-join',
    path: '/challenges',
    target: 'tour-challenges-list',
    title: 'Unirte a un reto',
    body: 'Explora retos abiertos, únete y prepárate para iniciar la sesión del reto.'
  },
  {
    id: 'ch-session',
    path: '/challenges',
    target: null,
    title: 'Completar un reto',
    body: 'Inicia el reto, registra progreso (o pausa si descansas) y al alcanzar el objetivo celebra y comparte.'
  }
]

const CLASS_STEPS = [
  {
    id: 'cl-nav',
    path: '/classes',
    target: 'nav-classes',
    title: 'Clases',
    body: 'Agenda del gimnasio: horarios, instructores y cupos.'
  },
  {
    id: 'cl-list',
    path: '/classes',
    target: 'tour-classes-list',
    title: 'Ver clases',
    body: 'Filtra por día y revisa detalles antes de inscribirte.'
  },
  {
    id: 'cl-enroll',
    path: '/classes',
    target: 'tour-classes-list',
    title: 'Inscribirte',
    body: 'Toca una clase y confirma tu lugar. Si está llena, puedes entrar en lista de espera.'
  }
]

const INVITE_STEPS = [
  {
    id: 'inv-profile',
    path: '/profile',
    target: 'tour-profile-share',
    title: 'Compartir tu perfil',
    body: 'Genera una tarjeta nativa para que otros te encuentren y te sigan.'
  },
  {
    id: 'inv-menu',
    path: '/dashboard',
    target: 'menu-invite',
    title: 'Invitar amigos',
    body: 'Desde el menú de tu avatar envía invitaciones por WhatsApp u otros canales.',
    openAvatarMenu: true
  },
  {
    id: 'inv-share-post',
    path: '/social',
    target: 'tour-social-feed',
    title: 'Promocionar avances',
    body: 'Al compartir una publicación fuera de la app (WhatsApp/historias) promocionas tus logros con diseño Qyntra.'
  }
]

const PROGRESS_STEPS = [
  {
    id: 'pr-nav',
    path: '/progress',
    target: 'nav-progress',
    title: 'Progreso',
    body: 'Tu panel de avances: volumen, rachas, XP y tendencias.'
  },
  {
    id: 'pr-stats',
    path: '/progress',
    target: 'tour-progress-stats',
    title: 'Medir avances',
    body: 'Consulta métricas clave y compara tu consistencia semana a semana.'
  },
  {
    id: 'pr-charts',
    path: '/progress',
    target: 'tour-progress-charts',
    title: 'Gráficas',
    body: 'Las gráficas te ayudan a ver evolución real. Úsalas para ajustar tu plan.'
  },
  {
    id: 'pr-goals',
    path: '/progress',
    target: 'tour-progress-goals',
    title: 'Objetivos',
    body: 'Define o revisa metas para mantener el foco en lo que quieres lograr.'
  }
]

export const TUTORIAL_STEPS = {
  [TUTORIAL_IDS.QUICK_START]: QUICK_START_STEPS,
  [TUTORIAL_IDS.PROFILE_EDIT]: PROFILE_STEPS,
  [TUTORIAL_IDS.WORKOUTS]: WORKOUT_STEPS,
  [TUTORIAL_IDS.COMMUNITY]: COMMUNITY_STEPS,
  [TUTORIAL_IDS.CHALLENGES]: CHALLENGE_STEPS,
  [TUTORIAL_IDS.CLASSES]: CLASS_STEPS,
  [TUTORIAL_IDS.INVITES]: INVITE_STEPS,
  [TUTORIAL_IDS.PROGRESS]: PROGRESS_STEPS
}

export function getTutorialMeta(id) {
  return TUTORIAL_CATALOG.find((t) => t.id === id) || TUTORIAL_CATALOG[0]
}

export function getTutorialSteps(id) {
  return TUTORIAL_STEPS[id] || QUICK_START_STEPS
}

export function hasCompletedTutorial(user, tutorialId) {
  const meta = getTutorialMeta(tutorialId)
  try {
    if (localStorage.getItem(meta.completionKey) === '1') return true
  } catch {
    /* ignore */
  }
  if (user?.settings?.[meta.settingsKey] === true) return true
  // legacy field for quick start
  if (tutorialId === TUTORIAL_IDS.QUICK_START && user?.tutorialCompleted === true) return true
  return false
}
