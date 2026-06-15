import { useState, useEffect, useRef } from 'react';
import { Trash2, Check, ChevronDown, ChevronRight, Edit2, X, Calendar as CalendarIcon, Sun, Sunrise, Compass, Clock, RotateCcw, AlertCircle, Flag, Repeat, Briefcase, CalendarDays, ArrowUpRight } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import { format, parseISO, addDays, startOfWeek, endOfWeek, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { runAITask } from '../utils/aiManager';
import { adjustExternalDate } from '../utils/timezone';

import { useTodo } from '../context/TodoContext';

export function TaskDetail() {
  const {
    selectedTaskId,
    selectedSubtaskId,
    setSelectedTaskId,
    setSelectedSubtaskId,
    sections = [],
    tasks: allTasks = [],
    externalEvents = [],
    fetchTasks: onUpdate,
    handleDeleteTask: onDelete,
    handleDeleteSubtask: onDeleteSubtask,
    homeTimezone,
    activeTimezoneMode
  } = useTodo();

  const task = selectedTaskId ? allTasks.find(t => t.id === selectedTaskId) : null;
  let subtask = null;
  if (selectedSubtaskId) {
    for (const t of allTasks) {
      const found = (t.subtasks || []).find(st => st.id === selectedSubtaskId);
      if (found) {
        subtask = found;
        break;
      }
    }
  }

  const isSubtaskMode = !!subtask;
  const currentItem = isSubtaskMode ? subtask : task;

  const onClose = () => {
    setSelectedTaskId(null);
    setSelectedSubtaskId(null);
  };

  const onSelectTask = setSelectedTaskId;

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
  const [deadlineDate, setDeadlineDate] = useState(currentItem?.deadline_date ? formatDateForInput(currentItem.deadline_date) : '');
  const [estimatedEffort, setEstimatedEffort] = useState(currentItem?.estimated_effort || 0);
  const [expandedSubtaskId, setExpandedSubtaskId] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProgress, setAiProgress] = useState(null);
  const [aiError, setAiError] = useState(null);
  const [suggestedQuadrant, setSuggestedQuadrant] = useState(null);
  const isAIDisabled = localStorage.getItem('aiModelSelected') === 'desactivado';
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showRecurrenceMenu, setShowRecurrenceMenu] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [editingSubtaskDesc, setEditingSubtaskDesc] = useState('');
  const newSubtaskInputRef = useRef(null);

  // Autosave states and refs for Phase 1
  const [saveStatus, setSaveStatus] = useState(null); // 'saving', 'saved', 'error', null
  const [subtaskSaveStatus, setSubtaskSaveStatus] = useState({}); // { [subtaskId]: 'saving' | 'saved' | 'error' }
  const saveTimeoutRef = useRef(null);
  const subtaskSaveTimeoutRef = useRef({});
  const lastItemIdRef = useRef(null);

  const [allTags, setAllTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const fetchAllTags = async () => {
    try {
      const res = await fetch('/api/tags');
      if (res.ok) {
        const data = await res.json();
        setAllTags(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAllTags();
  }, [task]);

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
  
  // Custom picker state for hours and minutes
  const [hasTime, setHasTime] = useState(false);
  const [startHourState, setStartHourState] = useState('09');
  const [startMinState, setStartMinState] = useState('00');
  const [endHourState, setEndHourState] = useState('10');
  const [endMinState, setEndMinState] = useState('00');

  // Popover calendar states
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());

  const popoverRef = useRef(null);
  const priorityRef = useRef(null);
  const recurrenceRef = useRef(null);

  useEffect(() => {
    const item = subtask || task;
    const itemId = item ? (isSubtaskMode ? `subtask-${item.id}` : `task-${item.id}`) : null;
    
    if (itemId !== lastItemIdRef.current) {
      setTitle(item?.title || '');
      setDescription(item?.description || '');
      lastItemIdRef.current = itemId;
    } else {
      const isTitleFocused = document.activeElement && document.activeElement.classList.contains('detail-title-input');
      const isDescFocused = document.activeElement && (document.activeElement.classList.contains('ql-editor') || document.activeElement.classList.contains('ProseMirror'));
      if (!isTitleFocused) {
        setTitle(item?.title || '');
      }
      if (!isDescFocused) {
        setDescription(item?.description || '');
      }
    }
    
    if (subtask) {
      setSectionId('');
      setDueDate(subtask.due_date ? formatDateForInput(subtask.due_date) : '');
      const sTime = subtask.start_time ? formatDateTimeForInput(subtask.start_time) : '';
      const eTime = subtask.end_time ? formatDateTimeForInput(subtask.end_time) : '';
      setStartTime(sTime);
      setEndTime(eTime);
      setAllDay(!subtask.start_time);

      if (sTime && sTime.includes('T')) {
        const time = sTime.split('T')[1];
        setStartHourState(time.substring(0, 2));
        setStartMinState(time.substring(3, 5));
        setHasTime(true);
      } else {
        setStartHourState('09');
        setStartMinState('00');
        setHasTime(false);
      }

      if (eTime && eTime.includes('T')) {
        const time = eTime.split('T')[1];
        setEndHourState(time.substring(0, 2));
        setEndMinState(time.substring(3, 5));
      } else {
        setEndHourState('10');
        setEndMinState('00');
      }
    } else if (task) {
      setSectionId(task.section_id || '');
      setDueDate(task.due_date ? formatDateForInput(task.due_date) : '');
      const sTime = task.start_time ? formatDateTimeForInput(task.start_time) : '';
      const eTime = task.end_time ? formatDateTimeForInput(task.end_time) : '';
      setStartTime(sTime);
      setEndTime(eTime);
      setAllDay(!task.start_time);
      setDeadlineDate(task.deadline_date ? formatDateForInput(task.deadline_date) : '');
      setEstimatedEffort(task.estimated_effort || 0);

      if (sTime && sTime.includes('T')) {
        const time = sTime.split('T')[1];
        setStartHourState(time.substring(0, 2));
        setStartMinState(time.substring(3, 5));
        setHasTime(true);
      } else {
        setStartHourState('09');
        setStartMinState('00');
        setHasTime(false);
      }

      if (eTime && eTime.includes('T')) {
        const time = eTime.split('T')[1];
        setEndHourState(time.substring(0, 2));
        setEndMinState(time.substring(3, 5));
      } else {
        setEndHourState('10');
        setEndMinState('00');
      }
    }
  }, [task, subtask]);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setShowDatePicker(false);
      }
      if (priorityRef.current && !priorityRef.current.contains(event.target)) {
        setShowPriorityMenu(false);
      }
      if (recurrenceRef.current && !recurrenceRef.current.contains(event.target)) {
        setShowRecurrenceMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleUpdate = async (customFields = {}) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    setSaveStatus('saving');

    // If customFields is a React/DOM Event, ignore it
    let fields = {};
    if (customFields && typeof customFields === 'object' && !(customFields instanceof Event) && !customFields.target && !customFields.nativeEvent) {
      fields = customFields;
    }

    if (isSubtaskMode) {
      const updatedFields = {
        title,
        description,
        due_date: dueDate || null,
        start_time: startTime || null,
        end_time: endTime || null,
        ...fields
      };

      if (updatedFields.start_time && updatedFields.start_time.length === 16) updatedFields.start_time += ':00';
      if (updatedFields.end_time && updatedFields.end_time.length === 16) updatedFields.end_time += ':00';

      try {
        const res = await fetch(`/api/subtasks/${subtask.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedFields)
        });
        if (res.ok) {
          setSaveStatus('saved');
          setTimeout(() => {
            setSaveStatus(prev => prev === 'saved' ? null : prev);
          }, 2000);
          onUpdate();
        } else {
          setSaveStatus('error');
        }
      } catch (err) {
        console.error(err);
        setSaveStatus('error');
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
        deadline_date: deadlineDate || null,
        estimated_effort: parseFloat(estimatedEffort) || 0,
        ...fields
      };

      if (updatedFields.start_time && updatedFields.start_time.length === 16) updatedFields.start_time += ':00';
      if (updatedFields.end_time && updatedFields.end_time.length === 16) updatedFields.end_time += ':00';

      try {
        const res = await fetch(`/api/tasks/${task.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedFields)
        });
        if (res.ok) {
          setSaveStatus('saved');
          setTimeout(() => {
            setSaveStatus(prev => prev === 'saved' ? null : prev);
          }, 2000);
          onUpdate();
        } else {
          setSaveStatus('error');
        }
      } catch (err) {
        console.error(err);
        setSaveStatus('error');
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

  const handleUpdateSubtask = async (id, field, value) => {
    if (field === 'description' && subtaskSaveTimeoutRef.current[id]) {
      clearTimeout(subtaskSaveTimeoutRef.current[id]);
    }
    if (field === 'description') {
      setSubtaskSaveStatus(prev => ({ ...prev, [id]: 'saving' }));
    }

    try {
      const res = await fetch(`/api/subtasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      });
      if (res.ok) {
        if (field === 'description') {
          setSubtaskSaveStatus(prev => ({ ...prev, [id]: 'saved' }));
          setTimeout(() => {
            setSubtaskSaveStatus(prev => ({ ...prev, [id]: prev[id] === 'saved' ? null : prev[id] }));
          }, 2000);
        }
        onUpdate();
      } else {
        if (field === 'description') {
          setSubtaskSaveStatus(prev => ({ ...prev, [id]: 'error' }));
        }
      }
    } catch (err) {
      console.error('Error updating subtask:', err);
      if (field === 'description') {
        setSubtaskSaveStatus(prev => ({ ...prev, [id]: 'error' }));
      }
    }
  };

  const handleDescriptionChange = (newValue) => {
    const currentDesc = (subtask || task)?.description || '';
    if (newValue === currentDesc) {
      setSaveStatus(null);
      return;
    }

    setSaveStatus('saving');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      const updatedFields = {
        description: newValue
      };

      try {
        const url = isSubtaskMode ? `/api/subtasks/${subtask.id}` : `/api/tasks/${task.id}`;
        const res = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedFields)
        });
        if (res.ok) {
          setSaveStatus('saved');
          setTimeout(() => {
            setSaveStatus(prev => prev === 'saved' ? null : prev);
          }, 2000);
          onUpdate();
        } else {
          setSaveStatus('error');
        }
      } catch (err) {
        console.error(err);
        setSaveStatus('error');
      }
    }, 1500);
  };

  const handleSubtaskDescriptionChange = (subtaskId, newValue) => {
    const currentSub = task?.subtasks?.find(s => s.id === subtaskId);
    const currentDesc = currentSub?.description || '';
    if (newValue === currentDesc) {
      setSubtaskSaveStatus(prev => ({ ...prev, [subtaskId]: null }));
      return;
    }

    setSubtaskSaveStatus(prev => ({ ...prev, [subtaskId]: 'saving' }));

    if (subtaskSaveTimeoutRef.current[subtaskId]) {
      clearTimeout(subtaskSaveTimeoutRef.current[subtaskId]);
    }

    subtaskSaveTimeoutRef.current[subtaskId] = setTimeout(async () => {
      try {
        const res = await fetch(`/api/subtasks/${subtaskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: newValue })
        });
        if (res.ok) {
          setSubtaskSaveStatus(prev => ({ ...prev, [subtaskId]: 'saved' }));
          setTimeout(() => {
            setSubtaskSaveStatus(prev => ({ ...prev, [subtaskId]: prev[subtaskId] === 'saved' ? null : prev[subtaskId] }));
          }, 2000);
          onUpdate();
        } else {
          setSubtaskSaveStatus(prev => ({ ...prev, [subtaskId]: 'error' }));
        }
      } catch (err) {
        console.error(err);
        setSubtaskSaveStatus(prev => ({ ...prev, [subtaskId]: 'error' }));
      }
    }, 1500);
  };

  const handleCreateSubtaskFromText = async (subtaskTitle) => {
    if (!task || !subtaskTitle.trim()) return;
    try {
      const res = await fetch('/api/subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: task.id,
          title: subtaskTitle.trim(),
          description: ''
        })
      });
      if (res.ok) {
        onUpdate();
      }
    } catch (err) {
      console.error('Error creating subtask from selection:', err);
    }
  };

  const handleDescriptionLinkClick = (e) => {
    const link = e.target.closest('a');
    if (link) {
      const href = link.getAttribute('href');
      if (href && href.startsWith('/tasks/')) {
        e.preventDefault();
        const targetTaskId = parseInt(href.split('/tasks/')[1], 10);
        if (onSelectTask) {
          onSelectTask(targetTaskId);
        }
      }
    }
  };

  const handlePromoteSubtask = async (st) => {
    try {
      const resTask = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: st.title,
          description: st.description || '',
          list_id: task.list_id,
          priority: 0,
          due_date: st.due_date || null,
          start_time: st.start_time || null,
          end_time: st.end_time || null
        })
      });
      
      if (resTask.ok) {
        await fetch(`/api/subtasks/${st.id}`, { method: 'DELETE' });
        onUpdate();
      }
    } catch (err) {
      console.error('Error promoting subtask:', err);
    }
  };

  const getFormattedDateDisplay = () => {
    if (startTime && endTime && startTime !== endTime) {
      try {
        const startParsed = parseISO(startTime);
        const endParsed = parseISO(endTime);
        return `${format(startParsed, 'MMM d')} - ${format(endParsed, 'MMM d')}`;
      } catch (e) {
        // ignore
      }
    }
    if (dueDate) {
      try {
        return format(parseISO(dueDate), 'MMM d');
      } catch (e) {
        // ignore
      }
    }
    if (deadlineDate) {
      try {
        return `🚨 Límite: ${format(parseISO(deadlineDate), 'MMM d')}`;
      } catch (e) {}
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
    const newStartStr = hasTime ? `${formattedDate}T${startHourState}:${startMinState}` : formattedDate;
    setStartTime(newStartStr);
    setEndTime(newStartStr);
    handleUpdate({ due_date: formattedDate, start_time: newStartStr, end_time: newStartStr });
  };

  const handleCalendarDayClick = (dateObj) => {
    const formattedDate = format(dateObj, 'yyyy-MM-dd');
    if (activeTab === 'date') {
      setDueDate(formattedDate);
      if (hasTime) {
        const newStart = `${formattedDate}T${startHourState}:${startMinState}`;
        // Preserve range duration shift if range exists
        if (startTime && endTime) {
          try {
            const startD = parseISO(startTime.includes('T') ? startTime : `${startTime}T00:00`);
            const endD = parseISO(endTime.includes('T') ? endTime : `${endTime}T00:00`);
            const diffMs = endD.getTime() - startD.getTime();
            const newStartD = parseISO(newStart);
            const newEndD = new Date(newStartD.getTime() + diffMs);
            const newEnd = `${format(newEndD, 'yyyy-MM-dd')}T${endHourState}:${endMinState}`;
            setStartTime(newStart);
            setEndTime(newEnd);
          } catch (e) {
            setStartTime(newStart);
            setEndTime(`${formattedDate}T${endHourState}:${endMinState}`);
          }
        } else {
          setStartTime(newStart);
          setEndTime(`${formattedDate}T${endHourState}:${endMinState}`);
        }
      } else {
        // If hasTime is disabled, set date-only strings
        if (startTime && endTime) {
          try {
            const startD = parseISO(startTime.includes('T') ? startTime.split('T')[0] : startTime);
            const endD = parseISO(endTime.includes('T') ? endTime.split('T')[0] : endTime);
            const diffMs = endD.getTime() - startD.getTime();
            const newStartD = parseISO(formattedDate);
            const newEndD = new Date(newStartD.getTime() + diffMs);
            const newEnd = format(newEndD, 'yyyy-MM-dd');
            setStartTime(formattedDate);
            setEndTime(newEnd);
          } catch (e) {
            setStartTime(formattedDate);
            setEndTime(formattedDate);
          }
        } else {
          setStartTime(formattedDate);
          setEndTime(formattedDate);
        }
      }
    } else if (activeTab === 'deadline') {
      setDeadlineDate(formattedDate);
    } else {
      // Duration range selection
      const currentStartDateStr = startTime ? (startTime.includes('T') ? startTime.split('T')[0] : startTime) : '';
      const currentEndDateStr = endTime ? (endTime.includes('T') ? endTime.split('T')[0] : endTime) : '';
      
      if (!currentStartDateStr || (currentStartDateStr && currentEndDateStr)) {
        // Set new start date, clear end date
        const newStart = allDay ? formattedDate : `${formattedDate}T${startHourState}:${startMinState}`;
        setStartTime(newStart);
        setEndTime('');
        // Sync dueDate
        setDueDate(formattedDate);
      } else {
        // Start date exists, set end date
        if (formattedDate >= currentStartDateStr) {
          const newEnd = allDay ? formattedDate : `${formattedDate}T${endHourState}:${endMinState}`;
          setEndTime(newEnd);
          // Keep dueDate as the start date of range
          setDueDate(currentStartDateStr);
        } else {
          // If clicked date is before start date, it becomes the new start date
          const newStart = allDay ? formattedDate : `${formattedDate}T${startHourState}:${startMinState}`;
          setStartTime(newStart);
          setEndTime('');
          // Sync dueDate
          setDueDate(formattedDate);
        }
      }
    }
  };

  const handleTimeChange = (h, m) => {
    setStartHourState(h);
    setStartMinState(m);
    const datePart = dueDate || format(new Date(), 'yyyy-MM-dd');
    const newStart = `${datePart}T${h}:${m}`;
    setStartTime(newStart);
    if (endTime) {
      try {
        const startD = parseISO(startTime.includes('T') ? startTime : `${startTime}T00:00`);
        const endD = parseISO(endTime.includes('T') ? endTime : `${endTime}T00:00`);
        const diffMs = endD.getTime() - startD.getTime();
        const newStartD = parseISO(newStart);
        const newEndD = new Date(newStartD.getTime() + diffMs);
        setEndTime(`${format(newEndD, 'yyyy-MM-dd')}T${endHourState}:${endMinState}`);
      } catch (e) {
        setEndTime(`${datePart}T${endHourState}:${endMinState}`);
      }
    } else {
      const hourNum = parseInt(h);
      const nextHour = String((hourNum + 1) % 24).padStart(2, '0');
      setEndTime(`${datePart}T${nextHour}:${m}`);
    }
  };

  const handleStartTimeChange = (h, m) => {
    setStartHourState(h);
    setStartMinState(m);
    const datePart = startTime ? (startTime.includes('T') ? startTime.split('T')[0] : startTime) : format(new Date(), 'yyyy-MM-dd');
    setStartTime(`${datePart}T${h}:${m}`);
  };

  const handleEndTimeChange = (h, m) => {
    setEndHourState(h);
    setEndMinState(m);
    const datePart = endTime ? (endTime.includes('T') ? endTime.split('T')[0] : endTime) : (startTime ? (startTime.includes('T') ? startTime.split('T')[0] : startTime) : format(new Date(), 'yyyy-MM-dd'));
    setEndTime(`${datePart}T${h}:${m}`);
  };

  const handleAllDayToggle = (isAllDay) => {
    setAllDay(isAllDay);
    setHasTime(!isAllDay);
    if (isAllDay) {
      if (startTime) setStartTime(startTime.split('T')[0]);
      if (endTime) setEndTime(endTime.split('T')[0]);
    } else {
      const sDate = startTime ? (startTime.includes('T') ? startTime.split('T')[0] : startTime) : (dueDate || format(new Date(), 'yyyy-MM-dd'));
      const eDate = endTime ? (endTime.includes('T') ? endTime.split('T')[0] : endTime) : sDate;
      setStartTime(`${sDate}T${startHourState}:${startMinState}`);
      setEndTime(`${eDate}T${endHourState}:${endMinState}`);
    }
  };

  const handleApplyDuration = () => {
    if (activeTab === 'date') {
      if (dueDate) {
        let finalStartTime = null;
        let finalEndTime = null;
        if (hasTime) {
          finalStartTime = `${dueDate}T${startHourState}:${startMinState}`;
          if (endTime && (endTime.startsWith(dueDate) || endTime.includes('T'))) {
            finalEndTime = endTime;
          } else {
            const hourNum = parseInt(startHourState);
            const nextHour = String((hourNum + 1) % 24).padStart(2, '0');
            const nextDayOffset = hourNum + 1 >= 24;
            let finalEndDay = dueDate;
            if (nextDayOffset) {
              try {
                finalEndDay = format(addDays(parseISO(dueDate), 1), 'yyyy-MM-dd');
              } catch (e) {}
            }
            finalEndTime = `${finalEndDay}T${nextHour}:${startMinState}`;
          }
        } else {
          finalStartTime = dueDate;
          finalEndTime = dueDate;
        }
        setStartTime(finalStartTime);
        setEndTime(finalEndTime);
        handleUpdate({
          due_date: dueDate,
          start_time: finalStartTime,
          end_time: finalEndTime
        });
      }
    } else if (activeTab === 'deadline') {
      handleUpdate({
        deadline_date: deadlineDate || null,
        estimated_effort: parseFloat(estimatedEffort) || 0
      });
    } else {
      // duration range mode
      if (startTime) {
        const derivedDueDate = startTime.split('T')[0];
        setDueDate(derivedDueDate);
        handleUpdate({
          due_date: derivedDueDate,
          start_time: startTime,
          end_time: endTime || null
        });
      }
    }
    setShowDatePicker(false);
  };

  const handleClearDates = () => {
    if (activeTab === 'deadline') {
      setDeadlineDate('');
      setEstimatedEffort(0);
      handleUpdate({
        deadline_date: null,
        estimated_effort: 0
      });
    } else {
      setDueDate('');
      setStartTime('');
      setEndTime('');
      setHasTime(false);
      handleUpdate({
        due_date: null,
        start_time: null,
        end_time: null
      });
    }
    setShowDatePicker(false);
  };

  const renderTimeSelector = (hourVal, minVal, onHourChange, onMinChange) => {
    const hoursArray = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const minutesArray = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

    return (
      <div className="custom-time-picker">
        <select 
          value={hourVal} 
          onChange={(e) => onHourChange(e.target.value)}
          className="time-select"
        >
          {hoursArray.map(h => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        <span className="time-separator">:</span>
        <select 
          value={minVal} 
          onChange={(e) => onMinChange(e.target.value)}
          className="time-select"
        >
          {minutesArray.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
    );
  };

  const calendarDays = generateCalendarDays();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const subtasks = task?.subtasks || [];

  const getScheduleConflict = () => {
    const currentItem = subtask || task;
    if (!currentItem || currentItem.is_completed) return null;

    if (!startTime || !endTime) return null;

    const parseDate = (dStr) => {
      if (!dStr) return null;
      try {
        const d = parseISO(dStr);
        return isNaN(d.getTime()) ? null : d;
      } catch (e) {
        return null;
      }
    };

    const currentStart = parseDate(startTime);
    const currentEnd = parseDate(endTime);
    if (!currentStart || !currentEnd) return null;

    // 1. Check other tasks
    for (const t of (allTasks || [])) {
      // Skip current task
      if (!subtask && task && t.id === task.id) continue;
      if (t.is_completed) continue;

      const tStart = parseDate(t.start_time);
      const tEnd = parseDate(t.end_time);
      if (tStart && tEnd) {
        if (currentStart < tEnd && currentEnd > tStart) {
          return { title: t.title, type: 'tarea' };
        }
      }

      // Check subtasks of this task
      if (t.subtasks && Array.isArray(t.subtasks)) {
        for (const st of t.subtasks) {
          if (subtask && st.id === subtask.id) continue;
          if (st.is_completed) continue;

          const stStart = parseDate(st.start_time);
          const stEnd = parseDate(st.end_time);
          if (stStart && stEnd) {
            if (currentStart < stEnd && currentEnd > stStart) {
              return { title: st.title, type: 'subtarea' };
            }
          }
        }
      }
    }

    // 2. Check external Outlook events
    for (const e of (externalEvents || [])) {
      const eStart = parseDate(e.start_time);
      const eEnd = parseDate(e.end_time);
      if (eStart && eEnd) {
        const adjustedStart = adjustExternalDate(eStart, homeTimezone, activeTimezoneMode);
        const adjustedEnd = adjustExternalDate(eEnd, homeTimezone, activeTimezoneMode);
        if (currentStart < adjustedEnd && currentEnd > adjustedStart) {
          return { title: e.title, type: 'Outlook' };
        }
      }
    }

    return null;
  };

  if (!task && !subtask) return null;

  const conflict = getScheduleConflict();

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
          placeholder={isSubtaskMode ? "Subtask Title" : (task && task.type === 'note' ? "Título de la Nota" : "Task Title")}
        />

        {(task || subtask) && (
          <>
            {conflict && (
              <div className="schedule-conflict-banner" style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '1rem',
                color: '#ef4444',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backdropFilter: 'blur(8px)',
                animation: 'slideDownFade 0.25s ease'
              }}>
                <span>⚠️</span>
                <div style={{ flex: 1 }}>
                  <strong>Conflicto de horario:</strong> Se cruza con la {conflict.type} <em>"{conflict.title}"</em>.
                </div>
              </div>
            )}
            {!isSubtaskMode && task && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                marginBottom: '1.25rem',
                marginTop: '0.5rem'
              }}>
                {task && task.type !== 'note' && (
                  <div className="date-reminder-wrapper" ref={popoverRef} style={{ display: 'inline-block' }}>
                  <button 
                    className={`date-reminder-trigger-btn ${dueDate || startTime ? 'has-date' : ''} ${deadlineDate ? 'has-deadline' : ''}`}
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
                          Fecha
                        </button>
                        <button 
                          className={`popover-tab-btn ${activeTab === 'duration' ? 'active' : ''}`}
                          onClick={() => setActiveTab('duration')}
                        >
                          Duración
                        </button>
                        <button 
                          className={`popover-tab-btn ${activeTab === 'deadline' ? 'active' : ''}`}
                          onClick={() => setActiveTab('deadline')}
                        >
                          Límite
                        </button>
                      </div>

                      <div className="popover-body">
                        {/* Shared Calendar Header */}
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
                          <span>D</span><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span>
                        </div>

                        {/* Mini Calendar Grid */}
                        <div className="mini-calendar-grid" style={{ marginBottom: '0.75rem' }}>
                          {calendarDays.map((dayObj, index) => {
                            const formattedCompare = format(dayObj.date, 'yyyy-MM-dd');
                            const currentStartDateStr = startTime ? startTime.split('T')[0] : '';
                            const currentEndDateStr = endTime ? endTime.split('T')[0] : '';

                            const isRangeStart = activeTab === 'duration' && currentStartDateStr === formattedCompare;
                            const isRangeEnd = activeTab === 'duration' && currentEndDateStr === formattedCompare;
                            const isRangeBetween = activeTab === 'duration' && currentStartDateStr && currentEndDateStr && 
                                                   formattedCompare > currentStartDateStr && formattedCompare < currentEndDateStr;

                             const isSelected = activeTab === 'date' 
                               ? (dueDate === formattedCompare) 
                               : activeTab === 'deadline'
                                 ? (deadlineDate === formattedCompare)
                                 : (isRangeStart || isRangeEnd);

                            return (
                              <button
                                key={index}
                                onClick={() => handleCalendarDayClick(dayObj.date)}
                                className={`calendar-grid-day ${!dayObj.isCurrentMonth ? 'other-month' : ''} ${isSelected ? 'selected' : ''} ${isRangeStart ? 'range-start' : ''} ${isRangeEnd ? 'range-end' : ''} ${isRangeBetween ? 'range-between' : ''}`}
                              >
                                {dayObj.day}
                              </button>
                            );
                          })}
                        </div>

                        {/* Tab-Specific Options */}
                        {activeTab === 'date' && (
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

                            {/* Time Selector Row */}
                            <div className="time-selector-row">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>🕒 Definir hora:</span>
                                <label className="toggle-switch">
                                  <input 
                                    type="checkbox" 
                                    checked={hasTime}
                                    onChange={(e) => {
                                      setHasTime(e.target.checked);
                                      if (e.target.checked) {
                                        setStartTime(`${dueDate || format(new Date(), 'yyyy-MM-dd')}T${startHourState}:${startMinState}`);
                                      } else {
                                        setStartTime('');
                                        setEndTime('');
                                      }
                                    }}
                                  />
                                  <span className="slider round"></span>
                                </label>
                              </div>
                              {hasTime && renderTimeSelector(
                                startHourState, 
                                startMinState, 
                                (h) => handleTimeChange(h, startMinState), 
                                (m) => handleTimeChange(startHourState, m)
                              )}
                            </div>
                          </div>
                        )}

                        {activeTab === 'duration' && (
                          <div className="duration-tab-content" style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
                            {/* Resumen de Rango */}
                            <div className="duration-range-summary" style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '8px', padding: '10px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>📅 Inicio:</span>
                                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                                  {startTime ? format(parseISO(startTime), 'dd MMM yyyy') : '--'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>📅 Fin:</span>
                                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                                  {endTime ? format(parseISO(endTime), 'dd MMM yyyy') : '--'}
                                </span>
                              </div>
                            </div>

                            {/* All Day Toggle */}
                            <div className="all-day-toggle-row" style={{ marginBottom: '12px' }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>🕒 Todo el día</span>
                              <label className="toggle-switch">
                                <input 
                                  type="checkbox" 
                                  checked={allDay}
                                  onChange={(e) => handleAllDayToggle(e.target.checked)}
                                />
                                <span className="slider round"></span>
                              </label>
                            </div>

                            {/* Custom Time Selection (if not all day) */}
                            {!allDay && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Hora de Inicio:</span>
                                  {renderTimeSelector(
                                    startHourState, 
                                    startMinState, 
                                    (h) => handleStartTimeChange(h, startMinState), 
                                    (m) => handleStartTimeChange(startHourState, m)
                                  )}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Hora de Fin:</span>
                                  {renderTimeSelector(
                                    endHourState, 
                                    endMinState, 
                                    (h) => handleEndTimeChange(h, endMinState), 
                                    (m) => handleEndTimeChange(endHourState, m)
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {activeTab === 'deadline' && (
                          <div className="deadline-tab-content" style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {/* Summary of Deadline */}
                            <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '8px', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>🚨 Límite Estricto:</span>
                              <span style={{ color: '#ef4444', fontWeight: 700 }}>
                                {deadlineDate ? format(parseISO(deadlineDate), 'dd MMM yyyy') : 'Sin definir'}
                              </span>
                            </div>

                            {/* Estimated Effort Input */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>⏱️ Esfuerzo Estimado:</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={estimatedEffort || ''}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                    setEstimatedEffort(val);
                                  }}
                                  placeholder="0.0"
                                  style={{
                                    background: 'rgba(0, 0, 0, 0.2)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    color: 'var(--text-primary)',
                                    padding: '6px 10px',
                                    fontSize: '0.8rem',
                                    width: '80px',
                                    outline: 'none',
                                    fontFamily: 'inherit'
                                  }}
                                />
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Horas de esfuerzo</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="popover-actions" style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button className="popover-action-btn ok-btn" onClick={handleApplyDuration}>
                            OK
                          </button>
                          <button className="popover-action-btn clear-btn" onClick={handleClearDates}>
                            Limpiar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                )}



                {/* Section Selector */}
                {sections.filter(s => s.list_id === task.list_id).length > 0 && (
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <select
                      value={sectionId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSectionId(val);
                        handleUpdate({ section_id: val ? parseInt(val, 10) : null });
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '30px',
                        padding: '6px 12px',
                        color: 'var(--text-secondary)',
                        fontSize: '0.78rem',
                        fontWeight: 500,
                        outline: 'none',
                        cursor: 'pointer',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        paddingRight: '24px',
                        transition: 'all 0.15s ease',
                        fontFamily: 'inherit'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }}
                    >
                      <option value="" style={{ background: '#18181c', color: '#fff' }}>📁 Sin Sección</option>
                      {sections.filter(s => s.list_id === task.list_id).map(s => (
                        <option key={s.id} value={s.id} style={{ background: '#18181c', color: '#fff' }}>📁 {s.name}</option>
                      ))}
                    </select>
                    <span style={{
                      position: 'absolute',
                      right: '10px',
                      pointerEvents: 'none',
                      fontSize: '0.55rem',
                      color: 'var(--text-muted)'
                    }}>▼</span>
                  </div>
                )}

                {/* Priority Selector */}
                {task && task.type !== 'note' && (
                <div 
                  className="priority-select-container" 
                  ref={priorityRef}
                  style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
                >
                  <button 
                    onClick={() => setShowPriorityMenu(!showPriorityMenu)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '30px',
                      padding: '6px 10px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    }}
                    title="Prioridad"
                  >
                    {task.priority === 3 && <Flag size={13} fill="#ef4444" color="#ef4444" />}
                    {task.priority === 2 && <Flag size={13} fill="#eab308" color="#eab308" />}
                    {task.priority === 1 && <Flag size={13} fill="#3b82f6" color="#3b82f6" />}
                    {task.priority === 0 && <Flag size={13} color="#8e95a5" />}
                    <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>▼</span>
                  </button>

                  {showPriorityMenu && (
                    <div 
                      className="priority-picker-popover"
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        zIndex: 100,
                        background: 'rgba(18, 18, 24, 0.95)',
                        backdropFilter: 'blur(16px)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        padding: '4px',
                        minWidth: '180px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                        marginTop: '4px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}
                    >
                      {[
                        { val: 3, label: 'Urgente e Importante', color: '#ef4444' },
                        { val: 2, label: 'Importante no Urgente', color: '#eab308' },
                        { val: 1, label: 'Urgente no Importante', color: '#3b82f6' },
                        { val: 0, label: 'Ninguna Prioridad', color: '#8e95a5', hollow: true }
                      ].map((item) => (
                        <button
                          key={item.val}
                          onClick={async () => {
                            try {
                              await fetch(`/api/tasks/${task.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ priority: item.val })
                              });
                              setShowPriorityMenu(false);
                              onUpdate();
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '8px 10px',
                            color: 'var(--text-secondary)',
                            fontSize: '0.78rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            textAlign: 'left',
                            width: '100%',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                            e.currentTarget.style.color = 'var(--text-primary)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                          }}
                        >
                          <Flag 
                            size={12} 
                            fill={item.hollow ? 'none' : item.color} 
                            color={item.color} 
                          />
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                )}

                {/* Recurrence Selector */}
                {task && task.type !== 'note' && (
                <div 
                  className="recurrence-select-container" 
                  ref={recurrenceRef}
                  style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
                >
                  <button 
                    onClick={() => setShowRecurrenceMenu(!showRecurrenceMenu)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '30px',
                      padding: '6px 10px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    }}
                    title="Recurrencia"
                  >
                    {(!task.recurrence_type || task.recurrence_type === 'none') && <Repeat size={13} color="#8e95a5" />}
                    {task.recurrence_type === 'daily' && <CalendarIcon size={13} color="var(--accent-hover)" />}
                    {task.recurrence_type === 'weekly' && <CalendarDays size={13} color="var(--accent-hover)" />}
                    {task.recurrence_type === 'monthly' && <CalendarDays size={13} color="var(--accent-hover)" />}
                    {task.recurrence_type === 'weekdays' && <Briefcase size={13} color="var(--accent-hover)" />}
                    <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>▼</span>
                  </button>

                  {showRecurrenceMenu && (
                    <div 
                      className="recurrence-picker-popover"
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        zIndex: 100,
                        background: 'rgba(18, 18, 24, 0.95)',
                        backdropFilter: 'blur(16px)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        padding: '4px',
                        minWidth: '160px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                        marginTop: '4px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}
                    >
                      {[
                        { val: 'none', label: 'No repetir', icon: <Repeat size={12} color="#8e95a5" /> },
                        { val: 'daily', label: 'Diariamente', icon: <CalendarIcon size={12} color="var(--accent-hover)" /> },
                        { val: 'weekly', label: 'Semanalmente', icon: <CalendarDays size={12} color="var(--accent-hover)" /> },
                        { val: 'monthly', label: 'Mensualmente', icon: <CalendarDays size={12} color="var(--accent-hover)" /> },
                        { val: 'weekdays', label: 'Lun a Vie', icon: <Briefcase size={12} color="var(--accent-hover)" /> }
                      ].map((item) => (
                        <button
                          key={item.val}
                          onClick={async () => {
                            try {
                              await fetch(`/api/tasks/${task.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ recurrence_type: item.val })
                              });
                              setShowRecurrenceMenu(false);
                              onUpdate();
                            } catch (err) {
                              console.error('Error updating recurrence:', err);
                            }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '8px 10px',
                            color: 'var(--text-secondary)',
                            fontSize: '0.78rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            textAlign: 'left',
                            width: '100%',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                            e.currentTarget.style.color = 'var(--text-primary)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                          }}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                )}

                {/* AI Classify Button */}
                {!isAIDisabled && !suggestedQuadrant && task && task.type !== 'note' && (
                  <button
                    onClick={handleAIEisenhowerClassify}
                    disabled={aiLoading}
                    style={{
                      background: 'rgba(124, 58, 237, 0.06)',
                      border: '1px solid rgba(124, 58, 237, 0.15)',
                      borderRadius: '30px',
                      padding: '6px 12px',
                      color: 'var(--accent-hover)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(124, 58, 237, 0.12)';
                      e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.3)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(124, 58, 237, 0.06)';
                      e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.15)';
                    }}
                  >
                    ✨ Clasificar IA
                  </button>
                )}

                {/* Tag Pills */}
                {task.tags && task.tags.map(tag => (
                  <span 
                    key={tag.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: '12px',
                      backgroundColor: `${tag.color || '#8e95a5'}15`,
                      color: tag.color || 'var(--text-secondary)',
                      border: `1px solid ${tag.color || '#8e95a5'}35`,
                      transition: 'all 0.2s'
                    }}
                  >
                    #{tag.name}
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const updatedTags = task.tags.filter(t => t.id !== tag.id).map(t => t.name);
                        try {
                          const res = await fetch(`/api/tasks/${task.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ tags: updatedTags })
                          });
                          if (res.ok) {
                            onUpdate();
                          }
                        } catch (err) {
                          console.error('Error removing tag:', err);
                        }
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: tag.color || 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        opacity: 0.6,
                        fontSize: '10px'
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = 1}
                      onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}

                {/* Add Tag Input */}
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <input
                    type="text"
                    placeholder="+ Etiqueta"
                    value={tagInput}
                    onChange={(e) => {
                      setTagInput(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => {
                      fetchAllTags();
                      setShowSuggestions(true);
                    }}
                    onBlur={() => {
                      setTimeout(() => {
                        setShowSuggestions(false);
                      }, 250);
                    }}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = tagInput.trim().toLowerCase();
                        if (!val) return;
                        const currentTagNames = task.tags ? task.tags.map(t => t.name) : [];
                        if (!currentTagNames.includes(val)) {
                          const updatedTags = [...currentTagNames, val];
                          try {
                            const res = await fetch(`/api/tasks/${task.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ tags: updatedTags })
                            });
                            if (res.ok) {
                              setTagInput('');
                              setShowSuggestions(false);
                              onUpdate();
                              fetchAllTags();
                            }
                          } catch (err) {
                            console.error('Error adding tag:', err);
                          }
                        } else {
                          setTagInput('');
                          setShowSuggestions(false);
                        }
                      }
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px dashed var(--border-color)',
                      borderRadius: '12px',
                      padding: '2px 8px',
                      fontSize: '11px',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      width: '90px',
                      transition: 'all 0.2s'
                    }}
                  />
                  {showSuggestions && tagInput.trim() !== '' && (
                    <div 
                      style={{
                        position: 'absolute',
                        bottom: '26px',
                        left: 0,
                        zIndex: 100,
                        background: 'var(--right-pane-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        maxHeight: '150px',
                        overflowY: 'auto',
                        width: '180px'
                      }}
                    >
                      {allTags
                        .filter(tag => 
                          tag.name.toLowerCase().includes(tagInput.toLowerCase()) && 
                          !(task.tags && task.tags.some(t => t.id === tag.id))
                        )
                        .map(tag => (
                          <div
                            key={tag.id}
                            onClick={async () => {
                              const currentTagNames = task.tags ? task.tags.map(t => t.name) : [];
                              const updatedTags = [...currentTagNames, tag.name];
                              try {
                                const res = await fetch(`/api/tasks/${task.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ tags: updatedTags })
                                });
                                if (res.ok) {
                                  setTagInput('');
                                  setShowSuggestions(false);
                                  onUpdate();
                                }
                              } catch (err) {
                                  console.error('Error adding tag from suggestion:', err);
                              }
                            }}
                            style={{
                              padding: '6px 10px',
                              cursor: 'pointer',
                              fontSize: '11px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: tag.color }} />
                            #{tag.name}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI Proposal */}
            {!isSubtaskMode && task && suggestedQuadrant && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(124, 58, 237, 0.05)',
                border: '1px dashed rgba(124, 58, 237, 0.2)',
                borderRadius: '8px',
                padding: '8px 12px',
                marginTop: '8px',
                marginBottom: '1rem',
                animation: 'fadeIn 0.2s ease',
                gap: '8px'
              }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>✨ IA propone:</span>
                  <strong style={{ color: 'var(--accent-hover)' }}>{suggestedQuadrant}</strong>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => handleApplyAIQuadrant(suggestedQuadrant)}
                    style={{
                      background: 'var(--accent-hover)',
                      border: 'none',
                      color: '#ffffff',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Aplicar
                  </button>
                  <button
                    onClick={() => setSuggestedQuadrant(null)}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Ignorar
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        
        <div className="detail-description-wrapper" onBlur={handleUpdate} onClick={handleDescriptionLinkClick}>
          <RichTextEditor 
            value={description}
            onChange={(val) => {
              setDescription(val);
              handleDescriptionChange(val);
            }}
            placeholder={isSubtaskMode ? "Escribe detalles de la subtarea aquí..." : (task && task.type === 'note' ? "Escribe el contenido de la nota aquí..." : "Add description...")}
            tasks={allTasks}
            onCreateSubtask={handleCreateSubtaskFromText}
          />
          {saveStatus && (
            <div className={`editor-autosave-badge ${saveStatus}`}>
              {saveStatus === 'saving' && (
                <>
                  <span className="spinner-icon"></span>
                  <span>Guardando...</span>
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <Check size={10} />
                  <span>Guardado</span>
                </>
              )}
              {saveStatus === 'error' && (
                <>
                  <AlertCircle size={10} />
                  <span>Error al guardar</span>
                </>
              )}
            </div>
          )}
        </div>

        {!isSubtaskMode && task && task.type !== 'note' && (
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
                {subtasks.map(st => (
                  <SubtaskItem
                    key={st.id}
                    st={st}
                    onToggle={handleToggleSubtask}
                    onDelete={handleDeleteSubtask}
                    onUpdate={handleUpdateSubtask}
                    onPromote={handlePromoteSubtask}
                    expandedSubtaskId={expandedSubtaskId}
                    setExpandedSubtaskId={setExpandedSubtaskId}
                    editingSubtaskDesc={editingSubtaskDesc}
                    setEditingSubtaskDesc={setEditingSubtaskDesc}
                    handleUpdateSubtask={handleUpdateSubtask}
                    onEnterPressed={() => newSubtaskInputRef.current?.focus()}
                    subtaskSaveStatus={subtaskSaveStatus}
                    handleSubtaskDescriptionChange={handleSubtaskDescriptionChange}
                    onCreateSubtask={handleCreateSubtaskFromText}
                    allTasks={allTasks}
                    onLinkClick={handleDescriptionLinkClick}
                  />
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.6, fontStyle: 'italic', margin: '4px 0 0 12px' }}>
                No hay subtareas registradas. ¡Créalas abajo o usa el desglose de IA!
              </p>
            )}

            {/* Input to add subtask manually */}
            <div style={{ marginTop: '12px', position: 'relative' }}>
              <input
                ref={newSubtaskInputRef}
                type="text"
                placeholder="+ Añadir subtarea (Presiona Enter)..."
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = newSubtaskTitle.trim();
                    if (!val) return;
                    try {
                      const res = await fetch('/api/subtasks', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          task_id: task.id,
                          title: val,
                          description: ''
                        })
                      });
                      if (res.ok) {
                        setNewSubtaskTitle('');
                        onUpdate();
                      }
                    } catch (err) {
                      console.error('Error al guardar subtarea:', err);
                    }
                  }
                }}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px dashed var(--border-color)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '0.78rem',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  width: '100%',
                  transition: 'all 0.2s'
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SubtaskItem({ st, onToggle, onDelete, onUpdate, onPromote, expandedSubtaskId, setExpandedSubtaskId, editingSubtaskDesc, setEditingSubtaskDesc, handleUpdateSubtask, onEnterPressed, subtaskSaveStatus = {}, handleSubtaskDescriptionChange, onCreateSubtask, allTasks = [], onLinkClick }) {
  const [title, setTitle] = useState(st.title);
  const stCompleted = st.is_completed === 1 || st.is_completed === true;
  const isExpanded = expandedSubtaskId === st.id;

  useEffect(() => {
    setTitle(st.title);
  }, [st.title]);

  const handleTitleBlur = () => {
    if (title.trim() && title.trim() !== st.title) {
      handleUpdateSubtask(st.id, 'title', title.trim());
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
      if (onEnterPressed) {
        onEnterPressed();
      }
    }
  };

  return (
    <div className={`detail-subtask-item-container ${isExpanded ? 'expanded' : ''}`}>
      <div className={`detail-subtask-item ${stCompleted ? 'completed' : ''}`}>
        <div className="checkbox subtask-checkbox" onClick={() => onToggle(st.id, st.is_completed)}>
          {stCompleted && <Check size={10} color="#0f1115" />}
        </div>
        
        {/* Inline editable title input */}
        <input 
          type="text"
          className="subtask-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={handleKeyDown}
          style={{
            background: 'transparent',
            border: 'none',
            color: stCompleted ? 'var(--text-muted)' : 'var(--text-primary)',
            fontSize: '0.82rem',
            fontFamily: 'inherit',
            outline: 'none',
            flex: 1,
            padding: 0,
            textDecoration: stCompleted ? 'line-through' : 'none',
            cursor: 'text'
          }}
        />

        <button 
          className="icon-btn" 
          onClick={() => onPromote(st)} 
          title="Promover a tarea principal"
          style={{ opacity: 0.5 }}
          onMouseEnter={e => e.currentTarget.style.opacity = 1}
          onMouseLeave={e => e.currentTarget.style.opacity = 0.5}
        >
          <ArrowUpRight size={14} />
        </button>

        <button 
          className="icon-btn" 
          onClick={() => {
            if (isExpanded) {
              setExpandedSubtaskId(null);
            } else {
              setExpandedSubtaskId(st.id);
              setEditingSubtaskDesc(st.description || '');
            }
          }} 
          title="Editar Detalles"
        >
          <Edit2 size={14} />
        </button>
        <button 
          className="icon-btn" 
          onClick={() => {
            if (isExpanded) {
              setExpandedSubtaskId(null);
            } else {
              setExpandedSubtaskId(st.id);
              setEditingSubtaskDesc(st.description || '');
            }
          }}
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <button className="subtask-delete icon-btn danger" onClick={() => onDelete(st.id)}>
          <Trash2 size={12} />
        </button>
      </div>
      {isExpanded && (
        <div className="subtask-editor-container" onBlur={() => handleUpdateSubtask(st.id, 'description', editingSubtaskDesc)} onClick={onLinkClick}>
          <RichTextEditor 
            value={editingSubtaskDesc}
            onChange={(val) => {
              setEditingSubtaskDesc(val);
              if (handleSubtaskDescriptionChange) {
                handleSubtaskDescriptionChange(st.id, val);
              }
            }}
            placeholder="Add subtask details..."
            tasks={allTasks}
            onCreateSubtask={onCreateSubtask}
          />
          {subtaskSaveStatus[st.id] && (
            <div className={`editor-autosave-badge ${subtaskSaveStatus[st.id]}`}>
              {subtaskSaveStatus[st.id] === 'saving' && (
                <>
                  <span className="spinner-icon"></span>
                  <span>Guardando...</span>
                </>
              )}
              {subtaskSaveStatus[st.id] === 'saved' && (
                <>
                  <Check size={10} />
                  <span>Guardado</span>
                </>
              )}
              {subtaskSaveStatus[st.id] === 'error' && (
                <>
                  <AlertCircle size={10} />
                  <span>Error al guardar</span>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
