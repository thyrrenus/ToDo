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
import { LoginView } from './components/LoginView';
import { ProjectKanbanView } from './components/ProjectKanbanView';
import { SectionHeader } from './components/SectionHeader';
import { AdminView } from './components/AdminView';
import { SharedTasksView } from './components/SharedTasksView';
import { EmptyState } from './components/EmptyState';
import { CommandPalette } from './components/CommandPalette';
import { GlobalContextMenu } from './components/GlobalContextMenu';
import { Inbox, Plus, Mic, X } from 'lucide-react';
import { isToday, isFuture, parseISO, format, addDays } from 'date-fns';
import { sendNotification } from './utils/notifications';
import { parseTimezoneOffset, getTimezoneDiffMinutes, adjustExternalDate } from './utils/timezone';


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

function AddTaskWidget({ 
  tasks, 
  lists, 
  activeList, 
  quickAddTitle, 
  setQuickAddTitle, 
  handleQuickAdd, 
  onToggleTask,
  fetchTasks,
  onSelectTask,
  isListening,
  listeningSource,
  startSpeechRecognition
}) {
  const inboxList = lists.find(l => l.name.toLowerCase() === 'inbox');
  const inboxListId = inboxList ? inboxList.id : null;

  // Filter tasks
  const todayTasks = tasks.filter(t => !t.is_completed && t.due_date && isToday(parseISO(t.due_date)));
  const inboxTasks = tasks.filter(t => !t.is_completed && (t.list_id === null || t.list_id === inboxListId) && !(t.due_date && isToday(parseISO(t.due_date))));

  const handleChipClick = (text) => {
    setQuickAddTitle(prev => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed} ${text}` : text;
    });
    setTimeout(() => {
      const input = document.getElementById('widget-quick-add-input');
      if (input) input.focus();
    }, 50);
  };

  const getPriorityColor = (prio) => {
    if (prio === 3) return '#ef4444';
    if (prio === 2) return '#3b82f6';
    if (prio === 1) return '#f59e0b';
    return 'var(--text-secondary)';
  };

  return (
    <div className="add-task-widget">
      <form onSubmit={handleQuickAdd} className="widget-quick-add-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Plus size={18} className="widget-quick-add-icon" />
        <input 
          id="widget-quick-add-input"
          type="text" 
          placeholder="Escribe una tarea (ej: Comprar pan mañana a las 8am !!!)" 
          value={quickAddTitle}
          onChange={e => setQuickAddTitle(e.target.value)}
          autoFocus
          style={{ flex: 1 }}
        />
        {/* Microphone Button */}
        <button
          type="button"
          onClick={() => startSpeechRecognition('widget')}
          className={`mic-button ${isListening && listeningSource === 'widget' ? 'listening' : ''}`}
          style={{
            background: isListening && listeningSource === 'widget' ? 'var(--danger-color)' : 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-color)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isListening && listeningSource === 'widget' ? '#ffffff' : 'var(--text-primary)',
            cursor: 'pointer',
            transition: 'all 0.25s ease',
            flexShrink: 0
          }}
          title={isListening && listeningSource === 'widget' ? "Detener grabación de voz" : "Añadir tarea por voz"}
        >
          {isListening && listeningSource === 'widget' ? (
            <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
              <span className="voice-bar"></span>
              <span className="voice-bar"></span>
              <span className="voice-bar"></span>
            </div>
          ) : (
            <Mic size={14} />
          )}
        </button>
        <button type="submit" className="widget-quick-add-submit-btn" style={{ flexShrink: 0 }}>
          Añadir
        </button>
      </form>

      {/* NLP Helper Chips */}
      <div className="nlp-chips-container">
        <span className="nlp-chips-label">Atajos IA:</span>
        <div className="nlp-chips-list">
          <button type="button" className="nlp-chip chip-prio-3" onClick={() => handleChipClick('!!!')} title="Prioridad Alta">!!! Alta</button>
          <button type="button" className="nlp-chip chip-prio-2" onClick={() => handleChipClick('!!')} title="Prioridad Media">!! Media</button>
          <button type="button" className="nlp-chip chip-prio-1" onClick={() => handleChipClick('!')} title="Prioridad Baja">! Baja</button>
          <button type="button" className="nlp-chip chip-date" onClick={() => handleChipClick('hoy')} title="Programar para Hoy">📅 hoy</button>
          <button type="button" className="nlp-chip chip-date" onClick={() => handleChipClick('mañana')} title="Programar para Mañana">📅 mañana</button>
          {lists.filter(l => l.name.toLowerCase() !== 'inbox').map(list => (
            <button 
              key={list.id}
              type="button" 
              className="nlp-chip chip-list" 
              style={{ '--list-color': list.color || '#7c3aed' }}
              onClick={() => handleChipClick(`#${list.name}`)}
            >
              #{list.name}
            </button>
          ))}
        </div>
      </div>

      {/* Daily checklist */}
      <div className="widget-task-lists-container">
        <div className="widget-task-section">
          <h4 className="widget-task-section-title">⏰ Hoy ({todayTasks.length})</h4>
          <div className="widget-tasks-list">
            {todayTasks.length === 0 ? (
              <div className="widget-empty-tasks">No tienes tareas para hoy. ¡Buen trabajo!</div>
            ) : (
              todayTasks.map(t => (
                <div key={t.id} className="widget-task-item" onClick={() => onSelectTask(t.id)}>
                  <div 
                    className="widget-task-checkbox" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleTask(t.id, t.is_completed);
                    }}
                    style={{ borderColor: getPriorityColor(t.priority) }}
                  />
                  <span className="widget-task-title">{t.title}</span>
                  {t.start_time && (
                    <span className="widget-task-time">
                      {format(parseISO(t.start_time), 'HH:mm')}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="widget-task-section">
          <h4 className="widget-task-section-title">📥 Bandeja de Entrada ({inboxTasks.length})</h4>
          <div className="widget-tasks-list">
            {inboxTasks.length === 0 ? (
              <div className="widget-empty-tasks">Bandeja de entrada vacía.</div>
            ) : (
              inboxTasks.map(t => (
                <div key={t.id} className="widget-task-item" onClick={() => onSelectTask(t.id)}>
                  <div 
                    className="widget-task-checkbox" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleTask(t.id, t.is_completed);
                    }}
                    style={{ borderColor: getPriorityColor(t.priority) }}
                  />
                  <span className="widget-task-title">{t.title}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
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
  const [token, setToken] = useState(() => localStorage.getItem('todo_token') || '');
  const [isWidgetMode] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('widget') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('todo_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    const handleAuthFailed = () => {
      setToken('');
      setUser(null);
    };
    window.addEventListener('auth-failed', handleAuthFailed);
    return () => window.removeEventListener('auth-failed', handleAuthFailed);
  }, []);
  const [globalContextMenu, setGlobalContextMenu] = useState(null);
  const [activePomodoroTaskId, setActivePomodoroTaskId] = useState(null);

  const [mainView, setMainView] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const view = params.get('view');
      const validViews = ['tasks', 'calendar', 'pomodoro', 'eisenhower', 'gtd', 'kanban', 'settings', 'analytics', 'admin'];
      return (view && validViews.includes(view)) ? view : 'tasks';
    } catch (e) {
      return 'tasks';
    }
  });
  const [tasks, setTasks] = useState([]);
  const [lists, setLists] = useState([]);
  const [sections, setSections] = useState([]);
  const [tags, setTags] = useState([]);
  const [activeTagFilter, setActiveTagFilter] = useState(null);
  const [listGroups, setListGroups] = useState([]);
  const [homeTimezone, setHomeTimezone] = useState(() => localStorage.getItem('homeTimezone') || 'browser');
  const [activeTimezoneMode, setActiveTimezoneMode] = useState(() => localStorage.getItem('activeTimezoneMode') || 'home');
  const [acknowledgedTimezone, setAcknowledgedTimezone] = useState(() => localStorage.getItem('acknowledgedTimezoneOffset') || '');
  const [dismissedTimezoneBanner, setDismissedTimezoneBanner] = useState(false);
  // Smart filters states

  const [filterPriority, setFilterPriority] = useState(null);
  const [filterHideCompleted, setFilterHideCompleted] = useState(false);
  const [filterTagId, setFilterTagId] = useState(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
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
  }); // 'inbox', 'today', 'upcoming' or list ID
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [selectedSubtaskId, setSelectedSubtaskId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [listeningSource, setListeningSource] = useState('');
  const [isReadingAgenda, setIsReadingAgenda] = useState(false);

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
          
          // Guardar de inmediato usando la función con anulación directa de estado
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
  const [activeDragSectionId, setActiveDragSectionId] = useState(null);
  const [projectLayout, setProjectLayout] = useState('list'); // 'list' or 'kanban'
  const [externalEvents, setExternalEvents] = useState([]);
  const [externalEventsError, setExternalEventsError] = useState(null);
  const [outlookIcalUrl, setOutlookIcalUrl] = useState(() => {
    if (user?.outlook_ical_url) return user.outlook_ical_url;
    const userId = user?.id;
    if (!userId) return '';
    const scopedSaved = localStorage.getItem(`outlookIcalUrl_${userId}`);
    if (scopedSaved !== null) return scopedSaved;

    // Auto-migrate Carlos's old unscoped URL if it exists
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

  const fetchExternalEvents = async (urlToFetch) => {
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

    // Find overlaps and alert
    parsedEvents.forEach(e => {
      activeTasks.forEach(t => {
        if (t.start < e.end && t.end > e.start) {
          const conflictKey = `${t.id}-${e.uid}`;
          currentConflicts.add(conflictKey);

          if (!notifiedConflictsRef.current.has(conflictKey)) {
            notifiedConflictsRef.current.add(conflictKey);

            const msgTitle = `⚠️ Conflicto detectado en Outlook`;
            const msgBody = `Tu tarea "${t.title}" se cruza con "${e.title}".`;
            
            // 1. Desktop Notification
            sendNotification(msgTitle, msgBody);
            
            // 2. Custom App Toast Alert
            showToast(msgTitle, msgBody, 'warning');
          }
        }
      });
    });

    // Clean up resolved conflicts from the notified set
    notifiedConflictsRef.current.forEach(key => {
      if (!currentConflicts.has(key)) {
        notifiedConflictsRef.current.delete(key);
      }
    });
  }, [tasks, externalEvents]);

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

  const handleAddTask = async (taskData) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
      if (res.ok) {
        fetchTasks();
        fetchTags();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateTask = async (taskId, updatedFields) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields)
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
      if (res.ok) {
        const data = await res.json();
        setTasks(Array.isArray(data) ? data : []);
      } else {
        console.error('Failed to fetch tasks:', res.statusText);
        setTasks([]);
      }
      fetchTags();
    } catch (err) {
      console.error(err);
      setTasks([]);
    }
  };

  const fetchTags = async () => {
    try {
      const res = await fetch('/api/tags');
      if (res.ok) {
        const data = await res.json();
        setTags(Array.isArray(data) ? data : []);
      } else {
        setTags([]);
      }
    } catch (err) {
      console.error(err);
      setTags([]);
    }
  };

  const fetchListGroups = async () => {
    try {
      const res = await fetch('/api/list-groups');
      if (res.ok) {
        const data = await res.json();
        setListGroups(Array.isArray(data) ? data : []);
      } else {
        setListGroups([]);
      }
    } catch (err) {
      console.error(err);
      setListGroups([]);
    }
  };

  const fetchLists = async () => {
    try {
      const res = await fetch('/api/lists');
      if (res.ok) {
        const data = await res.json();
        setLists(Array.isArray(data) ? data : []);
      } else {
        setLists([]);
      }
      fetchListGroups();
    } catch (err) {
      console.error(err);
      setLists([]);
    }
  };

  const fetchSections = async () => {
    try {
      const res = await fetch('/api/sections');
      if (res.ok) {
        const data = await res.json();
        setSections(Array.isArray(data) ? data : []);
      } else {
        setSections([]);
      }
    } catch (err) {
      console.error(err);
      setSections([]);
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
     Promise.all([fetchTasks(), fetchLists(), fetchSections(), fetchTags(), fetchListGroups()]).then(() => {
      setLoading(false);
      const params = new URLSearchParams(window.location.search);
      const action = params.get('action');
      if (action === 'new') {
        setTimeout(() => {
          const input = document.querySelector('.quick-add-bar input');
          if (input) input.focus();
        }, 300);
      }
    });
  }, [token]);

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
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    // Fetch external events on app mount
    const userId = user?.id;
    if (userId) {
      const url = user.outlook_ical_url || localStorage.getItem(`outlookIcalUrl_${userId}`);
      if (url) {
        setOutlookIcalUrl(url);
        fetchExternalEvents(url);
      } else {
        setOutlookIcalUrl('');
        setExternalEvents([]);
      }
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
  }, [token]);

  useEffect(() => {
    if (user?.id) {
      const url = user.outlook_ical_url || localStorage.getItem(`outlookIcalUrl_${user.id}`) || '';
      setOutlookIcalUrl(url);
      if (mainView === 'calendar') {
        fetchExternalEvents(url);
      }
    } else {
      setOutlookIcalUrl('');
      setExternalEvents([]);
    }
  }, [user, mainView]);

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

  const handleRescheduleTask = async (taskId, daysOffset) => {
    let due_date = null;
    if (daysOffset !== null) {
      due_date = format(addDays(new Date(), daysOffset), 'yyyy-MM-dd');
    }
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ due_date })
      });
      fetchTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartPomodoroFocus = (taskId) => {
    setActivePomodoroTaskId(taskId);
    setMainView('pomodoro');
  };

  const handleDeleteSubtask = async (id) => {
    try {
      const res = await fetch(`/api/subtasks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedSubtaskId === id) setSelectedSubtaskId(null);
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
        onSuccess={(newToken, newUser) => {
          localStorage.setItem('todo_token', newToken);
          localStorage.setItem('todo_user', JSON.stringify(newUser));
          setToken(newToken);
          setUser(newUser);
        }}
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
          {mainView === 'tasks' ? (
            <AddTaskWidget 
              tasks={tasks}
              lists={lists}
              activeList={activeList}
              quickAddTitle={quickAddTitle}
              setQuickAddTitle={setQuickAddTitle}
              handleQuickAdd={handleQuickAdd}
              onToggleTask={handleToggleTask}
              fetchTasks={fetchTasks}
              onSelectTask={(id) => {
                setSelectedTaskId(id);
                setSelectedSubtaskId(null);
              }}
              isListening={isListening}
              listeningSource={listeningSource}
              startSpeechRecognition={startSpeechRecognition}
            />
          ) : mainView === 'calendar' ? (
            <CalendarView 
              tasks={tasks} 
              lists={lists} 
              externalEvents={externalEvents}
              externalEventsError={externalEventsError}
              onRetrySync={() => fetchExternalEvents()}
              onSelectEvent={handleSelectEvent} 
              onUpdateEvent={handleUpdateEventDates}
              homeTimezone={homeTimezone}
              activeTimezoneMode={activeTimezoneMode}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
            />

          ) : mainView === 'pomodoro' ? (
            <PomodoroView 
              tasks={tasks} 
              lists={lists}
              externalEvents={externalEvents}
              externalEventsError={externalEventsError}
              homeTimezone={homeTimezone}
              activeTimezoneMode={activeTimezoneMode}
              onSelectTask={setSelectedTaskId}
            />
          ) : mainView === 'eisenhower' ? (
            <EisenhowerView 
              tasks={tasks} 
              onSelectTask={setSelectedTaskId} 
              onUpdateTaskPriority={handleUpdateTaskPriority} 
              onAddTaskInQuadrant={handleAddTaskInQuadrant}
            />
          ) : (
            <KanbanView 
              tasks={tasks}
              lists={lists}
              onSelectTask={setSelectedTaskId}
              onUpdateTaskPriority={handleUpdateTaskPriority}
              onUpdateTaskList={handleUpdateTaskList}
              onAddTaskInQuadrant={handleAddTaskInQuadrant}
            />
          )}
        </main>

        {(selectedTask || selectedSubtask) && (
          <div className="widget-modal-overlay" onClick={() => { setSelectedTaskId(null); setSelectedSubtaskId(null); }}>
            <div className="widget-modal" onClick={e => e.stopPropagation()}>
              <TaskDetail 
                task={selectedTask}
                subtask={selectedSubtask}
                sections={sections}
                allTasks={tasks}
                externalEvents={externalEvents}
                onClose={() => {
                  setSelectedTaskId(null);
                  setSelectedSubtaskId(null);
                }}
                onUpdate={fetchTasks}
                onDelete={handleDeleteTask}
                onDeleteSubtask={handleDeleteSubtask}
                homeTimezone={homeTimezone}
                activeTimezoneMode={activeTimezoneMode}
                onSelectTask={setSelectedTaskId}
              />
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
      <GlobalSidebar 
        mainView={mainView} 
        setMainView={setMainView} 
        user={user}
        onLogout={() => {
          localStorage.removeItem('todo_token');
          localStorage.removeItem('todo_user');
          setToken('');
          setUser(null);
        }}
      />

      
      <div className="app-container">
        {mainView === 'tasks' && (
          <Sidebar 
            activeList={activeList} 
            setActiveList={(val) => {
              setActiveList(val);
              setActiveTagFilter(null);
            }} 
            lists={lists} 
            onRefreshLists={fetchLists} 
            tasks={tasks}
            tags={tags}
            activeTagFilter={activeTagFilter}
            setActiveTagFilter={setActiveTagFilter}
            listGroups={listGroups}
            onRefreshListGroups={fetchListGroups}
            onUpdateTaskList={handleUpdateTaskList}
            onRescheduleTask={handleRescheduleTask}
          />
        )}
        
        <main className={`main-content ${selectedTaskId || selectedSubtaskId ? 'pane-open' : ''}`}>
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
            <CalendarView 
              tasks={tasks} 
              lists={lists} 
              externalEvents={externalEvents}
              externalEventsError={externalEventsError}
              onRetrySync={() => fetchExternalEvents()}
              onSelectEvent={handleSelectEvent} 
              onUpdateEvent={handleUpdateEventDates}
              homeTimezone={homeTimezone}
              activeTimezoneMode={activeTimezoneMode}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
            />

          ) : mainView === 'pomodoro' ? (
            <PomodoroView 
              tasks={tasks} 
              activeTaskId={activePomodoroTaskId}
              onClearActiveTaskId={() => setActivePomodoroTaskId(null)}
              lists={lists}
              externalEvents={externalEvents}
              externalEventsError={externalEventsError}
              homeTimezone={homeTimezone}
              activeTimezoneMode={activeTimezoneMode}
              onSelectTask={setSelectedTaskId}
            />
          ) : mainView === 'eisenhower' ? (
            <EisenhowerView 
              tasks={tasks} 
              onSelectTask={setSelectedTaskId} 
              onUpdateTaskPriority={handleUpdateTaskPriority} 
              onAddTaskInQuadrant={handleAddTaskInQuadrant}
              onTaskContextMenu={handleTaskContextMenu}
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
              onTaskContextMenu={handleTaskContextMenu}
            />
          ) : mainView === 'settings' ? (
            <SettingsView 
              user={user}
              onUpdateUser={(updatedUser, newToken) => {
                localStorage.setItem('todo_user', JSON.stringify(updatedUser));
                localStorage.setItem('todo_token', newToken);
                setUser(updatedUser);
                setToken(newToken);
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
        </main>

        {(selectedTask || selectedSubtask) && (
          <aside className="right-pane">
            <TaskDetail 
              task={selectedTask}
              subtask={selectedSubtask}
              sections={sections}
              allTasks={tasks}
              externalEvents={externalEvents}
              onClose={() => {
                setSelectedTaskId(null);
                setSelectedSubtaskId(null);
              }}
              onUpdate={fetchTasks}
              onDelete={handleDeleteTask}
              onDeleteSubtask={handleDeleteSubtask}
              homeTimezone={homeTimezone}
              activeTimezoneMode={activeTimezoneMode}
              onSelectTask={setSelectedTaskId}
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
      </div>
    </div>
  );
}

export default App;
