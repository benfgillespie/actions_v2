"use client";
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Plus, Folder, Calendar, Clock, AlertCircle, MessageSquare, ChevronDown, ChevronRight, X, Edit2, Trash2, Play, Square, ArrowUpDown } from 'lucide-react';

// Utility functions
const generateId = () => Math.random().toString(36).substr(2, 9);
const formatDate = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDateShort = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleDateString();
};

const removeDueDateTag = (text) =>
  text.replace(/\/d(?:\s+\d+(?:\s*days?)?|\s+\d{4}-\d{2}-\d{2}|\s*)?/i, ' ').replace(/\s+/g, ' ').trim();

const areSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const addMonths = (date, count) => {
  const newDate = new Date(date);
  newDate.setMonth(newDate.getMonth() + count);
  return newDate;
};

const getCalendarDays = (monthDate) => {
  const firstOfMonth = startOfMonth(monthDate);
  const startDay = firstOfMonth.getDay(); // 0 (Sun) - 6 (Sat)
  const firstGridDate = new Date(firstOfMonth);
  firstGridDate.setDate(firstOfMonth.getDate() - startDay);

  const days = [];
  for (let i = 0; i < 42; i++) {
    const day = new Date(firstGridDate);
    day.setDate(firstGridDate.getDate() + i);
    day.setHours(0, 0, 0, 0);
    days.push(day);
  }
  return days;
};

const toTitleCase = (value) => {
  if (!value || typeof value !== 'string') return '';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
};

const SESSION_FILTER_ALL = '__ALL__';
const STATUS_ORDER = ['not_started', 'in_progress', 'done'];
const STATUS_LABELS = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  done: 'Done'
};

const normalizeStatus = (value) => (
  STATUS_ORDER.includes(value) ? value : 'not_started'
);

const COLUMN_DEFS = [
  { id: 'type', label: 'Type', filterable: true },
  { id: 'project', label: 'Project', filterable: true },
  { id: 'session', label: 'Session', filterable: true },
  { id: 'dueDate', label: 'Due Date', filterable: true },
  { id: 'urgent', label: 'Urgent', filterable: true },
  { id: 'status', label: 'Status', filterable: true },
  { id: 'createdAt', label: 'Date Created', filterable: true },
  { id: 'actions', label: 'Actions', alwaysVisible: true }
];

const COLUMN_MIN_WIDTHS = {
  type: 110,
  project: 140,
  session: 140,
  dueDate: 120,
  urgent: 110,
  status: 130,
  createdAt: 130,
  actions: 72
};

const COLUMN_DEFAULT_WIDTHS = {
  type: 140,
  project: 170,
  session: 170,
  dueDate: 140,
  urgent: 120,
  status: 150,
  createdAt: 140,
  actions: 90
};

const SELECTION_COLUMN_WIDTH = 40;

const INITIAL_COLUMN_VISIBILITY = COLUMN_DEFS.reduce((acc, column) => {
  acc[column.id] = true;
  return acc;
}, {});

// Initial data structure
const initialData = {
  projects: [],
  people: [],
  sessions: [],
  noteTypes: [
    { id: 'note', name: 'Note', isSystem: true },
    { id: 'to_do', name: 'To Do', isSystem: true }
  ],
  notes: [],
  comments: [],
  settings: {
    apiKey: '',
    autoAnalyze: true
  }
};

export default function TaskTracker() {
  const [data, setData] = useState(initialData);
  const [quickEntry, setQuickEntry] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [columnFilters, setColumnFilters] = useState({});
  const [activeSession, setActiveSession] = useState(null);
  const [groupBy, setGroupBy] = useState('none');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [showComments, setShowComments] = useState(new Set());
  const [collapsedNotes, setCollapsedNotes] = useState(new Set());
  // const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showProjectAutocomplete, setShowProjectAutocomplete] = useState(false);
  const [selectedAutocompleteIndex, setSelectedAutocompleteIndex] = useState(0);
  const [appliedTags, setAppliedTags] = useState({ type: 'note', isUrgent: false, dueDate: null, projectIds: [] });
  const [sortConfig, setSortConfig] = useState({ columnId: null, direction: 'asc' });
  const [columnVisibility, setColumnVisibility] = useState(() => ({ ...INITIAL_COLUMN_VISIBILITY }));
  const [columnOrder, setColumnOrder] = useState(() => COLUMN_DEFS.map(col => col.id));
  const [columnWidths, setColumnWidths] = useState(() => COLUMN_DEFS.reduce((acc, column) => {
    acc[column.id] = COLUMN_DEFAULT_WIDTHS[column.id] ?? 150;
    return acc;
  }, {}));
  const [itemColumnWidth, setItemColumnWidth] = useState(380);
  const [selectedNoteIds, setSelectedNoteIds] = useState(() => new Set());
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [pendingDueDate, setPendingDueDate] = useState(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return startOfMonth(today);
  });
  const quickEntryRef = useRef(null);
  const datePickerRef = useRef(null);
  const selectAllRef = useRef(null);
  const hasInitializedRef = useRef(false);
  const lastSavedSnapshotRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const saveAbortControllerRef = useRef(null);
  const columnDragIdRef = useRef(null);
  const columnResizeStateRef = useRef(null);

  const ensureDefaultNoteTypes = (types = []) => {
    const baseList = Array.isArray(types) ? types.filter(t => t && t.id && t.id !== 'deliverable') : [];
    const existingIds = new Set(baseList.map(t => t.id));
    initialData.noteTypes.forEach(defaultType => {
      if (!existingIds.has(defaultType.id)) {
        baseList.push(defaultType);
        existingIds.add(defaultType.id);
      }
    });
    return baseList;
  };

  const sanitizeLoadedData = (raw) => {
    if (!raw || typeof raw !== 'object') return initialData;
    const sanitizedNoteTypes = ensureDefaultNoteTypes(raw.noteTypes);
    const sanitizedNotes = Array.isArray(raw.notes)
      ? raw.notes
          .filter(Boolean)
          .map(note => {
            const transformed = { ...note };
            if (transformed.type === 'deliverable') {
              transformed.type = 'note';
            }
            transformed.status = normalizeStatus(transformed.status);
            const projectIds = Array.isArray(transformed.projectIds)
              ? transformed.projectIds.filter(Boolean)
              : [];
            if (transformed.projectId) {
              projectIds.push(transformed.projectId);
            }
            transformed.projectIds = Array.from(new Set(projectIds));
            delete transformed.projectId;
            return transformed;
          })
      : [];
    const sanitizedComments = Array.isArray(raw.comments)
      ? raw.comments.filter(Boolean).map(comment => ({
          ...comment,
          sessionId: comment.sessionId || null,
          type: comment.type || 'note'
        }))
      : [];
    return {
      ...initialData,
      ...raw,
      noteTypes: sanitizedNoteTypes,
      notes: sanitizedNotes,
      comments: sanitizedComments
    };
  };

  useEffect(() => {
    let cancelled = false;

    const applyLoadedState = (loadedData, markAsSaved = false) => {
      if (cancelled) return;
      setData(loadedData);

      const active = loadedData.sessions.find(s => s.isActive);
      if (active) {
        setActiveSession(active);
        setSelectedProject(active.projectId);
      } else {
        setActiveSession(null);
      }

      hasInitializedRef.current = true;
      if (markAsSaved) {
        try {
          lastSavedSnapshotRef.current = JSON.stringify(loadedData);
        } catch {
          lastSavedSnapshotRef.current = null;
        }
      } else {
        lastSavedSnapshotRef.current = null;
      }
    };

    const loadFromLocalStorage = () => {
      if (typeof window === 'undefined') return false;
      try {
        const saved = window.localStorage.getItem('taskTrackerData');
        if (!saved) return false;
        const loadedData = sanitizeLoadedData(JSON.parse(saved));
        applyLoadedState(loadedData);
        return true;
      } catch (error) {
        console.error('Failed to load task tracker data from localStorage', error);
        return false;
      }
    };

    const loadData = async () => {
      try {
        const response = await fetch('/api/data', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Failed to load data (${response.status})`);
        }
        const body = await response.json();
        const loadedData = sanitizeLoadedData(body);
        applyLoadedState(loadedData, true);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('taskTrackerData', JSON.stringify(loadedData));
        }
      } catch (error) {
        console.error('Failed to load task tracker data from API', error);
        const loaded = loadFromLocalStorage();
        if (!loaded && !cancelled) {
          hasInitializedRef.current = true;
          lastSavedSnapshotRef.current = null;
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasInitializedRef.current || typeof window === 'undefined') return;
    window.localStorage.setItem('taskTrackerData', JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    if (!hasInitializedRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce persistence to avoid flooding the API during rapid edits
    saveTimeoutRef.current = window.setTimeout(() => {
      const payload = (() => {
        try {
          return JSON.stringify(data);
        } catch (error) {
          console.error('Failed to serialize task tracker data for saving', error);
          return null;
        }
      })();

      if (!payload) return;
      if (payload === lastSavedSnapshotRef.current) return;

      if (saveAbortControllerRef.current) {
        saveAbortControllerRef.current.abort();
      }

      const controller = new AbortController();
      saveAbortControllerRef.current = controller;

      const persist = async () => {
        try {
          const response = await fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            signal: controller.signal
          });
          if (!response.ok) {
            throw new Error(`Failed to save data (${response.status})`);
          }
          lastSavedSnapshotRef.current = payload;
        } catch (error) {
          if (controller.signal.aborted) return;
          console.error('Failed to save task tracker data', error);
        } finally {
          if (saveAbortControllerRef.current === controller) {
            saveAbortControllerRef.current = null;
          }
        }
      };

      persist();
    }, 400);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [data]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (saveAbortControllerRef.current) {
        saveAbortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (!pendingDueDate) return;
    const monthStart = startOfMonth(new Date(pendingDueDate));
    setDatePickerMonth(monthStart);
  }, [pendingDueDate]);

  useEffect(() => {
    if (!datePickerVisible) return;
    const handleClickOutside = (event) => {
      if (datePickerRef.current && datePickerRef.current.contains(event.target)) return;
      if (quickEntryRef.current && quickEntryRef.current.contains(event.target)) return;
      setDatePickerVisible(false);
      setPendingDueDate(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [datePickerVisible]);

  useEffect(() => {
    if (!showColumnMenu) return;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowColumnMenu(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showColumnMenu]);

  // AI Analysis - Commented out for now
  /*
  const analyzeWithAI = async (content) => {
    if (!data.settings.apiKey) {
      alert('Please set your Anthropic API key in Settings');
      return null;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': data.settings.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: `Analyze this note and extract structured information. Return ONLY a JSON object with no additional text.

Note: "${content}"

Return JSON with these fields:
{
  "type": "note" | "to_do",
  "isUrgent": true | false,
  "dueDate": "YYYY-MM-DD" or null,
  "suggestedContent": "improved version of the note if needed, otherwise same as input"
}

Rules:
- Use "to_do" if it's an action item or task
- Use "note" for information, observations, or general notes
- Mark as urgent if there are words like "urgent", "asap", "critical", "emergency"
- Extract due dates from phrases like "by Friday", "tomorrow", "next week", "in 3 days"
- Today is ${new Date().toISOString().split('T')[0]}
- If no clear due date, return null
- Keep the content largely the same unless there are obvious improvements`
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      const content_text = result.content[0].text;
      
      // Extract JSON from the response (handling potential markdown code blocks)
      let jsonStr = content_text.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/```json\n?/, '').replace(/```$/, '').trim();
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```\n?/, '').replace(/```$/, '').trim();
      }
      
      const analysis = JSON.parse(jsonStr);
      
      return {
        type: analysis.type || 'note',
        isUrgent: analysis.isUrgent || false,
        dueDate: analysis.dueDate ? new Date(analysis.dueDate).getTime() : null,
        content: analysis.suggestedContent || content
      };
    } catch (error) {
      console.error('AI analysis error:', error);
      alert('Failed to analyze note with AI. Check console for details.');
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };
  */

  const handleTagFilter = () => {};
  const isTagActive = () => false;
  const clearTagFilter = () => {};

  const handleSessionFilter = () => {};

  const toggleCollapsed = (noteId) => {
    setCollapsedNotes(prev => {
      const next = new Set(prev);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  };

  const expandNote = (noteId) => {
    setCollapsedNotes(prev => {
      if (!prev.has(noteId)) return prev;
      const next = new Set(prev);
      next.delete(noteId);
      return next;
    });
  };

  const toggleComments = (noteId) => {
    setShowComments(prev => {
      const next = new Set(prev);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  };

  const toggleColumnVisibility = (columnId) => {
    const column = COLUMN_DEFS.find(col => col.id === columnId);
    if (!column || column.alwaysVisible) return;
    setColumnVisibility(prev => ({
      ...prev,
      [columnId]: !prev[columnId]
    }));
  };

  const isColumnVisible = (column) => column.alwaysVisible || columnVisibility[column.id];

  const handleSort = (columnId) => {
    if (columnId === 'actions') return;
    setSortConfig(prev => {
      if (prev.columnId !== columnId) {
        return { columnId, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { columnId, direction: 'desc' };
      }
      return { columnId: null, direction: 'asc' };
    });
  };

  const orderedColumns = useMemo(() => {
    const prioritized = columnOrder
      .map(id => COLUMN_DEFS.find(col => col.id === id))
      .filter(Boolean);
    const missing = COLUMN_DEFS.filter(col => !columnOrder.includes(col.id));
    return [...prioritized, ...missing];
  }, [columnOrder]);

  const visibleColumns = orderedColumns.filter(isColumnVisible);

  const handleColumnFilterChange = (columnId, value) => {
    setColumnFilters(prev => ({
      ...prev,
      [columnId]: value || undefined
    }));
  };

  const gridTemplateColumns = useMemo(() => {
    const primaryWidth = Math.max(280, itemColumnWidth);
    const otherTemplates = visibleColumns.map(column => {
      const minWidth = COLUMN_MIN_WIDTHS[column.id] ?? 120;
      const storedWidth = columnWidths[column.id] ?? COLUMN_DEFAULT_WIDTHS[column.id] ?? 150;
      return `${Math.max(minWidth, storedWidth)}px`;
    });
    return [`${SELECTION_COLUMN_WIDTH}px`, `${primaryWidth}px`, ...otherTemplates].join(' ');
  }, [visibleColumns, columnWidths, itemColumnWidth]);

  const gridMinWidth = useMemo(() => {
    const primaryWidth = Math.max(280, itemColumnWidth);
    const otherWidth = visibleColumns.reduce((sum, column) => {
      const minWidth = COLUMN_MIN_WIDTHS[column.id] ?? 120;
      const storedWidth = columnWidths[column.id] ?? COLUMN_DEFAULT_WIDTHS[column.id] ?? 150;
      return sum + Math.max(minWidth, storedWidth);
    }, 0);
    return Math.max(640, SELECTION_COLUMN_WIDTH + primaryWidth + otherWidth);
  }, [visibleColumns, columnWidths, itemColumnWidth]);

  const handleColumnDragStart = (event, columnId) => {
    columnDragIdRef.current = columnId;
    event.dataTransfer.effectAllowed = 'move';
    try {
      event.dataTransfer.setData('text/plain', columnId);
    } catch {
      // ignore for browsers that disallow setting data
    }
  };

  const handleColumnDragOver = (event, columnId) => {
    if (!columnDragIdRef.current || columnDragIdRef.current === columnId) return;
    event.preventDefault();
  };

  const handleColumnDrop = (event, columnId) => {
    event.preventDefault();
    const sourceId = columnDragIdRef.current;
    columnDragIdRef.current = null;
    if (!sourceId) return;
    const targetId = columnId === '__end__' ? null : columnId;
    if (targetId === sourceId) return;
    setColumnOrder(prev => {
      const next = prev.filter(id => id !== sourceId);
      const insertIndex = targetId ? next.indexOf(targetId) : next.length;
      if (insertIndex === -1) {
        next.push(sourceId);
      } else {
        next.splice(insertIndex, 0, sourceId);
      }
      return next;
    });
  };

  const handleColumnDragEnd = () => {
    columnDragIdRef.current = null;
  };

  const handleColumnResizeMouseMove = useCallback((event) => {
    const state = columnResizeStateRef.current;
    if (!state) return;
    const delta = event.clientX - state.startX;
    const minWidth = state.columnId === '__item__'
      ? 280
      : COLUMN_MIN_WIDTHS[state.columnId] ?? 120;
    const proposed = Math.max(minWidth, state.initialWidth + delta);
    if (state.columnId === '__item__') {
      setItemColumnWidth(proposed);
    } else {
      setColumnWidths(prev => ({
        ...prev,
        [state.columnId]: proposed
      }));
    }
  }, []);

  const handleColumnResizeMouseUp = useCallback(() => {
    columnResizeStateRef.current = null;
    document.removeEventListener('mousemove', handleColumnResizeMouseMove);
    document.removeEventListener('mouseup', handleColumnResizeMouseUp);
  }, [handleColumnResizeMouseMove]);

  const handleColumnResizeMouseDown = useCallback((event, columnId) => {
    event.preventDefault();
    event.stopPropagation();
    const initialWidth = columnId === '__item__'
      ? Math.max(280, itemColumnWidth)
      : Math.max(COLUMN_MIN_WIDTHS[columnId] ?? 120, columnWidths[columnId] ?? COLUMN_DEFAULT_WIDTHS[columnId] ?? 150);
    columnResizeStateRef.current = {
      columnId,
      startX: event.clientX,
      initialWidth
    };
    document.addEventListener('mousemove', handleColumnResizeMouseMove);
    document.addEventListener('mouseup', handleColumnResizeMouseUp);
  }, [columnWidths, itemColumnWidth, handleColumnResizeMouseMove, handleColumnResizeMouseUp]);


  const renderColumnFilterOptions = (columnId) => {
    switch (columnId) {
      case 'type':
        return data.noteTypes.map(type => (
          <option key={type.id} value={type.id}>{type.name}</option>
        ));
      case 'status':
        return STATUS_ORDER.map(statusId => (
          <option key={statusId} value={statusId}>{STATUS_LABELS[statusId]}</option>
        ));
      case 'project':
        return [
          <option key="__none__" value="__NONE__">No Project</option>,
          ...data.projects.map(project => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))
        ];
      case 'session':
        return [
          <option key="__all__" value={SESSION_FILTER_ALL}>Any Session</option>,
          <option key="__none__" value="__NONE__">No Session</option>,
          ...data.sessions.map(session => (
            <option key={session.id} value={session.id}>{session.title}</option>
          ))
        ];
      case 'dueDate':
        return [
          <option key="none" value="none">No Due Date</option>,
          <option key="week" value="week">Due This Week</option>,
          <option key="overdue" value="overdue">Overdue</option>
        ];
      case 'urgent':
        return [
          <option key="yes" value="yes">Urgent</option>,
          <option key="no" value="no">Not Urgent</option>
        ];
      case 'createdAt':
        return [
          <option key="today" value="today">Created Today</option>
        ];
      default:
        return null;
    }
  };

  const getSortValue = (note, columnId) => {
    switch (columnId) {
      case 'type':
        return note.type || '';
      case 'project': {
        const projectIds = Array.isArray(note.projectIds)
          ? note.projectIds
          : note.projectId
            ? [note.projectId]
            : [];
        const projectNames = projectIds
          .map(id => data.projects.find(p => p.id === id)?.name || '')
          .filter(Boolean)
          .sort();
        return projectNames[0] || '';
      }
      case 'session': {
        const session = data.sessions.find(s => s.id === note.sessionId);
        return session ? session.title : '';
      }
      case 'dueDate':
        return note.dueDate || 0;
      case 'urgent':
        return note.isUrgent ? 1 : 0;
      case 'status':
        return STATUS_ORDER.indexOf(note.status) ?? 0;
      case 'createdAt':
        return note.createdAt || 0;
      default:
        return note.createdAt || 0;
    }
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleColumnResizeMouseMove);
      document.removeEventListener('mouseup', handleColumnResizeMouseUp);
    };
  }, [handleColumnResizeMouseMove, handleColumnResizeMouseUp]);

  // Parse tags from note content
  const parseTags = (text) => {
    const tags = {
      type: 'note',
      isUrgent: false,
      dueDate: null,
      projectIds: [],
      isComment: false,
      content: text
    };

    // Extract tags
    const tagPattern = /\/([a-z])(?:\s+([^\/]+?))?(?=\s*\/|$)/gi;
    let cleanContent = text;
    let match;
    const matches = [];
    
    while ((match = tagPattern.exec(text)) !== null) {
      matches.push(match);
    }

    // Process tags
    matches.forEach(match => {
      const tag = match[1].toLowerCase();
      const value = match[2]?.trim();

      switch(tag) {
        case 'a':
          tags.type = 'to_do';
          cleanContent = cleanContent.replace(match[0], '').trim();
          break;
        case 'd':
          if (value) {
            // Check if it's a number (with optional "days" word)
            const daysMatch = value.match(/^(\d+)\s*(?:days?)?$/i);
            if (daysMatch) {
              // /d n or /d n days - set due date
              const days = parseInt(daysMatch[1]);
              const base = new Date();
              base.setHours(0, 0, 0, 0);
              base.setDate(base.getDate() + days);
              tags.dueDate = base.getTime();
              cleanContent = cleanContent.replace(match[0], '').trim();
            } else {
              const parsed = Date.parse(`${value}T00:00:00`);
              if (!Number.isNaN(parsed)) {
                tags.dueDate = parsed;
                cleanContent = cleanContent.replace(match[0], '').trim();
              }
            }
          }
          break;
        case 'n':
          tags.type = 'note';
          cleanContent = cleanContent.replace(match[0], '').trim();
          break;
        case 'c':
          tags.isComment = true;
          cleanContent = cleanContent.replace(match[0], '').trim();
          break;
        case 'u':
          tags.isUrgent = true;
          cleanContent = cleanContent.replace(match[0], '').trim();
          break;
        case 'p':
          if (value) {
            // Find project by name
            const project = data.projects.find(p => 
              p.name.toLowerCase() === value.toLowerCase()
            );
            if (project) {
              if (!tags.projectIds.includes(project.id)) {
                tags.projectIds.push(project.id);
              }
            }
            cleanContent = cleanContent.replace(match[0], '').trim();
          }
          break;
      }
    });

    tags.content = cleanContent.trim();
    return tags;
  };

  // Handle project autocomplete
  const updateDueDatePreview = (text) => {
    const absoluteMatch = text.match(/\/d\s+(\d{4}-\d{2}-\d{2})/i);
    if (absoluteMatch) {
      const parsed = Date.parse(`${absoluteMatch[1]}T00:00:00`);
      if (!Number.isNaN(parsed)) {
        setPendingDueDate(parsed);
        setSelectedDueDate(null);
        setDatePickerVisible(true);
        return;
      }
    }

    const relativeMatch = text.match(/\/d\s+(\d{1,2})(?:\s*(?:days?)?)?/i);
    if (relativeMatch) {
      const days = parseInt(relativeMatch[1], 10);
      if (!Number.isNaN(days)) {
        const base = new Date();
        base.setHours(0, 0, 0, 0);
        base.setDate(base.getDate() + days);
        setPendingDueDate(base.getTime());
        setSelectedDueDate(null);
        setDatePickerVisible(true);
        return;
      }
    }

    if (/\/d\b/i.test(text)) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setPendingDueDate(today.getTime());
      setSelectedDueDate(null);
      setDatePickerVisible(true);
      return;
    }

    setPendingDueDate(null);
    setDatePickerVisible(false);
  };

  const handleDatePickerSelect = (dateObj) => {
    const timestamp = dateObj.getTime();
    setAppliedTags(prev => ({ ...prev, dueDate: timestamp }));
    setQuickEntry(prev => removeDueDateTag(prev));
    setPendingDueDate(null);
    setDatePickerVisible(false);
    if (quickEntryRef.current) {
      const inputEl = quickEntryRef.current.querySelector('input');
      if (inputEl) {
        inputEl.focus();
      }
    }
  };

  const handleQuickEntryChange = (value) => {
    let workingText = value;
    let newTags = { ...appliedTags };
    let mutated = false;
    
    // Check for /a (action/to_do) tag
    if (/\/a(?:\s|$|\/)/i.test(workingText)) {
      newTags.type = 'to_do';
      workingText = workingText.replace(/\/a(?=\s|$|\/)/gi, '').trim();
      mutated = true;
    }
    
    // Check for /n (note) tag
    if (/\/n(?:\s|$|\/)/i.test(workingText)) {
      newTags.type = 'note';
      workingText = workingText.replace(/\/n(?=\s|$|\/)/gi, '').trim();
      mutated = true;
    }
    
    // Check for /u (urgent) tag
    if (/\/u(?:\s|$|\/)/i.test(workingText)) {
      newTags.isUrgent = true;
      workingText = workingText.replace(/\/u(?=\s|$|\/)/gi, '').trim();
      mutated = true;
    }

    let finalText = mutated ? workingText.replace(/\s+/g, ' ').trim() : value;

    if (mutated) {
      setAppliedTags(newTags);
    }

    setQuickEntry(finalText);
    updateDueDatePreview(finalText);
    
    const pTagMatch = finalText.match(/\/p(?:\s+(.+?))?$/i);
    if (pTagMatch) {
      setShowProjectAutocomplete(true);
      setSelectedAutocompleteIndex(0);
    } else {
      setShowProjectAutocomplete(false);
    }
  };

  // Get filtered projects for autocomplete
  const getFilteredProjects = () => {
    const pMatch = quickEntry.match(/\/p\s+(.+?)$/i);
    const searchTerm = pMatch ? pMatch[1] : '';
    const existingIds = new Set(appliedTags.projectIds || []);
    return data.projects
      .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .filter(p => !existingIds.has(p.id));
  };

  // Handle keydown in quick entry
  const handleQuickEntryKeyDown = (e) => {
    if (showProjectAutocomplete) {
      const filteredProjects = getFilteredProjects();
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedAutocompleteIndex(prev => 
          prev < filteredProjects.length ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedAutocompleteIndex(prev => 
          prev > 0 ? prev - 1 : 0
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        
        // Extract the project name from the text (everything after /p)
        const projectNameMatch = quickEntry.match(/\/p\s+(.+?)$/i);
        
        if (selectedAutocompleteIndex < filteredProjects.length) {
          // A project from the list is highlighted - select it
          applyProjectTag(filteredProjects[selectedAutocompleteIndex]);
        } else if (projectNameMatch && projectNameMatch[1].trim()) {
          // No project selected, but there's text after /p - create new project
          const newProjectName = projectNameMatch[1].trim();
          createAndApplyNewProject(newProjectName);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowProjectAutocomplete(false);
      }
    } else if (e.key === 'Enter') {
      handleQuickAdd();
      e.preventDefault();
    }
  };

  // Apply project tag and remove /p text
  const applyProjectTag = (project) => {
    // Remove /p and everything after it (handle with or without space/text after)
    const newText = quickEntry.replace(/\/p(?:\s+.*)?$/i, '').trim();
    setQuickEntry(newText);
    setAppliedTags(prev => {
      const nextIds = prev.projectIds ? [...prev.projectIds] : [];
      if (!nextIds.includes(project.id)) {
        nextIds.push(project.id);
      }
      return { ...prev, projectIds: nextIds };
    });
    setShowProjectAutocomplete(false);
    updateDueDatePreview(newText);
  };

  // Create new project and apply tag
  const createAndApplyNewProject = (name) => {
    const newProject = {
      id: generateId(),
      name,
      details: '',
      customProperties: {},
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setData(prev => ({
      ...prev,
      projects: [...prev.projects, newProject]
    }));
    applyProjectTag(newProject);
  };

  // Remove a tag from applied tags
  const removeTag = (tagType, value) => {
    const newTags = { ...appliedTags };
    
    switch(tagType) {
      case 'type':
        newTags.type = 'note';
        break;
      case 'urgent':
        newTags.isUrgent = false;
        break;
      case 'dueDate':
        newTags.dueDate = null;
        setPendingDueDate(null);
        setDatePickerVisible(false);
        break;
      case 'project':
        if (value) {
          newTags.projectIds = (newTags.projectIds || []).filter(id => id !== value);
        } else {
          newTags.projectIds = [];
        }
        break;
    }
    
    setAppliedTags(newTags);
  };

  // Quick add note with applied tags
  const handleQuickAdd = () => {
    const rawText = quickEntry.trim();
    if (!rawText) return;

    const parsed = parseTags(rawText);
    const content = parsed.content || rawText;
    const finalType = appliedTags.type !== 'note' ? appliedTags.type : parsed.type || 'note';
    const finalDueDate = parsed.dueDate ?? appliedTags.dueDate ?? null;
    const finalUrgent = appliedTags.isUrgent || parsed.isUrgent;
    const finalProjectIds = Array.from(new Set([
      ...(parsed.projectIds || []),
      ...(appliedTags.projectIds || []),
      ...(selectedProject ? [selectedProject] : [])
    ].filter(Boolean)));

    const newNote = {
      id: generateId(),
      projectIds: finalProjectIds,
      sessionId: activeSession?.id || null,
      parentId: null,
      type: finalType,
      content,
      dueDate: finalDueDate,
      status: 'not_started',
      isUrgent: finalUrgent,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    setData(prev => ({
      ...prev,
      notes: [...prev.notes, newNote]
    }));
    setQuickEntry('');
    setShowProjectAutocomplete(false);
    setAppliedTags({ type: 'note', isUrgent: false, dueDate: null, projectIds: [] });
    setPendingDueDate(null);
    setDatePickerVisible(false);
  };

  // Add project
  const addProject = (name, details) => {
    const newProject = {
      id: generateId(),
      name,
      details,
      customProperties: {},
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setData(prev => ({
      ...prev,
      projects: [...prev.projects, newProject]
    }));
  };

  // Start session
  const startSession = (projectId, title, type, participantIds) => {
    // End any active session first
    if (activeSession) {
      endSession(activeSession.id);
    }
    
    const newSession = {
      id: generateId(),
      projectId,
      title,
      type,
      participants: participantIds,
      startTime: Date.now(),
      endTime: null,
      isActive: true,
      createdAt: Date.now()
    };
    
    setData(prev => ({
      ...prev,
      sessions: [...prev.sessions, newSession]
    }));
    setActiveSession(newSession);
    setSelectedProject(projectId);
  };

  // End session
  const endSession = (sessionId) => {
    setData(prev => ({
      ...prev,
      sessions: prev.sessions.map(s => 
        s.id === sessionId ? { ...s, endTime: Date.now(), isActive: false } : s
      )
    }));
    setActiveSession(null);
  };

  // Update settings - Commented out for now
  /*
  const updateSettings = (newSettings) => {
    setData(prev => ({
      ...prev,
      settings: { ...prev.settings, ...newSettings }
    }));
  };
  */

  // Add/update note
  const saveNote = (noteData) => {
    const baseStatus = normalizeStatus(noteData.status);
    const sanitizedProjectIds = Array.isArray(noteData.projectIds)
      ? Array.from(new Set(noteData.projectIds.filter(Boolean)))
      : noteData.projectId
        ? [noteData.projectId]
        : [];
    if (editingNote?.id) {
      setData(prev => ({
        ...prev,
        notes: prev.notes.map(n => {
          if (n.id !== editingNote.id) return n;
          return {
            ...n,
            ...noteData,
            projectIds: sanitizedProjectIds,
            status: baseStatus,
            sessionId: activeSession?.id || n.sessionId || null,
            updatedAt: Date.now()
          };
        })
      }));
    } else {
      const newNote = {
        ...noteData,
        id: generateId(),
        parentId: editingNote?.parentId ?? noteData.parentId ?? null,
        projectIds: sanitizedProjectIds.length > 0
          ? sanitizedProjectIds
          : editingNote?.projectIds
            ? editingNote.projectIds
            : selectedProject
              ? [selectedProject]
              : [],
        sessionId: activeSession?.id || null,
        status: baseStatus,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      setData(prev => ({
        ...prev,
        notes: [...prev.notes, newNote]
      }));
    }
    setEditingNote(null);
  };

  const updateNoteStatus = (note, nextStatus) => {
    const normalized = normalizeStatus(nextStatus);
    setData(prev => ({
      ...prev,
      notes: prev.notes.map(n => {
        if (n.id !== note.id) return n;
        return {
          ...n,
          status: normalized,
          updatedAt: Date.now()
        };
      })
    }));
  };

  const updateNoteType = (note, nextType) => {
    setData(prev => ({
      ...prev,
      notes: prev.notes.map(n => {
        if (n.id !== note.id) return n;
        return {
          ...n,
          type: nextType,
          updatedAt: Date.now()
        };
      })
    }));
  };

  const cycleStatus = (note) => {
    const current = STATUS_ORDER.includes(note.status) ? note.status : STATUS_ORDER[0];
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(current) + 1) % STATUS_ORDER.length];
    updateNoteStatus(note, next);
  };

  const cycleNoteType = (note) => {
    const typeIds = data.noteTypes.map(t => t.id).filter(Boolean);
    if (typeIds.length === 0) return;
    const currentIndex = typeIds.indexOf(note.type);
    const safeIndex = currentIndex === -1 ? 0 : currentIndex;
    const nextType = typeIds[(safeIndex + 1) % typeIds.length];
    updateNoteType(note, nextType);
  };

  const updateNoteUrgency = (note, isUrgent) => {
    setData(prev => ({
      ...prev,
      notes: prev.notes.map(n => {
        if (n.id !== note.id) return n;
        return {
          ...n,
          isUrgent,
          updatedAt: Date.now()
        };
      })
    }));
  };

  const addProjectToNote = (noteId, projectId) => {
    if (!projectId) return;
    setData(prev => ({
      ...prev,
      notes: prev.notes.map(note => {
        if (note.id !== noteId) return note;
        const currentIds = Array.isArray(note.projectIds) ? [...note.projectIds] : note.projectId ? [note.projectId] : [];
        if (!currentIds.includes(projectId)) {
          currentIds.push(projectId);
        }
        return {
          ...note,
          projectIds: currentIds,
          updatedAt: Date.now()
        };
      })
    }));
  };

  const removeProjectFromNote = (noteId, projectId) => {
    setData(prev => ({
      ...prev,
      notes: prev.notes.map(note => {
        if (note.id !== noteId) return note;
        const currentIds = Array.isArray(note.projectIds) ? note.projectIds : note.projectId ? [note.projectId] : [];
        const nextIds = currentIds.filter(id => id !== projectId);
        return {
          ...note,
          projectIds: nextIds,
          updatedAt: Date.now()
        };
      })
    }));
  };

  // Delete note
  const deleteNote = (noteId) => {
    const deleteRecursive = (id) => {
      const children = data.notes.filter(n => n.parentId === id);
      children.forEach(child => deleteRecursive(child.id));
      
      setData(prev => ({
        ...prev,
        notes: prev.notes.filter(n => n.id !== id),
        comments: prev.comments.filter(c => c.noteId !== id)
      }));
      setSelectedNoteIds(prev => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    };
    deleteRecursive(noteId);
  };

  const handleDeleteFromModal = (noteId) => {
    if (!noteId) return;
    const confirmed = typeof window === 'undefined' ? true : window.confirm('Delete this note and its sub-items?');
    if (!confirmed) return;
    deleteNote(noteId);
    setShowNoteModal(false);
    setEditingNote(null);
  };

  // Add comment
  const addThreadItem = (noteId, entry) => {
    if (!entry || !entry.content || !entry.content.trim()) return;
    const { content, type, dueDate, isUrgent, isComment } = entry;
    setData(prev => {
      const parent = prev.notes.find(n => n.id === noteId);
      if (!parent) return prev;
      
      const treatAsComment = isComment || (type === 'note' && !dueDate && !isUrgent && content.trim().startsWith('//'));
      
      if (treatAsComment) {
        const newComment = {
          id: generateId(),
          noteId,
          content,
          type: type || 'note',
          sessionId: activeSession?.id || parent.sessionId || null,
          createdAt: Date.now()
        };
        return {
          ...prev,
          comments: [...prev.comments, newComment]
        };
      }

      const newNote = {
        id: generateId(),
        parentId: noteId,
        projectIds: Array.isArray(parent.projectIds)
          ? [...parent.projectIds]
          : parent.projectId
            ? [parent.projectId]
            : [],
        sessionId: activeSession?.id || parent.sessionId || null,
        type: type || 'note',
        content,
        dueDate,
        status: 'not_started',
        isUrgent,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      return {
        ...prev,
        notes: [...prev.notes, newNote]
      };
    });
  };

  // Filter and group notes
  const getFilteredNotes = () => {
    const allNotes = data.notes;
    const noteById = new Map(allNotes.map(n => [n.id, n]));

    const matchesFilter = (note) => {
      const projectIds = Array.isArray(note.projectIds)
        ? note.projectIds
        : note.projectId
          ? [note.projectId]
          : [];
      if (selectedProject && !projectIds.includes(selectedProject)) {
        return false;
      }
      if (columnFilters.project) {
        if (columnFilters.project === '__NONE__') {
          if (projectIds.length > 0) return false;
        } else if (!projectIds.includes(columnFilters.project)) {
          return false;
        }
      }
      if (columnFilters.type && note.type !== columnFilters.type) {
        return false;
      }
      if (columnFilters.status && note.status !== columnFilters.status) {
        return false;
      }
      if (columnFilters.session) {
        if (columnFilters.session === SESSION_FILTER_ALL) {
          if (!note.sessionId) return false;
        } else if (!note.sessionId || note.sessionId !== columnFilters.session) {
          return false;
        }
      }
      if (columnFilters.urgent) {
        const target = columnFilters.urgent === 'yes';
        if (!!note.isUrgent !== target) return false;
      }
      if (columnFilters.due) {
        const now = Date.now();
        const weekFromNow = now + 7 * 24 * 60 * 60 * 1000;
        if (!note.dueDate && columnFilters.due !== 'none') return false;
        if (columnFilters.due === 'none') {
          if (note.dueDate) return false;
        } else if (columnFilters.due === 'overdue') {
          if (!note.dueDate || note.dueDate >= now) return false;
        } else if (columnFilters.due === 'week') {
          if (!note.dueDate || note.dueDate > weekFromNow) return false;
        }
      }
      if (columnFilters.created) {
        if (columnFilters.created === 'today') {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(today.getDate() + 1);
          if (!note.createdAt || note.createdAt < today.getTime() || note.createdAt >= tomorrow.getTime()) {
            return false;
          }
        }
      }
      return true;
    };

    const matchingNotes = new Set();
    allNotes.forEach(note => {
      if (matchesFilter(note)) {
        matchingNotes.add(note.id);
      }
    });

    if (matchingNotes.size === 0 && Object.keys(columnFilters).length === 0) {
      allNotes.forEach(note => matchingNotes.add(note.id));
    }

    const visibleNotes = new Set(matchingNotes);
    matchingNotes.forEach(id => {
      let current = noteById.get(id);
      while (current && current.parentId) {
        visibleNotes.add(current.parentId);
        current = noteById.get(current.parentId);
      }
    });

    const baseTopLevel = allNotes.filter(n => !n.parentId && visibleNotes.has(n.id));
    const topLevel = baseTopLevel.sort((a, b) => {
      if (!sortConfig.columnId) {
        const aUrgent = a.isUrgent ? 1 : 0;
        const bUrgent = b.isUrgent ? 1 : 0;
        if (aUrgent !== bUrgent) {
          return bUrgent - aUrgent; // urgent first
        }
        const aDone = a.status === 'done' ? 1 : 0;
        const bDone = b.status === 'done' ? 1 : 0;
        if (aDone !== bDone) {
          return aDone - bDone; // done last
        }
        return (b.createdAt || 0) - (a.createdAt || 0);
      }
      const aValue = getSortValue(a, sortConfig.columnId);
      const bValue = getSortValue(b, sortConfig.columnId);
      if (aValue === bValue) return 0;
      const comparison = aValue > bValue ? 1 : -1;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    return {
      topLevelNotes: topLevel,
      visibleNotes,
      matchingNotes
    };
  };

  // Group notes
  const getGroupedNotes = (topLevelNotes) => {
    if (groupBy === 'none') {
      return { 'All Items': topLevelNotes };
    } else if (groupBy === 'project') {
      const grouped = {};
      topLevelNotes.forEach(note => {
        const projectIds = Array.isArray(note.projectIds)
          ? note.projectIds
          : note.projectId
            ? [note.projectId]
            : [];
        if (projectIds.length === 0) {
          if (!grouped['No Project']) grouped['No Project'] = [];
          grouped['No Project'].push(note);
        } else {
          projectIds.forEach(id => {
            const project = data.projects.find(p => p.id === id);
            const key = project ? project.name : 'Unknown Project';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(note);
          });
        }
      });
      return grouped;
    } else if (groupBy === 'type') {
      const grouped = {};
      topLevelNotes.forEach(note => {
        const type = data.noteTypes.find(t => t.id === note.type);
        const key = type ? type.name : toTitleCase(note.type || 'Other');
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(note);
      });
      return grouped;
    } else if (groupBy === 'session') {
      const grouped = {};
      topLevelNotes.forEach(note => {
        const session = data.sessions.find(s => s.id === note.sessionId);
        const key = session ? session.title : 'No Session';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(note);
      });
      return grouped;
    } else if (groupBy === 'due_date') {
      const grouped = { 'No Due Date': [], 'Overdue': [], 'This Week': [], 'Later': [] };
      const now = Date.now();
      const weekFromNow = now + 7 * 24 * 60 * 60 * 1000;
      
      topLevelNotes.forEach(note => {
        if (!note.dueDate) {
          grouped['No Due Date'].push(note);
        } else if (note.dueDate < now) {
          grouped['Overdue'].push(note);
        } else if (note.dueDate <= weekFromNow) {
          grouped['This Week'].push(note);
        } else {
          grouped['Later'].push(note);
        }
      });
      return grouped;
    }
    
    return { 'All Items': topLevelNotes };
  };

  const buildNoteRows = (note, depth = 0, visibleNotesSet, matchingNotesSet) => {
    const childCandidates = data.notes
      .filter(n => n.parentId === note.id)
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const includeAllChildren = matchingNotesSet.has(note.id);
    const children = includeAllChildren
      ? childCandidates
      : childCandidates.filter(child => visibleNotesSet.has(child.id));
    const comments = data.comments
      .filter(c => c.noteId === note.id)
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const isCollapsed = collapsedNotes.has(note.id);
    const commentsExpanded = showComments.has(note.id);
    
    const rows = [{
      kind: 'note',
      note,
      depth,
      childCount: children.length,
      commentCount: comments.length,
      isCollapsed,
      commentsExpanded
    }];
    
    if (!isCollapsed) {
      children.forEach(child => {
        rows.push(...buildNoteRows(child, depth + 1, visibleNotesSet, matchingNotesSet));
      });
      
      if (commentsExpanded) {
        comments.forEach(comment => {
          rows.push({ kind: 'comment', comment, depth: depth + 1 });
        });
        rows.push({ kind: 'comment-input', noteId: note.id, depth: depth + 1 });
      }
    }
    
    return rows;
  };
  
const renderRow = (row, gridTemplateColumns, visibleColumnsList) => {
    if (row.kind === 'comment-input') {
      const totalColumns = visibleColumnsList.length + 1;
      return (
        <div
          key={`comment-input-${row.noteId}`}
          className="grid items-start gap-3 px-3 py-2 border-b border-gray-100 bg-gray-50"
          style={{ gridTemplateColumns }}
        >
          <div
            className="flex items-center gap-2"
            style={{
              paddingLeft: `${row.depth * 20 + 24}px`,
              gridColumn: `1 / span ${totalColumns}`
            }}
          >
            <MessageSquare size={14} className="text-gray-400 flex-shrink-0" />
            <div className="flex items-center gap-2 flex-1">
              <ThreadInput
                noteId={row.noteId}
                onAdd={addThreadItem}
                parseTags={parseTags}
              />
            </div>
          </div>
        </div>
      );
    }
    
    const isNoteRow = row.kind === 'note';
    const note = row.note;
    const comment = row.comment;
    const indent = `${row.depth * 20}px`;
    const rowKey = isNoteRow ? `note-${note.id}` : `comment-${comment.id}`;
    const noteProjectIds = isNoteRow
      ? (Array.isArray(note.projectIds)
          ? note.projectIds
          : note.projectId
            ? [note.projectId]
            : [])
      : [];
    const projectEntities = noteProjectIds
      .map(id => data.projects.find(p => p.id === id))
      .filter(Boolean);
    const noteSession = isNoteRow
      ? data.sessions.find(s => s.id === note.sessionId)
      : null;
    const commentSession = !isNoteRow && comment.sessionId
      ? data.sessions.find(s => s.id === comment.sessionId)
      : null;
    const typeDefinition = isNoteRow
      ? data.noteTypes.find(t => t.id === note.type)
      : null;
    const typeLabel = isNoteRow
      ? (typeDefinition ? typeDefinition.name : toTitleCase(note.type || 'Note'))
      : toTitleCase(comment.type || 'Note');
    const typeValue = typeLabel;
    const noteStatusClasses = isNoteRow && note.status === 'done'
      ? 'bg-green-100 text-green-700'
      : isNoteRow && note.status === 'in_progress'
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-gray-100 text-gray-600';
    const canCollapse = isNoteRow && (row.childCount > 0 || row.commentCount > 0);
    const collapseButton = canCollapse ? (
      <button
        onClick={() => toggleCollapsed(note.id)}
        className="text-gray-400 hover:text-gray-600 transition"
        aria-label={row.isCollapsed ? 'Expand' : 'Collapse'}
      >
        {row.isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
      </button>
    ) : (
      <span className="w-4 h-4" />
    );
    
    const contentCell = isNoteRow ? (
      <div className="flex items-center gap-3" style={{ paddingLeft: indent }}>
        {collapseButton}
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium text-gray-900">{note.content}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">{formatDateShort(note.createdAt)}</span>
              {isNoteRow && (
                <button
                  onClick={() => {
                    if (row.isCollapsed) {
                      expandNote(note.id);
                    }
                    toggleComments(note.id);
                  }}
                  className={`text-xs font-medium flex items-center gap-1 transition ${
                    row.commentsExpanded ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'
                  }`}
                >
                  <MessageSquare size={14} />
                  {row.commentCount > 0 ? row.commentCount : '+'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    ) : (
      <div className="flex items-start gap-3 text-sm text-gray-700" style={{ paddingLeft: indent }}>
        <span className="w-4 h-4 text-gray-400 flex items-center justify-center">
          <MessageSquare size={14} />
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              {typeLabel}
            </span>
            {commentSession && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700">
                <Clock size={12} /> {commentSession.title}
              </span>
            )}
          </div>
          <p className="mt-1 leading-relaxed text-sm text-gray-700">{comment.content}</p>
          <div className="mt-1 text-xs text-gray-400">{formatDate(comment.createdAt)}</div>
        </div>
      </div>
    );
    
    const rowClassName = isNoteRow
      ? 'grid items-center gap-3 px-3 py-2 border-b border-gray-100 bg-white hover:bg-gray-50 transition'
      : 'grid items-center gap-3 px-3 py-2 border-b border-gray-100 bg-gray-50';
    
    const isSelected = isNoteRow ? selectedNoteIds.has(note.id) : false;
    const selectionCell = isNoteRow ? (
      <div className="flex items-center justify-center">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={isSelected}
          onChange={() => toggleNoteSelection(note.id)}
        />
      </div>
    ) : (
      <div className="flex items-center justify-center" />
    );

    const sessionLabel = isNoteRow
      ? noteSession?.title || '—'
      : commentSession?.title || '—';
    const dueDateValue = isNoteRow && note.dueDate
      ? formatDateShort(note.dueDate)
      : '—';
    const urgentClasses = note.isUrgent
      ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700'
      : 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500';
    
    return (
      <div
        key={rowKey}
        className={rowClassName}
        style={{ gridTemplateColumns: gridTemplateColumns }}
      >
        {selectionCell}
        {contentCell}
        {visibleColumnsList.map(column => {
          if (column.id === 'type') {
            return (
              <div key={`${rowKey}-type`} className="text-sm text-gray-700">
                {isNoteRow ? (
                  <button
                    type="button"
                    onClick={() => cycleNoteType(note)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
                  >
                    {typeLabel}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    {typeValue}
                  </span>
                )}
              </div>
            );
          }
          
          if (column.id === 'project') {
            if (!isNoteRow) {
              return (
                <div key={`${rowKey}-project`} className="text-sm text-gray-600">—</div>
              );
            }
            const availableProjects = data.projects.filter(p => !noteProjectIds.includes(p.id));
            return (
              <div key={`${rowKey}-project`} className="text-sm text-gray-600">
                <div className="flex flex-wrap items-center gap-1">
                  {projectEntities.length === 0 && (
                    <span className="text-gray-400">—</span>
                  )}
                  {projectEntities.map(project => (
                    <span
                      key={project.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"
                    >
                      <Folder size={12} /> {project.name}
                      <button
                        type="button"
                        onClick={() => removeProjectFromNote(note.id, project.id)}
                        className="hover:bg-green-200 rounded-full p-0.5"
                        aria-label={`Remove ${project.name}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {availableProjects.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        const value = e.target.value;
                        if (!value) return;
                        addProjectToNote(note.id, value);
                      }}
                      className="text-xs border border-green-200 rounded px-1 py-0.5 text-green-700 bg-green-50 focus:outline-none"
                    >
                      <option value="">+ Add Project</option>
                      {availableProjects.map(project => (
                        <option key={project.id} value={project.id}>{project.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            );
          }
          
          if (column.id === 'session') {
            return (
              <div key={`${rowKey}-session`} className="text-sm text-gray-600 truncate">
                {sessionLabel}
              </div>
            );
          }
          
          if (column.id === 'dueDate') {
            return (
              <div key={`${rowKey}-due`} className="text-sm text-gray-600">
                {dueDateValue}
              </div>
            );
          }
          
          if (column.id === 'urgent') {
            return (
              <div key={`${rowKey}-urgent`} className="text-sm text-gray-600">
                {isNoteRow ? (
                  <button
                    type="button"
                    onClick={() => updateNoteUrgency(note, !note.isUrgent)}
                    className={urgentClasses}
                  >
                    {note.isUrgent ? (<><AlertCircle size={12} /> Urgent</>) : 'Not Urgent'}
                  </button>
                ) : (
                  <span className="text-gray-300 text-sm">—</span>
                )}
              </div>
            );
          }
          
          if (column.id === 'status') {
            return (
              <div key={`${rowKey}-status`} className="flex items-center">
                {isNoteRow ? (
                  <button
                    type="button"
                    onClick={() => cycleStatus(note)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition ${noteStatusClasses} hover:opacity-90`}
                  >
                    {STATUS_LABELS[note.status] || STATUS_LABELS.not_started}
                  </button>
                ) : (
                  <span className="text-gray-300 text-sm">—</span>
                )}
              </div>
            );
          }

          if (column.id === 'createdAt') {
            return (
              <div key={`${rowKey}-created`} className="text-sm text-gray-600">
                {isNoteRow && note.createdAt ? formatDateShort(note.createdAt) : '—'}
              </div>
            );
          }
          
          if (column.id === 'actions') {
            return (
              <div key={`${rowKey}-actions`} className="flex items-center gap-1 justify-end bg-gray-100 rounded-md px-2 py-1 h-full border border-gray-200">
                {isNoteRow ? (
                  <>
                    <button
                      onClick={() => {
                        setEditingNote(note);
                        setShowNoteModal(true);
                      }}
                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                      aria-label="Edit"
                    onDragOver={(event) => handleColumnDragOver(event, '__end__')}
                    onDrop={(event) => handleColumnDrop(event, '__end__')}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      aria-label="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                ) : (
                  <span className="text-gray-300 text-sm">—</span>
                )}
              </div>
            );
          }
          
          return null;
        })}
      </div>
    );
  };

  const filteredResult = getFilteredNotes();
  const { topLevelNotes, visibleNotes, matchingNotes } = filteredResult;

  const visibleNoteIds = useMemo(() => Array.from(visibleNotes), [visibleNotes]);
  const selectedVisibleCount = useMemo(() => visibleNoteIds.filter(id => selectedNoteIds.has(id)).length, [visibleNoteIds, selectedNoteIds]);
  const selectedCount = selectedNoteIds.size;
  const allVisibleSelected = visibleNoteIds.length > 0 && selectedVisibleCount === visibleNoteIds.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  const toggleNoteSelection = (noteId) => {
    setSelectedNoteIds(prev => {
      const next = new Set(prev);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedNoteIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleNoteIds.forEach(id => next.delete(id));
      } else {
        visibleNoteIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedNoteIds(new Set());
  };

  const confirmBulkAction = (message) => {
    if (typeof window === 'undefined') return true;
    return window.confirm(message);
  };

  const applyBulkUpdate = (description, updater) => {
    if (selectedNoteIds.size === 0) return;
    if (!confirmBulkAction(`${description}? (${selectedNoteIds.size} item${selectedNoteIds.size === 1 ? '' : 's'})`)) {
      return;
    }
    setData(prev => ({
      ...prev,
      notes: prev.notes.map(note => {
        if (!selectedNoteIds.has(note.id)) return note;
        return updater(note);
      })
    }));
    clearSelection();
  };

  const handleBulkStatusChange = (value) => {
    if (!value) return;
    const label = STATUS_LABELS[value] || value;
    applyBulkUpdate(`Set status to ${label}`, (note) => ({
      ...note,
      status: normalizeStatus(value),
      updatedAt: Date.now()
    }));
  };

  const handleBulkTypeChange = (value) => {
    if (!value) return;
    const typeName = data.noteTypes.find(t => t.id === value)?.name || value;
    applyBulkUpdate(`Set type to ${typeName}`, (note) => ({
      ...note,
      type: value,
      updatedAt: Date.now()
    }));
  };

  const handleBulkProjectAdd = (value) => {
    if (!value) return;
    const project = data.projects.find(p => p.id === value);
    const projectName = project ? project.name : 'selected project';
    applyBulkUpdate(`Add project ${projectName}`, (note) => {
      const ids = Array.isArray(note.projectIds)
        ? [...note.projectIds]
        : note.projectId
          ? [note.projectId]
          : [];
      if (!ids.includes(value)) {
        ids.push(value);
      }
      return {
        ...note,
        projectIds: ids,
        updatedAt: Date.now()
      };
    });
  };

  const handleBulkProjectRemove = (value) => {
    if (!value) return;
    if (value === '__ALL__') {
      applyBulkUpdate('Remove all projects', (note) => ({
        ...note,
        projectIds: [],
        updatedAt: Date.now()
      }));
      return;
    }
    const project = data.projects.find(p => p.id === value);
    const projectName = project ? project.name : 'selected project';
    applyBulkUpdate(`Remove project ${projectName}`, (note) => {
      const ids = Array.isArray(note.projectIds)
        ? note.projectIds
        : note.projectId
          ? [note.projectId]
          : [];
      return {
        ...note,
        projectIds: ids.filter(id => id !== value),
        updatedAt: Date.now()
      };
    });
  };

  const handleBulkSessionChange = (value) => {
    if (value === undefined || value === '') return;
    const sessionId = value === '__NONE__' ? null : value;
    const sessionLabel = value === '__NONE__'
      ? 'no session'
      : data.sessions.find(s => s.id === value)?.title || 'selected session';
    applyBulkUpdate(`Set session to ${sessionLabel}`, (note) => ({
      ...note,
      sessionId,
      updatedAt: Date.now()
    }));
  };

  const handleBulkUrgentChange = (value) => {
    if (!value) return;
    const isUrgent = value === 'yes';
    applyBulkUpdate(isUrgent ? 'mark items as urgent' : 'mark items as not urgent', (note) => ({
      ...note,
      isUrgent,
      updatedAt: Date.now()
    }));
  };

  const handleBulkDelete = () => {
    if (selectedNoteIds.size === 0) return;
    if (!confirmBulkAction(`Delete ${selectedNoteIds.size} item${selectedNoteIds.size === 1 ? '' : 's'} (including sub-items)? This cannot be undone.`)) {
      return;
    }
    const ids = Array.from(selectedNoteIds);
    ids.forEach(id => deleteNote(id));
    clearSelection();
  };
  const groupedNotes = getGroupedNotes(topLevelNotes);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-4">
        <div className="mx-auto w-[90%]">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Task Tracker</h1>
          
          {/* Active Session Banner */}
          {activeSession && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-green-500 rounded-full w-3 h-3 animate-pulse"></div>
                <div>
                  <p className="font-medium text-green-900">{activeSession.title}</p>
                  <p className="text-sm text-green-700">
                    Started {formatDate(activeSession.startTime)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => endSession(activeSession.id)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <Square size={16} /> End Session
              </button>
            </div>
          )}
          
          {/* Quick Entry */}
          <div className="relative">
            <div className="flex gap-2">
              <div className="flex-1 relative" ref={quickEntryRef}>
                <input
                  type="text"
                  value={quickEntry}
                  onChange={(e) => handleQuickEntryChange(e.target.value)}
                  onKeyDown={handleQuickEntryKeyDown}
                  placeholder="Quick add note... (use tags: /a /d /n /u /p)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                {datePickerVisible && (
                  <div
                    ref={datePickerRef}
                    className="absolute top-full right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-3"
                  >
                    {(() => {
                      const pendingDateObj = pendingDueDate ? new Date(pendingDueDate) : null;
                      const appliedDateObj = appliedTags.dueDate ? new Date(appliedTags.dueDate) : null;
                      const calendarDays = getCalendarDays(datePickerMonth);
                      const monthLabel = datePickerMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);

                      return (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <button
                              type="button"
                              onClick={() => setDatePickerMonth(prev => addMonths(prev, -1))}
                              className="p-1 text-gray-500 hover:text-gray-700 rounded"
                              aria-label="Previous month"
                            >
                              ‹
                            </button>
                            <span className="text-sm font-semibold text-gray-800">{monthLabel}</span>
                            <button
                              type="button"
                              onClick={() => setDatePickerMonth(prev => addMonths(prev, 1))}
                              className="p-1 text-gray-500 hover:text-gray-700 rounded"
                              aria-label="Next month"
                            >
                              ›
                            </button>
                          </div>
                          <div className="text-xs text-gray-500 mb-2">
                            {pendingDateObj
                              ? pendingDateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                              : 'Select a date'}
                          </div>
                          <div className="grid grid-cols-7 gap-1 text-xs text-gray-500 mb-1">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                              <div key={day} className="text-center">{day}</div>
                            ))}
                          </div>
                          <div className="grid grid-cols-7 gap-1 text-sm">
                            {calendarDays.map(day => {
                              const isCurrentMonth = day.getMonth() === datePickerMonth.getMonth();
                              const isPending = pendingDateObj ? areSameDay(day, pendingDateObj) : false;
                              const isApplied = !isPending && appliedDateObj ? areSameDay(day, appliedDateObj) : false;
                              const isToday = areSameDay(day, today);
                              
                              let buttonClasses = 'h-9 w-full rounded-md flex items-center justify-center transition ';
                              if (!isCurrentMonth) {
                                buttonClasses += 'text-gray-300 hover:text-gray-500';
                              } else if (isPending) {
                                buttonClasses += 'bg-blue-600 text-white hover:bg-blue-700';
                              } else if (isApplied) {
                                buttonClasses += 'bg-blue-100 text-blue-700 hover:bg-blue-200';
                              } else if (isToday) {
                                buttonClasses += 'border border-blue-500 text-blue-600 hover:bg-blue-50';
                              } else {
                                buttonClasses += 'text-gray-700 hover:bg-gray-100';
                              }

                              return (
                                <button
                                  key={day.toISOString()}
                                  type="button"
                                  onClick={() => handleDatePickerSelect(new Date(day))}
                                  className={buttonClasses}
                                >
                                  {day.getDate()}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
                
                {/* Project Autocomplete */}
                {showProjectAutocomplete && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                    {(() => {
                      const filteredProjects = getFilteredProjects();
                      return (
                        <>
                          {filteredProjects.length > 0 && (
                            <div className="py-1">
                              <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase">Select Project</div>
                              {filteredProjects.map((project, index) => (
                                <button
                                  key={project.id}
                                  onClick={() => applyProjectTag(project)}
                                  className={`w-full text-left px-3 py-2 flex items-center gap-2 ${
                                    index === selectedAutocompleteIndex 
                                      ? 'bg-blue-100 text-blue-900' 
                                      : 'hover:bg-blue-50'
                                  }`}
                                >
                                  <Folder size={14} className="text-gray-400" />
                                  <span>{project.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="border-t border-gray-200">
                            <button
                              onClick={() => {
                                const projectNameMatch = quickEntry.match(/\/p\s+(.+?)$/i);
                                if (projectNameMatch && projectNameMatch[1].trim()) {
                                  createAndApplyNewProject(projectNameMatch[1].trim());
                                } else {
                                  setShowProjectModal(true);
                                  setShowProjectAutocomplete(false);
                                }
                              }}
                              className={`w-full text-left px-3 py-2 flex items-center gap-2 text-blue-600 ${
                                selectedAutocompleteIndex === filteredProjects.length 
                                  ? 'bg-blue-100' 
                                  : 'hover:bg-blue-50'
                              }`}
                            >
                              <Plus size={14} />
                              <span>
                                {(() => {
                                  const match = quickEntry.match(/\/p\s+(.+?)$/i);
                                  const projectName = match && match[1].trim();
                                  return projectName 
                                    ? `Create "${projectName}"` 
                                    : 'Create new project';
                                })()}
                              </span>
                            </button>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
              <button
                onClick={handleQuickAdd}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <Plus size={20} /> Add
              </button>
            </div>
            
            {/* Tag Bubbles */}
            <div className="mt-2">
              {/* Help Text - Always visible */}
              <div className="text-xs text-gray-500 mb-2">
                Tags: <span className="font-mono bg-gray-100 px-1 rounded">/a</span> action, 
                <span className="font-mono bg-gray-100 px-1 rounded ml-1">/n</span> note, 
                <span className="font-mono bg-gray-100 px-1 rounded ml-1">/u</span> urgent, 
                <span className="font-mono bg-gray-100 px-1 rounded ml-1">/d 3</span> due in 3 days, 
                <span className="font-mono bg-gray-100 px-1 rounded ml-1">/d 2024-12-31</span> due on date, 
                <span className="font-mono bg-gray-100 px-1 rounded ml-1">/p</span> project
              </div>
              
              {/* Applied Tags Bubbles */}
              {(appliedTags.type !== 'note' || appliedTags.isUrgent || appliedTags.dueDate || (appliedTags.projectIds && appliedTags.projectIds.length > 0)) && (
                <div className="flex flex-wrap gap-2 items-center">
                  {/* Type Tag */}
                  {appliedTags.type !== 'note' && (
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                      <span className="font-medium">
                        {appliedTags.type === 'to_do' ? 'To Do' : toTitleCase(appliedTags.type)}
                      </span>
                      <button
                        onClick={() => removeTag('type')}
                        className="hover:bg-blue-200 rounded-full p-0.5"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  
                  {/* Urgent Tag */}
                  {appliedTags.isUrgent && (
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                      <AlertCircle size={12} />
                      <span className="font-medium">Urgent</span>
                      <button
                        onClick={() => removeTag('urgent')}
                        className="hover:bg-red-200 rounded-full p-0.5"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  
                  {/* Due Date Tag */}
                  {appliedTags.dueDate && (
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                      <Calendar size={12} />
                      <span className="font-medium">Due: {formatDateShort(appliedTags.dueDate)}</span>
                      <button
                        onClick={() => removeTag('dueDate')}
                        className="hover:bg-purple-200 rounded-full p-0.5"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  
                  {/* Project Tag */}
                  {appliedTags.projectIds && appliedTags.projectIds.map(projectId => {
                    const project = data.projects.find(p => p.id === projectId);
                    if (!project) return null;
                    return (
                      <div key={projectId} className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                        <Folder size={12} />
                        <span className="font-medium">{project.name}</span>
                        <button
                          onClick={() => removeTag('project', projectId)}
                          className="hover:bg-green-200 rounded-full p-0.5"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          
          {/* Action Bar */}
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={() => setShowProjectModal(true)}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
            >
              <Folder size={16} /> New Project
            </button>
            <button
              onClick={() => setShowSessionModal(true)}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
            >
              <Play size={16} /> Start Session
            </button>
            <button
              onClick={() => {
                setEditingNote(null);
                setShowNoteModal(true);
              }}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
            >
              <Plus size={16} /> New Item
            </button>
            <button
              onClick={() => setShowColumnMenu(true)}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              Columns
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="none">No Grouping</option>
              <option value="project">Group by Project</option>
              <option value="type">Group by Type</option>
              <option value="session">Group by Session</option>
              <option value="due_date">Group by Due Date</option>
            </select>
            
            {data.projects.length > 0 && (
              <select
                value={selectedProject || ''}
                onChange={(e) => setSelectedProject(e.target.value || null)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Projects</option>
                {data.projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}

          </div>

          {selectedCount > 0 && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium text-blue-900">{selectedCount} selected</span>
              <select
                value=""
                onChange={(e) => {
                  const { value } = e.target;
                  if (!value) return;
                  handleBulkStatusChange(value);
                }}
                className="px-2 py-1 border border-blue-200 rounded"
              >
                <option value="">Set Status…</option>
                {STATUS_ORDER.map(statusId => (
                  <option key={statusId} value={statusId}>{STATUS_LABELS[statusId]}</option>
                ))}
              </select>
              <select
                value=""
                onChange={(e) => {
                  const { value } = e.target;
                  if (!value) return;
                  handleBulkTypeChange(value);
                }}
                className="px-2 py-1 border border-blue-200 rounded"
              >
                <option value="">Set Type…</option>
                {data.noteTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
              <select
                value=""
                onChange={(e) => {
                  const { value } = e.target;
                  if (!value) return;
                  handleBulkProjectAdd(value);
                }}
                className="px-2 py-1 border border-blue-200 rounded"
              >
                <option value="">Add Project…</option>
                {data.projects.map(project => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
              <select
                value=""
                onChange={(e) => {
                  const { value } = e.target;
                  if (!value) return;
                  handleBulkProjectRemove(value);
                }}
                className="px-2 py-1 border border-blue-200 rounded"
              >
                <option value="">Remove Project…</option>
                <option value="__ALL__">Remove All</option>
                {data.projects.map(project => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
              <select
                value=""
                onChange={(e) => {
                  const { value } = e.target;
                  handleBulkSessionChange(value);
                }}
                className="px-2 py-1 border border-blue-200 rounded"
              >
                <option value="">Set Session…</option>
                <option value="__NONE__">No Session</option>
                {data.sessions.map(session => (
                  <option key={session.id} value={session.id}>{session.title}</option>
                ))}
              </select>
              <select
                value=""
                onChange={(e) => {
                  const { value } = e.target;
                  if (!value) return;
                  handleBulkUrgentChange(value);
                }}
                className="px-2 py-1 border border-blue-200 rounded"
              >
                <option value="">Urgent…</option>
                <option value="yes">Mark Urgent</option>
                <option value="no">Mark Not Urgent</option>
              </select>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="px-3 py-1.5 border border-blue-200 text-blue-700 hover:bg-blue-100 rounded"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      </header>
      
      {/* Main Content */}
      <main className="mx-auto w-[90%] py-6">
        {Object.entries(groupedNotes).map(([groupName, notes]) => (
          notes.length > 0 && (
            <div key={groupName} className="mb-6">
              {groupBy !== 'none' && (
                <h2 className="text-lg font-semibold text-gray-700 mb-3">{groupName}</h2>
              )}
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="overflow-x-auto">
                  <div style={{ minWidth: `${gridMinWidth}px` }}>
                    <div
                      className="grid items-center gap-3 px-3 py-2 border-b border-gray-200 bg-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-600 select-none rounded-t-lg"
                      style={{ gridTemplateColumns }}
                    >
                      <div className="flex items-center justify-center">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          className="h-4 w-4"
                          checked={allVisibleSelected && visibleNoteIds.length > 0}
                          disabled={visibleNoteIds.length === 0}
                          onChange={toggleSelectAllVisible}
                        />
                      </div>
                      <div className="flex items-center gap-2 bg-gray-100 px-2 py-1 rounded-md">
                        <span>Item</span>
                        <span
                          className="ml-auto h-4 w-2 cursor-col-resize rounded-full bg-gray-300 hover:bg-gray-500"
                          onMouseDown={(event) => handleColumnResizeMouseDown(event, '__item__')}
                          role="separator"
                        />
                      </div>
                      {visibleColumns.map(column => {
                        const draggable = !column.alwaysVisible || column.id !== 'actions';
                        const isSorted = sortConfig.columnId === column.id;
                        return (
                          <div
                            key={`header-${column.id}`}
                            className={`flex items-center gap-2 truncate bg-gray-100 px-2 py-1 rounded-md ${draggable ? 'cursor-move' : ''}`}
                            draggable={draggable}
                            onDragStart={(event) => draggable && handleColumnDragStart(event, column.id)}
                            onDragOver={(event) => handleColumnDragOver(event, column.id)}
                            onDrop={(event) => handleColumnDrop(event, column.id)}
                            onDragEnd={handleColumnDragEnd}
                          >
                            <div className="flex flex-col gap-1 w-full">
                              <button
                                type="button"
                                onClick={() => handleSort(column.id)}
                                className={`flex items-center gap-1 text-left text-gray-700 bg-transparent ${column.id === 'actions' ? 'cursor-default' : ''}`}
                                disabled={column.id === 'actions'}
                              >
                                <span>{column.label}</span>
                                {column.id !== 'actions' && (
                                  <span className="text-gray-400">
                                    {isSorted ? (sortConfig.direction === 'asc' ? '↑' : '↓') : <ArrowUpDown size={14} />}
                                  </span>
                                )}
                              </button>
                              {column.filterable && column.id !== 'actions' && (
                                <select
                                  value={columnFilters[column.id] || ''}
                                  onChange={(event) => handleColumnFilterChange(column.id, event.target.value)}
                                  className="text-xs border border-gray-200 rounded px-1 py-0.5 text-gray-600 focus:outline-none"
                                >
                                  <option value="">All</option>
                                  {renderColumnFilterOptions(column.id)}
                                </select>
                              )}
                            </div>
                            <span
                              className="ml-auto h-4 w-2 cursor-col-resize rounded-full bg-gray-300 hover:bg-gray-500"
                              onMouseDown={(event) => handleColumnResizeMouseDown(event, column.id)}
                              role="separator"
                            />
                          </div>
                        );
                      })}
                    </div>
                    {notes
                      .flatMap(note => buildNoteRows(note, 0, visibleNotes, matchingNotes))
                      .map(row => renderRow(row, gridTemplateColumns, visibleColumns))}
                  </div>
                </div>
              </div>
            </div>
          )
        ))}
        
        {topLevelNotes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No items yet. Add your first note above!</p>
          </div>
        )}
      </main>

      {showColumnMenu && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-30 flex items-center justify-center p-4"
          onClick={() => setShowColumnMenu(false)}
        >
          <div
            className="bg-white rounded-lg shadow-2xl w-full max-w-md p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Choose Columns</h3>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setShowColumnMenu(false)}
                aria-label="Close column menu"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {COLUMN_DEFS.map(column => (
                <label key={column.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={isColumnVisible(column)}
                    disabled={column.alwaysVisible}
                    onChange={() => toggleColumnVisibility(column.id)}
                  />
                  <span className={column.alwaysVisible ? 'text-gray-400' : ''}>{column.label}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowColumnMenu(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modals */}
      {showProjectModal && (
        <ProjectModal
          onClose={() => setShowProjectModal(false)}
          onSave={addProject}
        />
      )}
      
      {showSessionModal && (
        <SessionModal
          projects={data.projects}
          people={data.people}
          onClose={() => setShowSessionModal(false)}
          onSave={startSession}
          onAddPerson={(name) => {
            const newPerson = {
              id: generateId(),
              name,
              email: '',
              phone: '',
              createdAt: Date.now()
            };
            setData(prev => ({
              ...prev,
              people: [...prev.people, newPerson]
            }));
            return newPerson.id;
          }}
        />
      )}
      
      {showNoteModal && (
        <NoteModal
          note={editingNote}
          projects={data.projects}
          noteTypes={data.noteTypes}
          selectedProject={selectedProject}
          onClose={() => {
            setShowNoteModal(false);
            setEditingNote(null);
          }}
          onSave={saveNote}
          onDelete={handleDeleteFromModal}
        />
      )}
    </div>
  );
}

// Thread Input Component
function ThreadInput({ noteId, onAdd, parseTags: parseTagsFn }) {
  const [value, setValue] = useState('');
  const [tagState, setTagState] = useState({ type: 'note', isUrgent: false, isComment: false });
  const [pendingDueDate, setPendingDueDate] = useState(null);
  const [selectedDueDate, setSelectedDueDate] = useState(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(() => startOfMonth(new Date()));
  const containerRef = useRef(null);
  const datePickerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!datePickerVisible) return;
    const handleClickOutside = (event) => {
      if (datePickerRef.current && datePickerRef.current.contains(event.target)) return;
      if (containerRef.current && containerRef.current.contains(event.target)) return;
      setDatePickerVisible(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [datePickerVisible]);

  useEffect(() => {
    if (pendingDueDate) {
      setDatePickerMonth(startOfMonth(new Date(pendingDueDate)));
    }
  }, [pendingDueDate]);

  const updateDuePreview = (text) => {
    const absoluteMatch = text.match(/\/d\s+(\d{4}-\d{2}-\d{2})(?=\s|$|\/)/i);
    if (absoluteMatch) {
      const parsed = Date.parse(`${absoluteMatch[1]}T00:00:00`);
      if (!Number.isNaN(parsed)) {
        setPendingDueDate(parsed);
        setSelectedDueDate(null);
        setDatePickerVisible(true);
        return;
      }
    }

    const relativeMatch = text.match(/\/d\s+(\d{1,2})(?:\s*(?:days?)?)?(?=\s|$|\/)/i);
    if (relativeMatch) {
      const days = parseInt(relativeMatch[1], 10);
      if (!Number.isNaN(days)) {
        const base = new Date();
        base.setHours(0, 0, 0, 0);
        base.setDate(base.getDate() + days);
        setPendingDueDate(base.getTime());
        setSelectedDueDate(null);
        setDatePickerVisible(true);
        return;
      }
    }

    if (/\/d\b/i.test(text)) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setPendingDueDate(today.getTime());
      setSelectedDueDate(null);
      setDatePickerVisible(true);
      return;
    }

    if (selectedDueDate) {
      setPendingDueDate(selectedDueDate);
    } else {
      setPendingDueDate(null);
      setDatePickerVisible(false);
    }
  };

  const handleChange = (rawValue) => {
    let working = rawValue;
    const nextTags = { ...tagState };
    let mutated = false;

    if (/\/a(?:\s|$|\/)/i.test(working)) {
      nextTags.type = 'to_do';
      working = working.replace(/\/a(?=\s|$|\/)/gi, '').trim();
      mutated = true;
    }

    if (/\/n(?:\s|$|\/)/i.test(working)) {
      nextTags.type = 'note';
      working = working.replace(/\/n(?=\s|$|\/)/gi, '').trim();
      mutated = true;
    }

    if (/\/u(?:\s|$|\/)/i.test(working)) {
      nextTags.isUrgent = true;
      working = working.replace(/\/u(?=\s|$|\/)/gi, '').trim();
      mutated = true;
    }

    if (/\/c(?:\s|$|\/)/i.test(working)) {
      nextTags.isComment = true;
      working = working.replace(/\/c(?=\s|$|\/)/gi, '').trim();
      mutated = true;
    }

    const nextValue = mutated ? working.replace(/\s+/g, ' ').trim() : rawValue;
    setValue(nextValue);
    setTagState(nextTags);
    updateDuePreview(nextValue);
  };

  const handleSelectDate = (dateObj) => {
    const timestamp = dateObj.getTime();
    setSelectedDueDate(timestamp);
    setPendingDueDate(timestamp);
    setDatePickerVisible(false);
    setValue(prev => removeDueDateTag(prev));
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const clearTag = (type) => {
    if (type === 'dueDate') {
      setSelectedDueDate(null);
      setPendingDueDate(null);
      setDatePickerVisible(false);
      setValue(prev => removeDueDateTag(prev));
      return;
    }
    setTagState(prev => {
      const next = { ...prev };
      if (type === 'type') {
        next.type = 'note';
      } else if (type === 'urgent') {
        next.isUrgent = false;
      } else if (type === 'comment') {
        next.isComment = false;
      }
      return next;
    });
  };

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const parsed = parseTagsFn
      ? parseTagsFn(value)
      : {
          content: value,
          type: 'note',
          isUrgent: false,
          isComment: false,
          dueDate: null
        };
    const content = parsed.content || trimmed;
    const finalType = tagState.type !== 'note' ? tagState.type : parsed.type || 'note';
    const finalUrgent = tagState.isUrgent || parsed.isUrgent;
    const finalIsComment = tagState.isComment || parsed.isComment;
    const finalDueDate = selectedDueDate ?? pendingDueDate ?? parsed.dueDate ?? null;
    const payload = {
      content,
      type: finalType,
      isUrgent: finalUrgent,
      isComment: finalIsComment,
      dueDate: finalDueDate
    };
    if (typeof onAdd === 'function') {
      onAdd(noteId, payload);
    }
    setValue('');
    setTagState({ type: 'note', isUrgent: false, isComment: false });
    setPendingDueDate(null);
    setSelectedDueDate(null);
    setDatePickerVisible(false);
    setDatePickerMonth(startOfMonth(new Date()));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const pendingDateObj = pendingDueDate ? new Date(pendingDueDate) : null;
  const selectedDateObj = selectedDueDate ? new Date(selectedDueDate) : null;
  const calendarDays = getCalendarDays(datePickerMonth);
  const monthLabel = datePickerMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isAddDisabled = value.trim().length === 0;
  const activeDueDate = selectedDueDate ?? null;
  const activeDueDateObj = activeDueDate ? new Date(activeDueDate) : null;
  const showTags = tagState.type !== 'note' || tagState.isUrgent || tagState.isComment || !!activeDueDateObj;

  return (
    <div className="relative flex flex-col gap-2 w-full" ref={containerRef}>
      <div className="relative grid w-full gap-2 grid-cols-[minmax(0,1fr)_auto] items-center">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add sub-item…"
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isAddDisabled}
          className={`px-3 py-1.5 rounded text-sm font-medium ${
            isAddDisabled ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          Add
        </button>

        {datePickerVisible && (
          <div
            ref={datePickerRef}
            className="absolute top-full right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => setDatePickerMonth(prev => addMonths(prev, -1))}
                className="p-1 text-gray-500 hover:text-gray-700 rounded"
                aria-label="Previous month"
              >
                ‹
              </button>
              <span className="text-sm font-semibold text-gray-800">{monthLabel}</span>
              <button
                type="button"
                onClick={() => setDatePickerMonth(prev => addMonths(prev, 1))}
                className="p-1 text-gray-500 hover:text-gray-700 rounded"
                aria-label="Next month"
              >
                ›
              </button>
            </div>
            <div className="text-xs text-gray-500 mb-2">
              {pendingDateObj
                ? pendingDateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                : 'Select a date'}
            </div>
            <div className="grid grid-cols-7 gap-1 text-xs text-gray-500 mb-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 text-sm">
              {calendarDays.map(day => {
                const isCurrentMonth = day.getMonth() === datePickerMonth.getMonth();
                const isPending = pendingDateObj ? areSameDay(day, pendingDateObj) : false;
                const isSelected = !isPending && selectedDateObj ? areSameDay(day, selectedDateObj) : false;
                const isToday = areSameDay(day, today);
                
                let buttonClasses = 'h-8 w-full rounded-md flex items-center justify-center transition ';
                if (!isCurrentMonth) {
                  buttonClasses += 'text-gray-300 hover:text-gray-500';
                } else if (isPending) {
                  buttonClasses += 'bg-blue-600 text-white hover:bg-blue-700';
                } else if (isSelected) {
                  buttonClasses += 'bg-blue-100 text-blue-700 hover:bg-blue-200';
                } else if (isToday) {
                  buttonClasses += 'border border-blue-500 text-blue-600 hover:bg-blue-50';
                } else {
                  buttonClasses += 'text-gray-700 hover:bg-gray-100';
                }

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => handleSelectDate(new Date(day))}
                    className={buttonClasses}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="text-[11px] text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium text-gray-500">Tags:</span>
        <span className="inline-flex items-center gap-1">
          <span className="font-mono bg-gray-100 px-1 rounded">/a</span>
          <span>action</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="font-mono bg-gray-100 px-1 rounded">/n</span>
          <span>note</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="font-mono bg-gray-100 px-1 rounded">/u</span>
          <span>urgent</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="font-mono bg-gray-100 px-1 rounded">/d 3</span>
          <span>due in 3 days</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="font-mono bg-gray-100 px-1 rounded">/d 2024-12-31</span>
          <span>due on date</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="font-mono bg-gray-100 px-1 rounded">/c</span>
          <span>comment</span>
        </span>
      </div>

      {showTags && (
        <div className="flex flex-wrap gap-2 text-xs">
          {tagState.type !== 'note' && (
            <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
              <span className="font-medium">{tagState.type === 'to_do' ? 'To Do' : toTitleCase(tagState.type)}</span>
              <button
                type="button"
                onClick={() => clearTag('type')}
                className="hover:bg-blue-200 rounded-full p-0.5"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {tagState.isUrgent && (
            <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full">
              <AlertCircle size={12} />
              <span className="font-medium">Urgent</span>
              <button
                type="button"
                onClick={() => clearTag('urgent')}
                className="hover:bg-red-200 rounded-full p-0.5"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {tagState.isComment && (
            <div className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 text-gray-700 rounded-full">
              <MessageSquare size={12} />
              <span className="font-medium">Comment</span>
              <button
                type="button"
                onClick={() => clearTag('comment')}
                className="hover:bg-gray-300 rounded-full p-0.5"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {activeDueDateObj && (
            <div className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
              <Calendar size={12} />
              <span className="font-medium">Due: {formatDateShort(activeDueDate)}</span>
              <button
                type="button"
                onClick={() => clearTag('dueDate')}
                className="hover:bg-purple-200 rounded-full p-0.5"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Project Modal
function ProjectModal({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [details, setDetails] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name, details);
      onClose();
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">New Project</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Details</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Session Modal
function SessionModal({ projects, people, onClose, onSave, onAddPerson }) {
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('meeting');
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [newPersonName, setNewPersonName] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (projectId && title.trim()) {
      onSave(projectId, title, type, selectedPeople);
      onClose();
    }
  };
  
  const handleAddPerson = () => {
    if (newPersonName.trim()) {
      const id = onAddPerson(newPersonName);
      setSelectedPeople([...selectedPeople, id]);
      setNewPersonName('');
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Start Session</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select a project...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="meeting">Meeting</option>
              <option value="phone_call">Phone Call</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Participants</label>
            <div className="space-y-2">
              {people.map(person => (
                <label key={person.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedPeople.includes(person.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPeople([...selectedPeople, person.id]);
                      } else {
                        setSelectedPeople(selectedPeople.filter(id => id !== person.id));
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">{person.name}</span>
                </label>
              ))}
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  placeholder="Add new person..."
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddPerson}
                  className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg">
              Start Session
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Note Modal
function NoteModal({ note, projects, noteTypes, selectedProject, onClose, onSave, onDelete }) {
  const availableNoteTypes = noteTypes.filter(t => t.id !== 'deliverable');
  const fallbackType = note?.type && availableNoteTypes.some(t => t.id === note.type)
    ? note.type
    : 'note';
  const [content, setContent] = useState(note?.content || '');
  const [type, setType] = useState(fallbackType);
  const initialProjectIds = note?.projectIds
    ? note.projectIds
    : note?.projectId
      ? [note.projectId]
      : selectedProject
        ? [selectedProject]
        : [];
  const [projectIds, setProjectIds] = useState(initialProjectIds);
  const [dueDate, setDueDate] = useState(note?.dueDate ? new Date(note.dueDate).toISOString().slice(0, 16) : '');
  const [status, setStatus] = useState(normalizeStatus(note?.status));
  const [isUrgent, setIsUrgent] = useState(note?.isUrgent || false);
  
  /* AI Analysis - Commented out for now
  const handleAnalyze = async () => {
    if (!content.trim()) return;
    
    const analysis = await analyzeWithAI(content);
    if (analysis) {
      setContent(analysis.content);
      setType(analysis.type);
      setIsUrgent(analysis.isUrgent);
      if (analysis.dueDate) {
        setDueDate(new Date(analysis.dueDate).toISOString().slice(0, 16));
      }
      if (analysis.type === 'to_do') {
        setStatus('not_started');
      }
    }
  };
  */
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (content.trim()) {
      onSave({
        ...(note || {}),
        content,
        type,
        projectIds,
        dueDate: dueDate ? new Date(dueDate).getTime() : null,
        status: normalizeStatus(status),
        isUrgent
      });
      onClose();
    }
  };
  
  const showDueDate = type === 'to_do' || !!dueDate;
  const showStatus = true;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{note?.id ? 'Edit Item' : 'New Item'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableNoteTypes.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          {!note?.parentId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Projects</label>
              <div className="flex flex-wrap gap-2 items-center">
                {projects.map(project => {
                  const checked = projectIds.includes(project.id);
                  return (
                    <label key={project.id} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${checked ? 'bg-green-100 border-green-300 text-green-700' : 'bg-gray-100 border-gray-200 text-gray-600'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setProjectIds(prev => {
                            const set = new Set(prev);
                            if (e.target.checked) {
                              set.add(project.id);
                            } else {
                              set.delete(project.id);
                            }
                            return Array.from(set);
                          });
                        }}
                      />
                      <span>{project.name}</span>
                    </label>
                  );
                })}
                {projects.length === 0 && (
                  <span className="text-gray-500 text-xs">No projects yet</span>
                )}
              </div>
            </div>
          )}
          {showDueDate && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          {showStatus && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_ORDER.map(option => (
                  <option key={option} value={option}>{STATUS_LABELS[option]}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isUrgent}
                onChange={(e) => setIsUrgent(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700">Mark as Urgent</span>
            </label>
          </div>
          <div className="flex flex-wrap gap-2 items-center justify-between">
            {note?.id ? (
              <button
                type="button"
                onClick={() => onDelete?.(note.id)}
                className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
              >
                Delete
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                {note?.id ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
