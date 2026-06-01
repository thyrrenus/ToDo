import { useState, useEffect } from 'react';
import { startOfWeek, addDays, format, isSameDay, parseISO, getHours, getMinutes, differenceInMinutes, startOfToday } from 'date-fns';

export function CalendarView({ tasks, lists, externalEvents = [], onSelectTask, onSelectEvent, onUpdateEvent }) {
  const [viewMode, setViewMode] = useState('week'); // 'day' or 'week'
  const [currentDate, setCurrentDate] = useState(startOfToday());
  const [interactionState, setInteractionState] = useState(null);

  const getListColor = (listId) => {
    if (!listId) return '#5b21b6'; // Default color
    const list = lists.find(l => l.id === listId);
    return list?.color || '#5b21b6';
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const days = viewMode === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) : [currentDate];

  const PIXELS_PER_HOUR = 60; // 60px per hour

  // Filter tasks that have start and end times
  const scheduledTasks = tasks.filter(t => t.start_time && t.end_time).map(t => ({
    id: `task-${t.id}`,
    itemId: t.id,
    isSubtask: false,
    title: t.title,
    start_time: t.start_time,
    end_time: t.end_time,
    list_id: t.list_id
  }));

  // Extract scheduled subtasks from all tasks
  const scheduledSubtasks = [];
  tasks.forEach(t => {
    if (t.subtasks && Array.isArray(t.subtasks)) {
      t.subtasks.forEach(st => {
        if (st.start_time && st.end_time) {
          scheduledSubtasks.push({
            id: `sub-${st.id}`,
            itemId: st.id,
            isSubtask: true,
            title: `${t.title} > ${st.title}`, // Breadcrumb formatting for clear visualization
            start_time: st.start_time,
            end_time: st.end_time,
            list_id: t.list_id // Inherit list color from parent
          });
        }
      });
    }
  });

  // Map external events to the scheduled calendar format
  const mappedExternalEvents = externalEvents.map(e => ({
    id: `ext-${e.uid}`,
    itemId: e.uid,
    isSubtask: false,
    isExternal: true,
    title: e.title,
    start_time: e.start_time,
    end_time: e.end_time,
    description: e.description,
    location: e.location
  }));

  const scheduledEvents = [...scheduledTasks, ...scheduledSubtasks, ...mappedExternalEvents];

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
    const eventStart = parseISO(eventItem.start_time);
    const dayIndex = days.findIndex(d => isSameDay(d, eventStart));

    // Get grid bounding rect
    const gridRect = gridEl.getBoundingClientRect();
    const colWidth = gridRect.width / days.length;

    // Initial position properties
    const initialTop = (getHours(eventStart) + getMinutes(eventStart) / 60) * PIXELS_PER_HOUR;
    const durationMinutes = differenceInMinutes(parseISO(eventItem.end_time), eventStart);
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
    <div className="calendar-view">
      <div className="calendar-header">
        <h2>{format(currentDate, 'MMMM yyyy')}</h2>
        <div className="calendar-controls">
          <button onClick={() => setCurrentDate(addDays(currentDate, viewMode === 'week' ? -7 : -1))}>&lt;</button>
          <button onClick={() => setCurrentDate(startOfToday())}>Today</button>
          <button onClick={() => setCurrentDate(addDays(currentDate, viewMode === 'week' ? 7 : 1))}>&gt;</button>
          
          <select value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
            <option value="day">Day</option>
            <option value="week">Week</option>
          </select>
        </div>
      </div>

      <div className="calendar-grid-container">
        {/* Days Header */}
        <div className="calendar-days-header" style={{ paddingLeft: '60px' }}>
          {days.map(day => (
            <div key={day.toString()} className="calendar-day-label">
              <div className="day-name">{format(day, 'EEE')}</div>
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
                  {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
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
                  return isSameDay(parseISO(e.start_time), day);
                });
                
                return (
                  <div key={day.toString()} className="day-column">
                    {/* Grid lines */}
                    {hours.map(hour => (
                      <div key={hour} className="grid-cell" style={{ height: `${PIXELS_PER_HOUR}px` }} />
                    ))}

                    {/* Event Blocks */}
                    {dayEvents.map(event => {
                      const isInteracting = interactionState && interactionState.event.id === event.id;
                      
                      const start = parseISO(event.start_time);
                      const end = parseISO(event.end_time);
                      
                      let top = (getHours(start) + getMinutes(start) / 60) * PIXELS_PER_HOUR;
                      let durationMinutes = differenceInMinutes(end, start);
                      let height = Math.max((durationMinutes / 60) * PIXELS_PER_HOUR, 24);

                      if (isInteracting) {
                        top = interactionState.currentTop;
                        height = interactionState.currentHeight;
                      }

                      const startTimeStr = format(start, 'h:mm a');
                      const endTimeStr = format(end, 'h:mm a');

                      return (
                        <div 
                          key={event.id} 
                          className={`task-block ${event.isSubtask ? 'subtask-event-block' : ''} ${event.isExternal ? 'external-event-block' : ''} ${isInteracting ? 'dragging' : ''}`}
                          style={{
                            top: `${top}px`,
                            height: `${height}px`,
                            backgroundColor: event.isExternal ? 'rgba(0, 120, 212, 0.12)' : getListColor(event.list_id),
                            color: event.isExternal ? 'var(--text-primary)' : '#ffffff',
                            position: 'absolute',
                            left: '4px',
                            right: '4px',
                            cursor: event.isExternal ? 'pointer' : 'move',
                            userSelect: 'none',
                            zIndex: isInteracting ? 100 : 1,
                            transition: isInteracting ? 'none' : 'top 0.15s, height 0.15s, left 0.15s, right 0.15s',
                            boxShadow: event.isExternal ? '0 4px 12px rgba(0, 120, 212, 0.15)' : 'none',
                            border: event.isExternal ? '1px solid rgba(0, 120, 212, 0.3)' : 'none',
                            borderLeft: event.isExternal ? '4px solid #0078d4' : 'none',
                            backdropFilter: event.isExternal ? 'blur(4px)' : 'none',
                            borderRadius: '6px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            padding: '6px 8px',
                            boxSizing: 'border-box'
                          }}
                          onMouseDown={(e) => !event.isExternal && handleMouseDown(e, event, 'drag')}
                          title={event.isExternal ? `${event.title}${event.location ? `\n📍 Ubicación: ${event.location}` : ''}${event.description ? `\n📝 Notas: ${event.description}` : ''}` : undefined}
                        >
                          <div className="task-block-title" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            {event.isSubtask && <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', opacity: 0.7, marginRight: '4px' }}>[Sub]</span>}
                            {event.isExternal && <span style={{ fontSize: '0.65rem', background: '#0078d4', color: '#ffffff', padding: '1px 5px', borderRadius: '3px', fontWeight: 800 }}>Outlook</span>}
                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: event.isExternal ? 600 : 'normal' }}>{event.title}</span>
                          </div>
                          <div className="task-block-time" style={{ fontSize: '0.65rem', opacity: 0.8, color: event.isExternal ? 'var(--text-secondary)' : '#ffffff' }}>
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
    </div>
  );
}
