import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { GlobalSidebar } from './components/GlobalSidebar';
import { Sidebar } from './components/Sidebar';
import { TaskItem } from './components/TaskItem';
import { TaskDetail } from './components/TaskDetail';
import { LoginView } from './components/LoginView';
import { SectionHeader } from './components/SectionHeader';
import { EmptyState } from './components/EmptyState';
import { CommandPalette } from './components/CommandPalette';
import { GlobalContextMenu } from './components/GlobalContextMenu';

// Lazy loaded views for code splitting
const CalendarView = lazy(() => import('./components/CalendarView').then(m => ({ default: m.CalendarView })));
const PomodoroView = lazy(() => import('./components/PomodoroView').then(m => ({ default: m.PomodoroView })));
const EisenhowerView = lazy(() => import('./components/EisenhowerView').then(m => ({ default: m.EisenhowerView })));
const GTDView = lazy(() => import('./components/GTDView').then(m => ({ default: m.GTDView })));
const KanbanView = lazy(() => import('./components/KanbanView').then(m => ({ default: m.KanbanView })));
const AnalyticsView = lazy(() => import('./components/AnalyticsView').then(m => ({ default: m.AnalyticsView })));
const SettingsView = lazy(() => import('./components/SettingsView').then(m => ({ default: m.SettingsView })));
const AdminView = lazy(() => import('./components/AdminView').then(m => ({ default: m.AdminView })));
const SharedTasksView = lazy(() => import('./components/SharedTasksView').then(m => ({ default: m.SharedTasksView })));
const ProjectKanbanView = lazy(() => import('./components/ProjectKanbanView').then(m => ({ default: m.ProjectKanbanView })));
const AddTaskWidget = lazy(() => import('./components/AddTaskWidget').then(m => ({ default: m.AddTaskWidget })));

import { Inbox, Plus, Mic, X, Wifi, WifiOff } from 'lucide-react';
import { isToday, isFuture, parseISO, format, addDays } from 'date-fns';
import { useTodo } from './context/TodoContext';
import { parseTimezoneOffset } from './utils/timezone';

function App() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      r && setInterval(() => {
        r.update();
      }, 60 * 60 * 1000);
    }
  });

  const {
    token,
    user,
    isWidgetMode,
    login,
    logout,
    mainView,
    setMainView,
    activeList,
    setActiveList,
    activeTagFilter,
    setActiveTagFilter,
    selectedTaskId,
    setSelectedTaskId,
    selectedSubtaskId,
    setSelectedSubtaskId,
    globalContextMenu,
    setGlobalContextMenu,
    activePomodoroTaskId,
    setActivePomodoroTaskId,
    rightPaneWidth,
    setRightPaneWidth,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    isShortcutsModalOpen,
    setIsShortcutsModalOpen,
    projectLayout,
    setProjectLayout,
    tasks,
    lists,
    sections,
    tags,
    listGroups,
    loading,
    homeTimezone,
    setHomeTimezone,
    activeTimezoneMode,
    setActiveTimezoneMode,
    acknowledgedTimezone,
    setAcknowledgedTimezone,
    dismissedTimezoneBanner,
    setDismissedTimezoneBanner,
    filterPriority,
    setFilterPriority,
    filterHideCompleted,
    setFilterHideCompleted,
    filterTagId,
    setFilterTagId,
    quickAddTitle,
    setQuickAddTitle,
    isListening,
    listeningSource,
    isReadingAgenda,
    isOffline,
    offlineSimulated,
    toggleOfflineSimulation,
    pendingSyncCount,
    activeRequests,
    syncingTaskIds,
    externalEvents,
    externalEventsError,
    outlookIcalUrl,
    setOutlookIcalUrl,
    toasts,
    setToasts,
    showToast,
    fetchTasks,
    fetchLists,
    fetchSections,
    fetchTags,
    fetchListGroups,
    fetchExternalEvents,
    handleToggleTask,
    handleUpdateTaskPriority,
    handleUpdateTaskList,
    handleUpdateTaskSection,
    handleRescheduleTask,
    handleAddTask,
    handleUpdateTask,
    handleDeleteTask,
    handleDeleteSubtask,
    handleSelectEvent,
    handleUpdateEventDates,
    handleAddTaskInQuadrant,
    handleQuickAdd,
    startSpeechRecognition,
    handleReadAgendaAloud
  } = useTodo();

  const inboxList = lists.find(l => l.name.toLowerCase() === 'inbox');
  const inboxListId = inboxList ? inboxList.id : null;

  const startResizing = (mouseDownEvent) => {
    mouseDownEvent.preventDefault();
    const startWidth = rightPaneWidth;
    const startX = mouseDownEvent.clientX;

    const doDrag = (mouseMoveEvent) => {
      let newWidth = startWidth + (startX - mouseMoveEvent.clientX);
      if (newWidth < 280) newWidth = 280;
      if (newWidth > window.innerWidth - 300) newWidth = window.innerWidth - 300;
      if (newWidth > 800) newWidth = 800;

      setRightPaneWidth(newWidth);
      localStorage.setItem('rightPaneWidth', newWidth.toString());
    };

    const stopDrag = () => {
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
      document.body.style.cursor = '';
    };

    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
    document.body.style.cursor = 'ew-resize';
  };

  const handleTaskContextMenu = (e, task) => {
    e.preventDefault();
    e.stopPropagation();
    
    const menuWidth = 200;
    const menuHeight = 350;
    
    let x = e.clientX;
    let y = e.clientY;
    
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }
    
    x = Math.max(10, x);
    y = Math.max(10, y);
    
    setGlobalContextMenu({
      task,
      x,
      y
    });
  };

  const handleStartPomodoroFocus = (taskId) => {
    setActivePomodoroTaskId(taskId);
    setMainView('pomodoro');
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
        return;
      }

      const active = document.activeElement;
      if (active && (
        active.tagName === 'INPUT' || 
        active.tagName === 'TEXTAREA' || 
        active.contentEditable === 'true'
      )) {
        if (e.key === 'Escape') {
          active.blur();
          setIsCommandPaletteOpen(false);
          setIsShortcutsModalOpen(false);
          setSelectedTaskId(null);
          setSelectedSubtaskId(null);
        }
        return; 
      }

      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        const input = document.querySelector('.quick-add-bar input');
        if (input) input.focus();
      }

      if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsModalOpen(prev => !prev);
      }

      if (e.key === 'Escape') {
        setSelectedTaskId(null);
        setSelectedSubtaskId(null);
        setIsCommandPaletteOpen(false);
        setIsShortcutsModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setIsCommandPaletteOpen, setIsShortcutsModalOpen, setSelectedTaskId, setSelectedSubtaskId]);

  useEffect(() => {
    if (!token) return;

    // Persistent theme loader on app mount
    const savedAccent = localStorage.getItem('appAccentColor') || '#7c3aed';
    const savedBg = localStorage.getItem('appBgStyle') || '#121212';
    
    document.documentElement.style.setProperty('--accent-hover', savedAccent);
    
    let primaryAccent = '#5b21b6';
    if (savedAccent === '#3b82f6') primaryAccent = '#1d4ed8';
    if (savedAccent === '#10b981') primaryAccent = '#047857';
    if (savedAccent === '#f59e0b') primaryAccent = '#b45309';
    if (savedAccent === '#ef4444') primaryAccent = '#b91c1c';
    document.documentElement.style.setProperty('--accent-color', primaryAccent);

    document.documentElement.style.setProperty('--bg-color', savedBg);
    document.documentElement.style.setProperty('--content-bg', savedBg);
    
    // Check if bg is a light color
    const isLight = savedBg === '#f8f9fa' || savedBg === '#f0f4f8' || savedBg === '#f4fbf7';
    
    if (isLight) {
      document.documentElement.style.setProperty('--text-primary', savedBg === '#f4fbf7' ? '#132c1b' : '#212529');
      document.documentElement.style.setProperty('--text-secondary', savedBg === '#f4fbf7' ? '#4d6955' : '#555e66');
      document.documentElement.style.setProperty('--border-color', 'rgba(0, 0, 0, 0.08)');
      
      let sidebarBg = '#f1f3f5';
      let paneBg = '#ffffff';
      if (savedBg === '#f0f4f8') {
        sidebarBg = '#e2e8f0';
        paneBg = '#ffffff';
      } else if (savedBg === '#f4fbf7') {
        sidebarBg = '#e6f4ea';
        paneBg = '#ffffff';
      }
      document.documentElement.style.setProperty('--sidebar-bg', sidebarBg);
      document.documentElement.style.setProperty('--right-pane-bg', paneBg);
    } else {
      document.documentElement.style.setProperty('--text-primary', '#e0e0e0');
      document.documentElement.style.setProperty('--text-secondary', '#9e9e9e');
      document.documentElement.style.setProperty('--border-color', 'rgba(255, 255, 255, 0.08)');
      
      let sidebarBg = '#1c1c1c';
      let paneBg = '#1e1e1e';
      if (savedBg === '#050505') {
        sidebarBg = '#0c0c0d';
        paneBg = '#0f0f10';
      } else if (savedBg === '#0B0F19') {
        sidebarBg = '#111827';
        paneBg = '#1f2937';
      }
      document.documentElement.style.setProperty('--sidebar-bg', sidebarBg);
      document.documentElement.style.setProperty('--right-pane-bg', paneBg);
    }
  }, [token]);


  const filteredTasks = tasks.filter(task => {
    // 1. Hide completed filter
    if (filterHideCompleted && task.is_completed) {
      return false;
    }

    // 2. Priority filter
    if (filterPriority !== null && task.priority !== filterPriority) {
      return false;
    }

    // 3. Tag ID filter
    if (filterTagId !== null) {
      if (!task.tags || !task.tags.some(t => t.id === filterTagId)) {
        return false;
      }
    }

    // 4. List and Tag view filter
    if (activeTagFilter) {
      return task.tags && task.tags.some(t => t.name.toLowerCase() === activeTagFilter.toLowerCase());
    }
    if (activeList === 'inbox') {
      return task.list_id === null || task.list_id === inboxListId;
    }
    if (activeList === 'today') {
      return task.due_date && isToday(parseISO(task.due_date));
    }
    if (activeList === 'upcoming') {
      return task.due_date && isFuture(parseISO(task.due_date));
    }
    return task.list_id === activeList;
  });

  const getHeaderTitle = () => {
    if (activeList === 'inbox') return 'Inbox';
    if (activeList === 'today') return 'Today';
    if (activeList === 'upcoming') return 'Upcoming';
    const list = lists.find(l => l.id === activeList);
    return list ? list.name : 'Tasks';
  };

  let selectedTask = null;
  let selectedSubtask = null;

  if (selectedTaskId) {
    selectedTask = tasks.find(t => t.id === selectedTaskId);
  } else if (selectedSubtaskId) {
    for (const t of tasks) {
      const found = (t.subtasks || []).find(st => st.id === selectedSubtaskId);
      if (found) {
        selectedSubtask = found;
        break;
      }
    }
  }

  if (!token) {
    return (
      <LoginView 
        onSuccess={login}
      />
    );
  }

  if (isWidgetMode) {
    const getWidgetTitle = () => {
      switch(mainView) {
        case 'tasks': return '➕ Añadir Tarea';
        case 'calendar': return '📅 Calendario';
        case 'eisenhower': return '⚖️ Eisenhower';
        case 'pomodoro': return '⏱️ Pomodoro';
        case 'kanban': return '📋 Kanban';
        default: return 'ToDo';
      }
    };

    return (
      <div className="widget-layout">
        <header className="widget-header">
          <div className="widget-title">
            {getWidgetTitle()}
          </div>
          <button 
            className="widget-full-app-btn" 
            onClick={() => window.open(window.location.origin, '_blank')}
            title="Abrir aplicación completa"
          >
            Abrir ToDo completo ↗
          </button>
        </header>
        
        <main className="widget-content">
          <Suspense fallback={
            <div className="view-loading-spinner" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '200px', gap: '12px', color: 'var(--text-secondary)' }}>
              <div className="sync-spinner" style={{ width: '24px', height: '24px' }} />
              <span style={{ fontSize: '0.88rem' }}>Cargando vista...</span>
            </div>
          }>
            {mainView === 'tasks' ? (
              <AddTaskWidget />
            ) : mainView === 'calendar' ? (
              <CalendarView />
            ) : mainView === 'pomodoro' ? (
              <PomodoroView />
            ) : mainView === 'eisenhower' ? (
              <EisenhowerView />
            ) : (
              <KanbanView />
            )}
          </Suspense>
        </main>

        {(selectedTask || selectedSubtask) && (
          <div className="widget-modal-overlay" onClick={() => { setSelectedTaskId(null); setSelectedSubtaskId(null); }}>
            <div className="widget-modal" onClick={e => e.stopPropagation()}>
              <TaskDetail />
            </div>
          </div>
        )}
      </div>
    );
  }

  const browserOffset = -new Date().getTimezoneOffset();
  const homeOffset = parseTimezoneOffset(homeTimezone);
  const showTimezoneBanner = !dismissedTimezoneBanner && 
                             homeTimezone !== 'browser' && 
                             homeOffset !== browserOffset && 
                             acknowledgedTimezone !== String(browserOffset);

  return (
    <div className="root-layout">
      {showTimezoneBanner && (
        <div className="timezone-banner">
          <div className="timezone-banner-text">
            <span style={{ fontSize: '1.1rem' }}>✈️</span>
            <span>
              ¿Cambiaste de huso horario? Estás visualizando en la hora de tu Casa (
              <b>{homeTimezone}</b>).
            </span>
          </div>
          <div className="timezone-banner-actions">
            <button 
              className="timezone-action-btn primary"
              onClick={() => {
                setActiveTimezoneMode('local');
                localStorage.setItem('activeTimezoneMode', 'local');
                localStorage.setItem('acknowledgedTimezoneOffset', String(browserOffset));
                setAcknowledgedTimezone(String(browserOffset));
              }}
            >
              Actualizar a hora local (UTC{browserOffset >= 0 ? `+${browserOffset / 60}` : browserOffset / 60})
            </button>
            <button 
              className="timezone-action-btn secondary"
              onClick={() => {
                setActiveTimezoneMode('home');
                localStorage.setItem('activeTimezoneMode', 'home');
                localStorage.setItem('acknowledgedTimezoneOffset', String(browserOffset));
                setAcknowledgedTimezone(String(browserOffset));
              }}
            >
              Mantener hora de casa
            </button>
            <button 
              className="timezone-banner-close"
              onClick={() => setDismissedTimezoneBanner(true)}
              title="Cerrar"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
      <GlobalSidebar />

      <div className="app-container">
        {mainView === 'tasks' && (
          <Sidebar />
        )}
        
        <main className={`main-content ${selectedTaskId || selectedSubtaskId ? 'pane-open' : ''}`}>
          <Suspense fallback={
            <div className="view-loading-spinner" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px', gap: '12px', color: 'var(--text-secondary)' }}>
              <div className="sync-spinner" style={{ width: '28px', height: '28px' }} />
              <span style={{ fontSize: '0.88rem' }}>Cargando vista...</span>
            </div>
          }>
            <AnimatePresence mode="wait">
              <motion.div
                key={mainView}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}
              >
                {mainView === 'tasks' ? (
            <>
              <header className="header ticktick-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h1 style={{ marginBottom: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeTagFilter ? `Etiqueta: #${activeTagFilter}` : getHeaderTitle()}
                  </h1>
                  {activeTagFilter && (
                    <button 
                      onClick={() => setActiveTagFilter(null)}
                      className="clear-tag-filter-btn"
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '4px 10px',
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.2s',
                        marginLeft: '8px'
                      }}
                    >
                      Limpiar filtro <X size={12} />
                    </button>
                  )}
                  <button 
                    onClick={() => setIsShortcutsModalOpen(true)}
                    title="Atajos de teclado (?)"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                      marginLeft: 'auto'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  >
                    ⌨️
                  </button>
                  
                  {activeList === 'today' && (
                    <button
                      onClick={handleReadAgendaAloud}
                      className={`agenda-voice-reader-btn ${isReadingAgenda ? 'reading' : ''}`}
                      style={{
                        background: isReadingAgenda ? 'rgba(239, 68, 68, 0.1)' : 'rgba(124, 58, 237, 0.1)',
                        border: isReadingAgenda ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(124, 58, 237, 0.25)',
                        borderRadius: '20px',
                        padding: '6px 14px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: isReadingAgenda ? 'var(--danger-color)' : 'var(--accent-hover)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease',
                        boxShadow: isReadingAgenda ? '0 2px 8px rgba(239, 68, 68, 0.1)' : '0 2px 8px rgba(124, 58, 237, 0.1)'
                      }}
                      title={isReadingAgenda ? "Detener lectura" : "Escuchar resumen de mi agenda de hoy"}
                    >
                      {isReadingAgenda ? (
                        <>
                          <span className="voice-bar" style={{ backgroundColor: 'var(--danger-color)', animationDelay: '0.1s' }}></span>
                          <span className="voice-bar" style={{ backgroundColor: 'var(--danger-color)', animationDelay: '0.3s', height: '14px' }}></span>
                          <span className="voice-bar" style={{ backgroundColor: 'var(--danger-color)', animationDelay: '0.2s' }}></span>
                          <span>Detener Lectura</span>
                        </>
                      ) : (
                        <>
                          <span>🔊 Escuchar Agenda</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                
                {typeof activeList === 'number' && (
                  <div style={{
                    display: 'flex',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-color)',
                    padding: '3px',
                    borderRadius: '8px',
                    gap: '2px'
                  }}>
                    <button
                      onClick={() => setProjectLayout('list')}
                      style={{
                        background: projectLayout === 'list' ? 'var(--accent-hover)' : 'transparent',
                        border: 'none',
                        borderRadius: '6px',
                        color: projectLayout === 'list' ? '#ffffff' : 'var(--text-secondary)',
                        padding: '6px 14px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      📋 Lista
                    </button>
                    <button
                      onClick={() => setProjectLayout('kanban')}
                      style={{
                        background: projectLayout === 'kanban' ? 'var(--accent-hover)' : 'transparent',
                        border: 'none',
                        borderRadius: '6px',
                        color: projectLayout === 'kanban' ? '#ffffff' : 'var(--text-secondary)',
                        padding: '6px 14px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      📊 Kanban
                    </button>
                  </div>
                )}
              </header>

              <form className="quick-add-bar" onSubmit={handleQuickAdd} style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                <Plus size={18} className="quick-add-icon" />
                <input 
                  type="text" 
                  placeholder="Add Task" 
                  value={quickAddTitle}
                  onChange={e => setQuickAddTitle(e.target.value)}
                  style={{ flex: 1 }}
                />
                
                {/* Microphone Button */}
                <button
                  type="button"
                  onClick={() => startSpeechRecognition('main')}
                  className={`mic-button ${isListening && listeningSource === 'main' ? 'listening' : ''}`}
                  style={{
                    background: isListening && listeningSource === 'main' ? 'var(--danger-color)' : 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isListening && listeningSource === 'main' ? '#ffffff' : 'var(--text-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                    position: 'relative',
                    overflow: 'hidden',
                    flexShrink: 0
                  }}
                  title={isListening && listeningSource === 'main' ? "Detener grabación de voz" : "Añadir tarea por voz"}
                >
                  {isListening && listeningSource === 'main' ? (
                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                      <span className="voice-bar"></span>
                      <span className="voice-bar"></span>
                      <span className="voice-bar"></span>
                    </div>
                  ) : (
                    <Mic size={16} />
                  )}
                </button>
              </form>

              {/* --- PREMIUM CENTRAL QUICK FILTER BAR --- */}
              <div 
                className="quick-filter-bar"
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  alignItems: 'center',
                  marginBottom: '16px',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                  animation: 'fadeIn 0.2s ease-out'
                }}
              >
                {/* Priority Selection Pills */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', borderRight: '1px solid rgba(255,255,255,0.08)', paddingRight: '12px', marginRight: '4px', flexShrink: 0 }}>
                  {[
                    { val: 3, label: '!!! Alta', color: '#ef4444' },
                    { val: 2, label: '!! Media', color: '#f59e0b' },
                    { val: 1, label: '! Baja', color: '#3b82f6' }
                  ].map(p => {
                    const isAct = filterPriority === p.val;
                    return (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => setFilterPriority(prev => prev === p.val ? null : p.val)}
                        style={{
                          background: isAct ? `${p.color}22` : 'rgba(255, 255, 255, 0.02)',
                          border: isAct ? `1.5px solid ${p.color}` : '1.5px solid rgba(255, 255, 255, 0.05)',
                          borderRadius: '20px',
                          color: isAct ? p.color : 'var(--text-secondary)',
                          padding: '5px 12px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: isAct ? `0 0 10px ${p.color}30` : 'none',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={e => { if (!isAct) e.currentTarget.style.borderColor = p.color; }}
                        onMouseLeave={e => { if (!isAct) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>

                {/* Hide Completed Toggle */}
                <button
                  type="button"
                  onClick={() => setFilterHideCompleted(prev => !prev)}
                  style={{
                    background: filterHideCompleted ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                    border: filterHideCompleted ? '1.5px solid var(--accent-color)' : '1.5px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '20px',
                    color: filterHideCompleted ? 'var(--accent-color)' : 'var(--text-secondary)',
                    padding: '5px 12px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: filterHideCompleted ? '0 0 10px rgba(59, 130, 246, 0.25)' : 'none',
                    transition: 'all 0.2s ease',
                    flexShrink: 0
                  }}
                  onMouseEnter={e => { if (!filterHideCompleted) e.currentTarget.style.borderColor = 'var(--accent-color)'; }}
                  onMouseLeave={e => { if (!filterHideCompleted) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}
                >
                  👁️ {filterHideCompleted ? 'Completadas Ocultas' : 'Ocultar Completadas'}
                </button>

                {/* Vertical Divider */}
                <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.08)', margin: '0 4px', flexShrink: 0 }} />

                {/* Tags Carousel */}
                <div 
                  style={{ 
                    display: 'flex', 
                    gap: '6px', 
                    overflowX: 'auto', 
                    flex: 1, 
                    padding: '2px 0', 
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none'
                  }}
                >
                  {tags.map(t => {
                    const isAct = filterTagId === t.id;
                    const tagColor = t.color || '#8e95a5';
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setFilterTagId(prev => prev === t.id ? null : t.id)}
                        style={{
                          background: isAct ? `${tagColor}22` : 'rgba(255, 255, 255, 0.02)',
                          border: isAct ? `1.5px solid ${tagColor}` : '1.5px solid rgba(255, 255, 255, 0.05)',
                          borderRadius: '20px',
                          color: isAct ? tagColor : 'var(--text-secondary)',
                          padding: '5px 12px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          boxShadow: isAct ? `0 0 10px ${tagColor}30` : 'none',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { if (!isAct) e.currentTarget.style.borderColor = tagColor; }}
                        onMouseLeave={e => { if (!isAct) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}
                      >
                        #{t.name}
                      </button>
                    );
                  })}
                  {tags.length === 0 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: '4px' }}>Sin etiquetas</span>
                  )}
                </div>

                {/* Clear Filters Button */}
                {(filterPriority !== null || filterHideCompleted || filterTagId !== null) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterPriority(null);
                      setFilterHideCompleted(false);
                      setFilterTagId(null);
                    }}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1.5px solid var(--danger-color)',
                      borderRadius: '20px',
                      color: 'var(--danger-color)',
                      padding: '5px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.2s',
                      boxShadow: '0 0 10px rgba(239, 68, 68, 0.15)',
                      flexShrink: 0
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {loading ? (
                <div>Loading...</div>
              ) : typeof activeList === 'number' && projectLayout === 'kanban' ? (
                <ProjectKanbanView />
              ) : filteredTasks.length > 0 ? (
                <div className="task-list">
                  {typeof activeList === 'number' ? (
                    <>
                      {/* Tasks without a section */}
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDragEnter={() => setActiveDragSectionId('none')}
                        onDragLeave={() => setActiveDragSectionId(null)}
                        onDrop={(e) => {
                          const taskId = e.dataTransfer.getData('taskId');
                          if (taskId) {
                            handleUpdateTaskSection(taskId, null);
                          }
                          setActiveDragSectionId(null);
                        }}
                        style={{
                          minHeight: '60px',
                          paddingBottom: '12px',
                          border: activeDragSectionId === 'none' ? '2px dashed var(--accent-hover)' : '2px dashed transparent',
                          borderRadius: '8px',
                          padding: '6px',
                          transition: 'all 0.15s ease',
                          marginBottom: '1rem'
                        }}
                      >
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px', opacity: activeDragSectionId === 'none' ? 1 : 0.4, paddingLeft: '4px' }}>
                          📥 Arrastra aquí para quitar de sección
                        </div>
                        {filteredTasks.filter(t => !t.section_id).map(task => (
                          <TaskItem 
                            key={task.id} 
                            task={task} 
                            isSelected={selectedTaskId === task.id}
                            selectedSubtaskId={selectedSubtaskId}
                            isSyncing={syncingTaskIds.has(task.id)}
                            onClick={() => {
                              setSelectedTaskId(task.id);
                              setSelectedSubtaskId(null);
                            }}
                            onSelectSubtask={(subId) => {
                              setSelectedSubtaskId(subId);
                              setSelectedTaskId(null);
                            }}
                            onToggle={() => handleToggleTask(task.id, task.is_completed)}
                            onSubtaskAdded={fetchTasks}
                            onContextMenu={handleTaskContextMenu}
                          />
                        ))}
                      </div>
                      
                      {/* Grouped by Section */}
                      {sections.filter(s => s.list_id === activeList).map(section => {
                        const sectionTasks = filteredTasks.filter(t => t.section_id === section.id);
                        return (
                          <div 
                            key={section.id} 
                            className="section-group"
                            onDragOver={(e) => e.preventDefault()}
                            onDragEnter={() => setActiveDragSectionId(section.id)}
                            onDragLeave={() => setActiveDragSectionId(null)}
                            onDrop={(e) => {
                              const taskId = e.dataTransfer.getData('taskId');
                              if (taskId) {
                                handleUpdateTaskSection(taskId, section.id);
                              }
                              setActiveDragSectionId(null);
                            }}
                            style={{
                              border: activeDragSectionId === section.id ? '2px dashed var(--accent-hover)' : '2px dashed transparent',
                              borderRadius: '8px',
                              padding: '8px',
                              transition: 'all 0.15s ease',
                              minHeight: '60px',
                              marginBottom: '1rem'
                            }}
                          >
                            <SectionHeader 
                              section={section}
                              tasksCount={sectionTasks.length}
                              onToggleCollapse={async (id, isCollapsed) => {
                                await fetch(`/api/sections/${id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ is_collapsed: isCollapsed ? 1 : 0 })
                                });
                                fetchSections();
                              }}
                              onRename={async (sec) => {
                                const name = prompt('New section name:', sec.name);
                                if (name && name !== sec.name) {
                                  await fetch(`/api/sections/${sec.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ name })
                                  });
                                  fetchSections();
                                }
                              }}
                              onDelete={async (id) => {
                                if (confirm('Are you sure you want to delete this section? Tasks inside will not be deleted.')) {
                                  await fetch(`/api/sections/${id}`, { method: 'DELETE' });
                                  fetchSections();
                                  fetchTasks(); // To reload tasks that had this section_id (now NULL)
                                }
                              }}
                            />
                            {!section.is_collapsed && sectionTasks.map(task => (
                              <TaskItem 
                                key={task.id} 
                                task={task} 
                                isSelected={selectedTaskId === task.id}
                                selectedSubtaskId={selectedSubtaskId}
                                isSyncing={syncingTaskIds.has(task.id)}
                                onClick={() => {
                                  setSelectedTaskId(task.id);
                                  setSelectedSubtaskId(null);
                                }}
                                onSelectSubtask={(subId) => {
                                  setSelectedSubtaskId(subId);
                                  setSelectedTaskId(null);
                                }}
                                onToggle={() => handleToggleTask(task.id, task.is_completed)}
                                onSubtaskAdded={fetchTasks}
                                onContextMenu={handleTaskContextMenu}
                              />
                            ))}
                          </div>
                        );
                      })}
                      
                      <div className="add-section-btn-container">
                        <button className="add-section-btn" onClick={async () => {
                          const name = prompt('New Section Name:');
                          if (name) {
                            await fetch('/api/sections', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ list_id: activeList, name })
                            });
                            fetchSections();
                          }
                        }}>
                          <Plus size={16} /> Add Section
                        </button>
                      </div>
                    </>
                  ) : (
                    // Default rendering for inbox/today/upcoming
                    filteredTasks.map(task => (
                      <TaskItem 
                        key={task.id} 
                        task={task} 
                        isSelected={selectedTaskId === task.id}
                        selectedSubtaskId={selectedSubtaskId}
                        isSyncing={syncingTaskIds.has(task.id)}
                        onClick={() => {
                          setSelectedTaskId(task.id);
                          setSelectedSubtaskId(null);
                        }}
                        onSelectSubtask={(subId) => {
                          setSelectedSubtaskId(subId);
                          setSelectedTaskId(null);
                        }}
                        onToggle={() => handleToggleTask(task.id, task.is_completed)}
                        onSubtaskAdded={fetchTasks}
                        onContextMenu={handleTaskContextMenu}
                      />
                    ))
                  )}
                </div>
              ) : (
                <EmptyState 
                  type={
                    activeList === 'today' 
                      ? 'today' 
                      : activeList === 'upcoming' 
                        ? 'upcoming' 
                        : activeList === 'inbox' 
                          ? 'inbox' 
                          : 'generic'
                  }
                  onActionClick={() => {
                    const input = document.querySelector('.quick-add-bar input');
                    if (input) input.focus();
                  }}
                  actionLabel="Crear una tarea"
                />
              )}
            </>
          ) : mainView === 'calendar' ? (
            <CalendarView />
          ) : mainView === 'pomodoro' ? (
            <PomodoroView />
          ) : mainView === 'eisenhower' ? (
            <EisenhowerView />
          ) : mainView === 'gtd' ? (
            <GTDView 
              tasks={tasks}
              lists={lists}
              onRefreshTasks={fetchTasks}
              onRefreshLists={fetchLists}
            />
          ) : mainView === 'kanban' ? (
            <KanbanView />
          ) : mainView === 'settings' ? (
            <SettingsView 
              user={user}
              onUpdateUser={(updatedUser, newToken) => {
                login(newToken, updatedUser);
              }}
              tasks={tasks}
              lists={lists}
              onRefreshTasks={() => {
                fetchTasks();
                if (user?.id) {
                  const url = user.outlook_ical_url || localStorage.getItem(`outlookIcalUrl_${user.id}`) || '';
                  setOutlookIcalUrl(url);
                  fetchExternalEvents(url);
                }
                const hz = localStorage.getItem('homeTimezone') || 'browser';
                setHomeTimezone(hz);
                localStorage.removeItem('acknowledgedTimezoneOffset');
                setAcknowledgedTimezone('');
                setDismissedTimezoneBanner(false);
              }}
            />

          ) : mainView === 'admin' ? (
            <AdminView />
          ) : mainView === 'shared' ? (
            <SharedTasksView 
              user={user}
              onRefreshTasks={fetchTasks}
            />
          ) : (
            <AnalyticsView 
              tasks={tasks}
              lists={lists}
              onRefreshTasks={fetchTasks}
            />
          )}
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </main>

        <AnimatePresence>
          {(selectedTask || selectedSubtask) && (
            <motion.aside
              className="right-pane"
              style={{ width: `${rightPaneWidth}px`, position: 'relative' }}
              initial={{ x: '100%', opacity: 0.8 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0.8 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <div 
                className="pane-resize-handle"
                onMouseDown={startResizing}
              />
              <TaskDetail />
            </motion.aside>
          )}
        </AnimatePresence>
        {needRefresh && (
          <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: '#1c1c1e',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            zIndex: 99999,
            maxWidth: '320px'
          }}>
            <p style={{ fontSize: '0.88rem', color: '#ffffff', margin: 0, fontWeight: 500, lineHeight: 1.4 }}>
              ✨ ¡Hay una nueva versión disponible con mejoras y correcciones!
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => updateServiceWorker(true)}
                style={{
                  flex: 1,
                  backgroundColor: 'var(--accent-hover, #7c3aed)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  transition: 'background-color 0.2s'
                }}
              >
                Actualizar ahora
              </button>
              <button 
                onClick={() => setNeedRefresh(false)}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--text-secondary, #9e9e9e)',
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.8rem'
                }}
              >
                Luego
              </button>
            </div>
          </div>
        )}

        {/* Keyboard Shortcuts Cheatsheet Modal */}
        {isShortcutsModalOpen && (
          <div 
            onClick={() => setIsShortcutsModalOpen(false)}
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
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div 
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '440px',
                background: 'rgba(28, 28, 30, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 24px 50px rgba(0, 0, 0, 0.6)',
                animation: 'fadeIn 0.25s ease-out'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>⌨️ Atajos de Teclado</h3>
                <button 
                  onClick={() => setIsShortcutsModalOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Abrir Paleta de Comandos</span>
                  <kbd style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', padding: '3px 6px', fontSize: '0.75rem', color: 'white', fontFamily: 'monospace' }}>Ctrl + K</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Enfocar Entrada Rápida de Tarea</span>
                  <kbd style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', padding: '3px 6px', fontSize: '0.75rem', color: 'white', fontFamily: 'monospace' }}>N</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Cerrar Paneles o Modales</span>
                  <kbd style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', padding: '3px 6px', fontSize: '0.75rem', color: 'white', fontFamily: 'monospace' }}>Esc</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Mostrar esta Guía de Ayuda</span>
                  <kbd style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', padding: '3px 6px', fontSize: '0.75rem', color: 'white', fontFamily: 'monospace' }}>?</kbd>
                </div>
              </div>

              <div style={{ marginTop: '20px', textAlign: 'center' }}>
                <button
                  onClick={() => setIsShortcutsModalOpen(false)}
                  style={{
                    background: 'var(--accent-hover)',
                    border: 'none',
                    color: 'white',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    width: '100%',
                    transition: 'all 0.15s'
                  }}
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Context Menu */}
        {globalContextMenu && (
          <GlobalContextMenu 
            task={globalContextMenu.task}
            x={globalContextMenu.x}
            y={globalContextMenu.y}
            lists={lists}
            onClose={() => setGlobalContextMenu(null)}
            onToggleComplete={handleToggleTask}
            onUpdatePriority={handleUpdateTaskPriority}
            onMoveToList={handleUpdateTaskList}
            onReschedule={handleRescheduleTask}
            onStartPomodoro={handleStartPomodoroFocus}
            onDelete={handleDeleteTask}
          />
        )}

        {/* Global Command Palette */}
        <CommandPalette 
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          tasks={tasks}
          lists={lists}
          onNavigateView={(viewId) => {
            setMainView(viewId);
          }}
          onSelectList={(listId, taskId) => {
            setMainView('tasks');
            setActiveList(listId);
            setActiveTagFilter(null);
            if (taskId) {
              setSelectedTaskId(taskId);
              setSelectedSubtaskId(null);
            }
          }}
        />

        {/* Toast Container for in-app popups */}
        <div className="toast-container">
          {toasts.map(toast => (
            <div key={toast.id} className={`custom-toast ${toast.type}`}>
              <div className="toast-header">
                <span>{toast.title}</span>
                <button className="toast-close-btn" onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}>
                  <X size={14} />
                </button>
              </div>
              <div className="toast-body">{toast.message}</div>
            </div>
          ))}
        </div>

        {/* Global Syncing Indicator */}
        {activeRequests > 0 && (
          <div className="syncing-indicator">
            <div className="sync-spinner" />
            <span>Sincronizando...</span>
          </div>
        )}

        {/* Connectivity Status Indicator Premium Badge */}
        {(isOffline || pendingSyncCount > 0) && (
          <div className={`connectivity-badge ${isOffline ? 'offline' : 'sync-pending'}`}>
            <span className="connectivity-dot" />
            {isOffline ? (
              <>
                <WifiOff size={16} />
                <span>Modo sin conexión</span>
              </>
            ) : (
              <>
                <Wifi size={16} />
                <span>Sincronización pendiente ({pendingSyncCount})</span>
              </>
            )}
          </div>
        )}

        {/* Dev Offline Simulation Toggle */}
        {import.meta.env.DEV && (
          <button
            id="simular-offline-btn"
            onClick={toggleOfflineSimulation}
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              backgroundColor: offlineSimulated ? 'rgba(239, 68, 68, 0.2)' : 'rgba(28, 28, 30, 0.8)',
              color: '#ffffff',
              border: offlineSimulated ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '20px',
              padding: '8px 14px',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              zIndex: 99999,
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              transition: 'all 0.2s ease',
              backdropFilter: 'blur(10px)'
            }}
          >
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: offlineSimulated ? '#ef4444' : '#10b981',
              display: 'inline-block'
            }} />
            {offlineSimulated ? 'Desactivar Offline' : 'Simular Offline'}
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
