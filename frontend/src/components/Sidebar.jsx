import { useState } from 'react';
import { useTodo } from '../context/TodoContext';
import { 
  Inbox, Calendar, CalendarDays, Plus, Check, CheckCircle2, X, Edit, Trash2, Folder, FolderPlus, ChevronDown, ChevronRight,
  Briefcase, Home, ShoppingCart, Heart, BookOpen, Plane, Flame, GraduationCap, Users, Code, DollarSign, Inbox as InboxIcon,
  FolderHeart, FolderLock, FolderCode, FolderArchive, FolderClock
} from 'lucide-react';

const FOLDER_ICON_MAP = {
  Folder: Folder,
  FolderHeart: FolderHeart,
  FolderLock: FolderLock,
  FolderCode: FolderCode,
  FolderArchive: FolderArchive,
  FolderClock: FolderClock
};

const COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#14b8a6', // Teal
];

const ICON_MAP = {
  Briefcase: Briefcase,
  Home: Home,
  ShoppingCart: ShoppingCart,
  Heart: Heart,
  BookOpen: BookOpen,
  Plane: Plane,
  Flame: Flame,
  GraduationCap: GraduationCap,
  Users: Users,
  Code: Code,
  DollarSign: DollarSign,
  Inbox: InboxIcon
};

export function Sidebar({ mobileOpen, onClose }) {
  const {
    activeList,
    setActiveList: rawSetActiveList,
    lists,
    fetchLists: onRefreshLists,
    tasks = [],
    tags = [],
    activeTagFilter,
    setActiveTagFilter,
    listGroups = [],
    fetchListGroups: onRefreshListGroups,
    handleUpdateTaskList: onUpdateTaskList,
    handleRescheduleTask: onRescheduleTask,
    fetchTags: onRefreshTags,
    handleUpdateTask
  } = useTodo();

  const setActiveList = (val) => {
    rawSetActiveList(val);
    setActiveTagFilter(null);
    if (onClose) onClose();
  };
  const [isAdding, setIsAdding] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectedListGroupId, setSelectedListGroupId] = useState('');
  const [selectedListIcon, setSelectedListIcon] = useState('Briefcase');
  const [selectedListType, setSelectedListType] = useState('task');
  const [editingListType, setEditingListType] = useState('task');

  // Tag creation states
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [selectedTagColor, setSelectedTagColor] = useState(COLORS[0]);

  // Edit list states
  const [editingListId, setEditingListId] = useState(null);
  const [editingListName, setEditingListName] = useState('');
  const [editingListColor, setEditingListColor] = useState('');
  const [editingListGroupId, setEditingListGroupId] = useState('');
  const [editingListIcon, setEditingListIcon] = useState('Briefcase');

  // Hover list item tracker
  const [hoveredListId, setHoveredListId] = useState(null);

  // Group states
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupColor, setSelectedGroupColor] = useState(COLORS[0]);
  const [selectedGroupIcon, setSelectedGroupIcon] = useState('Folder');
  const [expandedGroupIds, setExpandedGroupIds] = useState({});
  const [hoveredGroupId, setHoveredGroupId] = useState(null);

  // Edit group states
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [editingGroupColor, setEditingGroupColor] = useState('');
  const [editingGroupIcon, setEditingGroupIcon] = useState('Folder');

  // Drag and Drop states
  const [isDraggingList, setIsDraggingList] = useState(false);
  const [draggedOverGroupId, setDraggedOverGroupId] = useState(null);
  const [isDraggedOverGeneral, setIsDraggedOverGeneral] = useState(false);
  const [draggedOverListId, setDraggedOverListId] = useState(null);
  const [draggedOverSystemView, setDraggedOverSystemView] = useState(null);
  const [draggedOverTagId, setDraggedOverTagId] = useState(null);

  const handleAddList = async (e) => {
    if (e) e.preventDefault();
    if (!newListName.trim()) return;

    try {
      const res = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newListName.trim(),
          color: selectedColor,
          group_id: selectedListGroupId ? parseInt(selectedListGroupId, 10) : null,
          icon: selectedListIcon,
          type: selectedListType
        })
      });
      if (res.ok) {
        setNewListName('');
        setSelectedListGroupId('');
        setSelectedListIcon('Briefcase');
        setSelectedListType('task');
        setIsAdding(false);
        if (onRefreshLists) onRefreshLists();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddTag = async (e) => {
    if (e) e.preventDefault();
    const name = newTagName.trim();
    if (!name) return;

    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color: selectedTagColor })
      });
      if (res.ok) {
        setIsAddingTag(false);
        setNewTagName('');
        if (onRefreshTags) {
          await onRefreshTags();
        }
      }
    } catch (err) {
      console.error('Error creating tag:', err);
    }
  };

  const handleEditList = async (e, listId) => {
    if (e) e.preventDefault();
    if (!editingListName.trim()) return;

    try {
      const res = await fetch(`/api/lists/${listId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingListName.trim(),
          color: editingListColor,
          group_id: editingListGroupId ? parseInt(editingListGroupId, 10) : null,
          icon: editingListIcon,
          type: editingListType
        })
      });
      if (res.ok) {
        setEditingListId(null);
        setEditingListGroupId('');
        setEditingListType('task');
        if (onRefreshLists) onRefreshLists();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteList = async (listId) => {
    const confirmDelete = window.confirm("¿Estás seguro de que deseas eliminar esta lista? Se eliminarán permanentemente todas las tareas que contiene.");
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/lists/${listId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (activeList === listId) {
          setActiveList('inbox');
        }
        if (onRefreshLists) onRefreshLists();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startEditing = (list) => {
    setEditingListId(list.id);
    setEditingListName(list.name);
    setEditingListColor(list.color || COLORS[0]);
    setEditingListGroupId(list.group_id ? list.group_id.toString() : '');
    setEditingListIcon(list.icon || 'Briefcase');
    setEditingListType(list.type || 'task');
  };

  // Group helpers
  const handleAddGroup = async (e) => {
    if (e) e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      const res = await fetch('/api/list-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroupName.trim(),
          color: selectedGroupColor,
          icon: selectedGroupIcon
        })
      });
      if (res.ok) {
        setNewGroupName('');
        setSelectedGroupIcon('Folder');
        setIsAddingGroup(false);
        if (onRefreshListGroups) onRefreshListGroups();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditGroup = async (e, groupId) => {
    if (e) e.preventDefault();
    if (!editingGroupName.trim()) return;

    try {
      const res = await fetch(`/api/list-groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingGroupName.trim(),
          color: editingGroupColor,
          icon: editingGroupIcon
        })
      });
      if (res.ok) {
        setEditingGroupId(null);
        if (onRefreshListGroups) onRefreshListGroups();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteGroup = async (groupId) => {
    const confirmDelete = window.confirm("¿Estás seguro de que deseas eliminar esta carpeta? Las listas contenidas se conservarán pero quedarán sin carpeta.");
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/list-groups/${groupId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (onRefreshListGroups) onRefreshListGroups();
        if (onRefreshLists) onRefreshLists();
      }
    } catch (err) {
      console.error(err);
    }
  };
  const handleMoveListToGroup = async (listId, groupId) => {
    try {
      const res = await fetch(`/api/lists/${listId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId })
      });
      if (res.ok) {
        if (onRefreshLists) onRefreshLists();
        if (onRefreshListGroups) onRefreshListGroups();
      }
    } catch (err) {
      console.error('Error migrating list to group:', err);
    }
  };

  const startEditingGroup = (group) => {
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
    setEditingGroupColor(group.color || COLORS[0]);
    setEditingGroupIcon(group.icon || 'Folder');
  };

  const toggleGroup = (groupId) => {
    setExpandedGroupIds(prev => ({
      ...prev,
      [groupId]: prev[groupId] === false ? true : false
    }));
  };

  const renderList = (list) => {
    const isHovered = hoveredListId === list.id;
    let IconComponent = ICON_MAP[list.icon];
    if (list.type === 'note' && (!list.icon || list.icon === 'Briefcase')) {
      IconComponent = BookOpen;
    } else if (!IconComponent) {
      IconComponent = list.type === 'note' ? BookOpen : null;
    }

    return (
      <a 
        key={`list-${list.id}`}
        className={`nav-item ${activeList === list.id ? 'active' : ''}`}
        onClick={() => setActiveList(list.id)}
        onMouseEnter={() => setHoveredListId(list.id)}
        onMouseLeave={() => setHoveredListId(null)}
        draggable={true}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', list.id.toString());
          setIsDraggingList(true);
          e.currentTarget.style.opacity = '0.4';
        }}
        onDragEnd={(e) => {
          setIsDraggingList(false);
          e.currentTarget.style.opacity = '1';
        }}
        onDragOver={(e) => {
          if (!isDraggingList) {
            e.preventDefault();
            setDraggedOverListId(list.id);
          }
        }}
        onDragLeave={() => {
          if (!isDraggingList) {
            setDraggedOverListId(null);
          }
        }}
        onDrop={async (e) => {
          if (!isDraggingList) {
            e.preventDefault();
            setDraggedOverListId(null);
            const taskIdStr = e.dataTransfer.getData('taskId') || e.dataTransfer.getData('taskid');
            if (taskIdStr) {
              const taskId = /^\d+$/.test(taskIdStr) ? parseInt(taskIdStr, 10) : taskIdStr;
              if (onUpdateTaskList) {
                await onUpdateTaskList(taskId, list.id);
              }
            }
          }
        }}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          width: '100%', 
          position: 'relative', 
          borderRadius: '6px', 
          padding: '6px 12px', 
          cursor: 'grab',
          background: draggedOverListId === list.id ? 'rgba(255, 255, 255, 0.08)' : undefined,
          border: draggedOverListId === list.id ? `1.5px dashed ${list.color || 'var(--accent-hover)'}` : '1.5px solid transparent',
          boxShadow: draggedOverListId === list.id ? `0 0 10px ${list.color || 'var(--accent-hover)'}30` : 'none',
          transition: 'all 0.2s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
          {IconComponent ? (
            <IconComponent size={14} color={list.color || '#8e95a5'} style={{ flexShrink: 0 }} />
          ) : (
            <div 
              style={{ 
                width: '10px', 
                height: '10px', 
                borderRadius: '50%', 
                backgroundColor: list.color || '#8e95a5',
                flexShrink: 0
              }} 
            />
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
            {list.name}
          </span>
        </div>

        {isHovered && (
          <div 
            className="list-item-hover-actions" 
            style={{ display: 'flex', gap: '4px', position: 'absolute', right: '12px', background: activeList === list.id ? 'rgba(30, 30, 30, 0.9)' : 'rgba(28, 28, 28, 0.9)', paddingLeft: '8px', borderRadius: '4px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => startEditing(list)}
              style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
              title="Editar lista"
            >
              <Edit size={12} />
            </button>
            <button 
              onClick={() => handleDeleteList(list.id)}
              style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
              title="Eliminar lista"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </a>
    );
  };

  return (
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <span>✓</span> Tasks
      </div>

      <div className="nav-section">
        <a 
          className={`nav-item ${activeList === 'inbox' ? 'active' : ''}`}
          onClick={() => setActiveList('inbox')}
          onDragOver={(e) => {
            if (!isDraggingList) {
              e.preventDefault();
              setDraggedOverSystemView('inbox');
            }
          }}
          onDragLeave={() => {
            if (!isDraggingList) {
              setDraggedOverSystemView(null);
            }
          }}
          onDrop={async (e) => {
            if (!isDraggingList) {
              e.preventDefault();
              setDraggedOverSystemView(null);
              const taskIdStr = e.dataTransfer.getData('taskId') || e.dataTransfer.getData('taskid');
              if (taskIdStr) {
                const taskId = /^\d+$/.test(taskIdStr) ? parseInt(taskIdStr, 10) : taskIdStr;
                const inboxList = lists.find(l => l.name.toLowerCase() === 'inbox');
                const inboxListId = inboxList ? inboxList.id : null;
                if (onUpdateTaskList) {
                  await onUpdateTaskList(taskId, inboxListId);
                }
              }
            }
          }}
          style={{
            background: draggedOverSystemView === 'inbox' ? 'rgba(255, 255, 255, 0.08)' : undefined,
            border: draggedOverSystemView === 'inbox' ? '1.5px dashed var(--accent-hover)' : '1.5px solid transparent',
            transition: 'all 0.2s ease'
          }}
        >
          <Inbox /> Inbox
        </a>
        <a 
          className={`nav-item ${activeList === 'today' ? 'active' : ''}`}
          onClick={() => setActiveList('today')}
          onDragOver={(e) => {
            if (!isDraggingList) {
              e.preventDefault();
              setDraggedOverSystemView('today');
            }
          }}
          onDragLeave={() => {
            if (!isDraggingList) {
              setDraggedOverSystemView(null);
            }
          }}
          onDrop={async (e) => {
            if (!isDraggingList) {
              e.preventDefault();
              setDraggedOverSystemView(null);
              const taskIdStr = e.dataTransfer.getData('taskId') || e.dataTransfer.getData('taskid');
              if (taskIdStr) {
                const taskId = /^\d+$/.test(taskIdStr) ? parseInt(taskIdStr, 10) : taskIdStr;
                if (onRescheduleTask) {
                  await onRescheduleTask(taskId, 0);
                }
              }
            }
          }}
          style={{
            background: draggedOverSystemView === 'today' ? 'rgba(255, 255, 255, 0.08)' : undefined,
            border: draggedOverSystemView === 'today' ? '1.5px dashed var(--accent-hover)' : '1.5px solid transparent',
            transition: 'all 0.2s ease'
          }}
        >
          <Calendar /> Today
        </a>
        <a 
          className={`nav-item ${activeList === 'upcoming' ? 'active' : ''}`}
          onClick={() => setActiveList('upcoming')}
          onDragOver={(e) => {
            if (!isDraggingList) {
              e.preventDefault();
              setDraggedOverSystemView('upcoming');
            }
          }}
          onDragLeave={() => {
            if (!isDraggingList) {
              setDraggedOverSystemView(null);
            }
          }}
          onDrop={async (e) => {
            if (!isDraggingList) {
              e.preventDefault();
              setDraggedOverSystemView(null);
              const taskIdStr = e.dataTransfer.getData('taskId') || e.dataTransfer.getData('taskid');
              if (taskIdStr) {
                const taskId = /^\d+$/.test(taskIdStr) ? parseInt(taskIdStr, 10) : taskIdStr;
                if (onRescheduleTask) {
                  await onRescheduleTask(taskId, 1);
                }
              }
            }
          }}
          style={{
            background: draggedOverSystemView === 'upcoming' ? 'rgba(255, 255, 255, 0.08)' : undefined,
            border: draggedOverSystemView === 'upcoming' ? '1.5px dashed var(--accent-hover)' : '1.5px solid transparent',
            transition: 'all 0.2s ease'
          }}
        >
          <CalendarDays /> Upcoming
        </a>
      </div>

      <div className="nav-section">
        <div className="nav-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>My Lists</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {!isAdding && !isAddingGroup && (
              <>
                <button 
                  className="icon-btn" 
                  onClick={() => { setIsAdding(true); setIsAddingGroup(false); setEditingListId(null); setSelectedListGroupId(''); setSelectedListIcon('Briefcase'); }} 
                  title="Add List"
                  style={{ padding: '2px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <Plus size={14} />
                </button>
                <button 
                  className="icon-btn" 
                  onClick={() => { setIsAddingGroup(true); setIsAdding(false); setEditingGroupId(null); setSelectedGroupColor(COLORS[0]); setSelectedGroupIcon('Folder'); }} 
                  title="Añadir Carpeta"
                  style={{ padding: '2px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <FolderPlus size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* --- GROUPS LIST --- */}
        {listGroups.map(group => {
          const isGroupExpanded = expandedGroupIds[group.id] !== false;
          const isGroupHovered = hoveredGroupId === group.id;
          const groupedLists = lists.filter(l => l.group_id === group.id && l.name.toLowerCase() !== 'inbox');

          return (
            <div 
              key={`group-${group.id}`} 
              onMouseEnter={() => setHoveredGroupId(group.id)}
              onMouseLeave={() => setHoveredGroupId(null)}
              style={{ display: 'flex', flexDirection: 'column', marginBottom: '6px' }}
            >
              {/* Group Header */}
              <div 
                className={`nav-item group-header ${draggedOverGroupId === group.id ? 'dragged-over' : ''}`}
                onClick={() => toggleGroup(group.id)}
                onDragOver={(e) => { e.preventDefault(); setDraggedOverGroupId(group.id); }}
                onDragLeave={() => { setDraggedOverGroupId(null); }}
                onDrop={async (e) => {
                  e.preventDefault();
                  setDraggedOverGroupId(null);
                  const listIdStr = e.dataTransfer.getData('text/plain');
                  if (listIdStr) {
                    const listId = parseInt(listIdStr, 10);
                    await handleMoveListToGroup(listId, group.id);
                  }
                }}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  width: '100%', 
                  padding: '6px 12px', 
                  cursor: 'pointer',
                  borderRadius: '6px',
                  background: draggedOverGroupId === group.id ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.01)',
                  border: draggedOverGroupId === group.id ? `1.5px dashed ${group.color || '#7c3aed'}` : '1.5px solid transparent',
                  boxShadow: draggedOverGroupId === group.id ? `0 0 12px ${group.color || '#7c3aed'}40` : 'none',
                  position: 'relative',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                  {isGroupExpanded ? <ChevronDown size={14} color="var(--text-secondary)" /> : <ChevronRight size={14} color="var(--text-secondary)" />}
                  {(() => {
                    const FolderIcon = FOLDER_ICON_MAP[group.icon || 'Folder'] || Folder;
                    return (
                      <FolderIcon 
                        size={14} 
                        color={group.color || '#7c3aed'} 
                        fill={group.color ? `${group.color}20` : 'rgba(124, 58, 237, 0.1)'} 
                        style={{ opacity: 0.9, flexShrink: 0 }} 
                      />
                    );
                  })()}
                  <span style={{ fontWeight: 600, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                    {group.name}
                  </span>
                </div>

                {isGroupHovered && (
                  <div 
                    className="list-item-hover-actions" 
                    style={{ display: 'flex', gap: '4px', position: 'absolute', right: '12px', background: 'rgba(28, 28, 28, 0.95)', paddingLeft: '8px', borderRadius: '4px' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button 
                      onClick={() => startEditingGroup(group)}
                      style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                      title="Editar carpeta"
                    >
                      <Edit size={12} />
                    </button>
                    <button 
                      onClick={() => handleDeleteGroup(group.id)}
                      style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                      title="Eliminar carpeta"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>

              {/* Group Lists */}
              {isGroupExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '1rem', borderLeft: '1px solid rgba(255,255,255,0.03)', marginLeft: '1.25rem', marginTop: '2px', gap: '2px' }}>
                  {groupedLists.map(list => renderList(list))}
                  {groupedLists.length === 0 && (
                    <div style={{ padding: '6px 12px', fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Carpeta vacía
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* --- GENERAL LISTS SECTION --- */}
        {listGroups.length > 0 && lists.filter(l => l.group_id === null && l.name.toLowerCase() !== 'inbox').length > 0 && (
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', padding: '8px 12px 4px 12px', borderTop: '1px solid rgba(255,255,255,0.03)', marginTop: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.6 }}>
            Listas Generales
          </div>
        )}
        {lists.filter(l => l.group_id === null && l.name.toLowerCase() !== 'inbox').map(list => renderList(list))}

        {isDraggingList && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDraggedOverGeneral(true); }}
            onDragLeave={() => { setIsDraggedOverGeneral(false); }}
            onDrop={async (e) => {
              e.preventDefault();
              setIsDraggedOverGeneral(false);
              const listIdStr = e.dataTransfer.getData('text/plain');
              if (listIdStr) {
                const listId = parseInt(listIdStr, 10);
                await handleMoveListToGroup(listId, null);
              }
            }}
            style={{
              padding: '12px',
              margin: '8px 12px',
              border: `1.5px dashed ${isDraggedOverGeneral ? 'var(--accent-color)' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: '8px',
              background: isDraggedOverGeneral ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.01)',
              color: isDraggedOverGeneral ? 'var(--accent-color)' : 'var(--text-secondary)',
              fontSize: '0.78rem',
              fontWeight: 600,
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: isDraggedOverGeneral ? '0 0 10px rgba(59, 130, 246, 0.2)' : 'none'
            }}
          >
            <FolderPlus size={14} /> Soltar aquí para sacar de carpeta
          </div>
        )}
      </div>

      <div className="nav-section" style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
        <div className="nav-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Etiquetas</span>
          <button 
            type="button"
            className="icon-btn" 
            onClick={() => { setIsAddingTag(true); setNewTagName(''); setSelectedTagColor(COLORS[0]); }} 
            title="Añadir Etiqueta"
            style={{ padding: '2px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <Plus size={14} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '0 4px' }}>
          {tags.map(tag => {
            const count = tasks.filter(task => 
              task.tags && task.tags.some(t => t.id === tag.id)
            ).length;
            
            return (
              <a 
                key={tag.id}
                className={`nav-item ${activeTagFilter === tag.name ? 'active' : ''}`}
                onClick={() => {
                  if (activeTagFilter === tag.name) {
                    setActiveTagFilter(null);
                  } else {
                    setActiveTagFilter(tag.name);
                    setActiveList(null);
                  }
                  if (onClose) onClose();
                }}
                onDragOver={(e) => {
                  if (!isDraggingList) {
                    e.preventDefault();
                    setDraggedOverTagId(tag.id);
                  }
                }}
                onDragLeave={() => {
                  if (!isDraggingList) {
                    setDraggedOverTagId(null);
                  }
                }}
                onDrop={async (e) => {
                  if (!isDraggingList) {
                    e.preventDefault();
                    setDraggedOverTagId(null);
                    const taskIdStr = e.dataTransfer.getData('taskId') || e.dataTransfer.getData('taskid');
                    if (taskIdStr) {
                      const taskId = parseInt(taskIdStr, 10);
                      if (!isNaN(taskId)) {
                        const targetTask = tasks.find(t => t.id === taskId);
                        if (targetTask) {
                          const currentTagNames = targetTask.tags ? targetTask.tags.map(t => t.name) : [];
                          if (!currentTagNames.includes(tag.name)) {
                            const updatedTagNames = [...currentTagNames, tag.name];
                            if (handleUpdateTask) {
                              await handleUpdateTask(taskId, { tags: updatedTagNames });
                            }
                          }
                        }
                      }
                    }
                  }
                }}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  width: '100%', 
                  padding: '6px 12px', 
                  borderRadius: '8px', 
                  cursor: 'pointer', 
                  transition: 'all 0.2s ease',
                  background: draggedOverTagId === tag.id ? 'rgba(255, 255, 255, 0.08)' : undefined,
                  border: draggedOverTagId === tag.id ? `1.5px dashed ${tag.color || 'var(--accent-hover)'}` : '1.5px solid transparent',
                  boxShadow: draggedOverTagId === tag.id ? `0 0 10px ${tag.color || 'var(--accent-hover)'}30` : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                  <div 
                    style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      backgroundColor: tag.color || '#8e95a5',
                      flexShrink: 0
                    }} 
                  />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                    #{tag.name}
                  </span>
                </div>
                {count > 0 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '10px' }}>
                    {count}
                  </span>
                )}
              </a>
            );
          })}
          {tags.length === 0 && (
            <div style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              Sin etiquetas
            </div>
          )}
        </div>
      </div>

      {/* Completed Section */}
      <div className="nav-section" style={{ marginTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
        <a 
          className={`nav-item ${activeList === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveList('completed')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', transition: 'background-color 0.2s' }}
        >
          <CheckCircle2 size={16} style={{ opacity: 0.7 }} />
          <span style={{ fontSize: '0.85rem' }}>Completadas</span>
        </a>
      </div>

      {/* --- PREMIUM CREATION / EDITING OVERLAY MODAL --- */}
      {(isAdding || editingListId !== null) && (
        <div 
          className="modal-overlay" 
          onClick={() => { setIsAdding(false); setEditingListId(null); }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div 
            className="modal-card"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '440px',
              background: 'rgba(28, 28, 30, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: `0 24px 50px rgba(0, 0, 0, 0.6), 0 0 40px ${
                editingListId !== null ? editingListColor + '20' : selectedColor + '20'
              }`,
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {editingListId !== null ? '📝 Editar Lista' : '✨ Crear Nueva Lista'}
              </h3>
              <button 
                type="button"
                onClick={() => { setIsAdding(false); setEditingListId(null); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={editingListId !== null ? (e) => handleEditList(e, editingListId) : handleAddList} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Input field with active color glow */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Nombre de la lista</label>
                <input 
                  type="text" 
                  placeholder="Nombre de la lista..." 
                  value={editingListId !== null ? editingListName : newListName}
                  onChange={(e) => editingListId !== null ? setEditingListName(e.target.value) : setNewListName(e.target.value)}
                  autoFocus
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${editingListId !== null ? editingListColor : selectedColor}`,
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    padding: '10px 14px',
                    fontSize: '0.9rem',
                    outline: 'none',
                    width: '100%',
                    boxShadow: `0 0 10px ${editingListId !== null ? editingListColor + '25' : selectedColor + '25'}`,
                    transition: 'all 0.3s ease'
                  }}
                />
              </div>

              {/* Color circular selectors */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Seleccionar Color</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '4px 0' }}>
                  {COLORS.map(color => {
                    const isActive = editingListId !== null ? editingListColor === color : selectedColor === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => editingListId !== null ? setEditingListColor(color) : setSelectedColor(color)}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: color,
                          border: isActive ? '2.5px solid white' : 'none',
                          cursor: 'pointer',
                          padding: 0,
                          boxShadow: isActive ? `0 0 12px ${color}` : 'none',
                          transform: isActive ? 'scale(1.15)' : 'scale(1)',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = 'scale(1.15)';
                          e.currentTarget.style.boxShadow = `0 0 10px ${color}`;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = isActive ? 'scale(1.15)' : 'scale(1)';
                          e.currentTarget.style.boxShadow = isActive ? `0 0 12px ${color}` : 'none';
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Icon Selector grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Seleccionar Ícono</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', padding: '4px 0' }}>
                  {Object.keys(ICON_MAP).map(iconName => {
                    const IconComponent = ICON_MAP[iconName];
                    const activeColor = editingListId !== null ? editingListColor : selectedColor;
                    const isSelected = editingListId !== null 
                      ? editingListIcon === iconName 
                      : selectedListIcon === iconName;

                    return (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => editingListId !== null ? setEditingListIcon(iconName) : setSelectedListIcon(iconName)}
                        style={{
                          background: isSelected ? `${activeColor}18` : 'rgba(255,255,255,0.02)',
                          border: isSelected ? `1.5px solid ${activeColor}` : '1.5px solid rgba(255,255,255,0.05)',
                          borderRadius: '10px',
                          height: '42px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: isSelected ? activeColor : 'var(--text-secondary)',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = activeColor;
                          e.currentTarget.style.color = activeColor;
                          e.currentTarget.style.background = `${activeColor}08`;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = isSelected ? activeColor : 'rgba(255,255,255,0.05)';
                          e.currentTarget.style.color = isSelected ? activeColor : 'var(--text-secondary)';
                          e.currentTarget.style.background = isSelected ? `${activeColor}18` : 'rgba(255,255,255,0.02)';
                        }}
                      >
                        <IconComponent size={18} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Folder selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Carpeta (Opcional)</label>
                <select
                  value={editingListId !== null ? editingListGroupId : selectedListGroupId}
                  onChange={(e) => editingListId !== null ? setEditingListGroupId(e.target.value) : setSelectedListGroupId(e.target.value)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1.5px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    padding: '10px 12px',
                    fontSize: '0.88rem',
                    outline: 'none',
                    cursor: 'pointer',
                    width: '100%',
                    transition: 'all 0.2s'
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-hover)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                >
                  <option value="" style={{ background: '#1c1c1e' }}>Sin carpeta</option>
                  {listGroups.map(g => (
                    <option key={g.id} value={g.id} style={{ background: '#1c1c1e' }}>{g.name}</option>
                  ))}
                </select>
              </div>

              {/* List Type selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Tipo de Lista</label>
                <select
                  value={editingListId !== null ? editingListType : selectedListType}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (editingListId !== null) {
                      setEditingListType(val);
                      if (val === 'note' && editingListIcon === 'Briefcase') {
                        setEditingListIcon('BookOpen');
                      } else if (val === 'task' && editingListIcon === 'BookOpen') {
                        setEditingListIcon('Briefcase');
                      }
                    } else {
                      setSelectedListType(val);
                      if (val === 'note' && selectedListIcon === 'Briefcase') {
                        setSelectedListIcon('BookOpen');
                      } else if (val === 'task' && selectedListIcon === 'BookOpen') {
                        setSelectedListIcon('Briefcase');
                      }
                    }
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1.5px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    padding: '10px 12px',
                    fontSize: '0.88rem',
                    outline: 'none',
                    cursor: 'pointer',
                    width: '100%',
                    transition: 'all 0.2s'
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-hover)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                >
                  <option value="task" style={{ background: '#1c1c1e' }}>Lista de Tareas (con Checkbox)</option>
                  <option value="note" style={{ background: '#1c1c1e' }}>Lista de Notas (Material de consulta)</option>
                </select>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => { setIsAdding(false); setEditingListId(null); }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    borderRadius: '8px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <X size={14} /> Cancelar
                </button>
                <button 
                  type="submit"
                  style={{
                    background: `linear-gradient(135deg, ${
                      editingListId !== null ? editingListColor : selectedColor
                    } 0%, var(--accent-hover) 100%)`,
                    border: 'none',
                    color: 'white',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    padding: '8px 20px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: `0 4px 15px ${
                      editingListId !== null ? editingListColor + '30' : selectedColor + '30'
                    }`,
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = `0 6px 20px ${
                      editingListId !== null ? editingListColor + '40' : selectedColor + '40'
                    }`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = `0 4px 15px ${
                      editingListId !== null ? editingListColor + '30' : selectedColor + '30'
                    }`;
                  }}
                >
                  <Check size={14} /> Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- PREMIUM FOLDER CREATION / EDITING OVERLAY MODAL --- */}
      {(isAddingGroup || editingGroupId !== null) && (
        <div 
          className="modal-overlay" 
          onClick={() => { setIsAddingGroup(false); setEditingGroupId(null); }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div 
            className="modal-card"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '440px',
              background: 'rgba(28, 28, 30, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: `0 24px 50px rgba(0, 0, 0, 0.6), 0 0 40px ${
                editingGroupId !== null ? editingGroupColor + '20' : selectedGroupColor + '20'
              }`,
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {editingGroupId !== null ? '📂 Editar Carpeta' : '✨ Crear Nueva Carpeta'}
              </h3>
              <button 
                type="button"
                onClick={() => { setIsAddingGroup(false); setEditingGroupId(null); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={editingGroupId !== null ? (e) => handleEditGroup(e, editingGroupId) : handleAddGroup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Input field with active color glow */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Nombre de la carpeta</label>
                <input 
                  type="text" 
                  placeholder="Nombre de la carpeta..." 
                  value={editingGroupId !== null ? editingGroupName : newGroupName}
                  onChange={(e) => editingGroupId !== null ? setEditingGroupName(e.target.value) : setNewGroupName(e.target.value)}
                  autoFocus
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${editingGroupId !== null ? editingGroupColor : selectedGroupColor}`,
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    padding: '10px 14px',
                    fontSize: '0.9rem',
                    outline: 'none',
                    width: '100%',
                    boxShadow: `0 0 10px ${editingGroupId !== null ? editingGroupColor + '25' : selectedGroupColor + '25'}`,
                    transition: 'all 0.3s ease'
                  }}
                />
              </div>

              {/* Color circular selectors */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Seleccionar Color</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '4px 0' }}>
                  {COLORS.map(color => {
                    const isActive = editingGroupId !== null ? editingGroupColor === color : selectedGroupColor === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => editingGroupId !== null ? setEditingGroupColor(color) : setSelectedGroupColor(color)}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: color,
                          border: isActive ? '2.5px solid white' : 'none',
                          cursor: 'pointer',
                          padding: 0,
                          boxShadow: isActive ? `0 0 12px ${color}` : 'none',
                          transform: isActive ? 'scale(1.15)' : 'scale(1)',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = 'scale(1.15)';
                          e.currentTarget.style.boxShadow = `0 0 10px ${color}`;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = isActive ? 'scale(1.15)' : 'scale(1)';
                          e.currentTarget.style.boxShadow = isActive ? `0 0 12px ${color}` : 'none';
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Icon Selector grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Seleccionar Ícono de Carpeta</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', padding: '4px 0' }}>
                  {Object.keys(FOLDER_ICON_MAP).map(iconName => {
                    const IconComponent = FOLDER_ICON_MAP[iconName];
                    const activeColor = editingGroupId !== null ? editingGroupColor : selectedGroupColor;
                    const isSelected = editingGroupId !== null 
                      ? editingGroupIcon === iconName 
                      : selectedGroupIcon === iconName;

                    return (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => editingGroupId !== null ? setEditingGroupIcon(iconName) : setSelectedGroupIcon(iconName)}
                        style={{
                          background: isSelected ? `${activeColor}18` : 'rgba(255,255,255,0.02)',
                          border: isSelected ? `1.5px solid ${activeColor}` : '1.5px solid rgba(255,255,255,0.05)',
                          borderRadius: '10px',
                          height: '42px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: isSelected ? activeColor : 'var(--text-secondary)',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = activeColor;
                          e.currentTarget.style.color = activeColor;
                          e.currentTarget.style.background = `${activeColor}08`;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = isSelected ? activeColor : 'rgba(255,255,255,0.05)';
                          e.currentTarget.style.color = isSelected ? activeColor : 'var(--text-secondary)';
                          e.currentTarget.style.background = isSelected ? `${activeColor}18` : 'rgba(255,255,255,0.02)';
                        }}
                      >
                        <IconComponent size={18} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => { setIsAddingGroup(false); setEditingGroupId(null); }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    borderRadius: '8px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <X size={14} /> Cancelar
                </button>
                <button 
                  type="submit"
                  style={{
                    background: `linear-gradient(135deg, ${
                      editingGroupId !== null ? editingGroupColor : selectedGroupColor
                    } 0%, var(--accent-hover) 100%)`,
                    border: 'none',
                    color: 'white',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    padding: '8px 20px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: `0 4px 15px ${
                      editingGroupId !== null ? editingGroupColor + '30' : selectedGroupColor + '30'
                    }`,
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = `0 6px 20px ${
                      editingGroupId !== null ? editingGroupColor + '40' : selectedGroupColor + '40'
                    }`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = `0 4px 15px ${
                      editingGroupId !== null ? editingGroupColor + '30' : selectedGroupColor + '30'
                    }`;
                  }}
                >
                  <Check size={14} /> Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- PREMIUM TAG CREATION OVERLAY MODAL --- */}
      {isAddingTag && (
        <div 
          className="modal-overlay" 
          onClick={() => setIsAddingTag(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div 
            className="modal-card"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '440px',
              background: 'rgba(28, 28, 30, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: `0 24px 50px rgba(0, 0, 0, 0.6), 0 0 40px ${selectedTagColor}20`,
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🏷️ Crear Nueva Etiqueta
              </h3>
              <button 
                type="button"
                onClick={() => setIsAddingTag(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddTag} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Nombre de la etiqueta</label>
                <input 
                  type="text" 
                  placeholder="Nombre de la etiqueta..." 
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  autoFocus
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${selectedTagColor}`,
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    padding: '10px 14px',
                    fontSize: '0.9rem',
                    outline: 'none',
                    width: '100%',
                    boxShadow: `0 0 10px ${selectedTagColor}25`,
                    transition: 'all 0.3s ease'
                  }}
                />
              </div>

              {/* Color circular selectors */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Seleccionar Color</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '4px 0' }}>
                  {COLORS.map(color => {
                    const isActive = selectedTagColor === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedTagColor(color)}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: color,
                          border: isActive ? '2.5px solid white' : 'none',
                          cursor: 'pointer',
                          padding: 0,
                          boxShadow: isActive ? `0 0 12px ${color}` : 'none',
                          transform: isActive ? 'scale(1.15)' : 'scale(1)',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = 'scale(1.15)';
                          e.currentTarget.style.boxShadow = `0 0 10px ${color}`;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = isActive ? 'scale(1.15)' : 'scale(1)';
                          e.currentTarget.style.boxShadow = isActive ? `0 0 12px ${color}` : 'none';
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => setIsAddingTag(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    borderRadius: '8px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <X size={14} /> Cancelar
                </button>
                <button 
                  type="submit"
                  style={{
                    background: `linear-gradient(135deg, ${selectedTagColor} 0%, var(--accent-hover) 100%)`,
                    border: 'none',
                    color: 'white',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    padding: '8px 20px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: `0 4px 15px ${selectedTagColor}30`,
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = `0 6px 20px ${selectedTagColor}40`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = `0 4px 15px ${selectedTagColor}30`;
                  }}
                >
                  <Check size={14} /> Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
}
