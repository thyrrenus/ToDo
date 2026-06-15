import { useState, memo } from 'react';
import { Check, Calendar as CalendarIcon, ListTodo, AlignLeft, Plus, ChevronDown, ChevronRight, Trash2, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export const TaskItem = memo(function TaskItem({ task, isSelected, selectedSubtaskId, onClick, onToggle, onSelectSubtask, onSubtaskAdded, onContextMenu, isSyncing }) {
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [localSyncingSubtaskIds, setLocalSyncingSubtaskIds] = useState(new Set());

  if (!task) return null;

  const isNote = task.type === 'note';
  const isCompleted = (task.is_completed === 1 || task.is_completed === true) && !isNote;
  const isOverdue = task.due_date && !isCompleted && !isNote && new Date(task.due_date.split('T')[0]) < new Date(new Date().toISOString().split('T')[0]);
  const todayStr = new Date().toISOString().split('T')[0];
  const deadlineStr = task.deadline_date && typeof task.deadline_date === 'string' ? task.deadline_date.split('T')[0] : null;
  const isDeadlineExceeded = !!(deadlineStr && !isCompleted && deadlineStr < todayStr);
  const isDeadlineToday = !!(deadlineStr && !isCompleted && deadlineStr === todayStr);
  const subtasks = task.subtasks || [];
  const totalSubtasks = subtasks.length;
  const completedSubtasks = subtasks.filter(st => st.is_completed === 1 || st.is_completed === true).length;

  const handleAddSubtask = async (e) => {
    if (e) e.preventDefault();
    if (!subtaskTitle.trim()) {
      setIsAddingSubtask(false);
      return;
    }

    try {
      const res = await fetch('/api/subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: task.id, title: subtaskTitle.trim() })
      });
      if (res.ok) {
        setSubtaskTitle('');
        setIsAddingSubtask(false);
        setIsExpanded(true); // Auto expand to show new subtask
        if (onSubtaskAdded) onSubtaskAdded();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleSubtask = async (subtaskId, currentStatus) => {
    setLocalSyncingSubtaskIds(prev => {
      const next = new Set(prev);
      next.add(subtaskId);
      return next;
    });
    try {
      const res = await fetch(`/api/subtasks/${subtaskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: !currentStatus ? 1 : 0 })
      });
      if (res.ok && onSubtaskAdded) onSubtaskAdded();
    } catch (err) {
      console.error(err);
    } finally {
      setLocalSyncingSubtaskIds(prev => {
        const next = new Set(prev);
        next.delete(subtaskId);
        return next;
      });
    }
  };

  const handleDeleteSubtask = async (e, subtaskId) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`/api/subtasks/${subtaskId}`, {
        method: 'DELETE'
      });
      if (res.ok && onSubtaskAdded) onSubtaskAdded();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDragStart = (e) => {
    e.dataTransfer.setData('taskId', task.id.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div 
      className={`task-item-container simple-item ${isCompleted ? 'completed' : ''} ${isSelected ? 'selected' : ''}`} 
      onClick={onClick}
      draggable={true}
      onDragStart={handleDragStart}
      onContextMenu={(e) => {
        if (onContextMenu) {
          onContextMenu(e, task);
        }
      }}
      style={{ 
        cursor: 'grab',
        borderLeft: isDeadlineExceeded 
          ? '3px solid var(--danger-color)' 
          : isDeadlineToday 
            ? '3px solid #f59e0b' 
            : '3px solid transparent'
      }}
    >
      <div className="task-item-main-row">
        <div 
          className="subtask-toggle-chevron"
          onClick={(e) => {
            e.stopPropagation();
            if (totalSubtasks > 0) setIsExpanded(!isExpanded);
          }}
        >
          {totalSubtasks > 0 ? (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <div style={{ width: 14 }} />
          )}
        </div>

        {isNote ? (
          <div 
            className="note-icon"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '18px',
              height: '18px',
              marginRight: '6px',
              color: 'var(--text-secondary)',
              opacity: 0.85
            }}
          >
            <FileText size={15} />
          </div>
        ) : (
          <div 
            className={`checkbox ${isSyncing ? 'syncing' : ''}`} 
            onClick={(e) => { 
              e.stopPropagation(); 
              if (!isSyncing) onToggle(); 
            }}
            style={isSyncing ? { pointerEvents: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' } : {}}
          >
            {isSyncing ? (
              <div className="checkbox-spinner" />
            ) : (
              isCompleted && <Check size={14} color="#0f1115" />
            )}
          </div>
        )}
        
        <div className="task-content">
          <div className="task-title-wrapper">
            <div className="task-title">{task.title}</div>
            
            {!isNote && (
              <div className="task-item-actions">
                <button 
                  className="icon-btn add-subtask-btn" 
                  onClick={(e) => { e.stopPropagation(); setIsAddingSubtask(true); }} 
                  title="Añadir subtarea"
                >
                  <Plus size={14} />
                </button>
              </div>
            )}
          </div>

          {isAddingSubtask && (
            <form 
              className="inline-add-subtask-form" 
              onSubmit={handleAddSubtask} 
              onClick={e => e.stopPropagation()}
            >
              <input 
                type="text" 
                placeholder="Nombre de la subtarea..." 
                value={subtaskTitle} 
                onChange={e => setSubtaskTitle(e.target.value)} 
                autoFocus
                onBlur={() => {
                  setTimeout(() => {
                    setIsAddingSubtask(false);
                    setSubtaskTitle('');
                  }, 200);
                }}
                className="inline-subtask-input"
              />
            </form>
          )}

          {(task.due_date || totalSubtasks > 0 || (task.description && task.description !== '<p><br></p>') || (task.tags && task.tags.length > 0)) && (
            <div className="task-meta" style={{ flexWrap: 'wrap', gap: '6px' }}>
              {task.tags && task.tags.map(tag => (
                <span 
                  key={tag.id} 
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '10px',
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: '8px',
                    backgroundColor: `${tag.color || '#8e95a5'}15`,
                    color: tag.color || 'var(--text-secondary)',
                    border: `1px solid ${tag.color || '#8e95a5'}33`,
                    boxShadow: `0 0 6px ${tag.color || '#8e95a5'}05`,
                    marginRight: '2px'
                  }}
                >
                  #{tag.name}
                </span>
              ))}
              {task.description && task.description !== '<p><br></p>' && (
                <div className="task-meta-item">
                  <AlignLeft size={12} />
                </div>
              )}
              {task.due_date && (
                <div className="task-meta-item" style={isOverdue ? { color: 'var(--danger-color)', backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)' } : {}}>
                  <CalendarIcon size={12} /> 
                  {format(parseISO(task.due_date), 'MMM d')}
                </div>
              )}
              {task.deadline_date && (
                <div 
                  className="task-meta-item" 
                  style={
                    isDeadlineExceeded 
                      ? { color: 'var(--danger-color)', backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.25)', fontWeight: 700 } 
                      : isDeadlineToday 
                        ? { color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.25)', fontWeight: 700 } 
                        : { opacity: 0.75 }
                  }
                >
                  <span>🚨 Límite: {isDeadlineToday ? 'Hoy' : (() => {
                    try {
                      return format(parseISO(task.deadline_date), 'MMM d');
                    } catch (e) {
                      return task.deadline_date;
                    }
                  })()}</span>
                </div>
              )}
              {task.estimated_effort > 0 && (
                <div className="task-meta-item" style={{ opacity: 0.8, color: 'var(--text-secondary)' }}>
                  <span>⏱️ {task.estimated_effort}h</span>
                </div>
              )}
              {totalSubtasks > 0 && (
                <div className="task-meta-item">
                  <ListTodo size={12} />
                  {completedSubtasks}/{totalSubtasks}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {totalSubtasks > 0 && isExpanded && (
        <div className="task-item-subtasks-list" onClick={e => e.stopPropagation()}>
          {subtasks.map(st => {
            const stCompleted = st.is_completed === 1 || st.is_completed === true;
            const isSubtaskSelected = selectedSubtaskId === st.id;
            const isSubtaskSyncing = localSyncingSubtaskIds.has(st.id);
            return (
              <div 
                key={st.id} 
                className={`task-item-subtask-row ${stCompleted ? 'completed' : ''} ${isSubtaskSelected ? 'selected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelectSubtask) onSelectSubtask(st.id);
                }}
              >
                <div 
                  className={`checkbox subtask-checkbox ${isSubtaskSyncing ? 'syncing' : ''}`} 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (!isSubtaskSyncing) handleToggleSubtask(st.id, st.is_completed); 
                  }}
                  style={isSubtaskSyncing ? { pointerEvents: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' } : {}}
                >
                  {isSubtaskSyncing ? (
                    <div className="checkbox-spinner" style={{ width: 8, height: 8 }} />
                  ) : (
                    stCompleted && <Check size={10} color="#0f1115" />
                  )}
                </div>
                <span className="subtask-title-text">{st.title}</span>
                {st.due_date && (
                  <span className="subtask-date-badge" style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto', marginRight: '6px' }}>
                    <CalendarIcon size={10} />
                    {format(parseISO(st.due_date), 'MMM d')}
                  </span>
                )}
                {isSubtaskSelected && <AlignLeft size={12} className="subtask-details-icon" style={{ marginLeft: st.due_date ? '0' : 'auto' }} />}
                
                <button 
                  className="icon-btn danger subtask-delete-btn" 
                  onClick={(e) => handleDeleteSubtask(e, st.id)}
                  title="Eliminar subtarea"
                  style={{
                    marginLeft: (st.due_date || isSubtaskSelected) ? '4px' : 'auto',
                    padding: '2px',
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.task === nextProps.task &&
         prevProps.isSelected === nextProps.isSelected &&
         prevProps.selectedSubtaskId === nextProps.selectedSubtaskId &&
         prevProps.isSyncing === nextProps.isSyncing;
});
