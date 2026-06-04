import { useRef, useMemo, useState, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.bubble.css';

// Register details/summary and table custom blots in Quill
const Quill = ReactQuill.Quill;
if (Quill) {
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

  // Table Custom Blots for Quill 1.x
  class TableCellBlot extends Block {
    static blotName = 'table-cell';
    static tagName = 'td';
  }
  Quill.register(TableCellBlot);

  class TableRowBlot extends Container {
    static blotName = 'table-row';
    static tagName = 'tr';
  }
  TableRowBlot.defaultChild = 'table-cell';
  TableRowBlot.allowedChildren = [TableCellBlot];
  Quill.register(TableRowBlot);

  class TableBodyBlot extends Container {
    static blotName = 'table-body';
    static tagName = 'tbody';
  }
  TableBodyBlot.defaultChild = 'table-row';
  TableBodyBlot.allowedChildren = [TableRowBlot];
  Quill.register(TableBodyBlot);

  class TableContainerBlot extends Container {
    static blotName = 'table';
    static tagName = 'table';
  }
  TableContainerBlot.defaultChild = 'table-body';
  TableContainerBlot.allowedChildren = [TableBodyBlot];
  Quill.register(TableContainerBlot);
}

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
  const quillRef = useRef(null);
  
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);

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
            const quill = quillRef.current.getEditor();
            const range = quill.getSelection(true);
            quill.insertEmbed(range.index, 'image', data.url);
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
    }
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

  // Native contextmenu listener on quill.root
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const handleNativeContextMenu = (e) => {
      const wrapper = quill.root.closest('.rich-text-editor-container');
      if (!wrapper) return;

      e.preventDefault();
      e.stopPropagation();

      const container = wrapper.getBoundingClientRect();
      let x = e.clientX - container.left;
      let y = e.clientY - container.top;

      const menuWidth = 190;
      const menuHeight = 220; // approximate height

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
    return () => {
      quill.root.removeEventListener('contextmenu', handleNativeContextMenu);
    };
  }, [quillRef.current]);


  const toggleFormat = (formatName) => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const currentFormats = quill.getFormat();
    const isFormatActive = currentFormats[formatName];
    quill.format(formatName, !isFormatActive);
  };

  const toggleCodeBlock = () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const currentFormats = quill.getFormat();
    quill.format('code-block', !currentFormats['code-block']);
  };

  const toggleBlockquote = () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const currentFormats = quill.getFormat();
    quill.format('blockquote', !currentFormats['blockquote']);
  };

  const insertCollapsible = () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const range = quill.getSelection(true);
    if (range) {
      quill.clipboard.dangerouslyPasteHTML(range.index, '<details><summary>Sección colapsable (haz clic para expandir)</summary><p>Escribe aquí el contenido...</p></details>');
    }
  };

  const insertDivider = () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const range = quill.getSelection(true);
    if (range) {
      quill.insertText(range.index, '────────────────────────────────────────\n');
    }
  };

  const insertTable = () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const range = quill.getSelection(true);
    if (range) {
      const tableHtml = `
        <table class="ql-table">
          <tbody>
            <tr>
              <td class="ql-table-cell"><strong>Cabecera 1</strong></td>
              <td class="ql-table-cell"><strong>Cabecera 2</strong></td>
              <td class="ql-table-cell"><strong>Cabecera 3</strong></td>
            </tr>
            <tr>
              <td class="ql-table-cell"><br></td>
              <td class="ql-table-cell"><br></td>
              <td class="ql-table-cell"><br></td>
            </tr>
            <tr>
              <td class="ql-table-cell"><br></td>
              <td class="ql-table-cell"><br></td>
              <td class="ql-table-cell"><br></td>
            </tr>
          </tbody>
        </table>
      `;
      quill.clipboard.dangerouslyPasteHTML(range.index, tableHtml);
    }
    setShowContextMenu(false);
  };

  const getIsCursorInTable = () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return false;
    
    // Check DOM path
    try {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        let node = selection.getRangeAt(0).startContainer;
        while (node && node !== quill.root) {
          if (node.nodeName === 'TD' || node.nodeName === 'TH' || node.nodeName === 'TABLE') {
            return true;
          }
          node = node.parentNode;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  const handleTableAction = (action) => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    let node = selection.getRangeAt(0).startContainer;
    const td = node.nodeType === Node.ELEMENT_NODE ? node.closest('td') : node.parentElement?.closest('td');
    if (!td) return;

    const tr = td.closest('tr');
    const table = td.closest('table');
    if (!tr || !table) return;

    const cellIndex = td.cellIndex;

    if (action === 'insertRowAbove' || action === 'insertRowBelow') {
      const newTr = document.createElement('tr');
      const numCols = tr.cells.length;
      for (let i = 0; i < numCols; i++) {
        const newTd = document.createElement('td');
        newTd.className = 'ql-table-cell';
        newTd.innerHTML = '<br>';
        newTr.appendChild(newTd);
      }
      if (action === 'insertRowAbove') {
        table.tBodies[0].insertBefore(newTr, tr);
      } else {
        table.tBodies[0].insertBefore(newTr, tr.nextSibling);
      }
    } else if (action === 'insertColumnLeft' || action === 'insertColumnRight') {
      const rows = Array.from(table.querySelectorAll('tr'));
      rows.forEach(r => {
        const newTd = document.createElement('td');
        newTd.className = 'ql-table-cell';
        newTd.innerHTML = '<br>';
        const targetCell = r.cells[cellIndex];
        if (action === 'insertColumnLeft') {
          r.insertBefore(newTd, targetCell);
        } else {
          r.insertBefore(newTd, targetCell ? targetCell.nextSibling : null);
        }
      });
    } else if (action === 'deleteRow') {
      if (table.querySelectorAll('tr').length <= 1) {
        table.remove();
      } else {
        tr.remove();
      }
    } else if (action === 'deleteColumn') {
      const rows = Array.from(table.querySelectorAll('tr'));
      const numCols = tr.cells.length;
      if (numCols <= 1) {
        table.remove();
      } else {
        rows.forEach(r => {
          const targetCell = r.cells[cellIndex];
          if (targetCell) targetCell.remove();
        });
      }
    } else if (action === 'deleteTable') {
      table.remove();
    }

    const newHtml = quill.root.innerHTML;
    quill.setContents(quill.clipboard.convert(newHtml));
    
    if (onChange) {
      onChange(newHtml);
    }

    setShowContextMenu(false);
  };

  const triggerMention = (char) => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const range = quill.getSelection(true);
    if (range) {
      quill.insertText(range.index, char);
      quill.setSelection(range.index + 1);
      quill.focus();
    }
  };

  const copySelectionAsMarkdown = async () => {
    const quill = quillRef.current?.getEditor();
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
    const quill = quillRef.current?.getEditor();
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
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const range = quill.getSelection();
    if (range) {
      quill.removeFormat(range.index, range.length);
    }
  };

  // Synchronize index range boundary when options filter changes
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

  // Selection change listener for slash detection
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const checkSlashCommand = () => {
      const range = quill.getSelection();
      if (!range) {
        setShowSlashMenu(false);
        return;
      }

      const [line] = quill.getLine(range.index);
      if (!line) {
        setShowSlashMenu(false);
        return;
      }
      const lineIndex = quill.getIndex(line);
      const cursorOffset = range.index - lineIndex;
      const lineLength = line.length();
      
      // Get text before cursor on current line
      const lineText = quill.getText(lineIndex, lineLength - 1);
      const textBeforeCursor = lineText.slice(0, cursorOffset);

      if (textBeforeCursor.startsWith('/')) {
        const query = textBeforeCursor.slice(1);
        setSlashQuery(query);
        const bounds = quill.getBounds(range.index);
        
        // Offset below the current line
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

      // Check for Hash menu (#)
      const hashIndex = textBeforeCursor.lastIndexOf('#');
      if (hashIndex !== -1) {
        const charBeforeHash = hashIndex > 0 ? textBeforeCursor[hashIndex - 1] : ' ';
        if (charBeforeHash === ' ' || charBeforeHash === '\n') {
          const query = textBeforeCursor.slice(hashIndex + 1);
          if (!query.includes(' ')) {
            setHashQuery(query);
            const bounds = quill.getBounds(range.index);
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

      // Check for Emoji menu (:)
      const colonIndex = textBeforeCursor.lastIndexOf(':');
      if (colonIndex !== -1) {
        const charBeforeColon = colonIndex > 0 ? textBeforeCursor[colonIndex - 1] : ' ';
        if (charBeforeColon === ' ' || charBeforeColon === '\n') {
          const query = textBeforeCursor.slice(colonIndex + 1);
          if (!query.includes(' ') && query.length > 0) {
            setEmojiQuery(query);
            const bounds = quill.getBounds(range.index);
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

    quill.on('selection-change', checkSlashCommand);
    // Listen to text-change to update query dynamically as user types
    quill.on('text-change', checkSlashCommand);

    return () => {
      quill.off('selection-change', checkSlashCommand);
      quill.off('text-change', checkSlashCommand);
    };
  }, [quillRef.current]);

  // Real-time Markdown auto-conversion listener
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const handleTextChange = (delta, oldDelta, source) => {
      if (source !== 'user') return;

      const range = quill.getSelection();
      if (!range) return;

      const [line] = quill.getLine(range.index);
      if (!line) return;

      const lineIndex = quill.getIndex(line);
      const cursorOffset = range.index - lineIndex;
      const lineLength = line.length();
      
      const lineText = quill.getText(lineIndex, lineLength - 1);
      const textBeforeCursor = lineText.slice(0, cursorOffset);

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

    quill.on('text-change', handleTextChange);
    return () => {
      quill.off('text-change', handleTextChange);
    };
  }, [quillRef.current]);

  // Clipboard copy/paste handler for Markdown
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

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

    return () => {
      quill.root.removeEventListener('paste', handlePaste, true);
      quill.root.removeEventListener('copy', handleCopy);
    };
  }, [quillRef.current]);

  // Selection change listener for Convert to Subtask popup
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const handleSelectionChange = (range, oldRange, source) => {
      if (!range || range.length === 0) {
        setShowSelectionMenu(false);
        return;
      }

      const text = quill.getText(range.index, range.length).trim();
      if (text.length > 0 && onCreateSubtask) {
        const bounds = quill.getBounds(range.index, range.length);
        
        // Calculate centered top position
        setSelectionMenuPosition({
          top: bounds.top - 40,
          left: bounds.left + (bounds.width / 2) - 60 // 60px is approx half button width
        });
        setSelectedText(text);
        setShowSelectionMenu(true);
      } else {
        setShowSelectionMenu(false);
      }
    };

    quill.on('selection-change', handleSelectionChange);
    return () => {
      quill.off('selection-change', handleSelectionChange);
    };
  }, [quillRef.current, onCreateSubtask]);

  const convertSelectionToSubtask = () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const range = quill.getSelection();
    if (!range) return;

    // Delete selected text
    quill.deleteText(range.index, range.length);
    
    // Call parent handler
    if (onCreateSubtask) {
      onCreateSubtask(selectedText);
    }

    setShowSelectionMenu(false);
  };

  const selectHashOption = (taskItem) => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const range = quill.getSelection();
    if (!range) return;

    const [line] = quill.getLine(range.index);
    if (!line) return;
    const lineIndex = quill.getIndex(line);
    const cursorOffset = range.index - lineIndex;

    const lineText = quill.getText(lineIndex, line.length() - 1);
    const textBeforeCursor = lineText.slice(0, cursorOffset);
    const hashIndex = textBeforeCursor.lastIndexOf('#');

    if (hashIndex !== -1) {
      const deleteIndex = lineIndex + hashIndex;
      const deleteLength = cursorOffset - hashIndex;

      // Delete the "#query"
      quill.deleteText(deleteIndex, deleteLength);

      // Insert link
      const linkText = `#${taskItem.id}: ${taskItem.title}`;
      quill.insertText(deleteIndex, linkText, 'link', `/tasks/${taskItem.id}`);
      
      // Trailing space
      quill.insertText(deleteIndex + linkText.length, ' ');
      quill.setSelection(deleteIndex + linkText.length + 1);
    }

    setShowHashMenu(false);
    setHashSelectedIndex(0);
    quill.focus();
  };

  const selectEmojiOption = (emojiItem) => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const range = quill.getSelection();
    if (!range) return;

    const [line] = quill.getLine(range.index);
    if (!line) return;
    const lineIndex = quill.getIndex(line);
    const cursorOffset = range.index - lineIndex;

    const lineText = quill.getText(lineIndex, line.length() - 1);
    const textBeforeCursor = lineText.slice(0, cursorOffset);
    const colonIndex = textBeforeCursor.lastIndexOf(':');

    if (colonIndex !== -1) {
      const deleteIndex = lineIndex + colonIndex;
      const deleteLength = cursorOffset - colonIndex;

      // Delete the ":query"
      quill.deleteText(deleteIndex, deleteLength);

      // Insert emoji
      quill.insertText(deleteIndex, emojiItem.char);
      quill.setSelection(deleteIndex + emojiItem.char.length);
    }

    setShowEmojiMenu(false);
    setEmojiSelectedIndex(0);
    quill.focus();
  };

  const selectOption = (option) => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const range = quill.getSelection();
    if (!range) return;

    const [line] = quill.getLine(range.index);
    if (!line) return;
    const lineIndex = quill.getIndex(line);
    const cursorOffset = range.index - lineIndex;

    // Delete the command (e.g. "/h1" or "/")
    quill.deleteText(lineIndex, cursorOffset);

    // Apply format
    if (option.type === 'format') {
      quill.formatLine(lineIndex, 1, option.format, option.value);
    } else if (option.type === 'action') {
      if (option.action === 'divider') {
        quill.insertText(lineIndex, '────────────────────────────────────────\n');
      } else if (option.action === 'collapsible') {
        quill.clipboard.dangerouslyPasteHTML(lineIndex, '<details><summary>Sección colapsable (haz clic para expandir)</summary><p>Escribe aquí el contenido oculto...</p></details>');
      } else if (option.action === 'table') {
        const tableHtml = `
          <table class="ql-table">
            <tbody>
              <tr>
                <td class="ql-table-cell"><strong>Cabecera 1</strong></td>
                <td class="ql-table-cell"><strong>Cabecera 2</strong></td>
                <td class="ql-table-cell"><strong>Cabecera 3</strong></td>
              </tr>
              <tr>
                <td class="ql-table-cell"><br></td>
                <td class="ql-table-cell"><br></td>
                <td class="ql-table-cell"><br></td>
              </tr>
              <tr>
                <td class="ql-table-cell"><br></td>
                <td class="ql-table-cell"><br></td>
                <td class="ql-table-cell"><br></td>
              </tr>
            </tbody>
          </table>
        `;
        quill.clipboard.dangerouslyPasteHTML(lineIndex, tableHtml);
      } else if (option.action === 'clean') {
        quill.removeFormat(lineIndex, line.length() - cursorOffset);
      }
    }

    setShowSlashMenu(false);
    setSelectedIndex(0);
    quill.focus();
  };

  const handleKeyDown = (e) => {
    // 0. Context Menu close on escape
    if (showContextMenu) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowContextMenu(false);
        return;
      }
    }

    // 1. Slash Menu navigation
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

    // 2. Hash Menu navigation
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

    // 3. Emoji Menu navigation
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

  return (
    <div 
      className="rich-text-editor-container bubble-theme"
      onKeyDownCapture={handleKeyDown}
      style={{ position: 'relative' }}
    >
      <ReactQuill 
        ref={quillRef}
        theme="bubble" 
        bounds={".task-detail-content"}
        value={value} 
        onChange={onChange} 
        modules={modules}
        placeholder={placeholder || 'Escribe aquí...'}
      />

      {showContextMenu && (
        <div 
          className={`calendar-context-menu editor-context-menu ${
            quillRef.current?.getEditor() && 
            contextMenuPosition.x > (quillRef.current.getEditor().container.getBoundingClientRect().width / 2) 
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
                  !(quillRef.current?.getEditor()?.getSelection()?.length > 0) ? 'disabled' : ''
                }`}
                onClick={() => {
                  if (quillRef.current?.getEditor()?.getSelection()?.length > 0) {
                    copySelectionAsMarkdown();
                  }
                }}
                style={
                  !(quillRef.current?.getEditor()?.getSelection()?.length > 0) 
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

