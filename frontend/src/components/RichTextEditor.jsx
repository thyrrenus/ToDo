import { useRef, useMemo, useState, useEffect } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.bubble.css';

const Block = Quill.import('blots/block');
const Container = Quill.import('blots/container');

class SummaryBlot extends Block {
  static blotName = 'summary';
  static tagName = 'summary';
}
Quill.register(SummaryBlot);

class DetailsBlot extends Container {
  static blotName = 'details';
  static tagName = 'details';
}
DetailsBlot.defaultChild = 'block';
DetailsBlot.allowedChildren = [SummaryBlot, Block];
Quill.register(DetailsBlot);

const slashCommands = [
  { key: 'h1', label: 'Título Grande', desc: 'Encabezado H1', format: 'header', value: 1, type: 'format' },
  { key: 'h2', label: 'Título Mediano', desc: 'Encabezado H2', format: 'header', value: 2, type: 'format' },
  { key: 'bullet', label: 'Lista con viñetas', desc: 'Lista simple', format: 'list', value: 'bullet', type: 'format' },
  { key: 'ordered', label: 'Lista numerada', desc: 'Lista con números', format: 'list', value: 'ordered', type: 'format' },
  { key: 'code', label: 'Bloque de código', desc: 'Texto monosegmentado', format: 'code-block', value: true, type: 'format' },
  { key: 'callout', label: 'Caja destacada', desc: 'Contenedor sutil destacado', format: 'blockquote', value: true, type: 'format' },
  { key: 'collapsible', label: 'Sección colapsable', desc: 'Acordeón de texto ocultable', type: 'action', action: 'collapsible' },
  { key: 'table', label: 'Tabla', desc: 'Insertar tabla de 3x3', type: 'action', action: 'table' },
  { key: 'divider', label: 'Línea divisora', desc: 'Línea horizontal sutil', type: 'action', action: 'divider' },
  { key: 'clean', label: 'Limpiar formato', desc: 'Quita todo el formato', type: 'action', action: 'clean' }
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

export function RichTextEditor({ value, onChange, placeholder, tasks = [], onCreateSubtask }) {
  const containerRef = useRef(null);
  const quillRef = useRef(null);
  
  const [hoveredTable, setHoveredTable] = useState(null);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [colButtonPos, setColButtonPos] = useState({ top: 0, left: 0, visible: false });
  const [rowButtonPos, setRowButtonPos] = useState({ top: 0, left: 0, visible: false });
  const [activeCell, setActiveCell] = useState(null);
  const [tableToolbarPos, setTableToolbarPos] = useState({ top: 0, left: 0, visible: false });
  const tableHoverTimeoutRef = useRef(null);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);

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
    const quill = quillRef.current;
    if (!quill) return;

    try {
      const blot = Quill.find(tdElement);
      if (blot) {
        const index = blot.offset(quill.scroll);
        quill.setSelection(index, 0, 'user');
        quill.focus();
      } else {
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(tdElement);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        quill.focus();
      }
    } catch (e) {
      console.error('Failed to select cell:', e);
    }
  };

  const addColumnAtHover = (tdElement) => {
    if (!tdElement) return;
    const quill = quillRef.current;
    if (!quill) return;
    const tableModule = quill.getModule('table');
    if (!tableModule) return;

    selectCell(tdElement);

    try {
      tableModule.insertColumnRight();
    } catch (err) {
      console.error('Failed to append col:', err);
    }

    setColButtonPos(prev => ({ ...prev, visible: false }));
    setRowButtonPos(prev => ({ ...prev, visible: false }));
  };

  const addRowAtHover = (tdElement) => {
    if (!tdElement) return;
    const quill = quillRef.current;
    if (!quill) return;
    const tableModule = quill.getModule('table');
    if (!tableModule) return;

    selectCell(tdElement);

    try {
      tableModule.insertRowBelow();
    } catch (err) {
      console.error('Failed to append row:', err);
    }

    setColButtonPos(prev => ({ ...prev, visible: false }));
    setRowButtonPos(prev => ({ ...prev, visible: false }));
  };

  const handleButtonMouseEnter = () => {
    if (tableHoverTimeoutRef.current) {
      clearTimeout(tableHoverTimeoutRef.current);
      tableHoverTimeoutRef.current = null;
    }
  };

  const handleButtonMouseLeave = () => {
    tableHoverTimeoutRef.current = setTimeout(() => {
      setColButtonPos(prev => ({ ...prev, visible: false }));
      setRowButtonPos(prev => ({ ...prev, visible: false }));
      setHoveredCell(null);
      setHoveredTable(null);
    }, 300);
  };

  const imageHandler = () => {
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
          if (data.url) {
            const quill = quillRef.current;
            if (quill) {
              const range = quill.getSelection(true);
              quill.insertEmbed(range.index, 'image', data.url);
            }
          }
        } catch (err) {
          console.error('Image upload failed', err);
        }
      }
    };
  };

  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['link', 'image'],
        ['clean']
      ],
      handlers: {
        image: imageHandler
      }
    },
    table: true
  }), []);

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

  const [showHashMenu, setShowHashMenu] = useState(false);
  const [hashQuery, setHashQuery] = useState('');
  const [hashMenuPosition, setHashMenuPosition] = useState({ top: 0, left: 0 });
  const [hashSelectedIndex, setHashSelectedIndex] = useState(0);

  const [showEmojiMenu, setShowEmojiMenu] = useState(false);
  const [emojiQuery, setEmojiQuery] = useState('');
  const [emojiMenuPosition, setEmojiMenuPosition] = useState({ top: 0, left: 0 });
  const [emojiSelectedIndex, setEmojiSelectedIndex] = useState(0);

  const [showSelectionMenu, setShowSelectionMenu] = useState(false);
  const [selectionMenuPosition, setSelectionMenuPosition] = useState({ top: 0, left: 0 });
  const [selectedText, setSelectedText] = useState('');

  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

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

  // Sync index boundary when options filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredOptions]);

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
    setHashSelectedIndex(0);
  }, [filteredTasks]);

  useEffect(() => {
    setEmojiSelectedIndex(0);
  }, [filteredEmojis]);

  const toggleFormat = (formatName) => {
    const quill = quillRef.current;
    if (!quill) return;
    const currentFormats = quill.getFormat();
    const isFormatActive = currentFormats[formatName];
    quill.format(formatName, !isFormatActive);
  };

  const toggleCodeBlock = () => {
    const quill = quillRef.current;
    if (!quill) return;
    const currentFormats = quill.getFormat();
    quill.format('code-block', !currentFormats['code-block']);
  };

  const toggleBlockquote = () => {
    const quill = quillRef.current;
    if (!quill) return;
    const currentFormats = quill.getFormat();
    quill.format('blockquote', !currentFormats['blockquote']);
  };

  const insertCollapsible = () => {
    const quill = quillRef.current;
    if (!quill) return;
    const range = quill.getSelection(true);
    if (range) {
      quill.clipboard.dangerouslyPasteHTML(range.index, '<details><summary>Sección colapsable (haz clic para expandir)</summary><p>Escribe aquí el contenido...</p></details>');
    }
  };

  const insertDivider = () => {
    const quill = quillRef.current;
    if (!quill) return;
    const range = quill.getSelection(true);
    if (range) {
      quill.insertText(range.index, '────────────────────────────────────────\n');
    }
  };

  const insertTable = () => {
    const quill = quillRef.current;
    if (!quill) return;
    const tableModule = quill.getModule('table');
    if (tableModule) {
      tableModule.insertTable(3, 3);
    }
    setShowContextMenu(false);
  };

  const getSelectedCellElement = () => {
    const quill = quillRef.current;
    if (!quill) return null;
    
    try {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        let node = selection.getRangeAt(0).startContainer;
        while (node && node !== quill.root) {
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

  const getEditorContext = () => {
    const quill = quillRef.current;
    if (!quill) return null;

    const range = quill.getSelection();
    if (!range) return null;

    const [line] = quill.getLine(range.index);
    if (!line) return null;

    const lineIndex = quill.getIndex(line);
    const cursorOffset = range.index - lineIndex;
    const lineLength = line.length();
    const lineText = quill.getText(lineIndex, lineLength - 1);
    const textBeforeCursor = lineText.slice(0, cursorOffset);

    return { quill, range, line, lineIndex, cursorOffset, lineLength, lineText, textBeforeCursor };
  };

  const getIsCursorInTable = () => {
    return !!getSelectedCellElement();
  };

  const handleTableAction = (action) => {
    const quill = quillRef.current;
    if (!quill) return;

    const tableModule = quill.getModule('table');
    if (!tableModule) return;

    if (action === 'insertRowAbove') {
      tableModule.insertRowAbove();
    } else if (action === 'insertRowBelow') {
      tableModule.insertRowBelow();
    } else if (action === 'insertColumnLeft') {
      tableModule.insertColumnLeft();
    } else if (action === 'insertColumnRight') {
      tableModule.insertColumnRight();
    } else if (action === 'deleteRow') {
      tableModule.deleteRow();
    } else if (action === 'deleteColumn') {
      tableModule.deleteColumn();
    } else if (action === 'deleteTable') {
      tableModule.deleteTable();
    }

    setShowContextMenu(false);
  };

  const triggerMention = (char) => {
    const quill = quillRef.current;
    if (!quill) return;
    const range = quill.getSelection(true);
    if (range) {
      quill.insertText(range.index, char);
      quill.setSelection(range.index + 1);
      quill.focus();
    }
  };

  const copySelectionAsMarkdown = async () => {
    const quill = quillRef.current;
    if (!quill) return;
    const range = quill.getSelection();
    if (!range || range.length === 0) return;

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
    const quill = quillRef.current;
    if (!quill) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const html = markdownToHtml(text);
        const range = quill.getSelection(true);
        if (range) {
          quill.clipboard.dangerouslyPasteHTML(range.index, html);
          quill.focus();
        }
      }
    } catch (err) {
      console.error('Failed to read clipboard', err);
    }
  };

  const cleanFormatting = () => {
    const quill = quillRef.current;
    if (!quill) return;
    const range = quill.getSelection();
    if (range) {
      quill.removeFormat(range.index, range.length);
    }
  };

  // Main useEffect: Initializing Quill and binding all event listeners once
  useEffect(() => {
    if (!containerRef.current) return;

    const editorDiv = document.createElement('div');
    containerRef.current.appendChild(editorDiv);

    const quill = new Quill(editorDiv, {
      theme: 'bubble',
      placeholder: placeholder || 'Escribe aquí...',
      modules: modules,
      bounds: '.task-detail-content'
    });

    quillRef.current = quill;

    if (value) {
      quill.clipboard.dangerouslyPasteHTML(value);
    }

    // 1. Handle text change callback to parent component
    const handleTextChangeCallback = () => {
      if (onChangeRef.current) {
        onChangeRef.current(quill.root.innerHTML);
      }
    };
    quill.on('text-change', handleTextChangeCallback);

    // 2. Event listeners for Table Add Hover Buttons
    const handleMouseMove = (e) => {
      const cell = e.target.closest('td, th');
      const table = e.target.closest('table');
      const wrapper = quill.root.closest('.rich-text-editor-container');
      
      if (cell && table && wrapper) {
        if (tableHoverTimeoutRef.current) {
          clearTimeout(tableHoverTimeoutRef.current);
          tableHoverTimeoutRef.current = null;
        }

        setHoveredTable(table);
        setHoveredCell(cell);

        const tableRect = table.getBoundingClientRect();
        const wrapperRect = wrapper.getBoundingClientRect();

        const tableLeft = tableRect.left - wrapperRect.left + wrapper.scrollLeft;
        const tableTop = tableRect.top - wrapperRect.top + wrapper.scrollTop;

        setColButtonPos({
          left: tableLeft + tableRect.width + 4,
          top: tableTop + (tableRect.height / 2) - 12,
          visible: true
        });

        setRowButtonPos({
          left: tableLeft + (tableRect.width / 2) - 12,
          top: tableTop + tableRect.height + 4,
          visible: true
        });
      } else {
        if (!tableHoverTimeoutRef.current) {
          tableHoverTimeoutRef.current = setTimeout(() => {
            setColButtonPos(prev => ({ ...prev, visible: false }));
            setRowButtonPos(prev => ({ ...prev, visible: false }));
            setHoveredCell(null);
            setHoveredTable(null);
          }, 300);
        }
      }
    };

    const handleMouseLeave = () => {
      if (!tableHoverTimeoutRef.current) {
        tableHoverTimeoutRef.current = setTimeout(() => {
          setColButtonPos(prev => ({ ...prev, visible: false }));
          setRowButtonPos(prev => ({ ...prev, visible: false }));
          setHoveredCell(null);
          setHoveredTable(null);
        }, 300);
      }
    };

    quill.root.addEventListener('mousemove', handleMouseMove);
    quill.root.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('scroll', handleMouseLeave, true);

    // 3. Custom Right-Click Context Menu Listener
    const handleNativeContextMenu = (e) => {
      const wrapper = quill.root.closest('.rich-text-editor-container');
      if (!wrapper) return;

      // Select clicked cell if right-clicked inside a table to ensure context menu actions apply to it
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
    quill.root.addEventListener('contextmenu', handleNativeContextMenu);

    // 4. Slash (/), Hash (#), and Emoji (:) Menu Selection Change Trigger
    const checkSlashCommand = () => {
      const context = getEditorContext();
      if (!context) {
        setShowSlashMenu(false);
        setShowHashMenu(false);
        setShowEmojiMenu(false);
        return;
      }
      const { range, textBeforeCursor } = context;

      if (textBeforeCursor.startsWith('/')) {
        const query = textBeforeCursor.slice(1);
        setSlashQuery(query);
        const bounds = quillRef.current.getBounds(range.index);
        
        setMenuPosition({
          top: bounds.top + bounds.height + 4,
          left: bounds.left
        });
        setShowSlashMenu(true);
        setShowHashMenu(false);
        setShowEmojiMenu(false);
        return;
      } else {
        setShowSlashMenu(false);
      }

      const hashIndex = textBeforeCursor.lastIndexOf('#');
      if (hashIndex !== -1) {
        const charBeforeHash = hashIndex > 0 ? textBeforeCursor[hashIndex - 1] : ' ';
        if (charBeforeHash === ' ' || charBeforeHash === '\n') {
          const query = textBeforeCursor.slice(hashIndex + 1);
          if (!query.includes(' ')) {
            setHashQuery(query);
            const bounds = quillRef.current.getBounds(range.index);
            setHashMenuPosition({
              top: bounds.top + bounds.height + 4,
              left: bounds.left
            });
            setShowHashMenu(true);
            setShowEmojiMenu(false);
            return;
          }
        }
      }
      setShowHashMenu(false);

      const colonIndex = textBeforeCursor.lastIndexOf(':');
      if (colonIndex !== -1) {
        const charBeforeColon = colonIndex > 0 ? textBeforeCursor[colonIndex - 1] : ' ';
        if (charBeforeColon === ' ' || charBeforeColon === '\n') {
          const query = textBeforeCursor.slice(colonIndex + 1);
          if (!query.includes(' ') && query.length > 0) {
            setEmojiQuery(query);
            const bounds = quillRef.current.getBounds(range.index);
            setEmojiMenuPosition({
              top: bounds.top + bounds.height + 4,
              left: bounds.left
            });
            setShowEmojiMenu(true);
            return;
          }
        }
      }
      setShowEmojiMenu(false);
    };
    const checkActiveCell = () => {
      setTimeout(() => {
        const cell = getSelectedCellElement();
        if (cell) {
          setActiveCell(cell);
          const wrapper = quill.root.closest('.rich-text-editor-container');
          if (wrapper) {
            const cellRect = cell.getBoundingClientRect();
            const wrapperRect = wrapper.getBoundingClientRect();
            
            // Position above active cell
            const left = cellRect.left - wrapperRect.left + wrapper.scrollLeft + (cellRect.width / 2) - 130;
            const top = cellRect.top - wrapperRect.top + wrapper.scrollTop - 42;
            
            setTableToolbarPos({
              left: Math.max(8, left),
              top: top > 0 ? top : cellRect.bottom - wrapperRect.top + wrapper.scrollTop + 8,
              visible: true
            });
          }
        } else {
          setActiveCell(null);
          setTableToolbarPos(prev => ({ ...prev, visible: false }));
        }
      }, 0);
    };

    quill.on('selection-change', checkSlashCommand);
    quill.on('text-change', checkSlashCommand);
    quill.on('selection-change', checkActiveCell);
    quill.on('text-change', checkActiveCell);

    // 5. User Input Real-time Markdown Auto-conversion
    const handleTextChangeMarkdown = (delta, oldDelta, source) => {
      if (source !== 'user') return;

      const context = getEditorContext();
      if (!context) return;
      const { quill, lineIndex, cursorOffset, textBeforeCursor } = context;

      if (textBeforeCursor.endsWith(' ')) {
        const trimmed = textBeforeCursor.slice(0, -1);
        
        if (trimmed === '#') {
          quill.deleteText(lineIndex, cursorOffset);
          quill.formatLine(lineIndex, 1, 'header', 1);
        } else if (trimmed === '##') {
          quill.deleteText(lineIndex, cursorOffset);
          quill.formatLine(lineIndex, 1, 'header', 2);
        } else if (trimmed === '###') {
          quill.deleteText(lineIndex, cursorOffset);
          quill.formatLine(lineIndex, 1, 'header', 3);
        } else if (trimmed === '*' || trimmed === '-') {
          quill.deleteText(lineIndex, cursorOffset);
          quill.formatLine(lineIndex, 1, 'list', 'bullet');
        } else if (trimmed === '1.') {
          quill.deleteText(lineIndex, cursorOffset);
          quill.formatLine(lineIndex, 1, 'list', 'ordered');
        } else if (trimmed === '```') {
          quill.deleteText(lineIndex, cursorOffset);
          quill.formatLine(lineIndex, 1, 'code-block', true);
        } else if (trimmed === '>>>') {
          quill.deleteText(lineIndex, cursorOffset);
          quill.clipboard.dangerouslyPasteHTML(lineIndex, '<details><summary>Sección colapsable (haz clic para expandir)</summary><p>Escribe aquí el contenido oculto...</p></details>');
        }
      }
    };
    quill.on('text-change', handleTextChangeMarkdown);

    // 6. Paste/Copy handling for Markdown conversions
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
        const range = quill.getSelection();
        if (range) {
          quill.clipboard.dangerouslyPasteHTML(range.index, html);
          quill.focus();
        }
      }
    };

    const handleCopy = (e) => {
      const range = quill.getSelection();
      if (!range || range.length === 0) return;

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
    quill.root.addEventListener('paste', handlePaste, true);
    quill.root.addEventListener('copy', handleCopy);

    // 7. Selection tracking for the Convert to Subtask popup
    const handleSelectionChangeSubtask = (range) => {
      if (!range || range.length === 0) {
        setShowSelectionMenu(false);
        return;
      }

      const text = quill.getText(range.index, range.length).trim();
      if (text.length > 0 && onCreateSubtaskRef.current) {
        const bounds = quill.getBounds(range.index, range.length);
        
        setSelectionMenuPosition({
          top: bounds.top - 40,
          left: bounds.left + (bounds.width / 2) - 60
        });
        setSelectedText(text);
        setShowSelectionMenu(true);
      } else {
        setShowSelectionMenu(false);
      }
    };
    quill.on('selection-change', handleSelectionChangeSubtask);

    return () => {
      quill.off('text-change', handleTextChangeCallback);
      quill.off('selection-change', checkSlashCommand);
      quill.off('text-change', checkSlashCommand);
      quill.off('selection-change', checkActiveCell);
      quill.off('text-change', checkActiveCell);
      quill.off('text-change', handleTextChangeMarkdown);
      quill.off('selection-change', handleSelectionChangeSubtask);
      
      if (quill.root) {
        quill.root.removeEventListener('mousemove', handleMouseMove);
        quill.root.removeEventListener('mouseleave', handleMouseLeave);
        quill.root.removeEventListener('contextmenu', handleNativeContextMenu);
        quill.root.removeEventListener('paste', handlePaste, true);
        quill.root.removeEventListener('copy', handleCopy);
      }
      window.removeEventListener('scroll', handleMouseLeave, true);
      
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      quillRef.current = null;
      if (tableHoverTimeoutRef.current) clearTimeout(tableHoverTimeoutRef.current);
    };
  }, []);

  // Update value prop changes from outside cleanly
  useEffect(() => {
    const quill = quillRef.current;
    if (quill) {
      const currentHtml = quill.root.innerHTML;
      if (value !== undefined && value !== currentHtml) {
        const selection = quill.getSelection();
        quill.clipboard.dangerouslyPasteHTML(value || '');
        if (selection) {
          quill.setSelection(selection.index, selection.length);
        }
      }
    }
  }, [value]);

  const selectHashOption = (taskItem) => {
    const context = getEditorContext();
    if (!context) return;
    const { quill, lineIndex, cursorOffset, textBeforeCursor } = context;
    const hashIndex = textBeforeCursor.lastIndexOf('#');

    if (hashIndex !== -1) {
      const deleteIndex = lineIndex + hashIndex;
      const deleteLength = cursorOffset - hashIndex;

      quill.deleteText(deleteIndex, deleteLength);

      const linkText = `#${taskItem.id}: ${taskItem.title}`;
      quill.insertText(deleteIndex, linkText, 'link', `/tasks/${taskItem.id}`);
      
      quill.insertText(deleteIndex + linkText.length, ' ');
      quill.setSelection(deleteIndex + linkText.length + 1);
    }

    setShowHashMenu(false);
    setHashSelectedIndex(0);
    quill.focus();
  };

  const selectEmojiOption = (emojiItem) => {
    const context = getEditorContext();
    if (!context) return;
    const { quill, lineIndex, cursorOffset, textBeforeCursor } = context;
    const colonIndex = textBeforeCursor.lastIndexOf(':');

    if (colonIndex !== -1) {
      const deleteIndex = lineIndex + colonIndex;
      const deleteLength = cursorOffset - colonIndex;

      quill.deleteText(deleteIndex, deleteLength);

      quill.insertText(deleteIndex, emojiItem.char);
      quill.setSelection(deleteIndex + emojiItem.char.length);
    }

    setShowEmojiMenu(false);
    setEmojiSelectedIndex(0);
    quill.focus();
  };

  const selectOption = (option) => {
    const context = getEditorContext();
    if (!context) return;
    const { quill, line, lineIndex, cursorOffset } = context;

    quill.deleteText(lineIndex, cursorOffset);

    if (option.type === 'format') {
      quill.formatLine(lineIndex, 1, option.format, option.value);
    } else if (option.type === 'action') {
      if (option.action === 'divider') {
        quill.insertText(lineIndex, '────────────────────────────────────────\n');
      } else if (option.action === 'collapsible') {
        quill.clipboard.dangerouslyPasteHTML(lineIndex, '<details><summary>Sección colapsable (haz clic para expandir)</summary><p>Escribe aquí el contenido oculto...</p></details>');
      } else if (option.action === 'table') {
        const tableModule = quill.getModule('table');
        if (tableModule) {
          tableModule.insertTable(3, 3);
        }
      } else if (option.action === 'clean') {
        quill.removeFormat(lineIndex, line.length() - cursorOffset);
      }
    }

    setShowSlashMenu(false);
    setSelectedIndex(0);
    quill.focus();
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
    const quill = quillRef.current;
    if (!quill) return;

    const range = quill.getSelection();
    if (!range) return;

    quill.deleteText(range.index, range.length);
    
    if (onCreateSubtaskRef.current) {
      onCreateSubtaskRef.current(selectedText);
    }

    setShowSelectionMenu(false);
  };

  return (
    <div 
      className="rich-text-editor-container bubble-theme"
      onKeyDownCapture={handleKeyDown}
      style={{ position: 'relative' }}
    >
      <div 
        ref={containerRef} 
        className="quill-editor-wrapper"
      />

      <button
        className={`table-hover-add-btn col-add-btn ${colButtonPos.visible ? 'visible' : ''}`}
        style={{
          position: 'absolute',
          left: colButtonPos.left,
          top: colButtonPos.top,
          zIndex: 1000
        }}
        onMouseEnter={handleButtonMouseEnter}
        onMouseLeave={handleButtonMouseLeave}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => addColumnAtHover(hoveredCell)}
        title="Agregar columna a la derecha"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>

      <button
        className={`table-hover-add-btn row-add-btn ${rowButtonPos.visible ? 'visible' : ''}`}
        style={{
          position: 'absolute',
          left: rowButtonPos.left,
          top: rowButtonPos.top,
          zIndex: 1000
        }}
        onMouseEnter={handleButtonMouseEnter}
        onMouseLeave={handleButtonMouseLeave}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => addRowAtHover(hoveredCell)}
        title="Agregar fila abajo"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>

      {tableToolbarPos.visible && activeCell && (
        <div
          className="table-bubble-toolbar"
          style={{
            position: 'absolute',
            left: tableToolbarPos.left,
            top: tableToolbarPos.top,
            zIndex: 10005
          }}
        >
          <button
            className="table-bubble-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleTableAction('insertRowBelow')}
            title="Insertar fila abajo"
          >
            <span>+ Fila</span>
          </button>
          <button
            className="table-bubble-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleTableAction('deleteRow')}
            title="Eliminar fila actual"
          >
            <span>- Fila</span>
          </button>
          <div className="table-bubble-divider" />
          <button
            className="table-bubble-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleTableAction('insertColumnRight')}
            title="Insertar columna a la derecha"
          >
            <span>+ Col</span>
          </button>
          <button
            className="table-bubble-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleTableAction('deleteColumn')}
            title="Eliminar columna actual"
          >
            <span>- Col</span>
          </button>
          <div className="table-bubble-divider" />
          <button
            className="table-bubble-btn danger"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleTableAction('deleteTable')}
            title="Eliminar tabla completa"
          >
            <span>🗑️ Tabla</span>
          </button>
        </div>
      )}

      {showContextMenu && (
        <div 
          className={`calendar-context-menu editor-context-menu ${
            quillRef.current && 
            contextMenuPosition.x > (quillRef.current.container.getBoundingClientRect().width / 2) 
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
                  !(quillRef.current?.getSelection()?.length > 0) ? 'disabled' : ''
                }`}
                onClick={() => {
                  if (quillRef.current?.getSelection()?.length > 0) {
                    copySelectionAsMarkdown();
                  }
                }}
                style={
                  !(quillRef.current?.getSelection()?.length > 0) 
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
          {filteredOptions.map((opt, idx) => (
            <div
              key={opt.key}
              className={`slash-command-item ${idx === selectedIndex ? 'active' : ''}`}
              onClick={() => selectOption(opt)}
            >
              <div className="slash-command-icon">
                {opt.key === 'h1' && <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>H1</span>}
                {opt.key === 'h2' && <span style={{ fontWeight: 800, fontSize: '0.7rem' }}>H2</span>}
                {opt.key === 'bullet' && <span>•</span>}
                {opt.key === 'ordered' && <span>1.</span>}
                {opt.key === 'code' && <span style={{ fontSize: '0.75rem' }}>&lt;/&gt;</span>}
                {opt.key === 'callout' && <span>💡</span>}
                {opt.key === 'divider' && <span>—</span>}
                {opt.key === 'clean' && <span>✕</span>}
              </div>
              <div className="slash-command-text">
                <span className="slash-command-label">{opt.label}</span>
                <span className="slash-command-desc">{opt.desc}</span>
              </div>
            </div>
          ))}
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

      {showSelectionMenu && (
        <button
          className="convert-selection-btn"
          onClick={convertSelectionToSubtask}
          style={{
            position: 'absolute',
            top: selectionMenuPosition.top,
            left: selectionMenuPosition.left,
          }}
        >
          <span>✨</span>
          <span>Convertir en subtarea</span>
        </button>
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
      html += '<pre class="ql-syntax">';
      inCodeBlock = true;
      continue;
    }

    // Check if table row
    const isTableRow = line.trim().startsWith('|') && line.trim().endsWith('|');
    if (isTableRow) {
      flushList();
      inTable = true;
      tableRows.push(line.trim());
      continue;
    } else {
      flushTable();
    }

    // 2. Blockquotes / Accordions
    if (line.startsWith('> ')) {
      flushList();
      const content = line.slice(2);
      html += `<blockquote>${parseInlineMarkdown(content)}</blockquote>`;
      continue;
    }

    if (line.startsWith('>>> ')) {
      flushList();
      const title = line.slice(4).trim();
      html += `<details><summary>${parseInlineMarkdown(title)}</summary><p>Escribe aquí el contenido...</p></details>`;
      continue;
    }

    // 3. Headings
    if (line.startsWith('# ')) {
      flushList();
      html += `<h1>${parseInlineMarkdown(line.slice(2))}</h1>`;
      continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      html += `<h2>${parseInlineMarkdown(line.slice(3))}</h2>`;
      continue;
    }
    if (line.startsWith('### ')) {
      flushList();
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
      html += `<li>${parseInlineMarkdown(line.slice(2))}</li>`;
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
  
  // Check if second row is divider
  if (rows.length > 1) {
    const secondRowCells = parseRow(rows[1]);
    const isDivider = secondRowCells.length > 0 && secondRowCells.every(c => /^[:\-\s]+$/.test(c) && c.includes('-'));
    if (isDivider) {
      startIndex = 2;
    }
  }

  let tableHtml = '<table class="ql-table"><tbody>';
  
  // Render headers
  tableHtml += '<tr>';
  headers.forEach(h => {
    tableHtml += `<td class="ql-table-cell"><strong>${parseInlineMarkdown(h)}</strong></td>`;
  });
  tableHtml += '</tr>';

  // Render cells
  for (let i = startIndex; i < rows.length; i++) {
    const rowLine = rows[i].trim();
    // Skip divider row if encountered later
    const rowCellsForCheck = parseRow(rowLine);
    const isDivider = rowCellsForCheck.length > 0 && rowCellsForCheck.every(c => /^[:\-\s]+$/.test(c) && c.includes('-'));
    if (isDivider) continue;

    const cells = parseRow(rowLine);
    tableHtml += '<tr>';
    for (let j = 0; j < headers.length; j++) {
      const val = cells[j] || '';
      tableHtml += `<td class="ql-table-cell">${parseInlineMarkdown(val)}</td>`;
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
          md += `${innerText}\n\n`;
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
        // Handled by case 'table'
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
        // Handled in details
        break;
      case 'ul':
        for (let li of child.children) {
          md += `* ${nodeToMarkdown(li)}\n`;
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
        md += `* ${nodeToMarkdown(child)}\n`;
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

