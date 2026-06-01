import { useState, useEffect } from 'react';
import { 
  User, Shield, Volume2, Palette, Database, Check, 
  Sparkles, Download, Trash2, Calendar
} from 'lucide-react';
import { 
  getNotificationPermissionState, 
  requestNotificationPermission, 
  sendNotification 
} from '../utils/notifications';

export function SettingsView({ user, tasks, lists, onRefreshTasks }) {
  // --- LOAD FROM LOCAL STORAGE OR SET DEFAULTS ---
  const [userName, setUserName] = useState(() => localStorage.getItem('userName') || 'Carlos');
  const [dailyTaskLimit, setDailyTaskLimit] = useState(() => parseInt(localStorage.getItem('dailyTaskLimit') || '5'));
  
  const [pomodoroWork, setPomodoroWork] = useState(() => parseInt(localStorage.getItem('pomodoroWork') || '25'));
  const [pomodoroShort, setPomodoroShort] = useState(() => parseInt(localStorage.getItem('pomodoroShort') || '5'));
  const [pomodoroLong, setPomodoroLong] = useState(() => parseInt(localStorage.getItem('pomodoroLong') || '15'));
  const [pomodoroSound, setPomodoroSound] = useState(() => localStorage.getItem('pomodoroSound') || 'bell');
  const [pomodoroVolume, setPomodoroVolume] = useState(() => parseFloat(localStorage.getItem('pomodoroVolume') || '0.5'));

  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('appAccentColor') || '#7c3aed');
  const [bgStyle, setBgStyle] = useState(() => localStorage.getItem('appBgStyle') || '#121212');
  const [outlookIcalUrl, setOutlookIcalUrl] = useState(() => {
    if (!user) return '';
    const scopedSaved = localStorage.getItem(`outlookIcalUrl_${user.id}`);
    if (scopedSaved !== null) return scopedSaved;

    // Auto-migrate Carlos's old unscoped URL if it exists
    const oldSaved = localStorage.getItem('outlookIcalUrl');
    if (oldSaved !== null) {
      localStorage.setItem(`outlookIcalUrl_${user.id}`, oldSaved);
      localStorage.removeItem('outlookIcalUrl');
      return oldSaved;
    }
    return '';
  });

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(() => getNotificationPermissionState());
  const [enableWebNotifications, setEnableWebNotifications] = useState(() => localStorage.getItem('enableWebNotifications') !== 'false');
  const [enableTaskAlerts, setEnableTaskAlerts] = useState(() => localStorage.getItem('enableTaskAlerts') !== 'false');
  const [enablePomodoroAlerts, setEnablePomodoroAlerts] = useState(() => localStorage.getItem('enablePomodoroAlerts') !== 'false');
  const [aiModelSelected, setAiModelSelected] = useState(() => localStorage.getItem('aiModelSelected') || 'Xenova/LaMini-Flan-T5-248M');


  const handleRequestPermission = async () => {
    const perm = await requestNotificationPermission();
    setNotificationPermission(perm);
    setEnableWebNotifications(perm === 'granted');
    
    if (perm === 'granted') {
      sendNotification('🔔 Notificaciones Activadas', '¡Excelente! Ahora recibirás alertas directamente en tu escritorio.');
    } else if (perm === 'denied') {
      alert('Las notificaciones fueron bloqueadas. Por favor, actívalas manualmente en la configuración del navegador junto a la barra de direcciones.');
    }
  };

  const handleTestNotification = () => {
    sendNotification('🎉 Alerta de Prueba', 'Tus notificaciones de escritorio están funcionando correctamente.');
  };

  // --- DYNAMIC THEMING EFFECTS ---
  const applyTheme = (accent, bg) => {
    // Apply accent variables
    document.documentElement.style.setProperty('--accent-hover', accent);
    
    // Resolve secondary accent color
    let primaryAccent = '#5b21b6';
    if (accent === '#3b82f6') primaryAccent = '#1d4ed8'; // Blue
    if (accent === '#10b981') primaryAccent = '#047857'; // Emerald
    if (accent === '#f59e0b') primaryAccent = '#b45309'; // Amber
    if (accent === '#ef4444') primaryAccent = '#b91c1c'; // Coral Red
    document.documentElement.style.setProperty('--accent-color', primaryAccent);

    // Apply background variables
    document.documentElement.style.setProperty('--bg-color', bg);
    document.documentElement.style.setProperty('--content-bg', bg);
    
    // Check if bg is a light color
    const isLight = bg === '#f8f9fa' || bg === '#f0f4f8' || bg === '#f4fbf7';
    
    if (isLight) {
      document.documentElement.style.setProperty('--text-primary', bg === '#f4fbf7' ? '#132c1b' : '#212529');
      document.documentElement.style.setProperty('--text-secondary', bg === '#f4fbf7' ? '#4d6955' : '#555e66');
      document.documentElement.style.setProperty('--border-color', 'rgba(0, 0, 0, 0.08)');
      
      let sidebarBg = '#f1f3f5';
      let paneBg = '#ffffff';
      if (bg === '#f0f4f8') {
        sidebarBg = '#e2e8f0';
        paneBg = '#ffffff';
      } else if (bg === '#f4fbf7') {
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
      if (bg === '#050505') { // AMOLED pure dark
        sidebarBg = '#0c0c0d';
        paneBg = '#0f0f10';
      } else if (bg === '#0B0F19') { // Navy Blue Cockpit
        sidebarBg = '#111827';
        paneBg = '#1f2937';
      }
      document.documentElement.style.setProperty('--sidebar-bg', sidebarBg);
      document.documentElement.style.setProperty('--right-pane-bg', paneBg);
    }
  };

  // Apply theme preferences dynamically on mount and change
  useEffect(() => {
    applyTheme(accentColor, bgStyle);
  }, [accentColor, bgStyle]);

  // Save changes handler
  const handleSaveSettings = () => {
    localStorage.setItem('userName', userName);
    localStorage.setItem('dailyTaskLimit', dailyTaskLimit.toString());
    localStorage.setItem('pomodoroWork', pomodoroWork.toString());
    localStorage.setItem('pomodoroShort', pomodoroShort.toString());
    localStorage.setItem('pomodoroLong', pomodoroLong.toString());
    localStorage.setItem('pomodoroSound', pomodoroSound);
    localStorage.setItem('pomodoroVolume', pomodoroVolume.toString());
    localStorage.setItem('appAccentColor', accentColor);
    localStorage.setItem('appBgStyle', bgStyle);
    if (user) {
      localStorage.setItem(`outlookIcalUrl_${user.id}`, outlookIcalUrl);
    } else {
      localStorage.setItem('outlookIcalUrl', outlookIcalUrl);
    }
    localStorage.setItem('enableWebNotifications', enableWebNotifications ? 'true' : 'false');
    localStorage.setItem('enableTaskAlerts', enableTaskAlerts ? 'true' : 'false');
    localStorage.setItem('enablePomodoroAlerts', enablePomodoroAlerts ? 'true' : 'false');
    localStorage.setItem('aiModelSelected', aiModelSelected);


    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);

    if (onRefreshTasks) onRefreshTasks();
  };

  // Reset theme to defaults
  const handleResetTheme = () => {
    setAccentColor('#7c3aed');
    setBgStyle('#121212');
    applyTheme('#7c3aed', '#121212');
  };

  // JSON Database export backup helper
  const handleExportData = () => {
    const backupData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      userName,
      dailyTaskLimit,
      accentColor,
      bgStyle,
      tasks,
      lists
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `todo_gtd_backup_${format(new Date(), 'yyyy-MM-dd')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Pure clean database reset
  const handleResetDatabase = async () => {
    if (!confirm('💥 ADVERTENCIA: Esto eliminará permanentemente TODAS tus tareas, subtasks y listas personalizadas. No se puede deshacer. ¿Deseas continuar?')) return;
    
    try {
      for (const task of tasks) {
        await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
      }
      for (const list of lists) {
        if (list.name.toLowerCase() !== 'inbox') {
          await fetch(`/api/lists/${list.id}`, { method: 'DELETE' });
        }
      }
      alert('Base de datos restablecida con éxito.');
      if (onRefreshTasks) onRefreshTasks();
    } catch (err) {
      console.error(err);
      alert('Error al restablecer la base de datos.');
    }
  };

  // Helper to check if active theme is light mode
  const isLightTheme = bgStyle === '#f8f9fa' || bgStyle === '#f0f4f8' || bgStyle === '#f4fbf7';

  return (
    <div className="settings-view-container" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem',
      height: '100%',
      padding: '1rem 0',
      overflowY: 'auto',
      animation: 'fadeIn 0.25s ease'
    }}>
      
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: isLightTheme ? '#1f2937' : '#f3f4f6', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Ajustes del Entorno
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Personaliza las metodologías de productividad, alarmas Pomodoro y el aspecto visual de la aplicación.
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          style={{
            background: saveSuccess ? 'var(--success-color)' : 'var(--accent-hover)',
            border: 'none',
            color: '#ffffff',
            padding: '8px 20px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
            boxShadow: saveSuccess ? 'none' : '0 4px 10px rgba(124, 58, 237, 0.25)'
          }}
        >
          {saveSuccess ? <Check size={14} /> : null}
          {saveSuccess ? '¡Guardado con éxito!' : 'Guardar Ajustes'}
        </button>
      </div>

      {/* Grid segments (Two columns) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '1.5rem'
      }}>
        
        {/* Card 1: User profile & Productivity */}
        <div style={{
          background: isLightTheme ? '#ffffff' : '#151518',
          border: isLightTheme ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.04)',
          borderRadius: '16px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          boxShadow: isLightTheme ? '0 4px 12px rgba(0,0,0,0.04)' : '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: isLightTheme ? '#1f2937' : '#f3f4f6', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: isLightTheme ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.04)', paddingBottom: '8px' }}>
            <User size={18} style={{ color: 'var(--accent-hover)' }} />
            Perfil & Productividad
          </h3>

          {/* Username */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: isLightTheme ? '#4b5563' : '#a1a1aa', fontWeight: 600 }}>Nombre del Usuario:</label>
            <input 
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              style={{
                background: isLightTheme ? '#f9fafb' : 'rgba(0,0,0,0.2)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                fontFamily: 'inherit',
                outline: 'none'
              }}
            />
          </div>

          {/* Workload rule limits */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label style={{ fontSize: '0.8rem', color: isLightTheme ? '#4b5563' : '#a1a1aa', fontWeight: 600 }}>Carga Límite Diaria (Regla de tareas):</label>
              <strong style={{ fontSize: '0.95rem', color: 'var(--accent-hover)' }}>{dailyTaskLimit} tareas</strong>
            </div>
            <p style={{ fontSize: '0.7rem', color: isLightTheme ? '#6b7280' : '#71717a', lineHeight: 1.3 }}>
              Máximo recomendado de actividades agendadas en un día para evitar sobrecarga mental en el análisis de Analytics.
            </p>
            <input 
              type="range"
              min="3"
              max="10"
              step="1"
              value={dailyTaskLimit}
              onChange={(e) => setDailyTaskLimit(parseInt(e.target.value))}
              style={{
                width: '100%',
                accentColor: 'var(--accent-hover)',
                cursor: 'pointer',
                marginTop: '4px'
              }}
            />
          </div>

          {/* Methodology Toggle Tips */}
          <div style={{
            background: isLightTheme ? '#f9fafb' : 'rgba(255, 255, 255, 0.01)',
            border: isLightTheme ? '1px solid rgba(0,0,0,0.04)' : '1px solid rgba(255, 255, 255, 0.03)',
            borderRadius: '10px',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            marginTop: '8px'
          }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Shield size={12} style={{ color: 'var(--success-color)' }} />
              Estado de Metodología Activa:
            </span>
            <p style={{ fontSize: '0.7rem', color: isLightTheme ? '#4b5563' : '#71717a', lineHeight: 1.35 }}>
              Tu ToDo tiene integrados los módulos de **GTD (Getting Things Done)**, **Matriz de Eisenhower** y tableros **Kanban** simultáneamente, permitiendo un control óptimo de tus flujos de trabajo en cada sección.
            </p>
          </div>
        </div>

        {/* Card 2: Pomodoro Customization */}
        <div style={{
          background: isLightTheme ? '#ffffff' : '#151518',
          border: isLightTheme ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.04)',
          borderRadius: '16px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          boxShadow: isLightTheme ? '0 4px 12px rgba(0,0,0,0.04)' : '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: isLightTheme ? '#1f2937' : '#f3f4f6', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: isLightTheme ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.04)', paddingBottom: '8px' }}>
            <Volume2 size={18} style={{ color: 'var(--accent-hover)' }} />
            Temporizador & Audio Pomodoro
          </h3>

          {/* Timers list */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.75rem', color: isLightTheme ? '#4b5563' : '#9ca3af' }}>Sesión Foco:</label>
              <input 
                type="number" 
                min="5" 
                max="90"
                value={pomodoroWork}
                onChange={(e) => setPomodoroWork(parseInt(e.target.value))}
                style={{
                  background: isLightTheme ? '#f9fafb' : 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '6px 8px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              <span style={{ fontSize: '0.6rem', color: isLightTheme ? '#6b7280' : '#71717a' }}>minutos</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.75rem', color: isLightTheme ? '#4b5563' : '#9ca3af' }}>Descanso Corto:</label>
              <input 
                type="number" 
                min="1" 
                max="30"
                value={pomodoroShort}
                onChange={(e) => setPomodoroShort(parseInt(e.target.value))}
                style={{
                  background: isLightTheme ? '#f9fafb' : 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '6px 8px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              <span style={{ fontSize: '0.6rem', color: isLightTheme ? '#6b7280' : '#71717a' }}>minutos</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.75rem', color: isLightTheme ? '#4b5563' : '#9ca3af' }}>Descanso Largo:</label>
              <input 
                type="number" 
                min="5" 
                max="60"
                value={pomodoroLong}
                onChange={(e) => setPomodoroLong(parseInt(e.target.value))}
                style={{
                  background: isLightTheme ? '#f9fafb' : 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '6px 8px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              <span style={{ fontSize: '0.6rem', color: isLightTheme ? '#6b7280' : '#71717a' }}>minutos</span>
            </div>
          </div>

          {/* Sound selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: isLightTheme ? '#4b5563' : '#a1a1aa', fontWeight: 600 }}>Tono de Alerta Final:</label>
            <select
              value={pomodoroSound}
              onChange={(e) => setPomodoroSound(e.target.value)}
              style={{
                background: isLightTheme ? '#ffffff' : '#1a1a1a',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              <option value="bell">🛎️ Soft Bell (Campana Sintetizada)</option>
              <option value="beep">🚨 Alarm Beep (Pitido Digital)</option>
              <option value="synth">🎵 Ambient Melody (Arpegio Synth)</option>
            </select>
          </div>

          {/* Volume slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label style={{ fontSize: '0.8rem', color: isLightTheme ? '#4b5563' : '#a1a1aa', fontWeight: 600 }}>Volumen del Tono:</label>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{Math.round(pomodoroVolume * 100)}%</span>
            </div>
            <input 
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={pomodoroVolume}
              onChange={(e) => setPomodoroVolume(parseFloat(e.target.value))}
              style={{
                width: '100%',
                accentColor: 'var(--accent-hover)',
                cursor: 'pointer'
              }}
            />
          </div>
        </div>

        {/* Card 3: Theme Customization (ACCENTS & BACKGROUNDS - DARK & LIGHT) */}
        <div style={{
          background: isLightTheme ? '#ffffff' : '#151518',
          border: isLightTheme ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.04)',
          borderRadius: '16px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          boxShadow: isLightTheme ? '0 4px 12px rgba(0,0,0,0.04)' : '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: isLightTheme ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.04)', paddingBottom: '8px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: isLightTheme ? '#1f2937' : '#f3f4f6', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Palette size={18} style={{ color: 'var(--accent-hover)' }} />
              Apariencia & Colores del Tema
            </h3>
            <button 
              onClick={handleResetTheme}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Restablecer
            </button>
          </div>

          {/* Accent picker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.8rem', color: isLightTheme ? '#4b5563' : '#a1a1aa', fontWeight: 600 }}>Color de Acento (Destacados):</label>
            <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
              <button 
                onClick={() => setAccentColor('#7c3aed')}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#7c3aed',
                  border: accentColor === '#7c3aed' ? (isLightTheme ? '3px solid #1f2937' : '3px solid #ffffff') : 'none',
                  cursor: 'pointer',
                  transform: accentColor === '#7c3aed' ? 'scale(1.1)' : 'none',
                  transition: 'transform 0.1s'
                }}
                title="Violeta"
              />
              <button 
                onClick={() => setAccentColor('#3b82f6')}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#3b82f6',
                  border: accentColor === '#3b82f6' ? (isLightTheme ? '3px solid #1f2937' : '3px solid #ffffff') : 'none',
                  cursor: 'pointer',
                  transform: accentColor === '#3b82f6' ? 'scale(1.1)' : 'none',
                  transition: 'transform 0.1s'
                }}
                title="Azul Real"
              />
              <button 
                onClick={() => setAccentColor('#10b981')}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  border: accentColor === '#10b981' ? (isLightTheme ? '3px solid #1f2937' : '3px solid #ffffff') : 'none',
                  cursor: 'pointer',
                  transform: accentColor === '#10b981' ? 'scale(1.1)' : 'none',
                  transition: 'transform 0.1s'
                }}
                title="Verde Esmeralda"
              />
              <button 
                onClick={() => setAccentColor('#f59e0b')}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#f59e0b',
                  border: accentColor === '#f59e0b' ? (isLightTheme ? '3px solid #1f2937' : '3px solid #ffffff') : 'none',
                  cursor: 'pointer',
                  transform: accentColor === '#f59e0b' ? 'scale(1.1)' : 'none',
                  transition: 'transform 0.1s'
                }}
                title="Oro Ámbar"
              />
              <button 
                onClick={() => setAccentColor('#ef4444')}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                  border: accentColor === '#ef4444' ? (isLightTheme ? '3px solid #1f2937' : '3px solid #ffffff') : 'none',
                  cursor: 'pointer',
                  transform: accentColor === '#ef4444' ? 'scale(1.1)' : 'none',
                  transition: 'transform 0.1s'
                }}
                title="Rojo Coral"
              />
            </div>
          </div>

          {/* Background styles selector (separated into dark and light!) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '0.8rem', color: isLightTheme ? '#4b5563' : '#a1a1aa', fontWeight: 600 }}>Temas de Fondo Oscuros:</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div 
                onClick={() => setBgStyle('#121212')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  background: '#121212',
                  border: bgStyle === '#121212' ? `2px solid ${accentColor}` : '1.5px solid rgba(255,255,255,0.03)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: '#e0e0e0'
                }}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: accentColor }} />
                <span>Gris Profundo (TickTick Premium)</span>
              </div>

              <div 
                onClick={() => setBgStyle('#0B0F19')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  background: '#0B0F19',
                  border: bgStyle === '#0B0F19' ? `2px solid ${accentColor}` : '1.5px solid rgba(255,255,255,0.03)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: '#e0e0e0'
                }}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: accentColor }} />
                <span>Azul Cockpit (Sleek Navy Blue)</span>
              </div>

              <div 
                onClick={() => setBgStyle('#050505')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  background: '#050505',
                  border: bgStyle === '#050505' ? `2px solid ${accentColor}` : '1.5px solid rgba(255,255,255,0.03)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: '#e0e0e0'
                }}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: accentColor }} />
                <span>Negro Puro (AMOLED Pitch Black)</span>
              </div>
            </div>

            <label style={{ fontSize: '0.8rem', color: isLightTheme ? '#4b5563' : '#a1a1aa', fontWeight: 600, marginTop: '8px' }}>Temas de Fondo Claros (NUEVO):</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {/* Gris Claro */}
              <div 
                onClick={() => setBgStyle('#f8f9fa')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  background: '#f8f9fa',
                  border: bgStyle === '#f8f9fa' ? `2px solid ${accentColor}` : '1.5px solid rgba(0,0,0,0.05)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: '#212529'
                }}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: accentColor }} />
                <span>Blanco Nórdico (Gris Claro Minimalista)</span>
              </div>

              {/* Azul Suave */}
              <div 
                onClick={() => setBgStyle('#f0f4f8')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  background: '#f0f4f8',
                  border: bgStyle === '#f0f4f8' ? `2px solid ${accentColor}` : '1.5px solid rgba(0,0,0,0.05)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: '#1e293b'
                }}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: accentColor }} />
                <span>Azul Glaciar (Light Blue Velvet)</span>
              </div>

              {/* Mint breeze */}
              <div 
                onClick={() => setBgStyle('#f4fbf7')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  background: '#f4fbf7',
                  border: bgStyle === '#f4fbf7' ? `2px solid ${accentColor}` : '1.5px solid rgba(0,0,0,0.05)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: '#132c1b'
                }}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: accentColor }} />
                <span>Brisa de Menta (Mint Pastel Soft)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Database backups & reset */}
        <div style={{
          background: isLightTheme ? '#ffffff' : '#151518',
          border: isLightTheme ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.04)',
          borderRadius: '16px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          boxShadow: isLightTheme ? '0 4px 12px rgba(0,0,0,0.04)' : '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: isLightTheme ? '#1f2937' : '#f3f4f6', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: isLightTheme ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.04)', paddingBottom: '8px' }}>
            <Database size={18} style={{ color: 'var(--accent-hover)' }} />
            Mantenimiento y Respaldo
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: isLightTheme ? '#f9fafb' : 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', color: isLightTheme ? '#4b5563' : '#a1a1aa' }}>
              Listas de Proyectos: <b style={{ color: isLightTheme ? '#111827' : '#ffffff' }}>{lists.length}</b>
            </div>
            <div style={{ fontSize: '0.75rem', color: isLightTheme ? '#4b5563' : '#a1a1aa' }}>
              Tareas registradas: <b style={{ color: isLightTheme ? '#111827' : '#ffffff' }}>{tasks.length}</b>
            </div>
          </div>

          <p style={{ fontSize: '0.7rem', color: isLightTheme ? '#6b7280' : '#71717a', lineHeight: 1.35 }}>
            Recomendamos exportar un respaldo local en formato JSON antes de realizar limpiezas generales en tu base de datos SQLite.
          </p>

          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button
              onClick={handleExportData}
              style={{
                flex: 1,
                background: isLightTheme ? '#f9fafb' : 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'background 0.2s'
              }}
            >
              <Download size={14} /> Exportar JSON
            </button>

            <button
              onClick={handleResetDatabase}
              style={{
                flex: 1,
                background: 'rgba(239, 68, 68, 0.05)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#ef4444',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'background 0.2s'
              }}
            >
              <Trash2 size={14} /> Restablecer ToDo
            </button>
          </div>
        </div>

        {/* Card 5: Calendar Synchronization */}
        <div style={{
          background: isLightTheme ? '#ffffff' : '#151518',
          border: isLightTheme ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.04)',
          borderRadius: '16px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          boxShadow: isLightTheme ? '0 4px 12px rgba(0,0,0,0.04)' : '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: isLightTheme ? '#1f2937' : '#f3f4f6', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: isLightTheme ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.04)', paddingBottom: '8px' }}>
            <Calendar size={18} style={{ color: 'var(--accent-hover)' }} />
            Sincronización de Calendarios
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: isLightTheme ? '#4b5563' : '#a1a1aa', fontWeight: 600 }}>Enlace iCal (.ics) de Outlook:</label>
            <input 
              type="text"
              value={outlookIcalUrl}
              onChange={(e) => setOutlookIcalUrl(e.target.value)}
              placeholder="https://outlook.office365.com/.../calendar.ics"
              style={{
                background: isLightTheme ? '#f9fafb' : 'rgba(0,0,0,0.2)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                fontFamily: 'inherit',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <p style={{ fontSize: '0.7rem', color: isLightTheme ? '#6b7280' : '#71717a', lineHeight: 1.4 }}>
            Ingresa el enlace público de suscripción iCal (.ics) generado desde la configuración de tu calendario en Outlook Web (Configuración &gt; Calendarios Compartidos &gt; Publicar un Calendario).
          </p>

          <div style={{
            background: 'rgba(0, 120, 212, 0.05)',
            border: '1px solid rgba(0, 120, 212, 0.15)',
            borderRadius: '10px',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            marginTop: '4px'
          }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isLightTheme ? '#0078d4' : '#60a5fa', display: 'flex', alignItems: 'center', gap: '4px' }}>
              ℹ️ Integración de Lectura Activa
            </span>
            <p style={{ fontSize: '0.7rem', color: isLightTheme ? '#3b82f6' : '#93c5fd', lineHeight: 1.35, margin: 0 }}>
              Las reuniones se sincronizarán dinámicamente y se mostrarán en color azul en tu <b>Vista de Calendario</b> de forma segura sin revelar tus credenciales.
            </p>
          </div>
        </div>

        {/* Card 6: Alertas del Navegador (Web Notifications) */}
        <div style={{
          background: isLightTheme ? '#ffffff' : '#151518',
          border: isLightTheme ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.04)',
          borderRadius: '16px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          boxShadow: isLightTheme ? '0 4px 12px rgba(0,0,0,0.04)' : '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: isLightTheme ? '#1f2937' : '#f3f4f6', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: isLightTheme ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.04)', paddingBottom: '8px' }}>
            <span style={{ fontSize: '1.2rem', color: 'var(--accent-hover)' }}>🔔</span>
            Alertas del Navegador (Web Notifications)
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Permission status widget */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '8px',
              background: isLightTheme ? '#f9fafb' : 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Permiso del Sistema:</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {notificationPermission === 'granted' ? '✅ Notificaciones Permitidas' : 
                   notificationPermission === 'denied' ? '❌ Bloqueadas en este navegador' : 
                   '⚠️ Pendiente por autorizar'}
                </span>
              </div>

              {notificationPermission !== 'granted' ? (
                <button
                  onClick={handleRequestPermission}
                  style={{
                    background: 'var(--accent-hover)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#ffffff',
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'opacity 0.2s'
                  }}
                >
                  Activar
                </button>
              ) : (
                <button
                  onClick={handleTestNotification}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                >
                  Probar Alerta
                </button>
              )}
            </div>

            {/* Checkbox settings */}
            {notificationPermission === 'granted' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input 
                    type="checkbox"
                    id="enableWebNotifications"
                    checked={enableWebNotifications}
                    onChange={(e) => setEnableWebNotifications(e.target.checked)}
                    style={{ accentColor: 'var(--accent-hover)', width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <label htmlFor="enableWebNotifications" style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500, cursor: 'pointer' }}>
                    Habilitar notificaciones generales de escritorio
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '1.25rem' }}>
                  <input 
                    type="checkbox"
                    id="enablePomodoroAlerts"
                    checked={enablePomodoroAlerts}
                    onChange={(e) => setEnablePomodoroAlerts(e.target.checked)}
                    disabled={!enableWebNotifications}
                    style={{ accentColor: 'var(--accent-hover)', width: '15px', height: '15px', cursor: 'pointer' }}
                  />
                  <label htmlFor="enablePomodoroAlerts" style={{ fontSize: '0.75rem', color: enableWebNotifications ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer' }}>
                    Alertas al finalizar ciclos de Pomodoro (Foco/Recreos)
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '1.25rem' }}>
                  <input 
                    type="checkbox"
                    id="enableTaskAlerts"
                    checked={enableTaskAlerts}
                    onChange={(e) => setEnableTaskAlerts(e.target.checked)}
                    disabled={!enableWebNotifications}
                    style={{ accentColor: 'var(--accent-hover)', width: '15px', height: '15px', cursor: 'pointer' }}
                  />
                  <label htmlFor="enableTaskAlerts" style={{ fontSize: '0.75rem', color: enableWebNotifications ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer' }}>
                    Alertas al iniciar actividades agendadas en tu calendario
                  </label>
                </div>
              </div>
            )}

            <p style={{ fontSize: '0.7rem', color: isLightTheme ? '#6b7280' : '#71717a', lineHeight: 1.4, margin: '4px 0 0 0' }}>
              Las notificaciones de escritorio nativas funcionan a nivel del sistema operativo. Se mostrarán aunque minimices el navegador, asegurando que nunca pierdas el ritmo.
            </p>
          </div>
        </div>

        {/* Card 7: Cerebro de Inteligencia Artificial (IA Local) */}
        <div style={{
          background: isLightTheme ? '#ffffff' : '#151518',
          border: isLightTheme ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.04)',
          borderRadius: '16px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          boxShadow: isLightTheme ? '0 4px 12px rgba(0,0,0,0.04)' : '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: isLightTheme ? '#1f2937' : '#f3f4f6', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: isLightTheme ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.04)', paddingBottom: '8px' }}>
            <Sparkles size={18} style={{ color: 'var(--accent-hover)' }} />
            Cerebro de Inteligencia Artificial (IA Local)
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.8rem', color: isLightTheme ? '#4b5563' : '#a1a1aa', fontWeight: 600 }}>Modelo de Lenguaje Local Seleccionado:</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>

              {/* Option 0: 783M (Expert/Pro) */}
              <div 
                onClick={() => setAiModelSelected('Xenova/LaMini-Flan-T5-783M')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  padding: '10px 12px',
                  background: isLightTheme ? '#f9fafb' : 'rgba(255, 255, 255, 0.01)',
                  border: aiModelSelected === 'Xenova/LaMini-Flan-T5-783M' ? `2px solid ${accentColor}` : '1px solid var(--border-color)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: aiModelSelected === 'Xenova/LaMini-Flan-T5-783M' ? accentColor : 'transparent', border: aiModelSelected === 'Xenova/LaMini-Flan-T5-783M' ? 'none' : '1px solid var(--text-secondary)' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>LaMini-Flan-T5-783M 🚀</span>
                  <span style={{ fontSize: '0.65rem', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>Pro / Experto</span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', paddingLeft: '16px', lineHeight: 1.3 }}>
                  Inteligencia máxima y razonamiento experto (~1.4GB). Ideal para computadores modernos con alto rendimiento.
                </span>
              </div>
              
              {/* Option 1: 248M (Recommended) */}
              <div 
                onClick={() => setAiModelSelected('Xenova/LaMini-Flan-T5-248M')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  padding: '10px 12px',
                  background: isLightTheme ? '#f9fafb' : 'rgba(255, 255, 255, 0.01)',
                  border: aiModelSelected === 'Xenova/LaMini-Flan-T5-248M' ? `2px solid ${accentColor}` : '1px solid var(--border-color)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: aiModelSelected === 'Xenova/LaMini-Flan-T5-248M' ? accentColor : 'transparent', border: aiModelSelected === 'Xenova/LaMini-Flan-T5-248M' ? 'none' : '1px solid var(--text-secondary)' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>LaMini-Flan-T5-248M ✨</span>
                  <span style={{ fontSize: '0.65rem', background: 'rgba(124, 58, 237, 0.15)', color: '#c084fc', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>Recomendado</span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', paddingLeft: '16px', lineHeight: 1.3 }}>
                  Inteligencia avanzada (~480MB). Excelente razonamiento lógico y procesamiento fluido en español.
                </span>
              </div>

              {/* Option 2: 77M (Lightweight) */}
              <div 
                onClick={() => setAiModelSelected('Xenova/LaMini-Flan-T5-77M')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  padding: '10px 12px',
                  background: isLightTheme ? '#f9fafb' : 'rgba(255, 255, 255, 0.01)',
                  border: aiModelSelected === 'Xenova/LaMini-Flan-T5-77M' ? `2px solid ${accentColor}` : '1px solid var(--border-color)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: aiModelSelected === 'Xenova/LaMini-Flan-T5-77M' ? accentColor : 'transparent', border: aiModelSelected === 'Xenova/LaMini-Flan-T5-77M' ? 'none' : '1px solid var(--text-secondary)' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>LaMini-Flan-T5-77M ⚡</span>
                  <span style={{ fontSize: '0.65rem', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>Ligero</span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', paddingLeft: '16px', lineHeight: 1.3 }}>
                  Modelo ultra-liviano e instantáneo (~150MB). Consumo mínimo de recursos, ideal para equipos limitados.
                </span>
              </div>

              {/* Option 3: Disable AI */}
              <div 
                onClick={() => setAiModelSelected('desactivado')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  padding: '10px 12px',
                  background: isLightTheme ? '#f9fafb' : 'rgba(255, 255, 255, 0.01)',
                  border: aiModelSelected === 'desactivado' ? `2px solid #ef4444` : '1px solid var(--border-color)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: aiModelSelected === 'desactivado' ? '#ef4444' : 'transparent', border: aiModelSelected === 'desactivado' ? 'none' : '1px solid var(--text-secondary)' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Desactivar Inteligencia Artificial</span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', paddingLeft: '16px', lineHeight: 1.3 }}>
                  Apaga por completo las sugerencias de la IA local, liberando el 100% del uso de memoria RAM.
                </span>
              </div>

            </div>
          </div>

          <p style={{ fontSize: '0.7rem', color: isLightTheme ? '#6b7280' : '#71717a', lineHeight: 1.4, margin: '4px 0 0 0' }}>
            ℹ️ <b>Privacidad Absoluta:</b> Todos los modelos se ejecutan en segundo plano en tu propia máquina mediante WebAssembly (sin llamadas externas ni APIs en la nube). Los pesos se almacenan de forma segura en la caché del navegador para acceso instantáneo y offline.
          </p>
        </div>

      </div>

    </div>
  );
}
