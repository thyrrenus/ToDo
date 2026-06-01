import { useState } from 'react';
import { ChevronDown, ChevronRight, MoreHorizontal, Edit, Trash2 } from 'lucide-react';

export function SectionHeader({ section, tasksCount, onToggleCollapse, onRename, onDelete }) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="section-header-container" onMouseLeave={() => setShowMenu(false)}>
      <div className="section-header" onClick={() => onToggleCollapse(section.id, !section.is_collapsed)}>
        <span className="section-chevron">
          {section.is_collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </span>
        <h3 className="section-title">{section.name}</h3>
        <span className="section-count">{tasksCount}</span>
      </div>
      
      <div className="section-actions" onMouseEnter={() => setShowMenu(true)}>
        <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}>
          <MoreHorizontal size={16} />
        </button>
        {showMenu && (
          <div className="section-menu dropdown-menu">
            <button onClick={(e) => { e.stopPropagation(); onRename(section); setShowMenu(false); }}>
              <Edit size={14} /> Rename
            </button>
            <button className="danger" onClick={(e) => { e.stopPropagation(); onDelete(section.id); setShowMenu(false); }}>
              <Trash2 size={14} /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
