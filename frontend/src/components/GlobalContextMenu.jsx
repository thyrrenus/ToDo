import { useEffect, useRef } from 'react';
import { 
  Sun, Sunrise, CalendarDays, Calendar, CalendarOff, Flag,
  CheckCircle2, Timer, FolderInput, Copy, Link as LinkIcon, Trash2, FileText
} from 'lucide-react';

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
  onUpdateTask,
  onStartPomodoro,
  onDelete,
  onOpenDetails,
  onDuplicate,
  showToast
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

  const handleCopyLink = () => {
    const link = `${window.location.origin}/task/${task.id}`;
    navigator.clipboard.writeText(link)
      .then(() => {
        if (showToast) showToast('Enlace de la tarea copiado');
      })
      .catch(err => {
        console.error('Error al copiar enlace:', err);
      });
    onClose();
  };

  return (
    <div 
      ref={menuRef}
      className="calendar-context-menu premium-context-menu"
      style={{
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        zIndex: 10000
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Date Quick Shortcuts */}
      <div className="context-menu-label">Fecha</div>
      <div className="context-menu-quick-row">
        <button 
          onClick={() => { onReschedule(task.id, 0); onClose(); }} 
          title="Hoy"
        >
          <Sun size={15} color="#eab308" />
        </button>
        <button 
          onClick={() => { onReschedule(task.id, 1); onClose(); }} 
          title="Mañana"
        >
          <Sunrise size={15} color="#f97316" />
        </button>
        <button 
          onClick={() => { onReschedule(task.id, 7); onClose(); }} 
          title="Próxima semana"
        >
          <CalendarDays size={15} color="#3b82f6" />
        </button>
        <button 
          style={{ position: 'relative' }} 
          title="Seleccionar fecha"
        >
          <Calendar size={15} color="#10b981" />
          <input 
            type="date"
            value={task.due_date ? task.due_date.split('T')[0] : ''}
            onChange={(e) => {
              onUpdateTask(task.id, { due_date: e.target.value || null });
              onClose();
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: 'pointer'
            }}
          />
        </button>
        <button 
          onClick={() => { onUpdateTask(task.id, { due_date: null }); onClose(); }} 
          title="Sin fecha"
        >
          <CalendarOff size={15} color="#8e95a5" />
        </button>
      </div>

      {/* 2. Priority Quick Shortcuts */}
      <div className="context-menu-label" style={{ marginTop: '4px' }}>Prioridad</div>
      <div className="context-menu-quick-row priority-row">
        <button 
          className={`prio-btn prio-3 ${task.priority === 3 ? 'active' : ''}`}
          onClick={() => { onUpdatePriority(task.id, 3); onClose(); }}
          title="Urgente e Importante (Alta)"
        >
          <Flag size={15} fill={task.priority === 3 ? '#ef4444' : 'transparent'} color="#ef4444" />
        </button>
        <button 
          className={`prio-btn prio-2 ${task.priority === 2 ? 'active' : ''}`}
          onClick={() => { onUpdatePriority(task.id, 2); onClose(); }}
          title="Importante no Urgente (Media)"
        >
          <Flag size={15} fill={task.priority === 2 ? '#f59e0b' : 'transparent'} color="#f59e0b" />
        </button>
        <button 
          className={`prio-btn prio-1 ${task.priority === 1 ? 'active' : ''}`}
          onClick={() => { onUpdatePriority(task.id, 1); onClose(); }}
          title="Urgente no Importante (Baja)"
        >
          <Flag size={15} fill={task.priority === 1 ? '#3b82f6' : 'transparent'} color="#3b82f6" />
        </button>
        <button 
          className={`prio-btn prio-0 ${task.priority === 0 ? 'active' : ''}`}
          onClick={() => { onUpdatePriority(task.id, 0); onClose(); }}
          title="Ninguna"
        >
          <Flag size={15} fill="transparent" color="#8e95a5" />
        </button>
      </div>

      <div className="context-menu-divider" />

      {/* 3. Text actions */}
      <div 
        className="context-menu-item" 
        onClick={() => {
          onToggleComplete(task.id, isCompleted);
          onClose();
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={14} color={isCompleted ? '#a1a1aa' : 'var(--text-secondary)'} />
          <span>{isCompleted ? 'Marcar como Pendiente' : 'Marcar como Completada'}</span>
        </div>
      </div>

      <div 
        className="context-menu-item" 
        onClick={() => {
          onOpenDetails(task.id);
          onClose();
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={14} />
          <span>Abrir Detalles / Subtareas</span>
        </div>
      </div>

      {/* Move to list options with flyout */}
      {lists.length > 0 && (
        <div className="context-menu-submenu-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderInput size={14} />
            <span>Mover a Lista</span>
          </div>
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
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: list.color || '#8e95a5' }} />
                {list.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Start Focus / Pomodoro */}
      <div 
        className="context-menu-item" 
        onClick={() => {
          onStartPomodoro(task.id);
          onClose();
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-hover)' }}>
          <Timer size={14} />
          <span style={{ fontWeight: 600 }}>Enfocarse (Pomodoro)</span>
        </div>
      </div>

      <div className="context-menu-divider" />

      {/* Duplicar Tarea */}
      <div 
        className="context-menu-item" 
        onClick={() => {
          onDuplicate(task);
          onClose();
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Copy size={14} />
          <span>Duplicar Tarea</span>
        </div>
      </div>

      {/* Copiar Enlace */}
      <div 
        className="context-menu-item" 
        onClick={handleCopyLink}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LinkIcon size={14} />
          <span>Copiar Enlace</span>
        </div>
      </div>

      <div className="context-menu-divider" />

      {/* Delete Option */}
      <div 
        className="context-menu-item delete-option"
        onClick={() => {
          onDelete(task.id);
          onClose();
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Trash2 size={14} />
          <span>Eliminar Tarea</span>
        </div>
      </div>
    </div>
  );
}
