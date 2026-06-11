import { useState, useEffect } from 'react';
import { startOfWeek, addDays, format, isSameDay, parseISO, getHours, getMinutes, differenceInMinutes, startOfToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { adjustExternalDate } from '../utils/timezone';
import { useTodo } from '../context/TodoContext';

export function CalendarView() {
  const { 
    tasks = [], 
    lists = [], 
    externalEvents = [], 
    externalEventsError = null, 
    fetchExternalEvents: onRetrySync, 
    handleSelectEvent: onSelectEvent, 
    handleUpdateEventDates: onUpdateEvent, 
    homeTimezone, 
    activeTimezoneMode,
    handleAddTask: onAddTask,
    handleUpdateTask: onUpdateTask,
    handleDeleteTask: onDeleteTask,
    setSelectedTaskId,
    setSelectedSubtaskId
  } = useTodo();

  const onSelectTask = (id) => {
    setSelectedTaskId(id);
    setSelectedSubtaskId(null);
  };
  const [viewMode, setViewMode] = useState('week'); // 'day' or 'week'
  const [currentDate, setCurrentDate] = useState(startOfToday());
  const [interactionState, setInteractionState] = useState(null);

  // local states for aesthetics & interactivity
  const [now, setNow] = useState(new Date());
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [quickCreate, setQuickCreate] = useState(null);

  // quick create form states
  const [quickTitle, setQuickTitle] = useState('');
  const [quickListId, setQuickListId] = useState('');
  const [quickPriority, setQuickPriority] = useState('0');
  const [quickRecurrence, setQuickRecurrence] = useState('none');

  const getListColor = (listId) => {
    if (!listId) return '#5b21b6'; // Default color
    const list = lists.find(l => l.id === listId);
    return list?.color || '#5b21b6';
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const days = viewMode === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) : [currentDate];

  const PIXELS_PER_HOUR = 60; // 60px per hour

  // Date parsing helper to safeguard against formatting errors and crashes
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
            title: `${t.title} > ${st.title}`, // Breadcrumb formatting for clear visualization
            start,
            end,
            list_id: t.list_id, // Inherit list color from parent
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

  // Tick clock to update current time line every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Global click handler to close context menus and click-to-create popovers
  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (contextMenu && !e.target.closest('.calendar-context-menu')) {
        setContextMenu(null);
      }
      if (quickCreate && !e.target.closest('.calendar-quick-create-popover') && !e.target.closest('.grid-cell')) {
        setQuickCreate(null);
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [contextMenu, quickCreate]);

  // Scroll handler to hide absolute overlays to prevent clipping/floating issues
  useEffect(() => {
    const handleScroll = () => {
      setContextMenu(null);
      setQuickCreate(null);
      setHoveredEvent(null);
    };
    const scrollEl = document.querySelector('.calendar-grid-scroll');
    if (scrollEl) {
      scrollEl.addEventListener('scroll', handleScroll);
    }
    return () => {
      if (scrollEl) {
        scrollEl.removeEventListener('scroll', handleScroll);
      }
    };
  }, [contextMenu, quickCreate, hoveredEvent]);

  // Interactive Hover logic
  const handleMouseEnter = (e, eventItem) => {
    const container = document.querySelector('.calendar-view');
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const targetRect = e.currentTarget.getBoundingClientRect();
    
    let x = targetRect.right - containerRect.left + 8;
    let y = targetRect.top - containerRect.top;

    const cardWidth = 260;
    if (x + cardWidth > containerRect.width) {
      x = targetRect.left - containerRect.left - cardWidth - 8;
    }

    setHoveredEvent({
      event: eventItem,
      x,
      y
    });
  };

  const handleMouseLeave = () => {
    setHoveredEvent(null);
  };

  // Context Menu handlers
  const handleContextMenu = (e, eventItem) => {
    if (eventItem.isExternal) return;
    e.preventDefault();
    e.stopPropagation();
    
    const container = document.querySelector('.calendar-view');
    if (container) {
      const rect = container.getBoundingClientRect();
      let x = e.clientX - rect.left;
      let y = e.clientY - rect.top;

      const menuWidth = 180;
      const menuHeight = 220;
      if (x + menuWidth > rect.width) {
        x = x - menuWidth;
      }
      if (y + menuHeight > rect.height) {
        y = y - menuHeight;
      }

      setContextMenu({
        event: eventItem,
        x,
        y
      });
    }
    setQuickCreate(null);
    setHoveredEvent(null);
  };

  const handleUpdatePriority = async (priorityVal) => {
    if (contextMenu && onUpdateTask) {
      await onUpdateTask(contextMenu.event.itemId, { priority: priorityVal });
      setContextMenu(null);
    }
  };

  const handleMoveToList = async (listId) => {
    if (contextMenu && onUpdateTask) {
      await onUpdateTask(contextMenu.event.itemId, { list_id: listId });
      setContextMenu(null);
    }
  };

  // Cell quick create handler
  const handleCellClick = (e, day, hour) => {
    if (e.target.classList.contains('grid-cell')) {
      const container = document.querySelector('.calendar-view');
      if (container) {
        const rect = container.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;

        const popWidth = 240;
        const popHeight = 180;
        if (x + popWidth > rect.width) {
          x = x - popWidth;
        }
        if (y + popHeight > rect.height) {
          y = y - popHeight;
        }

        setQuickCreate({
          day,
          hour,
          x,
          y
        });
        setQuickTitle('');
        setQuickListId(lists[0]?.id || '');
        setQuickPriority('0');
        setQuickRecurrence('none');
      }
      setContextMenu(null);
      setHoveredEvent(null);
    }
  };

  const handleQuickCreateSave = async () => {
    if (!quickTitle.trim()) return;

    const startHour = quickCreate.hour;
    const endHour = startHour + 1;

    const start = new Date(quickCreate.day);
    start.setHours(startHour, 0, 0, 0);

    const end = new Date(quickCreate.day);
    end.setHours(endHour, 0, 0, 0);

    const pad = (num) => String(num).padStart(2, '0');
    const startTimeStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`;
    const endTimeStr = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;

    const newTaskData = {
      title: quickTitle,
      list_id: quickListId ? parseInt(quickListId, 10) : null,
      priority: parseInt(quickPriority, 10),
      start_time: startTimeStr,
      end_time: endTimeStr,
      due_date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
      recurrence_type: quickRecurrence
    };

    if (onAddTask) {
      await onAddTask(newTaskData);
    }
    
    setQuickCreate(null);
    setQuickTitle('');
  };

  // Mouse drag & resize handlers
  const handleMouseDown = (e, eventItem, actionType) => {
    if (eventItem.isExternal) return;
    e.stopPropagation();
    e.preventDefault();

    const startY = e.clientY;
    const startX = e.clientX;

    // Find the container element to get grid dimensions
    const gridEl = document.querySelector('.day-columns');
    if (!gridEl) return;
    const columns = Array.from(gridEl.children);
    
    // Find the column index of the event
    const eventStart = eventItem.start;
    const dayIndex = days.findIndex(d => isSameDay(d, eventStart));

    // Get grid bounding rect
    const gridRect = gridEl.getBoundingClientRect();
    const colWidth = gridRect.width / days.length;

    // Initial position properties
    const initialTop = (getHours(eventStart) + getMinutes(eventStart) / 60) * PIXELS_PER_HOUR;
    const durationMinutes = differenceInMinutes(eventItem.end, eventStart);
    const initialHeight = (durationMinutes / 60) * PIXELS_PER_HOUR;

    // Store drag state
    setInteractionState({
      event: eventItem,
      type: actionType, // 'drag' or 'resize'
      startY,
      startX,
      initialTop,
      initialHeight,
      initialDayIndex: dayIndex,
      colWidth,
      gridRect,
      currentTop: initialTop,
      currentHeight: initialHeight,
      currentDayIndex: dayIndex !== -1 ? dayIndex : 0
    });
  };

  useEffect(() => {
    if (!interactionState) return;

    const handleMouseMove = (e) => {
      const deltaY = e.clientY - interactionState.startY;
      const deltaX = e.clientX - interactionState.startX;

      if (interactionState.type === 'resize') {
        // Snapping to 15 minutes (15px)
        const snapMinutes = 15;
        const pixelsPerSnap = (snapMinutes / 60) * PIXELS_PER_HOUR;
        const newHeightRaw = interactionState.initialHeight + deltaY;
        const snappedHeight = Math.max(
          Math.round(newHeightRaw / pixelsPerSnap) * pixelsPerSnap,
          pixelsPerSnap // min duration 15 mins
        );

        setInteractionState(prev => ({
          ...prev,
          currentHeight: snappedHeight
        }));
      } else if (interactionState.type === 'drag') {
        // Snapping to 15 minutes (15px)
        const snapMinutes = 15;
        const pixelsPerSnap = (snapMinutes / 60) * PIXELS_PER_HOUR;
        const newTopRaw = interactionState.initialTop + deltaY;
        const snappedTop = Math.max(
          0,
          Math.min(
            Math.round(newTopRaw / pixelsPerSnap) * pixelsPerSnap,
            24 * PIXELS_PER_HOUR - interactionState.initialHeight // boundary
          )
        );

        // Day Column Index calculation
        const mouseGridX = e.clientX - interactionState.gridRect.left;
        const calculatedDayIndex = Math.max(
          0,
          Math.min(
            Math.floor(mouseGridX / interactionState.colWidth),
            days.length - 1
          )
        );

        setInteractionState(prev => ({
          ...prev,
          currentTop: snappedTop,
          currentDayIndex: calculatedDayIndex
        }));
      }
    };

    const handleMouseUp = (e) => {
      const totalDeltaX = Math.abs(e.clientX - interactionState.startX);
      const totalDeltaY = Math.abs(e.clientY - interactionState.startY);

      if (totalDeltaX < 4 && totalDeltaY < 4) {
        // Simple click without significant movement -> trigger event selection
        if (onSelectEvent) {
          onSelectEvent(interactionState.event.itemId, interactionState.event.isSubtask);
        } else if (onSelectTask) {
          onSelectTask(interactionState.event.itemId);
        }
      } else {
        // Drag or resize operation finished -> update event times
        const targetDay = days[interactionState.currentDayIndex];
        
        // Calculate start hour & minutes
        const startTotalMinutes = (interactionState.currentTop / PIXELS_PER_HOUR) * 60;
        const startHour = Math.floor(startTotalMinutes / 60);
        const startMins = Math.round(startTotalMinutes % 60);

        const newStartDate = new Date(targetDay);
        newStartDate.setHours(startHour, startMins, 0, 0);

        // Calculate end hour & minutes based on currentHeight duration
        const durationTotalMinutes = (interactionState.currentHeight / PIXELS_PER_HOUR) * 60;
        const newEndDate = new Date(newStartDate);
        newEndDate.setMinutes(newStartDate.getMinutes() + durationTotalMinutes);

        // Format to YYYY-MM-DDTHH:mm
        const pad = (num) => String(num).padStart(2, '0');
        const startTimeStr = `${newStartDate.getFullYear()}-${pad(newStartDate.getMonth() + 1)}-${pad(newStartDate.getDate())}T${pad(newStartDate.getHours())}:${pad(newStartDate.getMinutes())}`;
        const endTimeStr = `${newEndDate.getFullYear()}-${pad(newEndDate.getMonth() + 1)}-${pad(newEndDate.getDate())}T${pad(newEndDate.getHours())}:${pad(newEndDate.getMinutes())}`;

        if (onUpdateEvent) {
          onUpdateEvent(
            interactionState.event.itemId,
            interactionState.event.isSubtask,
            startTimeStr,
            endTimeStr
          );
        }
      }

      setInteractionState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [interactionState, days, onUpdateEvent, onSelectEvent, onSelectTask]);

  return (
    <div className="calendar-view" style={{ position: 'relative' }}>
      <div className="calendar-header">
        <h2>{(() => { const f = format(currentDate, 'MMMM yyyy', { locale: es }); return f.charAt(0).toUpperCase() + f.slice(1); })()}</h2>
        <div className="calendar-controls">
          <button onClick={() => setCurrentDate(addDays(currentDate, viewMode === 'week' ? -7 : -1))}>&lt;</button>
          <button onClick={() => setCurrentDate(startOfToday())}>Hoy</button>
          <button onClick={() => setCurrentDate(addDays(currentDate, viewMode === 'week' ? 7 : 1))}>&gt;</button>
          
          <select value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
            <option value="day" style={{ background: '#1c1c1c' }}>Día</option>
            <option value="week" style={{ background: '#1c1c1c' }}>Semana</option>
          </select>
        </div>
      </div>

      {externalEventsError && (
        <div className="calendar-sync-warning" style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '8px',
          padding: '10px 16px',
          margin: '0 0 1rem 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#ef4444',
          fontSize: '0.82rem',
          backdropFilter: 'blur(4px)'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            ⚠️ Sincronización de Outlook falló ({externalEventsError}). Verifica el enlace iCal en Configuración.
          </span>
          {onRetrySync && (
            <button 
              onClick={onRetrySync}
              style={{
                background: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 10px',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.background = '#dc2626'}
              onMouseLeave={(e) => e.target.style.background = '#ef4444'}
            >
              Reintentar
            </button>
          )}
        </div>
      )}

      <div className="calendar-grid-container">
        {/* Days Header */}
        <div className="calendar-days-header" style={{ paddingLeft: '60px' }}>
          {days.map(day => (
            <div key={day.toString()} className="calendar-day-label">
              <div className="day-name">{(() => { const name = format(day, 'EEE', { locale: es }); return name.charAt(0).toUpperCase() + name.slice(1); })()}</div>
              <div className={`day-number ${isSameDay(day, startOfToday()) ? 'today' : ''}`}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>

        {/* Scrollable Grid */}
        <div className="calendar-grid-scroll">
          <div className="calendar-grid" style={{ height: `${24 * PIXELS_PER_HOUR}px` }}>
            {/* Time Axis */}
            <div className="time-axis">
              {hours.map(hour => (
                <div key={hour} className="time-label" style={{ height: `${PIXELS_PER_HOUR}px` }}>
                  <span>
                    {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                  </span>
                </div>
              ))}
            </div>

            {/* Day Columns */}
            <div className="day-columns">
              {days.map((day, dIdx) => {
                const dayEvents = scheduledEvents.filter(e => {
                  const isInteracting = interactionState && interactionState.event.id === e.id;
                  if (isInteracting) {
                    return interactionState.currentDayIndex === dIdx;
                  }
                  return isSameDay(e.start, day);
                });

                // Compute overlapping layout groups and conflicts
                const eventLayoutProps = new Map();
                
                // 1. Group events into connected components of overlapping intervals
                const components = [];
                const sortedEvents = [...dayEvents].sort((a, b) => a.start.getTime() - b.start.getTime());

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
                      // An active event is in conflict if it overlaps with another active event in the component
                      const hasConflict = !event.isCompleted && activeEvents.some(
                        e => e.id !== event.id && event.start < e.end && event.end > e.start
                      );

                      eventLayoutProps.set(event.id, {
                        widthPercent: 100 / totalCols,
                        leftPercent: colIdx * (100 / totalCols),
                        hasConflict
                      });
                    });
                  });
                });
                
                const isToday = isSameDay(day, now);
                const nowHours = getHours(now);
                const nowMins = getMinutes(now);
                const lineTop = (nowHours + nowMins / 60) * PIXELS_PER_HOUR;
                
                return (
                  <div key={day.toString()} className="day-column">
                    {/* Grid lines */}
                    {hours.map(hour => (
                      <div 
                        key={hour} 
                        className="grid-cell" 
                        style={{ height: `${PIXELS_PER_HOUR}px` }} 
                        onClick={(e) => handleCellClick(e, day, hour)}
                      />
                    ))}

                    {/* Current Time marker line */}
                    {isToday && (
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
                        <div className="time-line-pulsator" />
                      </div>
                    )}

                    {/* Event Blocks */}
                    {dayEvents.map(event => {
                      const isInteracting = interactionState && interactionState.event.id === event.id;
                      
                      const start = event.start;
                      const end = event.end;
                      
                      let top = (getHours(start) + getMinutes(start) / 60) * PIXELS_PER_HOUR;
                      let durationMinutes = differenceInMinutes(end, start);
                      let height = Math.max((durationMinutes / 60) * PIXELS_PER_HOUR, 24);

                      if (isInteracting) {
                        top = interactionState.currentTop;
                        height = interactionState.currentHeight;
                      }

                      const startTimeStr = format(start, 'h:mm a');
                      const endTimeStr = format(end, 'h:mm a');

                      const layoutProps = eventLayoutProps.get(event.id) || { widthPercent: 100, leftPercent: 0, hasConflict: false };

                      // Styling based on conflict status
                      const borderStyle = layoutProps.hasConflict 
                        ? '1px solid rgba(239, 68, 68, 0.4)' 
                        : (event.isExternal ? '1px solid rgba(0, 120, 212, 0.3)' : 'none');
                      
                      const borderLeftStyle = layoutProps.hasConflict 
                        ? '4px solid #ef4444' 
                        : (event.isExternal ? '4px solid #0078d4' : 'none');
                      
                      const shadowStyle = layoutProps.hasConflict
                        ? '0 4px 12px rgba(239, 68, 68, 0.25), 0 0 8px rgba(239, 68, 68, 0.2)'
                        : (event.isExternal ? '0 4px 12px rgba(0, 120, 212, 0.15)' : 'none');

                      const baseBgColor = event.isExternal ? 'rgba(0, 120, 212, 0.12)' : getListColor(event.list_id);
                      // Light red-tinged background for conflicting items
                      const bgColor = layoutProps.hasConflict 
                        ? (event.isExternal ? 'rgba(239, 68, 68, 0.12)' : `linear-gradient(135deg, ${getListColor(event.list_id)} 0%, rgba(220, 38, 38, 0.75) 100%)`)
                        : baseBgColor;

                      return (
                        <div 
                          key={event.id} 
                          className={`task-block ${event.isSubtask ? 'subtask-event-block' : ''} ${event.isExternal ? 'external-event-block' : ''} ${isInteracting ? 'dragging' : ''} ${layoutProps.hasConflict ? 'conflict-event' : ''}`}
                          style={{
                            top: `${top}px`,
                            height: `${height}px`,
                            background: bgColor,
                            color: event.isExternal ? 'var(--text-primary)' : '#ffffff',
                            position: 'absolute',
                            left: `calc(${layoutProps.leftPercent}% + 4px)`,
                            right: `calc(${100 - layoutProps.leftPercent - layoutProps.widthPercent}% + 4px)`,
                            cursor: event.isExternal ? 'pointer' : 'move',
                            userSelect: 'none',
                            zIndex: isInteracting ? 100 : (layoutProps.hasConflict ? 5 : 1),
                            transition: isInteracting ? 'none' : 'top 0.15s, height 0.15s, left 0.15s, right 0.15s',
                            boxShadow: shadowStyle,
                            border: borderStyle,
                            borderLeft: borderLeftStyle,
                            backdropFilter: (event.isExternal || layoutProps.hasConflict) ? 'blur(4px)' : 'none',
                            borderRadius: '6px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            padding: '6px 8px',
                            boxSizing: 'border-box'
                          }}
                          onMouseDown={(e) => !event.isExternal && handleMouseDown(e, event, 'drag')}
                          onMouseEnter={(e) => handleMouseEnter(e, event)}
                          onMouseLeave={handleMouseLeave}
                          onContextMenu={(e) => handleContextMenu(e, event)}
                        >
                          <div className="task-block-title" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            {event.isSubtask && <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', opacity: 0.7, marginRight: '4px' }}>[Sub]</span>}
                            {event.isExternal && <span style={{ fontSize: '0.65rem', background: '#0078d4', color: '#ffffff', padding: '1px 5px', borderRadius: '3px', fontWeight: 800 }}>Outlook</span>}
                            {layoutProps.hasConflict && (
                              <span 
                                title="Conflicto de horario" 
                                style={{ 
                                  color: '#ef4444', 
                                  fontWeight: 'bold',
                                  fontSize: '0.8rem',
                                  animation: 'pulse 1.5s infinite',
                                  display: 'inline-flex'
                                }}
                              >
                                ⚠️
                              </span>
                            )}
                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: (event.isExternal || layoutProps.hasConflict) ? 600 : 'normal' }}>{event.title}</span>
                          </div>
                          <div className="task-block-time" style={{ fontSize: '0.65rem', opacity: 0.8, color: (event.isExternal || layoutProps.hasConflict) ? 'var(--text-secondary)' : '#ffffff' }}>
                            {startTimeStr} - {endTimeStr}
                          </div>

                          {/* Resize handle */}
                          {!event.isExternal && (
                            <div 
                              className="event-resize-handle"
                              onMouseDown={(e) => handleMouseDown(e, event, 'resize')}
                              style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height: '8px',
                                cursor: 'ns-resize',
                                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                                borderBottomLeftRadius: '4px',
                                borderBottomRightRadius: '4px',
                                transition: 'background-color 0.2s'
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Hover Card */}
      {hoveredEvent && (
        <div 
          className="calendar-hover-card"
          style={{
            position: 'absolute',
            left: `${hoveredEvent.x}px`,
            top: `${hoveredEvent.y}px`,
            pointerEvents: 'none'
          }}
        >
          <div className="hover-card-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span 
              className="hover-card-list-dot" 
              style={{ 
                width: '10px', 
                height: '10px', 
                borderRadius: '50%', 
                backgroundColor: hoveredEvent.event.isExternal ? '#0078d4' : getListColor(hoveredEvent.event.list_id) 
              }} 
            />
            <span className="hover-card-title" style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              {hoveredEvent.event.title}
            </span>
          </div>
          <div className="hover-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div className="hover-card-time" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              🕒 {format(hoveredEvent.event.start, 'h:mm a')} - {format(hoveredEvent.event.end, 'h:mm a')}
            </div>
            
            {hoveredEvent.event.isExternal && hoveredEvent.event.location && (
              <div className="hover-card-location" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                📍 {hoveredEvent.event.location}
              </div>
            )}
            
            {!hoveredEvent.event.isExternal && (
              <div className="hover-card-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                <span className={`priority-badge p-${hoveredEvent.event.priority || 0}`} style={{
                  fontSize: '0.7rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 600,
                  backgroundColor: hoveredEvent.event.priority === 3 ? 'rgba(239, 68, 68, 0.2)' :
                                   hoveredEvent.event.priority === 2 ? 'rgba(245, 158, 11, 0.2)' :
                                   hoveredEvent.event.priority === 1 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: hoveredEvent.event.priority === 3 ? '#f87171' :
                         hoveredEvent.event.priority === 2 ? '#fbbf24' :
                         hoveredEvent.event.priority === 1 ? '#60a5fa' : 'var(--text-secondary)'
                }}>
                  {hoveredEvent.event.priority === 3 ? '🔴 Urgente e Importante' :
                   hoveredEvent.event.priority === 2 ? '🟡 Importante no Urgente' :
                   hoveredEvent.event.priority === 1 ? '🔵 Urgente no Importante' : '⚪ Sin prioridad'}
                </span>
                <span className="completed-badge" style={{
                  fontSize: '0.7rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 600,
                  backgroundColor: hoveredEvent.event.isCompleted ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.15)',
                  color: hoveredEvent.event.isCompleted ? '#34d399' : '#fbbf24'
                }}>
                  {hoveredEvent.event.isCompleted ? '✅ Completada' : '⏳ Pendiente'}
                </span>
              </div>
            )}
            
            {hoveredEvent.event.description && (
              <div className="hover-card-description" style={{ 
                fontSize: '0.8rem', 
                color: 'var(--text-secondary)', 
                borderTop: '1px solid rgba(255, 255, 255, 0.08)', 
                paddingTop: '6px',
                marginTop: '4px',
                whiteSpace: 'pre-wrap',
                maxHeight: '120px',
                overflowY: 'auto'
              }}>
                {hoveredEvent.event.description}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="calendar-context-menu"
          style={{
            position: 'absolute',
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`
          }}
        >
          {/* Complete/Pending Option */}
          <div 
            className="context-menu-item" 
            onClick={async () => {
              if (contextMenu.event.isSubtask) {
                await fetch(`/api/subtasks/${contextMenu.event.itemId}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ is_completed: !contextMenu.event.isCompleted })
                });
                if (onUpdateTask) onUpdateTask(contextMenu.event.parentTaskId, {});
              } else {
                if (onUpdateTask) {
                  await onUpdateTask(contextMenu.event.itemId, { is_completed: !contextMenu.event.isCompleted });
                }
              }
              setContextMenu(null);
            }}
          >
            {contextMenu.event.isCompleted ? '⏳ Marcar como Pendiente' : '✅ Marcar como Completada'}
          </div>
          
          {/* Priority Options - only for tasks */}
          {!contextMenu.event.isSubtask && (
            <div className="context-menu-submenu-header">
              <span>🎯 Prioridad</span>
              <div className="context-menu-submenu">
                <div className="context-menu-item" onClick={() => handleUpdatePriority(3)}>🔴 Urgente e Importante</div>
                <div className="context-menu-item" onClick={() => handleUpdatePriority(2)}>🟡 Importante no Urgente</div>
                <div className="context-menu-item" onClick={() => handleUpdatePriority(1)}>🔵 Urgente no Importante</div>
                <div className="context-menu-item" onClick={() => handleUpdatePriority(0)}>⚪ Ninguna</div>
              </div>
            </div>
          )}

          {/* Move to list options - only for tasks */}
          {!contextMenu.event.isSubtask && lists.length > 0 && (
            <div className="context-menu-submenu-header">
              <span>📁 Mover a Lista</span>
              <div className="context-menu-submenu">
                {lists.map(list => (
                  <div 
                    key={list.id} 
                    className="context-menu-item"
                    onClick={() => handleMoveToList(list.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: list.color }} />
                    {list.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="context-menu-divider" />
          
          {/* Delete Option */}
          <div 
            className="context-menu-item delete-option"
            onClick={async () => {
              if (contextMenu.event.isSubtask) {
                await fetch(`/api/subtasks/${contextMenu.event.itemId}`, { method: 'DELETE' });
                if (onUpdateTask) onUpdateTask(contextMenu.event.parentTaskId, {});
              } else {
                if (onDeleteTask) await onDeleteTask(contextMenu.event.itemId);
              }
              setContextMenu(null);
            }}
          >
            🗑️ Eliminar
          </div>
        </div>
      )}

      {/* Quick Create Popover */}
      {quickCreate && (
        <div 
          className="calendar-quick-create-popover"
          style={{
            position: 'absolute',
            left: `${quickCreate.x}px`,
            top: `${quickCreate.y}px`
          }}
        >
          <div className="quick-create-header" style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px', color: 'var(--text-primary)' }}>
            Nueva Actividad
          </div>
          <div className="quick-create-time-info" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            📅 {(() => { const name = format(quickCreate.day, 'EEE d, MMMM', { locale: es }); return name.charAt(0).toUpperCase() + name.slice(1); })()} a las {quickCreate.hour === 0 ? '12:00 AM' : quickCreate.hour < 12 ? `${quickCreate.hour}:00 AM` : quickCreate.hour === 12 ? '12:00 PM' : `${quickCreate.hour - 12}:00 PM`}
          </div>
          <div className="quick-create-field" style={{ marginBottom: '8px' }}>
            <input 
              type="text" 
              placeholder="Título de la tarea..." 
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleQuickCreateSave();
                if (e.key === 'Escape') setQuickCreate(null);
              }}
              autoFocus
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '6px 8px',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div className="quick-create-row" style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            <select 
              value={quickListId} 
              onChange={(e) => setQuickListId(e.target.value)}
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '4px 6px',
                color: 'var(--text-primary)',
                fontSize: '0.75rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {lists.map(list => (
                <option key={list.id} value={list.id} style={{ background: '#1c1917' }}>{list.name}</option>
              ))}
            </select>
            <select 
              value={quickPriority} 
              onChange={(e) => setQuickPriority(e.target.value)}
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '4px 6px',
                color: 'var(--text-primary)',
                fontSize: '0.75rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="3" style={{ background: '#1c1917' }}>🔴 Urgente</option>
              <option value="2" style={{ background: '#1c1917' }}>🟡 Importante</option>
              <option value="1" style={{ background: '#1c1917' }}>🔵 Delegar</option>
              <option value="0" style={{ background: '#1c1917' }}>⚪ Ninguna</option>
            </select>
          </div>
          <div className="quick-create-field" style={{ marginBottom: '10px' }}>
            <select 
              value={quickRecurrence} 
              onChange={(e) => setQuickRecurrence(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '4px 6px',
                color: 'var(--text-primary)',
                fontSize: '0.75rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="none" style={{ background: '#1c1917' }}>🔄 No repetir</option>
              <option value="daily" style={{ background: '#1c1917' }}>📅 Diariamente</option>
              <option value="weekly" style={{ background: '#1c1917' }}>🗓️ Semanalmente</option>
              <option value="monthly" style={{ background: '#1c1917' }}>📆 Mensualmente</option>
              <option value="weekdays" style={{ background: '#1c1917' }}>💼 Lunes a Viernes</option>
            </select>
          </div>
          <div className="quick-create-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
            <button 
              className="btn-cancel" 
              onClick={() => setQuickCreate(null)}
              style={{
                background: 'transparent',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                padding: '4px 10px',
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button 
              className="btn-save" 
              onClick={handleQuickCreateSave} 
              disabled={!quickTitle.trim()}
              style={{
                background: quickTitle.trim() ? 'var(--accent-color)' : 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                borderRadius: '6px',
                color: '#ffffff',
                padding: '4px 12px',
                fontSize: '0.75rem',
                cursor: quickTitle.trim() ? 'pointer' : 'not-allowed',
                fontWeight: 600
              }}
            >
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
