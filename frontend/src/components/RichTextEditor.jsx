import { useRef, useMemo, useState, useEffect } from 'react';
import { useEditor, EditorContent, NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { TableKit } from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Node } from '@tiptap/core';

// Code block syntax highlighting imports
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { createLowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import bash from 'highlight.js/lib/languages/bash';

const lowlight = createLowlight();
lowlight.register('javascript', javascript);
lowlight.register('js', javascript);
lowlight.register('typescript', typescript);
lowlight.register('ts', typescript);
lowlight.register('css', css);
lowlight.register('html', xml);
lowlight.register('xml', xml);
lowlight.register('python', python);
lowlight.register('py', python);
lowlight.register('sql', sql);
lowlight.register('json', json);
lowlight.register('markdown', markdown);
lowlight.register('md', markdown);
lowlight.register('bash', bash);
lowlight.register('sh', bash);
lowlight.register('shell', bash);

const DetailsNode = Node.create({
  name: 'details',
  group: 'block',
  content: 'summary block*',
  defining: true,
  addAttributes() {
    return {
      open: {
        default: false,
        parseHTML: element => element.hasAttribute('open'),
        renderHTML: attributes => {
          if (attributes.open) {
            return { open: '' };
          }
          return {};
        },
      },
    };
  },
  parseHTML() {
    return [{ tag: 'details' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['details', HTMLAttributes, 0];
  },
});

// Custom Summary Node for Tiptap
const SummaryNode = Node.create({
  name: 'summary',
  content: 'inline*',
  defining: true,
  parseHTML() {
    return [{ tag: 'summary' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['summary', HTMLAttributes, 0];
  },
});

// Custom Image Node for Tiptap
const ImageNode = Node.create({
  name: 'image',
  group: 'block',
  selectable: true,
  draggable: true,
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: 'img[src]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['img', HTMLAttributes];
  },
});

// Custom React component for the code block NodeView
export function CodeBlockComponent({ node, updateAttributes }) {
  const [copied, setCopied] = useState(false);
  const languages = ['auto', 'javascript', 'typescript', 'html', 'css', 'python', 'sql', 'json', 'markdown', 'bash'];

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(node.textContent || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <NodeViewWrapper className="code-block-wrapper" style={{ position: 'relative' }}>
      <div className="code-block-controls" contentEditable={false} style={{ userSelect: 'none' }}>
        <select
          className="code-block-lang-select"
          value={node.attrs.language || 'auto'}
          onChange={e => updateAttributes({ language: e.target.value })}
        >
          {languages.map(lang => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
        <button className="code-block-copy-btn" onClick={copyToClipboard}>
          {copied ? '✅ ¡Copiado!' : '📋 Copiar'}
        </button>
      </div>
      <pre>
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  );
}

const CustomCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockComponent);
  },
});


const slashCommands = [
  { key: 'paragraph', label: 'Texto normal', desc: 'Párrafo de texto normal', category: 'Texto básico', type: 'format', format: 'paragraph' },
  { key: 'h1', label: 'Título Grande', desc: 'Encabezado H1', category: 'Texto básico', format: 'header', value: 1, type: 'format' },
  { key: 'h2', label: 'Título Mediano', desc: 'Encabezado H2', category: 'Texto básico', format: 'header', value: 2, type: 'format' },
  { key: 'h3', label: 'Título Pequeño', desc: 'Encabezado H3', category: 'Texto básico', format: 'header', value: 3, type: 'format' },
  
  { key: 'taskList', label: 'Lista de tareas', desc: 'Checklist interactivo', category: 'Listas', format: 'list', value: 'taskList', type: 'format' },
  { key: 'bullet', label: 'Lista con viñetas', desc: 'Lista simple', category: 'Listas', format: 'list', value: 'bullet', type: 'format' },
  { key: 'ordered', label: 'Lista numerada', desc: 'Lista con números', category: 'Listas', format: 'list', value: 'ordered', type: 'format' },
  
  { key: 'collapsible', label: 'Sección colapsable', desc: 'Acordeón de texto ocultable', category: 'Avanzado', type: 'action', action: 'collapsible' },
  { key: 'callout', label: 'Caja destacada', desc: 'Contenedor sutil destacado', category: 'Avanzado', format: 'blockquote', value: true, type: 'format' },
  { key: 'table', label: 'Tabla', desc: 'Insertar tabla de 3x3', category: 'Avanzado', type: 'action', action: 'table' },
  { key: 'image', label: 'Imagen', desc: 'Subir una imagen', category: 'Avanzado', type: 'action', action: 'image' },
  { key: 'divider', label: 'Línea divisora', desc: 'Línea horizontal sutil', category: 'Avanzado', type: 'action', action: 'divider' },
  { key: 'clean', label: 'Limpiar formato', desc: 'Quita todo el formato', category: 'Avanzado', type: 'action', action: 'clean' }
];

const emojiList = [
  { char: '🚀', key: 'rocket', label: 'rocket', desc: 'Cohete' },
  { char: '⚠️', key: 'warning', label: 'warning', desc: 'Advertencia' },
  { char: '🔥', key: 'fire', label: 'fire', desc: 'Fuego' },
  { char: '✅', key: 'check', label: 'check', desc: 'Completado' },
  { char: '⭐', key: 'star', label: 'star', desc: 'Estrella' },
  { char: '💡', key: 'idea', label: 'idea', desc: 'Idea' },
  { char: '🐛', key: 'bug', label: 'bug', desc: 'Error/Bug' },
  { char: '📝', key: 'memo', label: 'memo', desc: 'Nota' },
  { char: '🔗', key: 'link', label: 'link', desc: 'Enlace' },
  { char: '❤️', key: 'heart', label: 'heart', desc: 'Corazón' },
  { char: '👍', key: 'thumbsup', label: 'thumbsup', desc: 'Me gusta' },
  { char: '🎉', key: 'party', label: 'party', desc: 'Celebración' },
  { char: '😊', key: 'smile', label: 'smile', desc: 'Sonrisa' },
  { char: '👀', key: 'eyes', label: 'eyes', desc: 'Ojos' },
  { char: '📅', key: 'calendar', label: 'calendar', desc: 'Calendario' }
];

const textColors = [
  { name: 'Predeterminado', value: null, color: 'var(--text-primary)' },
  { name: 'Gris', value: '#8e95a5', color: '#8e95a5' },
  { name: 'Rojo', value: '#ef4444', color: '#ef4444' },
  { name: 'Naranja', value: '#f97316', color: '#f97316' },
  { name: 'Amarillo', value: '#eab308', color: '#eab308' },
  { name: 'Verde', value: '#22c55e', color: '#22c55e' },
  { name: 'Azul', value: '#3b82f6', color: '#3b82f6' },
  { name: 'Violeta', value: '#a855f7', color: '#a855f7' },
  { name: 'Rosa', value: '#ec4899', color: '#ec4899' },
];

const highlightColors = [
  { name: 'Predeterminado', value: null, color: 'transparent' },
  { name: 'Resaltado Gris', value: 'rgba(142, 149, 165, 0.2)', color: 'rgba(142, 149, 165, 0.2)' },
  { name: 'Resaltado Rojo', value: 'rgba(239, 68, 68, 0.2)', color: 'rgba(239, 68, 68, 0.2)' },
  { name: 'Resaltado Naranja', value: 'rgba(249, 115, 22, 0.2)', color: 'rgba(249, 115, 22, 0.2)' },
  { name: 'Resaltado Amarillo', value: 'rgba(234, 179, 8, 0.2)', color: 'rgba(234, 179, 8, 0.2)' },
  { name: 'Resaltado Verde', value: 'rgba(34, 197, 94, 0.2)', color: 'rgba(34, 197, 94, 0.2)' },
  { name: 'Resaltado Azul', value: 'rgba(59, 130, 246, 0.2)', color: 'rgba(59, 130, 246, 0.2)' },
  { name: 'Resaltado Violeta', value: 'rgba(168, 85, 247, 0.2)', color: 'rgba(168, 85, 247, 0.2)' },
  { name: 'Resaltado Rosa', value: 'rgba(236, 72, 153, 0.2)', color: 'rgba(236, 72, 153, 0.2)' },
];
export function RichTextEditor({ value, onChange, placeholder, tasks = [], onCreateSubtask }) {
  const [activeCellElement, setActiveCellElement] = useState(null);
  const [showColMenu, setShowColMenu] = useState(false);
  const [showRowMenu, setShowRowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [showHashMenu, setShowHashMenu] = useState(false);
  const [hashQuery, setHashQuery] = useState('');
  const [hashMenuPosition, setHashMenuPosition] = useState({ top: 0, left: 0 });
  const [hashSelectedIndex, setHashSelectedIndex] = useState(0);

  const [showEmojiMenu, setShowEmojiMenu] = useState(false);
  const [emojiQuery, setEmojiQuery] = useState('');
  const [emojiMenuPosition, setEmojiMenuPosition] = useState({ top: 0, left: 0 });
  const [emojiSelectedIndex, setEmojiSelectedIndex] = useState(0);

  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);

  const [showPlusButton, setShowPlusButton] = useState(false);
  const [plusButtonPosition, setPlusButtonPosition] = useState({ top: 0 });

  // Refs for callbacks to prevent re-binding event listeners
  const onChangeRef = useRef(onChange);
  const onCreateSubtaskRef = useRef(onCreateSubtask);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onCreateSubtaskRef.current = onCreateSubtask;
  }, [onCreateSubtask]);

  const selectCell = (tdElement) => {
    if (!tdElement) return;
    try {
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(tdElement);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      if (editor) editor.commands.focus();
    } catch (e) {
      console.error('Failed to select cell:', e);
    }
  };



  const triggerImageUpload = () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      const file = input.files[0];
      if (file) {
        const formData = new FormData();
        formData.append('image', file);

        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });
          const data = await res.json();
          if (data.url && editor) {
            editor.chain().focus().insertContent(`<img src="${data.url}" alt="" />`).run();
          }
        } catch (err) {
          console.error('Image upload failed', err);
        }
      }
    };
  };

  const filteredOptions = useMemo(() => {
    if (!slashQuery) return slashCommands;
    const query = slashQuery.toLowerCase();
    return slashCommands.filter(
      (cmd) => 
        cmd.key.includes(query) || 
        cmd.label.toLowerCase().includes(query) ||
        cmd.desc.toLowerCase().includes(query)
    );
  }, [slashQuery]);

  const filteredTasks = useMemo(() => {
    if (!hashQuery) return tasks.slice(0, 10);
    const query = hashQuery.toLowerCase();
    return tasks.filter(t => 
      t.id.toString().includes(query) || 
      t.title.toLowerCase().includes(query)
    ).slice(0, 10);
  }, [hashQuery, tasks]);

  const filteredEmojis = useMemo(() => {
    if (!emojiQuery) return emojiList;
    const query = emojiQuery.toLowerCase();
    return emojiList.filter(e => 
      e.key.includes(query) || 
      e.desc.toLowerCase().includes(query)
    );
  }, [emojiQuery]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredOptions]);

  useEffect(() => {
    setHashSelectedIndex(0);
  }, [filteredTasks]);

  useEffect(() => {
    setEmojiSelectedIndex(0);
  }, [filteredEmojis]);

  const toggleFormat = (formatName) => {
    if (!editor) return;
    if (formatName === 'bold') editor.chain().focus().toggleBold().run();
    if (formatName === 'italic') editor.chain().focus().toggleItalic().run();
    if (formatName === 'underline') editor.chain().focus().toggleUnderline().run();
    if (formatName === 'strike') editor.chain().focus().toggleStrike().run();
  };

  const toggleCodeBlock = () => {
    if (editor) editor.chain().focus().toggleCodeBlock().run();
  };

  const toggleBlockquote = () => {
    if (editor) editor.chain().focus().toggleBlockquote().run();
  };

  const insertCollapsible = () => {
    if (editor) {
      editor.chain().focus().insertContent('<details><summary>Sección colapsable (haz clic para expandir)</summary><p>Escribe aquí el contenido...</p></details>').run();
    }
  };

  const insertDivider = () => {
    if (editor) {
      editor.chain().focus().setHorizontalRule().run();
    }
  };

  const insertTable = () => {
    if (editor) {
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    }
    setShowContextMenu(false);
  };

  const getSelectedCellElement = () => {
    if (!editor) return null;
    try {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        let node = selection.getRangeAt(0).startContainer;
        while (node && node !== editor.view.dom) {
          if (node.nodeName === 'TD' || node.nodeName === 'TH') {
            return node;
          }
          node = node.parentNode;
        }
      }
    } catch (e) {
      console.error('Failed to get active cell:', e);
    }
    return null;
  };

  const getIsCursorInTable = () => {
    return !!getSelectedCellElement();
  };

  const handleTableAction = (action) => {
    if (!editor) return;
    if (action === 'insertRowAbove') editor.chain().focus().addRowBefore().run();
    else if (action === 'insertRowBelow') editor.chain().focus().addRowAfter().run();
    else if (action === 'insertColumnLeft') editor.chain().focus().addColumnBefore().run();
    else if (action === 'insertColumnRight') editor.chain().focus().addColumnAfter().run();
    else if (action === 'deleteRow') editor.chain().focus().deleteRow().run();
    else if (action === 'deleteColumn') editor.chain().focus().deleteColumn().run();
    else if (action === 'deleteTable') editor.chain().focus().deleteTable().run();

    setShowContextMenu(false);
  };

  const triggerMention = (char) => {
    if (editor) {
      editor.chain().focus().insertContent(char).run();
    }
  };

  const copySelectionAsMarkdown = async () => {
    if (!editor) return;
    const nativeSelection = window.getSelection();
    if (nativeSelection && nativeSelection.rangeCount > 0) {
      const nativeRange = nativeSelection.getRangeAt(0);
      const container = document.createElement('div');
      container.appendChild(nativeRange.cloneContents());
      const html = container.innerHTML;
      const markdown = htmlToMarkdown(html);
      
      try {
        await navigator.clipboard.writeText(markdown);
      } catch (err) {
        console.error('Failed to copy to clipboard', err);
      }
    }
  };

  const pasteMarkdownFromClipboard = async () => {
    if (!editor) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const html = markdownToHtml(text);
        editor.chain().focus().insertContent(html).run();
      }
    } catch (err) {
      console.error('Failed to read clipboard', err);
    }
  };

  const cleanFormatting = () => {
    if (editor) {
      editor.chain().focus().unsetAllMarks().clearNodes().run();
    }
  };

  const handleMoveColumn = (direction) => {
    if (!editor || !activeCellElement) return;
    const colIndex = activeCellElement.cellIndex;
    const table = activeCellElement.closest('table');
    if (!table) return;
    const colCount = table.rows[0].cells.length;
    
    const targetIndex = direction === 'left' ? colIndex - 1 : colIndex + 1;
    if (targetIndex < 0 || targetIndex >= colCount) return;

    const { state } = editor;
    const { selection } = state;
    const { $from } = selection;

    let tablePos = null;
    let tableNode = null;
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type.name === 'table') {
        tablePos = $from.before(d);
        tableNode = $from.node(d);
        break;
      }
    }

    if (tablePos === null || !tableNode) return;

    const tr = state.tr;
    const newRows = [];
    tableNode.forEach((rowNode) => {
      const cells = [];
      rowNode.forEach((cellNode) => {
        cells.push(cellNode);
      });
      if (colIndex < cells.length && targetIndex < cells.length) {
        const temp = cells[colIndex];
        cells[colIndex] = cells[targetIndex];
        cells[targetIndex] = temp;
      }
      const newRow = rowNode.type.create(rowNode.attrs, cells);
      newRows.push(newRow);
    });

    const newTable = tableNode.type.create(tableNode.attrs, newRows);
    tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);
    editor.view.dispatch(tr);
    
    setTimeout(() => {
      if (!editor || editor.isDestroyed) return;
      const updatedTable = editor.view.dom.querySelector('table');
      if (updatedTable && activeCellElement.parentNode) {
        const row = updatedTable.rows[activeCellElement.parentNode.rowIndex];
        if (row && row.cells[targetIndex]) {
          selectCell(row.cells[targetIndex]);
        }
      }
    }, 50);
  };

  const handleMoveRow = (direction) => {
    if (!editor || !activeCellElement) return;
    const trElement = activeCellElement.closest('tr');
    if (!trElement) return;
    const rowIndex = trElement.rowIndex;
    const table = activeCellElement.closest('table');
    if (!table) return;
    const rowCount = table.rows.length;
    
    const targetIndex = direction === 'up' ? rowIndex - 1 : rowIndex + 1;
    if (targetIndex < 0 || targetIndex >= rowCount) return;

    const { state } = editor;
    const { selection } = state;
    const { $from } = selection;

    let tablePos = null;
    let tableNode = null;
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type.name === 'table') {
        tablePos = $from.before(d);
        tableNode = $from.node(d);
        break;
      }
    }

    if (tablePos === null || !tableNode) return;

    const tr = state.tr;
    const rows = [];
    tableNode.forEach((rowNode) => {
      rows.push(rowNode);
    });

    if (rowIndex < rows.length && targetIndex < rows.length) {
      const temp = rows[rowIndex];
      rows[rowIndex] = rows[targetIndex];
      rows[targetIndex] = temp;
    }

    const newTable = tableNode.type.create(tableNode.attrs, rows);
    tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);
    editor.view.dispatch(tr);

    setTimeout(() => {
      if (!editor || editor.isDestroyed) return;
      const updatedTable = editor.view.dom.querySelector('table');
      if (updatedTable) {
        const row = updatedTable.rows[targetIndex];
        if (row && row.cells[activeCellElement.cellIndex]) {
          selectCell(row.cells[activeCellElement.cellIndex]);
        }
      }
    }, 50);
  };

  const handleSetColumnColor = (color) => {
    if (!editor || !activeCellElement) return;
    const colIndex = activeCellElement.cellIndex;
    const { state } = editor;
    const { selection } = state;
    const { $from } = selection;

    let tablePos = null;
    let tableNode = null;
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type.name === 'table') {
        tablePos = $from.before(d);
        tableNode = $from.node(d);
        break;
      }
    }

    if (tablePos === null || !tableNode) return;

    const tr = state.tr;
    const newRows = [];
    tableNode.forEach((rowNode) => {
      const cells = [];
      rowNode.forEach((cellNode, index) => {
        if (index === colIndex) {
          const newCell = cellNode.type.create({
            ...cellNode.attrs,
            background: color
          }, cellNode.content);
          cells.push(newCell);
        } else {
          cells.push(cellNode);
        }
      });
      const newRow = rowNode.type.create(rowNode.attrs, cells);
      newRows.push(newRow);
    });

    const newTable = tableNode.type.create(tableNode.attrs, newRows);
    tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);
    editor.view.dispatch(tr);
  };

  const handleSetRowColor = (color) => {
    if (!editor || !activeCellElement) return;
    const trElement = activeCellElement.closest('tr');
    if (!trElement) return;
    const rowIndex = trElement.rowIndex;
    const { state } = editor;
    const { selection } = state;
    const { $from } = selection;

    let tablePos = null;
    let tableNode = null;
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type.name === 'table') {
        tablePos = $from.before(d);
        tableNode = $from.node(d);
        break;
      }
    }

    if (tablePos === null || !tableNode) return;

    const tr = state.tr;
    const newRows = [];
    tableNode.forEach((rowNode, index) => {
      if (index === rowIndex) {
        const cells = [];
        rowNode.forEach((cellNode) => {
          const newCell = cellNode.type.create({
            ...cellNode.attrs,
            background: color
          }, cellNode.content);
          cells.push(newCell);
        });
        const newRow = rowNode.type.create(rowNode.attrs, cells);
        newRows.push(newRow);
      } else {
        newRows.push(rowNode);
      }
    });

    const newTable = tableNode.type.create(tableNode.attrs, newRows);
    tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);
    editor.view.dispatch(tr);
  };

  // Close context menu on outside click or right-click
  useEffect(() => {
    const closeMenu = () => {
      setShowContextMenu(false);
    };
    window.addEventListener('click', closeMenu);
    window.addEventListener('contextmenu', closeMenu);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('contextmenu', closeMenu);
    };
  }, []);

  const checkSuggestions = (editor) => {
    const { state, view } = editor;
    const { selection } = state;
    const { $from, empty } = selection;

    if (!empty) {
      setShowSlashMenu(false);
      setShowHashMenu(false);
      setShowEmojiMenu(false);
      return;
    }

    const textBeforeCursor = $from.parent.textContent.slice(0, $from.parentOffset);

    let coords;
    try {
      coords = view.coordsAtPos($from.pos);
    } catch (e) {
      coords = { top: 0, left: 0 };
    }

    const wrapper = view.dom.closest('.rich-text-editor-container');
    if (!wrapper) return;
    const wrapperRect = wrapper.getBoundingClientRect();

    const menuPos = {
      top: coords.bottom - wrapperRect.top + wrapper.scrollTop + 4,
      left: coords.left - wrapperRect.left + wrapper.scrollLeft
    };

    // Slash command detector
    const slashIndex = textBeforeCursor.lastIndexOf('/');
    if (slashIndex !== -1) {
      const charBeforeSlash = slashIndex > 0 ? textBeforeCursor[slashIndex - 1] : ' ';
      if (charBeforeSlash === ' ' || charBeforeSlash === '\n') {
        const query = textBeforeCursor.slice(slashIndex + 1);
        if (!query.includes(' ')) {
          setSlashQuery(query);
          setMenuPosition(menuPos);
          setShowSlashMenu(true);
          setShowHashMenu(false);
          setShowEmojiMenu(false);
          return;
        }
      }
    }
    setShowSlashMenu(false);

    // Hash detector
    const hashIndex = textBeforeCursor.lastIndexOf('#');
    if (hashIndex !== -1) {
      const charBeforeHash = hashIndex > 0 ? textBeforeCursor[hashIndex - 1] : ' ';
      if (charBeforeHash === ' ' || charBeforeHash === '\n') {
        const query = textBeforeCursor.slice(hashIndex + 1);
        if (!query.includes(' ')) {
          setHashQuery(query);
          setHashMenuPosition(menuPos);
          setShowHashMenu(true);
          setShowEmojiMenu(false);
          return;
        }
      }
    }
    setShowHashMenu(false);

    // Emoji detector
    const colonIndex = textBeforeCursor.lastIndexOf(':');
    if (colonIndex !== -1) {
      const charBeforeColon = colonIndex > 0 ? textBeforeCursor[colonIndex - 1] : ' ';
      if (charBeforeColon === ' ' || charBeforeColon === '\n') {
        const query = textBeforeCursor.slice(colonIndex + 1);
        if (!query.includes(' ') && query.length > 0) {
          setEmojiQuery(query);
          setEmojiMenuPosition(menuPos);
          setShowEmojiMenu(true);
          return;
        }
      }
    }
    setShowEmojiMenu(false);
  };



  const checkEmptyLinePlusButton = (editor) => {
    const { state, view } = editor;
    const { selection } = state;
    const { $from, empty } = selection;

    if (!empty) {
      setShowPlusButton(false);
      return;
    }

    const isParagraph = $from.parent.type.name === 'paragraph';
    const isEmpty = $from.parent.content.size === 0;

    if (isParagraph && isEmpty) {
      let coords;
      try {
        coords = view.coordsAtPos($from.pos);
      } catch (e) {
        coords = { top: 0, left: 0 };
      }

      const wrapper = view.dom.closest('.rich-text-editor-container');
      if (wrapper) {
        const wrapperRect = wrapper.getBoundingClientRect();
        setPlusButtonPosition({
          top: coords.top - wrapperRect.top + wrapper.scrollTop + 2,
        });
        setShowPlusButton(true);
      }
    } else {
      setShowPlusButton(false);
    }
  };

  const handlePlusButtonClick = () => {
    if (!editor) return;
    editor.chain().focus().insertContent('/').run();
  };

  // Initialize Tiptap Editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      CustomCodeBlock.configure({
        lowlight,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
      }),
      TableKit.configure({
        table: {
          resizable: true,
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') {
            return 'Título';
          }
          return placeholder || "Escribe '/' para comandos...";
        }
      }),
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      DetailsNode,
      SummaryNode,
      ImageNode,
    ],
    content: value || '',
    editorProps: {
      handleClick(view, pos, event) {
        console.log('editorProps.handleClick target:', event.target.tagName);
        const summary = event.target.closest('summary');
        if (summary) {
          const rect = summary.getBoundingClientRect();
          const isArrowClick = (event.clientX - rect.left) < 28;
          console.log('editorProps.handleClick isArrowClick:', isArrowClick, 'clientX:', event.clientX, 'rectLeft:', rect.left);
          if (isArrowClick) {
            const details = summary.parentNode;
            if (details && details.tagName.toLowerCase() === 'details') {
              try {
                const innerPos = view.posAtDOM(details, 0);
                if (innerPos !== null) {
                  const $pos = view.state.doc.resolve(innerPos);
                  let detailsPos = null;
                  let detailsNode = null;
                  
                  for (let d = $pos.depth; d >= 0; d--) {
                    const parentNode = $pos.node(d);
                    if (parentNode && parentNode.type.name === 'details') {
                      detailsPos = $pos.before(d);
                      detailsNode = parentNode;
                      break;
                    }
                  }

                  console.log('editorProps.handleClick resolved detailsPos:', detailsPos, 'node name:', detailsNode ? detailsNode.type.name : 'null');
                  
                  if (detailsPos !== null && detailsNode) {
                    const newOpen = !detailsNode.attrs.open;
                    view.dispatch(
                      view.state.tr.setNodeMarkup(detailsPos, null, {
                        ...detailsNode.attrs,
                        open: newOpen
                      })
                    );
                    view.focus();
                  }
                }
              } catch (err) {
                console.error('Failed to sync details state:', err);
              }
              event.preventDefault();
              event.stopPropagation();
              return true; // stop Prosemirror handling
            }
          }
        }
        return false;
      }
    },
    onUpdate({ editor }) {
      const html = editor.getHTML();
      console.log('onUpdate html:', html);
      if (onChangeRef.current) {
        onChangeRef.current(html);
      }

      const { state } = editor;
      const { selection } = state;
      const { $from } = selection;
      const textBeforeCursor = $from.parent.textContent.slice(0, $from.parentOffset);

      // custom rule for details section '>>> '
      if (textBeforeCursor.endsWith('>>> ')) {
        const start = $from.pos - 4;
        editor.chain().focus()
          .deleteRange({ from: start, to: $from.pos })
          .insertContent('<details><summary>Sección colapsable (haz clic para expandir)</summary><p>Escribe aquí el contenido oculto...</p></details>')
          .run();
      }

      // custom rule for divider '--- ' / '*** '
      if (textBeforeCursor.endsWith('--- ') || textBeforeCursor.endsWith('*** ')) {
        const start = $from.pos - 4;
        editor.chain().focus()
          .deleteRange({ from: start, to: $from.pos })
          .setHorizontalRule()
          .run();
      }

      // custom rule for blockquote '"" '
      if (textBeforeCursor.endsWith('"" ')) {
        const start = $from.pos - 3;
        editor.chain().focus()
          .deleteRange({ from: start, to: $from.pos })
          .toggleBlockquote()
          .run();
      }

      // autocompletion of emoji
      const match = /:([a-z0-9_]+):$/.exec(textBeforeCursor);
      if (match) {
        const emojiKey = match[1];
        const emojiFound = emojiList.find(e => e.key === emojiKey);
        if (emojiFound) {
          const start = $from.pos - (emojiKey.length + 2);
          editor.chain().focus()
            .deleteRange({ from: start, to: $from.pos })
            .insertContent(emojiFound.char + ' ')
            .run();
        }
      }

      checkSuggestions(editor);
      checkEmptyLinePlusButton(editor);
    },
    onSelectionUpdate({ editor }) {
      checkSuggestions(editor);
      checkEmptyLinePlusButton(editor);
      setShowColorPicker(false);
      setShowHighlightPicker(false);
    },

  });

  // Sync value changes from parent without losing cursor position
  useEffect(() => {
    if (editor && value !== undefined) {
      const currentHtml = editor.getHTML();
      if (value !== currentHtml) {
        editor.commands.setContent(value || '');
      }
    }
  }, [value, editor]);

  useEffect(() => {
    if (!editor) return;
    const viewDom = editor.view.dom;

    const checkCell = () => {
      const cell = getSelectedCellElement();
      setActiveCellElement(cell);
    };

    editor.on('selectionUpdate', checkCell);
    editor.on('update', checkCell);
    editor.on('focus', checkCell);

    const handleNativeContextMenu = (e) => {
      const wrapper = viewDom.closest('.rich-text-editor-container');
      if (!wrapper) return;

      const clickedCell = e.target.closest('td, th');
      if (clickedCell) {
        selectCell(clickedCell);
      }

      e.preventDefault();
      e.stopPropagation();

      const container = wrapper.getBoundingClientRect();
      let x = e.clientX - container.left;
      let y = e.clientY - container.top;

      const menuWidth = 190;
      const menuHeight = 220;

      if (x + menuWidth > container.width) {
        x = container.width - menuWidth - 8;
      }
      if (y + menuHeight > container.height) {
        y = container.height - menuHeight - 8;
      }
      if (x < 0) x = 8;
      if (y < 0) y = 8;

      setContextMenuPosition({ x, y });
      setShowContextMenu(true);
    };

    const handlePaste = (e) => {
      const clipboardData = e.clipboardData || window.clipboardData;
      const pastedText = clipboardData.getData('text/plain');
      if (!pastedText) return;
      
      const isMd = (
        /^\s*(#|\*|-|>|\d+\.)\s/m.test(pastedText) || 
        /\*\*|~~|`|\[.*?\]\(.*?\)/.test(pastedText) ||
        pastedText.includes('```') ||
        pastedText.includes('>>>') ||
        /\|.*\|/.test(pastedText)
      );

      if (isMd) {
        e.preventDefault();
        const html = markdownToHtml(pastedText);
        editor.chain().focus().insertContent(html).run();
      }
    };

    const handleCopy = (e) => {
      const { selection } = editor.state;
      if (selection.empty) return;

      e.preventDefault();
      const nativeSelection = window.getSelection();
      if (nativeSelection && nativeSelection.rangeCount > 0) {
        const nativeRange = nativeSelection.getRangeAt(0);
        const container = document.createElement('div');
        container.appendChild(nativeRange.cloneContents());
        const html = container.innerHTML;
        const markdown = htmlToMarkdown(html);
        
        e.clipboardData.setData('text/plain', markdown);
        e.clipboardData.setData('text/html', html);
      }
    };

    const handleOutsideClick = () => {
      setShowColMenu(false);
      setShowRowMenu(false);
    };

    viewDom.addEventListener('contextmenu', handleNativeContextMenu);
    viewDom.addEventListener('paste', handlePaste, true);
    viewDom.addEventListener('copy', handleCopy);
    window.addEventListener('click', handleOutsideClick);

    return () => {
      editor.off('selectionUpdate', checkCell);
      editor.off('update', checkCell);
      editor.off('focus', checkCell);
      window.removeEventListener('click', handleOutsideClick);
      viewDom.removeEventListener('contextmenu', handleNativeContextMenu);
      viewDom.removeEventListener('paste', handlePaste, true);
      viewDom.removeEventListener('copy', handleCopy);
    };
  }, [editor]);
  const selectHashOption = (taskItem) => {
    if (!editor) return;
    const { state } = editor;
    const { selection } = state;
    const { $from } = selection;
    const textBeforeCursor = $from.parent.textContent.slice(0, $from.parentOffset);
    const hashIndex = textBeforeCursor.lastIndexOf('#');

    if (hashIndex !== -1) {
      const start = $from.pos - (textBeforeCursor.length - hashIndex);
      editor.chain().focus()
        .deleteRange({ from: start, to: $from.pos })
        .insertContent(`<a href="/tasks/${taskItem.id}">#${taskItem.id}: ${taskItem.title}</a> `)
        .run();
    }

    setShowHashMenu(false);
    setHashSelectedIndex(0);
  };

  const selectEmojiOption = (emojiItem) => {
    if (!editor) return;
    const { state } = editor;
    const { selection } = state;
    const { $from } = selection;
    const textBeforeCursor = $from.parent.textContent.slice(0, $from.parentOffset);
    const colonIndex = textBeforeCursor.lastIndexOf(':');

    if (colonIndex !== -1) {
      const start = $from.pos - (textBeforeCursor.length - colonIndex);
      editor.chain().focus()
        .deleteRange({ from: start, to: $from.pos })
        .insertContent(emojiItem.char + ' ')
        .run();
    }

    setShowEmojiMenu(false);
    setEmojiSelectedIndex(0);
  };

  const selectOption = (option) => {
    if (!editor) return;
    const { state } = editor;
    const { selection } = state;
    const { $from } = selection;
    const textBeforeCursor = $from.parent.textContent.slice(0, $from.parentOffset);
    const slashIndex = textBeforeCursor.lastIndexOf('/');

    if (slashIndex !== -1) {
      const start = $from.pos - (textBeforeCursor.length - slashIndex);
      editor.chain().focus().deleteRange({ from: start, to: $from.pos }).run();
    }

    if (option.type === 'format') {
      if (option.format === 'paragraph') {
        editor.chain().focus().setParagraph().run();
      } else if (option.format === 'header') {
        editor.chain().focus().toggleHeading({ level: option.value }).run();
      } else if (option.format === 'list') {
        if (option.value === 'bullet') {
          editor.chain().focus().toggleBulletList().run();
        } else if (option.value === 'ordered') {
          editor.chain().focus().toggleOrderedList().run();
        } else if (option.value === 'taskList') {
          editor.chain().focus().toggleTaskList().run();
        }
      } else if (option.format === 'code-block') {
        editor.chain().focus().toggleCodeBlock().run();
      } else if (option.format === 'blockquote') {
        editor.chain().focus().toggleBlockquote().run();
      }
    } else if (option.type === 'action') {
      if (option.action === 'divider') {
        editor.chain().focus().setHorizontalRule().run();
      } else if (option.action === 'collapsible') {
        editor.chain().focus().insertContent('<details><summary>Sección colapsable (haz clic para expandir)</summary><p>Escribe aquí el contenido oculto...</p></details>').run();
      } else if (option.action === 'table') {
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      } else if (option.action === 'image') {
        triggerImageUpload();
      } else if (option.action === 'clean') {
        editor.chain().focus().unsetAllMarks().clearNodes().run();
      }
    }

    setShowSlashMenu(false);
    setSelectedIndex(0);
  };

  const handleKeyDown = (e) => {
    if (showContextMenu) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowContextMenu(false);
        return;
      }
    }

    if (showSlashMenu && filteredOptions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredOptions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        selectOption(filteredOptions[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowSlashMenu(false);
      }
      return;
    }

    if (showHashMenu && filteredTasks.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHashSelectedIndex((prev) => (prev + 1) % filteredTasks.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHashSelectedIndex((prev) => (prev - 1 + filteredTasks.length) % filteredTasks.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        selectHashOption(filteredTasks[hashSelectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowHashMenu(false);
      }
      return;
    }

    if (showEmojiMenu && filteredEmojis.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setEmojiSelectedIndex((prev) => (prev + 1) % filteredEmojis.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setEmojiSelectedIndex((prev) => (prev - 1 + filteredEmojis.length) % filteredEmojis.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        selectEmojiOption(filteredEmojis[emojiSelectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowEmojiMenu(false);
      }
      return;
    }
  };

  const convertSelectionToSubtask = () => {
    if (!editor) return;
    const { selection } = editor.state;
    const text = editor.state.doc.textBetween(selection.from, selection.to, ' ').trim();
    if (text.length > 0) {
      editor.chain().focus().deleteRange({ from: selection.from, to: selection.to }).run();
      if (onCreateSubtaskRef.current) {
        onCreateSubtaskRef.current(text);
      }
    }
  };

  // Helper to render categorized commands in slash menu
  const renderSlashCommandsList = () => {
    let currentCategory = '';
    return filteredOptions.map((opt, idx) => {
      const showHeader = opt.category !== currentCategory;
      currentCategory = opt.category;
      
      return (
        <div key={opt.key}>
          {showHeader && <div className="slash-menu-category-header">{opt.category}</div>}
          <div
            className={`slash-command-item ${idx === selectedIndex ? 'active' : ''}`}
            onClick={() => selectOption(opt)}
          >
            <div className="slash-command-icon">
              {opt.key === 'paragraph' && <span style={{ fontSize: '0.9rem', color: '#3b82f6', fontWeight: 'bold' }}>¶</span>}
              {opt.key === 'h1' && <span style={{ fontWeight: 800, fontSize: '0.8rem', color: '#ef4444' }}>H1</span>}
              {opt.key === 'h2' && <span style={{ fontWeight: 800, fontSize: '0.7rem', color: '#f97316' }}>H2</span>}
              {opt.key === 'h3' && <span style={{ fontWeight: 800, fontSize: '0.6rem', color: '#eab308' }}>H3</span>}
              {opt.key === 'taskList' && <span style={{ color: '#22c55e', fontWeight: 'bold' }}>☑</span>}
              {opt.key === 'bullet' && <span style={{ fontSize: '1.2rem', color: '#a855f7', fontWeight: 'bold' }}>•</span>}
              {opt.key === 'ordered' && <span style={{ color: '#ec4899', fontSize: '0.8rem', fontWeight: 'bold' }}>1.</span>}
              {opt.key === 'code' && <span style={{ fontSize: '0.75rem', color: '#3b82f6' }}>&lt;/&gt;</span>}
              {opt.key === 'callout' && <span style={{ color: '#eab308' }}>💡</span>}
              {opt.key === 'collapsible' && <span style={{ color: '#f97316' }}>▼</span>}
              {opt.key === 'table' && <span style={{ color: '#a855f7' }}>田</span>}
              {opt.key === 'image' && <span style={{ color: '#3b82f6' }}>🖼️</span>}
              {opt.key === 'divider' && <span style={{ color: '#8e95a5' }}>—</span>}
              {opt.key === 'clean' && <span style={{ color: '#ef4444' }}>✕</span>}
            </div>
            <div className="slash-command-text">
              <span className="slash-command-label">{opt.label}</span>
              <span className="slash-command-desc">{opt.desc}</span>
            </div>
          </div>
        </div>
      );
    });
  };
  let colHandleStyle = null;
  let rowHandleStyle = null;
  let wrapper = null;
  let table = null;

  if (editor && activeCellElement) {
    wrapper = editor.view.dom.closest('.rich-text-editor-container');
    table = activeCellElement.closest('table');
    if (wrapper && table) {
      const cellRect = activeCellElement.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();

      colHandleStyle = {
        position: 'absolute',
        left: cellRect.left - wrapperRect.left + wrapper.scrollLeft,
        top: tableRect.top - wrapperRect.top + wrapper.scrollTop - 18,
        width: cellRect.width,
        height: 14,
        zIndex: 50,
      };

      rowHandleStyle = {
        position: 'absolute',
        left: tableRect.left - wrapperRect.left + wrapper.scrollLeft - 18,
        top: cellRect.top - wrapperRect.top + wrapper.scrollTop,
        width: 14,
        height: cellRect.height,
        zIndex: 50,
      };
    }
  }

  return (
    <div 
      className="rich-text-editor-container bubble-theme"
      onKeyDownCapture={handleKeyDown}
      style={{ position: 'relative' }}
    >
      {/* Empty Line Plus Button on Left Margin */}
      {showPlusButton && (
        <button
          type="button"
          className="editor-empty-line-plus-btn"
          style={{
            position: 'absolute',
            top: plusButtonPosition.top,
            left: '-28px',
            zIndex: 10
          }}
          onClick={handlePlusButtonClick}
          title="Insertar elemento"
        >
          +
        </button>
      )}

      <EditorContent editor={editor} className="quill-editor-wrapper" />

      {editor && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
          <div className="table-bubble-toolbar" style={{ flexWrap: 'wrap', gap: '2px', padding: '4px' }}>
            <button
              type="button"
              className={`table-bubble-btn ${editor.isActive('bold') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleBold().run()}
              title="Negrita"
            >
              <span>N</span>
            </button>
            <button
              type="button"
              className={`table-bubble-btn ${editor.isActive('italic') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              title="Cursiva"
            >
              <span>C</span>
            </button>
            <button
              type="button"
              className={`table-bubble-btn ${editor.isActive('underline') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              title="Subrayado"
            >
              <span>S</span>
            </button>
            <button
              type="button"
              className={`table-bubble-btn ${editor.isActive('strike') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleStrike().run()}
              title="Tachado"
            >
              <span>T</span>
            </button>
            <button
              type="button"
              className={`table-bubble-btn ${editor.isActive('code') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleCode().run()}
              title="Código en línea"
            >
              <span>&lt;&gt;</span>
            </button>
            <button
              type="button"
              className={`table-bubble-btn ${editor.isActive('link') ? 'active' : ''}`}
              onClick={() => {
                if (editor.isActive('link')) {
                  editor.chain().focus().unsetLink().run();
                } else {
                  const url = window.prompt('URL:');
                  if (url) {
                    editor.chain().focus().setLink({ href: url }).run();
                  }
                }
              }}
              title="Enlace"
            >
              <span>🔗</span>
            </button>

            {/* Text Color Dropdown */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button
                type="button"
                className={`table-bubble-btn ${showColorPicker ? 'active' : ''}`}
                onClick={() => {
                  setShowColorPicker(!showColorPicker);
                  setShowHighlightPicker(false);
                }}
                title="Color de texto"
              >
                <span style={{ borderBottom: '2px solid', paddingBottom: '1px' }}>A</span>
              </button>
              {showColorPicker && (
                <div className="editor-color-dropdown">
                  <div className="editor-color-dropdown-title">Color de texto</div>
                  {textColors.map(c => (
                    <button
                      key={c.name}
                      type="button"
                      className="editor-color-dropdown-item"
                      onClick={() => {
                        if (c.value) {
                          editor.chain().focus().setColor(c.value).run();
                        } else {
                          editor.chain().focus().unsetColor().run();
                        }
                        setShowColorPicker(false);
                      }}
                    >
                      <div className="color-circle" style={{ backgroundColor: c.color }} />
                      <span>{c.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Text Highlight Dropdown */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button
                type="button"
                className={`table-bubble-btn ${showHighlightPicker ? 'active' : ''}`}
                onClick={() => {
                  setShowHighlightPicker(!showHighlightPicker);
                  setShowColorPicker(false);
                }}
                title="Resaltado de texto"
              >
                <span>🖋️</span>
              </button>
              {showHighlightPicker && (
                <div className="editor-color-dropdown">
                  <div className="editor-color-dropdown-title">Resaltado</div>
                  {highlightColors.map(c => (
                    <button
                      key={c.name}
                      type="button"
                      className="editor-color-dropdown-item"
                      onClick={() => {
                        if (c.value) {
                          editor.chain().focus().setHighlight({ color: c.value }).run();
                        } else {
                          editor.chain().focus().unsetHighlight().run();
                        }
                        setShowHighlightPicker(false);
                      }}
                    >
                      <div className="color-circle" style={{ backgroundColor: c.color, border: '1px solid rgba(255,255,255,0.1)' }} />
                      <span>{c.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className="table-bubble-btn danger"
              onClick={cleanFormatting}
              title="Limpiar Formato"
            >
              <span>✕</span>
            </button>
            {onCreateSubtask && (
              <>
                <div className="table-bubble-divider" />
                <button
                  type="button"
                  className="table-bubble-btn"
                  onClick={convertSelectionToSubtask}
                  style={{
                    backgroundColor: 'var(--accent-hover)',
                    color: 'white',
                    fontWeight: 'bold',
                    paddingLeft: '8px',
                    paddingRight: '8px',
                    borderRadius: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Convertir selección en subtarea"
                >
                  <span>✨ Convertir en subtarea</span>
                </button>
              </>
            )}
          </div>
        </BubbleMenu>
      )}



      {showContextMenu && (
        <div 
          className={`calendar-context-menu editor-context-menu ${
            editor && 
            contextMenuPosition.x > (editor.view.dom.getBoundingClientRect().width / 2) 
              ? 'align-left' 
              : ''
          }`}
          style={{
            position: 'absolute',
            top: contextMenuPosition.y,
            left: contextMenuPosition.x,
            zIndex: 10010
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {getIsCursorInTable() && (
            <div className="context-menu-submenu-header">
              <span>📊 Tabla</span>
              <div className="context-menu-submenu">
                <div className="context-menu-item" onClick={() => handleTableAction('insertRowAbove')}>
                  <span>Insertar fila arriba</span>
                </div>
                <div className="context-menu-item" onClick={() => handleTableAction('insertRowBelow')}>
                  <span>Insertar fila abajo</span>
                </div>
                <div className="context-menu-item" onClick={() => handleTableAction('insertColumnLeft')}>
                  <span>Insertar columna izquierda</span>
                </div>
                <div className="context-menu-item" onClick={() => handleTableAction('insertColumnRight')}>
                  <span>Insertar columna derecha</span>
                </div>
                <div className="context-menu-divider" />
                <div className="context-menu-item" onClick={() => handleTableAction('deleteRow')}>
                  <span>Eliminar fila</span>
                </div>
                <div className="context-menu-item" onClick={() => handleTableAction('deleteColumn')}>
                  <span>Eliminar columna</span>
                </div>
                <div className="context-menu-item danger" onClick={() => handleTableAction('deleteTable')}>
                  <span>Eliminar tabla</span>
                </div>
              </div>
            </div>
          )}

          <div className="context-menu-submenu-header">
            <span>✍️ Formato</span>
            <div className="context-menu-submenu">
              <div className="context-menu-item" onClick={() => toggleFormat('bold')}>
                <span>Negrita</span>
                <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>Ctrl+B</span>
              </div>
              <div className="context-menu-item" onClick={() => toggleFormat('italic')}>
                <span>Cursiva</span>
                <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>Ctrl+I</span>
              </div>
              <div className="context-menu-item" onClick={() => toggleFormat('underline')}>
                <span>Subrayado</span>
                <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>Ctrl+U</span>
              </div>
              <div className="context-menu-item" onClick={() => toggleFormat('strike')}>
                <span>Tachado</span>
                <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>Ctrl+Shift+S</span>
              </div>
            </div>
          </div>

          <div className="context-menu-submenu-header">
            <span>➕ Insertar</span>
            <div className="context-menu-submenu">
              <div className="context-menu-item" onClick={insertCollapsible}>
                <span>Sección colapsable</span>
                <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>&gt;&gt;&gt;</span>
              </div>
              <div className="context-menu-item" onClick={toggleBlockquote}>
                <span>Caja destacada</span>
                <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>&gt;</span>
              </div>
              <div className="context-menu-item" onClick={toggleCodeBlock}>
                <span>Bloque de código</span>
                <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>```</span>
              </div>
              <div className="context-menu-item" onClick={insertTable}>
                <span>Tabla</span>
                <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>/tabla</span>
              </div>
              <div className="context-menu-item" onClick={insertDivider}>
                <span>Línea divisora</span>
                <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>—</span>
              </div>
            </div>
          </div>

          <div className="context-menu-submenu-header">
            <span>📋 Markdown</span>
            <div className="context-menu-submenu">
              <div 
                className={`context-menu-item ${
                  editor?.state.selection.empty ? 'disabled' : ''
                }`}
                onClick={copySelectionAsMarkdown}
                style={
                  editor?.state.selection.empty 
                    ? { opacity: 0.4, cursor: 'not-allowed' } 
                    : {}
                }
              >
                <span>Copiar como MD</span>
              </div>
              <div className="context-menu-item" onClick={pasteMarkdownFromClipboard}>
                <span>Pegar desde MD</span>
              </div>
            </div>
          </div>

          <div className="context-menu-divider" />

          <div className="context-menu-item" onClick={() => triggerMention('#')}>
            <span>🔗 Referenciar Tarea</span>
            <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>#</span>
          </div>
          <div className="context-menu-item" onClick={() => triggerMention(':')}>
            <span>😊 Insertar Emoji</span>
            <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>:</span>
          </div>

          <div className="context-menu-divider" />

          <div className="context-menu-item" onClick={cleanFormatting}>
            <span>✕ Limpiar formato</span>
          </div>
        </div>
      )}

      {showSlashMenu && filteredOptions.length > 0 && (
        <div 
          className="slash-commands-menu"
          style={{
            position: 'absolute',
            top: menuPosition.top,
            left: menuPosition.left,
            zIndex: 10000
          }}
        >
          {renderSlashCommandsList()}
        </div>
      )}

      {showHashMenu && filteredTasks.length > 0 && (
        <div 
          className="slash-commands-menu"
          style={{
            position: 'absolute',
            top: hashMenuPosition.top,
            left: hashMenuPosition.left,
            zIndex: 10000
          }}
        >
          {filteredTasks.map((t, idx) => (
            <div
              key={t.id}
              className={`slash-command-item ${idx === hashSelectedIndex ? 'active' : ''}`}
              onClick={() => selectHashOption(t)}
            >
              <div className="slash-command-icon" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                #{t.id}
              </div>
              <div className="slash-command-text">
                <span className="slash-command-label" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                  {t.title}
                </span>
                <span className="slash-command-desc">Referenciar tarea</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showEmojiMenu && filteredEmojis.length > 0 && (
        <div 
          className="slash-commands-menu"
          style={{
            position: 'absolute',
            top: emojiMenuPosition.top,
            left: emojiMenuPosition.left,
            zIndex: 10000
          }}
        >
          {filteredEmojis.map((e, idx) => (
            <div
              key={e.key}
              className={`slash-command-item ${idx === emojiSelectedIndex ? 'active' : ''}`}
              onClick={() => selectEmojiOption(e)}
            >
              <div className="slash-command-icon" style={{ fontSize: '1rem' }}>
                {e.char}
              </div>
              <div className="slash-command-text">
                <span className="slash-command-label">:{e.key}:</span>
                <span className="slash-command-desc">{e.desc}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Column Handle Widget */}
      {colHandleStyle && (
        <div
          className="table-handle-btn col-handle-btn"
          style={{
            ...colHandleStyle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--accent-hover, #7c3aed)',
            color: '#ffffff',
            borderRadius: '4px 4px 0 0',
            cursor: 'pointer',
            fontSize: '11px',
            lineHeight: '1',
            boxShadow: '0 -2px 6px rgba(124, 58, 237, 0.25)',
            userSelect: 'none',
            letterSpacing: '1px'
          }}
          onClick={(e) => {
            e.stopPropagation();
            setShowColMenu(prev => !prev);
            setShowRowMenu(false);
          }}
          title="Opciones de columna"
        >
          •••
        </div>
      )}

      {/* Row Handle Widget */}
      {rowHandleStyle && (
        <div
          className="table-handle-btn row-handle-btn"
          style={{
            ...rowHandleStyle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--accent-hover, #7c3aed)',
            color: '#ffffff',
            borderRadius: '4px 0 0 4px',
            cursor: 'pointer',
            fontSize: '11px',
            lineHeight: '1',
            boxShadow: '-2px 0 6px rgba(124, 58, 237, 0.25)',
            userSelect: 'none',
            writingMode: 'vertical-lr',
            letterSpacing: '1px'
          }}
          onClick={(e) => {
            e.stopPropagation();
            setShowRowMenu(prev => !prev);
            setShowColMenu(false);
          }}
          title="Opciones de fila"
        >
          •••
        </div>
      )}

      {/* Column Dropdown Menu */}
      {showColMenu && colHandleStyle && (
        <div
          className="editor-context-menu table-handle-menu-dropdown"
          style={{
            position: 'absolute',
            top: colHandleStyle.top + colHandleStyle.height + 4,
            left: Math.max(8, colHandleStyle.left),
            zIndex: 10010,
            minWidth: '180px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="context-menu-item" onClick={() => { handleMoveColumn('left'); setShowColMenu(false); }}>
            <span>← Move column left</span>
          </div>
          <div className="context-menu-item" onClick={() => { handleMoveColumn('right'); setShowColMenu(false); }}>
            <span>→ Move column right</span>
          </div>
          <div className="context-menu-divider" />
          <div className="context-menu-item" onClick={() => { editor.chain().focus().addColumnBefore().run(); setShowColMenu(false); }}>
            <span>+|| Insert column left</span>
          </div>
          <div className="context-menu-item" onClick={() => { editor.chain().focus().addColumnAfter().run(); setShowColMenu(false); }}>
            <span>||+ Insert column right</span>
          </div>
          <div className="context-menu-divider" />
          <div className="context-menu-submenu-header">
            <span>🎨 Color</span>
            <div className="context-menu-submenu" style={{ minWidth: '120px' }}>
              {[
                { name: 'Predeterminado', color: 'transparent' },
                { name: 'Rojo', color: 'rgba(239, 68, 68, 0.15)' },
                { name: 'Naranja', color: 'rgba(249, 115, 22, 0.15)' },
                { name: 'Amarillo', color: 'rgba(234, 179, 8, 0.15)' },
                { name: 'Verde', color: 'rgba(34, 197, 94, 0.15)' },
                { name: 'Azul', color: 'rgba(59, 130, 246, 0.15)' },
                { name: 'Violeta', color: 'rgba(168, 85, 247, 0.15)' },
                { name: 'Gris', color: 'rgba(156, 163, 175, 0.15)' }
              ].map(c => (
                <div
                  key={c.name}
                  className="context-menu-item"
                  onClick={() => { handleSetColumnColor(c.color); setShowColMenu(false); }}
                >
                  <div className="color-circle" style={{ backgroundColor: c.color === 'transparent' ? 'rgba(255,255,255,0.1)' : c.color, border: '1px solid rgba(255,255,255,0.1)' }} />
                  <span>{c.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="context-menu-divider" />
          <div className="context-menu-item danger" onClick={() => { editor.chain().focus().deleteColumn().run(); setShowColMenu(false); }}>
            <span>🗑️ Delete column</span>
          </div>
        </div>
      )}

      {/* Row Dropdown Menu */}
      {showRowMenu && rowHandleStyle && (
        <div
          className="editor-context-menu table-handle-menu-dropdown"
          style={{
            position: 'absolute',
            top: rowHandleStyle.top,
            left: rowHandleStyle.left + rowHandleStyle.width + 4,
            zIndex: 10010,
            minWidth: '180px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="context-menu-item" onClick={() => { handleMoveRow('up'); setShowRowMenu(false); }}>
            <span>↑ Move row up</span>
          </div>
          <div className="context-menu-item" onClick={() => { handleMoveRow('down'); setShowRowMenu(false); }}>
            <span>↓ Move row down</span>
          </div>
          <div className="context-menu-divider" />
          <div className="context-menu-item" onClick={() => { editor.chain().focus().addRowBefore().run(); setShowRowMenu(false); }}>
            <span>+ Insert row above</span>
          </div>
          <div className="context-menu-item" onClick={() => { editor.chain().focus().addRowAfter().run(); setShowRowMenu(false); }}>
            <span>+ Insert row below</span>
          </div>
          <div className="context-menu-divider" />
          <div className="context-menu-submenu-header">
            <span>🎨 Color</span>
            <div className="context-menu-submenu" style={{ minWidth: '120px' }}>
              {[
                { name: 'Predeterminado', color: 'transparent' },
                { name: 'Rojo', color: 'rgba(239, 68, 68, 0.15)' },
                { name: 'Naranja', color: 'rgba(249, 115, 22, 0.15)' },
                { name: 'Amarillo', color: 'rgba(234, 179, 8, 0.15)' },
                { name: 'Verde', color: 'rgba(34, 197, 94, 0.15)' },
                { name: 'Azul', color: 'rgba(59, 130, 246, 0.15)' },
                { name: 'Violeta', color: 'rgba(168, 85, 247, 0.15)' },
                { name: 'Gris', color: 'rgba(156, 163, 175, 0.15)' }
              ].map(c => (
                <div
                  key={c.name}
                  className="context-menu-item"
                  onClick={() => { handleSetRowColor(c.color); setShowRowMenu(false); }}
                >
                  <div className="color-circle" style={{ backgroundColor: c.color === 'transparent' ? 'rgba(255,255,255,0.1)' : c.color, border: '1px solid rgba(255,255,255,0.1)' }} />
                  <span>{c.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="context-menu-divider" />
          <div className="context-menu-item danger" onClick={() => { editor.chain().focus().deleteRow().run(); setShowRowMenu(false); }}>
            <span>🗑️ Delete row</span>
          </div>
        </div>
      )}
    </div>
  );
}
export function markdownToHtml(md) {
  const lines = md.split('\n');
  let html = '';
  let inList = false;
  let listType = ''; // 'ul' or 'ol'
  let inCodeBlock = false;
  let inTable = false;
  let inDetails = false;
  let tableRows = [];

  const flushTable = () => {
    if (tableRows.length > 0) {
      html += renderMarkdownTable(tableRows);
      tableRows = [];
    }
    inTable = false;
  };

  const flushList = () => {
    if (inList) {
      html += listType === 'ul' ? '</ul>' : '</ol>';
      inList = false;
      listType = '';
    }
  };

  const flushDetails = () => {
    if (inDetails) {
      html += '</details>';
      inDetails = false;
    }
  };

  for (let line of lines) {
    // 1. Code Blocks
    if (inCodeBlock) {
      if (line.trim().startsWith('```')) {
        html += '</pre>';
        inCodeBlock = false;
      } else {
        const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html += escaped + '\n';
      }
      continue;
    }

    if (line.trim().startsWith('```')) {
      flushTable();
      flushList();
      flushDetails();
      html += '<pre class="ql-syntax">';
      inCodeBlock = true;
      continue;
    }

    // Check if table row
    const isTableRow = line.trim().startsWith('|') && line.trim().endsWith('|');
    if (isTableRow) {
      flushList();
      flushDetails();
      inTable = true;
      tableRows.push(line.trim());
      continue;
    } else {
      flushTable();
    }

    // 2. Blockquotes / Accordions
    if (line.startsWith('> ')) {
      flushList();
      flushDetails();
      const content = line.slice(2);
      html += `<blockquote>${parseInlineMarkdown(content)}</blockquote>`;
      continue;
    }

    if (line.startsWith('>>> ')) {
      flushList();
      flushDetails();
      const title = line.slice(4).trim();
      html += `<details><summary>${parseInlineMarkdown(title)}</summary>`;
      inDetails = true;
      continue;
    }

    // 3. Headings
    if (line.startsWith('# ')) {
      flushList();
      flushDetails();
      html += `<h1>${parseInlineMarkdown(line.slice(2))}</h1>`;
      continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      flushDetails();
      html += `<h2>${parseInlineMarkdown(line.slice(3))}</h2>`;
      continue;
    }
    if (line.startsWith('### ')) {
      flushList();
      flushDetails();
      html += `<h3>${parseInlineMarkdown(line.slice(4))}</h3>`;
      continue;
    }

    // 4. Unordered Lists
    if (line.startsWith('* ') || line.startsWith('- ')) {
      if (!inList || listType !== 'ul') {
        flushList();
        html += '<ul>';
        inList = true;
        listType = 'ul';
      }
      const taskMatch = /^\[([ xX])\]\s(.*)/.exec(line.slice(2).trim());
      if (taskMatch) {
        const isChecked = taskMatch[1].toLowerCase() === 'x';
        const taskText = taskMatch[2];
        html += `<li data-checked="${isChecked}">${parseInlineMarkdown(taskText)}</li>`;
      } else {
        html += `<li>${parseInlineMarkdown(line.slice(2))}</li>`;
      }
      continue;
    }

    // 5. Ordered Lists
    const olMatch = /^\d+\.\s(.*)/.exec(line);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        flushList();
        html += '<ol>';
        inList = true;
        listType = 'ol';
      }
      html += `<li>${parseInlineMarkdown(olMatch[1])}</li>`;
      continue;
    }

    // Close list if blank line
    if (line.trim() === '') {
      flushList();
      html += '<p><br></p>';
      continue;
    }

    flushList();
    html += `<p>${parseInlineMarkdown(line)}</p>`;
  }

  flushTable();
  flushList();
  flushDetails();
  if (inCodeBlock) {
    html += '</pre>';
  }

  return html;
}

function renderMarkdownTable(rows) {
  if (rows.length === 0) return '';
  
  const parseRow = (rowLine) => {
    let s = rowLine.trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|')) s = s.slice(0, -1);
    return s.split('|').map(cell => cell.trim());
  };

  const headers = parseRow(rows[0]);
  let startIndex = 1;
  
  if (rows.length > 1) {
    const secondRowCells = parseRow(rows[1]);
    const isDivider = secondRowCells.length > 0 && secondRowCells.every(c => /^[:\-\s]+$/.test(c) && c.includes('-'));
    if (isDivider) {
      startIndex = 2;
    }
  }

  let tableHtml = '<table><tbody>';
  
  tableHtml += '<tr>';
  headers.forEach(h => {
    tableHtml += `<th>${parseInlineMarkdown(h)}</th>`;
  });
  tableHtml += '</tr>';

  for (let i = startIndex; i < rows.length; i++) {
    const rowLine = rows[i].trim();
    const rowCellsForCheck = parseRow(rowLine);
    const isDivider = rowCellsForCheck.length > 0 && rowCellsForCheck.every(c => /^[:\-\s]+$/.test(c) && c.includes('-'));
    if (isDivider) continue;

    const cells = parseRow(rowLine);
    tableHtml += '<tr>';
    for (let j = 0; j < headers.length; j++) {
      const val = cells[j] || '';
      tableHtml += `<td>${parseInlineMarkdown(val)}</td>`;
    }
    tableHtml += '</tr>';
  }

  tableHtml += '</tbody></table>';
  return tableHtml;
}

function parseInlineMarkdown(text) {
  let parsed = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>');
  
  parsed = parsed
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>');
  
  parsed = parsed.replace(/~~(.*?)~~/g, '<s>$1</s>');
  parsed = parsed.replace(/`(.*?)`/g, '<code>$1</code>');
  parsed = parsed.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">');
  parsed = parsed.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');

  return parsed;
}

export function htmlToMarkdown(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return nodeToMarkdown(doc.body);
}

function nodeToMarkdown(node) {
  let md = '';
  
  for (let child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      md += child.textContent;
      continue;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) {
      continue;
    }

    const tagName = child.tagName.toLowerCase();

    switch (tagName) {
      case 'h1':
        md += `# ${nodeToMarkdown(child)}\n\n`;
        break;
      case 'h2':
        md += `## ${nodeToMarkdown(child)}\n\n`;
        break;
      case 'h3':
        md += `### ${nodeToMarkdown(child)}\n\n`;
        break;
      case 'p':
        const innerText = nodeToMarkdown(child);
        if (innerText.trim() === '') {
          md += '\n';
        } else {
          const inDetailsContext = !!(child.closest && child.closest('details'));
          md += `${innerText}${inDetailsContext ? '\n' : '\n\n'}`;
        }
        break;
      case 'br':
        md += '\n';
        break;
      case 'strong':
      case 'b':
        md += `**${nodeToMarkdown(child)}**`;
        break;
      case 'em':
      case 'i':
        md += `*${nodeToMarkdown(child)}*`;
        break;
      case 's':
      case 'strike':
      case 'del':
        md += `~~${nodeToMarkdown(child)}~~`;
        break;
      case 'code':
        md += `\`${nodeToMarkdown(child)}\``;
        break;
      case 'img':
        const imgsrc = child.getAttribute('src') || '';
        const imgalt = child.getAttribute('alt') || '';
        md += `![${imgalt}](${imgsrc})\n\n`;
        break;
      case 'table':
        const trs = Array.from(child.querySelectorAll('tr'));
        if (trs.length > 0) {
          let tableMd = '';
          const rowData = trs.map(tr => {
            const cells = Array.from(tr.querySelectorAll('td, th'));
            return cells.map(cell => nodeToMarkdown(cell).trim().replace(/\n/g, ' '));
          });
          
          if (rowData.length > 0) {
            const headers = rowData[0];
            tableMd += `| ${headers.join(' | ')} |\n`;
            
            const dividers = headers.map(() => '---');
            tableMd += `| ${dividers.join(' | ')} |\n`;
            
            for (let i = 1; i < rowData.length; i++) {
              tableMd += `| ${rowData[i].join(' | ')} |\n`;
            }
            tableMd += '\n';
          }
          md += tableMd;
        }
        break;
      case 'tbody':
      case 'thead':
      case 'tr':
      case 'td':
      case 'th':
        break;
      case 'pre':
        md += `\`\`\`\n${child.textContent.replace(/\n$/, '')}\n\`\`\`\n\n`;
        break;
      case 'blockquote':
        const quoteContent = nodeToMarkdown(child).trim();
        const lines = quoteContent.split('\n');
        md += lines.map(line => `> ${line}`).join('\n') + '\n\n';
        break;
      case 'details':
        const summaryNode = child.querySelector('summary');
        const summaryText = summaryNode ? nodeToMarkdown(summaryNode) : 'Sección colapsable';
        const detailsClone = child.cloneNode(true);
        const cloneSummary = detailsClone.querySelector('summary');
        if (cloneSummary) detailsClone.removeChild(cloneSummary);
        const detailsContent = nodeToMarkdown(detailsClone).trim();
        md += `>>> ${summaryText}\n${detailsContent}\n\n`;
        break;
      case 'summary':
        break;
      case 'ul':
        if (child.getAttribute('data-type') === 'taskList') {
          for (let li of child.children) {
            const isChecked = li.getAttribute('data-checked') === 'true';
            md += `${isChecked ? '[x]' : '[ ]'} ${nodeToMarkdown(li).trim()}\n`;
          }
        } else {
          for (let li of child.children) {
            md += `* ${nodeToMarkdown(li)}\n`;
          }
        }
        md += '\n';
        break;
      case 'ol':
        let index = 1;
        for (let li of child.children) {
          md += `${index}. ${nodeToMarkdown(li)}\n`;
          index++;
        }
        md += '\n';
        break;
      case 'li':
        if (child.hasAttribute('data-checked')) {
          const isChecked = child.getAttribute('data-checked') === 'true';
          md += `${isChecked ? '[x]' : '[ ]'} ${nodeToMarkdown(child).trim()}\n`;
        } else {
          md += `* ${nodeToMarkdown(child)}\n`;
        }
        break;
      case 'a':
        const href = child.getAttribute('href') || '';
        md += `[${nodeToMarkdown(child)}](${href})`;
        break;
      default:
        md += nodeToMarkdown(child);
        break;
    }
  }

  return md.replace(/\n{3,}/g, '\n\n');
}
