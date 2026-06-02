import { Sparkles, Plus } from 'lucide-react';

const MOTIVATIONAL_QUOTES = {
  today: [
    "¡Tu día está completamente libre! Un gran momento para descansar o planear lo que sigue.",
    "Todo al día por hoy. ¡Excelente trabajo manteniendo el enfoque!",
    "No hay tareas urgentes para hoy. Disfruta de la tranquilidad y recarga energías.",
    "El día de hoy está en blanco. ¿Qué tal si añades un hábito positivo?"
  ],
  inbox: [
    "Tu bandeja de entrada está impecable. Tu mente también debería estarlo.",
    "Todo limpio aquí. Escribe tus ideas o tareas rápidas para sacarlas de tu cabeza.",
    "Sin tareas pendientes en el Inbox. ¡Un espacio libre para nuevas metas!",
    "Bandeja despejada. La claridad mental empieza con una bandeja de entrada vacía."
  ],
  upcoming: [
    "No hay actividades programadas a futuro. ¡Disfruta del presente!",
    "Tu calendario futuro está despejado. Un lienzo en blanco para tus próximos proyectos.",
    "Sin vencimientos próximos a la vista. Relájate y enfócate en el ahora.",
    "Próximos días sin compromisos. ¡Excelente planificación!"
  ],
  folder: [
    "Esta carpeta está lista para ser llenada de grandes ideas.",
    "Aún no hay listas en esta carpeta. Agrégalas para estructurar tus metas.",
    "Organiza tu día agrupando tus proyectos de trabajo o personales aquí.",
    "El orden es la clave de la productividad. Comienza a añadir tus listas."
  ],
  generic: [
    "Esta lista está impecable. ¿Listo para añadir tu primer objetivo?",
    "Sin tareas aquí. Un nuevo comienzo para realizar tus metas.",
    "Haz que las cosas sucedan. Comienza añadiendo una tarea sencilla.",
    "Un espacio despejado. Da el primer paso escribiendo tu próxima actividad."
  ]
};

export function EmptyState({ type = 'generic', onActionClick, actionLabel = 'Añadir tarea' }) {
  const quotes = MOTIVATIONAL_QUOTES[type] || MOTIVATIONAL_QUOTES.generic;
  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

  const renderIllustration = () => {
    switch (type) {
      case 'today':
        return (
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 0 12px rgba(245, 158, 11, 0.35))' }}>
            <circle cx="60" cy="60" r="28" fill="url(#sunGlow)" />
            <circle cx="60" cy="60" r="22" fill="#fbbf24" />
            <path d="M60 12V24M60 96V108M12 60H24M96 60H108M26.06 26.06L34.54 34.54M85.46 85.46L93.94 93.94M26.06 93.94L34.54 85.46M85.46 34.54L93.94 26.06" stroke="#fbbf24" strokeWidth="6" strokeLinecap="round" />
            <defs>
              <radialGradient id="sunGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" transform="translate(60 60) rotate(90) scale(28)">
                <stop stopColor="#fbbf24" stopOpacity="0.4" />
                <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
              </radialGradient>
            </defs>
          </svg>
        );
      case 'inbox':
        return (
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 0 12px rgba(59, 130, 246, 0.3))' }}>
            <path d="M25 45L60 25L95 45M25 45V85C25 87.76 27.24 90 30 90H90C92.76 90 95 87.76 95 85V45M25 45L60 62L95 45" stroke="#60a5fa" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M48 72H72" stroke="#3b82f6" strokeWidth="5" strokeLinecap="round" />
          </svg>
        );
      case 'upcoming':
        return (
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 0 12px rgba(167, 139, 250, 0.3))' }}>
            <rect x="25" y="30" width="70" height="65" rx="8" stroke="#a78bfa" strokeWidth="5" />
            <path d="M25 48H95M45 20V32M75 20V32" stroke="#a78bfa" strokeWidth="5" strokeLinecap="round" />
            <circle cx="48" cy="65" r="5" fill="#818cf8" />
            <circle cx="72" cy="65" r="5" fill="#a78bfa" />
            <circle cx="48" cy="80" r="5" fill="#a78bfa" />
            <circle cx="72" cy="80" r="5" fill="#c084fc" />
          </svg>
        );
      case 'folder':
        return (
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 0 12px rgba(16, 185, 129, 0.3))' }}>
            <path d="M20 35C20 32.24 22.24 30 25 30H50L62 45H95C97.76 45 100 47.24 100 50V85C100 87.76 97.76 90 95 90H25C22.24 90 20 87.76 20 85V35Z" stroke="#34d399" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="60" cy="68" r="8" stroke="#10b981" strokeWidth="4" />
          </svg>
        );
      default:
        return (
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 0 12px rgba(236, 72, 153, 0.25))' }}>
            <rect x="30" y="25" width="60" height="70" rx="6" stroke="#f472b6" strokeWidth="5" />
            <path d="M45 45H75M45 60H75M45 75H65M50 15H70" stroke="#f472b6" strokeWidth="5" strokeLinecap="round" />
          </svg>
        );
    }
  };

  return (
    <div 
      className="empty-state-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 2rem',
        borderRadius: '16px',
        background: 'rgba(255, 255, 255, 0.01)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.03)',
        textAlign: 'center',
        maxWidth: '480px',
        margin: '2rem auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        animation: 'fadeIn 0.4s ease'
      }}
    >
      <div style={{ marginBottom: '1.5rem', transform: 'scale(1)', transition: 'transform 0.3s' }}>
        {renderIllustration()}
      </div>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--accent-hover)', fontWeight: 700, fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
        <Sparkles size={14} /> Todo Organizado
      </div>

      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '0 0 1.5rem 0', maxWidth: '360px', fontStyle: 'italic' }}>
        "{randomQuote}"
      </p>

      {onActionClick && (
        <button
          onClick={onActionClick}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'linear-gradient(135deg, var(--accent-color) 0%, var(--accent-hover) 100%)',
            border: 'none',
            color: 'white',
            borderRadius: '24px',
            padding: '8px 18px',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(124, 58, 237, 0.3)',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(124, 58, 237, 0.4)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 15px rgba(124, 58, 237, 0.3)';
          }}
        >
          <Plus size={14} /> {actionLabel}
        </button>
      )}
    </div>
  );
}
