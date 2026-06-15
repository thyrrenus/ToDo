import { useState, useEffect, useRef } from 'react';
import { Search, Compass, ListTodo, Clipboard, Sparkles, X, Plus } from 'lucide-react';
import { useTodo } from '../context/TodoContext';

export function CommandPalette({ isOpen, onClose, tasks = [], lists = [], onNavigateView, onSelectList }) {
  const { handleQuickAdd, showToast } = useTodo();
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
    { type: 'view', id: 'tasks', name: 'Ver Tareas Principal (Listas)', subtitle: 'Vista de la aplicación', icon: <ListTodo size={16} /> },
    { type: 'view', id: 'kanban', name: 'Ver Tablero Kanban', subtitle: 'Vista de la aplicación', icon: <Clipboard size={16} /> },
    { type: 'view', id: 'calendar', name: 'Ver Calendario y Agenda', subtitle: 'Vista de la aplicación', icon: <Compass size={16} /> },
    { type: 'view', id: 'pomodoro', name: 'Iniciar Temporizador Pomodoro', subtitle: 'Vista de la aplicación', icon: <Sparkles size={16} /> },
    { type: 'view', id: 'eisenhower', name: 'Ver Matriz de Eisenhower', subtitle: 'Vista de la aplicación', icon: <Clipboard size={16} /> },
    { type: 'view', id: 'gtd', name: 'Ver Flujo GTD (Getting Things Done)', subtitle: 'Vista de la aplicación', icon: <Compass size={16} /> },
    { type: 'view', id: 'shared', name: 'Ver Equipos y Compartidos', subtitle: 'Vista de la aplicación', icon: <ListTodo size={16} /> },
    { type: 'view', id: 'settings', name: 'Abrir Configuración de la App', subtitle: 'Vista de la aplicación', icon: <Sparkles size={16} /> }
  ];

  // Map lists options
  const listOptions = lists.map(l => ({
    type: 'list',
    id: l.id,
    name: `Ir a Lista: ${l.name}`,
    subtitle: 'Lista de tareas',
    color: l.color,
    icon: <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: l.color || '#3b82f6' }} />
  }));

  // Map task options
  const taskOptions = tasks.filter(t => t.is_completed !== 1).slice(0, 30).map(t => {
    const parentList = lists.find(l => l.id === t.list_id);
    const parentListName = parentList ? parentList.name : 'Inbox';
    return {
      type: 'task',
      id: t.id,
      name: t.title,
      subtitle: `en lista "${parentListName}"`,
      listId: t.list_id,
      icon: <ListTodo size={14} style={{ opacity: 0.6 }} />
    };
  });

  // Combine all searchable elements
  const allItems = [...viewOptions, ...listOptions, ...taskOptions];

  // Filter items based on user search query
  const filteredItems = allItems.filter(item => 
    item.name.toLowerCase().includes(query.toLowerCase()) ||
    (item.subtitle && item.subtitle.toLowerCase().includes(query.toLowerCase()))
  );

  // Prepend task creation option if query is not empty
  if (query.trim()) {
    filteredItems.unshift({
      type: 'create_task',
      id: 'create_task_cmd',
      name: `Crear tarea: "${query.trim()}"`,
      subtitle: 'Presiona Enter para crear esta tarea globalmente',
      queryText: query.trim(),
      icon: <Plus size={16} style={{ color: 'var(--accent-hover)' }} />
    });
  }

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

  const triggerAction = async (item) => {
    if (item.type === 'create_task') {
      try {
        const createdTask = await handleQuickAdd(null, item.queryText);
        if (createdTask) {
          if (showToast) {
            showToast('Tarea creada', `"${createdTask.title}" se añadió correctamente.`, 'success');
          }
          if (onSelectList) {
            onSelectList(createdTask.list_id || 'inbox', createdTask.id);
          }
        }
      } catch (err) {
        console.error(err);
      }
    } else if (item.type === 'view') {
      if (onNavigateView) onNavigateView(item.id);
    } else if (item.type === 'list') {
      if (onSelectList) onSelectList(item.id);
    } else if (item.type === 'task') {
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

  // Highlight search text match
  const highlightMatch = (text, search) => {
    if (!search.trim()) return <span>{text}</span>;
    const escapedQuery = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === search.toLowerCase() 
            ? <strong key={i} style={{ color: 'var(--accent-hover)', fontWeight: 'bold' }}>{part}</strong>
            : <span key={i}>{part}</span>
        )}
      </span>
    );
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
          background: 'rgba(20, 20, 22, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          boxShadow: '0 24px 50px rgba(0, 0, 0, 0.7), 0 0 40px rgba(124, 58, 237, 0.15)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        {/* Search header row */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Search size={20} color="var(--text-secondary)" style={{ marginRight: '12px' }} />
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
              fontSize: '1rem',
              outline: 'none',
              flex: 1,
              padding: '4px 0'
            }}
          />
          <button 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Results list */}
        <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '10px' }}>
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
                  border: isSelected ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid transparent',
                  boxShadow: isSelected ? '0 4px 12px rgba(0, 0, 0, 0.15)' : 'none',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div style={{ marginRight: '14px', display: 'flex', alignItems: 'center', color: isSelected ? 'var(--accent-hover)' : 'var(--text-secondary)', transition: 'color 0.15s' }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: isSelected ? 'white' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {highlightMatch(item.name, query)}
                  </div>
                  {item.subtitle && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.7, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {highlightMatch(item.subtitle, query)}
                    </div>
                  )}
                </div>
                <div style={{ 
                  fontSize: '0.68rem', 
                  color: isSelected ? 'white' : 'var(--text-muted)', 
                  fontWeight: 'bold',
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px', 
                  background: isSelected ? 'rgba(124, 58, 237, 0.3)' : 'rgba(255,255,255,0.03)', 
                  padding: '2px 8px', 
                  borderRadius: '5px',
                  marginLeft: '8px',
                  transition: 'all 0.15s ease'
                }}>
                  {item.type === 'view' ? 'Acción' : item.type === 'list' ? 'Lista' : item.type === 'create_task' ? 'Nuevo' : 'Tarea'}
                </div>
              </div>
            );
          })}

          {filteredItems.length === 0 && (
            <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              Ningún resultado coincide con tu búsqueda
            </div>
          )}
        </div>

        {/* Command palette footer hint */}
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', padding: '10px 16px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><kbd style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.1)' }}>↑↓</kbd> navegar</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><kbd style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.1)' }}>↵</kbd> seleccionar</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><kbd style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.1)' }}>esc</kbd> salir</span>
        </div>
      </div>
    </div>
  );
}
