import { useState } from 'react';

export function TaskModal({ onClose, onSave, lists, defaultListId }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [listId, setListId] = useState(defaultListId || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    onSave({
      title,
      description,
      due_date: dueDate || null,
      list_id: listId || null,
      priority: 0
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Create New Task</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Task Title</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="What do you need to do?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label>Description (Optional)</label>
            <textarea 
              className="form-control" 
              placeholder="Add details..."
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Due Date</label>
              <input 
                type="date" 
                className="form-control" 
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>
            
            <div className="form-group" style={{ flex: 1 }}>
              <label>List</label>
              <select 
                className="form-control"
                value={listId}
                onChange={e => setListId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">None (Inbox)</option>
                {lists.map(list => (
                  <option key={list.id} value={list.id}>{list.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!title.trim()}>
              Save Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
