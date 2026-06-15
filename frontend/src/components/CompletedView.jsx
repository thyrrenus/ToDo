import { useState, useMemo } from 'react';
import { useTodo } from '../context/TodoContext';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ChevronDown, ChevronRight, Inbox, ListFilter, Calendar, ArrowUpDown, Undo2, Folder, CalendarDays, Trash2 } from 'lucide-react';

const formatDateKey = (dateStr) => {
  if (!dateStr) return 'Sin fecha';
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Hoy';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Ayer';
  }

  // Formatting weekday in Spanish (e.g. "Viernes, 5 de Junio")
  const formatter = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
  
  // Capitalize first letter
  const formatted = formatter.format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

export function CompletedView() {
  const {
    tasks = [],
    lists = [],
    handleToggleTask,
    handleDeleteTask,
    syncingTaskIds,
    loading
  } = useTodo();

  // Hover state
  const [hoveredTaskId, setHoveredTaskId] = useState(null);

  // Deletion confirm modal state
  const [taskToDelete, setTaskToDelete] = useState(null);

  // Filters State
  const [dateFilter, setDateFilter] = useState('all');
  const [listFilter, setListFilter] = useState('all');
  const [sortFilter, setSortFilter] = useState('desc');

  // Collapsed Groups State
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const toggleGroupCollapse = (key) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Filter only completed tasks
  const completedTasks = useMemo(() => {
    return tasks.filter(t => !!t.is_completed);
  }, [tasks]);

  // Apply filters and sort tasks
  const filteredTasks = useMemo(() => {
    return completedTasks.filter(t => {
      // 1. List filter
      if (listFilter !== 'all') {
        const targetListId = parseInt(listFilter, 10);
        const inboxList = lists.find(l => l.name.toLowerCase() === 'inbox');
        const inboxListId = inboxList ? inboxList.id : null;
        if (targetListId === inboxListId) {
          if (t.list_id !== null && t.list_id !== inboxListId) return false;
        } else {
          if (t.list_id !== targetListId) return false;
        }
      }

      // 2. Date filter
      if (dateFilter !== 'all') {
        const dateStr = t.completed_at || t.updated_at || t.created_at;
        if (!dateStr) return false;
        const compDate = new Date(dateStr);
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (dateFilter === 'today') {
          if (compDate < startOfToday) return false;
        } else if (dateFilter === 'yesterday') {
          const startOfYesterday = new Date(startOfToday);
          startOfYesterday.setDate(startOfYesterday.getDate() - 1);
          if (compDate < startOfYesterday || compDate >= startOfToday) return false;
        } else if (dateFilter === 'week') {
          const sevenDaysAgo = new Date(startOfToday);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          if (compDate < sevenDaysAgo) return false;
        } else if (dateFilter === 'month') {
          const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          if (compDate < startOfThisMonth) return false;
        }
      }

      return true;
    }).sort((a, b) => {
      const dateA = new Date(a.completed_at || a.updated_at || a.created_at || 0);
      const dateB = new Date(b.completed_at || b.updated_at || b.created_at || 0);
      return sortFilter === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [completedTasks, listFilter, dateFilter, sortFilter, lists]);

  // Group tasks by completion day
  const groupedTasks = useMemo(() => {
    const groups = {};
    filteredTasks.forEach(t => {
      const dateStr = t.completed_at || t.updated_at || t.created_at;
      const key = formatDateKey(dateStr);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(t);
    });
    return groups;
  }, [filteredTasks]);

  // Chronologically ordered group keys
  const sortedGroupKeys = useMemo(() => {
    const keys = [];
    filteredTasks.forEach(t => {
      const dateStr = t.completed_at || t.updated_at || t.created_at;
      const key = formatDateKey(dateStr);
      if (!keys.includes(key)) {
        keys.push(key);
      }
    });
    return keys;
  }, [filteredTasks]);

  // Total completed counts
  const inboxList = lists.find(l => l.name.toLowerCase() === 'inbox');
  const inboxListId = inboxList ? inboxList.id : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%' }}>
      {/* Header and Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={24} style={{ color: 'var(--success-color, #10b981)' }} />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Historial de Tareas Completadas</h1>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '12px' }}>
            Total: {completedTasks.length} completadas
          </div>
        </div>

        {/* Filter Controls Panel */}
        <div style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '12px 16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
          alignItems: 'center'
        }}>
          {/* Date Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={15} style={{ color: 'var(--text-secondary)' }} />
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                padding: '6px 10px',
                fontSize: '0.8rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">Todas las fechas</option>
              <option value="today">Hoy</option>
              <option value="yesterday">Ayer</option>
              <option value="week">Últimos 7 días</option>
              <option value="month">Este mes</option>
            </select>
          </div>

          {/* List Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ListFilter size={15} style={{ color: 'var(--text-secondary)' }} />
            <select
              value={listFilter}
              onChange={e => setListFilter(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                padding: '6px 10px',
                fontSize: '0.8rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">Todas las listas</option>
              <option value={inboxListId || 'inbox'}>Inbox</option>
              {lists.filter(l => l.name.toLowerCase() !== 'inbox').map(list => (
                <option key={list.id} value={list.id}>{list.name}</option>
              ))}
            </select>
          </div>

          {/* Sort Order */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
            <ArrowUpDown size={15} style={{ color: 'var(--text-secondary)' }} />
            <select
              value={sortFilter}
              onChange={e => setSortFilter(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                padding: '6px 10px',
                fontSize: '0.8rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="desc">Más recientes primero</option>
              <option value="asc">Más antiguos primero</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tasks List */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            <div className="sync-spinner" style={{ width: '24px', height: '24px' }} />
          </div>
        ) : filteredTasks.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {sortedGroupKeys.map(groupKey => {
              const groupTasks = groupedTasks[groupKey] || [];
              const isCollapsed = !!collapsedGroups[groupKey];
              return (
                <div key={groupKey} style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Group Header */}
                  <div
                    onClick={() => toggleGroupCollapse(groupKey)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 4px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      marginBottom: '8px'
                    }}
                  >
                    {isCollapsed ? <ChevronRight size={16} style={{ color: 'var(--text-secondary)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />}
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{groupKey}</span>
                    <span style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      background: 'rgba(255,255,255,0.04)',
                      borderRadius: '10px',
                      padding: '1px 6px',
                      marginLeft: '4px'
                    }}>
                      {groupTasks.length}
                    </span>
                  </div>

                  {/* Group Items */}
                  {!isCollapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '8px' }}>
                      <AnimatePresence>
                        {groupTasks.map(task => {
                          const taskList = lists.find(l => l.id === task.list_id) || (task.list_id === null || task.list_id === inboxListId ? inboxList : null);
                          const listName = taskList ? taskList.name : 'Inbox';
                          const listColor = taskList ? taskList.color : '#3b82f6';
                          const isSyncing = syncingTaskIds?.has(task.id);

                          return (
                            <motion.div
                              key={task.id}
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              style={{ overflow: 'hidden' }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '8px 10px',
                                  borderRadius: '8px',
                                  background: 'transparent',
                                  borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
                                  opacity: isSyncing ? 0.5 : 1,
                                  transition: 'background-color 0.2s ease',
                                  cursor: 'default'
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                                  setHoveredTaskId(task.id);
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                  setHoveredTaskId(null);
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                  {/* Custom Checkbox (Always checked) */}
                                  <button
                                    onClick={() => handleToggleTask(task.id, true)}
                                    disabled={isSyncing}
                                    style={{
                                      background: 'var(--success-color, #10b981)',
                                      border: '1.5px solid var(--success-color, #10b981)',
                                      width: '18px',
                                      height: '18px',
                                      borderRadius: '4px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      color: '#ffffff',
                                      padding: 0,
                                      outline: 'none',
                                      flexShrink: 0
                                    }}
                                    title="Desmarcar y volver a activar"
                                  >
                                    <motion.span
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      style={{ display: 'flex' }}
                                    >
                                      <CheckCircle2 size={12} style={{ strokeWidth: 3 }} />
                                    </motion.span>
                                  </button>

                                  {/* Task Title (Strikethrough) */}
                                  <span style={{
                                    fontSize: '0.9rem',
                                    color: 'var(--text-secondary)',
                                    textDecoration: 'line-through',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {task.title}
                                  </span>
                                </div>

                                {/* List Tag origin & delete button */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                  {isSyncing && (
                                    <div className="sync-spinner" style={{ width: '12px', height: '12px' }} />
                                  )}
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '3px 8px',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(255,255,255,0.04)',
                                    background: 'rgba(255,255,255,0.02)',
                                    fontSize: '0.75rem',
                                    color: 'var(--text-secondary)'
                                  }}>
                                    <span style={{
                                      width: '6px',
                                      height: '6px',
                                      borderRadius: '50%',
                                      backgroundColor: listColor || '#8e95a5'
                                    }} />
                                    {listName}
                                  </div>

                                  {/* Delete button on hover */}
                                  {hoveredTaskId === task.id && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setTaskToDelete(task.id);
                                      }}
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--danger-color, #ef4444)',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'background-color 0.2s'
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                      title="Eliminar tarea completada permanentemente"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            minHeight: '280px',
            color: 'var(--text-secondary)',
            gap: '12px'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              opacity: 0.7,
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
            }}>
              <CheckCircle2 size={32} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>No hay tareas completadas</h3>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '280px', textAlign: 'center', lineHeight: 1.4 }}>
              Las tareas que completes aparecerán aquí organizadas por fecha de finalización.
            </p>
          </div>
        )}
      </div>
      
      {/* Custom confirm deletion modal */}
      {taskToDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 11000
        }}>
          <div style={{
            background: 'var(--right-pane-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '380px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.15rem', color: 'var(--text-primary)' }}>¿Eliminar tarea completada?</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Esta acción es permanente y no se puede deshacer. La tarea se borrará de tu historial para siempre.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setTaskToDelete(null)}
                style={{
                  flex: 1,
                  background: 'rgba(128,128,128,0.1)',
                  border: 'none',
                  color: 'var(--text-primary)',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  handleDeleteTask(taskToDelete);
                  setTaskToDelete(null);
                }}
                style={{
                  flex: 1,
                  background: 'var(--danger-color, #ef4444)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
