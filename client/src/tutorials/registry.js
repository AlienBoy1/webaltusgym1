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
  MAIN_NAV: 'main_nav',
  PROFILE_EDIT: 'profile_edit',
  WORKOUTS: 'workouts',
  COMMUNITY: 'community',
  CHAT: 'chat',
  STORIES: 'stories',
  CHALLENGES: 'challenges',
  CLASSES: 'classes',
  INVITES: 'invites',
  PROGRESS: 'progress',
  REST_TIMES: 'rest_times',
  PRIVACY_PERMISSIONS: 'privacy_permissions',
  QYSI_WELCOME: 'qysi_welcome',
  QYSI_TRAINING: 'qysi_training',
  ESTILOS_QYNTRA: 'estilos_qyntra'
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
  TUTORIAL_IDS.REST_TIMES,
  TUTORIAL_IDS.QYSI_WELCOME
]

export const TUTORIAL_CATALOG = [
  /**
   * contentVersion: bump (integer) when tutorial content changes so all users
   * get an "Actualización de tutorial" prompt (not "Nuevo"). Default is 1.
   */
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
    id: TUTORIAL_IDS.MAIN_NAV,
    title: 'Navegar entre pantallas',
    short: 'Barra inferior y deslizamiento',
    icon: '↔️',
    description:
      'Aprende a moverte entre Inicio, Social, Entrenos, Progreso y Perfil tocando la barra o deslizando horizontalmente.',
    completionKey: 'qyntra_tutorial_main_nav_done',
    settingsKey: 'tutorialMainNavCompleted',
    /** Spotlight auto-starts after quick_start; hide from «Nuevo» stack. */
    autoStartAfterQuickStart: true,
    contentVersion: 4
  },
  {
    id: TUTORIAL_IDS.QYSI_WELCOME,
    title: 'Bienvenida de QySi',
    short: 'Presentación del trainer inteligente',
    icon: '🤖',
    description:
      'Vuelve a ver la presentación cinematográfica de QySi: quién es, qué ofrece y dónde encontrarlo en Entrenamientos.',
    completionKey: 'qyntra_qysi_intro_seen',
    settingsKey: 'qysiIntroSeenV2',
    launcher: 'qysi_intro'
  },
  {
    id: TUTORIAL_IDS.QYSI_TRAINING,
    title: 'Entrenando con QySi',
    short: 'Adoptar rutinas del trainer inteligente',
    icon: '⚡',
    description:
      'Abre el asistente, elige tu variante y nivel, adopta la rutina e inicia. Las de QySi no se pueden editar ni hacer públicas.',
    completionKey: 'qyntra_tutorial_qysi_training_done',
    settingsKey: 'tutorialQysiTrainingCompleted',
    contentVersion: 2
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
    short: 'Crear, explorar y GymRats',
    icon: '💪',
    description:
      'Crea rutinas, explora las públicas de la comunidad, adopta como GymRat, colabora editando y controla tus sesiones.',
    completionKey: 'qyntra_tutorial_workouts_done',
    settingsKey: 'tutorialWorkoutsCompleted',
    contentVersion: 3
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
    short: 'Chats de la comunidad',
    icon: '💬',
    description:
      'Bandeja con tipado en vivo, adjuntos, mensajes de voz, emojis grandes, reacciones, ver una vez, respuestas, estilos y archivos compartidos.',
    completionKey: 'qyntra_tutorial_chat_done',
    settingsKey: 'tutorialChatCompleted'
  },
  {
    id: TUTORIAL_IDS.STORIES,
    title: 'Historias',
    short: 'Estados, vistas y compartir',
    icon: '📖',
    description:
      'Crea y ve historias, reacciona, responde, guarda favoritos, edita portadas de álbum y comparte en IG/FB.',
    completionKey: 'qyntra_tutorial_stories_done',
    settingsKey: 'tutorialStoriesCompleted'
  },
  {
    id: TUTORIAL_IDS.CHALLENGES,
    title: 'Retos',
    short: 'Tiempo, compartir e invitar',
    icon: '🏆',
    description:
      'Crea retos por cantidad o tiempo, invita a la comunidad o comparte imagen a WhatsApp/IG/FB, y completa con XP.',
    completionKey: 'qyntra_tutorial_challenges_done',
    settingsKey: 'tutorialChallengesCompleted',
    contentVersion: 2
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
    short: 'Cuerpo, volumen y objetivos',
    icon: '📈',
    description:
      'Ficha corporal, IMC/TMB, check-ins, volumen de entrenamientos con proyección educativa, objetivos y guía QySi.',
    completionKey: 'qyntra_tutorial_progress_done',
    settingsKey: 'tutorialProgressCompleted',
    contentVersion: 2,
    /** Auto-start only for accounts created before body-hub launch (see AppTutorial). */
    autoStartForLegacyUsers: true
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
  },
  {
    id: TUTORIAL_IDS.ESTILOS_QYNTRA,
    title: 'Estilos Qyntra',
    short: 'Tema claro/oscuro y colores de marca',
    icon: '🎨',
    description:
      'Aprende a entrar a Configuración → Apariencia y personalizar tu app con tema claro u oscuro y las nuevas combinaciones de color de Qyntra.',
    completionKey: 'qyntra_tutorial_estilos_qyntra_done',
    settingsKey: 'tutorialEstilosQyntraCompleted',
    contentVersion: 1
  }
]

const MAIN_NAV_STEPS = [
  {
    id: 'mn-intro',
    path: '/dashboard',
    target: 'tour-main-nav',
    title: 'Desplaza entre pantallas',
    body: 'Mira cómo la app se desliza. El tutorial hará el scroll por ti: primero hacia adelante, luego hacia atrás.',
    autoAdvanceMs: 1800,
    liveSwipe: true
  },
  {
    id: 'mn-social',
    path: '/social',
    target: 'nav-social',
    title: 'Social',
    body: 'Deslizas a la izquierda y avanzas a Social.',
    autoAdvanceMs: 1500,
    liveSwipe: true,
    swipeDir: 1
  },
  {
    id: 'mn-workouts',
    path: '/workouts',
    target: 'nav-workouts',
    title: 'Entrenos',
    body: 'Otro desliz a la izquierda: Entrenos.',
    autoAdvanceMs: 1500,
    liveSwipe: true,
    swipeDir: 1
  },
  {
    id: 'mn-progress',
    path: '/progress',
    target: 'nav-progress',
    title: 'Progreso',
    body: 'Sigues deslizando hacia Progreso.',
    autoAdvanceMs: 1500,
    liveSwipe: true,
    swipeDir: 1
  },
  {
    id: 'mn-profile',
    path: '/profile',
    target: 'nav-profile',
    title: 'Perfil',
    body: 'Última pestaña hacia adelante: Perfil.',
    autoAdvanceMs: 1600,
    liveSwipe: true,
    swipeDir: 1
  },
  {
    id: 'mn-back',
    path: '/progress',
    target: 'nav-progress',
    title: '← Anterior',
    body: 'Ahora al revés: deslizas a la derecha y vuelves a Progreso.',
    autoAdvanceMs: 1700,
    liveSwipe: true,
    swipeDir: -1
  },
  {
    id: 'mn-end',
    path: '/progress',
    target: 'tour-main-nav',
    title: 'Tu turno',
    body: 'Izquierda = siguiente · derecha = anterior. También puedes tocar la barra inferior.',
    liveSwipe: true
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
    id: 'menu-tutorials',
    path: '/dashboard',
    target: 'menu-tutorials',
    title: 'Centro de tutoriales',
    body: 'Desde el menú de tu foto abres «Tutoriales de la app». Ahí están todas las guías para repasar cuando quieras.',
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
    body: 'Arma tu rutina con ejercicios, series y repeticiones a tu medida. Puedes marcarla pública para la comunidad.'
  },
  {
    id: 'wo-explore',
    path: '/workouts',
    target: 'tour-workouts-explore',
    title: 'Explorar rutinas',
    body: 'Descubre rutinas públicas de otros GymRats. Cada tarjeta muestra cuántas personas ya la adoptaron.'
  },
  {
    id: 'wo-list',
    path: '/workouts',
    target: 'tour-workouts-list',
    title: 'Tus rutinas',
    body: 'Aquí están tus rutinas. Si adoptaste una de otro GymRat, verás siempre la etiqueta del creador original.'
  },
  {
    id: 'wo-gymrat',
    path: '/workouts',
    target: 'tour-workout-gymrat-creator',
    demo: 'workout-gymrat',
    forceDemo: true,
    title: 'Etiqueta del creador',
    body: 'Las rutinas adoptadas muestran «GymRat de @usuario». El creador recibe una notificación cuando alguien adopta su rutina.'
  },
  {
    id: 'wo-collaborator',
    path: '/workouts',
    target: 'tour-workout-gymrat-creator',
    demo: 'workout-collaborator',
    forceDemo: true,
    title: 'Ser colaborador GymRat',
    body: 'Si editas una rutina adoptada, te conviertes en colaborador: tu burbuja aparece en la rutina original (Explorar). Al ver tu versión, cada ejercicio lleva etiqueta Autor, Editada o Colaborador. Esa versión no se puede volver a adoptar.'
  },
  {
    id: 'wo-delete-adopted',
    path: '/workouts',
    target: 'tour-workouts-list',
    demo: 'workout-delete-adopted',
    forceDemo: true,
    title: 'Eliminar una adopción editada',
    body: 'Al borrar una rutina adoptada y editada, la app te avisa: se elimina tu adopción GymRat, dejas de ser colaborador y desaparece tu variante. Para volver a tenerla, debes adoptarla otra vez.'
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

const QYSI_TRAINING_STEPS = [
  {
    id: 'qysi-nav',
    path: '/workouts',
    target: 'nav-workouts',
    title: 'Entrenamientos',
    body: 'QySi vive aquí. Todo el flujo del trainer inteligente empieza en este apartado.'
  },
  {
    id: 'qysi-fab',
    path: '/workouts',
    target: 'tour-qysi-fab-demo',
    demo: 'qysi-fab',
    forceDemo: true,
    title: 'Abre a QySi',
    body: 'La burbuja flotante abre el asistente. También puedes llegar desde su perfil con «Entrenar con QySi».'
  },
  {
    id: 'qysi-what',
    path: '/workouts',
    target: 'tour-qysi-offer-demo',
    demo: 'qysi-offer',
    forceDemo: true,
    title: 'Qué puedes hacer',
    body: 'QySi te ofrece 5 variantes (gimnasio, casa, calistenia, running y full body). Eliges enfoque y nivel, y te entrega una rutina lista.'
  },
  {
    id: 'qysi-path',
    path: '/workouts',
    target: 'tour-qysi-path-demo',
    demo: 'qysi-path',
    forceDemo: true,
    title: 'Elige tu ruta',
    body: 'Paso a paso: 1) dónde entrenas · 2) qué enfoque · 3) tu nivel. QySi arma el plan según esa combinación.'
  },
  {
    id: 'qysi-adopt',
    path: '/workouts',
    target: 'tour-qysi-adopt-demo',
    demo: 'qysi-adopt',
    forceDemo: true,
    title: 'Adopta la rutina',
    body: 'Al adoptar, la rutina queda en tu lista de Entrenamientos con la etiqueta de QySi. Ya puedes iniciar sesión cuando quieras.'
  },
  {
    id: 'qysi-no-edit',
    path: '/workouts',
    target: 'tour-qysi-no-edit-demo',
    demo: 'qysi-no-edit',
    forceDemo: true,
    title: 'Sin editar ni publicar',
    body: 'Las rutinas de QySi no se pueden editar ni hacer públicas. Están diseñadas para entrenarse tal cual. Si quieres algo distinto, crea tu propia rutina.'
  },
  {
    id: 'qysi-start',
    path: '/workouts',
    target: 'tour-qysi-start-demo',
    demo: 'qysi-start',
    forceDemo: true,
    title: 'Inicia y entrena',
    body: 'Pulsa Iniciar en la tarjeta adoptada. Llevas el mismo flujo de sesión, descansos y progreso que con cualquier otra rutina.'
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
    id: 'chat-typing',
    path: '/chat',
    target: 'tour-chat-typing-demo',
    demo: 'chat-typing',
    forceDemo: true,
    title: 'Cuando están escribiendo',
    body: 'Si alguien te escribe, lo verás en la lista de chats y también dentro del chat, con la animación “escribiendo…”.'
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
    body: 'Los mensajes salientes van a la derecha y los recibidos a la izquierda, con hora y estado de lectura. Las respuestas citan el mensaje original arriba de la burbuja.'
  },
  {
    id: 'chat-compose',
    path: '/chat',
    target: 'tour-chat-compose-demo',
    demo: 'chat-compose',
    forceDemo: true,
    title: 'Escribir y adjuntar',
    body: 'Escribe texto, abre emojis o el menú + para foto y archivo. Al elegir una foto, la previsualizas a pantalla completa con pie de foto antes de enviar. Con el campo vacío, el micrófono inicia un mensaje de voz.'
  },
  {
    id: 'chat-emoji',
    path: '/chat',
    target: 'tour-chat-emoji-demo',
    demo: 'chat-emoji',
    forceDemo: true,
    title: 'Emojis grandes',
    body: 'Si envías solo uno, dos o tres emojis, se muestran grandes y sin burbuja para que se aprecien mejor.'
  },
  {
    id: 'chat-reactions',
    path: '/chat',
    target: 'tour-chat-reactions-demo',
    demo: 'chat-reactions',
    forceDemo: true,
    title: 'Reacciones a mensajes',
    body: 'Mantén pulsado un mensaje y elige una reacción (las mismas de Comunidad: ❤️ 💪 🧴 🔥 ⚡ 🏆). Vuelve a tocarla para quitarla.'
  },
  {
    id: 'chat-voice',
    path: '/chat',
    target: 'tour-chat-voice-demo',
    demo: 'chat-voice',
    forceDemo: true,
    title: 'Mensajes de voz',
    body: 'Al grabar puedes pausar, continuar, escuchar la vista previa, borrar o enviar. En el chat solo suena un audio a la vez.'
  },
  {
    id: 'chat-view-once',
    path: '/chat',
    target: 'tour-chat-view-once-demo',
    demo: 'chat-view-once',
    forceDemo: true,
    title: 'Ver solo una vez',
    body: 'Fotos y audios pueden enviarse para verse una sola vez: aparecen como Foto/Audio bloqueados, al abrir se ven a pantalla completa y luego quedan como Abierto.'
  },
  {
    id: 'chat-reply',
    path: '/chat',
    target: 'tour-chat-reply-demo',
    demo: 'chat-reply',
    forceDemo: true,
    title: 'Responder a un mensaje',
    body: 'Desliza un mensaje (tuyo o del otro) o mantén pulsado y elige Responder. El siguiente texto, foto o audio queda enlazado a esa cita.'
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
    id: 'chat-styles',
    path: '/chat',
    target: 'tour-chat-styles-demo',
    demo: 'chat-styles',
    forceDemo: true,
    title: 'Estilo del chat',
    body: 'Por defecto el chat sigue tu tema claro u oscuro. Si eliges un estilo visual, el encabezado, la caja de mensaje y la barra superior se adaptan al fondo.'
  },
  {
    id: 'chat-shared',
    path: '/chat',
    target: 'tour-chat-shared-demo',
    demo: 'chat-shared',
    forceDemo: true,
    title: 'Archivos y publicaciones',
    body: 'Desde el menú filtra por Publicaciones, Archivos o Enlaces. Los audios y el contenido “ver una vez” no se guardan ahí.'
  },
  {
    id: 'chat-options',
    path: '/chat',
    target: 'tour-chat-options-demo',
    demo: 'chat-options',
    forceDemo: true,
    title: 'Menú del chat',
    body: 'Los tres puntos abren: archivos compartidos, entrenamientos públicos, estilo del chat, vaciar (solo para ti) y crear acceso directo en el inicio.'
  }
]

const CHALLENGE_STEPS = [
  {
    id: 'ch-nav',
    path: '/challenges',
    target: 'nav-challenges',
    title: 'Retos',
    body: 'Compite por metas con XP. Ahora también puedes crear retos por tiempo e invitar a toda la comunidad.'
  },
  {
    id: 'ch-create',
    path: '/challenges',
    target: 'tour-challenges-create',
    title: 'Crear un reto',
    body: 'Define título, tipo y fechas. Elige objetivo por Cantidad o por Tiempo: el cronómetro cuenta hasta la meta y luego registras reps o km.'
  },
  {
    id: 'ch-tabs',
    path: '/challenges',
    target: 'tour-challenges-list',
    title: 'Mis retos y disponibles',
    body: 'Cambia entre Mis Retos y Disponibles. Desde cualquier card puedes Invitar para publicar o compartir fuera de la app.'
  },
  {
    id: 'ch-join',
    path: '/challenges',
    target: 'tour-challenge-join',
    demo: 'challenge-join',
    forceDemo: true,
    title: 'Inscribirte a un reto',
    body: 'En Disponibles, Unirse al Reto te suma como participante. También puedes unirte desde una publicación de reto en Comunidad.'
  },
  {
    id: 'ch-invite',
    path: '/challenges',
    target: 'tour-challenge-invite',
    demo: 'challenge-invite',
    forceDemo: true,
    title: 'Compartir e invitar',
    body: 'Toca Invitar: Comunidad publica la invitación en el feed (con Ver participantes). Invitar al reto genera una imagen para historias en WhatsApp, Instagram o Facebook.'
  },
  {
    id: 'ch-start',
    path: '/challenges',
    target: 'tour-challenge-start',
    demo: 'challenge-start',
    forceDemo: true,
    title: 'Iniciar el reto',
    body: 'Dentro del detalle, Iniciar Reto arranca tu sesión. En tiempo con ejercicios, completa todos lo más rápido posible: al marcar el último se pausa y finaliza solo.'
  },
  {
    id: 'ch-progress',
    path: '/challenges',
    target: 'tour-challenge-progress',
    demo: 'challenge-progress',
    forceDemo: true,
    title: 'Progreso y resultado',
    body: 'En retos por cantidad actualiza tu avance. En retos por tiempo, al llegar a la meta registra repeticiones o kilómetros según el tipo.'
  },
  {
    id: 'ch-complete',
    path: '/challenges',
    target: 'tour-challenge-complete',
    demo: 'challenge-complete',
    forceDemo: true,
    title: 'Finalizar, XP y compartirlo',
    body: 'Al completar recibes XP y puedes publicar el logro en Comunidad. Cuando el reto caduca, las invitaciones del feed se eliminan solas.'
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
    body: 'Tu hub personal: cuerpo, métricas educativas, volumen de entrenos y objetivos.'
  },
  {
    id: 'pr-body',
    path: '/progress',
    target: 'tour-progress-body',
    title: 'Mi cuerpo',
    body: 'Completa altura, peso, sexo y edad. Toca el ícono de info en cada métrica para entender IMC, TMB y más.'
  },
  {
    id: 'pr-stats',
    path: '/progress',
    target: 'tour-progress-stats',
    title: 'Tus números',
    body: 'Entrenamientos, rachas, nivel XP y logros — el pulso rápido de tu consistencia.'
  },
  {
    id: 'pr-charts',
    path: '/progress',
    target: 'tour-progress-charts',
    title: 'Peso y entrenamientos',
    body: 'Peso corporal con check-ins. En “Entrenamientos” ves volumen real (sesiones, ejercicios, series y reps) y una proyección educativa.'
  },
  {
    id: 'pr-coaching',
    path: '/progress',
    target: 'tour-progress-coaching',
    title: 'Lectura estratégica',
    body: 'Si los resultados no coinciden con la proyección, no te frustres: aquí hay consejos y atajos para ajustar objetivos o buscar un profesional.'
  },
  {
    id: 'pr-goals',
    path: '/progress',
    target: 'tour-progress-goals',
    title: 'Objetivos editables',
    body: 'Define peso meta, frecuencia semanal y fecha. Edítalos cuando tu realidad cambie.'
  },
  {
    id: 'pr-guide',
    path: '/progress',
    target: 'tour-progress-guide',
    title: 'Guía + QySi',
    body: 'Tips según tu ficha y un atajo a QySi con nivel y variantes sugeridas del catálogo.'
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

const ESTILOS_QYNTRA_STEPS = [
  {
    id: 'eq-open-settings',
    path: '/dashboard',
    target: 'menu-settings',
    demo: 'menu-settings',
    title: 'Abrir Configuración',
    body: 'Toca tu foto de perfil arriba a la derecha y elige Configuración. Ahí están todas las preferencias de la app, incluida la apariencia.',
    openAvatarMenu: true
  },
  {
    id: 'eq-appearance-nav',
    path: '/settings?section=appearance',
    target: 'tour-settings-appearance-section',
    demo: 'settings-appearance-nav',
    title: 'Apartado Apariencia',
    body: 'Entra a Apariencia. Desde aquí personalizas el look de toda Qyntra: tema y colores de marca.'
  },
  {
    id: 'eq-theme',
    path: '/settings?section=appearance',
    target: 'tour-settings-theme',
    demo: 'settings-theme',
    title: 'Tema claro u oscuro',
    body: 'Elige Oscuro, Claro o Sistema. Sistema sigue el modo de tu teléfono. El cambio se aplica al instante en toda la app.'
  },
  {
    id: 'eq-colors',
    path: '/settings?section=appearance',
    target: 'tour-settings-color-theme',
    demo: 'settings-color-theme',
    title: 'Colores Qyntra',
    body: 'Prueba las combinaciones de color: botones, acentos y detalles se adaptan. Hay muchas opciones nuevas para que la app se sienta tuya.'
  }
]

const STORIES_STEPS = [
  {
    id: 'st-rail',
    path: '/social',
    target: 'tour-stories-rail',
    title: 'Fila de historias',
    body: 'En Comunidad, arriba del feed, ves los estados de quienes sigues. El círculo con + crea el tuyo.'
  },
  {
    id: 'st-create',
    path: '/social',
    target: 'tour-stories-create-demo',
    demo: 'stories-create',
    forceDemo: true,
    title: 'Crear una historia',
    body: 'Sube foto o video (máx. ~30 s), añade descripción con @menciones y publícala. Dura 24 horas.'
  },
  {
    id: 'st-view',
    path: '/social',
    target: 'tour-stories-viewer-demo',
    demo: 'stories-viewer',
    forceDemo: true,
    title: 'Ver y navegar',
    body: 'Toca una burbuja para abrir. Desliza o toca izquierda/derecha para cambiar. La barra superior marca el tiempo.'
  },
  {
    id: 'st-react-reply',
    path: '/social',
    target: 'tour-stories-react-demo',
    demo: 'stories-react',
    forceDemo: true,
    title: 'Reaccionar y responder',
    body: 'En historias ajenas usa las reacciones rápidas o escribe para responder en el chat con la historia adjunta.'
  },
  {
    id: 'st-own',
    path: '/social',
    target: 'tour-stories-own-demo',
    demo: 'stories-own',
    forceDemo: true,
    title: 'Tu estado y vistas',
    body: 'En «Mi estado» ves el ojo con cuántas personas miraron. Ábrelo para la lista, reacciones y mensajes.'
  },
  {
    id: 'st-share',
    path: '/social',
    target: 'tour-stories-share-demo',
    demo: 'stories-share',
    forceDemo: true,
    title: 'Compartir y menú',
    body: 'Desde ⋮ puedes reenviar en chat, guardar, compartir a Facebook/Instagram, meter en favoritos o eliminar.'
  },
  {
    id: 'st-favorites',
    path: '/profile',
    target: 'tour-profile-favorites',
    title: 'Álbumes favoritos',
    body: 'En tu perfil, Favoritos guarda historias destacadas. Mantén pulsada una burbuja propia para editar la portada o renombrar el álbum con el lápiz.'
  }
]

export const TUTORIAL_STEPS = {
  [TUTORIAL_IDS.QUICK_START]: QUICK_START_STEPS,
  [TUTORIAL_IDS.MAIN_NAV]: MAIN_NAV_STEPS,
  [TUTORIAL_IDS.PROFILE_EDIT]: PROFILE_STEPS,
  [TUTORIAL_IDS.WORKOUTS]: WORKOUT_STEPS,
  [TUTORIAL_IDS.COMMUNITY]: COMMUNITY_STEPS,
  [TUTORIAL_IDS.CHAT]: CHAT_STEPS,
  [TUTORIAL_IDS.STORIES]: STORIES_STEPS,
  [TUTORIAL_IDS.CHALLENGES]: CHALLENGE_STEPS,
  [TUTORIAL_IDS.CLASSES]: CLASS_STEPS,
  [TUTORIAL_IDS.INVITES]: INVITE_STEPS,
  [TUTORIAL_IDS.PROGRESS]: PROGRESS_STEPS,
  [TUTORIAL_IDS.REST_TIMES]: REST_TIMES_STEPS,
  [TUTORIAL_IDS.PRIVACY_PERMISSIONS]: PRIVACY_PERMISSIONS_STEPS,
  [TUTORIAL_IDS.ESTILOS_QYNTRA]: ESTILOS_QYNTRA_STEPS,
  [TUTORIAL_IDS.QYSI_TRAINING]: QYSI_TRAINING_STEPS
}

/**
 * Accounts created before this moment get Progress tutorial auto-started on next login.
 * New registrations after this date only see it in the tutorial hub.
 * (Ship window: ~11 ago 2026 noche CST.)
 */
export const BODY_HUB_LEGACY_BEFORE_ISO = '2026-08-12T03:00:00.000Z'

/** QySi cinematic intro to Progress tutorial — active only for 24h after ship. */
export const BODY_HUB_ANNOUNCE_START_ISO = '2026-08-11T18:00:00.000Z'
export const BODY_HUB_ANNOUNCE_UNTIL_ISO = '2026-08-13T12:00:00.000Z'

export const BODY_HUB_UPDATE_SETTING = 'qysiBodyHubUpdateSeen'
export const BODY_HUB_UPDATE_LOCAL = 'qyntra_qysi_body_hub_update_seen'
export const BODY_HUB_UPDATE_EVENT = 'qyntra:open-qysi-body-hub-update'
export const BODY_HUB_UPDATE_DONE_EVENT = 'qyntra:qysi-body-hub-update-done'

export function isBodyHubAnnounceActive(at = Date.now()) {
  const start = new Date(BODY_HUB_ANNOUNCE_START_ISO).getTime()
  const until = new Date(BODY_HUB_ANNOUNCE_UNTIL_ISO).getTime()
  return at >= start && at < until
}

export function isLegacyUserForBodyHub(user) {
  const created = user?.createdAt || user?.created_at
  // Missing date → treat as legacy (cached sessions); new signups always send createdAt.
  if (!created) return true
  const t = new Date(created).getTime()
  if (Number.isNaN(t)) return true
  return t < new Date(BODY_HUB_LEGACY_BEFORE_ISO).getTime()
}

export function hasSeenBodyHubAnnounce(user) {
  if (user?.settings?.[BODY_HUB_UPDATE_SETTING] === true) return true
  const uid = userIdOf(user)
  if (!uid) return false
  try {
    return localStorage.getItem(`${BODY_HUB_UPDATE_LOCAL}:${uid}`) === '1'
  } catch {
    return false
  }
}

/** Auto login prompt: legacy + 24h window. */
export function shouldShowBodyHubAnnounce(user, at = Date.now()) {
  if (!isBodyHubAnnounceActive(at)) return false
  if (!isLegacyUserForBodyHub(user)) return false
  return true
}

/** Intro when starting Progress tutorial during the 24h window (hub or auto). */
export function shouldPlayProgressBodyIntro(user, at = Date.now()) {
  if (!isBodyHubAnnounceActive(at)) return false
  if (!user) return false
  // Always play while the campaign window is open — permanent "seen" must not skip it
  return true
}

export function openBodyHubProgressIntro(detail = {}) {
  try {
    window.dispatchEvent(
      new CustomEvent(BODY_HUB_UPDATE_EVENT, {
        detail: { asProgressIntro: true, force: true, forceReplay: true, ...detail }
      })
    )
  } catch {
    /* ignore */
  }
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

  // QySi welcome also uses a dedicated local key written by the intro overlay
  if (tutorialId === TUTORIAL_IDS.QYSI_WELCOME && uid) {
    try {
      if (localStorage.getItem(`qyntra_qysi_intro_seen:${uid}`) === '1') return true
    } catch {
      /* ignore */
    }
  }
  return false
}
