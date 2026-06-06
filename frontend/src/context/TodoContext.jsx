import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { isToday, isFuture, parseISO, format, addDays } from 'date-fns';
import { sendNotification } from '../utils/notifications';
import { parseTimezoneOffset, adjustExternalDate } from '../utils/timezone';
import { db } from '../utils/db';

// --- SECURE API FETCH INTERCEPTOR FOR JWT ---
const originalFetch = window.fetch;
const API_URL = import.meta.env.VITE_API_URL || '';

window.fetch = async function (url, options = {}) {
  const token = localStorage.getItem('todo_token');
  let targetUrl = url;

  if (typeof url === 'string' && url.includes('/api/')) {
    if (url.startsWith('/api/')) {
      targetUrl = `${API_URL}${url}`;
    }

    if (token) {
      options.headers = options.headers || {};
      if (!(options.headers instanceof Headers)) {
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${token}`
        };
      } else {
        options.headers.set('Authorization', `Bearer ${token}`);
      }
    }
  }

  const response = await originalFetch(targetUrl, options);
  if (typeof url === 'string' && url.includes('/api/') && (response.status === 401 || response.status === 403)) {
    localStorage.removeItem('todo_token');
    localStorage.removeItem('todo_user');
    window.dispatchEvent(new Event('auth-failed'));
  }
  return response;
};

const TodoContext = createContext();

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

  // 2. Extract hashtags (e.g. #Trabajo, #urgente, #5min)
  let tags = [];
  const hashtagRegex = /#([\wáéíóúñ\-]+)/gi;
  let match;
  hashtagRegex.lastIndex = 0;
  const matchesToReplace = [];
  while ((match = hashtagRegex.exec(title)) !== null) {
    const fullMatch = match[0];
    const hashtag = match[1];
    const matchedList = lists.find(l => l.name.toLowerCase() === hashtag.toLowerCase());
    if (matchedList) {
      list_id = matchedList.id;
    } else {
      tags.push(hashtag.toLowerCase());
    }
    matchesToReplace.push(fullMatch);
  }
  for (const matchStr of matchesToReplace) {
    title = title.replace(matchStr, '');
  }
  tags = Array.from(new Set(tags));

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

  // 5. Extract recurrence
  let recurrence_type = 'none';
  if (/\b(?:cada día|diariamente|todos los días|cada dia)\b/i.test(title)) {
    recurrence_type = 'daily';
    title = title.replace(/\b(?:cada día|diariamente|todos los días|cada dia)\b/i, '');
  } else if (/\b(?:cada semana|semanalmente)\b/i.test(title)) {
    recurrence_type = 'weekly';
    title = title.replace(/\b(?:cada semana|semanalmente)\b/i, '');
  } else if (/\b(?:cada mes|mensualmente)\b/i.test(title)) {
    recurrence_type = 'monthly';
    title = title.replace(/\b(?:cada mes|mensualmente)\b/i, '');
  } else if (/\b(?:de lunes a viernes|días laborables|dias laborables|días de semana|dias de semana)\b/i.test(title)) {
    recurrence_type = 'weekdays';
    title = title.replace(/\b(?:de lunes a viernes|días laborables|dias laborables|días de semana|dias de semana)\b/i, '');
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
    end_time,
    tags,
    recurrence_type
  };
}

export function TodoProvider({ children }) {
  // --- AUTH STATES ---
  const [token, setToken] = useState(() => localStorage.getItem('todo_token') || '');
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('todo_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [isWidgetMode] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('widget') === 'true';
    } catch (e) {
      return false;
    }
  });

  const login = (newToken, newUser) => {
    localStorage.setItem('todo_token', newToken);
    localStorage.setItem('todo_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('todo_token');
    localStorage.removeItem('todo_user');
    setToken('');
    setUser(null);
  };

  useEffect(() => {
    const handleAuthFailed = () => {
      logout();
    };
    window.addEventListener('auth-failed', handleAuthFailed);
    return () => window.removeEventListener('auth-failed', handleAuthFailed);
  }, []);

  // --- UI & NAVIGATION STATES ---
  const [mainView, setMainView] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const view = params.get('view');
      const validViews = ['tasks', 'calendar', 'pomodoro', 'eisenhower', 'gtd', 'kanban', 'settings', 'analytics', 'admin', 'shared'];
      return (view && validViews.includes(view)) ? view : 'tasks';
    } catch (e) {
      return 'tasks';
    }
  });

  const [activeList, setActiveList] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const list = params.get('list');
      if (list === 'today' || list === 'upcoming' || list === 'inbox') return list;
      const listId = Number(list);
      if (!isNaN(listId) && listId > 0) return listId;
      return 'inbox';
    } catch (e) {
      return 'inbox';
    }
  });

  const [activeTagFilter, setActiveTagFilter] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [selectedSubtaskId, setSelectedSubtaskId] = useState(null);
  const [globalContextMenu, setGlobalContextMenu] = useState(null);
  const [activePomodoroTaskId, setActivePomodoroTaskId] = useState(null);
  
  const [rightPaneWidth, setRightPaneWidth] = useState(() => {
    return parseInt(localStorage.getItem('rightPaneWidth') || '350', 10);
  });

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [projectLayout, setProjectLayout] = useState('list');

  // --- DATA STATES ---
  const [tasks, setTasks] = useState([]);
  const [lists, setLists] = useState([]);
  const [sections, setSections] = useState([]);
  const [tags, setTags] = useState([]);
  const [listGroups, setListGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- TIMEZONE STATES ---
  const [homeTimezone, setHomeTimezone] = useState(() => localStorage.getItem('homeTimezone') || 'browser');
  const [activeTimezoneMode, setActiveTimezoneMode] = useState(() => localStorage.getItem('activeTimezoneMode') || 'home');
  const [acknowledgedTimezone, setAcknowledgedTimezone] = useState(() => localStorage.getItem('acknowledgedTimezoneOffset') || '');
  const [dismissedTimezoneBanner, setDismissedTimezoneBanner] = useState(false);

  // --- FILTER STATES ---
  const [filterPriority, setFilterPriority] = useState(null);
  const [filterHideCompleted, setFilterHideCompleted] = useState(true);
  const [filterTagId, setFilterTagId] = useState(null);

  // --- VOICE & SPEECH STATES ---
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [listeningSource, setListeningSource] = useState('');
  const [isReadingAgenda, setIsReadingAgenda] = useState(false);

  // --- SYNCHRONIZATION & TOASTS ---
  const [activeRequests, setActiveRequests] = useState(0);

  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  const updatePendingSyncCount = async () => {
    try {
      const queue = await db.getQueue();
      setPendingSyncCount(queue.length);
    } catch (e) {
      console.error(e);
    }
  };

  const triggerSync = async () => {
    if (!navigator.onLine) return;
    try {
      const queue = await db.getQueue();
      if (queue.length === 0) return;

      for (const action of queue) {
        try {
          const { url, method, body, tempId } = action;
          const fetchOptions = {
            method,
            headers: { 'Content-Type': 'application/json' }
          };
          if (body) {
            fetchOptions.body = JSON.stringify(body);
          }

          const res = await fetch(url, fetchOptions);
          if (res.ok) {
            if (method === 'POST' && tempId) {
              const data = await res.json();
              if (data && data.id) {
                if (url.includes('/tasks')) {
                  await db.deleteItem('tasks', tempId);
                }
              }
            }
            await db.dequeueAction(action.id);
          } else {
            console.error('Failed to sync action:', action, res.statusText);
            if (res.status >= 400 && res.status < 500) {
              await db.dequeueAction(action.id);
            } else {
              break;
            }
          }
        } catch (err) {
          console.error('Error syncing action:', err);
          break;
        }
      }
      
      await updatePendingSyncCount();
      fetchTasks();
      fetchLists();
      fetchSections();
      fetchTags();
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    updatePendingSyncCount();
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      triggerSync();
    };
    const handleOffline = () => {
      setIsOffline(true);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const isApiCall = typeof args[0] === 'string' && args[0].includes('/api/');
      
      if (isApiCall) {
        setActiveRequests(prev => prev + 1);
      }
      
      try {
        return await originalFetch(...args);
      } finally {
        if (isApiCall) {
          setActiveRequests(prev => Math.max(0, prev - 1));
        }
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const [syncingTaskIds, setSyncingTaskIds] = useState(new Set());
  const [externalEvents, setExternalEvents] = useState([]);
  const [externalEventsError, setExternalEventsError] = useState(null);
  
  const [outlookIcalUrl, setOutlookIcalUrl] = useState(() => {
    if (user?.outlook_ical_url) return user.outlook_ical_url;
    const userId = user?.id;
    if (!userId) return '';
    const scopedSaved = localStorage.getItem(`outlookIcalUrl_${userId}`);
    if (scopedSaved !== null) return scopedSaved;

    // Auto-migrate old unscoped URL if it exists
    const oldSaved = localStorage.getItem('outlookIcalUrl');
    if (oldSaved !== null) {
      localStorage.setItem(`outlookIcalUrl_${userId}`, oldSaved);
      localStorage.removeItem('outlookIcalUrl');
      return oldSaved;
    }
    return '';
  });

  const [toasts, setToasts] = useState([]);
  const notifiedConflictsRef = useRef(new Set());

  const showToast = (title, message, type = 'warning') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, title, message, type }]);
    
    // Auto-remove after 6 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  // --- API FETCHES ---
  const fetchTasks = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/tasks');
      if (res.ok) {
        const data = await res.json();
        const verified = Array.isArray(data) ? data : [];
        setTasks(verified);
        db.saveCollection('tasks', verified).catch(e => console.error(e));
      } else {
        console.error('Failed to fetch tasks:', res.statusText);
        const local = await db.getCollection('tasks');
        setTasks(local);
      }
      fetchTags();
    } catch (err) {
      console.error(err);
      const local = await db.getCollection('tasks');
      setTasks(local);
      fetchTags();
    }
  };

  const fetchLists = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/lists');
      if (res.ok) {
        const data = await res.json();
        const verified = Array.isArray(data) ? data : [];
        setLists(verified);
        db.saveCollection('lists', verified).catch(e => console.error(e));
      }
      fetchListGroups();
    } catch (err) {
      console.error(err);
      const local = await db.getCollection('lists');
      setLists(local);
      fetchListGroups();
    }
  };

  const fetchListGroups = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/list-groups');
      if (res.ok) {
        const data = await res.json();
        const verified = Array.isArray(data) ? data : [];
        setListGroups(verified);
        db.saveCollection('listGroups', verified).catch(e => console.error(e));
      }
    } catch (err) {
      console.error(err);
      const local = await db.getCollection('listGroups');
      setListGroups(local);
    }
  };

  const fetchSections = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/sections');
      if (res.ok) {
        const data = await res.json();
        const verified = Array.isArray(data) ? data : [];
        setSections(verified);
        db.saveCollection('sections', verified).catch(e => console.error(e));
      }
    } catch (err) {
      console.error(err);
      const local = await db.getCollection('sections');
      setSections(local);
    }
  };

  const [localTagsLoading, setLocalTagsLoading] = useState(false);
  const fetchTags = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/tags');
      if (res.ok) {
        const data = await res.json();
        const verified = Array.isArray(data) ? data : [];
        setTags(verified);
        db.saveCollection('tags', verified).catch(e => console.error(e));
      } else {
        setTags([]);
      }
    } catch (err) {
      console.error(err);
      const local = await db.getCollection('tags');
      setTags(local);
    }
  };

  const fetchExternalEvents = async (urlToFetch) => {
    if (!token) return;
    const url = urlToFetch || outlookIcalUrl;
    if (!url) {
      setExternalEvents([]);
      setExternalEventsError(null);
      return;
    }
    try {
      setExternalEventsError(null);
      const res = await fetch(`/api/external-events?url=${encodeURIComponent(url.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setExternalEvents(Array.isArray(data) ? data : []);
      } else {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error || res.statusText || 'Error al obtener el calendario';
        console.error('Failed to fetch external events:', errMsg);
        setExternalEventsError(errMsg);
      }
    } catch (err) {
      console.error('Error fetching external events:', err);
      setExternalEventsError(err.message || 'Error de conexión');
    }
  };

  // --- CRUD ACTIONS ---
  const handleToggleTask = async (taskId, currentCompleted) => {
    const nextCompleted = !currentCompleted;
    setSyncingTaskIds(prev => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });

    // Optimistic UI state update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: nextCompleted ? 1 : 0 } : t));

    try {
      const allTasks = await db.getCollection('tasks');
      const target = allTasks.find(t => t.id === taskId);
      if (target) {
        target.is_completed = nextCompleted ? 1 : 0;
        await db.saveItem('tasks', target);
      }
    } catch (e) {
      console.error('Local DB update failed:', e);
    }

    const actionData = {
      url: `/api/tasks/${taskId}`,
      method: 'PUT',
      body: { is_completed: nextCompleted ? 1 : 0 }
    };

    if (!navigator.onLine) {
      await db.enqueueAction(actionData);
      await updatePendingSyncCount();
      setSyncingTaskIds(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      return;
    }

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: nextCompleted ? 1 : 0 })
      });
      if (res.ok) {
        await fetchTasks();
      } else {
        await db.enqueueAction(actionData);
        await updatePendingSyncCount();
      }
    } catch (err) {
      console.error(err);
      await db.enqueueAction(actionData);
      await updatePendingSyncCount();
    } finally {
      setSyncingTaskIds(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const handleUpdateTaskPriority = async (taskId, priority) => {
    if (taskId === undefined) {
      fetchTasks();
      return;
    }
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, priority } : t));
    try {
      const allTasks = await db.getCollection('tasks');
      const target = allTasks.find(t => t.id === taskId);
      if (target) {
        target.priority = priority;
        await db.saveItem('tasks', target);
      }
    } catch (e) {
      console.error(e);
    }

    const bodyData = { priority };
    const actionData = { url: `/api/tasks/${taskId}`, method: 'PUT', body: bodyData };

    if (!navigator.onLine) {
      await db.enqueueAction(actionData);
      await updatePendingSyncCount();
      return;
    }

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      if (res.ok) {
        await fetchTasks();
      } else {
        await db.enqueueAction(actionData);
        await updatePendingSyncCount();
      }
    } catch (err) {
      console.error(err);
      await db.enqueueAction(actionData);
      await updatePendingSyncCount();
    }
  };

  const handleUpdateTaskList = async (taskId, listId) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, list_id: listId } : t));
    try {
      const allTasks = await db.getCollection('tasks');
      const target = allTasks.find(t => t.id === taskId);
      if (target) {
        target.list_id = listId;
        await db.saveItem('tasks', target);
      }
    } catch (e) {
      console.error(e);
    }

    const bodyData = { list_id: listId };
    const actionData = { url: `/api/tasks/${taskId}`, method: 'PUT', body: bodyData };

    if (!navigator.onLine) {
      await db.enqueueAction(actionData);
      await updatePendingSyncCount();
      return;
    }

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      if (res.ok) {
        await fetchTasks();
      } else {
        await db.enqueueAction(actionData);
        await updatePendingSyncCount();
      }
    } catch (err) {
      console.error(err);
      await db.enqueueAction(actionData);
      await updatePendingSyncCount();
    }
  };

  const handleUpdateTaskSection = async (taskId, sectionId) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, section_id: sectionId } : t));
    try {
      const allTasks = await db.getCollection('tasks');
      const target = allTasks.find(t => t.id === taskId);
      if (target) {
        target.section_id = sectionId;
        await db.saveItem('tasks', target);
      }
    } catch (e) {
      console.error(e);
    }

    const bodyData = { section_id: sectionId };
    const actionData = { url: `/api/tasks/${taskId}`, method: 'PUT', body: bodyData };

    if (!navigator.onLine) {
      await db.enqueueAction(actionData);
      await updatePendingSyncCount();
      return;
    }

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      if (res.ok) {
        await fetchTasks();
      } else {
        await db.enqueueAction(actionData);
        await updatePendingSyncCount();
      }
    } catch (err) {
      console.error(err);
      await db.enqueueAction(actionData);
      await updatePendingSyncCount();
    }
  };

  const handleRescheduleTask = async (taskId, offsetDays) => {
    const date = addDays(new Date(), offsetDays);
    const dueDateStr = format(date, 'yyyy-MM-dd');

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, due_date: dueDateStr } : t));
    try {
      const allTasks = await db.getCollection('tasks');
      const target = allTasks.find(t => t.id === taskId);
      if (target) {
        target.due_date = dueDateStr;
        await db.saveItem('tasks', target);
      }
    } catch (e) {
      console.error(e);
    }

    const bodyData = { due_date: dueDateStr };
    const actionData = { url: `/api/tasks/${taskId}`, method: 'PUT', body: bodyData };

    if (!navigator.onLine) {
      await db.enqueueAction(actionData);
      await updatePendingSyncCount();
      return;
    }

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      if (res.ok) {
        await fetchTasks();
      } else {
        await db.enqueueAction(actionData);
        await updatePendingSyncCount();
      }
    } catch (err) {
      console.error(err);
      await db.enqueueAction(actionData);
      await updatePendingSyncCount();
    }
  };

  const handleAddTask = async (taskData) => {
    const tempId = 'offline_' + Date.now() + '_' + Math.random();
    const newTask = {
      ...taskData,
      id: tempId,
      is_completed: 0,
      subtasks: [],
      tags: taskData.tags ? taskData.tags.map(name => {
        const existing = tags.find(t => t.name.toLowerCase() === name.toLowerCase());
        return existing || { id: 'tag_' + Math.random(), name };
      }) : []
    };

    setTasks(prev => [newTask, ...prev]);
    try {
      await db.saveItem('tasks', newTask);
    } catch (e) {
      console.error(e);
    }

    const actionData = { url: '/api/tasks', method: 'POST', body: taskData, tempId };

    if (!navigator.onLine) {
      await db.enqueueAction(actionData);
      await updatePendingSyncCount();
      return;
    }

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
      if (res.ok) {
        await db.deleteItem('tasks', tempId);
        fetchTasks();
        fetchTags();
      } else {
        await db.enqueueAction(actionData);
        await updatePendingSyncCount();
      }
    } catch (err) {
      console.error(err);
      await db.enqueueAction(actionData);
      await updatePendingSyncCount();
    }
  };

  const handleUpdateTask = async (taskId, updatedFields) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updatedFields } : t));
    try {
      const allTasks = await db.getCollection('tasks');
      const target = allTasks.find(t => t.id === taskId);
      if (target) {
        const updated = { ...target, ...updatedFields };
        await db.saveItem('tasks', updated);
      }
    } catch (e) {
      console.error(e);
    }

    const actionData = { url: `/api/tasks/${taskId}`, method: 'PUT', body: updatedFields };

    if (!navigator.onLine) {
      await db.enqueueAction(actionData);
      await updatePendingSyncCount();
      return;
    }

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields)
      });
      if (res.ok) {
        await fetchTasks();
      } else {
        await db.enqueueAction(actionData);
        await updatePendingSyncCount();
      }
    } catch (err) {
      console.error(err);
      await db.enqueueAction(actionData);
      await updatePendingSyncCount();
    }
  };

  const handleDeleteTask = async (taskId) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      await db.deleteItem('tasks', taskId);
    } catch (e) {
      console.error(e);
    }

    if (selectedTaskId === taskId) {
      setSelectedTaskId(null);
    }

    const actionData = { url: `/api/tasks/${taskId}`, method: 'DELETE' };

    if (!navigator.onLine) {
      await db.enqueueAction(actionData);
      await updatePendingSyncCount();
      return;
    }

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchTasks();
      } else {
        await db.enqueueAction(actionData);
        await updatePendingSyncCount();
      }
    } catch (err) {
      console.error(err);
      await db.enqueueAction(actionData);
      await updatePendingSyncCount();
    }
  };

  const handleDeleteSubtask = async (subtaskId) => {
    setTasks(prev => prev.map(t => {
      if (t.subtasks) {
        return {
          ...t,
          subtasks: t.subtasks.filter(st => st.id !== subtaskId)
        };
      }
      return t;
    }));

    if (selectedSubtaskId === subtaskId) {
      setSelectedSubtaskId(null);
    }

    const actionData = { url: `/api/subtasks/${subtaskId}`, method: 'DELETE' };

    if (!navigator.onLine) {
      await db.enqueueAction(actionData);
      await updatePendingSyncCount();
      return;
    }

    try {
      const res = await fetch(`/api/subtasks/${subtaskId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchTasks();
      } else {
        await db.enqueueAction(actionData);
        await updatePendingSyncCount();
      }
    } catch (err) {
      console.error(err);
      await db.enqueueAction(actionData);
      await updatePendingSyncCount();
    }
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
      const url = isSubtask ? `/api/subtasks/${itemId}` : `/api/tasks/${itemId}`;
      await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_time: start,
          end_time: end,
          due_date: derivedDueDate
        })
      });
      fetchTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddTaskInQuadrant = async (title, priority) => {
    const inboxList = lists.find(l => l.name.toLowerCase() === 'inbox');
    const inboxListId = inboxList ? inboxList.id : null;
    const list_id = typeof activeList === 'number' ? activeList : inboxListId;

    const taskData = {
      title,
      list_id,
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

  const handleQuickAdd = async (e, overrideTitle) => {
    if (e && e.preventDefault) e.preventDefault();
    const titleToUse = typeof overrideTitle === 'string' ? overrideTitle : quickAddTitle;
    if (!titleToUse.trim()) return;

    const parsedTaskData = parseNLPQuickAdd(titleToUse, lists, activeList);
    let finalTaskData = { ...parsedTaskData };

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalTaskData)
      });
      if (res.ok) {
        setQuickAddTitle('');
        fetchTasks();
        fetchTags();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startSpeechRecognition = (source) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('La transcripción de voz no está soportada en este navegador. Intenta con Google Chrome o Microsoft Edge.');
      return;
    }

    if (isListening) {
      if (window.activeRecognition) {
        window.activeRecognition.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-ES';
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;

      let silenceTimer = null;

      const resetSilenceTimer = () => {
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
          console.log('[SPEECH] Inactivity timeout. Stopping recognition.');
          recognition.stop();
        }, 5000); // 5 segundos de silencio tolerados antes de guardar/cerrar
      };

      recognition.onstart = () => {
        setIsListening(true);
        setListeningSource(source);
        resetSilenceTimer();
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (silenceTimer) clearTimeout(silenceTimer);
        if (event.error === 'not-allowed') {
          alert('Permiso de micrófono denegado. Por favor, habilita el micrófono en la configuración de tu navegador.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        window.activeRecognition = null;
        if (silenceTimer) clearTimeout(silenceTimer);
      };

      recognition.onresult = (event) => {
        resetSilenceTimer();
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = 0; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        let currentText = (finalTranscript + interimTranscript).trim();

        // 1. Detección del comando de auto-guardado manos libres al final del dictado
        let shouldAutoSubmit = false;
        if (event.results[event.results.length - 1].isFinal) {
          const lowerText = currentText.toLowerCase().trim();
          if (lowerText.endsWith('y listo') || lowerText.endsWith('guardar')) {
            shouldAutoSubmit = true;
            // Quitar el comando del texto final
            currentText = currentText
              .replace(/\s+(?:y listo|guardar)$/i, '')
              .replace(/^(?:y listo|guardar)$/i, '');
          }
        }

        // 2. Formatear automáticamente palabras habladas en símbolos (hashtag/almohadilla/gato/etiqueta -> #, exclamación -> !)
        currentText = currentText
          .replace(/(?:hashtag|hastag|hasthtag|almohadilla|gato|etiqueta)\s+(\w+)/gi, '#$1')
          .replace(/\s*(?:tres exclamaciones|tres signos de exclamación|tres admiraciones|tres signos de admiración)/gi, ' !!!')
          .replace(/\s*(?:dos exclamaciones|dos signos de exclamación|dos admiraciones|dos signos de admiración)/gi, ' !!')
          .replace(/\s*(?:una exclamación|signo de exclamación|una admiración|signo de admiración)/gi, ' !');

        // 3. Mapear cuadrantes de Eisenhower por nombre hablado
        currentText = currentText
          .replace(/\s*(?:urgente e importante|prioridad alta|cuadrante uno|cuadrante 1)/gi, ' !!!')
          .replace(/\s*(?:importante no urgente|importante pero no urgente|prioridad media|cuadrante dos|cuadrante 2)/gi, ' !!')
          .replace(/\s*(?:urgente no importante|urgente pero no importante|prioridad baja|cuadrante tres|cuadrante 3)/gi, ' !')
          .replace(/\s*(?:no urgente no importante|no urgente y no importante|prioridad ninguna|cuadrante cuatro|cuadrante 4)/gi, ' ');

        // 4. Mapear atajos rápidos de fecha relativa hablados
        currentText = currentText
          .replace(/\s*(?:esta tarde)/gi, ' hoy a las 6 pm')
          .replace(/\s*(?:esta noche)/gi, ' hoy a las 9 pm')
          .replace(/\s*(?:fin de semana|el fin de semana)/gi, ' sábado');

        setQuickAddTitle(currentText);

        if (shouldAutoSubmit) {
          if (window.activeRecognition) {
            window.activeRecognition.stop();
          }
          setIsListening(false);
          if (silenceTimer) clearTimeout(silenceTimer);
          
          setTimeout(() => {
            handleQuickAdd(null, currentText);
          }, 100);
        }
      };

      window.activeRecognition = recognition;
      recognition.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  };

  const generateSpeechScript = (userName, todayTasks) => {
    const pending = todayTasks.filter(t => !t.is_completed);
    const completed = todayTasks.filter(t => t.is_completed);

    const hours = new Date().getHours();
    let greeting = '¡Hola!';
    if (hours < 12) greeting = '¡Buenos días!';
    else if (hours < 19) greeting = '¡Buenas tardes!';
    else greeting = '¡Buenas noches!';

    const namePhrase = userName ? `, ${userName}` : '';
    let script = `${greeting}${namePhrase}. `;

    if (todayTasks.length === 0) {
      script += 'Hoy tienes el día completamente despejado de tareas en tu agenda. Es una excelente oportunidad para descansar, reflexionar o planificar tus próximos pasos con tranquilidad. ¡Disfruta de tu día!';
      return script;
    }

    if (completed.length > 0) {
      if (completed.length === 1) {
        script += `¡Buen trabajo! Ya has completado tu primera tarea de hoy: "${completed[0].title}". `;
      } else {
        script += `¡Fabuloso! Hoy ya has completado ${completed.length} tareas: ${completed.map(t => `"${t.title}"`).join(', y ')}. Sigue con ese gran ritmo. `;
      }
    }

    if (pending.length === 0) {
      if (completed.length > 0) {
        script += '¡Y lo mejor de todo es que no te queda ninguna tarea pendiente para el resto del día! Has completado todo lo programado. ¡Muchas felicidades!';
      } else {
        script += 'No tienes ninguna tarea pendiente programada para hoy. ¡Qué gran día para relajarse!';
      }
    } else {
      script += `Para lo que queda del día, tienes ${pending.length} ${pending.length === 1 ? 'actividad pendiente' : 'actividades pendientes'} por realizar. `;

      const sortedPending = [...pending].sort((a, b) => {
        if (a.start_time && b.start_time) return new Date(a.start_time) - new Date(b.start_time);
        if (a.start_time) return -1;
        if (b.start_time) return 1;
        return b.priority - a.priority;
      });

      script += 'Aquí tienes tu plan: ';

      sortedPending.forEach((task, idx) => {
        let taskPhrase = '';
        if (idx === 0) {
          taskPhrase = 'Primero, ';
        } else if (idx === sortedPending.length - 1 && sortedPending.length > 1) {
          taskPhrase = 'Y por último, ';
        } else {
          taskPhrase = 'Luego, ';
        }

        taskPhrase += `debes "${task.title}". `;

        if (task.start_time) {
          const timeStr = format(parseISO(task.start_time), 'HH:mm');
          taskPhrase = taskPhrase.replace('". ', `", programada a las ${timeStr}. `);
        }

        if (task.priority === 3) {
          taskPhrase += 'Esta actividad es de prioridad urgente e importante, por lo que te recomiendo enfocar toda tu energía en ella cuanto antes. ';
        } else if (task.priority === 2) {
          taskPhrase += 'Esta es una tarea importante que requiere buena atención. ';
        }

        script += taskPhrase;
      });

      script += '¡Mucho éxito con tu agenda de hoy, estoy seguro de que lograrás todo lo que te propongas!';
    }

    return script;
  };

  const handleReadAgendaAloud = () => {
    if (isReadingAgenda) {
      window.speechSynthesis.cancel();
      setIsReadingAgenda(false);
      return;
    }

    const todayTasks = tasks.filter(t => t.due_date && isToday(parseISO(t.due_date)));
    const userNameStr = localStorage.getItem('userName') || 'Carlos';
    const script = generateSpeechScript(userNameStr, todayTasks);

    try {
      const utterance = new SpeechSynthesisUtterance(script);
      utterance.lang = 'es-ES';

      const voices = window.speechSynthesis.getVoices();
      const savedVoiceName = localStorage.getItem('agenda_voice_name');
      let selectedVoice = null;
      if (savedVoiceName) {
        selectedVoice = voices.find(v => v.name === savedVoiceName);
      }
      if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.startsWith('es-')) || voices[0];
      }
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.rate = 1.02;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setIsReadingAgenda(true);
      };

      utterance.onend = () => {
        setIsReadingAgenda(false);
      };

      utterance.onerror = () => {
        setIsReadingAgenda(false);
      };

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('SpeechSynthesis error:', e);
      setIsReadingAgenda(false);
    }
  };

  // --- OVERLAP CONFLICT DETECTION ---
  useEffect(() => {
    if (!tasks || !externalEvents || tasks.length === 0 || externalEvents.length === 0) return;

    const parseDate = (dStr) => {
      if (!dStr) return null;
      try {
        const d = parseISO(dStr);
        return isNaN(d.getTime()) ? null : d;
      } catch (e) {
        return null;
      }
    };

    const activeTasks = [];
    tasks.forEach(t => {
      if (t.is_completed) return;
      const start = parseDate(t.start_time);
      const end = parseDate(t.end_time);
      if (start && end) {
        activeTasks.push({ id: `task-${t.id}`, title: t.title, start, end });
      }
      if (t.subtasks && Array.isArray(t.subtasks)) {
        t.subtasks.forEach(st => {
          if (st.is_completed) return;
          const stStart = parseDate(st.start_time);
          const stEnd = parseDate(st.end_time);
          if (stStart && stEnd) {
            activeTasks.push({ id: `sub-${st.id}`, title: `${t.title} > ${st.title}`, start: stStart, end: stEnd });
          }
        });
      }
    });

    const parsedEvents = externalEvents.map(e => {
      const start = parseDate(e.start_time);
      const end = parseDate(e.end_time);
      if (!start || !end) return null;
      const adjustedStart = adjustExternalDate(start, homeTimezone, activeTimezoneMode);
      const adjustedEnd = adjustExternalDate(end, homeTimezone, activeTimezoneMode);
      return { uid: e.uid, title: e.title, start: adjustedStart, end: adjustedEnd };
    }).filter(Boolean);

    const currentConflicts = new Set();

    parsedEvents.forEach(e => {
      activeTasks.forEach(t => {
        if (t.start < e.end && t.end > e.start) {
          const conflictKey = `${t.id}-${e.uid}`;
          currentConflicts.add(conflictKey);

          if (!notifiedConflictsRef.current.has(conflictKey)) {
            notifiedConflictsRef.current.add(conflictKey);

            const msgTitle = `⚠️ Conflicto detectado en Outlook`;
            const msgBody = `Tu tarea "${t.title}" se cruza con "${e.title}".`;
            
            sendNotification(msgTitle, msgBody);
            showToast(msgTitle, msgBody, 'warning');
          }
        }
      });
    });

    notifiedConflictsRef.current.forEach(key => {
      if (!currentConflicts.has(key)) {
        notifiedConflictsRef.current.delete(key);
      }
    });
  }, [tasks, externalEvents, homeTimezone, activeTimezoneMode]);

  // --- INITIAL DATA LOAD ---
  useEffect(() => {
    if (token) {
      setLoading(true);
      Promise.all([
        fetchTasks(),
        fetchLists(),
        fetchSections(),
        fetchTags(),
        fetchListGroups()
      ]).then(() => {
        setLoading(false);
      }).catch(err => {
        console.error('Error fetching initial todo data:', err);
        setLoading(false);
      });
    } else {
      setTasks([]);
      setLists([]);
      setSections([]);
      setTags([]);
      setListGroups([]);
      setLoading(false);
    }
  }, [token]);

  // Load external calendar on user load or iCal URL change
  useEffect(() => {
    if (token && user?.id) {
      const url = user.outlook_ical_url || localStorage.getItem(`outlookIcalUrl_${user.id}`) || '';
      setOutlookIcalUrl(url);
      fetchExternalEvents(url);
    }
  }, [token, user]);

  return (
    <TodoContext.Provider value={{
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
      setIsListening,
      listeningSource,
      setListeningSource,
      isReadingAgenda,
      setIsReadingAgenda,

      activeRequests,
      setActiveRequests,
      isOffline,
      pendingSyncCount,
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
      handleReadAgendaAloud,
      handleTaskContextMenu
    }}>
      {children}
    </TodoContext.Provider>
  );
}

export function useTodo() {
  const context = useContext(TodoContext);
  if (!context) {
    throw new Error('useTodo must be used within a TodoProvider');
  }
  return context;
}
