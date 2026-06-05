import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Coffee, Brain, Timer, Award, PictureInPicture, Calendar } from 'lucide-react';
import { sendNotification } from '../utils/notifications';
import { isSameDay, parseISO, getHours, getMinutes, differenceInMinutes, startOfToday, format } from 'date-fns';
import { adjustExternalDate } from '../utils/timezone';

import { useTodo } from '../context/TodoContext';

export function PomodoroView() {
  const {
    tasks = [],
    activePomodoroTaskId: activeTaskId,
    setActivePomodoroTaskId,
    lists = [],
    externalEvents = [],
    externalEventsError = null,
    homeTimezone,
    activeTimezoneMode,
    setSelectedTaskId: setGlobalSelectedTaskId,
    setSelectedSubtaskId
  } = useTodo();

  const onClearActiveTaskId = () => {
    setActivePomodoroTaskId(null);
  };

  const onSelectTask = (id) => {
    setGlobalSelectedTaskId(id);
    setSelectedSubtaskId(null);
  };
  const isPiPSupported = 'documentPictureInPicture' in window;
  const [pipWindow, setPipWindow] = useState(null);
  const [mode, setMode] = useState('focus'); // 'focus', 'shortBreak', 'longBreak'
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes default
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [completedSessions, setCompletedSessions] = useState(() => {
    try {
      const saved = localStorage.getItem('pomodoro_sessions');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [rightPanelTab, setRightPanelTab] = useState('calendar'); // 'calendar' or 'sessions'
  const [now, setNow] = useState(new Date());
  const [focusNote, setFocusNote] = useState('');
  const timelineScrollRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [sessionTotal, setSessionTotal] = useState(25 * 60);

  const handleAdjustTime = (amountSeconds) => {
    setTimeLeft((prev) => Math.max(0, prev + amountSeconds));
    setSessionTotal((prev) => Math.max(0, prev + amountSeconds));
  };

  const getSessionInterval = () => {
    const endTime = new Date(Date.now() + timeLeft * 1000);
    const startTime = new Date(endTime.getTime() - sessionTotal * 1000);
    
    const formatTimeStr = (date) => {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    };
    
    return `${formatTimeStr(startTime)} - ${formatTimeStr(endTime)}`;
  };

  // Tick clock to update current time line every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load note when selectedTaskId changes
  useEffect(() => {
    const key = selectedTaskId ? `pomodoro_note_${selectedTaskId}` : 'pomodoro_note_general';
    const savedNote = localStorage.getItem(key) || '';
    setFocusNote(savedNote);
  }, [selectedTaskId]);

  const handleFocusNoteChange = (newText) => {
    setFocusNote(newText);
    const key = selectedTaskId ? `pomodoro_note_${selectedTaskId}` : 'pomodoro_note_general';
    localStorage.setItem(key, newText);
  };

  // Scroll to current hour on load or tab change
  useEffect(() => {
    if (rightPanelTab === 'calendar' && timelineScrollRef.current) {
      const nowHours = getHours(now);
      const nowMins = getMinutes(now);
      const lineTop = (nowHours + nowMins / 60) * 60; // 60px per hour
      const containerHeight = timelineScrollRef.current.clientHeight;
      timelineScrollRef.current.scrollTop = Math.max(0, lineTop - containerHeight / 2);
    }
  }, [rightPanelTab]);

  const getListColor = (listId) => {
    if (!listId) return '#5b21b6';
    const list = lists.find(l => l.id === listId);
    return list?.color || '#5b21b6';
  };

  const parseDate = (dStr) => {
    if (!dStr) return null;
    try {
      const d = parseISO(dStr);
      return isNaN(d.getTime()) ? null : d;
    } catch (e) {
      return null;
    }
  };

  // Filter tasks that have start and end times
  const scheduledTasks = (tasks || []).map(t => {
    const start = parseDate(t.start_time);
    const end = parseDate(t.end_time);
    if (!start || !end) return null;
    return {
      id: `task-${t.id}`,
      itemId: t.id,
      isSubtask: false,
      title: t.title,
      start,
      end,
      list_id: t.list_id,
      isCompleted: !!t.is_completed,
      priority: t.priority,
      description: t.description || ''
    };
  }).filter(Boolean);

  // Extract scheduled subtasks from all tasks
  const scheduledSubtasks = [];
  (tasks || []).forEach(t => {
    if (t.subtasks && Array.isArray(t.subtasks)) {
      t.subtasks.forEach(st => {
        const start = parseDate(st.start_time);
        const end = parseDate(st.end_time);
        if (start && end) {
          scheduledSubtasks.push({
            id: `sub-${st.id}`,
            itemId: st.id,
            parentTaskId: t.id,
            isSubtask: true,
            title: `${t.title} > ${st.title}`,
            start,
            end,
            list_id: t.list_id,
            isCompleted: !!st.is_completed,
            priority: t.priority || 0,
            description: st.description || ''
          });
        }
      });
    }
  });

  // Map external events to the scheduled calendar format
  const mappedExternalEvents = (externalEvents || []).map(e => {
    const start = parseDate(e.start_time);
    const end = parseDate(e.end_time);
    if (!start || !end) return null;
    const adjustedStart = adjustExternalDate(start, homeTimezone, activeTimezoneMode);
    const adjustedEnd = adjustExternalDate(end, homeTimezone, activeTimezoneMode);
    return {
      id: `ext-${e.uid}`,
      itemId: e.uid,
      isSubtask: false,
      isExternal: true,
      title: e.title,
      start: adjustedStart,
      end: adjustedEnd,
      description: e.description || '',
      location: e.location || ''
    };
  }).filter(Boolean);

  const scheduledEvents = [...scheduledTasks, ...scheduledSubtasks, ...mappedExternalEvents];
  const today = startOfToday();
  const todayEvents = scheduledEvents.filter(e => isSameDay(e.start, today));

  // Compute overlapping layout groups and conflicts for today
  const todayEventLayoutProps = new Map();
  
  // 1. Group events into connected components of overlapping intervals
  const components = [];
  const sortedEvents = [...todayEvents].sort((a, b) => a.start.getTime() - b.start.getTime());

  sortedEvents.forEach(event => {
    const overlappingCompIndices = [];
    components.forEach((comp, idx) => {
      const overlaps = comp.some(e => event.start < e.end && event.end > e.start);
      if (overlaps) {
        overlappingCompIndices.push(idx);
      }
    });

    if (overlappingCompIndices.length === 0) {
      components.push([event]);
    } else {
      const mergedComp = [event];
      overlappingCompIndices.sort((a, b) => b - a).forEach(idx => {
        mergedComp.push(...components[idx]);
        components.splice(idx, 1);
      });
      components.push(mergedComp);
    }
  });

  // 2. Distribute into columns inside each component
  components.forEach(comp => {
    const compCols = [];
    const compEvents = [...comp].sort((a, b) => a.start.getTime() - b.start.getTime());

    compEvents.forEach(event => {
      let colIdx = 0;
      while (colIdx < compCols.length) {
        const hasOverlap = compCols[colIdx].some(e => event.start < e.end && event.end > e.start);
        if (!hasOverlap) {
          break;
        }
        colIdx++;
      }
      if (colIdx === compCols.length) {
        compCols.push([]);
      }
      compCols[colIdx].push(event);
    });

    const totalCols = compCols.length;
    const activeEvents = comp.filter(e => !e.isCompleted);

    compCols.forEach((colEvents, colIdx) => {
      colEvents.forEach(event => {
        const hasConflict = !event.isCompleted && activeEvents.some(
          e => e.id !== event.id && event.start < e.end && event.end > e.start
        );

        todayEventLayoutProps.set(event.id, {
          widthPercent: 100 / totalCols,
          leftPercent: colIdx * (100 / totalCols),
          hasConflict
        });
      });
    });
  });
  
  useEffect(() => {
    if (activeTaskId) {
      setSelectedTaskId(activeTaskId.toString());
      setMode('focus');
      setTimeLeft(25 * 60);
      setSessionTotal(25 * 60);
      setIsRunning(true);
      if (onClearActiveTaskId) {
        onClearActiveTaskId();
      }
    }
  }, [activeTaskId, onClearActiveTaskId]);

  useEffect(() => {
    try {
      localStorage.setItem('pomodoro_sessions', JSON.stringify(completedSessions));
    } catch (e) {
      console.error('Error saving pomodoro sessions:', e);
    }
  }, [completedSessions]);

  
  // Settings for timer modes
  const modeSettings = {
    focus: { time: 25 * 60, label: 'Enfoque', color: '#ef4444', glow: 'rgba(239, 68, 68, 0.2)' },
    shortBreak: { time: 5 * 60, label: 'Recreo Corto', color: '#10b981', glow: 'rgba(16, 185, 129, 0.2)' },
    longBreak: { time: 15 * 60, label: 'Recreo Largo', color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.2)' }
  };

  const timerRef = useRef(null);

  // Native Web Audio API Synthesizer Sound Library
  const soundLibrary = {
    chime: {
      name: '🔔 Campana Digital',
      play: (audioCtx, destination = audioCtx.destination) => {
        const playNote = (freq, delay, duration) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(destination);
          osc.frequency.value = freq;
          osc.type = 'sine';
          gain.gain.setValueAtTime(0, audioCtx.currentTime + delay);
          gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + delay + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + duration);
          osc.start(audioCtx.currentTime + delay);
          osc.stop(audioCtx.currentTime + delay + duration);
        };
        playNote(523.25, 0, 0.4); // C5
        playNote(659.25, 0.15, 0.6); // E5
        playNote(783.99, 0.3, 0.8); // G5
      }
    },
    zen: {
      name: '🧘 Cuenco Tibetano',
      play: (audioCtx, destination = audioCtx.destination) => {
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(destination);
        osc1.frequency.value = 220; // A3
        osc1.type = 'sine';
        osc2.frequency.value = 220.5; // Chorus detuned
        osc2.type = 'sine';
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.4, audioCtx.currentTime + 0.2); // Slow attack
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2.5); // Warm slow decay
        osc1.start(audioCtx.currentTime);
        osc2.start(audioCtx.currentTime);
        osc1.stop(audioCtx.currentTime + 2.5);
        osc2.stop(audioCtx.currentTime + 2.5);
      }
    },
    digital: {
      name: '⏰ Alarma Retro',
      play: (audioCtx, destination = audioCtx.destination) => {
        const playBeep = (freq, start, duration) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(destination);
          osc.frequency.value = freq;
          osc.type = 'square';
          gain.gain.setValueAtTime(0, audioCtx.currentTime + start);
          gain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + start + 0.01);
          gain.gain.setValueAtTime(0.15, audioCtx.currentTime + start + duration - 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + start + duration);
          osc.start(audioCtx.currentTime + start);
          osc.stop(audioCtx.currentTime + start + duration);
        };
        playBeep(880, 0, 0.1);
        playBeep(880, 0.15, 0.1);
        playBeep(880, 0.3, 0.2);
      }
    },
    piano: {
      name: '🎹 Acorde de Piano',
      play: (audioCtx, destination = audioCtx.destination) => {
        const notes = [261.63, 329.63, 392.00, 523.25]; // C Major
        notes.forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(destination);
          osc.frequency.value = freq;
          osc.type = 'triangle'; // Warm organic feel
          const noteDelay = idx * 0.04;
          gain.gain.setValueAtTime(0, audioCtx.currentTime + noteDelay);
          gain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + noteDelay + 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + noteDelay + 1.2);
          osc.start(audioCtx.currentTime + noteDelay);
          osc.stop(audioCtx.currentTime + noteDelay + 1.2);
        });
      }
    }
  };

  const playSound = (soundKey) => {
    if (!soundEnabled) return;
    const key = soundKey || localStorage.getItem('pomodoro_alarm_sound') || 'chime';
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const soundObj = soundLibrary[key];
      if (soundObj) {
        const masterGain = audioCtx.createGain();
        const volume = parseFloat(localStorage.getItem('pomodoroVolume') || '0.5');
        masterGain.gain.setValueAtTime(volume, audioCtx.currentTime);
        masterGain.connect(audioCtx.destination);
        soundObj.play(audioCtx, masterGain);
      }
    } catch (e) {
      console.error('AudioContext error:', e);
    }
  };

  const playCompletionSound = () => {
    if (!soundEnabled) return;
    const soundKey = localStorage.getItem('pomodoro_alarm_sound') || 'chime';
    const repeatCount = parseInt(localStorage.getItem('pomodoro_alarm_repeat_count') || '1', 10);
    
    let currentPlay = 0;
    const playLoop = () => {
      if (!soundEnabled) return;
      playSound(soundKey);
      currentPlay++;
      if (currentPlay < repeatCount) {
        setTimeout(playLoop, 1500);
      }
    };
    playLoop();
  };

  useEffect(() => {
    setTimeLeft(modeSettings[mode].time);
    setSessionTotal(modeSettings[mode].time);
    setIsRunning(false);
  }, [mode]);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setIsRunning(false);
            playCompletionSound();
            
            // Log completed session
            const selectedTask = tasks.find(t => t.id === parseInt(selectedTaskId, 10));
            const taskTitle = selectedTask ? selectedTask.title : 'Sesión General';
            const newSession = {
              id: Date.now(),
              taskTitle: taskTitle,
              mode: modeSettings[mode].label,
              duration: Math.round(modeSettings[mode].time / 60),
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setCompletedSessions(prevSessions => [newSession, ...prevSessions]);

            // Trigger desktop notification
            const enablePomodoroAlerts = localStorage.getItem('enablePomodoroAlerts') !== 'false';
            if (enablePomodoroAlerts) {
              if (mode === 'focus') {
                sendNotification('🧠 ¡Enfoque Completado!', `Completaste tu ciclo de enfoque en "${taskTitle}". ¡Tómate un recreo!`);
              } else {
                sendNotification('☕ ¡Recreo Completado!', 'Es hora de volver a enfocarse. Prepárate para el siguiente ciclo.');
              }
            }
            
            // Switch to break automatically after focus
            if (mode === 'focus') {
              setMode('shortBreak');
            } else {
              setMode('focus');
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, mode, selectedTaskId, tasks, soundEnabled]);

  const handleStartPause = () => {
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(modeSettings[mode].time);
    setSessionTotal(modeSettings[mode].time);
  };

  const handleTogglePiP = async () => {
    if (pipWindow) {
      pipWindow.close();
      setPipWindow(null);
      return;
    }

    if (!isPiPSupported) return;

    try {
      const w = await window.documentPictureInPicture.requestWindow({
        width: 280,
        height: 190,
      });

      // Copy stylesheet styles
      [...document.styleSheets].forEach((styleSheet) => {
        try {
          const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
          const style = w.document.createElement('style');
          style.textContent = cssRules;
          w.document.head.appendChild(style);
        } catch (e) {
          if (styleSheet.href) {
            const link = w.document.createElement('link');
            link.rel = 'stylesheet';
            link.href = styleSheet.href;
            w.document.head.appendChild(link);
          }
        }
      });

      // Make window body borderless style and color
      w.document.body.style.margin = '0';
      w.document.body.style.padding = '0';
      w.document.body.style.backgroundColor = '#151518';
      w.document.body.style.overflow = 'hidden';
      w.document.title = 'Pomodoro - Todo';

      // Add inter font to head if not present
      if (!w.document.querySelector('link[href*="fonts.googleapis.com"]')) {
        const link = w.document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap';
        w.document.head.appendChild(link);
      }

      w.addEventListener('pagehide', () => {
        setPipWindow(null);
      });

      setPipWindow(w);
    } catch (error) {
      console.error('Error starting Document PiP:', error);
    }
  };

  useEffect(() => {
    return () => {
      if (pipWindow) {
        pipWindow.close();
      }
    };
  }, [pipWindow]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Calculate progress percentage for SVG circular progress
  const progressPercent = sessionTotal > 0 ? ((sessionTotal - timeLeft) / sessionTotal) * 100 : 0;
  const strokeDashoffset = 502 - (502 * progressPercent) / 100; // 502 is circumference for r=80

  const activeModeColor = modeSettings[mode].color;
  const activeGlow = modeSettings[mode].glow;

  return (
    <div className="pomodoro-view-container" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', minHeight: '100%', height: 'auto', padding: '1rem 0' }}>
      
      {/* Top Banner Header */}
      <div className="pomodoro-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Timer style={{ color: activeModeColor }} />
            Temporizador Pomodoro
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>Trabaja enfocado, descansa inteligente.</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {isPiPSupported && (
            <button 
              onClick={handleTogglePiP}
              style={{
                background: pipWindow ? activeModeColor : 'rgba(255,255,255,0.04)',
                border: pipWindow ? `1px solid ${activeModeColor}` : '1px solid var(--border-color)',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: pipWindow ? '#ffffff' : 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: pipWindow ? `0 0 10px ${activeGlow}` : 'none'
              }}
              title={pipWindow ? "Cerrar ventana flotante" : "Ver en minireproductor (Siempre al frente)"}
            >
              <PictureInPicture size={20} />
            </button>
          )}

          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border-color)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            title={soundEnabled ? "Silenciar sonido" : "Activar sonido"}
          >
            {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} style={{ color: 'var(--danger-color)' }} />}
          </button>
        </div>
      </div>

      <div className="pomodoro-view-grid">
        {/* Left Side: Timer and Mode Selectors */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '3rem 2rem' }}>
          
          {/* Mode Tabs */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '2.5rem', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '30px', border: '1px solid var(--border-color)' }}>
            <button 
              onClick={() => setMode('focus')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 20px',
                borderRadius: '25px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
                backgroundColor: mode === 'focus' ? activeModeColor : 'transparent',
                color: mode === 'focus' ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all 0.2s ease'
              }}
            >
              <Brain size={14} />
              Enfoque (25m)
            </button>
            <button 
              onClick={() => setMode('shortBreak')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 20px',
                borderRadius: '25px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
                backgroundColor: mode === 'shortBreak' ? activeModeColor : 'transparent',
                color: mode === 'shortBreak' ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all 0.2s ease'
              }}
            >
              <Coffee size={14} />
              Recreo Corto (5m)
            </button>
            <button 
              onClick={() => setMode('longBreak')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 20px',
                borderRadius: '25px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
                backgroundColor: mode === 'longBreak' ? activeModeColor : 'transparent',
                color: mode === 'longBreak' ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all 0.2s ease'
              }}
            >
              <Coffee size={14} />
              Recreo Largo (15m)
            </button>
          </div>

          {/* Visual Circular Countdown Timer */}
          <div 
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{ position: 'relative', width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', marginBottom: '2.5rem', cursor: 'default' }}
          >
            <svg style={{ transform: 'rotate(-90deg)', width: '220px', height: '220px' }}>
              {/* Background circle */}
              <circle 
                cx="110" cy="110" r="80" 
                stroke="rgba(255,255,255,0.05)" 
                strokeWidth="12" 
                fill="transparent" 
              />
              {/* Progress circle */}
              <circle 
                cx="110" cy="110" r="80" 
                stroke={activeModeColor} 
                strokeWidth="12" 
                fill="transparent" 
                strokeDasharray="502" 
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{
                  transition: 'stroke-dashoffset 0.5s linear, stroke 0.3s ease',
                  filter: `drop-shadow(0 0 8px ${activeGlow})`
                }}
              />
            </svg>
            
            {/* Countdown Text */}
            <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', width: '100%' }}>
                {isHovered && (
                  <button
                    onClick={() => handleAdjustTime(-60)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: activeModeColor,
                      fontSize: '1.75rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      padding: '0 8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      userSelect: 'none',
                      transition: 'transform 0.1s',
                    }}
                    onMouseEnter={(e) => e.target.style.transform = 'scale(1.2)'}
                    onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                    title="Restar 1 minuto"
                  >
                    -
                  </button>
                )}

                <span style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', userSelect: 'none' }}>
                  {formatTime(timeLeft)}
                </span>

                {isHovered && (
                  <button
                    onClick={() => handleAdjustTime(60)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: activeModeColor,
                      fontSize: '1.75rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      padding: '0 8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      userSelect: 'none',
                      transition: 'transform 0.1s',
                    }}
                    onMouseEnter={(e) => e.target.style.transform = 'scale(1.2)'}
                    onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                    title="Sumar 1 minuto"
                  >
                    +
                  </button>
                )}
              </div>
              
              {isHovered ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 500, fontVariantNumeric: 'tabular-nums', opacity: 0.9 }}>
                  {getSessionInterval()}
                </span>
              ) : (
                <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', tracking: '0.1em', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 600 }}>
                  {modeSettings[mode].label}
                </span>
              )}
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '2.5rem' }}>
            <button 
              onClick={handleReset}
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                border: '1px solid var(--border-color)',
                backgroundColor: 'rgba(255,255,255,0.03)',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 0.2s, background-color 0.2s'
              }}
              title="Resetear"
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
            >
              <RotateCcw size={18} />
            </button>

            <button 
              onClick={handleStartPause}
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: activeModeColor,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: `0 4px 14px ${activeGlow}`,
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              title={isRunning ? "Pausar" : "Comenzar"}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              {isRunning ? <Pause size={24} fill="#ffffff" /> : <Play size={24} fill="#ffffff" style={{ marginLeft: '4px' }} />}
            </button>
          </div>

          {/* Task selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '320px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>¿En qué estás trabajando?</label>
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                outline: 'none',
                fontSize: '0.9rem',
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              <option value="" style={{ background: '#1c1c1c' }}>Trabajo General</option>
              {tasks.filter(t => !t.is_completed).map(task => (
                <option key={task.id} value={task.id} style={{ background: '#1c1c1c' }}>{task.title}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Right Side: Tab switcher (Calendar / Completed Sessions) & Focus Note */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem', height: '100%' }}>
          
          {/* Tab controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              {selectedTaskId ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: activeModeColor, display: 'inline-block' }} />
                  {tasks.find(t => t.id === parseInt(selectedTaskId, 10))?.title || 'Trabajo General'}
                </span>
              ) : (
                <span style={{ fontSize: '0.95rem' }}>Trabajo General</span>
              )}
            </h3>
            
            <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.03)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <button
                onClick={() => setRightPanelTab('calendar')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: rightPanelTab === 'calendar' ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: rightPanelTab === 'calendar' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease'
                }}
                title="Ver agenda del día"
              >
                <Calendar size={12} />
                Agenda
              </button>
              <button
                onClick={() => setRightPanelTab('sessions')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: rightPanelTab === 'sessions' ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: rightPanelTab === 'sessions' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease'
                }}
                title="Historial de sesiones completadas"
              >
                <Award size={12} />
                Sesiones
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {rightPanelTab === 'calendar' ? (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '1rem', overflow: 'hidden' }}>
                
                {/* Scrollable Timeline */}
                <div 
                  ref={timelineScrollRef}
                  className="calendar-grid-scroll"
                  style={{
                    position: 'relative',
                    flex: 1,
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.04)',
                    backgroundColor: 'rgba(0,0,0,0.12)',
                    maxHeight: '340px'
                  }}
                >
                  <div className="calendar-grid" style={{ height: `${24 * 60}px`, display: 'flex', position: 'relative' }}>
                    {/* Time Axis */}
                    <div className="time-axis" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                      {Array.from({ length: 24 }, (_, i) => i).map(hour => (
                        <div key={hour} className="time-label" style={{ height: '60px' }}>
                          {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                        </div>
                      ))}
                    </div>

                    {/* Day Column (Today) */}
                    <div className="day-column" style={{ flex: 1, position: 'relative', borderRight: 'none' }}>
                      {/* Hour Lines */}
                      {Array.from({ length: 24 }, (_, i) => i).map(hour => (
                        <div 
                          key={hour} 
                          className="grid-cell" 
                          style={{ height: '60px' }} 
                        />
                      ))}

                      {/* Current Time marker line */}
                      {(() => {
                        const nowHours = getHours(now);
                        const nowMins = getMinutes(now);
                        const lineTop = (nowHours + nowMins / 60) * 60;
                        return (
                          <div 
                            className="current-time-line"
                            style={{
                              position: 'absolute',
                              top: `${lineTop}px`,
                              left: 0,
                              right: 0,
                              height: '2px',
                              background: '#ef4444',
                              zIndex: 10,
                              pointerEvents: 'none'
                            }}
                          >
                            <div className="time-line-pulsator" style={{
                              position: 'absolute',
                              left: 0,
                              top: '-4px',
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              background: '#ef4444',
                              boxShadow: '0 0 8px #ef4444',
                              animation: 'pulse 1.5s infinite'
                            }} />
                          </div>
                        );
                      })()}

                      {/* Event Blocks */}
                      {todayEvents.map(event => {
                        const start = event.start;
                        const end = event.end;
                        
                        let top = (getHours(start) + getMinutes(start) / 60) * 60;
                        let durationMinutes = differenceInMinutes(end, start);
                        let height = Math.max((durationMinutes / 60) * 60, 24);

                        const startTimeStr = format(start, 'h:mm a');
                        const endTimeStr = format(end, 'h:mm a');

                        const layoutProps = todayEventLayoutProps.get(event.id) || { widthPercent: 100, leftPercent: 0, hasConflict: false };

                        const borderStyle = layoutProps.hasConflict 
                          ? '1px solid rgba(239, 68, 68, 0.4)' 
                          : (event.isExternal ? '1px solid rgba(0, 120, 212, 0.3)' : 'none');
                        
                        const borderLeftStyle = layoutProps.hasConflict 
                          ? '4px solid #ef4444' 
                          : (event.isExternal ? '4px solid #0078d4' : `4px solid ${getListColor(event.list_id)}`);
                        
                        const shadowStyle = layoutProps.hasConflict
                          ? '0 4px 12px rgba(239, 68, 68, 0.25)'
                          : (event.isExternal ? '0 4px 12px rgba(0, 120, 212, 0.15)' : 'none');

                        const baseBgColor = event.isExternal ? 'rgba(0, 120, 212, 0.12)' : 'rgba(255, 255, 255, 0.03)';
                        const bgColor = layoutProps.hasConflict 
                          ? 'rgba(239, 68, 68, 0.12)'
                          : baseBgColor;

                        const handleBlockClick = () => {
                          if (!event.isExternal) {
                            setSelectedTaskId(event.itemId.toString());
                          }
                        };

                        return (
                          <div 
                            key={event.id} 
                            className="task-block"
                            onClick={handleBlockClick}
                            style={{
                              top: `${top}px`,
                              height: `${height}px`,
                              background: bgColor,
                              color: 'var(--text-primary)',
                              position: 'absolute',
                              left: `calc(${layoutProps.leftPercent}% + 4px)`,
                              right: `calc(${100 - layoutProps.leftPercent - layoutProps.widthPercent}% + 4px)`,
                              cursor: event.isExternal ? 'default' : 'pointer',
                              userSelect: 'none',
                              zIndex: layoutProps.hasConflict ? 5 : 2,
                              border: borderStyle,
                              borderLeft: borderLeftStyle,
                              boxShadow: shadowStyle,
                              borderRadius: '6px',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              padding: '4px 8px',
                              boxSizing: 'border-box'
                            }}
                            title={`${event.title}\n${startTimeStr} - ${endTimeStr}`}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                              {event.isSubtask && <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', opacity: 0.6 }}>[Sub]</span>}
                              {event.isExternal && <span style={{ fontSize: '0.6rem', background: '#0078d4', color: '#ffffff', padding: '0px 4px', borderRadius: '3px', fontWeight: 800 }}>Outlook</span>}
                              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: 600, fontSize: '0.75rem' }}>{event.title}</span>
                            </div>
                            <div style={{ fontSize: '0.65rem', opacity: 0.7, color: 'var(--text-secondary)' }}>
                              {startTimeStr} - {endTimeStr}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Focus Note Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 'auto' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Nota de Enfoque</label>
                  <textarea
                    placeholder={selectedTaskId ? "¿Qué tienes en mente para esta sesión de enfoque?" : "Selecciona una tarea para guardar notas específicas o escribe aquí una nota general."}
                    value={focusNote}
                    onChange={(e) => handleFocusNoteChange(e.target.value)}
                    style={{
                      width: '100%',
                      height: '80px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      fontSize: '0.85rem',
                      resize: 'none',
                      fontFamily: 'inherit',
                      lineHeight: '1.4',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = activeModeColor}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                  />
                </div>

              </div>
            ) : (
              /* Completed Sessions List */
              completedSessions.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                  <Brain size={48} style={{ opacity: 0.15, marginBottom: '1rem' }} />
                  <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>No has completado ninguna sesión de enfoque todavía.</p>
                  <p style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '4px' }}>¡Inicia el temporizador de arriba para desbloquear tu primer logro!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1, maxHeight: '440px', paddingRight: '4px' }}>
                  {completedSessions.map(session => (
                    <div 
                      key={session.id} 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '8px',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '75%' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {session.taskTitle}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          Modo: {session.mode} • {session.duration} min
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                        {session.timestamp}
                      </span>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

        </div>
      </div>
      {pipWindow && createPortal(
        <PomodoroWidget
          timeLeft={timeLeft}
          isRunning={isRunning}
          mode={mode}
          modeSettings={modeSettings}
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
          handleStartPause={handleStartPause}
          handleReset={handleReset}
          formatTime={formatTime}
        />,
        pipWindow.document.body
      )}
    </div>
  );
}

function PomodoroWidget({
  timeLeft,
  isRunning,
  mode,
  modeSettings,
  soundEnabled,
  setSoundEnabled,
  handleStartPause,
  handleReset,
  formatTime
}) {
  const activeModeColor = modeSettings[mode].color;
  const activeGlow = modeSettings[mode].glow;

  return (
    <div style={{
      backgroundColor: '#151518',
      color: '#e0e0e0',
      fontFamily: "'Inter', sans-serif",
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '12px',
      userSelect: 'none',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Background Mode Glow */}
      <div style={{
        position: 'absolute',
        top: '-40px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '140px',
        height: '140px',
        borderRadius: '50%',
        backgroundColor: activeModeColor,
        opacity: 0.12,
        filter: 'blur(25px)',
        pointerEvents: 'none'
      }} />

      {/* Timer Mode Indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '0.72rem',
        textTransform: 'uppercase',
        fontWeight: 700,
        letterSpacing: '0.05em',
        color: activeModeColor,
        marginBottom: '6px',
        zIndex: 1
      }}>
        <div style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: activeModeColor,
          boxShadow: `0 0 8px ${activeModeColor}`,
          animation: isRunning ? 'pulse 2s infinite' : 'none'
        }} />
        {modeSettings[mode].label}
      </div>

      {/* Timer Countdown */}
      <div style={{
        fontSize: '2.4rem',
        fontWeight: 800,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.02em',
        color: '#ffffff',
        textShadow: `0 0 10px ${activeGlow}`,
        lineHeight: 1,
        marginBottom: '12px',
        zIndex: 1
      }}>
        {formatTime(timeLeft)}
      </div>

      {/* Controls Container */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 1
      }}>
        {/* Reset Button */}
        <button
          onClick={handleReset}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.08)',
            backgroundColor: 'rgba(255,255,255,0.04)',
            color: '#e0e0e0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            outline: 'none'
          }}
          title="Resetear"
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'}
        >
          <RotateCcw size={14} />
        </button>

        {/* Play / Pause Button */}
        <button
          onClick={handleStartPause}
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: activeModeColor,
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: `0 4px 12px ${activeGlow}`,
            transition: 'transform 0.2s, box-shadow 0.2s',
            outline: 'none'
          }}
          title={isRunning ? "Pausar" : "Iniciar"}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          {isRunning ? <Pause size={18} fill="#ffffff" /> : <Play size={18} fill="#ffffff" style={{ marginLeft: '2px' }} />}
        </button>

        {/* Sound Toggle Button */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.08)',
            backgroundColor: 'rgba(255,255,255,0.04)',
            color: '#e0e0e0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            outline: 'none'
          }}
          title={soundEnabled ? "Silenciar" : "Activar sonido"}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'}
        >
          {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} style={{ color: '#ef4444' }} />}
        </button>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}} />
    </div>
  );
}
