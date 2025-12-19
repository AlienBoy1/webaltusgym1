import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiArrowRight, FiZap, FiUsers, FiTrendingUp, FiSmartphone } from 'react-icons/fi'

const features = [
  { icon: FiZap, title: 'Entrena Inteligente', desc: 'Rutinas personalizadas según tus metas' },
  { icon: FiUsers, title: 'Comunidad Activa', desc: 'Comparte tu progreso y motívate' },
  { icon: FiTrendingUp, title: 'Seguimiento Total', desc: 'Mide cada aspecto de tu evolución' },
  { icon: FiSmartphone, title: 'Siempre Contigo', desc: 'Funciona offline en cualquier dispositivo' },
]

const motivationalQuotes = [
  "Hoy es un buen día para mejorar",
  "Cada paso te acerca más a tu meta",
  "Tu único límite eres tú"
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-dark-500 relative overflow-hidden noise">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-accent-cyan/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-0 w-64 h-64 bg-accent-purple/10 rounded-full blur-3xl" />
      </div>
      
      {/* Header */}
      <header className="relative z-10 px-6 py-4">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg glow-primary"
            >
              <span className="font-display text-2xl">A</span>
            </motion.div>
            <span className="font-display text-3xl tracking-wider">ALTUS</span>
          </div>
          
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-gray-300 hover:text-white transition-colors">
              Ingresar
            </Link>
            <Link to="/register" className="btn-primary flex items-center gap-2">
              Comenzar <FiArrowRight />
            </Link>
          </div>
        </nav>
      </header>
      
      {/* Hero Section */}
      <section className="relative z-10 px-6 py-20 md:py-32">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <span className="inline-block bg-primary-500/10 text-primary-500 px-4 py-2 rounded-full text-sm font-medium mb-6">
              🏋️ La revolución del fitness está aquí
            </span>
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="font-display text-6xl md:text-8xl lg:text-9xl tracking-tight mb-6"
          >
            <span className="gradient-text">SUPERA</span>
            <br />
            <span className="text-white">TUS LÍMITES</span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto mb-10"
          >
            La plataforma más completa para gestionar tu gimnasio y alcanzar 
            tus metas de entrenamiento con una comunidad que te impulsa.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link to="/register" className="btn-primary text-lg px-8 py-4 flex items-center justify-center gap-2">
              Comienza Gratis <FiArrowRight />
            </Link>
            <a href="#features" className="btn-secondary text-lg px-8 py-4">
              Conoce Más
            </a>
          </motion.div>
          
          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-20 grid grid-cols-3 gap-8 max-w-3xl mx-auto"
          >
            {[
              { value: '10K+', label: 'Usuarios Activos' },
              { value: '500+', label: 'Gimnasios' },
              { value: '1M+', label: 'Entrenamientos' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="font-display text-4xl md:text-5xl text-primary-500">{stat.value}</div>
                <div className="text-gray-500 text-sm">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>
      
      {/* Features Section */}
      <section id="features" className="relative z-10 px-6 py-20 bg-dark-400/50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-4xl md:text-6xl mb-4">
              TODO LO QUE <span className="text-primary-500">NECESITAS</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              Una plataforma diseñada para potenciar tu rendimiento
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="card group hover:bg-dark-100 cursor-pointer"
              >
                <div className="w-14 h-14 bg-primary-500/10 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-primary-500/20 transition-colors">
                  <feature.icon size={28} className="text-primary-500" />
                </div>
                <h3 className="font-display text-2xl mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Motivational Section */}
      <section className="relative z-10 px-6 py-32 overflow-hidden">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary-500/20 to-accent-cyan/20 rounded-3xl blur-3xl" />
            <div className="relative glass rounded-3xl p-12">
              <div className="text-6xl mb-6">💪</div>
              <h2 className="font-display text-4xl md:text-5xl mb-6">
                "{motivationalQuotes[0]}"
              </h2>
              <p className="text-gray-400 text-lg mb-8">
                Únete a miles de personas que ya están transformando sus vidas
              </p>
              <Link to="/register" className="btn-primary text-lg px-8 py-4 inline-flex items-center gap-2">
                Únete Ahora <FiArrowRight />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="relative z-10 px-6 py-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
              <span className="font-display text-lg">A</span>
            </div>
            <span className="font-display text-2xl">ALTUS GYM</span>
          </div>
          
          <p className="text-gray-500 text-sm">
            © 2024 ALTUS GYM. Todos los derechos reservados.
          </p>
          
          <div className="flex gap-6">
            <a href="#" className="text-gray-400 hover:text-white transition-colors">Privacidad</a>
            <a href="#" className="text-gray-400 hover:text-white transition-colors">Términos</a>
            <a href="#" className="text-gray-400 hover:text-white transition-colors">Contacto</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

