import { useState, useEffect, useRef } from 'react';
import { Trash2, Check, ChevronDown, ChevronRight, Edit2, X, Calendar as CalendarIcon, Sun, Sunrise, Compass, Clock, RotateCcw, AlertCircle } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import { format, parseISO, addDays, startOfWeek, endOfWeek, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { runAITask } from '../utils/aiManager';

export function TaskDetail({ task, subtask, sections = [], onClose, onUpdate, onDelete, onDeleteSubtask }) {
  const isSubtaskMode = !!subtask;
  const currentItem = isSubtaskMode ? subtask : task;

  const formatDateTimeForInput = (str) => {
    if (!str) return '';
    return str.replace(' ', 'T').substring(0, 16);
  };

  const formatDateForInput = (str) => {
    if (!str) return '';
    return str.split(' ')[0].split('T')[0];
  };

  const [title, setTitle] = useState(currentItem?.title || '');
  const [description, setDescription] = useState(currentItem?.description || '');
  const [sectionId, setSectionId] = useState(task?.section_id || '');

  // Date and Reminder states
  const [dueDate, setDueDate] = useState(currentItem?.due_date ? formatDateForInput(currentItem.due_date) : '');
  const [startTime, setStartTime] = useState(currentItem?.start_time ? formatDateTimeForInput(currentItem.start_time) : '');
  const [endTime, setEndTime] = useState(currentItem?.end_time ? formatDateTimeForInput(currentItem.end_time) : '');
  const [expandedSubtaskId, setExpandedSubtaskId] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProgress, setAiProgress] = useState(null);
  const [aiError, setAiError] = useState(null);
  const [suggestedQuadrant, setSuggestedQuadrant] = useState(null);
  const isAIDisabled = localStorage.getItem('aiModelSelected') === 'desactivado';

  const handleAIBreakdown = () => {
    if (!task) return;
    setAiLoading(true);
    setAiError(null);
    setAiProgress({ file: 'Preparando IA local...', progress: 0 });

    runAITask(
      'breakdown',
      title,
      {},
      (message) => {
        if (message.type === 'progress') {
          setAiProgress({
            file: message.file.substring(message.file.lastIndexOf('/') + 1),
            progress: Math.round(message.progress || 0)
          });
        } else if (message.type === 'ready') {
          setAiProgress({ file: 'Modelo cargado en WebAssembly, procesando...', progress: 100 });
        } else if (message.type === 'breakdown-result') {
          setAiLoading(false);
          setAiProgress(null);
          parseAndSaveSubtasks(message.result);
        } else if (message.type === 'error') {
          setAiLoading(false);
          setAiProgress(null);
          setAiError(message.error);
        }
      },
      (err) => {
        setAiLoading(false);
        setAiProgress(null);
        setAiError(err.message || 'Error en el Web Worker.');
      }
    );
  };

  const parseAndSaveSubtasks = async (rawText) => {
    // Helper para omitir respuestas del modelo que contengan disculpas, avisos de ética,
    // o que repitan los placeholders entre corchetes
    const isInvalidTitle = (str) => {
      const lower = str.toLowerCase();
      return (
        lower.includes("inappropriate") ||
        lower.includes("ethical") ||
        lower.includes("sorry") ||
        lower.includes("language model") ||
        lower.includes("[subtarea]") ||
        lower.includes("[subtask]") ||
        (lower.includes("subtarea") && (lower.includes("[") || lower.includes("]"))) ||
        str.trim().length < 3
      );
    };

    let candidateLines = [];
    if (rawText.includes('\n')) {
      candidateLines = rawText.split('\n');
    } else {
      // Split dinámico por numeración (ej: "1. Tarea A 2. Tarea B")
      candidateLines = rawText.split(/\b\d+[\.\-\s)]+\s*/);
    }

    const newSubtaskTitles = [];
    
    candidateLines.forEach(line => {
      let cleaned = line.trim();
      // Remover números prefijos si todavía persisten en la línea
      const match = /^\d+[\.\-\s)]+\s*(.+)$/.exec(cleaned);
      if (match) {
        cleaned = match[1].trim();
      }
      
      if (cleaned && !isInvalidTitle(cleaned)) {
        newSubtaskTitles.push(cleaned);
      }
    });

    // Si por algún motivo falló el split numérico, tomar líneas directas de más de 3 letras que sean válidas
    if (newSubtaskTitles.length === 0) {
      const backupLines = rawText.split('\n');
      backupLines.forEach(line => {
        const cleaned = line.trim();
        if (cleaned && cleaned.length > 3 && !isInvalidTitle(cleaned)) {
          newSubtaskTitles.push(cleaned);
        }
      });
    }

    // Limitar a máximo 5 subtareas
    const titlesToSave = newSubtaskTitles.slice(0, 5);
    
    try {
      for (const stTitle of titlesToSave) {
        await fetch('/api/subtasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task_id: task.id,
            title: stTitle,
            description: ''
          })
        });
      }
      onUpdate();
    } catch (err) {
      console.error('Error al guardar subtareas automáticas:', err);
    }
  };

  const handleAIEisenhowerClassify = () => {
    if (!task) return;
    setAiLoading(true);
    setAiError(null);
    setSuggestedQuadrant(null);
    setAiProgress({ file: 'Preparando clasificador...', progress: 0 });

    runAITask(
      'classify',
      title,
      description.replace(/<[^>]*>/g, ''), // Quitar HTML
      (message) => {
        if (message.type === 'progress') {
          setAiProgress({
            file: message.file.substring(message.file.lastIndexOf('/') + 1),
            progress: Math.round(message.progress || 0)
          });
        } else if (message.type === 'ready') {
          setAiProgress({ file: 'Analizando semántica...', progress: 100 });
        } else if (message.type === 'classify-result') {
          setAiLoading(false);
          setAiProgress(null);
          setSuggestedQuadrant(message.result);
        } else if (message.type === 'error') {
          setAiLoading(false);
          setAiProgress(null);
          setAiError(message.error);
        }
      },
      (err) => {
        setAiLoading(false);
        setAiProgress(null);
        setAiError(err.message || 'Error en el clasificador.');
      }
    );
  };

  const handleApplyAIQuadrant = async (quadrantName) => {
    let priorityVal = 0;
    if (quadrantName.includes('Urgente e Importante')) priorityVal = 3;
    else if (quadrantName.includes('Importante pero No Urgente')) priorityVal = 2;
    else if (quadrantName.includes('Urgente pero No Importante')) priorityVal = 1;

    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: priorityVal })
      });
      setSuggestedQuadrant(null);
      onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeTab, setActiveTab] = useState('date'); // 'date' or 'duration'
  const [allDay, setAllDay] = useState(!currentItem?.start_time);
  
  // Popover calendar states
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());

  const popoverRef = useRef(null);

  useEffect(() => {
    const item = subtask || task;
    setTitle(item?.title || '');
    setDescription(item?.description || '');
    
    if (subtask) {
      setSectionId('');
      setDueDate(subtask.due_date ? formatDateForInput(subtask.due_date) : '');
      setStartTime(subtask.start_time ? formatDateTimeForInput(subtask.start_time) : '');
      setEndTime(subtask.end_time ? formatDateTimeForInput(subtask.end_time) : '');
      setAllDay(!subtask.start_time);
    } else if (task) {
      setSectionId(task.section_id || '');
      setDueDate(task.due_date ? formatDateForInput(task.due_date) : '');
      setStartTime(task.start_time ? formatDateTimeForInput(task.start_time) : '');
      setEndTime(task.end_time ? formatDateTimeForInput(task.end_time) : '');
      setAllDay(!task.start_time);
    }
  }, [task, subtask]);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setShowDatePicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleUpdate = async (customFields = {}) => {
    if (isSubtaskMode) {
      const updatedFields = {
        title,
        description,
        due_date: dueDate || null,
        start_time: startTime || null,
        end_time: endTime || null,
        ...customFields
      };

      if (updatedFields.start_time && updatedFields.start_time.length === 16) updatedFields.start_time += ':00';
      if (updatedFields.end_time && updatedFields.end_time.length === 16) updatedFields.end_time += ':00';

      try {
        await fetch(`/api/subtasks/${subtask.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedFields)
        });
        onUpdate();
      } catch (err) {
        console.error(err);
      }
    } else if (task) {
      // Merge custom parameters from date selection
      const updatedFields = {
        title,
        description,
        section_id: sectionId ? parseInt(sectionId, 10) : null,
        due_date: dueDate || null,
        start_time: startTime || null,
        end_time: endTime || null,
        ...customFields
      };

      if (updatedFields.start_time && updatedFields.start_time.length === 16) updatedFields.start_time += ':00';
      if (updatedFields.end_time && updatedFields.end_time.length === 16) updatedFields.end_time += ':00';

      try {
        await fetch(`/api/tasks/${task.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedFields)
        });
        onUpdate();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleDelete = () => {
    if (isSubtaskMode) {
      if (onDeleteSubtask) onDeleteSubtask(subtask.id);
    } else if (task) {
      if (onDelete) onDelete(task.id);
    }
  };

  const handleToggleSubtask = async (id, currentStatus) => {
    try {
      const res = await fetch(`/api/subtasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: !currentStatus ? 1 : 0 })
      });
      if (res.ok) onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSubtask = async (id) => {
    try {
      const res = await fetch(`/api/subtasks/${id}`, { method: 'DELETE' });
      if (res.ok) onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  const getFormattedDateDisplay = () => {
    if (startTime && endTime) {
      try {
        const startParsed = parseISO(startTime);
        const endParsed = parseISO(endTime);
        return `${format(startParsed, 'MMM d')} - ${format(endParsed, 'MMM d')}`;
      } catch (e) {
        return 'Select Dates';
      }
    }
    if (dueDate) {
      try {
        return format(parseISO(dueDate), 'MMM d');
      } catch (e) {
        return 'Date and Reminder';
      }
    }
    return 'Date and Reminder';
  };

  // Mini Calendar Generation
  const generateCalendarDays = () => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // First day of the month (0 = Sunday, 1 = Monday, etc.)
    const firstDayIndex = new Date(year, month, 1).getDay();
    // Total days in the month
    const totalDays = new Date(year, month + 1, 0).getDate();
    // Total days in previous month
    const prevTotalDays = new Date(year, month, 0).getDate();

    const days = [];

    // Previous month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        day: prevTotalDays - i,
        isCurrentMonth: false,
        date: new Date(year, month - 1, prevTotalDays - i)
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
        date: new Date(year, month, i)
      });
    }

    // Next month padding days
    const remainingSlots = 42 - days.length; // 6 rows of 7 days
    for (let i = 1; i <= remainingSlots; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        date: new Date(year, month + 1, i)
      });
    }

    return days;
  };

  const handleQuickSelect = (type) => {
    const today = new Date();
    let selectedDate = today;

    if (type === 'today') {
      selectedDate = today;
    } else if (type === 'tomorrow') {
      selectedDate = addDays(today, 1);
    } else if (type === 'nextWeek') {
      selectedDate = addDays(today, 7);
    } else if (type === 'nextMonth') {
      selectedDate = addMonths(today, 1);
    }

    const formattedDate = format(selectedDate, 'yyyy-MM-dd');
    setDueDate(formattedDate);
    setStartTime('');
    setEndTime('');
    handleUpdate({ due_date: formattedDate, start_time: null, end_time: null });
  };

  const handleCalendarDayClick = (dateObj) => {
    const formattedDate = format(dateObj, 'yyyy-MM-dd');
    setDueDate(formattedDate);
    setStartTime('');
    setEndTime('');
    handleUpdate({ due_date: formattedDate, start_time: null, end_time: null });
  };

  const handleApplyDuration = () => {
    if (startTime && endTime) {
      // Auto compute due_date to start date for compatibility
      const derivedDueDate = startTime.split('T')[0];
      setDueDate(derivedDueDate);
      handleUpdate({
        due_date: derivedDueDate,
        start_time: startTime,
        end_time: endTime
      });
    }
    setShowDatePicker(false);
  };

  const handleClearDates = () => {
    setDueDate('');
    setStartTime('');
    setEndTime('');
    handleUpdate({
      due_date: null,
      start_time: null,
      end_time: null
    });
    setShowDatePicker(false);
  };

  const calendarDays = generateCalendarDays();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const subtasks = task?.subtasks || [];

  return (
    <div className="task-detail-pane">
      <div className="task-detail-header">
        <div className="task-detail-actions">
          <button className="icon-btn danger" onClick={handleDelete} title={isSubtaskMode ? "Eliminar Subtarea" : "Eliminar Tarea"}>
            <Trash2 size={16} />
          </button>
          <button className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="task-detail-content">
        <input 
          className="detail-title-input" 
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleUpdate}
          placeholder={isSubtaskMode ? "Subtask Title" : "Task Title"}
        />

        {(task || subtask) && (
          <div className="date-reminder-wrapper" ref={popoverRef}>
            <button 
              className={`date-reminder-trigger-btn ${dueDate || startTime ? 'has-date' : ''}`}
              onClick={() => setShowDatePicker(!showDatePicker)}
            >
              <CalendarIcon size={15} />
              <span>{getFormattedDateDisplay()}</span>
            </button>

            {showDatePicker && (
              <div className="date-picker-popover">
                {/* Tabs */}
                <div className="popover-tabs">
                  <button 
                    className={`popover-tab-btn ${activeTab === 'date' ? 'active' : ''}`}
                    onClick={() => setActiveTab('date')}
                  >
                    Date
                  </button>
                  <button 
                    className={`popover-tab-btn ${activeTab === 'duration' ? 'active' : ''}`}
                    onClick={() => setActiveTab('duration')}
                  >
                    Duration
                  </button>
                </div>

                <div className="popover-body">
                  {activeTab === 'date' ? (
                    <div className="date-tab-content">
                      {/* Quick Select Panel */}
                      <div className="quick-select-panel">
                        <button className="quick-select-item" onClick={() => handleQuickSelect('today')}>
                          <Sun size={15} />
                          <span>Hoy</span>
                        </button>
                        <button className="quick-select-item" onClick={() => handleQuickSelect('tomorrow')}>
                          <Sunrise size={15} />
                          <span>Mañana</span>
                        </button>
                        <button className="quick-select-item" onClick={() => handleQuickSelect('nextWeek')}>
                          <Compass size={15} />
                          <span>Siguiente semana</span>
                        </button>
                        <button className="quick-select-item" onClick={() => handleQuickSelect('nextMonth')}>
                          <Clock size={15} />
                          <span>Siguiente mes</span>
                        </button>
                      </div>

                      {/* Mini Month Picker */}
                      <div className="mini-calendar-header">
                        <span>{monthNames[currentCalendarDate.getMonth()]} {currentCalendarDate.getFullYear()}</span>
                        <div className="mini-calendar-nav">
                          <button 
                            className="nav-arrow-btn"
                            onClick={() => setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1, 1))}
                          >
                            &lt;
                          </button>
                          <button 
                            className="nav-arrow-btn"
                            onClick={() => setCurrentCalendarDate(new Date())}
                          >
                            o
                          </button>
                          <button 
                            className="nav-arrow-btn"
                            onClick={() => setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 1))}
                          >
                            &gt;
                          </button>
                        </div>
                      </div>

                      {/* Weekday Names */}
                      <div className="weekday-labels">
                        <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
                      </div>

                      {/* Mini Calendar Grid */}
                      <div className="mini-calendar-grid">
                        {calendarDays.map((dayObj, index) => {
                          const formattedCompare = format(dayObj.date, 'yyyy-MM-dd');
                          const isSelected = dueDate === formattedCompare;
                          return (
                            <button
                              key={index}
                              onClick={() => handleCalendarDayClick(dayObj.date)}
                              className={`calendar-grid-day ${!dayObj.isCurrentMonth ? 'other-month' : ''} ${isSelected ? 'selected' : ''}`}
                            >
                              {dayObj.day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="duration-tab-content">
                      <div className="duration-field">
                        <label>Start</label>
                        <input 
                          type={allDay ? "date" : "datetime-local"} 
                          value={allDay ? startTime.split('T')[0] : startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="duration-input"
                        />
                      </div>
                      
                      <div className="duration-field">
                        <label>End</label>
                        <input 
                          type={allDay ? "date" : "datetime-local"}
                          value={allDay ? endTime.split('T')[0] : endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="duration-input"
                        />
                      </div>

                      <div className="all-day-toggle-row">
                        <span>All Day</span>
                        <label className="toggle-switch">
                          <input 
                            type="checkbox" 
                            checked={allDay}
                            onChange={(e) => {
                              setAllDay(e.target.checked);
                              // Format date values accordingly
                              if (e.target.checked) {
                                if (startTime) setStartTime(startTime.split('T')[0]);
                                if (endTime) setEndTime(endTime.split('T')[0]);
                              } else {
                                if (startTime && !startTime.includes('T')) setStartTime(`${startTime}T09:00`);
                                if (endTime && !endTime.includes('T')) setEndTime(`${endTime}T18:00`);
                              }
                            }}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="popover-actions">
                    <button className="popover-action-btn ok-btn" onClick={handleApplyDuration}>
                      OK
                    </button>
                    <button className="popover-action-btn clear-btn" onClick={handleClearDates}>
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!isSubtaskMode && task && sections.filter(s => s.list_id === task.list_id).length > 0 && (
          <div className="section-selector-field">
            <label>Section</label>
            <select 
              className="detail-date-picker"
              value={sectionId}
              onChange={(e) => {
                const val = e.target.value;
                setSectionId(val);
                handleUpdate({ section_id: val ? parseInt(val, 10) : null });
              }}
            >
              <option value="">No Section</option>
              {sections.filter(s => s.list_id === task.list_id).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {!isSubtaskMode && task && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.01)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '12px',
            marginBottom: '1.25rem',
            marginTop: '0.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Matriz de Eisenhower (Clasificación):
              </span>
              {!isAIDisabled && (
                <button
                  onClick={handleAIEisenhowerClassify}
                  disabled={aiLoading}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent-hover)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                >
                  🔍 Clasificar con IA
                </button>
              )}
            </div>

            {suggestedQuadrant ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginTop: '4px',
                animation: 'fadeIn 0.2s ease'
              }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>🎯 Propuesta:</span>
                  <strong style={{ color: 'var(--accent-hover)' }}>{suggestedQuadrant}</strong>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => handleApplyAIQuadrant(suggestedQuadrant)}
                    style={{
                      background: 'var(--accent-hover)',
                      border: 'none',
                      color: '#ffffff',
                      borderRadius: '5px',
                      padding: '4px 10px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => setSuggestedQuadrant(null)}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      borderRadius: '5px',
                      padding: '4px 10px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Descartar
                  </button>
                </div>
              </div>
            ) : (
              <select
                value={task.priority}
                onChange={async (e) => {
                  const priorityVal = parseInt(e.target.value, 10);
                  try {
                    await fetch(`/api/tasks/${task.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ priority: priorityVal })
                    });
                    onUpdate();
                  } catch (err) {
                    console.error(err);
                  }
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '6px 8px',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  outline: 'none',
                  cursor: 'pointer',
                  width: '100%',
                  marginTop: '2px'
                }}
              >
                <option value="3" style={{ background: 'var(--right-pane-bg)' }}>🔴 Urgente e Importante (Hacer ya)</option>
                <option value="2" style={{ background: 'var(--right-pane-bg)' }}>🟡 Importante pero No Urgente (Agendar)</option>
                <option value="1" style={{ background: 'var(--right-pane-bg)' }}>🔵 Urgente pero No Importante (Delegar)</option>
                <option value="0" style={{ background: 'var(--right-pane-bg)' }}>⚪ No Urgente y No Importante (Eliminar)</option>
              </select>
            )}
          </div>
        )}
        
        <div className="detail-description-wrapper" onBlur={handleUpdate}>
          <RichTextEditor 
            value={description}
            onChange={setDescription}
            placeholder={isSubtaskMode ? "Escribe detalles de la subtarea aquí..." : "Add description..."}
          />
        </div>

        {!isSubtaskMode && task && (
          <div className="detail-subtasks-section" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 className="section-subtitle" style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Subtareas</h3>
              {!isAIDisabled && (
                <button 
                  onClick={handleAIBreakdown}
                  disabled={aiLoading}
                  style={{
                    background: 'rgba(124, 58, 237, 0.08)',
                    border: '1px solid rgba(124, 58, 237, 0.2)',
                    color: 'var(--accent-hover)',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'background 0.2s'
                  }}
                >
                  ✨ Desglosar con IA
                </button>
              )}
            </div>

            {aiLoading && aiProgress && (
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '10px 12px',
                marginBottom: '1rem',
                animation: 'pulse 1.5s infinite ease-in-out'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <span>{aiProgress.file}</span>
                  <span>{aiProgress.progress}%</span>
                </div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${aiProgress.progress}%`, height: '100%', background: 'var(--accent-hover)', transition: 'width 0.2s ease' }} />
                </div>
              </div>
            )}

            {aiError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.05)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#ef4444',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '1rem'
              }}>
                <AlertCircle size={14} />
                <span>Error: {aiError}</span>
              </div>
            )}

            {subtasks.length > 0 ? (
              <div className="detail-subtasks-list">
                {subtasks.map(st => {
                  const stCompleted = st.is_completed === 1 || st.is_completed === true;
                  const isExpanded = expandedSubtaskId === st.id;
                  
                  return (
                    <div key={st.id} className={`detail-subtask-item-container ${isExpanded ? 'expanded' : ''}`}>
                      <div className={`detail-subtask-item ${stCompleted ? 'completed' : ''}`}>
                        <div className="checkbox subtask-checkbox" onClick={() => handleToggleSubtask(st.id, st.is_completed)}>
                          {stCompleted && <Check size={10} color="#0f1115" />}
                        </div>
                        <div className="subtask-title" onClick={() => setExpandedSubtaskId(isExpanded ? null : st.id)}>
                          {st.title}
                        </div>
                        <button className="icon-btn" onClick={() => setExpandedSubtaskId(isExpanded ? null : st.id)} title="Editar Detalles">
                          <Edit2 size={14} />
                        </button>
                        <button className="icon-btn" onClick={() => setExpandedSubtaskId(isExpanded ? null : st.id)}>
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        <button className="subtask-delete icon-btn danger" onClick={() => handleDeleteSubtask(st.id)}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="subtask-editor-container" onBlur={() => handleUpdateSubtask(st.id, 'description', st.description)}>
                          <RichTextEditor 
                            value={st.description || ''}
                            onChange={(val) => handleUpdateSubtask(st.id, 'description', val)}
                            placeholder="Add subtask details..."
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.6, fontStyle: 'italic', margin: '4px 0 0 0' }}>
                No hay subtareas registradas. ¡Usa el desglose de IA para generar ideas!
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
