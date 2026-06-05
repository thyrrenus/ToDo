import { useTodo } from '../context/TodoContext';
import { Plus, Mic } from 'lucide-react';
import { isToday, parseISO, format } from 'date-fns';

export function AddTaskWidget() {
  const {
    tasks,
    lists,
    activeList,
    quickAddTitle,
    setQuickAddTitle,
    handleQuickAdd,
    handleToggleTask: onToggleTask,
    setSelectedTaskId,
    setSelectedSubtaskId,
    isListening,
    listeningSource,
    startSpeechRecognition
  } = useTodo();

  const onSelectTask = (id) => {
    setSelectedTaskId(id);
    setSelectedSubtaskId(null);
  };

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
