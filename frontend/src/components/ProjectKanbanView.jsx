import { useState, useEffect } from 'react';
import { Plus, Check, Calendar, AlignLeft, Trash2, Edit, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTodo } from '../context/TodoContext';

export function ProjectKanbanView() {
  const {
    tasks,
    sections,
    activeList,
    setSelectedTaskId,
    setSelectedSubtaskId,
    handleToggleTask: onToggleTask,
    fetchTasks: onRefreshTasks,
    fetchSections: onRefreshSections
  } = useTodo();

  const onSelectTask = (id) => {
    setSelectedTaskId(id);
    setSelectedSubtaskId(null);
  };
  const [newSectionName, setNewSectionName] = useState('');
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [quickAddTitles, setQuickAddTitles] = useState({}); // { sectionId: 'text' }
  const [activeDragSectionId, setActiveDragSectionId] = useState(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [activeColumnId, setActiveColumnId] = useState('none');

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Filter tasks for this project list
  const projectTasks = tasks.filter(t => t.list_id === activeList);
  
  // Filter sections belonging to this project list
  const projectSections = sections.filter(s => s.list_id === activeList);

  // Drag and Drop Handlers
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('taskId', taskId.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleUpdateTaskSection = async (taskId, sectionId) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_id: sectionId })
      });
      if (onRefreshTasks) onRefreshTasks();
    } catch (err) {
      console.error(err);
    }
  };

  // Quick Task Injection inside a Column/Section
  const handleQuickAddTask = async (e, sectionId) => {
    e.preventDefault();
    const title = quickAddTitles[sectionId || 'none'];
    if (!title || !title.trim()) return;

    const taskData = {
      title: title.trim(),
      list_id: activeList,
      section_id: sectionId || null,
      priority: 0
    };

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
      if (res.ok) {
        setQuickAddTitles(prev => ({ ...prev, [sectionId || 'none']: '' }));
        if (onRefreshTasks) onRefreshTasks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Section Creation directly as a Kanban Column
  const handleCreateSection = async (e) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;

    try {
      const res = await fetch('/api/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          list_id: activeList,
          name: newSectionName.trim()
        })
      });
      if (res.ok) {
        setNewSectionName('');
        setIsAddingSection(false);
        if (onRefreshSections) onRefreshSections();
        if (onRefreshTasks) onRefreshTasks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Section deletion
  const handleDeleteSection = async (sectionId) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta sección? Las tareas que estén adentro no serán eliminadas.')) return;
    try {
      await fetch(`/api/sections/${sectionId}`, { method: 'DELETE' });
      if (onRefreshSections) onRefreshSections();
      if (onRefreshTasks) onRefreshTasks();
    } catch (err) {
      console.error(err);
    }
  };

  // Section rename
  const handleRenameSection = async (section) => {
    const name = prompt('Nuevo nombre para la sección:', section.name);
    if (name && name.trim() !== section.name) {
      try {
        await fetch(`/api/sections/${section.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim() })
        });
        if (onRefreshSections) onRefreshSections();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const getPriorityColor = (priority) => {
    if (priority === 3) return '#ef4444'; // Q1 Red
    if (priority === 2) return '#3b82f6'; // Q2 Blue
    if (priority === 1) return '#f59e0b'; // Q3 Orange
    return '#6b7280'; // Q4 Gray
  };

  const renderTaskCard = (task) => {
    const isCompleted = task.is_completed === 1 || task.is_completed === true;
    return (
      <div
        key={task.id}
        draggable={!isMobile}
        onDragStart={(e) => {
          if (isMobile) return;
          handleDragStart(e, task.id);
        }}
        onClick={() => onSelectTask(task.id)}
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--border-color)',
          borderLeft: `3px solid ${getPriorityColor(task.priority)}`,
          borderRadius: '8px',
          padding: '10px 12px',
          cursor: 'grab',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          transition: 'transform 0.15s ease, background 0.15s ease'
        }}
        className="analytics-card"
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <div 
            onClick={(e) => { e.stopPropagation(); onToggleTask(task.id, task.is_completed); }}
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '4px',
              border: '2px solid var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              marginTop: '2px',
              flexShrink: 0
            }}
          >
            {isCompleted && <Check size={10} color="#0f1115" style={{ fontWeight: 800 }} />}
          </div>
          <span style={{
            fontSize: '0.85rem',
            color: 'var(--text-primary)',
            fontWeight: 500,
            textDecoration: isCompleted ? 'line-through' : 'none',
            opacity: isCompleted ? 0.6 : 1,
            wordBreak: 'break-word',
            lineHeight: 1.3
          }}>
            {task.title}
          </span>
        </div>

        {/* Task Card Meta */}
        {(task.due_date || (task.description && task.description !== '<p><br></p>')) && (
          <div style={{ display: 'flex', gap: '10px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            {task.description && task.description !== '<p><br></p>' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }} title="Tiene descripción">
                <AlignLeft size={10} /> Detalles
              </div>
            )}
            {task.due_date && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <Calendar size={10} />
                {format(parseISO(task.due_date), 'd MMM')}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderColumn = (sectionId, columnName, columnTasks) => {
    const isDragOver = activeDragSectionId === sectionId;
    return (
      <div 
        key={sectionId || 'none'}
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={() => setActiveDragSectionId(sectionId)}
        onDragLeave={() => setActiveDragSectionId(null)}
        onDrop={(e) => {
          const taskId = e.dataTransfer.getData('taskId');
          if (taskId) {
            handleUpdateTaskSection(taskId, sectionId);
          }
          setActiveDragSectionId(null);
        }}
        style={{
          width: '280px',
          background: 'rgba(255,255,255,0.01)',
          border: isDragOver ? '2px dashed var(--accent-hover)' : '1px solid var(--border-color)',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: '480px',
          flexShrink: 0,
          transition: 'all 0.15s ease'
        }}
      >
        {/* Column Header */}
        <div style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.01)',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {columnName}
            </h4>
            <span style={{
              fontSize: '0.7rem',
              color: 'var(--text-secondary)',
              background: 'rgba(255,255,255,0.04)',
              padding: '2px 6px',
              borderRadius: '10px',
              fontWeight: 600
            }}>
              {columnTasks.length}
            </span>
          </div>

          {/* Section Options (only if it is a real section, not "Sin sección") */}
          {sectionId && (
            <div style={{ display: 'flex', gap: '2px' }}>
              <button 
                onClick={() => handleRenameSection({ id: sectionId, name: columnName })}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '3px' }}
                title="Renombrar sección"
              >
                <Edit size={12} />
              </button>
              <button 
                onClick={() => handleDeleteSection(sectionId)}
                style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.7)', cursor: 'pointer', padding: '3px' }}
                title="Eliminar sección"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Column Scrollable Task Area */}
        <div style={{
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          flex: 1,
          overflowY: 'auto'
        }}>
          {columnTasks.map(t => renderTaskCard(t))}
        </div>

        {/* Column Footer (Quick Add Task) */}
        <form 
          onSubmit={(e) => handleQuickAddTask(e, sectionId)}
          style={{
            padding: '10px 12px',
            borderTop: '1px solid var(--border-color)',
            background: 'rgba(0,0,0,0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '4px 8px' }}>
            <Plus size={14} style={{ color: 'var(--text-secondary)', marginRight: '6px' }} />
            <input 
              type="text" 
              placeholder="Nueva tarea..."
              value={quickAddTitles[sectionId || 'none'] || ''}
              onChange={(e) => setQuickAddTitles(prev => ({ ...prev, [sectionId || 'none']: e.target.value }))}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                width: '100%',
                outline: 'none',
                fontFamily: 'inherit'
              }}
            />
          </div>
        </form>
      </div>
    );
  };

  const cols = [
    { id: 'none', title: 'Sin Sección 📥', sectionId: null, tasks: projectTasks.filter(t => !t.section_id) },
    ...projectSections.map(s => ({ id: s.id.toString(), title: s.name, sectionId: s.id, tasks: projectTasks.filter(t => t.section_id === s.id) }))
  ];

  const currentActiveColumnId = cols.some(c => c.id === activeColumnId) ? activeColumnId : 'none';

  return (
    <div 
      className={isMobile ? "kanban-lists-container" : ""}
      style={{
        display: 'flex',
        gap: '1.25rem',
        overflowX: 'auto',
        minHeight: '100%',
        height: 'auto',
        padding: '0.25rem 0 1rem 0',
        alignItems: 'flex-start',
        animation: 'fadeIn 0.25s ease',
        flexDirection: isMobile ? 'column' : 'row',
        width: '100%'
      }}
    >
      {isMobile && cols.length > 0 && (
        <div className="kanban-mobile-tabs" style={{ width: '100%' }}>
          {cols.map(col => (
            <button
              key={col.id}
              className={`kanban-mobile-tab-btn ${currentActiveColumnId === col.id ? 'active' : ''}`}
              onClick={() => setActiveColumnId(col.id)}
              type="button"
            >
              {col.title} ({col.tasks.length})
            </button>
          ))}
        </div>
      )}

      {cols
        .filter(c => !isMobile || c.id === currentActiveColumnId)
        .map(col => renderColumn(col.sectionId, col.title, col.tasks))
      }

      {/* 3. "Añadir Sección" Column Button */}
      {(!isMobile || currentActiveColumnId === 'none') && (
        isAddingSection ? (
          <form 
            onSubmit={handleCreateSection}
            style={{
              width: '260px',
              background: 'rgba(255,255,255,0.02)',
              border: '1.5px dashed var(--accent-hover)',
              borderRadius: '12px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              flexShrink: 0
            }}
          >
            <input 
              type="text"
              placeholder="Nombre de la sección..."
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              autoFocus
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '6px 10px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                fontFamily: 'inherit',
                outline: 'none'
              }}
            />
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                onClick={() => setIsAddingSection(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  padding: '4px 8px'
                }}
              >
                Cancelar
              </button>
              <button 
                type="submit"
                style={{
                  background: 'var(--accent-hover)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  padding: '4px 10px'
                }}
              >
                Añadir
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setIsAddingSection(true)}
            style={{
              width: '240px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px dashed var(--border-color)',
              borderRadius: '12px',
              padding: '14px',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              flexShrink: 0,
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.borderColor = 'var(--accent-hover)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <Plus size={16} /> Añadir Columna / Sección
          </button>
        )
      )}
    </div>
  );
}
