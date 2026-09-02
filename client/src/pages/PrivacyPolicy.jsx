import { Link } from 'react-router-dom'
import { FiArrowLeft } from 'react-icons/fi'
import QyntraLogo from '../components/QyntraLogo'

export default function PrivacyPolicy() {
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
        <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--color-primary,#FF6B35)]">Legal</p>
        <h1 className="font-display mt-2 text-4xl tracking-wide">Política de Privacidad</h1>
        <p className="mt-2 text-sm text-[color:var(--text-muted,#888)]">Última actualización: 2 de septiembre de 2026</p>

        <div className="prose prose-invert mt-8 max-w-none space-y-6 text-sm leading-relaxed text-[color:var(--text-secondary,#ccc)]">
          <section>
            <h2 className="text-lg font-semibold text-white">1. Responsable</h2>
            <p>
              Qyntra Gym («nosotros») opera la aplicación web y móvil Qyntra Gym. Esta política describe cómo
              recopilamos, usamos y protegemos tus datos personales cuando utilizas nuestros servicios.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">2. Datos que recopilamos</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Datos de cuenta: nombre, correo electrónico, foto de perfil y credenciales de acceso.</li>
              <li>Datos de gimnasio: membresía, asistencia, clases reservadas y rutinas de entrenamiento.</li>
              <li>Contenido generado: publicaciones, comentarios, mensajes de chat, historias y métricas corporales que elijas registrar.</li>
              <li>Datos técnicos: identificadores de dispositivo, tokens de notificaciones push y registros básicos de uso para seguridad.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">3. Cómo usamos tus datos</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Autenticación, gestión de cuenta y acceso a funciones de la app.</li>
              <li>Coordinación con el administrador de tu gimnasio (membresías, clases, reportes).</li>
              <li>Funciones sociales, mensajería, progreso y gamificación dentro de la comunidad.</li>
              <li>Envío de notificaciones sobre actividad relevante (puedes desactivarlas en Ajustes).</li>
              <li>Mejora de seguridad, prevención de abuso y soporte técnico.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">4. Base legal y consentimiento</h2>
            <p>
              Tratamos tus datos para ejecutar el servicio contratado con tu gimnasio y, cuando corresponda,
              con tu consentimiento explícito (por ejemplo, al aceptar términos, activar notificaciones o
              vincular Google). Puedes retirar permisos desde los ajustes del dispositivo o de la app.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">5. Compartición de datos</h2>
            <p>
              No vendemos tus datos personales. Compartimos información solo con proveedores necesarios para
              operar el servicio (alojamiento, base de datos, autenticación y correo), con administradores
              autorizados de tu gimnasio y cuando la ley lo exija.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">6. Almacenamiento y seguridad</h2>
            <p>
              Los datos se almacenan en infraestructura cloud con cifrado en tránsito (HTTPS/TLS).
              Aplicamos controles de acceso, autenticación y buenas prácticas de seguridad. Ningún sistema
              es 100 % infalible; te recomendamos usar contraseñas fuertes y no compartir tu cuenta.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">7. Retención</h2>
            <p>
              Conservamos tus datos mientras mantengas una cuenta activa o sea necesario para cumplir
              obligaciones legales o resolver disputas. Puedes solicitar eliminación contactando al
              administrador de tu gimnasio o a soporte oficial de Qyntra Gym.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">8. Tus derechos</h2>
            <p>
              Según tu jurisdicción, puedes solicitar acceso, rectificación, eliminación, portabilidad u
              oposición al tratamiento de tus datos. Para ejercerlos, contacta al administrador de tu gimnasio
              o a los canales oficiales de Qyntra Gym.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">9. Menores de edad</h2>
            <p>
              El servicio está dirigido a usuarios registrados por un gimnasio. Si eres menor de edad, el
              registro debe ser autorizado por un tutor o el administrador del centro deportivo.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">10. Cambios</h2>
            <p>
              Podemos actualizar esta política. Publicaremos la versión vigente en esta URL. El uso continuado
              de la app después de un cambio implica tu aceptación de la política actualizada.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">11. Contacto</h2>
            <p>
              Para dudas sobre privacidad: contacta al administrador de tu gimnasio o escribe a los canales
              oficiales de soporte de Qyntra Gym indicados en la aplicación.
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
