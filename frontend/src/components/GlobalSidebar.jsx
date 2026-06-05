import { CheckSquare, CalendarDays, Timer, LayoutGrid, Briefcase, Columns, BarChart2, Users, Settings, Shield, LogOut } from 'lucide-react';
import { useTodo } from '../context/TodoContext';

export function GlobalSidebar() {
  const { mainView, setMainView, logout: onLogout, user } = useTodo();
  return (
    <nav className="global-sidebar">
      <button 
        className={`global-nav-item ${mainView === 'tasks' ? 'active' : ''}`}
        onClick={() => setMainView('tasks')}
        title="Tasks"
      >
        <CheckSquare size={24} />
      </button>
      <button 
        className={`global-nav-item ${mainView === 'calendar' ? 'active' : ''}`}
        onClick={() => setMainView('calendar')}
        title="Calendar"
      >
        <CalendarDays size={24} />
      </button>
      <button 
        className={`global-nav-item ${mainView === 'pomodoro' ? 'active' : ''}`}
        onClick={() => setMainView('pomodoro')}
        title="Pomodoro"
      >
        <Timer size={24} />
      </button>
      <button 
        className={`global-nav-item ${mainView === 'eisenhower' ? 'active' : ''}`}
        onClick={() => setMainView('eisenhower')}
        title="Eisenhower Matrix"
      >
        <LayoutGrid size={24} />
      </button>
      <button 
        className={`global-nav-item ${mainView === 'gtd' ? 'active' : ''}`}
        onClick={() => setMainView('gtd')}
        title="GTD Workflow"
      >
        <Briefcase size={24} />
      </button>
      <button 
        className={`global-nav-item ${mainView === 'kanban' ? 'active' : ''}`}
        onClick={() => setMainView('kanban')}
        title="Kanban Board"
      >
        <Columns size={24} />
      </button>
      <button 
        className={`global-nav-item ${mainView === 'analytics' ? 'active' : ''}`}
        onClick={() => setMainView('analytics')}
        title="Analytics Dashboard"
      >
        <BarChart2 size={24} />
      </button>
      <button 
        className={`global-nav-item ${mainView === 'shared' ? 'active' : ''}`}
        onClick={() => setMainView('shared')}
        title="Equipos & Compartido"
      >
        <Users size={24} />
      </button>
      {user?.role === 'admin' && (
        <button 
          className={`global-nav-item ${mainView === 'admin' ? 'active' : ''}`}
          onClick={() => setMainView('admin')}
          title="Panel de Administración"
          style={{ color: '#a78bfa' }}
        >
          <Shield size={24} />
        </button>
      )}
      <button 
        className={`global-nav-item ${mainView === 'settings' ? 'active' : ''}`}
        onClick={() => setMainView('settings')}
        title="Configuración del Entorno"
        style={{ marginTop: 'auto', marginBottom: '0.5rem' }}
      >
        <Settings size={24} />
      </button>
      {onLogout && (
        <button 
          className="global-nav-item"
          onClick={onLogout}
          title={`Cerrar sesión (${user?.username || 'Usuario'})`}
          style={{ marginBottom: '0.5rem', color: 'var(--danger-color, #ef4444)', opacity: 0.8 }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
        >
          <LogOut size={24} />
        </button>
      )}
    </nav>
  );
}
