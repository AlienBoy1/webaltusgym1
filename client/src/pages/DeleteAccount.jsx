import { Link } from 'react-router-dom'
import { FiArrowLeft, FiTrash2, FiSettings } from 'react-icons/fi'
import QyntraLogo from '../components/QyntraLogo'

export default function DeleteAccount() {
  return (
    <div className="min-h-screen bg-[color:var(--bg-base,#0A0A0F)] text-[color:var(--text-primary,#fff)]">
      <header className="border-b border-white/10 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-[color:var(--text-secondary,#aaa)] hover:text-white">
            <FiArrowLeft /> Volver
          </Link>
          <QyntraLogo className="h-8" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--color-primary,#FF6B35)]">Cuenta</p>
        <h1 className="font-display mt-2 text-4xl tracking-wide">Eliminar cuenta</h1>
        <p className="mt-2 text-sm text-[color:var(--text-muted,#888)]">
          Qyntra Gym — solicitud de eliminación de cuenta y datos personales
        </p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-[color:var(--text-secondary,#ccc)]">
          <section>
            <h2 className="text-lg font-semibold text-white">Cómo eliminar tu cuenta</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>Inicia sesión en Qyntra Gym (web o app).</li>
              <li>Ve a <strong className="text-white">Ajustes → Cuenta</strong>.</li>
              <li>Pulsa <strong className="text-white">Eliminar mi cuenta</strong> y confirma.</li>
            </ol>
            <Link
              to="/settings?section=account"
              className="btn-primary mt-4 inline-flex items-center gap-2"
            >
              <FiSettings /> Ir a Ajustes → Cuenta
            </Link>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">Qué datos se eliminan</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Perfil, correo, avatar y configuración de la cuenta.</li>
              <li>Publicaciones, comentarios, historias, mensajes y notificaciones.</li>
              <li>Rutinas, entrenamientos, progreso, retos y participación en clases.</li>
              <li>Relaciones sociales (seguidores, solicitudes, etc.).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">Qué puede conservarse</h2>
            <p className="mt-3">
              Registros de asistencia o membresía gestionados por el administrador de tu gimnasio pueden
              conservarse por obligaciones legales o contables del centro deportivo. Para dudas, contacta
              directamente a tu gimnasio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">Si no puedes acceder a la app</h2>
            <p className="mt-3">
              Escríbenos desde el correo asociado a tu cuenta a los canales oficiales de soporte de Qyntra Gym
              o solicita la eliminación al administrador de tu gimnasio. Indica tu nombre y correo registrado.
            </p>
          </section>

          <section className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <div className="flex gap-3">
              <FiTrash2 className="mt-0.5 shrink-0 text-red-400" size={20} />
              <p>
                La eliminación es <strong className="text-white">permanente</strong> y no se puede deshacer.
              </p>
            </div>
          </section>

          <p className="text-xs text-[color:var(--text-muted,#888)]">
            Ver también nuestra{' '}
            <Link to="/privacidad" className="text-[color:var(--color-primary)] underline">
              Política de Privacidad
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  )
}
