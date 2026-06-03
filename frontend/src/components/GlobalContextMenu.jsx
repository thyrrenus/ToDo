import { useEffect, useRef } from 'react';

export function GlobalContextMenu({ 
  task, 
  x, 
  y, 
  lists = [], 
  onClose,
  onToggleComplete,
  onUpdatePriority,
  onMoveToList,
  onReschedule,
  onStartPomodoro,
  onDelete
}) {
  const menuRef = useRef(null);

  // Close context menu if clicked outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [onClose]);

  const isCompleted = task.is_completed === 1 || task.is_completed === true;

  return (
    <div 
      ref={menuRef}
      className="calendar-context-menu" // Reusing the high-quality styles defined in index.css
      style={{
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        zIndex: 10000
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Complete / Pending Option */}
      <div 
        className="context-menu-item" 
        onClick={() => {
          onToggleComplete(task.id, isCompleted);
          onClose();
        }}
      >
        <span>{isCompleted ? '⏳ Marcar como Pendiente' : '✅ Marcar como Completada'}</span>
      </div>

      {/* Focus / Pomodoro option */}
      <div 
        className="context-menu-item" 
        onClick={() => {
          onStartPomodoro(task.id);
          onClose();
        }}
        style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', padding: '10px 12px' }}
      >
        <span style={{ fontWeight: 600, color: 'var(--accent-hover)' }}>⏱️ Enfocarse (Pomodoro)</span>
      </div>

      {/* Postpone / Reschedule Option */}
      <div className="context-menu-submenu-header">
        <span>📅 Programar / Posponer</span>
        <div className="context-menu-submenu">
          <div className="context-menu-item" onClick={() => { onReschedule(task.id, 0); onClose(); }}>📅 Hoy</div>
          <div className="context-menu-item" onClick={() => { onReschedule(task.id, 1); onClose(); }}>🌅 Mañana</div>
          <div className="context-menu-item" onClick={() => { onReschedule(task.id, 7); onClose(); }}>🗓️ Próxima Semana</div>
          <div className="context-menu-divider" />
          <div className="context-menu-item" onClick={() => { onReschedule(task.id, null); onClose(); }}>❌ Quitar fecha</div>
        </div>
      </div>

      {/* Priority Options */}
      <div className="context-menu-submenu-header">
        <span>🎯 Prioridad</span>
        <div className="context-menu-submenu">
          <div className="context-menu-item" onClick={() => { onUpdatePriority(task.id, 3); onClose(); }}>🔴 Urgente e Importante</div>
          <div className="context-menu-item" onClick={() => { onUpdatePriority(task.id, 2); onClose(); }}>🟡 Importante no Urgente</div>
          <div className="context-menu-item" onClick={() => { onUpdatePriority(task.id, 1); onClose(); }}>🔵 Urgente no Importante</div>
          <div className="context-menu-item" onClick={() => { onUpdatePriority(task.id, 0); onClose(); }}>⚪ Ninguna</div>
        </div>
      </div>

      {/* Move to list options */}
      {lists.length > 0 && (
        <div className="context-menu-submenu-header">
          <span>📁 Mover a Lista</span>
          <div className="context-menu-submenu">
            {lists.map(list => (
              <div 
                key={list.id} 
                className="context-menu-item"
                onClick={() => {
                  onMoveToList(task.id, list.id);
                  onClose();
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: list.color }} />
                {list.name}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="context-menu-divider" />
      
      {/* Delete Option */}
      <div 
        className="context-menu-item delete-option"
        onClick={() => {
          onDelete(task.id);
          onClose();
        }}
      >
        <span>🗑️ Eliminar</span>
      </div>
    </div>
  );
}
