import { motion, AnimatePresence } from 'framer-motion'
import { FiX, FiCheck } from 'react-icons/fi'

export default function TermsModal({ isOpen, onClose, onAccept }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-2xl">Términos y Condiciones</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-dark-200 rounded-lg"
              >
                <FiX size={24} />
              </button>
            </div>
            
            <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
              <section>
                <h3 className="text-lg font-semibold text-white mb-3">1. Aceptación de Términos</h3>
                <p>
                  Al solicitar acceso y utilizar la aplicación Altus Gym, usted acepta cumplir con estos términos y condiciones. 
                  Si no está de acuerdo con alguno de estos términos, no debe utilizar la aplicación.
                </p>
              </section>
              
              <section>
                <h3 className="text-lg font-semibold text-white mb-3">2. Registro y Cuenta de Usuario</h3>
                <p>
                  Para utilizar Altus Gym, debe completar el proceso de registro proporcionando información precisa y completa. 
                  Es responsable de mantener la confidencialidad de su contraseña y de todas las actividades que ocurran bajo su cuenta.
                </p>
              </section>
              
              <section>
                <h3 className="text-lg font-semibold text-white mb-3">3. Uso de la Aplicación</h3>
                <p>
                  Usted se compromete a utilizar Altus Gym únicamente para fines legales y de acuerdo con estos términos. 
                  No debe utilizar la aplicación de manera que pueda dañar, deshabilitar o sobrecargar nuestros servidores.
                </p>
              </section>
              
              <section>
                <h3 className="text-lg font-semibold text-white mb-3">4. Membresías y Pagos</h3>
                <p>
                  Las membresías se gestionan directamente con el administrador del gimnasio. Los pagos se realizan en persona. 
                  Altus Gym no procesa pagos en línea. La información de membresía es gestionada por el administrador.
                </p>
              </section>
              
              <section>
                <h3 className="text-lg font-semibold text-white mb-3">5. Contenido del Usuario</h3>
                <p>
                  Usted es responsable del contenido que publique en la aplicación, incluyendo publicaciones, comentarios y mensajes. 
                  No debe publicar contenido ofensivo, ilegal o que viole los derechos de otros.
                </p>
              </section>
              
              <section>
                <h3 className="text-lg font-semibold text-white mb-3">6. Privacidad</h3>
                <p>
                  Respetamos su privacidad y protegemos sus datos personales de acuerdo con nuestra Política de Privacidad. 
                  Sus datos se utilizan únicamente para proporcionar y mejorar nuestros servicios.
                </p>
              </section>
              
              <section>
                <h3 className="text-lg font-semibold text-white mb-3">7. Propiedad Intelectual</h3>
                <p>
                  Todo el contenido de Altus Gym, incluyendo diseño, texto, gráficos y software, es propiedad de Altus Gym 
                  y está protegido por leyes de propiedad intelectual.
                </p>
              </section>
              
              <section>
                <h3 className="text-lg font-semibold text-white mb-3">8. Limitación de Responsabilidad</h3>
                <p>
                  Altus Gym no se hace responsable de lesiones o daños que puedan ocurrir durante el uso de las instalaciones 
                  o al seguir rutinas de ejercicio sugeridas. Siempre consulte con un profesional de la salud antes de comenzar 
                  cualquier programa de ejercicio.
                </p>
              </section>
              
              <section>
                <h3 className="text-lg font-semibold text-white mb-3">9. Modificaciones</h3>
                <p>
                  Nos reservamos el derecho de modificar estos términos en cualquier momento. Las modificaciones entrarán en vigor 
                  inmediatamente después de su publicación en la aplicación.
                </p>
              </section>
              
              <section>
                <h3 className="text-lg font-semibold text-white mb-3">10. Contacto</h3>
                <p>
                  Para cualquier pregunta sobre estos términos, puede contactar a su administrador de Altus Gym o a través 
                  de los canales oficiales de la aplicación.
                </p>
              </section>
            </div>
            
            <div className="mt-8 pt-6 border-t border-white/10">
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  onClick={onAccept}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  <FiCheck size={20} />
                  Acepto los términos
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

