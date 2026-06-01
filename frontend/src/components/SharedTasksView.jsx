import { useState, useEffect } from 'react';
import { 
  Users, UserPlus, UserMinus, Plus, Trash2, Check, 
  Share2, Inbox, Calendar, AlertCircle, CheckCircle2,
  Clock, Shield, User, Group, Send, Mail
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

export function SharedTasksView({ user, onRefreshTasks }) {
  // Theme check based on current background style
  const bgStyle = localStorage.getItem('appBgStyle') || '#121212';
  const isLightTheme = bgStyle === '#f8f9fa' || bgStyle === '#f0f4f8' || bgStyle === '#f4fbf7';

  // Tabs: 'tasks' | 'teams' | 'friends'
  const [activeTab, setActiveTab] = useState('tasks');

  // Shared Tasks States
  const [sharedTasks, setSharedTasks] = useState([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState(0);
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskDueTime, setNewTaskDueTime] = useState('');
  const [taskAssignType, setTaskAssignType] = useState('friend'); // 'friend' | 'team'
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskTeamId, setTaskTeamId] = useState('');
  const [lists, setLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState('');

  // Teams States
  const [teams, setTeams] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [addMemberUserId, setAddMemberUserId] = useState('');

  // Friends & Users States
  const [friends, setFriends] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [searchUserQuery, setSearchUserQuery] = useState('');

  // Fetch logic helpers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('todo_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
  };

  const fetchSharedTasks = async () => {
    try {
      const res = await fetch('/api/shared-tasks', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSharedTasks(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/teams', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTeams(data);
        // Refresh selected team to update member lists
        if (selectedTeam) {
          const updated = data.find(t => t.id === selectedTeam.id);
          if (updated) setSelectedTeam(updated);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFriends = async () => {
    try {
      const res = await fetch('/api/friends', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setFriends(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await fetch('/api/users', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLists = async () => {
    try {
      const res = await fetch('/api/lists', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLists(data);
        const inbox = data.find(l => l.name.toLowerCase() === 'inbox');
        if (inbox) setSelectedListId(inbox.id);
        else if (data.length > 0) setSelectedListId(data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Mount loading
  useEffect(() => {
    fetchSharedTasks();
    fetchTeams();
    fetchFriends();
    fetchAllUsers();
    fetchLists();
  }, []);

  // --- ACTIONS ---

  // 1. Create Shared Task
  const handleCreateSharedTask = async (e) => {
    if (e) e.preventDefault();
    if (!newTaskTitle.trim()) return;

    let due_date = null;
    if (newTaskDueDate) {
      due_date = newTaskDueTime 
        ? `${newTaskDueDate}T${newTaskDueTime}:00` 
        : `${newTaskDueDate}T12:00:00`;
    }

    const payload = {
      list_id: selectedListId ? parseInt(selectedListId) : null,
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim(),
      due_date,
      priority: parseInt(newTaskPriority),
      team_id: taskAssignType === 'team' && taskTeamId ? parseInt(taskTeamId) : null,
      assigned_to: taskAssignType === 'friend' && taskAssigneeId ? parseInt(taskAssigneeId) : null
    };

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setNewTaskTitle('');
        setNewTaskDesc('');
        setNewTaskDueDate('');
        setNewTaskDueTime('');
        setTaskAssigneeId('');
        setTaskTeamId('');
        setIsAddingTask(false);
        fetchSharedTasks();
        if (onRefreshTasks) onRefreshTasks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle Completion
  const handleToggleTask = async (task) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_completed: !task.is_completed })
      });
      if (res.ok) {
        fetchSharedTasks();
        if (onRefreshTasks) onRefreshTasks();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al actualizar la tarea.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Delete Shared Task
  const handleDeleteTask = async (taskId) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta tarea compartida?')) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        fetchSharedTasks();
        if (onRefreshTasks) onRefreshTasks();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al eliminar la tarea.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 2. Create Team
  const handleCreateTeam = async (e) => {
    if (e) e.preventDefault();
    if (!newTeamName.trim()) return;

    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: newTeamName.trim() })
      });
      if (res.ok) {
        setNewTeamName('');
        fetchTeams();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Add Member to Selected Team
  const handleAddTeamMember = async (e) => {
    if (e) e.preventDefault();
    if (!selectedTeam || !addMemberUserId) return;

    try {
      const res = await fetch(`/api/teams/${selectedTeam.id}/members`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ user_id: parseInt(addMemberUserId) })
      });
      if (res.ok) {
        setAddMemberUserId('');
        fetchTeams();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al añadir miembro.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Remove Member from Selected Team
  const handleRemoveTeamMember = async (userId) => {
    if (!selectedTeam) return;
    if (!confirm('¿Estás seguro de que deseas remover a este miembro del equipo?')) return;

    try {
      const res = await fetch(`/api/teams/${selectedTeam.id}/members/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        fetchTeams();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al remover miembro.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Delete Team
  const handleDeleteTeam = async (teamId) => {
    if (!confirm('💥 ¿ADVERTENCIA: ¿Estás seguro de que deseas disolver este equipo? Se desvincularán todas las tareas asociadas.')) return;
    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setSelectedTeam(null);
        fetchTeams();
        fetchSharedTasks();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al disolver equipo.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Leave Team
  const handleLeaveTeam = async (teamId) => {
    if (!confirm('¿Deseas salir de este equipo? Dejarás de tener acceso a las tareas asociadas.')) return;
    try {
      const res = await fetch(`/api/teams/${teamId}/members/${user.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setSelectedTeam(null);
        fetchTeams();
        fetchSharedTasks();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al salir del equipo.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 3. Add Friend
  const handleAddFriend = async (friendId) => {
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ friend_id: friendId })
      });
      if (res.ok) {
        setSearchUserQuery('');
        fetchFriends();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Remove Friend
  const handleRemoveFriend = async (friendId) => {
    if (!confirm('¿Estás seguro de que deseas eliminar a este colaborador de tus amigos?')) return;
    try {
      const res = await fetch(`/api/friends/${friendId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        fetchFriends();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filtering users for friend discovery
  const filteredDiscoveryUsers = allUsers.filter(u => {
    const isAlreadyFriend = friends.some(f => f.friend_id === u.id);
    const matchesSearch = u.username.toLowerCase().includes(searchUserQuery.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchUserQuery.toLowerCase());
    return !isAlreadyFriend && matchesSearch;
  });

  // Split tasks into Received and Sent
  const receivedTasks = sharedTasks.filter(t => t.user_id !== user.id);
  const sentTasks = sharedTasks.filter(t => t.user_id === user.id);

  return (
    <div className="shared-tasks-view" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem',
      height: '100%',
      padding: '1.5rem 0',
      overflow: 'hidden',
      animation: 'fadeIn 0.25s ease'
    }}>
      
      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: isLightTheme ? '#1f2937' : '#f3f4f6', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Users size={28} style={{ color: 'var(--accent-hover)' }} />
            Equipos & Compartido
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Colabora en tiempo real. Gestiona tus equipos, amigos colaboradores y delega tareas fácilmente.
          </p>
        </div>

        {activeTab === 'tasks' && (
          <button
            onClick={() => setIsAddingTask(!isAddingTask)}
            style={{
              background: 'var(--accent-hover)',
              border: 'none',
              color: '#ffffff',
              padding: '8px 18px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 10px rgba(124, 58, 237, 0.25)'
            }}
          >
            <Plus size={16} /> Asignar Tarea
          </button>
        )}
      </div>

      {/* Tabs Menu */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        background: isLightTheme ? 'rgba(0,0,0,0.03)' : 'rgba(255, 255, 255, 0.02)',
        padding: '4px',
        borderRadius: '10px',
        border: '1px solid var(--border-color)',
        alignSelf: 'flex-start',
        flexShrink: 0
      }}>
        <button
          onClick={() => setActiveTab('tasks')}
          style={{
            background: activeTab === 'tasks' ? 'var(--accent-hover)' : 'transparent',
            border: 'none',
            color: activeTab === 'tasks' ? '#ffffff' : 'var(--text-secondary)',
            padding: '6px 16px',
            borderRadius: '8px',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          📬 Tareas Compartidas
        </button>
        <button
          onClick={() => setActiveTab('teams')}
          style={{
            background: activeTab === 'teams' ? 'var(--accent-hover)' : 'transparent',
            border: 'none',
            color: activeTab === 'teams' ? '#ffffff' : 'var(--text-secondary)',
            padding: '6px 16px',
            borderRadius: '8px',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          👥 Mis Equipos ({teams.length})
        </button>
        <button
          onClick={() => setActiveTab('friends')}
          style={{
            background: activeTab === 'friends' ? 'var(--accent-hover)' : 'transparent',
            border: 'none',
            color: activeTab === 'friends' ? '#ffffff' : 'var(--text-secondary)',
            padding: '6px 16px',
            borderRadius: '8px',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          🤝 Mis Amigos ({friends.length})
        </button>
      </div>

      {/* Main Viewport */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
        
        {/* --- TAB 1: SHARED TASKS --- */}
        {activeTab === 'tasks' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Quick Add shared task Panel */}
            {isAddingTask && (
              <form 
                onSubmit={handleCreateSharedTask}
                style={{
                  background: isLightTheme ? '#ffffff' : '#151518',
                  border: '1px solid var(--border-color)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: isLightTheme ? '0 10px 25px rgba(0,0,0,0.05)' : '0 10px 25px rgba(0,0,0,0.3)',
                  animation: 'slideDown 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Share2 size={16} style={{ color: 'var(--accent-hover)' }} />
                    Crear y Asignar Tarea Compartida
                  </h3>
                  <button 
                    type="button" 
                    onClick={() => setIsAddingTask(false)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    Cancelar
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {/* Left Column: Title, Description */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Título:</label>
                      <input 
                        type="text" 
                        required
                        placeholder="Ej. Diseñar prototipo del cliente"
                        value={newTaskTitle}
                        onChange={e => setNewTaskTitle(e.target.value)}
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

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Descripción / Notas:</label>
                      <textarea 
                        placeholder="Añade instrucciones de la tarea..."
                        value={newTaskDesc}
                        onChange={e => setNewTaskDesc(e.target.value)}
                        style={{
                          background: isLightTheme ? '#f9fafb' : 'rgba(0,0,0,0.2)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          color: 'var(--text-primary)',
                          fontSize: '0.85rem',
                          fontFamily: 'inherit',
                          outline: 'none',
                          minHeight: '80px',
                          resize: 'vertical'
                        }}
                      />
                    </div>
                  </div>

                  {/* Right Column: Assignment Type & Values */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    
                    {/* Assignment Type Toggle */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Destinatario:</label>
                      <div style={{ display: 'flex', gap: '6px', background: isLightTheme ? '#f3f4f6' : 'rgba(0,0,0,0.15)', padding: '3px', borderRadius: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setTaskAssignType('friend')}
                          style={{
                            flex: 1,
                            background: taskAssignType === 'friend' ? (isLightTheme ? '#ffffff' : 'rgba(255,255,255,0.06)') : 'transparent',
                            border: 'none',
                            color: 'var(--text-primary)',
                            padding: '6px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          👤 Un Amigo
                        </button>
                        <button
                          type="button"
                          onClick={() => setTaskAssignType('team')}
                          style={{
                            flex: 1,
                            background: taskAssignType === 'team' ? (isLightTheme ? '#ffffff' : 'rgba(255,255,255,0.06)') : 'transparent',
                            border: 'none',
                            color: 'var(--text-primary)',
                            padding: '6px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          👥 Un Equipo
                        </button>
                      </div>
                    </div>

                    {/* Friend/Team Selectors */}
                    {taskAssignType === 'friend' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Seleccionar Amigo:</label>
                        <select
                          required
                          value={taskAssigneeId}
                          onChange={e => setTaskAssigneeId(e.target.value)}
                          style={{
                            background: isLightTheme ? '#ffffff' : '#1a1a1a',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        >
                          <option value="">Selecciona un colaborador...</option>
                          {friends.map(f => (
                            <option key={f.friend_id} value={f.friend_id}>{f.username} ({f.email})</option>
                          ))}
                        </select>
                        {friends.length === 0 && (
                          <span style={{ fontSize: '0.65rem', color: '#f59e0b' }}>⚠️ Debes agregar amigos en la pestaña "Mis Amigos" primero.</span>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Seleccionar Equipo:</label>
                        <select
                          required
                          value={taskTeamId}
                          onChange={e => setTaskTeamId(e.target.value)}
                          style={{
                            background: isLightTheme ? '#ffffff' : '#1a1a1a',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        >
                          <option value="">Selecciona un equipo...</option>
                          {teams.map(t => (
                            <option key={t.id} value={t.id}>{t.name} (Miembro)</option>
                          ))}
                        </select>
                        {teams.length === 0 && (
                          <span style={{ fontSize: '0.65rem', color: '#f59e0b' }}>⚠️ Debes pertenecer a un equipo. Crea uno en la pestaña "Mis Equipos".</span>
                        )}
                      </div>
                    )}

                    {/* Due Date & Times */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Vencimiento:</label>
                        <input 
                          type="date" 
                          value={newTaskDueDate}
                          onChange={e => setNewTaskDueDate(e.target.value)}
                          style={{
                            background: isLightTheme ? '#f9fafb' : 'rgba(0,0,0,0.2)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '8px 10px',
                            color: 'var(--text-primary)',
                            fontSize: '0.8rem',
                            outline: 'none'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Hora:</label>
                        <input 
                          type="time" 
                          value={newTaskDueTime}
                          onChange={e => setNewTaskDueTime(e.target.value)}
                          style={{
                            background: isLightTheme ? '#f9fafb' : 'rgba(0,0,0,0.2)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '8px 10px',
                            color: 'var(--text-primary)',
                            fontSize: '0.8rem',
                            outline: 'none'
                          }}
                        />
                      </div>
                    </div>

                    {/* Priority & List */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Cuadrante Matrix:</label>
                        <select
                          value={newTaskPriority}
                          onChange={e => setNewTaskPriority(parseInt(e.target.value))}
                          style={{
                            background: isLightTheme ? '#ffffff' : '#1a1a1a',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '8px 10px',
                            color: 'var(--text-primary)',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        >
                          <option value={0}>Prioridad Normal (Sin Urgencia)</option>
                          <option value={1}>🔵 Cuadrante 3 (Urgente / No Imp.)</option>
                          <option value={2}>🟡 Cuadrante 2 (Importante / No Urg.)</option>
                          <option value={3}>🔴 Cuadrante 1 (Urgente e Importante)</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Asociar a Lista:</label>
                        <select
                          value={selectedListId}
                          onChange={e => setSelectedListId(e.target.value)}
                          style={{
                            background: isLightTheme ? '#ffffff' : '#1a1a1a',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '8px 10px',
                            color: 'var(--text-primary)',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        >
                          {lists.map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Form submit button */}
                <button
                  type="submit"
                  style={{
                    background: 'var(--accent-hover)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    alignSelf: 'flex-end',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '8px'
                  }}
                >
                  <Send size={14} /> Enviar y Asignar Tarea
                </button>
              </form>
            )}

            {/* Split layout: Received and Sent */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '1.5rem'
            }}>
              
              {/* Card List 1: Tareas Recibidas */}
              <div style={{
                background: isLightTheme ? '#ffffff' : '#151518',
                border: isLightTheme ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.04)',
                borderRadius: '16px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                minHeight: '400px',
                boxShadow: isLightTheme ? '0 4px 12px rgba(0,0,0,0.04)' : '0 4px 6px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: isLightTheme ? '#1f2937' : '#f3f4f6', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: isLightTheme ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.04)', paddingBottom: '8px' }}>
                  <Inbox size={18} style={{ color: 'var(--accent-hover)' }} />
                  Tareas Asignadas a Mí / Mis Equipos ({receivedTasks.length})
                </h3>

                {receivedTasks.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '8px', color: 'var(--text-secondary)' }}>
                    <CheckCircle2 size={32} style={{ opacity: 0.4 }} />
                    <span style={{ fontSize: '0.85rem' }}>No tienes tareas compartidas pendientes</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
                    {receivedTasks.map(task => (
                      <div 
                        key={task.id}
                        style={{
                          background: isLightTheme ? '#f9fafb' : 'rgba(255,255,255,0.01)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '10px',
                          padding: '12px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          transition: 'transform 0.15s',
                          opacity: task.is_completed ? 0.6 : 1
                        }}
                      >
                        <input 
                          type="checkbox"
                          checked={task.is_completed}
                          onChange={() => handleToggleTask(task)}
                          style={{
                            accentColor: 'var(--accent-hover)',
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer',
                            marginTop: '2px'
                          }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                          <span style={{ 
                            fontSize: '0.85rem', 
                            fontWeight: 700, 
                            color: 'var(--text-primary)',
                            textDecoration: task.is_completed ? 'line-through' : 'none'
                          }}>
                            {task.title}
                          </span>
                          {task.description && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                              {task.description}
                            </p>
                          )}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.65rem', background: 'rgba(124, 58, 237, 0.12)', color: 'var(--accent-hover)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                              👤 De: {task.creator_name || 'Alguien'}
                            </span>
                            {task.team_name && (
                              <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                👥 Equipo: {task.team_name}
                              </span>
                            )}
                            {task.due_date && (
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <Clock size={10} /> {format(parseISO(task.due_date), 'dd/MM HH:mm')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Card List 2: Tareas Enviadas */}
              <div style={{
                background: isLightTheme ? '#ffffff' : '#151518',
                border: isLightTheme ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.04)',
                borderRadius: '16px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                minHeight: '400px',
                boxShadow: isLightTheme ? '0 4px 12px rgba(0,0,0,0.04)' : '0 4px 6px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: isLightTheme ? '#1f2937' : '#f3f4f6', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: isLightTheme ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.04)', paddingBottom: '8px' }}>
                  <Send size={18} style={{ color: 'var(--accent-hover)' }} />
                  Tareas Asignadas por Mí ({sentTasks.length})
                </h3>

                {sentTasks.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '8px', color: 'var(--text-secondary)' }}>
                    <Share2 size={32} style={{ opacity: 0.4 }} />
                    <span style={{ fontSize: '0.85rem' }}>No has asignado tareas a otros colaboradores</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
                    {sentTasks.map(task => (
                      <div 
                        key={task.id}
                        style={{
                          background: isLightTheme ? '#f9fafb' : 'rgba(255,255,255,0.01)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '10px',
                          padding: '12px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          transition: 'transform 0.15s',
                          opacity: task.is_completed ? 0.6 : 1
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                          <span style={{ 
                            fontSize: '0.85rem', 
                            fontWeight: 700, 
                            color: 'var(--text-primary)',
                            textDecoration: task.is_completed ? 'line-through' : 'none'
                          }}>
                            {task.title}
                          </span>
                          {task.description && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                              {task.description}
                            </p>
                          )}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.65rem', background: 'rgba(59, 130, 246, 0.12)', color: 'var(--accent-hover)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                              {task.assignee_name ? `👤 Para: ${task.assignee_name}` : `👥 Equipo: ${task.team_name || 'Desconocido'}`}
                            </span>
                            <span style={{ 
                              fontSize: '0.65rem', 
                              background: task.is_completed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', 
                              color: task.is_completed ? '#10b981' : '#f59e0b', 
                              padding: '1px 6px', 
                              borderRadius: '4px', 
                              fontWeight: 700 
                            }}>
                              {task.is_completed ? '✓ Completado' : '⏳ Pendiente'}
                            </span>
                          </div>
                        </div>

                        {/* Delete button (Only owner can delete) */}
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title="Eliminar tarea compartida"
                          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* --- TAB 2: TEAMS MANAGEMENT --- */}
        {activeTab === 'teams' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 3fr',
            gap: '1.5rem',
            alignItems: 'flex-start'
          }}>
            
            {/* Left side: Create team & lists of teams */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Create Team Form */}
              <div style={{
                background: isLightTheme ? '#ffffff' : '#151518',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '1.5rem',
                boxShadow: isLightTheme ? '0 4px 12px rgba(0,0,0,0.04)' : '0 4px 6px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '12px' }}>
                  <Plus size={16} style={{ color: 'var(--accent-hover)' }} />
                  Crear Nuevo Equipo
                </h3>
                <form onSubmit={handleCreateTeam} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Nombre del Equipo:</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ej. Equipo de Operaciones"
                      value={newTeamName}
                      onChange={e => setNewTeamName(e.target.value)}
                      style={{
                        background: isLightTheme ? '#f9fafb' : 'rgba(0,0,0,0.2)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    style={{
                      background: 'var(--accent-hover)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      transition: 'background 0.2s'
                    }}
                  >
                    Crear Equipo
                  </button>
                </form>
              </div>

              {/* Grid of Teams */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', margin: '4px 0' }}>Mis Equipos:</h4>
                {teams.length === 0 ? (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>No perteneces a ningún equipo todavía.</span>
                ) : (
                  teams.map(team => (
                    <div 
                      key={team.id}
                      onClick={() => setSelectedTeam(team)}
                      style={{
                        background: selectedTeam?.id === team.id 
                          ? (isLightTheme ? '#eef2ff' : 'rgba(124,58,237,0.08)') 
                          : (isLightTheme ? '#ffffff' : '#151518'),
                        border: selectedTeam?.id === team.id 
                          ? '1.5px solid var(--accent-hover)' 
                          : '1px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '12px 14px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{team.name}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>👥 {team.members.length} miembros</span>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Ver miembros &gt;</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right side: Selected Team Details Panel */}
            <div style={{
              background: isLightTheme ? '#ffffff' : '#151518',
              border: isLightTheme ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.04)',
              borderRadius: '16px',
              padding: '1.5rem',
              minHeight: '400px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: isLightTheme ? '0 4px 12px rgba(0,0,0,0.04)' : '0 4px 6px rgba(0,0,0,0.1)'
            }}>
              {!selectedTeam ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '8px', color: 'var(--text-secondary)' }}>
                  <Users size={36} style={{ opacity: 0.3 }} />
                  <span style={{ fontSize: '0.85rem', textAlign: 'center' }}>Selecciona un equipo de la lista para ver su estructura y añadir colaboradores.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%' }}>
                  
                  {/* Team details header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{selectedTeam.name}</h3>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Shield size={12} style={{ color: '#fbbf24' }} /> Creador: <b>{selectedTeam.creator_name}</b>
                      </span>
                    </div>

                    {selectedTeam.created_by === user.id ? (
                      <button
                        onClick={() => handleDeleteTeam(selectedTeam.id)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.15)',
                          borderRadius: '6px',
                          color: '#ef4444',
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Trash2 size={12} /> Disolver Equipo
                      </button>
                    ) : (
                      <button
                        onClick={() => handleLeaveTeam(selectedTeam.id)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.15)',
                          borderRadius: '6px',
                          color: '#ef4444',
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Salir del Equipo
                      </button>
                    )}
                  </div>

                  {/* Add Member form (Only creator) */}
                  {selectedTeam.created_by === user.id && (
                    <form onSubmit={handleAddTeamMember} style={{ display: 'flex', gap: '8px', background: isLightTheme ? '#f9fafb' : 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      <select
                        required
                        value={addMemberUserId}
                        onChange={e => setAddMemberUserId(e.target.value)}
                        style={{
                          flex: 1,
                          background: isLightTheme ? '#ffffff' : '#1a1a1a',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          color: 'var(--text-primary)',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      >
                        <option value="">Añadir colaborador al equipo...</option>
                        {friends.map(f => {
                          const isAlreadyInTeam = selectedTeam.members.some(m => m.id === f.friend_id);
                          if (isAlreadyInTeam) return null;
                          return (
                            <option key={f.friend_id} value={f.friend_id}>{f.username}</option>
                          );
                        })}
                      </select>
                      <button
                        type="submit"
                        disabled={!addMemberUserId}
                        style={{
                          background: 'var(--accent-hover)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 14px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          opacity: addMemberUserId ? 1 : 0.5
                        }}
                      >
                        Añadir
                      </button>
                    </form>
                  )}

                  {/* Team Members List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Miembros ({selectedTeam.members.length}):</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {selectedTeam.members.map(member => (
                        <div 
                          key={member.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 10px',
                            background: isLightTheme ? '#f9fafb' : 'rgba(255,255,255,0.01)',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent-hover)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
                              {member.username.substring(0, 2).toUpperCase()}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{member.username} {member.id === user.id && '(Tú)'}</span>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{member.email}</span>
                            </div>
                          </div>

                          {/* Member actions (Delete button only if creator and not deleting self) */}
                          {selectedTeam.created_by === user.id && member.id !== user.id && (
                            <button
                              onClick={() => handleRemoveTeamMember(member.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              title="Remover del equipo"
                              onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                            >
                              <UserMinus size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </div>

          </div>
        )}

        {/* --- TAB 3: FRIENDS MANAGEMENT --- */}
        {activeTab === 'friends' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '1.5rem'
          }}>
            
            {/* Discovery / Search Collaborators Card */}
            <div style={{
              background: isLightTheme ? '#ffffff' : '#151518',
              border: isLightTheme ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.04)',
              borderRadius: '16px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: isLightTheme ? '0 4px 12px rgba(0,0,0,0.04)' : '0 4px 6px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <UserPlus size={18} style={{ color: 'var(--accent-hover)' }} />
                Descubrir Colaboradores
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Buscar por Nombre o Email:</label>
                <input 
                  type="text" 
                  placeholder="Ej. Maria Lopez..."
                  value={searchUserQuery}
                  onChange={e => setSearchUserQuery(e.target.value)}
                  style={{
                    background: isLightTheme ? '#f9fafb' : 'rgba(0,0,0,0.2)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Autocomplete List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px', overflowY: 'auto', maxHeight: '300px' }}>
                {searchUserQuery.trim() === '' ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>Escribe arriba para buscar otros usuarios de ToDo y agregarlos a tu red de amigos.</span>
                ) : filteredDiscoveryUsers.length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>No se encontraron colaboradores nuevos con ese término.</span>
                ) : (
                  filteredDiscoveryUsers.map(discoveryUser => (
                    <div 
                      key={discoveryUser.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        background: isLightTheme ? '#f9fafb' : 'rgba(255,255,255,0.01)',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{discoveryUser.username}</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{discoveryUser.email}</span>
                      </div>
                      <button
                        onClick={() => handleAddFriend(discoveryUser.id)}
                        style={{
                          background: 'var(--accent-hover)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        <UserPlus size={10} /> Agregar
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* List of Friends Card */}
            <div style={{
              background: isLightTheme ? '#ffffff' : '#151518',
              border: isLightTheme ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.04)',
              borderRadius: '16px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: isLightTheme ? '0 4px 12px rgba(0,0,0,0.04)' : '0 4px 6px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <Users size={18} style={{ color: 'var(--accent-hover)' }} />
                Mis Amigos / Red de Trabajo ({friends.length})
              </h3>

              {friends.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '6px', color: 'var(--text-secondary)', padding: '2rem' }}>
                  <User size={32} style={{ opacity: 0.3 }} />
                  <span style={{ fontSize: '0.8rem', textAlign: 'center' }}>No tienes colaboradores agregados. ¡Usa el buscador para añadir amigos y empezar a delegar tareas!</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
                  {friends.map(friend => (
                    <div 
                      key={friend.friend_id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        background: isLightTheme ? '#f9fafb' : 'rgba(255,255,255,0.01)',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(124, 58, 237, 0.1)', color: 'var(--accent-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                          {friend.username.substring(0, 2).toUpperCase()}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{friend.username}</span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{friend.email}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFriend(friend.friend_id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          padding: '4px'
                        }}
                        title="Eliminar amigo"
                        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
