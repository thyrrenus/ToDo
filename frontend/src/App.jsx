import { useState, useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { GlobalSidebar } from './components/GlobalSidebar';
import { Sidebar } from './components/Sidebar';
import { TaskItem } from './components/TaskItem';
import { TaskDetail } from './components/TaskDetail';
import { CalendarView } from './components/CalendarView';
import { PomodoroView } from './components/PomodoroView';
import { EisenhowerView } from './components/EisenhowerView';
import { GTDView } from './components/GTDView';
import { KanbanView } from './components/KanbanView';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsView } from './components/SettingsView';
import { ProjectKanbanView } from './components/ProjectKanbanView';
import { SectionHeader } from './components/SectionHeader';
import { Inbox, Plus } from 'lucide-react';
import { isToday, isFuture, parseISO, format, addDays } from 'date-fns';
import { sendNotification } from './utils/notifications';

// --- LOCAL NATURAL LANGUAGE PROCESSING (NLP) QUICK ADD PARSER ---
function parseNLPQuickAdd(inputTitle, lists, activeList) {
  let title = inputTitle.trim();
  let priority = 0;
  
  // Resolve default list
  let inboxList = lists.find(l => l.name.toLowerCase() === 'inbox');
  let defaultListId = typeof activeList === 'number' ? activeList : (inboxList ? inboxList.id : null);
  let list_id = defaultListId;

  // Resolve default due date
  let due_date = activeList === 'today' 
    ? format(new Date(), 'yyyy-MM-dd') 
    : activeList === 'upcoming' 
      ? format(addDays(new Date(), 1), 'yyyy-MM-dd') 
      : null;

  let start_time = null;
  let end_time = null;

  // 1. Extract priority
  if (title.includes('!!!')) {
    priority = 3;
    title = title.replace('!!!', '');
  } else if (title.includes('!!')) {
    priority = 2;
    title = title.replace('!!', '');
  } else if (title.includes('!')) {
    priority = 1;
    title = title.replace('!', '');
  }

  // 2. Extract list hashtags (e.g. #Trabajo, #Personal)
  const hashtagRegex = /#(\w+)/g;
  let match;
  while ((match = hashtagRegex.exec(title)) !== null) {
    const hashtag = match[1];
    const matchedList = lists.find(l => l.name.toLowerCase() === hashtag.toLowerCase());
    if (matchedList) {
      list_id = matchedList.id;
      title = title.replace(`#${hashtag}`, '');
    }
  }

  // 3. Extract dates
  if (/\bhoy\b/i.test(title)) {
    due_date = format(new Date(), 'yyyy-MM-dd');
    title = title.replace(/\bhoy\b/i, '');
  } else if (/\bmañana\b/i.test(title)) {
    due_date = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    title = title.replace(/\bmañana\b/i, '');
  } else {
    // Days of the week
    const weekdays = ['lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes', 'sábado', 'sabado', 'domingo'];
    for (const day of weekdays) {
      const regex = new RegExp(`\\b${day}\\b`, 'i');
      if (regex.test(title)) {
        const daysMap = { domingo: 0, lunes: 1, martes: 2, miércoles: 3, miercoles: 3, jueves: 4, viernes: 5, sábado: 6, sabado: 6 };
        const targetDay = daysMap[day.toLowerCase()];
        const today = new Date();
        const todayDay = today.getDay();
        let daysToAdd = targetDay - todayDay;
        if (daysToAdd <= 0) daysToAdd += 7; // next week
        
        due_date = format(addDays(today, daysToAdd), 'yyyy-MM-dd');
        title = title.replace(regex, '');
        break;
      }
    }
  }

  // 4. Extract times (e.g. a las 10:30, 18:00, 10am, 10 am, 3pm, 3 pm)
  const hhmmRegex = /\b(\d{1,2}):(\d{2})\b/;
  const hhmmMatch = hhmmRegex.exec(title);
  
  let hours = null;
  let minutes = null;

  if (hhmmMatch) {
    hours = parseInt(hhmmMatch[1], 10);
    minutes = parseInt(hhmmMatch[2], 10);
    title = title.replace(hhmmRegex, '');
  } else {
    const ampmRegex = /\b(\d{1,2})\s*(am|pm|AM|PM)\b/;
    const ampmMatch = ampmRegex.exec(title);
    if (ampmMatch) {
      let hr = parseInt(ampmMatch[1], 10);
      const period = ampmMatch[2].toLowerCase();
      if (period === 'pm' && hr < 12) hr += 12;
      if (period === 'am' && hr === 12) hr = 0;
      hours = hr;
      minutes = 0;
      title = title.replace(ampmRegex, '');
    } else {
      const alasRegex = /\b(?:a las\s+)(\d{1,2})\b/i;
      const alasMatch = alasRegex.exec(title);
      if (alasMatch) {
        hours = parseInt(alasMatch[1], 10);
        minutes = 0;
        title = title.replace(alasRegex, '');
      }
    }
  }

  // If time was extracted, set start/end times
  if (hours !== null) {
    const resolvedDueDate = due_date || format(new Date(), 'yyyy-MM-dd');
    due_date = resolvedDueDate;

    const pad = (num) => String(num).padStart(2, '0');
    start_time = `${resolvedDueDate}T${pad(hours)}:${pad(minutes || 0)}:00`;
    
    const endHr = (hours + 1) % 24;
    const endDayOffset = (hours + 1) >= 24 ? 1 : 0;
    
    let resolvedEndDate = resolvedDueDate;
    if (endDayOffset > 0) {
      const parsedDate = new Date(resolvedDueDate + 'T00:00:00');
      resolvedEndDate = format(addDays(parsedDate, 1), 'yyyy-MM-dd');
    }
    
    end_time = `${resolvedEndDate}T${pad(endHr)}:${pad(minutes || 0)}:00`;
  }

  // Clean remaining extra spaces in title
  title = title.replace(/\s+/g, ' ').trim();
  if (!title) {
    title = 'Actividad sin título';
  }

  return {
    title,
    list_id,
    priority,
    due_date,
    start_time,
    end_time
  };
}

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

  const [mainView, setMainView] = useState('tasks'); // 'tasks' or 'calendar'
  const [tasks, setTasks] = useState([]);
  const [lists, setLists] = useState([]);
  const [sections, setSections] = useState([]);
  const [activeList, setActiveList] = useState('inbox'); // 'inbox', 'today', 'upcoming' or list ID
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [selectedSubtaskId, setSelectedSubtaskId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [activeDragSectionId, setActiveDragSectionId] = useState(null);
  const [projectLayout, setProjectLayout] = useState('list'); // 'list' or 'kanban'
  const [externalEvents, setExternalEvents] = useState([]);
  const [outlookIcalUrl, setOutlookIcalUrl] = useState(() => {
    const saved = localStorage.getItem('outlookIcalUrl');
    if (saved !== null) return saved;
    return 'https://outlook.office365.com/owa/calendar/58d72e5354c04cf6a0abdd36dcd8429d@afpmodelo.cl/6e2d4535dc4543f0b51e510dd30064c410332200703118504817/calendar.ics';
  });

  const fetchExternalEvents = async (urlToFetch) => {
    const url = urlToFetch || outlookIcalUrl;
    if (!url) {
      setExternalEvents([]);
      return;
    }
    try {
      const res = await fetch(`/api/external-events?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data = await res.json();
        setExternalEvents(data);
      } else {
        console.error('Failed to fetch external events:', res.statusText);
      }
    } catch (err) {
      console.error('Error fetching external events:', err);
    }
  };

  const inboxList = lists.find(l => l.name.toLowerCase() === 'inbox');
  const inboxListId = inboxList ? inboxList.id : null;

  const handleSelectEvent = (itemId, isSubtask) => {
    if (isSubtask) {
      setSelectedSubtaskId(itemId);
      setSelectedTaskId(null);
    } else {
      setSelectedTaskId(itemId);
      setSelectedSubtaskId(null);
    }
  };

  const handleUpdateEventDates = async (itemId, isSubtask, startTime, endTime) => {
    let start = startTime;
    let end = endTime;
    if (start && start.length === 16) start += ':00';
    if (end && end.length === 16) end += ':00';

    const derivedDueDate = start ? start.split('T')[0] : null;

    try {
      if (isSubtask) {
        await fetch(`/api/subtasks/${itemId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start_time: start,
            end_time: end,
            due_date: derivedDueDate
          })
        });
      } else {
        await fetch(`/api/tasks/${itemId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start_time: start,
            end_time: end,
            due_date: derivedDueDate
          })
        });
      }
      fetchTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateTaskPriority = async (taskId, priority) => {
    if (taskId === undefined) {
      fetchTasks();
      return;
    }
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority })
      });
      fetchTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddTaskInQuadrant = async (title, priority) => {
    const taskData = {
      title,
      list_id: typeof activeList === 'number' ? activeList : null,
      priority
    };
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
      if (res.ok) {
        fetchTasks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateTaskList = async (taskId, listId) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ list_id: listId })
      });
      fetchTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateTaskSection = async (taskId, sectionId) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_id: sectionId })
      });
      fetchTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLists = async () => {
    try {
      const res = await fetch('/api/lists');
      const data = await res.json();
      setLists(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSections = async () => {
    try {
      const res = await fetch('/api/sections');
      const data = await res.json();
      setSections(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Reference to keep track of already notified task/subtask IDs to prevent spamming
  const notifiedTasksRef = useRef(new Set());

  // Background scheduler to check for approaching scheduled tasks
  useEffect(() => {
    // 1. Initialize notified list with all active tasks whose start_time is in the past
    // so we don't alert for them upon fresh application load
    const now = new Date();
    tasks.forEach(t => {
      if (t.start_time) {
        const start = new Date(t.start_time);
        if (start < now) {
          notifiedTasksRef.current.add(`task-${t.id}`);
        }
      }
      if (t.subtasks) {
        t.subtasks.forEach(st => {
          if (st.start_time) {
            const start = new Date(st.start_time);
            if (start < now) {
              notifiedTasksRef.current.add(`sub-${st.id}`);
            }
          }
        });
      }
    });
  }, [loading]); // Run when tasks finish initial load

  useEffect(() => {
    const checkScheduledTasks = () => {
      const enableTaskAlerts = localStorage.getItem('enableTaskAlerts') !== 'false';
      const enableWebNotifications = localStorage.getItem('enableWebNotifications') === 'true';
      if (!enableWebNotifications || !enableTaskAlerts) return;

      const now = new Date();
      // Format current time to minute precision (YYYY-MM-DDTHH:mm)
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const currentDay = String(now.getDate()).padStart(2, '0');
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentMinuteStr = `${currentYear}-${currentMonth}-${currentDay}T${currentHours}:${currentMinutes}`;

      tasks.forEach(t => {
        if (!t.is_completed && t.start_time) {
          const taskMinuteStr = t.start_time.substring(0, 16);
          const taskKey = `task-${t.id}`;

          if (taskMinuteStr === currentMinuteStr && !notifiedTasksRef.current.has(taskKey)) {
            notifiedTasksRef.current.add(taskKey);
            sendNotification(`⏰ Actividad Iniciada: ${t.title}`, 'Esta tarea está programada para comenzar ahora mismo.');
          }
        }

        // Check scheduled subtasks
        if (t.subtasks && Array.isArray(t.subtasks)) {
          t.subtasks.forEach(st => {
            if (!st.is_completed && st.start_time) {
              const subMinuteStr = st.start_time.substring(0, 16);
              const subKey = `sub-${st.id}`;

              if (subMinuteStr === currentMinuteStr && !notifiedTasksRef.current.has(subKey)) {
                notifiedTasksRef.current.add(subKey);
                sendNotification(`⏰ Subtarea Iniciada: ${st.title}`, `Programada dentro de la actividad "${t.title}".`);
              }
            }
          });
        }
      });
    };

    // Check immediately and then every 30 seconds
    checkScheduledTasks();
    const interval = setInterval(checkScheduledTasks, 30000);

    return () => clearInterval(interval);
  }, [tasks]);

  useEffect(() => {
    Promise.all([fetchTasks(), fetchLists(), fetchSections()]).then(() => setLoading(false));
    
    // Fetch external events on app mount
    const savedUrl = localStorage.getItem('outlookIcalUrl');
    const url = savedUrl !== null ? savedUrl : 'https://outlook.office365.com/owa/calendar/58d72e5354c04cf6a0abdd36dcd8429d@afpmodelo.cl/6e2d4535dc4543f0b51e510dd30064c410332200703118504817/calendar.ics';
    if (url) {
      setOutlookIcalUrl(url);
      fetchExternalEvents(url);
    }

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
  }, []);

  useEffect(() => {
    if (mainView === 'calendar') {
      const savedUrl = localStorage.getItem('outlookIcalUrl');
      const url = savedUrl !== null ? savedUrl : 'https://outlook.office365.com/owa/calendar/58d72e5354c04cf6a0abdd36dcd8429d@afpmodelo.cl/6e2d4535dc4543f0b51e510dd30064c410332200703118504817/calendar.ics';
      setOutlookIcalUrl(url);
      fetchExternalEvents(url);
    }
  }, [mainView]);

  const handleToggleTask = async (id, currentStatus) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: !currentStatus ? 1 : 0 })
      });
      if (res.ok) fetchTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async (id) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedTaskId === id) setSelectedTaskId(null);
        fetchTasks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuickAdd = async (e) => {
    e.preventDefault();
    if (!quickAddTitle.trim()) return;

    // Ejecutar el motor local NLP para autocompletar propiedades
    const parsedTaskData = parseNLPQuickAdd(quickAddTitle, lists, activeList);

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedTaskData)
      });
      if (res.ok) {
        setQuickAddTitle('');
        fetchTasks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredTasks = tasks.filter(task => {
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

  return (
    <div className="root-layout">
      <GlobalSidebar mainView={mainView} setMainView={setMainView} />
      
      <div className="app-container">
        {mainView === 'tasks' && (
          <Sidebar activeList={activeList} setActiveList={setActiveList} lists={lists} onRefreshLists={fetchLists} />
        )}
        
        <main className={`main-content ${selectedTaskId || selectedSubtaskId ? 'pane-open' : ''}`}>
          {mainView === 'tasks' ? (
            <>
              <header className="header ticktick-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '1.25rem' }}>
                <h1 style={{ marginBottom: 0 }}>{getHeaderTitle()}</h1>
                
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

              <form className="quick-add-bar" onSubmit={handleQuickAdd}>
                <Plus size={18} className="quick-add-icon" />
                <input 
                  type="text" 
                  placeholder="Add Task" 
                  value={quickAddTitle}
                  onChange={e => setQuickAddTitle(e.target.value)}
                />
              </form>

              {loading ? (
                <div>Loading...</div>
              ) : typeof activeList === 'number' && projectLayout === 'kanban' ? (
                <ProjectKanbanView 
                  tasks={tasks}
                  sections={sections}
                  activeList={activeList}
                  onSelectTask={(id) => {
                    setSelectedTaskId(id);
                    setSelectedSubtaskId(null);
                  }}
                  onToggleTask={handleToggleTask}
                  onRefreshTasks={fetchTasks}
                  onRefreshSections={fetchSections}
                />
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
                      />
                    ))
                  )}
                </div>
              ) : (
                <div className="empty-state">
                  <Inbox />
                  <p>No tasks found. Add a task above!</p>
                  {typeof activeList === 'number' && (
                     <button className="add-section-btn mt-4" onClick={async () => {
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
                  )}
                </div>
              )}
            </>
          ) : mainView === 'calendar' ? (
            <CalendarView 
              tasks={tasks} 
              lists={lists} 
              externalEvents={externalEvents}
              onSelectEvent={handleSelectEvent} 
              onUpdateEvent={handleUpdateEventDates}
            />
          ) : mainView === 'pomodoro' ? (
            <PomodoroView tasks={tasks} />
          ) : mainView === 'eisenhower' ? (
            <EisenhowerView 
              tasks={tasks} 
              onSelectTask={setSelectedTaskId} 
              onUpdateTaskPriority={handleUpdateTaskPriority} 
              onAddTaskInQuadrant={handleAddTaskInQuadrant}
            />
          ) : mainView === 'gtd' ? (
            <GTDView 
              tasks={tasks}
              lists={lists}
              onRefreshTasks={fetchTasks}
              onRefreshLists={fetchLists}
            />
          ) : mainView === 'kanban' ? (
            <KanbanView 
              tasks={tasks}
              lists={lists}
              onSelectTask={setSelectedTaskId}
              onUpdateTaskPriority={handleUpdateTaskPriority}
              onUpdateTaskList={handleUpdateTaskList}
              onAddTaskInQuadrant={handleAddTaskInQuadrant}
            />
          ) : mainView === 'settings' ? (
            <SettingsView 
              tasks={tasks}
              lists={lists}
              onRefreshTasks={() => {
                fetchTasks();
                const savedUrl = localStorage.getItem('outlookIcalUrl');
                const url = savedUrl !== null ? savedUrl : 'https://outlook.office365.com/owa/calendar/58d72e5354c04cf6a0abdd36dcd8429d@afpmodelo.cl/6e2d4535dc4543f0b51e510dd30064c410332200703118504817/calendar.ics';
                setOutlookIcalUrl(url);
                fetchExternalEvents(url);
              }}
            />
          ) : (
            <AnalyticsView 
              tasks={tasks}
              lists={lists}
              onRefreshTasks={fetchTasks}
            />
          )}
        </main>

        {(selectedTask || selectedSubtask) && (
          <aside className="right-pane">
            <TaskDetail 
              task={selectedTask}
              subtask={selectedSubtask}
              sections={sections}
              onClose={() => {
                setSelectedTaskId(null);
                setSelectedSubtaskId(null);
              }}
              onUpdate={fetchTasks}
              onDelete={handleDeleteTask}
              onDeleteSubtask={async (id) => {
                try {
                  const res = await fetch(`/api/subtasks/${id}`, { method: 'DELETE' });
                  if (res.ok) {
                    setSelectedSubtaskId(null);
                    fetchTasks();
                  }
                } catch (err) {
                  console.error(err);
                }
              }}
            />
          </aside>
        )}
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
      </div>
    </div>
  );
}

export default App;
