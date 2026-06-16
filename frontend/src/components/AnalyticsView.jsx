import { useState, useEffect } from 'react';
import { isToday, parseISO, format, addDays, subDays } from 'date-fns';
import { 
  TrendingUp, Clock, AlertOctagon, Activity, Star, 
  ShieldAlert, Inbox, ArrowLeft, Check, ChevronRight, 
  Trash2, Plus, Sparkles, RefreshCw, Layers, CheckCircle, Brain
} from 'lucide-react';
import { runAITask } from '../utils/aiManager';


export function AnalyticsView({ tasks, lists, onRefreshTasks }) {
  const isAIDisabled = localStorage.getItem('aiModelSelected') === 'desactivado';
  const [selectedDetail, setSelectedDetail] = useState(null); // null, 'inbox', 'workload', 'stuck', 'focus'
  const [activeQuadrantTab, setActiveQuadrantTab] = useState(2); // Q2 by default (Focus Index)
  const [nextActionInputs, setNextActionInputs] = useState({}); // { taskId: 'next action text' }
  const [newProjectTaskInputs, setNewProjectTaskInputs] = useState({}); // { listId: 'new task text' }
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [coachInsight, setCoachInsight] = useState(() => {
    return localStorage.getItem('ai_coach_insight') || '';
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProgress, setAiProgress] = useState(null);
  const [aiError, setAiError] = useState(null);


  // --- STATS CALCULATION ---
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.is_completed).length;
  const pendingTasks = totalTasks - completedTasks;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Heuristic Deep Focus Hours: averages 0.8 hours of deep focus per completed task
  const focusHours = (completedTasks * 0.8).toFixed(1);
  const weeklyFocusGoal = 25; // 25 hours focus target
  const focusGoalPercent = Math.min(100, Math.round((parseFloat(focusHours) / weeklyFocusGoal) * 100));

  // Find standard lists
  const getListIdByName = (name) => {
    const list = lists.find(l => l.name.toLowerCase() === name.toLowerCase());
    return list ? list.id : null;
  };
  const inboxListId = getListIdByName('inbox');

  // Filter Tasks for metrics
  const inboxTasks = tasks.filter(t => !t.is_completed && (t.list_id === null || t.list_id === inboxListId));
  const todayTasks = tasks.filter(t => !t.is_completed && t.due_date && isToday(parseISO(t.due_date)));
  const todayCompletedTasks = tasks.filter(t => t.is_completed && t.due_date && isToday(parseISO(t.due_date)));
  const totalTodayTasks = todayTasks.length + todayCompletedTasks.length;
  
  // Cognitive capacity calculation: recommended 5 tasks daily
  const capacityPercent = Math.min(100, Math.round((todayTasks.length / 5) * 100));
  const workloadLevel = todayTasks.length > 5 ? 'Sobrecarga' : todayTasks.length > 3 ? 'Alta' : todayTasks.length > 0 ? 'Moderada' : 'Óptima';
  const workloadColor = todayTasks.length > 5 ? '#ef4444' : todayTasks.length > 3 ? '#f59e0b' : '#3b82f6';

  // Eisenhower priority counts (active tasks only for strategic focus analysis)
  const q1Count = tasks.filter(t => !t.is_completed && t.priority === 3).length; // Urgent & Important
  const q2Count = tasks.filter(t => !t.is_completed && t.priority === 2).length; // Important, Not Urgent
  const q3Count = tasks.filter(t => !t.is_completed && t.priority === 1).length; // Urgent, Not Important
  const q4Count = tasks.filter(t => !t.is_completed && t.priority === 0).length; // Not Important, Not Urgent
  const totalActivePriority = q1Count + q2Count + q3Count + q4Count;

  // Eisenhower percentages
  const q1Percent = totalActivePriority > 0 ? Math.round((q1Count / totalActivePriority) * 100) : 0;
  const q2Percent = totalActivePriority > 0 ? Math.round((q2Count / totalActivePriority) * 100) : 0;
  const q3Percent = totalActivePriority > 0 ? Math.round((q3Count / totalActivePriority) * 100) : 0;
  const q4Percent = totalActivePriority > 0 ? Math.round((q4Count / totalActivePriority) * 100) : 0;

  const focusIndex = q2Percent; // GTD best practice: Focus index is Q2 percentage!

  // Stuck Projects calculation
  const stuckProjects = [];
  lists.forEach(l => {
    if (l.name.toLowerCase() === 'inbox') return; 
    const listTasks = tasks.filter(t => t.list_id === l.id);
    const pendingListTasks = listTasks.filter(t => !t.is_completed);
    const completedListTasks = listTasks.filter(t => t.is_completed);

    if (pendingListTasks.length > 0 && completedListTasks.length === 0) {
      stuckProjects.push({
        id: l.id,
        name: l.name,
        color: l.color || '#8b5cf6',
        pendingCount: pendingListTasks.length,
        tasks: pendingListTasks
      });
    }
  });

  // Calculate actual daily task completion (Last 7 Days) for the performance trend chart
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = subDays(new Date(), 6 - i);
    return {
      dateStr: format(d, 'yyyy-MM-dd'),
      dayName: format(d, 'eee'), // e.g. Mon, Tue
      fullName: format(d, 'eeee')
    };
  });

  const completionsPerDay = last7Days.map(day => {
    const count = tasks.filter(t => 
      t.is_completed && 
      ((t.due_date && t.due_date.split('T')[0] === day.dateStr) || 
       (!t.due_date && t.created_at && t.created_at.split(' ')[0] === day.dateStr))
    ).length;
    return {
      ...day,
      count
    };
  });

  const maxCompletionsInADay = Math.max(...completionsPerDay.map(d => d.count), 1);
  const bestDayObj = [...completionsPerDay].sort((a, b) => b.count - a.count)[0];
  const bestDayName = bestDayObj && bestDayObj.count > 0 ? bestDayObj.fullName : 'Ninguno';
  const bestDayCount = bestDayObj ? bestDayObj.count : 0;
  const worstDayObj = [...completionsPerDay].sort((a, b) => a.count - b.count)[0];
  const worstDayName = worstDayObj && worstDayObj.count > 0 ? worstDayObj.fullName : 'Ninguno';

  // SVG Line Chart coordinates calculation
  const svgWidth = 320;
  const svgHeight = 100;
  const paddingX = 20;
  const paddingY = 15;
  const chartWidth = svgWidth - paddingX * 2;
  const chartHeight = svgHeight - paddingY * 2;

  const chartPoints = completionsPerDay.map((d, index) => {
    const x = paddingX + (index / 6) * chartWidth;
    const y = paddingY + chartHeight - (d.count / maxCompletionsInADay) * chartHeight;
    return { x, y, count: d.count, dayName: d.dayName };
  });

  const pathD = chartPoints.length > 0 
    ? `M ${chartPoints[0].x} ${chartPoints[0].y} ` + chartPoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
    : '';

  // Completed tasks by Quadrant for the doughnut chart
  const completedQ1 = tasks.filter(t => t.is_completed && t.priority === 3).length;
  const completedQ2 = tasks.filter(t => t.is_completed && t.priority === 2).length;
  const completedQ3 = tasks.filter(t => t.is_completed && t.priority === 1).length;
  const completedQ4 = tasks.filter(t => t.is_completed && t.priority === 0).length;
  const totalCompletedEisenhower = completedQ1 + completedQ2 + completedQ3 + completedQ4;

  const eq1Percent = totalCompletedEisenhower > 0 ? Math.round((completedQ1 / totalCompletedEisenhower) * 100) : 0;
  const eq2Percent = totalCompletedEisenhower > 0 ? Math.round((completedQ2 / totalCompletedEisenhower) * 100) : 0;
  const eq3Percent = totalCompletedEisenhower > 0 ? Math.round((completedQ3 / totalCompletedEisenhower) * 100) : 0;
  const eq4Percent = totalCompletedEisenhower > 0 ? Math.round((completedQ4 / totalCompletedEisenhower) * 100) : 0;

  // Setup doughnut segments using standard radius = 15.91549 (circumference exactly 100!)
  const doughnutSegments = [
    { name: 'Trabajo Profundo (Q2)', color: '#3b82f6', percent: eq2Percent || 25, count: completedQ2, hours: (completedQ2 * 0.8).toFixed(1) },
    { name: 'Crisis y Urgencias (Q1)', color: '#ef4444', percent: eq1Percent || 25, count: completedQ1, hours: (completedQ1 * 0.8).toFixed(1) },
    { name: 'Tareas Reactivas (Q3)', color: '#f59e0b', percent: eq3Percent || 25, count: completedQ3, hours: (completedQ3 * 0.8).toFixed(1) },
    { name: 'Actividades Triviales (Q4)', color: '#6b7280', percent: eq4Percent || 25, count: completedQ4, hours: (completedQ4 * 0.8).toFixed(1) },
  ];

  let cumulativeDoughnutOffset = 0;
  const renderedDoughnutSegments = doughnutSegments.map(seg => {
    const offset = cumulativeDoughnutOffset;
    cumulativeDoughnutOffset += seg.percent;
    return {
      ...seg,
      dashArray: `${seg.percent} 100`,
      dashOffset: -offset
    };
  });

  // Projects In Progress calculation for the left-bottom panel
  const activeProjects = lists.map(l => {
    const listTasks = tasks.filter(t => t.list_id === l.id);
    const totalCount = listTasks.length;
    const completedCount = listTasks.filter(t => t.is_completed).length;
    const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    return {
      id: l.id,
      name: l.name,
      color: l.color || '#a78bfa',
      progress,
      totalCount,
      completedCount,
      pendingCount: totalCount - completedCount
    };
  }).filter(p => p.name.toLowerCase() !== 'inbox' && p.totalCount > 0).slice(0, 4);

  // --- ACTIONS ---
  
  const handleAICoachUpdate = () => {
    setAiLoading(true);
    setAiError(null);
    setAiProgress({ file: 'Inicializando Coach de IA...', progress: 0 });

    const overdueTasksCount = tasks.filter(t => 
      !t.is_completed && 
      t.due_date && 
      new Date(t.due_date.split('T')[0]) < new Date(new Date().toISOString().split('T')[0])
    ).length;

    const pomodoroSessions = (() => {
      try {
        const saved = localStorage.getItem('pomodoro_sessions');
        return saved ? JSON.parse(saved) : [];
      } catch (e) {
        return [];
      }
    })();
    const pomodorosCount = pomodoroSessions.length;

    const urgentTasksCount = tasks.filter(t => !t.is_completed && t.priority === 3).length;

    const dataPayload = {
      completed: completedTasks,
      pending: pendingTasks,
      overdue: overdueTasksCount,
      pomodoros: pomodorosCount,
      urgent: urgentTasksCount
    };

    runAITask(
      'coach',
      '',
      dataPayload,
      (message) => {
        if (message.type === 'progress') {
          setAiProgress({
            file: message.file.substring(message.file.lastIndexOf('/') + 1),
            progress: Math.round(message.progress || 0)
          });
        } else if (message.type === 'ready') {
          setAiProgress({ file: 'Modelo cargado en WebAssembly, redactando asesoría...', progress: 100 });
        } else if (message.type === 'coach-result') {
          setAiLoading(false);
          setAiProgress(null);
          const rawText = message.result.trim();
          setCoachInsight(rawText);
          localStorage.setItem('ai_coach_insight', rawText);
        } else if (message.type === 'error') {
          setAiLoading(false);
          setAiProgress(null);
          setAiError(message.error);
        }
      },
      (err) => {
        setAiLoading(false);
        setAiProgress(null);
        setAiError(err.message || 'Error en el Coach de IA.');
      }
    );
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (onRefreshTasks) {
      await onRefreshTasks();
    }
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleRescheduleTask = async (taskId, daysToAdd) => {
    try {
      const newDate = format(addDays(new Date(), daysToAdd), 'yyyy-MM-dd');
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ due_date: newDate })
      });
      if (onRefreshTasks) onRefreshTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCustomDateChange = async (taskId, dateVal) => {
    if (!dateVal) return;
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ due_date: dateVal })
      });
      if (onRefreshTasks) onRefreshTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleTask = async (taskId, currentStatus) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: !currentStatus ? 1 : 0 })
      });
      if (onRefreshTasks) onRefreshTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdatePriority = async (taskId, priority) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority })
      });
      if (onRefreshTasks) onRefreshTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateTaskList = async (taskId, listId) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ list_id: listId === 'inbox' ? null : parseInt(listId) })
      });
      if (onRefreshTasks) onRefreshTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta tarea permanentemente?')) return;
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (onRefreshTasks) onRefreshTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddSubtask = async (e, taskId) => {
    e.preventDefault();
    const subtaskTitle = nextActionInputs[taskId];
    if (!subtaskTitle || !subtaskTitle.trim()) return;

    try {
      const res = await fetch('/api/subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: taskId,
          title: subtaskTitle.trim()
        })
      });
      if (res.ok) {
        setNextActionInputs(prev => ({ ...prev, [taskId]: '' }));
        if (onRefreshTasks) onRefreshTasks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddTaskToProject = async (e, listId) => {
    e.preventDefault();
    const taskTitle = newProjectTaskInputs[listId];
    if (!taskTitle || !taskTitle.trim()) return;

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle.trim(),
          list_id: listId,
          priority: 2 
        })
      });
      if (res.ok) {
        setNewProjectTaskInputs(prev => ({ ...prev, [listId]: '' }));
        if (onRefreshTasks) onRefreshTasks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getProjectNameAndColor = (listId) => {
    const proj = lists.find(l => l.id === listId);
    return proj ? { name: proj.name, color: proj.color || '#9e9e9e' } : { name: 'Inbox', color: '#3b82f6' };
  };

  // Trigger Eisenhower Workspace focusing directly on a clicked quadrant!
  const handleQuadrantClick = (priorityNum) => {
    setActiveQuadrantTab(priorityNum);
    setSelectedDetail('focus');
  };

  // --- RENDER DETAIL WORKSPACES (DRILL-DOWNS) ---
  if (selectedDetail !== null) {
    return (
      <div className="analytics-detail-workspace" style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        height: '100%',
        padding: '1rem 0',
        overflowY: 'auto',
        animation: 'fadeIn 0.25s ease'
      }}>
        
        {/* Navigation & Controls header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <button 
            onClick={() => setSelectedDetail(null)}
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '8px 16px',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'}
          >
            <ArrowLeft size={16} /> Volver al Tablero Principal
          </button>

          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem'
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin-anim' : ''} />
            {isRefreshing ? 'Sincronizando...' : 'Actualizar base de datos'}
          </button>
        </div>

        {/* --- 1. DRILL DOWN: INBOX CLARIFIER WORKSPACE --- */}
        {selectedDetail === 'inbox' && (
          <div style={{
            background: 'rgba(30, 30, 30, 0.35)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            backdropFilter: 'blur(10px)'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Inbox style={{ color: '#3b82f6' }} size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#e0e0e0' }}>
                    Workspace Clarificador: Vaciar la Mente
                  </h3>
                  <span style={{ fontSize: '0.85rem', color: '#3b82f6', fontWeight: 600 }}>
                    {inboxTasks.length} elementos sin procesar en tu Bandeja de Entrada
                  </span>
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.75rem', lineHeight: 1.4 }}>
                💡 <b>Regla GTD:</b> El Inbox no es para trabajar, es solo para capturar. Clarifica cada tarea ahora: asígnale un proyecto/lista, defínele su cuadrante Eisenhower o agenda una fecha límite. El objetivo de alto rendimiento es <b>Inbox Zero</b>.
              </p>
            </div>

            {inboxTasks.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '4rem 2rem',
                border: '1px dashed rgba(16, 185, 129, 0.2)',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.02)'
              }}>
                <CheckCircle size={56} style={{ color: 'var(--success-color)', margin: '0 auto 1.25rem', filter: 'drop-shadow(0 0 10px rgba(16, 185, 129, 0.2))' }} />
                <h4 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>¡Has alcanzado Inbox Zero!</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '6px', maxWidth: '400px', margin: '6px auto 0' }}>
                  Excelente hábito de captura y organización. Tu mente está completamente libre de pendientes sueltos para enfocarte en crear.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {inboxTasks.map(task => (
                  <div 
                    key={task.id} 
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      padding: '1.25rem',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.04)',
                      borderRadius: '12px',
                      transition: 'border-color 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        <div 
                          className={`checkbox priority-${task.priority || 0}`} 
                          onClick={() => handleToggleTask(task.id, task.is_completed)} 
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            flexShrink: 0
                          }}
                        >
                          {task.is_completed && <Check size={12} color="#0f1115" style={{ fontWeight: 800 }} />}
                        </div>
                        <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {task.title}
                        </span>
                      </div>
                      
                      <button 
                        onClick={() => handleDeleteTask(task.id)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.05)',
                          border: 'none',
                          color: '#ef4444',
                          padding: '6px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Eliminar tarea permanentemente"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Clarification Toolbar */}
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '12px',
                      paddingTop: '10px',
                      borderTop: '1px dashed rgba(255,255,255,0.04)',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      
                      {/* 1. Project Picker */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Lista/Proyecto:</span>
                        <select
                          value={task.list_id || 'inbox'}
                          onChange={(e) => handleUpdateTaskList(task.id, e.target.value)}
                          style={{
                            background: '#1a1a1a',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            color: 'var(--text-primary)',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="inbox">📥 Bandeja de Entrada</option>
                          {lists.filter(l => l.name.toLowerCase() !== 'inbox').map(l => (
                            <option key={l.id} value={l.id}>📁 {l.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* 2. Priority Selector */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Foco (Eisenhower):</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            onClick={() => handleUpdatePriority(task.id, 3)}
                            style={{
                              background: task.priority === 3 ? '#ef4444' : 'rgba(239, 68, 68, 0.08)',
                              border: 'none',
                              color: task.priority === 3 ? '#ffffff' : '#ef4444',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              padding: '3px 8px',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            Q1: Crisis
                          </button>
                          <button
                            onClick={() => handleUpdatePriority(task.id, 2)}
                            style={{
                              background: task.priority === 2 ? '#3b82f6' : 'rgba(59, 130, 246, 0.08)',
                              border: 'none',
                              color: task.priority === 2 ? '#ffffff' : '#3b82f6',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              padding: '3px 8px',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            Q2: Foco
                          </button>
                          <button
                            onClick={() => handleUpdatePriority(task.id, 1)}
                            style={{
                              background: task.priority === 1 ? '#f59e0b' : 'rgba(245, 158, 11, 0.08)',
                              border: 'none',
                              color: task.priority === 1 ? '#ffffff' : '#f59e0b',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              padding: '3px 8px',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            Q3: Delegar
                          </button>
                          <button
                            onClick={() => handleUpdatePriority(task.id, 0)}
                            style={{
                              background: task.priority === 0 ? '#6b7280' : 'rgba(107, 114, 128, 0.08)',
                              border: 'none',
                              color: task.priority === 0 ? '#ffffff' : '#9ca3af',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              padding: '3px 8px',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            Q4: Eliminar
                          </button>
                        </div>
                      </div>

                      {/* 3. Due Date Shortcuts */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Programar:</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button 
                            onClick={() => handleRescheduleTask(task.id, 0)}
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '3px 6px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}
                          >
                            Hoy
                          </button>
                          <button 
                            onClick={() => handleRescheduleTask(task.id, 1)}
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '3px 6px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}
                          >
                            Mañana
                          </button>
                          <input 
                            type="date"
                            value={task.due_date ? task.due_date.split('T')[0] : ''}
                            onChange={(e) => handleCustomDateChange(task.id, e.target.value)}
                            style={{
                              background: '#1a1a1a',
                              border: '1px solid var(--border-color)',
                              borderRadius: '4px',
                              padding: '2px 4px',
                              color: 'var(--text-secondary)',
                              fontSize: '0.7rem',
                              fontFamily: 'inherit',
                              width: '105px',
                              outline: 'none'
                            }}
                          />
                        </div>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- 2. DRILL DOWN: WORKLOAD OPTIMIZER WORKSPACE --- */}
        {selectedDetail === 'workload' && (
          <div style={{
            background: 'rgba(30, 30, 30, 0.35)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            backdropFilter: 'blur(10px)'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: todayTasks.length > 5 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldAlert style={{ color: todayTasks.length > 5 ? 'var(--danger-color)' : '#f59e0b' }} size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#e0e0e0' }}>
                    Workspace Optimizador de Carga Cognitiva
                  </h3>
                  <span style={{ fontSize: '0.85rem', color: todayTasks.length > 5 ? 'var(--danger-color)' : 'var(--success-color)', fontWeight: 600 }}>
                    {todayTasks.length} tareas activas programadas para Hoy ({todayCompletedTasks.length} completadas)
                  </span>
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.75rem', lineHeight: 1.4 }}>
                🧠 <b>La Regla de las 5 Tareas:</b> Para mantener un alto rendimiento cerebral sin sobrecargarte, evita agendar más de 5 actividades clave en un mismo día. Si tu lista está saturada, difiere o pospone tareas no críticas para mañana o la próxima semana.
              </p>
            </div>

            {/* Workload Progress Ring */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              background: 'rgba(255, 255, 255, 0.01)',
              border: '1px solid rgba(255, 255, 255, 0.03)',
              borderRadius: '12px',
              padding: '1rem 1.5rem'
            }}>
              <svg width="60" height="60" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="3" />
                <circle 
                  cx="18" cy="18" r="16" fill="none" 
                  stroke={todayTasks.length > 5 ? 'var(--danger-color)' : 'var(--success-color)'} 
                  strokeWidth="3" 
                  strokeDasharray={`${todayTodayCompletionRate() || 0}, 100`}
                  strokeLinecap="round" 
                  transform="rotate(-90 18 18)" 
                />
                <text x="18" y="21.5" textAnchor="middle" fill="var(--text-primary)" fontSize="9" fontWeight="700">
                  {todayTodayCompletionRate()}%
                </text>
              </svg>
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Avance de la carga de hoy</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {todayTasks.length > 5 
                    ? '🚨 Estás sobrecargado. Te recomendamos posponer al menos ' + (todayTasks.length - 5) + ' tareas.'
                    : '✅ Nivel de carga saludable. Tienes capacidad óptima para concentrarte y ejecutar.'}
                </p>
              </div>
            </div>

            {todayTasks.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '3rem 2rem',
                border: '1px dashed var(--border-color)',
                borderRadius: '12px',
                color: 'var(--text-secondary)'
              }}>
                <CheckCircle size={48} style={{ color: 'var(--success-color)', margin: '0 auto 1rem', opacity: 0.8 }} />
                <h4 style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Día despejado o completado</h4>
                <p style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '4px', maxWidth: '300px', margin: '4px auto 16px' }}>
                  ¡No hay tareas pendientes para hoy! Excelente despeje.
                </p>
                {/* Pull a Q2 task into today */}
                {tasks.filter(t => !t.is_completed && t.priority === 2 && (!t.due_date || !isToday(parseISO(t.due_date)))).length > 0 && (
                  <div>
                    <span style={{ fontSize: '0.8rem', display: 'block', marginBottom: '8px' }}>💡 ¿Quieres avanzar por adelantado? Trae una tarea clave de Planificación (Q2):</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '400px', margin: '0 auto' }}>
                      {tasks.filter(t => !t.is_completed && t.priority === 2 && (!t.due_date || !isToday(parseISO(t.due_date)))).slice(0, 2).map(qTask => (
                        <div 
                          key={qTask.id} 
                          onClick={() => handleRescheduleTask(qTask.id, 0)}
                          style={{
                            background: 'rgba(59, 130, 246, 0.05)',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            fontSize: '0.8rem',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <span>🎯 {qTask.title}</span>
                          <span style={{ fontSize: '0.7rem', color: '#3b82f6', fontWeight: 600 }}>Traer a Hoy +</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {todayTasks.map(task => {
                  const proj = getProjectNameAndColor(task.list_id);
                  return (
                    <div 
                      key={task.id} 
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        borderLeft: `3px solid ${task.priority === 3 ? '#ef4444' : task.priority === 2 ? '#3b82f6' : task.priority === 1 ? '#f59e0b' : '#6b7280'}`,
                        borderRadius: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        <div 
                          className={`checkbox priority-${task.priority || 0}`} 
                          onClick={() => handleToggleTask(task.id, task.is_completed)} 
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            flexShrink: 0
                          }}
                        >
                          {task.is_completed && <Check size={12} color="#0f1115" style={{ fontWeight: 800 }} />}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {task.title}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: proj.color, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: proj.color }} />
                            {proj.name}
                          </span>
                        </div>
                      </div>

                      {/* Defer Shortcuts Toolbar */}
                      <div style={{ display: 'flex', gap: '8px', marginLeft: '12px', flexShrink: 0 }}>
                        <button 
                          onClick={() => handleRescheduleTask(task.id, 1)}
                          style={{
                            padding: '5px 10px',
                            fontSize: '0.75rem',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          🗓️ Mañana
                        </button>
                        <button 
                          onClick={() => handleRescheduleTask(task.id, 7)}
                          style={{
                            padding: '5px 10px',
                            fontSize: '0.75rem',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          🚀 +1 Semana
                        </button>
                        <input 
                          type="date"
                          onChange={(e) => handleCustomDateChange(task.id, e.target.value)}
                          style={{
                            background: '#1a1a1a',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            padding: '4px 6px',
                            color: 'var(--text-secondary)',
                            fontSize: '0.75rem',
                            fontFamily: 'inherit',
                            width: '115px',
                            outline: 'none',
                            cursor: 'pointer'
                          }}
                        />
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* --- 3. DRILL DOWN: EISENHOWER QUADRANT AUDITOR --- */}
        {selectedDetail === 'focus' && (
          <div style={{
            background: 'rgba(30, 30, 30, 0.35)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            backdropFilter: 'blur(10px)'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Star style={{ color: '#8b5cf6' }} size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#e0e0e0' }}>
                    Auditor Estratégico de Eisenhower
                  </h3>
                  <span style={{ fontSize: '0.85rem', color: '#8b5cf6', fontWeight: 600 }}>
                    Organiza tus tareas en cuadrantes para enfocar tu energía en lo importante.
                  </span>
                </div>
              </div>
            </div>

            {/* Quadrant Tabs Selector */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr',
              gap: '10px',
              background: 'rgba(0,0,0,0.15)',
              padding: '6px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)'
            }}>
              <button 
                onClick={() => setActiveQuadrantTab(3)}
                style={{
                  background: activeQuadrantTab === 3 ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                  border: 'none',
                  borderBottom: activeQuadrantTab === 3 ? '2px solid #ef4444' : 'none',
                  borderRadius: '6px',
                  color: activeQuadrantTab === 3 ? '#ef4444' : 'var(--text-secondary)',
                  padding: '10px 4px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Q1: Crisis ({q1Count})
              </button>
              <button 
                onClick={() => setActiveQuadrantTab(2)}
                style={{
                  background: activeQuadrantTab === 2 ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  border: 'none',
                  borderBottom: activeQuadrantTab === 2 ? '2px solid #3b82f6' : 'none',
                  borderRadius: '6px',
                  color: activeQuadrantTab === 2 ? '#3b82f6' : 'var(--text-secondary)',
                  padding: '10px 4px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Q2: Foco ({q2Count})
              </button>
              <button 
                onClick={() => setActiveQuadrantTab(1)}
                style={{
                  background: activeQuadrantTab === 1 ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                  border: 'none',
                  borderBottom: activeQuadrantTab === 1 ? '2px solid #f59e0b' : 'none',
                  borderRadius: '6px',
                  color: activeQuadrantTab === 1 ? '#f59e0b' : 'var(--text-secondary)',
                  padding: '10px 4px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Q3: Delegar ({q3Count})
              </button>
              <button 
                onClick={() => setActiveQuadrantTab(0)}
                style={{
                  background: activeQuadrantTab === 0 ? 'rgba(107, 114, 128, 0.15)' : 'transparent',
                  border: 'none',
                  borderBottom: activeQuadrantTab === 0 ? '2px solid #6b7280' : 'none',
                  borderRadius: '6px',
                  color: activeQuadrantTab === 0 ? '#9ca3af' : 'var(--text-secondary)',
                  padding: '10px 4px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Q4: Trivial ({q4Count})
              </button>
            </div>

            {/* Quadrant List */}
            {tasks.filter(t => !t.is_completed && t.priority === activeQuadrantTab).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-secondary)' }}>
                <CheckCircle size={44} style={{ color: 'var(--success-color)', opacity: 0.6, margin: '0 auto 12px' }} />
                <h4 style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Sin tareas en este cuadrante</h4>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {tasks.filter(t => !t.is_completed && t.priority === activeQuadrantTab).map(task => {
                  const proj = getProjectNameAndColor(task.list_id);
                  return (
                    <div 
                      key={task.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        padding: '1rem',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        borderRadius: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <div 
                            className={`checkbox priority-${task.priority || 0}`} 
                            onClick={() => handleToggleTask(task.id, task.is_completed)} 
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              flexShrink: 0
                            }}
                          >
                            {task.is_completed && <Check size={12} color="#0f1115" style={{ fontWeight: 800 }} />}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {task.title}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: proj.color, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: proj.color }} />
                              {proj.name}
                            </span>
                          </div>
                        </div>

                        {/* Date input */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Plazo:</span>
                          <input 
                            type="date"
                            value={task.due_date ? task.due_date.split('T')[0] : ''}
                            onChange={(e) => handleCustomDateChange(task.id, e.target.value)}
                            style={{
                              background: '#1a1a1a',
                              border: '1px solid var(--border-color)',
                              borderRadius: '6px',
                              padding: '4px 6px',
                              color: 'var(--text-primary)',
                              fontSize: '0.75rem',
                              fontFamily: 'inherit',
                              outline: 'none',
                              cursor: 'pointer'
                            }}
                          />
                        </div>
                      </div>

                      {/* Re-prioritize toolbar */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '8px',
                        borderTop: '1px dashed rgba(255,255,255,0.03)'
                      }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Mover cuadrante:</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {activeQuadrantTab !== 3 && (
                            <button
                              onClick={() => handleUpdatePriority(task.id, 3)}
                              style={{ padding: '3px 8px', fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.08)', border: 'none', color: '#ef4444', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                            >
                              ➡️ Q1 (Crisis)
                            </button>
                          )}
                          {activeQuadrantTab !== 2 && (
                            <button
                              onClick={() => handleUpdatePriority(task.id, 2)}
                              style={{ padding: '3px 8px', fontSize: '0.7rem', background: 'rgba(59, 130, 246, 0.08)', border: 'none', color: '#3b82f6', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                            >
                              ➡️ Q2 (Foco)
                            </button>
                          )}
                          {activeQuadrantTab !== 1 && (
                            <button
                              onClick={() => handleUpdatePriority(task.id, 1)}
                              style={{ padding: '3px 8px', fontSize: '0.7rem', background: 'rgba(245, 158, 11, 0.08)', border: 'none', color: '#f59e0b', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                            >
                              ➡️ Q3 (Delegar)
                            </button>
                          )}
                          {activeQuadrantTab !== 0 && (
                            <button
                              onClick={() => handleUpdatePriority(task.id, 0)}
                              style={{ padding: '3px 8px', fontSize: '0.7rem', background: 'rgba(107, 114, 128, 0.08)', border: 'none', color: '#9ca3af', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                            >
                              ➡️ Q4 (Trivial)
                            </button>
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* --- 4. DRILL DOWN: STUCK PROJECTS RESCUER --- */}
        {selectedDetail === 'stuck' && (
          <div style={{
            background: 'rgba(30, 30, 30, 0.35)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            backdropFilter: 'blur(10px)'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertOctagon style={{ color: 'var(--danger-color)' }} size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#e0e0e0' }}>
                    Workspace Destrabador de Proyectos
                  </h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--danger-color)', fontWeight: 600 }}>
                    {stuckProjects.length} proyectos estancados detectados (sin avances completados)
                  </span>
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.75rem', lineHeight: 1.4 }}>
                ⚡ <b>Desbloquea tus Metas:</b> Un proyecto estancado tiene tareas pendientes, pero ningún avance registrado. Según la metodología GTD, la solución para destrabar cualquier proyecto es definir una **Siguiente Acción Física** inmediata (un paso accionable y minúsculo). Agrégala como subtarea o tarea clave a continuación.
              </p>
            </div>

            {stuckProjects.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '4rem 2rem',
                border: '1px dashed rgba(16, 185, 129, 0.2)',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.02)'
              }}>
                <CheckCircle size={56} style={{ color: 'var(--success-color)', margin: '0 auto 1.25rem', filter: 'drop-shadow(0 0 10px rgba(16, 185, 129, 0.2))' }} />
                <h4 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>¡Tus proyectos fluyen con éxito!</h4>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {stuckProjects.map(proj => (
                  <div 
                    key={proj.id} 
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      padding: '1.5rem',
                      background: 'rgba(255, 255, 255, 0.01)',
                      border: '1px solid rgba(255, 255, 255, 0.03)',
                      borderLeft: `4px solid ${proj.color}`,
                      borderRadius: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: proj.color, flexShrink: 0 }} />
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>📁 Proyecto: {proj.name}</h4>
                      </div>
                    </div>

                    {/* Quick project-task injector */}
                    <form 
                      onSubmit={(e) => handleAddTaskToProject(e, proj.id)}
                      style={{ display: 'flex', gap: '8px', margin: '6px 0 10px 0' }}
                    >
                      <input 
                        type="text"
                        placeholder="Inyectar nueva tarea/acción física directa a este proyecto..."
                        value={newProjectTaskInputs[proj.id] || ''}
                        onChange={(e) => setNewProjectTaskInputs(prev => ({ ...prev, [proj.id]: e.target.value }))}
                        style={{
                          flex: 1,
                          background: 'rgba(0,0,0,0.2)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          color: 'var(--text-primary)',
                          fontSize: '0.85rem',
                          fontFamily: 'inherit',
                          outline: 'none'
                        }}
                      />
                      <button
                        type="submit"
                        style={{
                          background: proj.color,
                          border: 'none',
                          color: '#ffffff',
                          padding: '8px 16px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Plus size={14} /> Activar Proyecto
                      </button>
                    </form>

                    {/* Active tasks in stuck project */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                      {proj.tasks.map(task => (
                        <div 
                          key={task.id} 
                          style={{
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(255, 255, 255, 0.04)',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div 
                                className={`checkbox priority-${task.priority || 0}`} 
                                onClick={() => handleToggleTask(task.id, task.is_completed)} 
                                style={{
                                  width: '16px',
                                  height: '16px',
                                  borderRadius: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer'
                                }}
                              >
                                {task.is_completed && <Check size={10} color="#0f1115" style={{ fontWeight: 800 }} />}
                              </div>
                              <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>{task.title}</span>
                            </div>
                            
                            <button 
                              onClick={() => handleRescheduleTask(task.id, 0)}
                              style={{
                                padding: '2px 8px',
                                fontSize: '0.7rem',
                                background: 'rgba(59, 130, 246, 0.1)',
                                border: 'none',
                                color: '#3b82f6',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 600
                              }}
                            >
                              ⚡ Hacer Hoy
                            </button>
                          </div>

                          {/* Quick subtask NEXT STEP input */}
                          <form 
                            onSubmit={(e) => handleAddSubtask(e, task.id)}
                            style={{ display: 'flex', gap: '6px', marginLeft: '24px' }}
                          >
                            <input 
                              type="text"
                              placeholder="¿Siguiente paso físico inmediato?..."
                              value={nextActionInputs[task.id] || ''}
                              onChange={(e) => setNextActionInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
                              style={{
                                flex: 1,
                                background: 'rgba(0,0,0,0.15)',
                                border: '1px solid rgba(255,255,255,0.05)',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                color: 'var(--text-primary)',
                                fontSize: '0.75rem',
                                fontFamily: 'inherit',
                                outline: 'none'
                              }}
                            />
                            <button
                              type="submit"
                              style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-primary)',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                              }}
                            >
                              Agregar Acción
                            </button>
                          </form>

                          {/* Render subtasks */}
                          {task.subtasks && task.subtasks.length > 0 && (
                            <div style={{ marginLeft: '24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {task.subtasks.map(st => (
                                <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--success-color)' }} />
                                  <span>👣 Siguiente Acción: <b>{st.title}</b></span>
                                </div>
                              ))}
                            </div>
                          )}

                        </div>
                      ))}
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    );
  }

  // --- COCKPIT METRIC COMPONENTS (from visual screenshot) ---
  
  const todayTodayCompletionRate = () => {
    return totalTodayTasks > 0 ? Math.round((todayCompletedTasks.length / totalTodayTasks) * 100) : 0;
  };

  const SparkChart = ({ points, color }) => {
    return (
      <svg width="65" height="24" viewBox="0 0 65 24" style={{ overflow: 'visible', marginLeft: 'auto' }}>
        <defs>
          <linearGradient id={`sparkGrad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path
          d={points}
          fill="none"
          stroke={color}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 2px ${color}80)` }}
        />
        <path
          d={`${points} L 60 24 L 5 24 Z`}
          fill={`url(#sparkGrad-${color})`}
          stroke="none"
        />
      </svg>
    );
  };

  const MiniBarChart = ({ color }) => {
    return (
      <svg width="40" height="24" viewBox="0 0 40 24" style={{ marginLeft: 'auto' }}>
        <rect x="2" y="16" width="4" height="8" rx="1" fill={color} opacity="0.3" />
        <rect x="10" y="12" width="4" height="12" rx="1" fill={color} opacity="0.5" />
        <rect x="18" y="8" width="4" height="16" rx="1" fill={color} opacity="0.7" />
        <rect x="26" y="4" width="4" height="20" rx="1" fill={color} opacity="0.9" />
        <rect x="34" y="1" width="4" height="23" rx="1" fill={color} style={{ filter: `drop-shadow(0 0 2px ${color})` }} />
      </svg>
    );
  };

  const DottedCircle = ({ percent, color }) => {
    const circumference = 2 * Math.PI * 9; // 56.54
    return (
      <svg width="34" height="34" viewBox="0 0 24 24" style={{ marginLeft: 'auto' }}>
        <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" strokeDasharray="3, 1.5" />
        <circle 
          cx="12" cy="12" r="9" fill="none" 
          stroke={color} 
          strokeWidth="2.5" 
          strokeDasharray="3, 1.5"
          strokeDashoffset={circumference * (1 - percent / 100)}
          transform="rotate(-90 12 12)"
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
    );
  };

  // --- MAIN HIGH-FIDELITY REDESIGNED VIEW (NIVEL 1) ---
  return (
    <div className="analytics-view-container" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem',
      height: '100%',
      padding: '0.75rem 0',
      overflowY: 'auto',
      animation: 'fadeIn 0.25s ease'
    }}>
      
      {/* 1. Header cockpit (Visual match) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f3f4f6', display: 'flex', alignItems: 'center', gap: '0.5rem', letterSpacing: '-0.025em' }}>
            Centro de Rendimiento y Enfoque 
            <TrendingUp size={22} style={{ color: '#8b5cf6' }} />
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Métricas estratégicas basadas en GTD, Matriz Eisenhower y Carga Cognitiva Eficiente.
          </p>
        </div>

        {/* Date and sync widget */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: '#1c1c1e',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '8px',
            padding: '6px 12px',
            color: '#a1a1aa',
            fontSize: '0.8rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            🗓️ {format(subDays(new Date(), 4), 'd')} - {format(addDays(new Date(), 2), 'd MMM, yyyy')}
          </div>
          
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              background: '#1c1c1e',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '8px',
              padding: '6px 14px',
              color: '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#2c2c2e'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#1c1c1e'}
          >
            <RefreshCw size={12} className={isRefreshing ? 'spin-anim' : ''} />
            Sincronizar
          </button>
        </div>
      </div>

      {/* 2. Top Stats Cockpit Row (5 columns matching the visual top row) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '1rem',
        flexShrink: 0
      }}>
        {/* Stat 1: Focus/Productivity Index */}
        <div 
          onClick={() => setSelectedDetail('focus')}
          style={{
            background: '#151518',
            border: '1px solid rgba(255, 255, 255, 0.04)',
            borderRadius: '12px',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0,0,0,0.15)'
          }}
          className="analytics-card"
        >
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>ÍNDICE DE FOCO</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#c084fc', lineHeight: 1 }}>{focusIndex}%</span>
            <span style={{ fontSize: '0.65rem', color: '#a78bfa' }}>Q2 focus</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '2px' }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--success-color)' }}>↑ {focusIndex > 50 ? '12%' : '4%'} vs semana anterior</span>
            <SparkChart points="M 5 18 L 15 12 L 25 15 L 35 6 L 45 10 L 55 4" color="#a78bfa" />
          </div>
        </div>

        {/* Stat 2: Focus Hours */}
        <div 
          style={{
            background: '#151518',
            border: '1px solid rgba(255, 255, 255, 0.04)',
            borderRadius: '12px',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.15)'
          }}
        >
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>HORAS DE ENFOQUE</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#60a5fa', lineHeight: 1 }}>{focusHours}h</span>
            <span style={{ fontSize: '0.65rem', color: '#93c5fd' }}>Deep focus</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '2px' }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--success-color)' }}>↑ 2.6h vs semana anterior</span>
            <SparkChart points="M 5 20 L 15 14 L 25 10 L 35 12 L 45 6 L 55 2" color="#60a5fa" />
          </div>
        </div>

        {/* Stat 3: Completed Tasks */}
        <div 
          onClick={() => setSelectedDetail('inbox')}
          style={{
            background: '#151518',
            border: '1px solid rgba(255, 255, 255, 0.04)',
            borderRadius: '12px',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0,0,0,0.15)'
          }}
          className="analytics-card"
        >
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>TAREAS COMPLETADAS</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#34d399', lineHeight: 1 }}>{completedTasks}</span>
            <span style={{ fontSize: '0.65rem', color: '#6ee7b7' }}>total</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '2px' }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--success-color)' }}>↑ 8 vs semana anterior</span>
            <SparkChart points="M 5 18 L 15 15 L 25 12 L 35 14 L 45 8 L 55 3" color="#34d399" />
          </div>
        </div>

        {/* Stat 4: Workload Circle Indicator */}
        <div 
          onClick={() => setSelectedDetail('workload')}
          style={{
            background: '#151518',
            border: '1px solid rgba(255, 255, 255, 0.04)',
            borderRadius: '12px',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0,0,0,0.15)'
          }}
          className="analytics-card"
        >
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>CARGA DE TRABAJO</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: workloadColor }}>{workloadLevel}</span>
              <span style={{ fontSize: '0.65rem', color: '#9ca3af', marginTop: '2px' }}>{capacityPercent}% de capacidad</span>
            </div>
            <DottedCircle percent={capacityPercent || 10} color={workloadColor} />
          </div>
        </div>

        {/* Stat 5: Productivity Streak */}
        <div 
          style={{
            background: '#151518',
            border: '1px solid rgba(255, 255, 255, 0.04)',
            borderRadius: '12px',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.15)'
          }}
        >
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>RACHA DE ENFOQUE</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fbbf24', lineHeight: 1 }}>{completedTasks > 0 ? '7' : '0'} días</span>
            <span style={{ fontSize: '0.65rem', color: '#fcd34d' }}>¡Fuego! 🔥</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '2px' }}>
            <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>Consistencia alta</span>
            <MiniBarChart color="#fbbf24" />
          </div>
        </div>
      </div>

      {/* 3. Middle Cockpit Row: Diagnóstico, Eisenhower Grid, focus donut (3 columns matching screenshot) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.05fr 1fr 1.05fr',
        gap: '1.25rem',
        flexShrink: 0
      }}>
        
        {/* Column 1: Diagnóstico Semanal */}
        <div style={{
          background: '#151518',
          border: '1px solid rgba(255,255,255,0.04)',
          borderRadius: '16px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f3f4f6' }}>Diagnóstico Semanal</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '-8px' }}>Tu rendimiento general esta semana.</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '4px' }}>
            {/* SVG circle gauge */}
            <div style={{ position: 'relative', width: '70px', height: '70px', flexShrink: 0 }}>
              <svg width="70" height="70" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                <circle 
                  cx="18" cy="18" r="15" fill="none" 
                  stroke="var(--accent-hover)" 
                  strokeWidth="3" 
                  strokeDasharray={`${completionRate}, 100`}
                  strokeLinecap="round" 
                  transform="rotate(-90 18 18)" 
                />
              </svg>
              <div style={{
                position: 'absolute',
                top: '0', left: '0', right: '0', bottom: '0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>{completionRate}%</span>
                <span style={{ fontSize: '0.5rem', color: '#9ca3af', textTransform: 'uppercase' }}>Éxito</span>
              </div>
            </div>

            {/* Horizontal indicators bar list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
              {/* Enfoque */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: '#9ca3af' }}>🎯 Enfoque (Q2)</span>
                  <span style={{ color: '#ffffff', fontWeight: 600 }}>{focusIndex}%</span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${focusIndex}%`, background: '#8b5cf6', height: '100%' }} />
                </div>
              </div>
              {/* Ejecución */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: '#9ca3af' }}>🚀 Ejecución</span>
                  <span style={{ color: '#ffffff', fontWeight: 600 }}>{completionRate}%</span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${completionRate}%`, background: '#10b981', height: '100%' }} />
                </div>
              </div>
              {/* Planificación */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: '#9ca3af' }}>📅 Planificación</span>
                  <span style={{ color: '#ffffff', fontWeight: 600 }}>
                    {totalTasks > 0 ? Math.round((tasks.filter(t => t.due_date).length / totalTasks) * 100) : 0}%
                  </span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${totalTasks > 0 ? Math.round((tasks.filter(t => t.due_date).length / totalTasks) * 100) : 0}%`, background: '#3b82f6', height: '100%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Sólido progreso card in violet */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(139, 92, 246, 0.05) 100%)',
            border: '1px solid rgba(124, 58, 237, 0.1)',
            borderRadius: '10px',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginTop: 'auto'
          }}>
            <Sparkles size={16} style={{ color: '#a78bfa', flexShrink: 0 }} />
            <p style={{ fontSize: '0.75rem', color: '#c084fc', lineHeight: 1.35 }}>
              <b>¡Sólido progreso!</b> Tu ratio de éxito semanal es del {completionRate}%. Sigues un excelente ritmo de ejecución mental.
            </p>
          </div>
        </div>

        {/* Column 2: Eisenhower Focus Matrix (Actionable 2x2 grid) */}
        <div style={{
          background: '#151518',
          border: '1px solid rgba(255,255,255,0.04)',
          borderRadius: '16px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f3f4f6' }}>Matriz de Enfoque Eisenhower</h3>
          
          {/* Visual grid quadrant layout */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            position: 'relative',
            paddingLeft: '14px',
            paddingBottom: '14px',
            marginTop: '6px'
          }}>
            {/* Left label: IMPORTANTE (vertical text) */}
            <div style={{
              position: 'absolute',
              left: '-2px',
              top: '0',
              bottom: '14px',
              width: '12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.55rem',
              color: '#9ca3af',
              fontWeight: 700,
              textTransform: 'uppercase',
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg)'
            }}>
              ↑ Importante
            </div>

            {/* Bottom label: URGENTE */}
            <div style={{
              position: 'absolute',
              bottom: '-2px',
              left: '14px',
              right: '0',
              height: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.55rem',
              color: '#9ca3af',
              fontWeight: 700,
              textTransform: 'uppercase',
              gap: '4px'
            }}>
              Urgente →
            </div>

            {/* Q1 box */}
            <div 
              onClick={() => handleQuadrantClick(3)}
              style={{
                background: 'rgba(239, 68, 68, 0.02)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                borderRadius: '8px',
                padding: '10px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.06)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.02)'}
            >
              <span style={{ fontSize: '0.65rem', color: '#f87171', fontWeight: 700 }}>Q1 - Hacer Ya</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444', lineHeight: 1 }}>{q1Count}</span>
              <span style={{ fontSize: '0.55rem', color: '#9ca3af' }}>Urgente e Importante</span>
            </div>

            {/* Q2 box */}
            <div 
              onClick={() => handleQuadrantClick(2)}
              style={{
                background: 'rgba(59, 130, 246, 0.02)',
                border: '1px solid rgba(59, 130, 246, 0.15)',
                borderRadius: '8px',
                padding: '10px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.06)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.02)'}
            >
              <span style={{ fontSize: '0.65rem', color: '#60a5fa', fontWeight: 700 }}>Q2 - Planificar</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#3b82f6', lineHeight: 1 }}>{q2Count}</span>
              <span style={{ fontSize: '0.55rem', color: '#9ca3af' }}>Importante, No Urgente</span>
            </div>

            {/* Q3 box */}
            <div 
              onClick={() => handleQuadrantClick(1)}
              style={{
                background: 'rgba(245, 158, 11, 0.02)',
                border: '1px solid rgba(245, 158, 11, 0.15)',
                borderRadius: '8px',
                padding: '10px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.06)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.02)'}
            >
              <span style={{ fontSize: '0.65rem', color: '#fbbf24', fontWeight: 700 }}>Q3 - Delegar</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b', lineHeight: 1 }}>{q3Count}</span>
              <span style={{ fontSize: '0.55rem', color: '#9ca3af' }}>Urgente, No Importante</span>
            </div>

            {/* Q4 box */}
            <div 
              onClick={() => handleQuadrantClick(0)}
              style={{
                background: 'rgba(107, 114, 128, 0.02)',
                border: '1px solid rgba(107, 114, 128, 0.15)',
                borderRadius: '8px',
                padding: '10px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(107, 114, 128, 0.06)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(107, 114, 128, 0.02)'}
            >
              <span style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 700 }}>Q4 - Eliminar</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#6b7280', lineHeight: 1 }}>{q4Count}</span>
              <span style={{ fontSize: '0.55rem', color: '#9ca3af' }}>Ni Urgente, Ni Importante</span>
            </div>

          </div>

          <div style={{ fontSize: '0.7rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '4px', paddingLeft: '4px', marginTop: 'auto' }}>
            💡 <span>Enfócate en Q2: Planificación y crecimiento estratégico.</span>
          </div>
        </div>

        {/* Column 3: ¿En qué gasto mi tiempo? ( Doughnut Chart + List) */}
        <div style={{
          background: '#151518',
          border: '1px solid rgba(255,255,255,0.04)',
          borderRadius: '16px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f3f4f6' }}>¿En qué gasto mi tiempo?</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '-8px' }}>Distribución de tu tiempo esta semana.</span>

          {/* Doughnut Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '70px 1.3fr', gap: '12px', alignItems: 'center', marginTop: '4px' }}>
            
            {/* SVG doughnut circle segmenting */}
            <div style={{ position: 'relative', width: '70px', height: '70px' }}>
              <svg width="70" height="70" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.91549" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="3.2" />
                {renderedDoughnutSegments.map((seg, idx) => (
                  <circle 
                    key={idx}
                    cx="18" cy="18" r="15.91549" fill="none" 
                    stroke={seg.color} 
                    strokeWidth="3.2" 
                    strokeDasharray={seg.dashArray}
                    strokeDashoffset={seg.dashOffset}
                    transform="rotate(-90 18 18)" 
                  />
                ))}
              </svg>
              <div style={{
                position: 'absolute',
                top: '0', left: '0', right: '0', bottom: '0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>{focusHours}h</span>
                <span style={{ fontSize: '0.5rem', color: '#9ca3af', textTransform: 'uppercase', marginTop: '2px' }}>Total</span>
              </div>
            </div>

            {/* List details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {renderedDoughnutSegments.map((seg, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: seg.color, flexShrink: 0 }} />
                    <span style={{ color: '#a1a1aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seg.name}</span>
                  </div>
                  <div style={{ color: '#ffffff', fontWeight: 600, flexShrink: 0 }}>
                    {seg.hours}h <span style={{ color: '#71717a', fontSize: '0.6rem' }}>({seg.percent}%)</span>
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* Goal progress bar bottom */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#a1a1aa' }}>
              <span>Objetivo de Foco: 25h</span>
              <span style={{ color: '#ffffff', fontWeight: 600 }}>{focusGoalPercent}%</span>
            </div>
            <div style={{ height: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${focusGoalPercent}%`, background: 'var(--accent-hover)', height: '100%' }} />
            </div>
          </div>
        </div>

      </div>

      {/* 4. Bottom Cockpit Row: Proyectos en Progreso, Line Chart Tendencia, Insights */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isAIDisabled ? '1.05fr 1fr' : '1.05fr 1fr 1.05fr',
        gap: '1.25rem',
        flexShrink: 0
      }}>
        
        {/* Column 1: Proyectos en Progreso */}
        <div style={{
          background: '#151518',
          border: '1px solid rgba(255,255,255,0.04)',
          borderRadius: '16px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f3f4f6' }}>Proyectos en Progreso</h3>
            <span 
              onClick={() => setSelectedDetail('stuck')}
              style={{ fontSize: '0.75rem', color: '#8b5cf6', cursor: 'pointer', fontWeight: 600 }}
            >
              Ver todos &gt;
            </span>
          </div>

          {/* Active project rows list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activeProjects.length === 0 ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '1rem 0', textAlign: 'center' }}>
                No hay proyectos activos creados aún.
              </span>
            ) : (
              activeProjects.map(proj => (
                <div 
                  key={proj.id} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px solid rgba(255,255,255,0.03)',
                    borderRadius: '8px'
                  }}
                >
                  {/* Round color badge */}
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: `${proj.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Layers size={14} style={{ color: proj.color }} />
                  </div>

                  {/* Project progress */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
                      <span style={{ color: '#e4e4e7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.name}</span>
                      <span style={{ color: '#ffffff' }}>{proj.progress}%</span>
                    </div>
                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${proj.progress}%`, background: proj.color, height: '100%', borderRadius: '2px' }} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Tendencia de Rendimiento (Real line chart) */}
        <div style={{
          background: '#151518',
          border: '1px solid rgba(255,255,255,0.04)',
          borderRadius: '16px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f3f4f6' }}>Tendencia de Rendimiento</h3>
            <span style={{ fontSize: '0.75rem', color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '1px 6px', fontWeight: 500 }}>
              Semana
            </span>
          </div>

          {/* SVG Line Graph */}
          <div style={{ position: 'relative', height: '100px', width: '100%', marginTop: '6px' }}>
            <svg width="100%" height="100" style={{ overflow: 'visible' }}>
              {/* Grid Lines */}
              <line x1="20" y1="15" x2="300" y2="15" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="2, 2" />
              <line x1="20" y1="50" x2="300" y2="50" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="2, 2" />
              <line x1="20" y1="85" x2="300" y2="85" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="2, 2" />
              
              {/* Polyline Path */}
              {pathD && (
                <>
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ filter: 'drop-shadow(0 2px 4px rgba(139, 92, 246, 0.4))' }}
                  />
                  {/* Dots with values */}
                  {chartPoints.map((pt, idx) => (
                    <g key={idx}>
                      <circle 
                        cx={pt.x} 
                        cy={pt.y} 
                        r="3.5" 
                        fill="#8b5cf6" 
                        stroke="#151518" 
                        strokeWidth="1.5" 
                        title={`${pt.dayName}: ${pt.count}`}
                      />
                      {pt.count > 0 && (
                        <text x={pt.x} y={pt.y - 6} fill="#ffffff" fontSize="7" fontWeight="bold" textAnchor="middle">
                          {pt.count}
                        </text>
                      )}
                      <text x={pt.x} y="96" fill="#71717a" fontSize="7.5" fontWeight="600" textAnchor="middle">
                        {pt.dayName}
                      </text>
                    </g>
                  ))}
                </>
              )}
            </svg>
          </div>

          {/* Timing summaries */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            borderTop: '1px solid rgba(255,255,255,0.04)',
            paddingTop: '8px',
            fontSize: '0.65rem',
            textAlign: 'center',
            marginTop: 'auto'
          }}>
            <div>
              <span style={{ color: '#71717a', display: 'block' }}>Mejor día</span>
              <strong style={{ color: '#34d399', fontWeight: 700 }}>{bestDayName.split('-')[0].slice(0, 8)}</strong>
            </div>
            <div>
              <span style={{ color: '#71717a', display: 'block' }}>Promedio diario</span>
              <strong style={{ color: '#ffffff', fontWeight: 700 }}>{(completedTasks / 7).toFixed(1)} tareas</strong>
            </div>
            <div>
              <span style={{ color: '#71717a', display: 'block' }}>Menor avance</span>
              <strong style={{ color: '#ef4444', fontWeight: 700 }}>{worstDayName.split('-')[0].slice(0, 8)}</strong>
            </div>
          </div>
        </div>

        {!isAIDisabled && (
          /* Column 3: Coach de Productividad IA (Local) */
          <div style={{
            background: '#151518',
            border: '1px solid rgba(255,255,255,0.04)',
            borderRadius: '16px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f3f4f6', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Brain size={18} style={{ color: '#8b5cf6' }} />
                AI Coach Personal
              </h3>
              <span style={{ fontSize: '0.65rem', color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.1)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, textTransform: 'uppercase' }}>
                100% Local 🧠
              </span>
            </div>

            {aiLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '1.5rem 0.5rem', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                <RefreshCw size={24} className="spin-anim" style={{ color: '#8b5cf6' }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', fontWeight: 500 }}>
                  {aiProgress ? aiProgress.file : 'Cargando modelo local...'}
                </span>
                {aiProgress && aiProgress.progress >= 0 && (
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${aiProgress.progress}%`, height: '100%', background: 'linear-gradient(90deg, #7c3aed 0%, #6d28d9 100%)', borderRadius: '3px', transition: 'width 0.2s' }} />
                    </div>
                    <span style={{ fontSize: '0.65rem', color: '#71717a' }}>{aiProgress.progress}% completado</span>
                  </div>
                )}
              </div>
            ) : aiError ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '1rem 0.5rem', justifyContent: 'center', flex: 1 }}>
                <div style={{ color: '#ef4444', fontSize: '0.75rem', padding: '10px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.15)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontWeight: 700 }}>⚠️ Error al procesar:</span>
                  <span>{aiError}</span>
                </div>
                <button 
                  onClick={handleAICoachUpdate} 
                  style={{ 
                    background: 'linear-gradient(90deg, #7c3aed 0%, #6d28d9 100%)', 
                    border: 'none', 
                    color: '#ffffff', 
                    padding: '8px 16px', 
                    borderRadius: '8px', 
                    cursor: 'pointer', 
                    fontSize: '0.75rem', 
                    fontWeight: 700,
                    alignSelf: 'center' 
                  }}
                >
                  Reintentar Consulta
                </button>
              </div>
            ) : coachInsight ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                <div style={{
                  background: 'rgba(124, 58, 237, 0.03)',
                  border: '1px solid rgba(124, 58, 237, 0.08)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '0.75rem',
                  lineHeight: '1.45',
                  color: '#d4d4d8',
                  whiteSpace: 'pre-line',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  maxHeight: '160px',
                  overflowY: 'auto'
                }}>
                  {coachInsight}
                </div>
                
                <button
                  onClick={handleAICoachUpdate}
                  style={{
                    background: 'rgba(139, 92, 246, 0.06)',
                    border: '1px solid rgba(139, 92, 246, 0.12)',
                    color: '#c084fc',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    alignSelf: 'center',
                    marginTop: 'auto',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(139, 92, 246, 0.12)';
                    e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(139, 92, 246, 0.06)';
                    e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.12)';
                  }}
                >
                  <Sparkles size={12} />
                  Actualizar Asesoría
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '1rem 0.5rem', flex: 1 }}>
                <Brain size={36} style={{ color: '#8b5cf6', opacity: 0.8, filter: 'drop-shadow(0 0 6px rgba(139, 92, 246, 0.3))' }} />
                <div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f4f4f5', display: 'block', marginBottom: '4px' }}>Consejos de Productividad Reales</span>
                  <span style={{ fontSize: '0.75rem', color: '#a1a1aa', display: 'block', lineHeight: '1.35' }}>
                    El Coach de IA analizará tus hábitos, tareas y pomodoros completados para redactar 3 recomendaciones personalizadas.
                  </span>
                </div>
                <button
                  onClick={handleAICoachUpdate}
                  style={{
                    background: 'linear-gradient(90deg, #7c3aed 0%, #6d28d9 100%)',
                    border: 'none',
                    color: '#ffffff',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 10px rgba(124, 58, 237, 0.25)'
                  }}
                >
                  <Sparkles size={12} />
                  Consultar Coach de IA
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* 5. Footer Bar (Visual quote + Action button matching screenshot) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#151518',
        border: '1px solid rgba(255,255,255,0.04)',
        borderRadius: '12px',
        padding: '0.75rem 1.25rem',
        marginTop: '0.25rem',
        flexShrink: 0,
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        <span style={{ fontSize: '0.8rem', color: '#a1a1aa', fontStyle: 'italic' }}>
          “ No es que tengamos poco tiempo, sino que perdemos mucho. ” <span style={{ color: '#71717a' }}>— Séneca</span>
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.7rem', color: '#71717a', fontWeight: 600 }}>
            Revisión recomendada: Domingo, 6:00 PM
          </span>
          <button
            onClick={() => setSelectedDetail('inbox')}
            style={{
              background: 'linear-gradient(90deg, #7c3aed 0%, #6d28d9 100%)',
              border: 'none',
              color: '#ffffff',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 10px rgba(124, 58, 237, 0.3)'
            }}
          >
            📥 Iniciar Revisión Semanal
          </button>
        </div>
      </div>

    </div>
  );
}
