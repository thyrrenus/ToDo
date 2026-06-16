import { useState, useEffect, useRef } from 'react';
import { startOfWeek, addDays, format, isSameDay, parseISO, getHours, getMinutes, differenceInMinutes, startOfToday, addMonths, startOfMonth, endOfMonth, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { adjustExternalDate } from '../utils/timezone';
import { useTodo } from '../context/TodoContext';
import { Sparkles, AlertTriangle, Check, X, Info, Plus } from 'lucide-react';

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
  const [viewMode, setViewMode] = useState('week'); // 'day', 'week', or 'month'
  const [currentDate, setCurrentDate] = useState(startOfToday());
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [mobileSelectedDay, setMobileSelectedDay] = useState(startOfToday());

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [showAIRescheduleModal, setShowAIRescheduleModal] = useState(false);
  const [rescheduleProposal, setRescheduleProposal] = useState([]);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [includeWeekends, setIncludeWeekends] = useState(false);
  const [interactionState, setInteractionState] = useState(null);
  const [dragCreateState, setDragCreateState] = useState(null);
  const [dragOverDay, setDragOverDay] = useState(null);
  const [draggingEventId, setDraggingEventId] = useState(null);
  const justDraggedRef = useRef(false);
  const dragCreateRef = useRef(null);

  const getMonthDays = (date) => {
    const monthStart = startOfMonth(date);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const daysArr = [];
    let d = new Date(startDate);
    for (let i = 0; i < 42; i++) {
      daysArr.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return daysArr;
  };

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
  const days = viewMode === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) : viewMode === 'day' ? [currentDate] : getMonthDays(currentDate);

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
    if (justDraggedRef.current) return;
    if (e.target.classList.contains('grid-cell')) {
      const container = document.querySelector('.calendar-view');
      if (container) {
        const rect = container.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;

        const popWidth = 280;
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

  // Drag-to-Create handler inside daily/weekly columns
  const handleColumnMouseDown = (e, day) => {
    if (isMobile) return; // Disable drag-to-create on mobile
    if (e.button !== 0) return; // Only left click

    // Only start drag if clicking directly on a grid cell or column background
    if (!e.target.classList.contains('grid-cell') && !e.target.classList.contains('day-column')) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;

    // Snap to 15-minute intervals (15px)
    const snapHeight = 15;
    const initialSnappedY = Math.round(clickY / snapHeight) * snapHeight;

    const dragData = {
      day,
      startY: initialSnappedY,
      currentY: initialSnappedY,
      columnRect: rect
    };

    dragCreateRef.current = dragData;
    setDragCreateState(dragData);

    setContextMenu(null);
    setQuickCreate(null);
  };

  // Window mouse movement listener for drag-create
  useEffect(() => {
    if (!dragCreateState) return;

    const handleMouseMove = (e) => {
      if (!dragCreateRef.current) return;
      const currentYRaw = e.clientY - dragCreateRef.current.columnRect.top;
      const snapHeight = 15;
      const snappedY = Math.max(
        0,
        Math.min(
          Math.round(currentYRaw / snapHeight) * snapHeight,
          24 * PIXELS_PER_HOUR
        )
      );

      dragCreateRef.current.currentY = snappedY;
      setDragCreateState({ ...dragCreateRef.current });
    };

    const handleMouseUp = (e) => {
      const dragData = dragCreateRef.current;
      if (dragData) {
        const startY = Math.min(dragData.startY, dragData.currentY);
        const endY = Math.max(dragData.startY, dragData.currentY);
        const dragDuration = endY - startY;

        if (dragDuration >= 15) {
          const startTotalMinutes = startY;
          const startHour = Math.floor(startTotalMinutes / 60);
          const startMin = Math.round(startTotalMinutes % 60);

          const endTotalMinutes = endY;
          const endHour = Math.floor(endTotalMinutes / 60);
          const endMin = Math.round(endTotalMinutes % 60);

          const container = document.querySelector('.calendar-view');
          if (container) {
            const containerRect = container.getBoundingClientRect();
            let x = e.clientX - containerRect.left;
            let y = e.clientY - containerRect.top;

            const popWidth = 280;
            const popHeight = 180;
            if (x + popWidth > containerRect.width) {
              x = x - popWidth;
            }
            if (y + popHeight > containerRect.height) {
              y = y - popHeight;
            }

            setQuickCreate({
              day: dragData.day,
              hour: startHour,
              startHour,
              startMin,
              endHour,
              endMin,
              x,
              y
            });
            setQuickTitle('');
            setQuickListId(lists[0]?.id || '');
            setQuickPriority('0');
            setQuickRecurrence('none');

            // Set temporary flag to ignore subsequent click event on the cell
            justDraggedRef.current = true;
            setTimeout(() => {
              justDraggedRef.current = false;
            }, 50);
          }
        }
      }

      dragCreateRef.current = null;
      setDragCreateState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [!!dragCreateState, lists]);

  // Month View cell click handler
  const handleMonthCellClick = (e, day) => {
    setMobileSelectedDay(day);
    if (isMobile && !e.target.closest('.month-cell-add-btn')) {
      return;
    }
    if (e.target.closest('.month-event-item')) return;

    const container = document.querySelector('.calendar-view');
    if (container) {
      const rect = container.getBoundingClientRect();
      let x = e.clientX - rect.left;
      let y = e.clientY - rect.top;

      const popWidth = 280;
      const popHeight = 180;
      if (x + popWidth > rect.width) {
        x = x - popWidth;
      }
      if (y + popHeight > rect.height) {
        y = y - popHeight;
      }

      setQuickCreate({
        day,
        hour: 9, // Default to 9 AM
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
  };

  // Month View event click handler
  const handleMonthEventClick = (e, eventItem) => {
    e.stopPropagation();
    if (onSelectEvent) {
      onSelectEvent(eventItem.itemId, eventItem.isSubtask);
    } else if (onSelectTask) {
      onSelectTask(eventItem.itemId);
    }
  };

  const handleQuickCreateSave = async () => {
    if (!quickTitle.trim()) return;

    const startHour = quickCreate.startHour !== undefined ? quickCreate.startHour : quickCreate.hour;
    const startMin = quickCreate.startMin !== undefined ? quickCreate.startMin : 0;
    const endHour = quickCreate.endHour !== undefined ? quickCreate.endHour : (startHour + 1);
    const endMin = quickCreate.endMin !== undefined ? quickCreate.endMin : 0;

    const start = new Date(quickCreate.day);
    start.setHours(startHour, startMin, 0, 0);

    const end = new Date(quickCreate.day);
    end.setHours(endHour, endMin, 0, 0);

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

  // Month View drag and drop handlers
  const handleMonthDragStart = (e, eventItem) => {
    if (eventItem.isExternal) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', eventItem.itemId.toString());
    e.dataTransfer.setData('isSubtask', eventItem.isSubtask ? 'true' : 'false');
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleMonthDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleMonthDrop = async (e, targetDay) => {
    e.preventDefault();
    const itemIdStr = e.dataTransfer.getData('text/plain');
    const isSubtaskStr = e.dataTransfer.getData('isSubtask');
    if (!itemIdStr) return;

    const itemId = parseInt(itemIdStr, 10);
    const isSubtask = isSubtaskStr === 'true';

    // Find the original event to get the original start/end difference (duration)
    const eventItem = scheduledEvents.find(ev => ev.itemId === itemId && ev.isSubtask === isSubtask);
    if (!eventItem) return;

    const originalStart = eventItem.start;
    const originalEnd = eventItem.end;
    const durationMs = originalEnd.getTime() - originalStart.getTime();

    // Set new start time keeping the hours and minutes of originalStart
    const newStart = new Date(targetDay);
    newStart.setHours(originalStart.getHours(), originalStart.getMinutes(), originalStart.getSeconds(), originalStart.getMilliseconds());

    // Set new end time adding the duration
    const newEnd = new Date(newStart.getTime() + durationMs);

    const pad = (num) => String(num).padStart(2, '0');
    const startTimeStr = `${newStart.getFullYear()}-${pad(newStart.getMonth() + 1)}-${pad(newStart.getDate())}T${pad(newStart.getHours())}:${pad(newStart.getMinutes())}`;
    const endTimeStr = `${newEnd.getFullYear()}-${pad(newEnd.getMonth() + 1)}-${pad(newEnd.getDate())}T${pad(newEnd.getHours())}:${pad(newEnd.getMinutes())}`;

    if (onUpdateEvent) {
      await onUpdateEvent(itemId, isSubtask, startTimeStr, endTimeStr);
    }
  };

  // Mouse drag & resize handlers
  const handleMouseDown = (e, eventItem, actionType) => {
    if (isMobile) return;
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

  const calculateAIReschedule = () => {
    setRescheduleLoading(true);
    
    // 1. Get all uncompleted tasks
    const pendingTasks = (tasks || []).filter(t => !t.is_completed);

    // 2. Parse deadlines and effort
    const tasksWithUrgency = pendingTasks.map(t => {
      const priorityWeight = (t.priority || 0) + 1; // 1 to 4
      const effort = t.estimated_effort || 1.0; // default 1h effort if not set
      
      let daysToDeadline = 30; // default 30 days
      if (t.deadline_date) {
        try {
          const deadlineDateObj = parseISO(t.deadline_date);
          const diffMs = deadlineDateObj.getTime() - startOfToday().getTime();
          daysToDeadline = Math.max(0.1, diffMs / (1000 * 60 * 60 * 24));
        } catch (e) {}
      }

      const effortInDays = effort / 8;
      const timeLeftFactor = Math.max(0.05, daysToDeadline - effortInDays);
      const urgencyScore = (priorityWeight * 10) / timeLeftFactor;

      return {
        ...t,
        urgencyScore,
        effortHours: effort,
      };
    });

    // Sort by urgency score descending
    tasksWithUrgency.sort((a, b) => b.urgencyScore - a.urgencyScore);

    // 3. Schedule slots sequentially starting from today at 9:00 AM
    let currentSlotStart = new Date();
    if (currentSlotStart.getHours() < 9) {
      currentSlotStart.setHours(9, 0, 0, 0);
    } else if (currentSlotStart.getHours() >= 18) {
      currentSlotStart = addDays(currentSlotStart, 1);
      currentSlotStart.setHours(9, 0, 0, 0);
    } else {
      const mins = currentSlotStart.getMinutes();
      if (mins < 30) {
        currentSlotStart.setMinutes(30, 0, 0);
      } else {
        currentSlotStart.setHours(currentSlotStart.getHours() + 1, 0, 0, 0);
        if (currentSlotStart.getHours() >= 18) {
          currentSlotStart = addDays(currentSlotStart, 1);
          currentSlotStart.setHours(9, 0, 0, 0);
        }
      }
    }

    const isOverlappingWithExternalEvents = (start, end) => {
      return (externalEvents || []).some(event => {
        try {
          const eventStart = parseISO(event.start_time);
          const eventEnd = parseISO(event.end_time);
          return (start < eventEnd && end > eventStart);
        } catch (e) {
          return false;
        }
      });
    };

    const getNextWorkingSlot = (startTimeDate, durationHours) => {
      let start = new Date(startTimeDate);
      let durationMinutes = Math.round(durationHours * 60);

      while (durationMinutes > 0) {
        if (!includeWeekends && (start.getDay() === 0 || start.getDay() === 6)) {
          start = addDays(start, start.getDay() === 6 ? 2 : 1);
          start.setHours(9, 0, 0, 0);
          continue;
        }

        if (start.getHours() >= 18 || (start.getHours() === 17 && start.getMinutes() > 0 && (18 * 60 - (start.getHours() * 60 + start.getMinutes())) < 0)) {
          start = addDays(start, 1);
          start.setHours(9, 0, 0, 0);
          continue;
        }
        if (start.getHours() < 9) {
          start.setHours(9, 0, 0, 0);
        }

        const dayEnd = new Date(start);
        dayEnd.setHours(18, 0, 0, 0);
        const minutesLeftToday = Math.round((dayEnd.getTime() - start.getTime()) / (1000 * 60));

        const chunkMinutes = Math.min(durationMinutes, minutesLeftToday);
        const end = new Date(start.getTime() + chunkMinutes * 60 * 1000);

        if (isOverlappingWithExternalEvents(start, end)) {
          let maxEventEnd = new Date(start.getTime() + 15 * 60 * 1000);
          (externalEvents || []).forEach(event => {
            try {
              const eventStart = parseISO(event.start_time);
              const eventEnd = parseISO(event.end_time);
              if (start < eventEnd && end > eventStart) {
                if (eventEnd > maxEventEnd) {
                  maxEventEnd = eventEnd;
                }
              }
            } catch (e) {}
          });
          start = new Date(maxEventEnd);
          const mins = start.getMinutes();
          const remainder = mins % 15;
          if (remainder > 0) {
            start.setMinutes(mins + (15 - remainder), 0, 0);
          }
          continue;
        }

        durationMinutes -= chunkMinutes;
        if (durationMinutes > 0) {
          start = end;
        } else {
          return { start: new Date(end.getTime() - Math.round(durationHours * 60) * 60 * 1000), end: end };
        }
      }
      return { start: startTimeDate, end: new Date(startTimeDate.getTime() + durationHours * 3600 * 1000) };
    };

    const proposal = [];
    let currentPointer = new Date(currentSlotStart);

    tasksWithUrgency.forEach(task => {
      const effort = task.effortHours;
      const scheduledRange = getNextWorkingSlot(currentPointer, effort);
      
      const proposedStart = format(scheduledRange.start, 'yyyy-MM-dd HH:mm:ss');
      const proposedEnd = format(scheduledRange.end, 'yyyy-MM-dd HH:mm:ss');
      const proposedDueDate = format(scheduledRange.start, 'yyyy-MM-dd');

      currentPointer = new Date(scheduledRange.end);

      let status = 'En fecha';
      if (task.deadline_date) {
        try {
          const deadlineDateObj = parseISO(task.deadline_date);
          const deadlineEndDay = new Date(deadlineDateObj);
          deadlineEndDay.setHours(23, 59, 59, 999);
          if (scheduledRange.end > deadlineEndDay) {
            status = 'Conflicto';
          } else {
            const diffHours = (deadlineEndDay.getTime() - scheduledRange.end.getTime()) / (1000 * 60 * 60);
            if (diffHours <= 24) {
              status = 'Urgente';
            }
          }
        } catch (e) {}
      }

      proposal.push({
        taskId: task.id,
        title: task.title,
        priority: task.priority,
        deadlineDate: task.deadline_date,
        effortHours: effort,
        oldDueDate: task.due_date,
        oldStartTime: task.start_time,
        oldEndTime: task.end_time,
        newDueDate: proposedDueDate,
        newStartTime: proposedStart,
        newEndTime: proposedEnd,
        status,
      });
    });

    setRescheduleProposal(proposal);
    setRescheduleLoading(false);
  };

  const handleOpenAIRescheduleModal = () => {
    setShowAIRescheduleModal(true);
    setTimeout(() => {
      calculateAIReschedule();
    }, 0);
  };

  const handleApplyAIReschedule = async () => {
    setRescheduleLoading(true);
    try {
      const updates = rescheduleProposal
        .filter(item => item.newDueDate !== item.oldDueDate || item.newStartTime !== item.oldStartTime || item.newEndTime !== item.oldEndTime)
        .map(item => onUpdateTask(item.taskId, {
          due_date: item.newDueDate,
          start_time: item.newStartTime,
          end_time: item.newEndTime
        }));
      await Promise.all(updates);
      setShowAIRescheduleModal(false);
    } catch (err) {
      console.error("Error applying AI reschedule:", err);
    } finally {
      setRescheduleLoading(false);
    }
  };

  const renderAIRescheduleModal = () => {
    return (
      <div className="ai-modal-overlay" style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease'
      }}>
        <div className="ai-modal-container" style={{
          background: 'var(--right-pane-bg, #18181c)',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '640px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.8)',
          overflow: 'hidden',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from { transform: translateY(20px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
            .ai-loading-spinner {
              width: 24px;
              height: 24px;
              border: 3px solid rgba(255,255,255,0.1);
              border-radius: 50%;
              border-top-color: var(--accent-hover);
              animation: ai-spin 1s ease-in-out infinite;
            }
            @keyframes ai-spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
          
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={20} color="var(--accent-hover)" />
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Optimizar Agenda con IA
              </h3>
            </div>
            <button
              onClick={() => setShowAIRescheduleModal(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{
            padding: '20px 24px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <p style={{
              margin: 0,
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5
            }}>
              El motor de priorización calculará el factor de urgencia de cada tarea pendiente usando su **Prioridad Eisenhower** y **Fecha Límite Fatal**. Las tareas se agendarán secuencialmente dentro de las horas laborables (9 AM - 6 PM) evitando solaparse con tus eventos fijos de calendario.
            </p>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.04)',
              borderRadius: '10px',
              padding: '10px 14px'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Planificar en Fines de Semana</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Incluir Sábados y Domingos en el rango disponible</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={includeWeekends}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIncludeWeekends(checked);
                    // Force re-calculation on change
                    setTimeout(() => {
                      setRescheduleLoading(true);
                    }, 0);
                  }}
                />
                <span className="slider round"></span>
              </label>
            </div>

            {rescheduleLoading ? (
              <div style={{
                padding: '40px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                color: 'var(--text-secondary)'
              }}>
                <div className="ai-loading-spinner" />
                <span style={{ fontSize: '0.85rem' }}>Calculando plan de agenda óptima...</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Propuesta de Agenda ({rescheduleProposal.length} tareas)
                </span>

                {rescheduleProposal.length === 0 ? (
                  <div style={{
                    padding: '24px',
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '8px',
                    border: '1px dashed rgba(255,255,255,0.06)',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)'
                  }}>
                    No hay tareas pendientes para agendar.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                    {rescheduleProposal.map(item => {
                      const startD = parseISO(item.newStartTime);
                      const endD = parseISO(item.newEndTime);
                      
                      let statusBg = 'rgba(16, 185, 129, 0.1)';
                      let statusBorder = 'rgba(16, 185, 129, 0.2)';
                      let statusColor = '#10b981';
                      if (item.status === 'Urgente') {
                        statusBg = 'rgba(245, 158, 11, 0.1)';
                        statusBorder = 'rgba(245, 158, 11, 0.2)';
                        statusColor = '#f59e0b';
                      } else if (item.status === 'Conflicto') {
                        statusBg = 'rgba(239, 68, 68, 0.1)';
                        statusBorder = 'rgba(239, 68, 68, 0.2)';
                        statusColor = '#ef4444';
                      }

                      const hasChanged = item.newDueDate !== item.oldDueDate || item.newStartTime !== item.oldStartTime || item.newEndTime !== item.oldEndTime;

                      return (
                        <div key={item.taskId} style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: hasChanged ? '1px solid rgba(124, 58, 237, 0.2)' : '1px solid rgba(255, 255, 255, 0.05)',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px'
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                              <span style={{
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }} title={item.title}>
                                {item.title}
                              </span>
                              {item.effortHours > 0 && (
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: '4px' }}>
                                  ⏱️ {item.effortHours}h
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                              <span>🗓️ {format(startD, "eee d MMM, HH:mm", { locale: es })}</span>
                              <span>-</span>
                              <span>{format(endD, "HH:mm")}</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                            <span style={{
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '2px 6px',
                              borderRadius: '20px',
                              background: statusBg,
                              border: `1px solid ${statusBorder}`,
                              color: statusColor
                            }}>
                              {item.status}
                            </span>
                            {item.deadlineDate && (
                              <span style={{ fontSize: '0.65rem', color: 'rgba(239, 68, 68, 0.8)' }}>
                                Límite: {format(parseISO(item.deadlineDate), 'd MMM')}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            background: 'rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Conflictos: <strong style={{ color: rescheduleProposal.some(p => p.status === 'Conflicto') ? '#ef4444' : 'var(--text-primary)' }}>
                  {rescheduleProposal.filter(p => p.status === 'Conflicto').length}
                </strong>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowAIRescheduleModal(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleApplyAIReschedule}
                disabled={rescheduleProposal.length === 0 || rescheduleLoading}
                style={{
                  background: 'var(--accent-hover)',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Check size={14} />
                Aplicar Plan
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  const todayTasks = (tasks || []).filter(t => {
    const isDueToday = t.due_date && t.due_date.startsWith(todayStr);
    const hasTodayStart = t.start_time && isSameDay(parseDate(t.start_time), startOfToday());
    return isDueToday || hasTodayStart;
  });

  const tomorrowTasks = (tasks || []).filter(t => {
    const isDueTomorrow = t.due_date && t.due_date.startsWith(tomorrowStr);
    const hasTomorrowStart = t.start_time && isSameDay(parseDate(t.start_time), addDays(startOfToday(), 1));
    return isDueTomorrow || hasTomorrowStart;
  });

  const todayEvents = scheduledEvents.filter(e => isSameDay(e.start, startOfToday()));
  const sortedTodayEvents = [...todayEvents].sort((a, b) => a.start.getTime() - b.start.getTime());

  const renderDailyAgendaSidebar = () => {
    if (isMobile) return null;
    return (
      <div className="calendar-schedule-sidebar">
        {/* Hoy Section */}
        <div className="sidebar-agenda-section">
          <h3 className="agenda-section-title">Hoy</h3>
          <div className="agenda-items-list">
            {todayTasks.length === 0 ? (
              <div className="agenda-empty-msg">No hay tareas para hoy</div>
            ) : (
              todayTasks.map(t => {
                const color = getListColor(t.list_id);
                return (
                  <div 
                    key={t.id} 
                    className={`agenda-task-item ${t.is_completed ? 'completed' : ''}`}
                    onClick={() => onSelectTask(t.id)}
                  >
                    <div 
                      className={`checkbox priority-${t.priority || 0}`}
                      onClick={async (e) => {
                        e.stopPropagation();
                        await onUpdateTask(t.id, { is_completed: !t.is_completed });
                      }}
                    >
                      {t.is_completed && <Check size={12} color="#0f1115" />}
                    </div>
                    <span className="agenda-item-title" style={{ borderLeft: `3px solid ${color}`, paddingLeft: '8px' }}>
                      {t.title}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Scheduled Events Section */}
        <div className="sidebar-agenda-section">
          <h3 className="agenda-section-title">Programado</h3>
          <div className="agenda-items-list">
            {sortedTodayEvents.length === 0 ? (
              <div className="agenda-empty-msg">Sin eventos hoy</div>
            ) : (
              sortedTodayEvents.map(e => {
                const color = e.isExternal ? '#0078d4' : getListColor(e.list_id);
                const timeStr = `${format(e.start, 'HH:mm')} - ${format(e.end, 'HH:mm')}`;
                return (
                  <div 
                    key={e.id} 
                    className={`agenda-event-item ${e.isCompleted ? 'completed' : ''}`}
                    onClick={() => {
                      if (e.isExternal) {
                        if (onSelectEvent) onSelectEvent(e.itemId, false);
                      } else {
                        if (e.isSubtask) {
                          setSelectedTaskId(e.parentTaskId);
                          setSelectedSubtaskId(e.itemId);
                        } else {
                          onSelectTask(e.itemId);
                        }
                      }
                    }}
                    style={{ borderLeft: `3px solid ${color}` }}
                  >
                    <div className="agenda-event-time">{timeStr}</div>
                    <div className="agenda-event-title">{e.title}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Tomorrow Section */}
        <div className="sidebar-agenda-section">
          <h3 className="agenda-section-title">Mañana</h3>
          <div className="agenda-items-list">
            {tomorrowTasks.length === 0 ? (
              <div className="agenda-empty-msg">No hay tareas para mañana</div>
            ) : (
              tomorrowTasks.map(t => {
                const color = getListColor(t.list_id);
                return (
                  <div 
                    key={t.id} 
                    className={`agenda-task-item ${t.is_completed ? 'completed' : ''}`}
                    onClick={() => onSelectTask(t.id)}
                  >
                    <div 
                      className={`checkbox priority-${t.priority || 0}`}
                      onClick={async (e) => {
                        e.stopPropagation();
                        await onUpdateTask(t.id, { is_completed: !t.is_completed });
                      }}
                    >
                      {t.is_completed && <Check size={12} color="#0f1115" />}
                    </div>
                    <span className="agenda-item-title" style={{ borderLeft: `3px solid ${color}`, paddingLeft: '8px' }}>
                      {t.title}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (showAIRescheduleModal) {
      calculateAIReschedule();
    }
  }, [includeWeekends]);

  return (
    <div className="calendar-view" style={{ position: 'relative' }}>
      <div className="calendar-header">
        <h2>{(() => { const f = format(currentDate, 'MMMM yyyy', { locale: es }); return f.charAt(0).toUpperCase() + f.slice(1); })()}</h2>
        <div className="calendar-controls">
          <button onClick={() => {
            if (viewMode === 'month') {
              setCurrentDate(addMonths(currentDate, -1));
            } else {
              setCurrentDate(addDays(currentDate, viewMode === 'week' ? -7 : -1));
            }
          }}>&lt;</button>
          <button onClick={() => setCurrentDate(startOfToday())}>Hoy</button>
          <button onClick={() => {
            if (viewMode === 'month') {
              setCurrentDate(addMonths(currentDate, 1));
            } else {
              setCurrentDate(addDays(currentDate, viewMode === 'week' ? 7 : 1));
            }
          }}>&gt;</button>

          <button
            onClick={handleOpenAIRescheduleModal}
            style={{
              background: 'rgba(124, 58, 237, 0.1)',
              border: '1px solid rgba(124, 58, 237, 0.3)',
              color: 'var(--accent-hover)',
              borderRadius: '8px',
              padding: '6px 12px',
              fontWeight: 600,
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
              fontFamily: 'inherit'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(124, 58, 237, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.5)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(124, 58, 237, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.3)';
            }}
          >
            <Sparkles size={13} />
            Optimizar Agenda
          </button>
          
          <select value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
            <option value="day" style={{ background: '#1c1c1c' }}>Día</option>
            <option value="week" style={{ background: '#1c1c1c' }}>Semana</option>
            <option value="month" style={{ background: '#1c1c1c' }}>Mes</option>
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

      <div className="calendar-body-layout">
        {renderDailyAgendaSidebar()}
        <div className="calendar-main-area">
          <div className="calendar-grid-container">
        {viewMode === 'month' ? (
          <>
            {/* Month Grid Header */}
            <div className="calendar-month-days-header">
              {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(dName => (
                <div key={dName} className="month-day-header-label">{dName}</div>
              ))}
            </div>

            {/* Scrollable Month Grid */}
            <div className="calendar-month-grid-scroll">
              <div className="calendar-month-grid">
                {days.map((day, idx) => {
                  const isToday = isSameDay(day, startOfToday());
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  
                  // Get all events scheduled for this day
                  const dayEvents = scheduledEvents.filter(e => isSameDay(e.start, day));

                  return (
                    <div 
                      key={day.toString()} 
                      className={`month-grid-cell ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${dragOverDay && isSameDay(dragOverDay, day) ? 'drag-over' : ''}`}
                      onClick={(e) => handleMonthCellClick(e, day)}
                      onDragOver={handleMonthDragOver}
                      onDragEnter={() => setDragOverDay(day)}
                      onDragLeave={() => {
                        setDragOverDay(prev => prev && isSameDay(prev, day) ? null : prev);
                      }}
                      onDrop={(e) => {
                        setDragOverDay(null);
                        handleMonthDrop(e, day);
                      }}
                    >
                      <div className="month-day-number-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <button 
                          className="month-cell-add-btn" 
                          onClick={(e) => { e.stopPropagation(); handleMonthCellClick(e, day); }}
                          title="Agregar tarea"
                        >
                          <Plus size={13} />
                        </button>
                        <span className={`month-day-number ${isToday ? 'today-badge' : ''}`}>{format(day, 'd')}</span>
                      </div>
                      {isMobile ? (
                        <div className="month-event-dots-container">
                          {dayEvents.map(event => {
                            const color = event.isExternal ? '#0078d4' : getListColor(event.list_id);
                            return (
                              <span 
                                key={event.id} 
                                className="month-event-dot" 
                                style={{ backgroundColor: color }}
                              />
                            );
                          })}
                        </div>
                      ) : (
                        <div className="month-events-list">
                          {dayEvents.map(event => {
                            const isCompleted = event.isCompleted;
                            const color = event.isExternal ? '#0078d4' : getListColor(event.list_id);
                            const isDragging = draggingEventId === event.id;
                            return (
                              <div 
                                key={event.id} 
                                className={`month-event-item ${isCompleted ? 'completed' : ''} ${isDragging ? 'dragging' : ''}`}
                                draggable={!event.isExternal}
                                onDragStart={(e) => {
                                  handleMonthDragStart(e, event);
                                  setDraggingEventId(event.id);
                                }}
                                onDragEnd={() => setDraggingEventId(null)}
                                onClick={(e) => handleMonthEventClick(e, event)}
                                onContextMenu={(e) => handleContextMenu(e, event)}
                                onMouseEnter={(e) => handleMouseEnter(e, event)}
                                onMouseLeave={handleMouseLeave}
                                style={{ borderLeft: `3px solid ${color}` }}
                              >
                                <span className="month-event-title">{event.title}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {isMobile && (
              <div className="mobile-day-events-panel">
                <div className="mobile-day-events-title">
                  Eventos de {format(mobileSelectedDay, "d 'de' MMMM", { locale: es })}
                </div>
                {scheduledEvents.filter(e => isSameDay(e.start, mobileSelectedDay)).length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '8px 4px', fontStyle: 'italic' }}>
                    No hay eventos programados
                  </div>
                ) : (
                  scheduledEvents.filter(e => isSameDay(e.start, mobileSelectedDay)).map(event => {
                    const color = event.isExternal ? '#0078d4' : getListColor(event.list_id);
                    const timeStr = event.start ? format(event.start, 'h:mm a') : 'Todo el día';
                    return (
                      <div 
                        key={event.id} 
                        className="mobile-day-event-item"
                        onClick={() => {
                          if (onSelectEvent) {
                            onSelectEvent(event.itemId, event.isSubtask);
                          } else if (onSelectTask) {
                            onSelectTask(event.itemId);
                          }
                        }}
                      >
                        <div className="mobile-day-event-title-wrap">
                          <span className="mobile-day-event-dot" style={{ backgroundColor: color }} />
                          <span className="mobile-day-event-title-text" style={{ textDecoration: event.isCompleted ? 'line-through' : 'none', opacity: event.isCompleted ? 0.6 : 1 }}>
                            {event.title}
                          </span>
                        </div>
                        <span className="mobile-day-event-time">{timeStr}</span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        ) : (
          <>
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
                    
                    const isDraggingThisDay = dragCreateState && isSameDay(dragCreateState.day, day);

                    return (
                      <div 
                        key={day.toString()} 
                        className="day-column"
                        onMouseDown={(e) => handleColumnMouseDown(e, day)}
                      >
                        {/* Grid lines */}
                        {hours.map(hour => (
                          <div 
                            key={hour} 
                            className="grid-cell" 
                            style={{ height: `${PIXELS_PER_HOUR}px` }} 
                            onClick={(e) => handleCellClick(e, day, hour)}
                          />
                        ))}

                        {/* Drag-to-Create Preview */}
                        {isDraggingThisDay && (
                          <div 
                            className="drag-create-preview"
                            style={{
                              position: 'absolute',
                              top: `${Math.min(dragCreateState.startY, dragCreateState.currentY)}px`,
                              height: `${Math.max(15, Math.abs(dragCreateState.currentY - dragCreateState.startY))}px`,
                              left: '4px',
                              right: '4px',
                              zIndex: 8,
                              pointerEvents: 'none'
                            }}
                          >
                            <div className="drag-create-time-badge">
                              {(() => {
                                const startY = Math.min(dragCreateState.startY, dragCreateState.currentY);
                                const endY = Math.max(dragCreateState.startY, dragCreateState.currentY);
                                const startTotalMin = startY;
                                const endTotalMin = endY;
                                const sh = Math.floor(startTotalMin / 60);
                                const sm = Math.round(startTotalMin % 60);
                                const eh = Math.floor(endTotalMin / 60);
                                const em = Math.round(endTotalMin % 60);
                                const pad = (n) => String(n).padStart(2, '0');
                                const formatTime = (h, m) => {
                                  const suffix = h >= 12 ? 'PM' : 'AM';
                                  const displayH = h % 12 === 0 ? 12 : h % 12;
                                  return `${displayH}:${pad(m)} ${suffix}`;
                                };
                                return `${formatTime(sh, sm)} - ${formatTime(eh, em)}`;
                              })()}
                            </div>
                          </div>
                        )}

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
                                justifyStyle: 'space-between',
                                padding: '6px 8px',
                                boxSizing: 'border-box'
                              }}
                              onMouseDown={(e) => !event.isExternal && handleMouseDown(e, event, 'drag')}
                              onMouseEnter={(e) => handleMouseEnter(e, event)}
                              onMouseLeave={handleMouseLeave}
                              onContextMenu={(e) => handleContextMenu(e, event)}
                              onClick={(e) => {
                                if (isMobile) {
                                  e.stopPropagation();
                                  if (onSelectEvent) {
                                    onSelectEvent(event.itemId, event.isSubtask);
                                  } else if (onSelectTask) {
                                    onSelectTask(event.itemId);
                                  }
                                }
                              }}
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
          </>
        )}
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

      {/* Backdrop overlay for mobile quick create modal */}
      {isMobile && quickCreate && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(3px)',
            zIndex: 2999
          }}
          onClick={() => setQuickCreate(null)}
        />
      )}

      {/* Quick Create Popover / Modal */}
      {quickCreate && (
        <div 
          className={isMobile ? "calendar-quick-create-modal" : "calendar-quick-create-popover"}
          style={isMobile ? {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90%',
            maxWidth: '320px',
            backgroundColor: 'var(--right-pane-bg, #18181c)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            zIndex: 3000,
            padding: '16px'
          } : {
            position: 'absolute',
            left: `${quickCreate.x}px`,
            top: `${quickCreate.y}px`
          }}
        >
          <div className="quick-create-header" style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px', color: 'var(--text-primary)' }}>
            Nueva Actividad
          </div>
          <div className="quick-create-time-info" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            📅 {(() => { const name = format(quickCreate.day, 'EEE d, MMMM', { locale: es }); return name.charAt(0).toUpperCase() + name.slice(1); })()} 
            {quickCreate.startMin !== undefined ? (
              ` de ${(() => {
                const pad = (n) => String(n).padStart(2, '0');
                const sh = quickCreate.startHour;
                const sm = quickCreate.startMin;
                const eh = quickCreate.endHour;
                const em = quickCreate.endMin;
                const formatTime = (h, m) => {
                  const suffix = h >= 12 ? 'PM' : 'AM';
                  const displayH = h % 12 === 0 ? 12 : h % 12;
                  return `${displayH}:${pad(m)} ${suffix}`;
                };
                return `${formatTime(sh, sm)} a ${formatTime(eh, em)}`;
              })()}`
            ) : (
              ` a las ${quickCreate.hour === 0 ? '12:00 AM' : quickCreate.hour < 12 ? `${quickCreate.hour}:00 AM` : quickCreate.hour === 12 ? '12:00 PM' : `${quickCreate.hour - 12}:00 PM`}`
            )}
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
      {showAIRescheduleModal && renderAIRescheduleModal()}
    </div>
  );
}
