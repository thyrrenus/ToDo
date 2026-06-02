import { useState, useEffect, useRef } from 'react';
import { Search, Compass, ListTodo, Clipboard, Sparkles, X } from 'lucide-react';

export function CommandPalette({ isOpen, onClose, tasks = [], lists = [], onNavigateView, onSelectList }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 100);
    }
  }, [isOpen]);

  // Define static navigation options
  const viewOptions = [
    { type: 'view', id: 'tasks', name: 'Ver Tareas Principal (Listas)', icon: <ListTodo size={16} /> },
    { type: 'view', id: 'kanban', name: 'Ver Tablero Kanban', icon: <Clipboard size={16} /> },
    { type: 'view', id: 'calendar', name: 'Ver Calendario y Agenda', icon: <Compass size={16} /> },
    { type: 'view', id: 'pomodoro', name: 'Iniciar Temporizador Pomodoro', icon: <Sparkles size={16} /> },
    { type: 'view', id: 'eisenhower', name: 'Ver Matriz de Eisenhower', icon: <Clipboard size={16} /> },
    { type: 'view', id: 'gtd', name: 'Ver Flujo GTD (Getting Things Done)', icon: <Compass size={16} /> },
    { type: 'view', id: 'shared', name: 'Ver Equipos y Compartidos', icon: <ListTodo size={16} /> },
    { type: 'view', id: 'settings', name: 'Abrir Configuración de la App', icon: <Sparkles size={16} /> }
  ];

  // Map lists options
  const listOptions = lists.map(l => ({
    type: 'list',
    id: l.id,
    name: `Ir a Lista: ${l.name}`,
    color: l.color,
    icon: <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: l.color || '#3b82f6' }} />
  }));

  // Map task options
  const taskOptions = tasks.filter(t => t.is_completed !== 1).slice(0, 15).map(t => ({
    type: 'task',
    id: t.id,
    name: `Buscar Tarea: ${t.title}`,
    listId: t.list_id,
    icon: <ListTodo size={14} style={{ opacity: 0.6 }} />
  }));

  // Combine all searchable elements
  const allItems = [...viewOptions, ...listOptions, ...taskOptions];

  // Filter items based on user search query
  const filteredItems = allItems.filter(item => 
    item.name.toLowerCase().includes(query.toLowerCase())
  );

  // Handle keyboard events inside palette
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredItems.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          triggerAction(filteredItems[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex]);

  const triggerAction = (item) => {
    if (item.type === 'view') {
      if (onNavigateView) onNavigateView(item.id);
    } else if (item.type === 'list') {
      if (onSelectList) onSelectList(item.id);
    } else if (item.type === 'task') {
      // Switch view to tasks list first, select project list, then open task details
      if (onSelectList) {
        onSelectList(item.listId || 'inbox', item.id);
      }
    }
    onClose();
  };

  // Close palette on backdrop click
  const handleBackdropClick = (e) => {
    if (containerRef.current && !containerRef.current.contains(e.target)) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="modal-overlay" 
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh'
      }}
    >
      <div 
        ref={containerRef}
        className="command-palette-card"
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'rgba(28, 28, 30, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          boxShadow: '0 24px 50px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        {/* Search header row */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Search size={18} color="var(--text-secondary)" style={{ marginRight: '10px' }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Escribe un comando, lista o tarea... (ej: Kanban, Hoy, Reporte)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '0.95rem',
              outline: 'none',
              flex: 1,
              padding: '4px 0'
            }}
          />
          <button 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Results list */}
        <div style={{ maxHeight: '350px', overflowY: 'auto', padding: '8px' }}>
          {filteredItems.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={`${item.type}-${item.id}-${idx}`}
                onClick={() => triggerAction(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  transition: 'background-color 0.15s'
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div style={{ marginRight: '12px', display: 'flex', alignItems: 'center', color: isSelected ? 'var(--accent-hover)' : 'var(--text-secondary)' }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: isSelected ? 'white' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </div>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: '4px' }}>
                  {item.type === 'view' ? 'Acción' : item.type === 'list' ? 'Lista' : 'Tarea'}
                </div>
              </div>
            );
          })}

          {filteredItems.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Ningún resultado coincide con tu búsqueda
            </div>
          )}
        </div>

        {/* Command palette footer hint */}
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', padding: '8px 16px', background: 'rgba(0,0,0,0.15)', borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <span>↑↓ para navegar</span>
          <span>↵ para seleccionar</span>
          <span>esc para salir</span>
        </div>
      </div>
    </div>
  );
}
