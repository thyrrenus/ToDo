import { useState, useEffect } from 'react';
import { ClipboardList, Trash2, ArrowRight, CheckCircle2, RotateCcw, AlertTriangle, BookOpen, Layers, Check, Calendar, Users, Folder, Inbox } from 'lucide-react';

export function GTDView({ tasks, lists, onRefreshTasks, onRefreshLists }) {
  const [activeSubTab, setActiveSubTab] = useState('clarify'); // 'clarify', 'review', 'guide'
  
  // 2-minute timer states
  const [timerSeconds, setTimerSeconds] = useState(120);
  const [timerRunning, setTimerRunning] = useState(false);

  // GTD processing wizard states
  const [currentStep, setCurrentStep] = useState(1); // 1 = isActionable, 2a = nonActionableOptions, 2b = actionableTimeTest, 3 = organizeOptions
  const [customDate, setCustomDate] = useState('');

  // Audio completion sound (sine wave beep)
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 587.33; // D5 note
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.error(e);
    }
  };

  // 2-Minute Timer effect
  useEffect(() => {
    let interval = null;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            setTimerRunning(false);
            playBeep();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning]);

  // Find the standard GTD list IDs
  const getListIdByName = (name) => {
    const list = lists.find(l => l.name.toLowerCase() === name.toLowerCase());
    return list ? list.id : null;
  };

  const inboxListId = getListIdByName('inbox');
  
  // Filter inbox tasks (no list_id OR in list named Inbox)
  const inboxTasks = tasks.filter(t => 
    !t.is_completed && 
    (t.list_id === null || t.list_id === inboxListId)
  );

  const currentInboxTask = inboxTasks[0] || null;

  // Reset wizard steps when current task changes
  useEffect(() => {
    setCurrentStep(1);
    setTimerSeconds(120);
    setTimerRunning(false);
    setCustomDate('');
  }, [currentInboxTask]);

  // Setup GTD default lists
  const handleSetupGTDLists = async () => {
    const defaultGTD = [
      { name: 'Inbox', color: '#3b82f6' },
      { name: 'Siguientes Acciones', color: '#ef4444' },
      { name: 'Proyectos', color: '#8b5cf6' },
      { name: 'En Espera', color: '#f59e0b' },
      { name: 'Algún día / Tal vez', color: '#10b981' },
      { name: 'Referencia', color: '#8e95a5' }
    ];

    try {
      for (const list of defaultGTD) {
        // Check if list already exists
        const exists = lists.some(l => l.name.toLowerCase() === list.name.toLowerCase());
        if (!exists) {
          await fetch('/api/lists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(list)
          });
        }
      }
      if (onRefreshLists) onRefreshLists();
    } catch (err) {
      console.error(err);
    }
  };

  // Perform quick actions (Delete, Complete, Move list)
  const handleDeleteTask = async (taskId) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok && onRefreshTasks) onRefreshTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCompleteTask = async (taskId) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: 1 })
      });
      if (res.ok && onRefreshTasks) onRefreshTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMoveToList = async (taskId, listName, extraFields = {}) => {
    const targetListId = getListIdByName(listName);
    if (!targetListId) {
      alert(`Por favor, inicializa las listas GTD primero para poder mover a "${listName}"`);
      return;
    }

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          list_id: targetListId,
          ...extraFields
        })
      });
      if (res.ok && onRefreshTasks) onRefreshTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const formatTimerTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Check if lists are initialized
  const missingGTDLists = ['Siguientes Acciones', 'Proyectos', 'En Espera', 'Algún día / Tal vez', 'Referencia'].some(
    name => !lists.some(l => l.name.toLowerCase() === name.toLowerCase())
  );

  return (
    <div className="gtd-view-container" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', height: '100%', padding: '1rem 0' }}>
      
      {/* GTD Header */}
      <div className="gtd-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClipboardList style={{ color: 'var(--accent-hover)' }} />
            Metodología GTD (Getting Things Done)
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>Organiza tu mente, libera tu productividad.</p>
        </div>

        {missingGTDLists && (
          <button 
            onClick={handleSetupGTDLists}
            className="ok-btn"
            style={{
              background: 'var(--accent-color)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 16px',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)',
              transition: 'background-color 0.2s'
            }}
          >
            Configurar listas GTD
          </button>
        )}
      </div>

      {/* Sub Tabs */}
      <div style={{ display: 'flex', gap: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => setActiveSubTab('clarify')}
          style={{
            background: 'transparent',
            border: 'none',
            color: activeSubTab === 'clarify' ? 'var(--accent-hover)' : 'var(--text-secondary)',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '4px 12px',
            position: 'relative'
          }}
        >
          1. Clarificar Bandeja de Entrada
          {activeSubTab === 'clarify' && <div style={{ position: 'absolute', bottom: '-9px', left: 0, right: 0, height: '2px', backgroundColor: 'var(--accent-hover)' }} />}
        </button>
        <button 
          onClick={() => setActiveSubTab('review')}
          style={{
            background: 'transparent',
            border: 'none',
            color: activeSubTab === 'review' ? 'var(--accent-hover)' : 'var(--text-secondary)',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '4px 12px',
            position: 'relative'
          }}
        >
          2. Reflexión y Revisión Semanal
          {activeSubTab === 'review' && <div style={{ position: 'absolute', bottom: '-9px', left: 0, right: 0, height: '2px', backgroundColor: 'var(--accent-hover)' }} />}
        </button>
        <button 
          onClick={() => setActiveSubTab('guide')}
          style={{
            background: 'transparent',
            border: 'none',
            color: activeSubTab === 'guide' ? 'var(--accent-hover)' : 'var(--text-secondary)',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '4px 12px',
            position: 'relative'
          }}
        >
          3. Guía Metodología GTD
          {activeSubTab === 'guide' && <div style={{ position: 'absolute', bottom: '-9px', left: 0, right: 0, height: '2px', backgroundColor: 'var(--accent-hover)' }} />}
        </button>
      </div>

      {/* Content based on Tab */}
      <div style={{ flex: 1, minHeight: 0 }}>
        
        {/* TAB 1: Clarify Inbox */}
        {activeSubTab === 'clarify' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', height: '100%' }}>
            
            {/* Left side: Inbox Item Card */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Inbox size={20} style={{ color: 'var(--accent-hover)' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Procesar Bandeja de Entrada</h3>
              </div>

              {!currentInboxTask ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', textAlign: 'center', gap: '10px' }}>
                  <CheckCircle2 size={48} style={{ color: 'var(--success-color)' }} />
                  <p style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>¡Bandeja de Entrada despejada!</p>
                  <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Has clasificado y clarificado todas las tareas de tu bandeja de entrada.</p>
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.5rem', position: 'relative' }}>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>
                      Tarea Actual a Clarificar ({inboxTasks.length} restantes)
                    </div>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{currentInboxTask.title}</h4>
                    {currentInboxTask.description && currentInboxTask.description !== '<p><br></p>' && (
                      <div 
                        className="ql-editor"
                        style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', padding: 0 }}
                        dangerouslySetInnerHTML={{ __html: currentInboxTask.description }}
                      />
                    )}
                  </div>

                  <div style={{ fontSize: '0.8rem', padding: '12px', border: '1px solid rgba(245, 158, 11, 0.2)', background: 'rgba(245, 158, 11, 0.02)', borderRadius: '8px', color: '#f59e0b', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                    <span><b>Regla GTD:</b> Concéntrate en una tarea a la vez. Clarifica su significado y decide su cuadrante o lista de inmediato.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Right side: GTD Flowchart Wizard */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Asistente del Diagrama de Flujo GTD</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '4px' }}>Guía interactiva para clarificar según las reglas de David Allen.</p>
              </div>

              {!currentInboxTask ? (
                <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', opacity: 0.6 }}>
                  No hay tareas pendientes en la bandeja de entrada para procesar.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
                  
                  {/* STEP 1: Actionable Test */}
                  {currentStep === 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'slideDown 0.25s ease' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ArrowRight size={16} color="var(--accent-hover)" />
                        Paso 1: ¿Es accionable?
                      </h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>¿Requiere esta tarea realizar alguna acción física o mental para completarla?</p>
                      
                      <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                        <button 
                          onClick={() => setCurrentStep(2)} // moves to Non-actionable options
                          style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', transition: 'background-color 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'}
                        >
                          NO ACCIONABLE
                        </button>
                        <button 
                          onClick={() => setCurrentStep(3)} // moves to Actionable time test
                          style={{ flex: 1, padding: '12px', background: 'var(--accent-color)', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(124,58,237,0.2)', transition: 'background-color 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-color)'}
                        >
                          SÍ ES ACCIONABLE
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: Non-Actionable Options */}
                  {currentStep === 2 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'slideDown 0.25s ease' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ArrowRight size={16} color="var(--accent-hover)" />
                        No Accionable: ¿Qué hacer con ella?
                      </h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Las tareas no accionables deben eliminarse, guardarse para referencia o dejarse para revisar más adelante.</p>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button 
                          onClick={() => handleDeleteTask(currentInboxTask.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '8px', color: '#ef4444', fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.06)'}
                        >
                          <Trash2 size={16} />
                          🗑️ Eliminar / Basura (No sirve)
                        </button>

                        <button 
                          onClick={() => handleMoveToList(currentInboxTask.id, 'Algún día / Tal vez')}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '8px', color: '#10b981', fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.06)'}
                        >
                          <RotateCcw size={16} />
                          💤 Algún día / Tal vez (Posible interés futuro)
                        </button>

                        <button 
                          onClick={() => handleMoveToList(currentInboxTask.id, 'Referencia')}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
                        >
                          <Folder size={16} style={{ color: 'var(--text-secondary)' }} />
                          📂 Guardar en Referencia (Información útil)
                        </button>
                      </div>

                      <button 
                        onClick={() => setCurrentStep(1)} 
                        style={{ marginTop: '0.5rem', alignSelf: 'flex-start', background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        ← Volver a la pregunta
                      </button>
                    </div>
                  )}

                  {/* STEP 3: Actionable Time Test (2-Minute Rule) */}
                  {currentStep === 3 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'slideDown 0.25s ease' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ArrowRight size={16} color="var(--accent-hover)" />
                        Paso 2: ¿Toma menos de 2 minutos?
                      </h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Si la acción toma menos de 2 minutos para realizarse, David Allen recomienda hacerla <b>inmediatamente</b> para ahorrar tiempo de organización.</p>
                      
                      <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                        <button 
                          onClick={() => setCurrentStep(5)} // moves to Defer/Delegate organize options
                          style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', transition: 'background-color 0.2s' }}
                        >
                          NO, TOMA MÁS
                        </button>
                        <button 
                          onClick={() => setCurrentStep(4)} // moves to 2-Min Timer mode
                          style={{ flex: 1, padding: '12px', background: 'var(--success-color)', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.2)', transition: 'background-color 0.2s' }}
                        >
                          SÍ, TOMA MENOS
                        </button>
                      </div>

                      <button 
                        onClick={() => setCurrentStep(1)} 
                        style={{ marginTop: '0.5rem', alignSelf: 'flex-start', background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        ← Volver al Paso 1
                      </button>
                    </div>
                  )}

                  {/* STEP 4: 2-Minute Rule Timer */}
                  {currentStep === 4 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center', textAlign: 'center', animation: 'slideDown 0.25s ease' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        🏃‍♂️ ¡Hazlo Ya! Regla de los 2 Minutos
                      </h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '320px' }}>Realiza la actividad física o mental ahora mismo. He preparado un cronómetro para ayudarte a medir el tiempo:</p>
                      
                      <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', margin: '0.5rem 0' }}>
                        {formatTimerTime(timerSeconds)}
                      </div>

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                          onClick={() => setTimerRunning(!timerRunning)}
                          style={{ padding: '8px 20px', background: timerRunning ? 'var(--danger-color)' : 'var(--success-color)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          {timerRunning ? 'PAUSAR' : 'INICIAR'}
                        </button>
                        <button 
                          onClick={() => { setTimerRunning(false); setTimerSeconds(120); }}
                          style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.03)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer' }}
                        >
                          RESETEAR
                        </button>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border-color)', width: '100%', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                        <button 
                          onClick={() => handleCompleteTask(currentInboxTask.id)}
                          style={{ display: 'flex', alignItems: 'center', justifySelf: 'center', gap: '8px', padding: '12px 24px', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(124,58,237,0.2)' }}
                        >
                          <Check size={16} /> ¡YA LA COMPLETÉ!
                        </button>
                      </div>

                      <button 
                        onClick={() => setCurrentStep(3)} 
                        style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        ← Volver a la decisión
                      </button>
                    </div>
                  )}

                  {/* STEP 5: Defer / Delegate Organize Options */}
                  {currentStep === 5 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'slideDown 0.25s ease' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ArrowRight size={16} color="var(--accent-hover)" />
                        Paso 3: Organizar (Diferir o Delegar)
                      </h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Esta tarea toma más de 2 minutos. Organízala en la lista de GTD que le corresponda:</p>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button 
                          onClick={() => handleMoveToList(currentInboxTask.id, 'Siguientes Acciones')}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
                        >
                          <Check size={16} style={{ color: 'var(--danger-color)' }} />
                          <div>
                            <div style={{ fontSize: '0.85rem' }}>🏃‍♂️ Siguiente Acción</div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 400 }}>Acción física que debo realizar yo lo antes posible.</span>
                          </div>
                        </button>

                        <button 
                          onClick={() => handleMoveToList(currentInboxTask.id, 'Proyectos')}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
                        >
                          <Folder size={16} style={{ color: '#8b5cf6' }} />
                          <div>
                            <div style={{ fontSize: '0.85rem' }}>🏗️ Proyecto Multi-acción</div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 400 }}>Meta que requiere más de una acción física para completarse.</span>
                          </div>
                        </button>

                        <button 
                          onClick={() => handleMoveToList(currentInboxTask.id, 'En Espera')}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
                        >
                          <Users size={16} style={{ color: '#f59e0b' }} />
                          <div>
                            <div style={{ fontSize: '0.85rem' }}>⏳ En Espera (Delegar)</div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 400 }}>Actividad delegada a otra persona; aguardo su respuesta.</span>
                          </div>
                        </button>

                        {/* Calendar defer date option */}
                        <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                            <Calendar size={16} style={{ color: 'var(--accent-hover)' }} />
                            📅 Diferir y Agendar (Calendario)
                          </div>
                          
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input 
                              type="date"
                              value={customDate}
                              onChange={(e) => setCustomDate(e.target.value)}
                              style={{
                                flex: 1,
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                                color: 'var(--text-primary)',
                                padding: '6px 10px',
                                fontSize: '0.8rem',
                                outline: 'none'
                              }}
                            />
                            <button
                              onClick={() => {
                                if (customDate) {
                                  handleMoveToList(currentInboxTask.id, 'Siguientes Acciones', {
                                    due_date: customDate
                                  });
                                }
                              }}
                              disabled={!customDate}
                              style={{
                                background: customDate ? 'var(--accent-color)' : 'rgba(255,255,255,0.05)',
                                color: customDate ? 'white' : 'var(--text-secondary)',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '6px 12px',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                cursor: customDate ? 'pointer' : 'default'
                              }}
                            >
                              Agendar
                            </button>
                          </div>
                        </div>

                      </div>

                      <button 
                        onClick={() => setCurrentStep(3)} 
                        style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        ← Volver a la decisión de tiempo
                      </button>
                    </div>
                  )}

                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 2: Weekly Review */}
        {activeSubTab === 'review' && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '2rem', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Proceso de Revisión Semanal (Reflexionar)</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                La Revisión Semanal es la clave de bóveda de GTD. Realízala una vez por semana para despejar tu mente y mantener el sistema al día.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem' }}>
              
              {/* Checklist */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Lista de Pasos para la Revisión Semanal</h4>
                
                {[
                  { title: 'Vaciar tu mente (Brain Dump)', desc: 'Escribe cualquier idea, pendiente, preocupación o tarea suelta que tengas en tu cabeza directamente en el Inbox para despejar tu mente.' },
                  { title: 'Vaciar la Bandeja de Entrada (Inbox)', desc: 'Procesa todas las actividades de tu bandeja de entrada utilizando el asistente de Clarificar GTD hasta dejarla en cero.' },
                  { title: 'Revisar Siguientes Acciones', desc: 'Examina tu lista de Siguientes Acciones. Marca las completadas y asegúrate de que sigan vigentes.' },
                  { title: 'Revisar la lista de "En Espera"', desc: 'Comprueba el estado de las tareas delegadas. Haz seguimiento a las personas que tengan acciones retrasadas si es necesario.' },
                  { title: 'Revisar tus "Proyectos"', desc: 'Asegúrate de que cada proyecto activo tenga al menos una Siguiente Acción física asignada en el sistema para que no se quede estancado.' },
                  { title: 'Revisar la lista "Algún día / Tal vez"', desc: 'Revisa si hay proyectos o ideas aparcadas que ahora quieras activar, o borra las que ya no te interesen.' }
                ].map((item, idx) => (
                  <div 
                    key={idx} 
                    style={{
                      display: 'flex',
                      gap: '12px',
                      padding: '12px 16px',
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '8px'
                    }}
                  >
                    <input 
                      type="checkbox" 
                      style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                    />
                    <div>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', display: 'block' }}>{idx + 1}. {item.title}</strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>{item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Weekly review stats & tools */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={16} color="var(--accent-hover)" />
                    Auditoría del Sistema GTD
                  </h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Tareas en Inbox:</span>
                      <strong style={{ color: inboxTasks.length > 0 ? '#f59e0b' : 'var(--success-color)' }}>{inboxTasks.length}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Siguientes Acciones:</span>
                      <strong>{tasks.filter(t => !t.is_completed && t.list_id === getListIdByName('Siguientes Acciones')).length}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Proyectos Activos:</span>
                      <strong>{tasks.filter(t => !t.is_completed && t.list_id === getListIdByName('Proyectos')).length}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Tareas En Espera:</span>
                      <strong>{tasks.filter(t => !t.is_completed && t.list_id === getListIdByName('En Espera')).length}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Algún día/Tal vez:</span>
                      <strong>{tasks.filter(t => !t.is_completed && t.list_id === getListIdByName('Algún día / Tal vez')).length}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ border: '1px solid rgba(139, 92, 246, 0.2)', background: 'rgba(139, 92, 246, 0.02)', borderRadius: '12px', padding: '1.25rem', color: '#a78bfa' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '6px' }}>💡 Consejo Semanal GTD</h4>
                  <p style={{ fontSize: '0.8rem', lineHeight: 1.4, opacity: 0.9 }}>
                    "La razón principal para hacer la revisión no es recopilar las tareas, sino limpiar los canales de tu mente para que puedas confiar plenamente en tus elecciones intuitivas de qué hacer a continuación." — David Allen.
                  </p>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 3: GTD Guide Card */}
        {activeSubTab === 'guide' && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '2rem', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BookOpen size={22} style={{ color: 'var(--accent-hover)' }} />
                Guía Rápida de la Metodología GTD
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                Aprende los pilares fundamentales del sistema de David Allen para despejar tu mente de ideas sueltas.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '1.25rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#3b82f6', marginBottom: '8px' }}>1. CAPTURAR</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Recopila absolutamente todo lo que esté en tu mente o requiera tu atención (ideas, correos, tareas, planes) y escríbelo directamente en tu <b>Bandeja de Entrada (Inbox)</b> de inmediato. No proceses en este momento, solo captura.
                </p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '1.25rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ef4444', marginBottom: '8px' }}>2. CLARIFICAR</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Procesa tus elementos capturados uno por uno. Pregúntate: <i>¿Es accionable?</i>. Si la respuesta es no, bórralo, guárdalo en Referencia o aplace a Algún día. Si es sí, define la acción física concreta necesaria y si toma menos de 2 minutos, ¡hazla ya!
                </p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '1.25rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#8b5cf6', marginBottom: '8px' }}>3. ORGANIZAR</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Coloca recordatorios en las listas GTD adecuadas. Coloca las acciones en <b>Siguientes Acciones</b>, agrupa proyectos de múltiples pasos en <b>Proyectos</b>, delega y coloca en <b>En Espera</b>, y las metas futuras en <b>Algún día / Tal vez</b>.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1.5rem', marginTop: '0.5rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '1.25rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f59e0b', marginBottom: '8px' }}>4. REFLEXIONAR</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Revisa tu sistema regularmente. Haz una <b>Revisión Semanal</b> rigurosa para vaciar el Inbox, actualizar el estado de tus Proyectos y asegurar que todo siga alineado con tus metas reales.
                </p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '1.25rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#10b981', marginBottom: '8px' }}>5. HACER</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Utiliza tu intuición y el contexto del sistema de listas para elegir qué hacer en cada momento (según tu energía, el tiempo disponible y las prioridades actuales), sabiendo con absoluta seguridad que estás enfocado en lo correcto.
                </p>
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
