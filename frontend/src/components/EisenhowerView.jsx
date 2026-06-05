import { useState } from 'react';
import { AlertCircle, Calendar, CalendarDays, Trash2, Plus, LayoutGrid, Check } from 'lucide-react';
import { useTodo } from '../context/TodoContext';
import { motion, AnimatePresence } from 'framer-motion';

export function EisenhowerView() {
  const {
    tasks,
    setSelectedTaskId,
    setSelectedSubtaskId,
    handleUpdateTaskPriority: onUpdateTaskPriority,
    handleAddTaskInQuadrant: onAddTaskInQuadrant,
    handleTaskContextMenu: onTaskContextMenu
  } = useTodo();

  const onSelectTask = (id) => {
    setSelectedTaskId(id);
    setSelectedSubtaskId(null);
  };
  const [inlineTitles, setInlineTitles] = useState({
    3: '', // Q1
    2: '', // Q2
    1: '', // Q3
    0: ''  // Q4
  });

  const [dragOverQuadrant, setDragOverQuadrant] = useState(null);

  const quadrants = [
    {
      priority: 3,
      title: 'Importante y Urgente',
      subtitle: 'Hacer Primero (Q1)',
      color: '#ef4444', // Red
      bgColor: 'rgba(239, 68, 68, 0.03)',
      borderColor: 'rgba(239, 68, 68, 0.2)',
      hoverBorderColor: 'rgba(239, 68, 68, 0.4)'
    },
    {
      priority: 2,
      title: 'Importante, No Urgente',
      subtitle: 'Planificar/Agendar (Q2)',
      color: '#3b82f6', // Blue
      bgColor: 'rgba(59, 130, 246, 0.03)',
      borderColor: 'rgba(59, 130, 246, 0.2)',
      hoverBorderColor: 'rgba(59, 130, 246, 0.4)'
    },
    {
      priority: 1,
      title: 'No Importante, Urgente',
      subtitle: 'Delegar (Q3)',
      color: '#f59e0b', // Amber
      bgColor: 'rgba(245, 158, 11, 0.03)',
      borderColor: 'rgba(245, 158, 11, 0.2)',
      hoverBorderColor: 'rgba(245, 158, 11, 0.4)'
    },
    {
      priority: 0,
      title: 'No Importante, No Urgente',
      subtitle: 'Eliminar/Ignorar (Q4)',
      color: '#8e95a5', // Muted Gray
      bgColor: 'rgba(142, 149, 165, 0.03)',
      borderColor: 'rgba(142, 149, 165, 0.2)',
      hoverBorderColor: 'rgba(142, 149, 165, 0.4)'
    }
  ];

  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('taskId', taskId.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e, targetPriority) => {
    e.preventDefault();
    const taskId = parseInt(e.dataTransfer.getData('taskId'), 10);
    if (!isNaN(taskId) && onUpdateTaskPriority) {
      onUpdateTaskPriority(taskId, targetPriority);
    }
  };

  const handleInlineSubmit = async (e, priority) => {
    e.preventDefault();
    const title = inlineTitles[priority].trim();
    if (!title) return;

    if (onAddTaskInQuadrant) {
      await onAddTaskInQuadrant(title, priority);
      setInlineTitles(prev => ({ ...prev, [priority]: '' }));
    }
  };

  const handleToggleTask = async (taskId, currentStatus) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: !currentStatus ? 1 : 0 })
      });
      if (onUpdateTaskPriority) onUpdateTaskPriority(); // Refresh tasks list
    } catch (err) {
      console.error(err);
    }
  };

  const activeIncompleteTasks = tasks.filter(t => !t.is_completed);

  return (
    <div className="eisenhower-view-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: '100%', height: 'auto', padding: '1rem 0' }}>
      
      {/* Header Banner */}
      <div className="eisenhower-header" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <LayoutGrid style={{ color: 'var(--accent-hover)' }} />
          Matriz de Eisenhower
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Clasifica y prioriza tus actividades arrastrándolas entre cuadrantes según su importancia y urgencia.
        </p>
      </div>

      {/* Grid of 4 Quadrants */}
      <div className="eisenhower-grid" style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: '1.25rem',
        flex: 1,
        minHeight: '500px'
      }}>
        {quadrants.map(q => {
          const quadrantTasks = activeIncompleteTasks.filter(t => t.priority === q.priority);
          
          const isDragOver = dragOverQuadrant === q.priority;

          return (
            <motion.div
              key={q.priority}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                handleDrop(e, q.priority);
                setDragOverQuadrant(null);
              }}
              onDragEnter={() => setDragOverQuadrant(q.priority)}
              onDragLeave={() => setDragOverQuadrant(null)}
              animate={{
                backgroundColor: isDragOver ? `${q.color}15` : q.bgColor,
                borderColor: isDragOver ? q.color : q.borderColor,
                scale: isDragOver ? 1.008 : 1,
                boxShadow: isDragOver ? `0 8px 24px ${q.color}15` : "none"
              }}
              transition={{ duration: 0.15 }}
              style={{
                border: `2px dashed ${q.borderColor}`,
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                padding: '1.25rem',
                overflow: 'hidden'
              }}
            >
              {/* Quadrant Title */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: q.color }}>{q.title}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{q.subtitle}</span>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: q.color, background: `${q.color}15`, padding: '2px 8px', borderRadius: '12px' }}>
                  {quadrantTasks.length} {quadrantTasks.length === 1 ? 'tarea' : 'tareas'}
                </span>
              </div>

              {/* Task Items List */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '0.75rem', paddingRight: '4px' }}>
                {quadrantTasks.length === 0 ? (
                  <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem', opacity: 0.5, border: '1px dashed rgba(255,255,255,0.02)', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                    Sin tareas. Arrastra actividades aquí o créalas abajo.
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {quadrantTasks.map(task => (
                      <motion.div
                        key={task.id}
                        layout
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onClick={() => onSelectTask(task.id)}
                        onContextMenu={(e) => {
                          if (onTaskContextMenu) {
                            onTaskContextMenu(e, task);
                          }
                        }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        whileHover={{ y: -2, scale: 1.01, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)' }}
                        whileDrag={{ scale: 1.03, rotate: 1, boxShadow: '0 8px 16px rgba(0,0,0,0.3)' }}
                        transition={{ layout: { type: 'spring', stiffness: 500, damping: 30 }, duration: 0.15 }}
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.05)',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          cursor: 'grab',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        {/* Checkbox */}
                        <div 
                          className="checkbox" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            handleToggleTask(task.id, task.is_completed); 
                          }}
                          style={{ width: '16px', height: '16px', borderRadius: '4px', border: '1px solid var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                          {task.is_completed && <Check size={10} color="#0f1115" />}
                        </div>

                        {/* Title & Info */}
                        <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                          {task.title}
                        </div>

                        {/* Due date indicator */}
                        {task.due_date && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px' }}>
                            <Calendar size={10} />
                            {task.due_date.split(' ')[0]}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>

              {/* Inline Quick Add Form */}
              <form onSubmit={(e) => handleInlineSubmit(e, q.priority)} style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  placeholder="+ Añadir tarea en este cuadrante..."
                  value={inlineTitles[q.priority]}
                  onChange={(e) => setInlineTitles(prev => ({ ...prev, [q.priority]: e.target.value }))}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    padding: '8px 10px',
                    fontSize: '0.8rem',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: q.color,
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={16} />
                </button>
              </form>

            </motion.div>
          );
        })}
      </div>

    </div>
  );
}
