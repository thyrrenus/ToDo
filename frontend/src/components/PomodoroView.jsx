import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Coffee, Brain, Timer, Award, PictureInPicture } from 'lucide-react';
import { sendNotification } from '../utils/notifications';

export function PomodoroView({ tasks }) {
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

  // Sound generator using Web Audio API
  const playCompletionSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      // Beautiful chime (two notes)
      const playNote = (freq, delay, duration) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
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
    } catch (e) {
      console.error('AudioContext error:', e);
    }
  };

  useEffect(() => {
    setTimeLeft(modeSettings[mode].time);
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
  const currentMax = modeSettings[mode].time;
  const progressPercent = ((currentMax - timeLeft) / currentMax) * 100;
  const strokeDashoffset = 502 - (502 * progressPercent) / 100; // 502 is circumference for r=80

  const activeModeColor = modeSettings[mode].color;
  const activeGlow = modeSettings[mode].glow;

  return (
    <div className="pomodoro-view-container" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', height: '100%', padding: '1rem 0' }}>
      
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

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2.5rem', flex: 1 }}>
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
          <div style={{ position: 'relative', width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', marginBottom: '2.5rem' }}>
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
            <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {formatTime(timeLeft)}
              </span>
              <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', tracking: '0.1em', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 600 }}>
                {modeSettings[mode].label}
              </span>
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

        {/* Right Side: Completed Sessions / Focus Log */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '2rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
            <Award style={{ color: '#f59e0b' }} size={20} />
            Sesiones Completadas
          </h3>

          {completedSessions.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
              <Brain size={48} style={{ opacity: 0.15, marginBottom: '1rem' }} />
              <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>No has completado ninguna sesión de enfoque todavía.</p>
              <p style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '4px' }}>¡Inicia el temporizador de arriba para desbloquear tu primer logro!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1, maxHeight: '350px', paddingRight: '4px' }}>
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
          )}
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
