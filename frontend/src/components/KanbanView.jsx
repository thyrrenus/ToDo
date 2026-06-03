import { useState } from 'react';
import { Columns, Calendar, ListTodo, Plus, Check } from 'lucide-react';

export function KanbanView({ tasks, lists, onSelectTask, onUpdateTaskPriority, onUpdateTaskList, onAddTaskInQuadrant, onTaskContextMenu }) {
  const [groupBy, setGroupBy] = useState('list'); // 'list', 'priority', 'status'
  const [inlineTitles, setInlineTitles] = useState({});

  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('taskId', taskId.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e, columnId) => {
    e.preventDefault();
    const taskId = parseInt(e.dataTransfer.getData('taskId'), 10);
    if (isNaN(taskId)) return;

    if (groupBy === 'list') {
      // columnId is list_id (or 'inbox' for null)
      const listId = columnId === 'inbox' ? null : parseInt(columnId, 10);
      if (onUpdateTaskList) {
        await onUpdateTaskList(taskId, listId);
      }
    } else if (groupBy === 'priority') {
      // columnId is priority integer (0, 1, 2, 3)
      const priority = parseInt(columnId, 10);
      if (onUpdateTaskPriority) {
        await onUpdateTaskPriority(taskId, priority);
      }
    } else if (groupBy === 'status') {
      // columnId is status ('pending', 'completed')
      const isCompleted = columnId === 'completed' ? 1 : 0;
      try {
        await fetch(`/api/tasks/${taskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_completed: isCompleted })
        });
        if (onUpdateTaskPriority) onUpdateTaskPriority(); // Refresh trigger
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleInlineSubmit = async (e, columnId) => {
    e.preventDefault();
    const title = (inlineTitles[columnId] || '').trim();
    if (!title) return;

    let taskData = {
      title,
      priority: 0,
      list_id: null
    };

    if (groupBy === 'list') {
      taskData.list_id = columnId === 'inbox' ? null : parseInt(columnId, 10);
    } else if (groupBy === 'priority') {
      taskData.priority = parseInt(columnId, 10);
    } else if (groupBy === 'status') {
      taskData.is_completed = columnId === 'completed' ? 1 : 0;
    }

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
      if (res.ok) {
        setInlineTitles(prev => ({ ...prev, [columnId]: '' }));
        if (onUpdateTaskPriority) onUpdateTaskPriority(); // Refresh trigger
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleTask = async (taskId, currentStatus) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: !currentStatus ? 1 : 0 })
      });
      if (onUpdateTaskPriority) onUpdateTaskPriority(); // Refresh trigger
    } catch (err) {
      console.error(err);
    }
  };

  // Define columns dynamically based on groupBy
  let columns = [];
  if (groupBy === 'list') {
    columns = [
      { id: 'inbox', title: 'Inbox', color: '#8e95a5' },
      ...lists.filter(l => l.name.toLowerCase() !== 'inbox').map(l => ({ id: l.id.toString(), title: l.name, color: l.color || '#3b82f6' }))
    ];
  } else if (groupBy === 'priority') {
    columns = [
      { id: '3', title: 'Importante y Urgente (Q1)', color: '#ef4444' },
      { id: '2', title: 'Importante, No Urgente (Q2)', color: '#3b82f6' },
      { id: '1', title: 'No Importante, Urgente (Q3)', color: '#f59e0b' },
      { id: '0', title: 'No Importante, No Urgente (Q4)', color: '#8e95a5' }
    ];
  } else if (groupBy === 'status') {
    columns = [
      { id: 'pending', title: 'Pendientes', color: '#f59e0b' },
      { id: 'completed', title: 'Completadas', color: '#10b981' }
    ];
  }

  // Get tasks for a specific column
  const getColumnTasks = (colId) => {
    if (groupBy === 'list') {
      if (colId === 'inbox') {
        const inboxList = lists.find(l => l.name.toLowerCase() === 'inbox');
        const inboxListId = inboxList ? inboxList.id : null;
        return tasks.filter(t => !t.is_completed && (t.list_id === null || t.list_id === inboxListId));
      }
      return tasks.filter(t => !t.is_completed && t.list_id === parseInt(colId, 10));
    } else if (groupBy === 'priority') {
      return tasks.filter(t => !t.is_completed && t.priority === parseInt(colId, 10));
    } else if (groupBy === 'status') {
      if (colId === 'pending') return tasks.filter(t => !t.is_completed);
      return tasks.filter(t => t.is_completed);
    }
    return [];
  };

  return (
    <div className="kanban-view-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', padding: '1rem 0', overflow: 'hidden' }}>
      
      {/* Kanban Header */}
      <div className="kanban-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Columns style={{ color: 'var(--accent-hover)' }} />
            Tablero Kanban
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Visualiza tu flujo de trabajo, administra tareas en columnas arrastrándolas.
          </p>
        </div>

        {/* Group By selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '4px 12px', borderRadius: '30px', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Agrupar por:</span>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            <option value="list" style={{ background: '#1c1c1c' }}>📂 Listas (GTD)</option>
            <option value="priority" style={{ background: '#1c1c1c' }}>🎯 Prioridad (Eisenhower)</option>
            <option value="status" style={{ background: '#1c1c1c' }}>🔄 Estado (Completado)</option>
          </select>
        </div>
      </div>

      {/* Board Columns container */}
      <div 
        className="kanban-board" 
        style={{
          display: 'flex',
          gap: '1.25rem',
          flex: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          paddingBottom: '0.5rem',
          alignItems: 'stretch'
        }}
      >
        {columns.map(col => {
          const colTasks = getColumnTasks(col.id);
          
          return (
            <div
              key={col.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, col.id)}
              style={{
                width: '280px',
                minWidth: '280px',
                background: 'rgba(255, 255, 255, 0.015)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                padding: '1rem',
                overflow: 'hidden'
              }}
              onDragEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
              onDragLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {/* Column Title */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: `2px solid ${col.color}`, paddingBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                  {col.title}
                </h3>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '10px' }}>
                  {colTasks.length}
                </span>
              </div>

              {/* Tasks List inside Column */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '0.75rem', paddingRight: '4px' }}>
                {colTasks.length === 0 ? (
                  <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem', opacity: 0.4, border: '1px dashed rgba(255,255,255,0.02)', borderRadius: '8px', padding: '1.5rem', textAlign: 'center' }}>
                    Arrastra tareas aquí o créalas abajo.
                  </div>
                ) : (
                  colTasks.map(task => {
                    const totalSubtasks = task.subtasks?.length || 0;
                    const completedSubtasks = task.subtasks?.filter(st => st.is_completed === 1).length || 0;

                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onClick={() => onSelectTask(task.id)}
                        onContextMenu={(e) => {
                          if (onTaskContextMenu) {
                            onTaskContextMenu(e, task);
                          }
                        }}
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.05)',
                          borderLeft: `3px solid ${col.color}`,
                          borderRadius: '8px',
                          padding: '10px 12px',
                          cursor: 'grab',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          transition: 'background-color 0.2s, transform 0.1s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {/* Checkbox */}
                          <div 
                            className="checkbox" 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              handleToggleTask(task.id, task.is_completed); 
                            }}
                            style={{ 
                              width: '14px', 
                              height: '14px', 
                              borderRadius: '3px', 
                              border: '1px solid var(--text-secondary)', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              cursor: 'pointer',
                              flexShrink: 0
                            }}
                          >
                            {task.is_completed && <Check size={8} color="#0f1115" />}
                          </div>

                          {/* Task Title */}
                          <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {task.title}
                          </span>
                        </div>

                        {/* Task Meta indicators */}
                        {(task.due_date || totalSubtasks > 0) && (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                            {task.due_date && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                                <Calendar size={10} />
                                {task.due_date.split(' ')[0]}
                              </div>
                            )}
                            {totalSubtasks > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                                <ListTodo size={10} />
                                {completedSubtasks}/{totalSubtasks}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Quick Add Form */}
              <form onSubmit={(e) => handleInlineSubmit(e, col.id)} style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                <input
                  type="text"
                  placeholder="+ Añadir tarea..."
                  value={inlineTitles[col.id] || ''}
                  onChange={(e) => setInlineTitles(prev => ({ ...prev, [col.id]: e.target.value }))}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    padding: '6px 8px',
                    fontSize: '0.75rem',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: col.color,
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={14} />
                </button>
              </form>

            </div>
          );
        })}
      </div>

    </div>
  );
}
