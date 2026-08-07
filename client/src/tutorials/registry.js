/**
 * Catalog of app tutorials. Each tutorial has ordered spotlight steps.
 * target = data-tour attribute
 * demo = fallback premium panel id when real UI target is missing
 */

import {
  readLocalCompletion,
  userIdOf,
  clearLegacyGlobalCompletion
} from './completion'

export const TUTORIAL_IDS = {
  QUICK_START: 'quick_start',
  PROFILE_EDIT: 'profile_edit',
  WORKOUTS: 'workouts',
  COMMUNITY: 'community',
  CHAT: 'chat',
  CHALLENGES: 'challenges',
  CLASSES: 'classes',
  INVITES: 'invites',
  PROGRESS: 'progress',
  REST_TIMES: 'rest_times',
  PRIVACY_PERMISSIONS: 'privacy_permissions'
}

/**
 * Catalog IDs that existed before the "new tutorial" spotlight system.
 * On first run we seed these as already-known so only truly new entries get promoted.
 */
export const PRE_SPOTLIGHT_TUTORIAL_IDS = [
  TUTORIAL_IDS.QUICK_START,
  TUTORIAL_IDS.PROFILE_EDIT,
  TUTORIAL_IDS.WORKOUTS,
  TUTORIAL_IDS.COMMUNITY,
  TUTORIAL_IDS.CHALLENGES,
  TUTORIAL_IDS.CLASSES,
  TUTORIAL_IDS.INVITES,
  TUTORIAL_IDS.PROGRESS,
  TUTORIAL_IDS.REST_TIMES
]

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
    short: 'Crear, iniciar y completar',
    icon: '💪',
    description: 'Crea rutinas, inicia una sesión, completa ejercicios y controla descansos.',
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
    id: TUTORIAL_IDS.CHAT,
    title: 'Mensajes y chat',
    short: 'Conversaciones y compartir',
    icon: '💬',
    description: 'Inbox, enviar mensajes, ver respuestas y compartir contenido con otros usuarios.',
    completionKey: 'qyntra_tutorial_chat_done',
    settingsKey: 'tutorialChatCompleted'
  },
  {
    id: TUTORIAL_IDS.CHALLENGES,
    title: 'Retos',
    short: 'Crear, unirse y completar',
    icon: '🏆',
    description: 'Crea o únete a un reto, inicia, marca progreso y finalízalo.',
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
  },
  {
    id: TUTORIAL_IDS.REST_TIMES,
    title: 'Tiempos de descanso',
    short: 'Configura descansos entre ejercicios',
    icon: '⏱️',
    description: 'Ajusta el timer de descanso, el auto-inicio y las alertas desde Configuración.',
    completionKey: 'qyntra_tutorial_rest_times_done',
    settingsKey: 'tutorialRestTimesCompleted'
  },
  {
    id: TUTORIAL_IDS.PRIVACY_PERMISSIONS,
    title: 'Permisos y privacidad',
    short: 'Almacenamiento, notificaciones y perfil',
    icon: '🔐',
    description: 'Activa el almacenamiento, controla notificaciones y decide si tu perfil es público o privado.',
    completionKey: 'qyntra_tutorial_privacy_permissions_done',
    settingsKey: 'tutorialPrivacyPermissionsCompleted'
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
    path: '/dashboard',
    target: 'nav-social',
    title: 'Comunidad que empuja',
    body: 'Desde este acceso entras a comunidad: comparte hitos, reacciona y comenta con tu círculo.'
  },
  {
    id: 'workouts',
    path: '/dashboard',
    target: 'nav-workouts',
    title: 'Entrenos a tu medida',
    body: 'Aquí gestionas rutinas y sesiones. Toca Entrenos cuando quieras entrenar.'
  },
  {
    id: 'progress',
    path: '/dashboard',
    target: 'nav-progress',
    title: 'Progreso con claridad',
    body: 'Visualiza avances, tendencias y logros. Mide lo que importa y celebra cada mejora.'
  },
  {
    id: 'profile',
    path: '/dashboard',
    target: 'nav-profile',
    title: 'Tu identidad en Qyntra',
    body: 'Perfil, insignias y presencia: personaliza cómo te ven y muestra tu trayectoria.'
  },
  {
    id: 'classes',
    path: '/dashboard',
    target: 'nav-classes',
    title: 'Clases del gimnasio',
    body: 'Desde el encabezado consultas horarios y reservas cupo en las clases disponibles.'
  },
  {
    id: 'challenges',
    path: '/dashboard',
    target: 'nav-challenges',
    title: 'Retos que marcan ritmo',
    body: 'Entra a retos desde aquí: compite, supera metas y suma energía.'
  },
  {
    id: 'chat',
    path: '/dashboard',
    target: 'nav-chat',
    title: 'Chat en un toque',
    body: 'El icono de mensajes abre conversaciones con tu comunidad sin fricción.'
  },
  {
    id: 'notifications',
    path: '/dashboard',
    target: 'nav-notifications',
    title: 'Nunca te pierdas nada',
    body: 'La campana muestra avisos de comunidad, actividad y recordatorios.'
  },
  {
    id: 'avatar',
    path: '/dashboard',
    target: 'nav-avatar',
    title: 'Menú de tu cuenta',
    body: 'Al tocar tu foto abres accesos rápidos: perfil, ajustes, invitaciones, tema y cierre de sesión.'
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
    body: 'Comparte Qyntra con tu equipo. Las invitaciones ayudan a crecer tu comunidad.',
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
    body: 'La imagen de fondo es tu portada. Toca editar para subir una foto que represente tu estilo.'
  },
  {
    id: 'profile-avatar',
    path: '/profile',
    target: 'tour-profile-avatar',
    title: 'Tu foto de perfil',
    body: 'Toca el avatar para ver o cambiar tu foto (y ver historias si tienes). Es lo primero que ve tu comunidad.'
  },
  {
    id: 'profile-notes',
    path: '/profile',
    target: 'tour-profile-notes',
    demo: 'profile-notes',
    forceDemo: true,
    title: 'Notas en tu perfil',
    body: 'La nube junto a tu foto es una nota temporal (24 h). Comparte lo que piensas; solo tú ves las respuestas privadas.'
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
    target: 'tour-settings-panel',
    title: 'Configuración de la app',
    body: 'Controla privacidad, tema, notificaciones y preferencias. También desde el menú de tu avatar.'
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
    id: 'wo-create',
    path: '/workouts',
    target: 'tour-workouts-create',
    title: 'Crear una rutina',
    body: 'Arma tu rutina con ejercicios, series y repeticiones a tu medida.'
  },
  {
    id: 'wo-list',
    path: '/workouts',
    target: 'tour-workouts-list',
    title: 'Tus rutinas',
    body: 'Aquí aparecen tus rutinas guardadas. Elige una para iniciar cuando estés listo.'
  },
  {
    id: 'wo-start',
    path: '/workouts',
    target: 'tour-workout-start',
    demo: 'workout-start',
    title: 'Iniciar una rutina',
    body: 'Pulsa Iniciar en la tarjeta de la rutina. Arranca el cronómetro y entras al modo sesión.'
  },
  {
    id: 'wo-complete',
    path: '/workouts',
    target: 'tour-workout-complete-exercise',
    demo: 'workout-complete',
    title: 'Marcar ejercicio completado',
    body: 'En la sesión, Completar marca el ejercicio actual. Así avanzas al siguiente y lleva el control real de tu train.'
  },
  {
    id: 'wo-rest',
    path: '/workouts',
    target: 'tour-workout-rest-timer',
    demo: 'workout-rest',
    title: 'Descansos entre series',
    body: 'Tras completar un ejercicio se abre el temporizador de descanso. Puedes esperar o saltarlo si estás listo.'
  },
  {
    id: 'wo-history',
    path: '/my-workouts',
    target: 'tour-my-workouts',
    title: 'Historial de entrenamientos',
    body: 'Revisa sesiones completadas y comparte tus avances con la comunidad.'
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
    body: 'La fila superior muestra estados. El + crea una historia con foto o video.'
  },
  {
    id: 'co-compose',
    path: '/social',
    target: 'tour-social-compose',
    title: 'Crear publicación',
    body: 'Escribe, añade fotos, encuesta o estado de ánimo y comparte con quienes te siguen.'
  },
  {
    id: 'co-post',
    path: '/social',
    target: 'tour-social-demo-post',
    demo: 'community-post',
    title: 'Así se ve una publicación',
    body: 'Cada post muestra autor, contenido e imagen. Este es el formato que usa tu comunidad.'
  },
  {
    id: 'co-actions',
    path: '/social',
    target: 'tour-social-post-actions',
    demo: 'community-actions',
    title: 'Reaccionar, comentar y compartir',
    body: 'Mantén pulsado el corazón para más reacciones. Comenta respuestas y comparte fuera de la app.'
  }
]

const CHAT_STEPS = [
  {
    id: 'chat-inbox',
    path: '/chat',
    target: 'tour-chat-inbox',
    title: 'Tu bandeja de mensajes',
    body: 'Aquí ves todas tus conversaciones: último mensaje, hora y avisos sin leer.'
  },
  {
    id: 'chat-new',
    path: '/chat',
    target: 'tour-chat-new',
    title: 'Nueva conversación',
    body: 'Pulsa + para buscar a alguien de la comunidad e iniciar un chat.'
  },
  {
    id: 'chat-thread',
    path: '/chat',
    target: 'tour-chat-thread-demo',
    demo: 'chat-thread',
    forceDemo: true,
    title: 'Así se ve un chat',
    body: 'Los mensajes salientes van a la derecha y los recibidos a la izquierda, con hora y estado de lectura.'
  },
  {
    id: 'chat-compose',
    path: '/chat',
    target: 'tour-chat-compose-demo',
    demo: 'chat-compose',
    forceDemo: true,
    title: 'Enviar un mensaje',
    body: 'Escribe texto, añade emojis, fotos, archivos o un audio. El botón enviar aparece listo cuando hay contenido.'
  },
  {
    id: 'chat-share',
    path: '/chat',
    target: 'tour-chat-share-demo',
    demo: 'chat-share',
    forceDemo: true,
    title: 'Compartir contenido',
    body: 'También puedes enviar publicaciones o estados al chat; llegan como tarjetas para abrir en un toque.'
  },
  {
    id: 'chat-options',
    path: '/chat',
    target: 'tour-chat-options-demo',
    demo: 'chat-options',
    forceDemo: true,
    title: 'Menú del chat',
    body: 'Los tres puntos abren opciones: archivos compartidos, rutinas públicas, estilo del fondo, vaciar chat y acceso directo.'
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
    id: 'ch-tabs',
    path: '/challenges',
    target: 'tour-challenges-list',
    title: 'Mis retos y disponibles',
    body: 'Cambia entre Mis Retos y Disponibles para ver los tuyos o unirte a nuevos.'
  },
  {
    id: 'ch-join',
    path: '/challenges',
    target: 'tour-challenge-join',
    demo: 'challenge-join',
    forceDemo: true,
    title: 'Inscribirte a un reto',
    body: 'En Disponibles, Unirse al Reto te suma como participante. Luego podrás iniciarlo.'
  },
  {
    id: 'ch-start',
    path: '/challenges',
    target: 'tour-challenge-start',
    demo: 'challenge-start',
    forceDemo: true,
    title: 'Iniciar el reto',
    body: 'Dentro del detalle, Iniciar Reto arranca tu sesión y empieza a contar tu progreso.'
  },
  {
    id: 'ch-progress',
    path: '/challenges',
    target: 'tour-challenge-progress',
    demo: 'challenge-progress',
    forceDemo: true,
    title: 'Marcar progreso',
    body: 'Actualiza tu avance (km, reps, días…) y confirma. Así el reto refleja tu ritmo real.'
  },
  {
    id: 'ch-complete',
    path: '/challenges',
    target: 'tour-challenge-complete',
    demo: 'challenge-complete',
    forceDemo: true,
    title: 'Finalizar y ganar XP',
    body: 'Al alcanzar el objetivo, Completar y Obtener XP cierra el reto y suma recompensa.'
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
    title: 'Ver clases del día',
    body: 'Filtra por día y revisa detalles antes de inscribirte.'
  },
  {
    id: 'cl-enroll',
    path: '/classes',
    target: 'tour-class-enroll',
    demo: 'class-enroll',
    title: 'Inscribirte a una clase',
    body: 'Toca Inscribirse para reservar tu lugar. Si está llena, puedes entrar en lista de espera.'
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
    target: 'tour-social-share',
    demo: 'invite-share',
    title: 'Promocionar tus avances',
    body: 'Al compartir una publicación (WhatsApp / historias) promocionas logros con diseño Qyntra.'
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

const REST_TIMES_STEPS = [
  {
    id: 'rt-settings-nav',
    path: '/settings?section=workout',
    target: 'tour-settings-workout-section',
    demo: 'settings-workout-nav',
    title: 'Ajustes de entrenamiento',
    body: 'En Configuración → Entrenamiento controlas cómo se comporta el descanso entre ejercicios.'
  },
  {
    id: 'rt-duration',
    path: '/settings?section=workout',
    target: 'tour-settings-rest-timer',
    demo: 'settings-rest-timer',
    title: 'Duración del descanso',
    body: 'Desliza para definir los segundos por defecto (15–180). Ese valor se usa al completar un ejercicio en sesión.'
  },
  {
    id: 'rt-autostart',
    path: '/settings?section=workout',
    target: 'tour-settings-rest-autostart',
    demo: 'settings-rest-autostart',
    title: 'Auto-iniciar timer',
    body: 'Si está activo, el temporizador arranca solo al completar. Ideal para mantener el ritmo sin tocar la pantalla.'
  },
  {
    id: 'rt-session',
    path: '/workouts',
    target: 'tour-workout-rest-timer',
    demo: 'workout-rest',
    title: 'En la sesión',
    body: 'Durante el entreno verás la cuenta atrás. Puedes esperar o saltar el descanso si ya estás listo.'
  }
]

const PRIVACY_PERMISSIONS_STEPS = [
  {
    id: 'pp-permissions-nav',
    path: '/settings?section=permissions',
    target: 'tour-settings-permissions-section',
    demo: 'settings-permissions-nav',
    title: 'Permisos del dispositivo',
    body: 'Aquí Qyntra pide solo lo necesario. Empieza por el acceso a almacenamiento para compartir fotos y videos.'
  },
  {
    id: 'pp-storage',
    path: '/settings?section=permissions',
    target: 'tour-settings-storage-access',
    demo: 'settings-storage-access',
    title: 'Acceso a almacenamiento',
    body: 'Actívalo para subir historias y medios. Sin este permiso, la comunidad no podrá recibir tu contenido multimedia.'
  },
  {
    id: 'pp-notifications-nav',
    path: '/settings?section=notifications',
    target: 'tour-settings-notifications-section',
    demo: 'settings-notifications-nav',
    title: 'Notificaciones',
    body: 'Entra a Notificaciones para decidir qué alertas quieres recibir — o apagarlas por completo.'
  },
  {
    id: 'pp-push',
    path: '/settings?section=notifications',
    target: 'tour-settings-notifications-push',
    demo: 'settings-notifications-push',
    title: 'Push y recordatorios',
    body: 'Puedes activar o desactivar push, email, entrenos, social y retos. Tú eliges el nivel de ruido.'
  },
  {
    id: 'pp-privacy-nav',
    path: '/settings?section=privacy',
    target: 'tour-settings-privacy-section',
    demo: 'settings-privacy-nav',
    title: 'Privacidad del perfil',
    body: 'Define cómo te ven los demás. El control principal es Perfil público o privado.'
  },
  {
    id: 'pp-profile-public',
    path: '/settings?section=privacy',
    target: 'tour-settings-profile-public',
    demo: 'settings-profile-public',
    title: 'Público o privado',
    body: 'Si el perfil es privado, solo tus seguidores ven tus publicaciones. Si es público, tu comunidad crece más fácil.'
  }
]

export const TUTORIAL_STEPS = {
  [TUTORIAL_IDS.QUICK_START]: QUICK_START_STEPS,
  [TUTORIAL_IDS.PROFILE_EDIT]: PROFILE_STEPS,
  [TUTORIAL_IDS.WORKOUTS]: WORKOUT_STEPS,
  [TUTORIAL_IDS.COMMUNITY]: COMMUNITY_STEPS,
  [TUTORIAL_IDS.CHAT]: CHAT_STEPS,
  [TUTORIAL_IDS.CHALLENGES]: CHALLENGE_STEPS,
  [TUTORIAL_IDS.CLASSES]: CLASS_STEPS,
  [TUTORIAL_IDS.INVITES]: INVITE_STEPS,
  [TUTORIAL_IDS.PROGRESS]: PROGRESS_STEPS,
  [TUTORIAL_IDS.REST_TIMES]: REST_TIMES_STEPS,
  [TUTORIAL_IDS.PRIVACY_PERMISSIONS]: PRIVACY_PERMISSIONS_STEPS
}

export function getTutorialMeta(id) {
  return TUTORIAL_CATALOG.find((t) => t.id === id) || TUTORIAL_CATALOG[0]
}

export function getTutorialSteps(id) {
  return TUTORIAL_STEPS[id] || QUICK_START_STEPS
}

/**
 * Completion is ALWAYS scoped to the signed-in user (settings + per-user local cache).
 * Legacy global localStorage keys are ignored (and cleared when detected).
 */
export function hasCompletedTutorial(user, tutorialId) {
  const meta = getTutorialMeta(tutorialId)
  // Clear legacy shared keys so Account A cannot mark Account B as "visto"
  clearLegacyGlobalCompletion(meta.completionKey)

  if (user?.settings?.[meta.settingsKey] === true) return true
  if (tutorialId === TUTORIAL_IDS.QUICK_START && user?.tutorialCompleted === true) return true

  const uid = userIdOf(user)
  if (uid && readLocalCompletion(meta.completionKey, uid)) return true
  return false
}
