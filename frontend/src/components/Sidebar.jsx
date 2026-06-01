import { useState } from 'react';
import { Inbox, Calendar, CalendarDays, Plus, Check, X, Edit, Trash2 } from 'lucide-react';

const COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#14b8a6', // Teal
];

export function Sidebar({ activeList, setActiveList, lists, onRefreshLists }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);

  // Edit list states
  const [editingListId, setEditingListId] = useState(null);
  const [editingListName, setEditingListName] = useState('');
  const [editingListColor, setEditingListColor] = useState('');

  // Hover item tracker
  const [hoveredListId, setHoveredListId] = useState(null);

  const handleAddList = async (e) => {
    if (e) e.preventDefault();
    if (!newListName.trim()) return;

    try {
      const res = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newListName.trim(),
          color: selectedColor
        })
      });
      if (res.ok) {
        setNewListName('');
        setIsAdding(false);
        if (onRefreshLists) onRefreshLists();
      }
    } catch (err) {
      console.error(err);
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
          color: editingListColor
        })
      });
      if (res.ok) {
        setEditingListId(null);
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
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span>✓</span> Tasks
      </div>

      <div className="nav-section">
        <a 
          className={`nav-item ${activeList === 'inbox' ? 'active' : ''}`}
          onClick={() => setActiveList('inbox')}
        >
          <Inbox /> Inbox
        </a>
        <a 
          className={`nav-item ${activeList === 'today' ? 'active' : ''}`}
          onClick={() => setActiveList('today')}
        >
          <Calendar /> Today
        </a>
        <a 
          className={`nav-item ${activeList === 'upcoming' ? 'active' : ''}`}
          onClick={() => setActiveList('upcoming')}
        >
          <CalendarDays /> Upcoming
        </a>
      </div>

      <div className="nav-section">
        <div className="nav-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>My Lists</span>
          {!isAdding && (
            <button 
              className="icon-btn" 
              onClick={() => { setIsAdding(true); setEditingListId(null); }} 
              title="Add List"
              style={{ padding: '2px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <Plus size={14} />
            </button>
          )}
        </div>

        {lists.filter(l => l.name.toLowerCase() !== 'inbox').map(list => {
          const isEditing = editingListId === list.id;
          const isHovered = hoveredListId === list.id;

          if (isEditing) {
            return (
              <form 
                key={list.id} 
                onSubmit={(e) => handleEditList(e, list.id)} 
                className="edit-list-inline-form" 
                style={{ padding: '0.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.02)' }}
              >
                <input 
                  type="text" 
                  value={editingListName}
                  onChange={(e) => setEditingListName(e.target.value)}
                  autoFocus
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                    padding: '4px 8px',
                    fontSize: '0.85rem',
                    outline: 'none',
                    width: '100%'
                  }}
                />
                
                {/* Color selection row */}
                <div className="color-selectors" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setEditingListColor(color)}
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: color,
                        border: editingListColor === color ? '2px solid white' : 'none',
                        cursor: 'pointer',
                        padding: 0
                      }}
                    />
                  ))}
                </div>

                {/* Edit Action buttons */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button 
                    type="button" 
                    onClick={() => setEditingListId(null)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: '2px 6px',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px'
                    }}
                  >
                    <X size={12} /> Cancel
                  </button>
                  <button 
                    type="submit"
                    style={{
                      background: 'var(--accent-color)',
                      border: 'none',
                      color: 'white',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      padding: '2px 8px',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px'
                    }}
                  >
                    <Check size={12} /> Save
                  </button>
                </div>
              </form>
            );
          }

          return (
            <a 
              key={list.id}
              className={`nav-item ${activeList === list.id ? 'active' : ''}`}
              onClick={() => setActiveList(list.id)}
              onMouseEnter={() => setHoveredListId(list.id)}
              onMouseLeave={() => setHoveredListId(null)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', position: 'relative' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                <div 
                  style={{ 
                    width: '12px', 
                    height: '12px', 
                    borderRadius: '50%', 
                    backgroundColor: list.color || '#8e95a5',
                    flexShrink: 0
                  }} 
                />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {list.name}
                </span>
              </div>

              {isHovered && (
                <div 
                  className="list-item-hover-actions" 
                  style={{ display: 'flex', gap: '4px', position: 'absolute', right: '12px', background: activeList === list.id ? 'rgba(30, 30, 30, 0.9)' : 'rgba(28, 28, 28, 0.9)', paddingLeft: '8px', borderRadius: '4px' }}
                  onClick={(e) => e.stopPropagation()} // Prevent clicking actions from selecting list
                >
                  <button 
                    onClick={() => startEditing(list)}
                    style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                    title="Editar lista"
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                  >
                    <Edit size={12} />
                  </button>
                  <button 
                    onClick={() => handleDeleteList(list.id)}
                    style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                    title="Eliminar lista"
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger-color)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </a>
          );
        })}

        {isAdding && (
          <form onSubmit={handleAddList} className="add-list-inline-form" style={{ padding: '0.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="List name..." 
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              autoFocus
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                padding: '4px 8px',
                fontSize: '0.85rem',
                outline: 'none',
                width: '100%'
              }}
            />
            
            {/* Color selection row */}
            <div className="color-selectors" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: color,
                    border: selectedColor === color ? '2px solid white' : 'none',
                    cursor: 'pointer',
                    padding: 0
                  }}
                />
              ))}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button 
                type="button" 
                onClick={() => setIsAdding(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
              >
                <X size={12} /> Cancel
              </button>
              <button 
                type="submit"
                style={{
                  background: 'var(--accent-color)',
                  border: 'none',
                  color: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  padding: '2px 8px',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
              >
                <Check size={12} /> Add
              </button>
            </div>
          </form>
        )}
      </div>
    </aside>
  );
}
