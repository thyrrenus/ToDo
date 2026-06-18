import { useState, useEffect, useMemo } from 'react';
import { Calendar, Plus, LayoutGrid, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { useTodo } from '../context/TodoContext';
import { motion, AnimatePresence } from 'framer-motion';

export function EisenhowerView() {
  const {
    tasks,
    lists,
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

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [inlineTitles, setInlineTitles] = useState({ 3: '', 2: '', 1: '', 0: '' });
  const [dragOverQuadrant, setDragOverQuadrant] = useState(null);

  // ── Feature 1: List filter ──────────────────────────────────────────────
  const [selectedListId, setSelectedListId] = useState('all'); // 'all' | list.id

  // ── Feature 3: Collapsed list-groups within a quadrant ─────────────────
  const [collapsedGroups, setCollapsedGroups] = useState({}); // key: `${qPriority}-${listId}`

  const toggleGroup = (key) => setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Helper: list color / name ───────────────────────────────────────────
  const getListMeta = (listId) => {
    const list = lists.find(l => l.id === listId);
    return {
      name: list?.name || 'Sin lista',
      color: list?.color || '#8e95a5'
    };
  };

  const quadrants = [
    { priority: 3, title: 'Importante y Urgente',     subtitle: 'Hacer Primero (Q1)',     color: '#ef4444', bgColor: 'rgba(239,68,68,0.03)',    borderColor: 'rgba(239,68,68,0.2)',    hoverBorderColor: 'rgba(239,68,68,0.4)' },
    { priority: 2, title: 'Importante, No Urgente',   subtitle: 'Planificar/Agendar (Q2)', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.03)',   borderColor: 'rgba(59,130,246,0.2)',   hoverBorderColor: 'rgba(59,130,246,0.4)' },
    { priority: 1, title: 'No Importante, Urgente',   subtitle: 'Delegar (Q3)',            color: '#f59e0b', bgColor: 'rgba(245,158,11,0.03)',   borderColor: 'rgba(245,158,11,0.2)',   hoverBorderColor: 'rgba(245,158,11,0.4)' },
    { priority: 0, title: 'No Importante, No Urgente',subtitle: 'Eliminar/Ignorar (Q4)',   color: '#8e95a5', bgColor: 'rgba(142,149,165,0.03)',  borderColor: 'rgba(142,149,165,0.2)',  hoverBorderColor: 'rgba(142,149,165,0.4)' }
  ];

  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('taskId', taskId.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e, targetPriority) => {
    e.preventDefault();
    const taskId = parseInt(e.dataTransfer.getData('taskId'), 10);
    if (!isNaN(taskId) && onUpdateTaskPriority) onUpdateTaskPriority(taskId, targetPriority);
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
      if (onUpdateTaskPriority) onUpdateTaskPriority();
    } catch (err) { console.error(err); }
  };

  // ── Filtered tasks (Feature 1) ──────────────────────────────────────────
  const activeIncompleteTasks = useMemo(() => {
    const base = tasks.filter(t => !t.is_completed);
    if (selectedListId === 'all') return base;
    return base.filter(t => (t.list_id ?? 'inbox') === selectedListId);
  }, [tasks, selectedListId]);

  // ── Lists with at least one active task (for chip bar) ──────────────────
  const listsWithTasks = useMemo(() => {
    const base = tasks.filter(t => !t.is_completed);
    const seen = new Set();
    const result = [];
    base.forEach(t => {
      const key = t.list_id ?? 'inbox';
      if (!seen.has(key)) {
        seen.add(key);
        const meta = getListMeta(t.list_id);
        result.push({ id: key, name: meta.name, color: meta.color });
      }
    });
    return result;
  }, [tasks, lists]);

  // ── Group tasks by list within a quadrant (Feature 3) ──────────────────
  const groupByList = (taskArr) => {
    const groups = {};
    taskArr.forEach(t => {
      const key = t.list_id ?? 'inbox';
      if (!groups[key]) groups[key] = { ...getListMeta(t.list_id), listId: key, tasks: [] };
      groups[key].tasks.push(t);
    });
    return Object.values(groups);
  };

  const shouldGroup = selectedListId === 'all';

  return (
    <div className="eisenhower-view-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '100%', height: 'auto', padding: '1rem 0' }}>

      {/* Header */}
      <div className="eisenhower-header" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <LayoutGrid style={{ color: 'var(--accent-hover)' }} />
          Matriz de Eisenhower
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Clasifica y prioriza tus actividades arrastrándolas entre cuadrantes según su importancia y urgencia.
        </p>
      </div>

      {/* ── Feature 1: List filter chip bar ────────────────────────────── */}
      {listsWithTasks.length > 1 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* "Todas" chip */}
          <button
            onClick={() => setSelectedListId('all')}
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '0.78rem',
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
              border: selectedListId === 'all' ? '1.5px solid var(--accent-hover)' : '1.5px solid rgba(255,255,255,0.1)',
              background: selectedListId === 'all' ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
              color: selectedListId === 'all' ? 'var(--accent-hover)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease'
            }}
          >
            Todas
          </button>
          {listsWithTasks.map(list => {
            const active = selectedListId === list.id;
            return (
              <button
                key={list.id}
                onClick={() => setSelectedListId(active ? 'all' : list.id)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  border: active ? `1.5px solid ${list.color}` : '1.5px solid rgba(255,255,255,0.1)',
                  background: active ? `${list.color}22` : 'rgba(255,255,255,0.04)',
                  color: active ? list.color : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: list.color, flexShrink: 0 }} />
                {list.name}
              </button>
            );
          })}
        </div>
      )}

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
          const groups = groupByList(quadrantTasks);

          return (
            <motion.div
              key={q.priority}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { handleDrop(e, q.priority); setDragOverQuadrant(null); }}
              onDragEnter={() => setDragOverQuadrant(q.priority)}
              onDragLeave={() => setDragOverQuadrant(null)}
              animate={{
                backgroundColor: isDragOver ? `${q.color}15` : q.bgColor,
                borderColor: isDragOver ? q.color : q.borderColor,
                scale: isDragOver ? 1.008 : 1,
                boxShadow: isDragOver ? `0 8px 24px ${q.color}15` : 'none'
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
              {/* Quadrant title */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: q.color }}>{q.title}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{q.subtitle}</span>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: q.color, background: `${q.color}15`, padding: '2px 8px', borderRadius: '12px' }}>
                  {quadrantTasks.length} {quadrantTasks.length === 1 ? 'tarea' : 'tareas'}
                </span>
              </div>

              {/* Task list */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '0.75rem', paddingRight: '4px' }}>
                {quadrantTasks.length === 0 ? (
                  <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem', opacity: 0.5, border: '1px dashed rgba(255,255,255,0.02)', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                    Sin tareas. Arrastra actividades aquí o créalas abajo.
                  </div>
                ) : shouldGroup && groups.length > 1 ? (
                  /* ── Feature 3: Group by list ──────────────────────────── */
                  <AnimatePresence initial={false}>
                    {groups.map(group => {
                      const groupKey = `${q.priority}-${group.listId}`;
                      const isCollapsed = collapsedGroups[groupKey];
                      return (
                        <motion.div key={groupKey} layout style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {/* Group header */}
                          <button
                            onClick={() => toggleGroup(groupKey)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '6px',
                              background: 'none', border: 'none', cursor: 'pointer',
                              padding: '2px 4px', borderRadius: '4px', fontFamily: 'inherit',
                              color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 700,
                              textTransform: 'uppercase', letterSpacing: '0.06em', width: '100%'
                            }}
                          >
                            {isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: group.color, flexShrink: 0 }} />
                            {group.name}
                            <span style={{ marginLeft: 'auto', background: `${group.color}22`, color: group.color, borderRadius: '8px', padding: '0 5px', fontSize: '0.65rem' }}>
                              {group.tasks.length}
                            </span>
                          </button>

                          {/* Group tasks */}
                          {!isCollapsed && (
                            <AnimatePresence initial={false}>
                              {group.tasks.map(task => (
                                <TaskCard
                                  key={task.id}
                                  task={task}
                                  listColor={group.color}
                                  isMobile={isMobile}
                                  onDragStart={handleDragStart}
                                  onSelect={onSelectTask}
                                  onContextMenu={onTaskContextMenu}
                                  onToggle={handleToggleTask}
                                  showDot={false}
                                />
                              ))}
                            </AnimatePresence>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                ) : (
                  /* Single list or filtered view — flat list with dots (Feature 2) */
                  <AnimatePresence initial={false}>
                    {quadrantTasks.map(task => {
                      const { color } = getListMeta(task.list_id);
                      return (
                        <TaskCard
                          key={task.id}
                          task={task}
                          listColor={color}
                          isMobile={isMobile}
                          onDragStart={handleDragStart}
                          onSelect={onSelectTask}
                          onContextMenu={onTaskContextMenu}
                          onToggle={handleToggleTask}
                          showDot={selectedListId === 'all' && listsWithTasks.length > 1}
                        />
                      );
                    })}
                  </AnimatePresence>
                )}
              </div>

              {/* Inline quick add */}
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
                    background: q.color, color: '#ffffff', border: 'none',
                    borderRadius: '6px', width: '32px', height: '32px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
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

/* ── Task Card subcomponent ─────────────────────────────────────────────── */
function TaskCard({ task, listColor, isMobile, onDragStart, onSelect, onContextMenu, onToggle, showDot }) {
  return (
    <motion.div
      layout
      draggable={!isMobile}
      onDragStart={(e) => { if (!isMobile) onDragStart(e, task.id); }}
      onClick={() => onSelect(task.id)}
      onContextMenu={(e) => { if (onContextMenu) onContextMenu(e, task); }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={{ y: -2, scale: 1.01, backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}
      whileDrag={{ scale: 1.03, rotate: 1, boxShadow: '0 8px 16px rgba(0,0,0,0.3)' }}
      transition={{ layout: { type: 'spring', stiffness: 500, damping: 30 }, duration: 0.15 }}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '8px',
        padding: '9px 12px',
        cursor: 'grab',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}
    >
      {/* ── Feature 2: Colored list dot ──────────────────────────────── */}
      {showDot && (
        <span
          title={`Lista: ${listColor}`}
          style={{
            width: 8, height: 8, borderRadius: '50%',
            background: listColor, flexShrink: 0,
            boxShadow: `0 0 4px ${listColor}60`
          }}
        />
      )}

      {/* Checkbox */}
      <div
        className={`checkbox priority-${task.priority || 0}`}
        onClick={(e) => { e.stopPropagation(); onToggle(task.id, task.is_completed); }}
        style={{ width: '16px', height: '16px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
      >
        {task.is_completed && <Check size={10} color="#0f1115" />}
      </div>

      {/* Title */}
      <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>
        {task.title}
      </div>

      {/* Due date */}
      {task.due_date && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}>
          <Calendar size={10} />
          {task.due_date.split(' ')[0]}
        </div>
      )}
    </motion.div>
  );
}
