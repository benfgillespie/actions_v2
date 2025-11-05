"use client";
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Plus, Folder, Calendar, Clock, AlertCircle, MessageSquare, ChevronDown, ChevronRight, X, Edit2, Trash2, Play, Square, ArrowUpDown, GripVertical, Search, RotateCcw } from 'lucide-react';

// Utility functions
const generateId = () => Math.random().toString(36).substr(2, 9);
const cloneDeep = (value) =>
  typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
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
  actions: 96
};

const COLUMN_DEFAULT_WIDTHS = {
  type: 140,
  project: 170,
  session: 170,
  dueDate: 140,
  urgent: 120,
  status: 150,
  createdAt: 140,
  actions: 120
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

const AUTOSAVE_STORAGE_KEY = 'taskTrackerAutosaves';
const AUTOSAVE_INTERVAL_MS = 15 * 60 * 1000;
const AUTOSAVE_MAX_COUNT = 10;

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
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingDueDate, setPendingDueDate] = useState(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return startOfMonth(today);
  });
  const quickEntryRef = useRef(null);
  const quickEntryInputRef = useRef(null);
  const datePickerRef = useRef(null);
  const selectAllRef = useRef(null);
  const searchInputRef = useRef(null);
  const projectPickerRef = useRef(null);
  const projectPickerInputRef = useRef(null);
  const hasInitializedRef = useRef(false);
  const lastSavedSnapshotRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const saveAbortControllerRef = useRef(null);
  const columnDragIdRef = useRef(null);
  const columnResizeStateRef = useRef(null);
  const [projectPickerState, setProjectPickerState] = useState({ noteId: null, query: '' });
  const [lastUndo, setLastUndo] = useState(null);
  const [autosaves, setAutosaves] = useState([]);
  const [autosaveReady, setAutosaveReady] = useState(false);
  const [showAutosaveMenu, setShowAutosaveMenu] = useState(false);
  const [sessionDetailsTarget, setSessionDetailsTarget] = useState(null);
  const autosaveMenuRef = useRef(null);
  const autosaveButtonRef = useRef(null);
  const autosaveTimerRef = useRef(null);
  const dataRef = useRef(data);
  const selectedIdsRef = useRef(selectedNoteIds);

  const projectsById = useMemo(() => {
    const map = new Map();
    data.projects.forEach(project => {
      if (project?.id) {
        map.set(project.id, project);
      }
    });
    return map;
  }, [data.projects]);

  const projectsByNameLower = useMemo(() => {
    const map = new Map();
    data.projects.forEach(project => {
      if (project?.name) {
        map.set(project.name.toLowerCase(), project);
      }
    });
    return map;
  }, [data.projects]);

  const sessionsById = useMemo(() => {
    const map = new Map();
    data.sessions.forEach(session => {
      if (session?.id) {
        map.set(session.id, session);
      }
    });
    return map;
  }, [data.sessions]);

  const noteTypesById = useMemo(() => {
    const map = new Map();
    data.noteTypes.forEach(type => {
      if (type?.id) {
        map.set(type.id, type);
      }
    });
    return map;
  }, [data.noteTypes]);

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
    const projectsMap = new Map();
    const sanitizedProjects = Array.isArray(raw.projects)
      ? raw.projects.filter(Boolean).map(project => {
          const safe = { ...project };
          if (!safe.id) safe.id = generateId();
          projectsMap.set(safe.id, safe);
          return safe;
        })
      : [];
    const sessionsMap = new Map();
    const sanitizedSessions = Array.isArray(raw.sessions)
      ? raw.sessions.filter(Boolean).map(session => {
          const safe = { ...session };
          if (!safe.id) safe.id = generateId();
          sessionsMap.set(safe.id, safe);
          return safe;
        })
      : [];
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
              ? transformed.projectIds.filter(id => id && projectsMap.has(id))
              : [];
            if (transformed.projectId) {
              projectIds.push(transformed.projectId);
            }
            transformed.projectIds = Array.from(new Set(projectIds));
            delete transformed.projectId;
            if (transformed.sessionId && !sessionsMap.has(transformed.sessionId)) {
              transformed.sessionId = null;
            }
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
      projects: sanitizedProjects,
      sessions: sanitizedSessions,
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
      setAutosaveReady(true);
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
          setAutosaveReady(true);
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
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    selectedIdsRef.current = selectedNoteIds;
  }, [selectedNoteIds]);

  useEffect(() => {
    if (!sessionDetailsTarget) return;
    const exists = data.notes.some(note => note.id === sessionDetailsTarget.noteId);
    if (!exists) {
      setSessionDetailsTarget(null);
    }
  }, [sessionDetailsTarget, data.notes]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(AUTOSAVE_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setAutosaves(parsed.slice(0, AUTOSAVE_MAX_COUNT));
          }
        }
    } catch (error) {
      console.error('Failed to load autosaves', error);
    }
  }, []);

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
          .map(id => projectsById.get(id)?.name || '')
          .filter(Boolean)
          .sort();
        return projectNames[0] || '';
      }
      case 'session': {
        const session = sessionsById.get(note.sessionId);
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
            const project = projectsByNameLower.get(value.toLowerCase());
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

  const searchCriteria = useMemo(() => {
    const raw = searchQuery.trim();
    if (!raw) return null;

    const criteria = {
      textTokens: [],
      type: null,
      status: null,
      isUrgent: null,
      projectIds: [],
      sessionIds: [],
      requireDue: false,
      requireNoDue: false,
      dueRange: null
    };

    const tagPattern = /\/([a-z])(?:\s+([^\/]+?))?(?=\s*\/|$)/gi;
    let working = raw;
    const matches = [...raw.matchAll(tagPattern)];
    const dayMs = 24 * 60 * 60 * 1000;

    matches.forEach(match => {
      const tag = match[1].toLowerCase();
      const value = match[2]?.trim();
      let strip = true;

      switch (tag) {
        case 'a':
          criteria.type = 'to_do';
          break;
        case 'n':
          criteria.type = 'note';
          break;
        case 'u':
          criteria.isUrgent = true;
          break;
        case 'p': {
          if (value) {
            const valueLower = value.toLowerCase();
            const matchedProjects = Array.from(projectsById.values()).filter(project =>
              (project.name || '').toLowerCase().includes(valueLower)
            );
            if (matchedProjects.length > 0) {
              matchedProjects.forEach(project => {
                if (!criteria.projectIds.includes(project.id)) {
                  criteria.projectIds.push(project.id);
                }
              });
            } else {
              strip = false;
            }
          } else {
            strip = false;
          }
          break;
        }
        case 's': {
          if (value) {
            const valueLower = value.toLowerCase();
            const matchedSessions = Array.from(sessionsById.values()).filter(session =>
              (session.title || '').toLowerCase().includes(valueLower)
            );
            if (matchedSessions.length > 0) {
              matchedSessions.forEach(session => {
                if (!criteria.sessionIds.includes(session.id)) {
                  criteria.sessionIds.push(session.id);
                }
              });
            } else {
              strip = false;
            }
          } else {
            strip = false;
          }
          break;
        }
        case 't': {
          if (value) {
            const valueLower = value.toLowerCase();
            const matchedStatus = STATUS_ORDER.find(statusId => {
              const label = STATUS_LABELS[statusId]?.toLowerCase() ?? statusId;
              return label.includes(valueLower);
            });
            if (matchedStatus) {
              criteria.status = matchedStatus;
            } else {
              strip = false;
            }
          } else {
            strip = false;
          }
          break;
        }
        case 'd': {
          if (value) {
            if (value.toLowerCase() === 'none') {
              criteria.requireNoDue = true;
              criteria.requireDue = false;
            } else {
              const daysMatch = value.match(/^(\d+)\s*(?:days?)?$/i);
              if (daysMatch) {
                const days = parseInt(daysMatch[1], 10);
                if (!Number.isNaN(days)) {
                  const base = new Date();
                  base.setHours(0, 0, 0, 0);
                  base.setDate(base.getDate() + days);
                  criteria.requireDue = true;
                  criteria.requireNoDue = false;
                  const start = base.getTime();
                  criteria.dueRange = { start, end: start + dayMs };
                } else {
                  strip = false;
                }
              } else {
                const parsed = Date.parse(`${value}T00:00:00`);
                if (!Number.isNaN(parsed)) {
                  criteria.requireDue = true;
                  criteria.requireNoDue = false;
                  criteria.dueRange = { start: parsed, end: parsed + dayMs };
                } else {
                  strip = false;
                }
              }
            }
          } else {
            criteria.requireDue = true;
            criteria.requireNoDue = false;
          }
          break;
        }
        default:
          strip = false;
      }

      if (strip) {
        working = working.replace(match[0], ' ');
      }
    });

    const tokens = working
      .split(/\s+/)
      .map(token => token.toLowerCase())
      .filter(Boolean);

    criteria.textTokens = tokens;

    const hasConstraints =
      tokens.length > 0 ||
      criteria.type !== null ||
      criteria.status !== null ||
      criteria.isUrgent !== null ||
      criteria.projectIds.length > 0 ||
      criteria.sessionIds.length > 0 ||
      criteria.requireDue ||
      criteria.requireNoDue;

    if (!hasConstraints) {
      return null;
    }

    return criteria;
  }, [searchQuery, projectsById, sessionsById]);

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
          const nextSessionId = noteData.sessionId !== undefined
            ? (noteData.sessionId || null)
            : (activeSession?.id || n.sessionId || null);
          return {
            ...n,
            ...noteData,
            projectIds: sanitizedProjectIds,
            status: baseStatus,
            sessionId: nextSessionId,
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
        sessionId: noteData.sessionId !== undefined
          ? (noteData.sessionId || null)
          : (activeSession?.id || null),
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

  const openProjectPicker = (noteId) => {
    setProjectPickerState({ noteId, query: '' });
  };

  const closeProjectPicker = () => {
    setProjectPickerState({ noteId: null, query: '' });
  };

  const updateProjectPickerQuery = (value) => {
    setProjectPickerState(prev => ({
      ...prev,
      query: value
    }));
  };

  const createAndAssignProjectToNote = (noteId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setData(prev => {
      const lower = trimmed.toLowerCase();
      let project = prev.projects.find(p => (p.name || '').toLowerCase() === lower);
      let nextProjects = prev.projects;
      if (!project) {
        project = {
          id: generateId(),
          name: trimmed,
          details: '',
          customProperties: {},
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        nextProjects = [...prev.projects, project];
      }
      return {
        ...prev,
        projects: nextProjects,
        notes: prev.notes.map(note => {
          if (note.id !== noteId) return note;
          const currentIds = Array.isArray(note.projectIds)
            ? [...note.projectIds]
            : note.projectId
              ? [note.projectId]
              : [];
          if (!currentIds.includes(project.id)) {
            currentIds.push(project.id);
          }
          return {
            ...note,
            projectIds: currentIds,
            updatedAt: Date.now()
          };
        })
      };
    });
  };

  const assignExistingProjectToNote = (noteId, projectId) => {
    addProjectToNote(noteId, projectId);
    closeProjectPicker();
  };

  const createProjectForNote = (noteId, name) => {
    createAndAssignProjectToNote(noteId, name);
    closeProjectPicker();
  };

  const toggleGroupCollapse = useCallback((groupName) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  }, []);

  const removeNotesAndComments = (rootIds, sourceNotes, sourceComments) => {
    const childrenByParent = new Map();
    sourceNotes.forEach(note => {
      const parentId = note.parentId || null;
      if (!childrenByParent.has(parentId)) {
        childrenByParent.set(parentId, []);
      }
      childrenByParent.get(parentId).push(note.id);
    });

    const toRemove = new Set();
    const stack = Array.isArray(rootIds) ? [...rootIds] : [];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || toRemove.has(current)) continue;
      toRemove.add(current);
      const children = childrenByParent.get(current);
      if (children && children.length > 0) {
        stack.push(...children);
      }
    }

    if (toRemove.size === 0) {
      return {
        remainingNotes: sourceNotes,
        remainingComments: sourceComments,
        removedIds: toRemove
      };
    }

    const remainingNotes = sourceNotes.filter(note => !toRemove.has(note.id));
    const remainingComments = sourceComments.filter(comment => !toRemove.has(comment.noteId));
    return { remainingNotes, remainingComments, removedIds: toRemove };
  };

  const captureUndoSnapshot = useCallback(() => ({
    data: cloneDeep(data),
    selectedNoteIds: Array.from(selectedNoteIds)
  }), [data, selectedNoteIds]);

  const registerUndo = useCallback((label, snapshot) => {
    setLastUndo({ label, snapshot });
  }, []);

  const promptEditNoteContent = useCallback((note) => {
    if (!note || typeof window === 'undefined') return;
    const activeSelection = window.getSelection();
    if (activeSelection && activeSelection.toString()) return;
    const currentContent = note.content || '';
    const updatedContent = window.prompt('Update item text', currentContent);
    if (updatedContent === null || updatedContent === currentContent) return;
    const trimmedContent = updatedContent.trim();
    if (!trimmedContent) return;
    const snapshot = captureUndoSnapshot();
    setData(prev => ({
      ...prev,
      notes: prev.notes.map(n => n.id === note.id
        ? { ...n, content: trimmedContent, updatedAt: Date.now() }
        : n)
    }));
    registerUndo('Update item text', snapshot);
  }, [captureUndoSnapshot, registerUndo]);

  const promptEditCommentContent = useCallback((comment) => {
    if (!comment || typeof window === 'undefined') return;
    const activeSelection = window.getSelection();
    if (activeSelection && activeSelection.toString()) return;
    const currentContent = comment.content || '';
    const updatedContent = window.prompt('Update comment text', currentContent);
    if (updatedContent === null || updatedContent === currentContent) return;
    const trimmedContent = updatedContent.trim();
    if (!trimmedContent) return;
    const snapshot = captureUndoSnapshot();
    setData(prev => ({
      ...prev,
      comments: prev.comments.map(existing =>
        existing.id === comment.id
          ? { ...existing, content: trimmedContent, updatedAt: Date.now() }
          : existing
      )
    }));
    registerUndo('Update comment text', snapshot);
  }, [captureUndoSnapshot, registerUndo]);

  const promptEditNoteDueDate = useCallback((note) => {
    if (!note || typeof window === 'undefined') return;
    const currentValue = note.dueDate
      ? new Date(note.dueDate).toISOString().slice(0, 10)
      : '';
    const nextValue = window.prompt('Set due date (YYYY-MM-DD)', currentValue);
    if (nextValue === null) return;
    const trimmed = nextValue.trim();
    let nextTimestamp = null;
    if (trimmed) {
      const parsed = Date.parse(trimmed);
      if (Number.isNaN(parsed)) {
        window.alert('Please enter a valid date in the format YYYY-MM-DD.');
        return;
      }
      const parsedDate = new Date(parsed);
      parsedDate.setHours(0, 0, 0, 0);
      nextTimestamp = parsedDate.getTime();
    }
    if ((note.dueDate || null) === (nextTimestamp || null)) return;
    const snapshot = captureUndoSnapshot();
    setData(prev => ({
      ...prev,
      notes: prev.notes.map(n => n.id === note.id
        ? { ...n, dueDate: nextTimestamp, updatedAt: Date.now() }
        : n)
    }));
    registerUndo('Update due date', snapshot);
  }, [captureUndoSnapshot, registerUndo]);

  const applySnapshot = useCallback((snapshotData, selectedIds = []) => {
    setData(snapshotData);
    const active = snapshotData.sessions?.find?.(session => session && session.isActive);
    if (active) {
      setActiveSession(active);
      setSelectedProject(active.projectId || null);
    } else {
      setActiveSession(null);
      setSelectedProject(null);
    }
    setSelectedNoteIds(new Set(selectedIds));
    setProjectPickerState({ noteId: null, query: '' });
    setCollapsedNotes(new Set());
    setShowComments(new Set());
  }, []);

  const deleteNotesByIds = (noteIds, description = 'Delete items') => {
    const ids = Array.isArray(noteIds) ? noteIds.filter(Boolean) : [];
    if (ids.length === 0) return;
    const snapshot = captureUndoSnapshot();
    const result = removeNotesAndComments(ids, data.notes, data.comments);
    if (!result.removedIds || result.removedIds.size === 0) return;

    setData(prev => ({
      ...prev,
      notes: result.remainingNotes,
      comments: result.remainingComments
    }));
    setSelectedNoteIds(prev => {
      const next = new Set(prev);
      result.removedIds.forEach(id => next.delete(id));
      return next;
    });
    if (projectPickerState.noteId && result.removedIds.has(projectPickerState.noteId)) {
      setProjectPickerState({ noteId: null, query: '' });
    }
    registerUndo(description, snapshot);
  };

  // Delete note
  const deleteNote = (noteId) => {
    deleteNotesByIds([noteId], 'Delete note');
  };

  const updateNoteSession = useCallback((noteId, nextSessionId) => {
    if (!noteId) return;
    const currentData = dataRef.current;
    if (!currentData || !Array.isArray(currentData.notes)) {
      return;
    }
    const targetNote = currentData.notes.find(note => note.id === noteId);
    const normalizedSessionId = nextSessionId || null;
    if (!targetNote || (targetNote.sessionId || null) === normalizedSessionId) {
      return;
    }
    const snapshot = captureUndoSnapshot();
    setData(prev => ({
      ...prev,
      notes: prev.notes.map(note =>
        note.id === noteId
          ? { ...note, sessionId: normalizedSessionId, updatedAt: Date.now() }
          : note
      )
    }));
    const sessionLabel = normalizedSessionId
      ? sessionsById.get(normalizedSessionId)?.title || 'selected session'
      : 'no session';
    registerUndo(`Set session to ${sessionLabel}`, snapshot);
  }, [captureUndoSnapshot, registerUndo, sessionsById]);

  const handleDeleteFromModal = (noteId) => {
    if (!noteId) return;
    const confirmed = typeof window === 'undefined' ? true : window.confirm('Delete this note and its sub-items?');
    if (!confirmed) return;
    deleteNote(noteId);
    setShowNoteModal(false);
    setEditingNote(null);
  };

  const handleSessionBubbleClick = useCallback((note) => {
    if (!note) return;
    setSessionDetailsTarget({ noteId: note.id });
  }, []);

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
        sessionId: activeSession?.id || null,
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

      if (searchCriteria) {
        if (searchCriteria.type && note.type !== searchCriteria.type) {
          return false;
        }
        if (searchCriteria.status && note.status !== searchCriteria.status) {
          return false;
        }
        if (searchCriteria.isUrgent === true && !note.isUrgent) {
          return false;
        }
        if (searchCriteria.projectIds.length > 0) {
          const hasProjectMatch = projectIds.some(id => searchCriteria.projectIds.includes(id));
          if (!hasProjectMatch) {
            return false;
          }
        }
        if (searchCriteria.sessionIds.length > 0) {
          if (!note.sessionId || !searchCriteria.sessionIds.includes(note.sessionId)) {
            return false;
          }
        }
        if (searchCriteria.requireNoDue) {
          if (note.dueDate) {
            return false;
          }
        } else if (searchCriteria.requireDue) {
          if (!note.dueDate) {
            return false;
          }
          if (searchCriteria.dueRange) {
            const { start, end } = searchCriteria.dueRange;
            if (note.dueDate < start || note.dueDate >= end) {
              return false;
            }
          }
        }
        if (searchCriteria.textTokens.length > 0) {
          const projectNames = projectIds
            .map(id => projectsById.get(id)?.name || '')
            .filter(Boolean);
          const sessionTitle = note.sessionId
            ? sessionsById.get(note.sessionId)?.title || ''
            : '';
          const typeName = noteTypesById.get(note.type)?.name || toTitleCase(note.type || '');
          const statusLabel = STATUS_LABELS[note.status] || toTitleCase(note.status || '');
          const haystack = [
            note.content || '',
            projectNames.join(' '),
            sessionTitle,
            typeName,
            statusLabel
          ]
            .join(' ')
            .toLowerCase();
          const matchesTokens = searchCriteria.textTokens.every(token => haystack.includes(token));
          if (!matchesTokens) {
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

    if (matchingNotes.size === 0 && Object.keys(columnFilters).length === 0 && !searchCriteria) {
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
        const aDone = a.status === 'done' ? 1 : 0;
        const bDone = b.status === 'done' ? 1 : 0;
        if (aDone !== bDone) {
          return aDone - bDone; // done last
        }
        const aUrgent = a.isUrgent ? 1 : 0;
        const bUrgent = b.isUrgent ? 1 : 0;
        if (aUrgent !== bUrgent) {
          return bUrgent - aUrgent; // urgent first, only if not done above
        }
        const aCreated = a.createdAt || 0;
        const bCreated = b.createdAt || 0;
        return bCreated - aCreated; // newest first by timestamp
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
            const project = projectsById.get(id);
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
        const type = noteTypesById.get(note.type);
        const key = type ? type.name : toTitleCase(note.type || 'Other');
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(note);
      });
      return grouped;
    } else if (groupBy === 'session') {
      const grouped = {};
      topLevelNotes.forEach(note => {
        const session = sessionsById.get(note.sessionId);
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

  const recentProjects = useMemo(() => {
    const timestamps = new Map();
    data.projects.forEach(project => {
      timestamps.set(project.id, project.updatedAt || project.createdAt || 0);
    });
    data.notes.forEach(note => {
      const ids = Array.isArray(note.projectIds)
        ? note.projectIds
        : note.projectId
          ? [note.projectId]
          : [];
      const referenceTime = note.updatedAt || note.createdAt || 0;
      ids.forEach(id => {
        const current = timestamps.get(id) || 0;
        if (referenceTime > current) {
          timestamps.set(id, referenceTime);
        }
      });
    });
    return [...data.projects].sort((a, b) => (timestamps.get(b.id) || 0) - (timestamps.get(a.id) || 0));
  }, [data.projects, data.notes]);

  const notesByParent = useMemo(() => {
    const map = new Map();
    data.notes.forEach(note => {
      if (!note) return;
      const parentId = note.parentId || null;
      if (!map.has(parentId)) {
        map.set(parentId, []);
      }
      map.get(parentId).push(note);
    });
    map.forEach(list => list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)));
    return map;
  }, [data.notes]);

  const commentsByNote = useMemo(() => {
    const map = new Map();
    data.comments.forEach(comment => {
      if (!comment) return;
      if (!map.has(comment.noteId)) {
        map.set(comment.noteId, []);
      }
      map.get(comment.noteId).push(comment);
    });
    map.forEach(list => list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)));
    return map;
  }, [data.comments]);

  const buildNoteRows = (note, depth = 0, visibleNotesSet, matchingNotesSet) => {
    const childCandidates = notesByParent.get(note.id) || [];
    const includeAllChildren = matchingNotesSet.has(note.id);
    const children = includeAllChildren
      ? childCandidates
      : childCandidates.filter(child => visibleNotesSet.has(child.id));
    const comments = commentsByNote.get(note.id) || [];
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
      const totalColumns = visibleColumnsList.length + 2;
      return (
        <div
          key={`comment-input-${row.noteId}`}
          className="grid items-stretch gap-0 border-b border-gray-200 bg-gray-50"
          style={{ gridTemplateColumns }}
        >
          <div
            className="relative flex items-start gap-2 px-4 py-3"
            style={{
              gridColumn: `1 / span ${totalColumns}`,
              paddingLeft: `${row.depth * 20 + 24}px`
            }}
          >
            <MessageSquare size={14} className="text-gray-400 flex-shrink-0" />
            <div className="flex-1">
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
    const depthLevel = row.depth || 0;
    const indentPixels = depthLevel * 20;
    const depthTintPalette = ['bg-white', 'bg-rose-50', 'bg-amber-50', 'bg-emerald-50', 'bg-sky-50'];
    const depthTintClass = depthTintPalette[Math.min(depthLevel, depthTintPalette.length - 1)];
    const rowKey = isNoteRow ? `note-${note.id}` : `comment-${comment.id}`;
    const isNoteUrgent = isNoteRow && !!note.isUrgent;
    const noteProjectIds = isNoteRow
      ? (Array.isArray(note.projectIds)
          ? note.projectIds
          : note.projectId
            ? [note.projectId]
            : [])
      : [];
    const projectEntities = noteProjectIds
      .map(id => projectsById.get(id))
      .filter(Boolean);
    const noteSession = isNoteRow
      ? sessionsById.get(note.sessionId)
      : null;
    const commentSession = !isNoteRow && comment.sessionId
      ? sessionsById.get(comment.sessionId)
      : null;
    const typeDefinition = isNoteRow
      ? noteTypesById.get(note.type)
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
    const collapseControl = canCollapse ? (
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
    
    const contentCell = (
      <div className={`relative px-4 py-3 ${visibleColumnsList.length > 0 ? 'border-r border-gray-200' : ''}`}>
        {isNoteRow ? (
          <div
            className={`flex items-start gap-3 ${depthLevel > 0 ? `${depthTintClass} rounded-lg p-3` : ''}`}
            style={{ marginLeft: `${indentPixels}px` }}
          >
            <div className="flex items-start gap-2">
              {collapseControl}
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between gap-3">
                <p
                  className="text-sm font-medium text-gray-900 whitespace-pre-wrap flex-1 cursor-pointer hover:text-blue-600"
                  onClick={() => promptEditNoteContent(note)}
                  title="Click to edit text"
                >
                  {note.content}
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{formatDateShort(note.createdAt)}</span>
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
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            className={`flex items-start gap-3 text-sm text-gray-700 ${depthLevel > 0 ? `${depthTintClass} rounded-lg p-3` : ''}`}
            style={{ marginLeft: `${indentPixels}px` }}
          >
            <div className="flex items-start gap-2">
              <span className="w-4 h-4 text-gray-400 flex items-center justify-center">
                <MessageSquare size={14} />
              </span>
            </div>
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
              <p
                className="mt-1 leading-relaxed text-sm text-gray-700 cursor-pointer hover:text-blue-600"
                onClick={() => promptEditCommentContent(comment)}
                title="Click to edit comment"
              >
                {comment.content}
              </p>
              <div className="mt-1 text-xs text-gray-400">{formatDate(comment.createdAt)}</div>
            </div>
          </div>
        )}
      </div>
    );

    const isSelected = isNoteRow ? selectedNoteIds.has(note.id) : false;
    let rowBackgroundClass = depthTintClass;
    if (isNoteRow) {
      if (isSelected) {
        rowBackgroundClass = depthLevel > 0 ? 'bg-blue-100' : 'bg-blue-50';
      } else if (isNoteUrgent) {
        rowBackgroundClass = 'bg-red-50';
      } else {
        rowBackgroundClass = depthTintClass;
      }
    }
    let hoverClass = '';
    if (isNoteRow && !isSelected) {
      hoverClass = isNoteUrgent ? 'hover:bg-red-100' : 'hover:bg-gray-100';
    }
    const rowClassName = `grid items-stretch gap-0 border-b border-gray-200 transition-colors ${rowBackgroundClass} ${hoverClass}`;

    const selectionCell = (
      <div className="relative flex items-center justify-center px-4 py-3 border-r border-gray-200">
        {isNoteRow ? (
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={isSelected}
            onChange={() => toggleNoteSelection(note.id)}
          />
        ) : null}
      </div>
    );

    const sessionLabel = isNoteRow
      ? note.sessionId
        ? noteSession?.title || 'Unknown Session'
        : 'No Session'
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
        {visibleColumnsList.map((column, columnIndex) => {
          const isLastVisibleColumn = columnIndex === visibleColumnsList.length - 1;
          if (column.id === 'type') {
            return (
              <div
                key={`${rowKey}-type`}
                className={`relative flex items-start px-4 py-3 text-sm text-gray-700 ${!isLastVisibleColumn ? 'border-r border-gray-200' : ''}`}
              >
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
                <div
                  key={`${rowKey}-project`}
                  className={`relative px-4 py-3 text-sm text-gray-600 ${!isLastVisibleColumn ? 'border-r border-gray-200' : ''}`}
                >
                  —
                </div>
              );
            }
            const availableProjects = data.projects.filter(p => !noteProjectIds.includes(p.id));
            const isProjectPickerOpen = projectPickerState.noteId === note.id;
            const pickerQuery = isProjectPickerOpen ? projectPickerState.query : '';
            const normalizedPickerQuery = pickerQuery.trim().toLowerCase();
            const filteredProjects = normalizedPickerQuery
              ? availableProjects.filter(project =>
                  (project.name || '').toLowerCase().includes(normalizedPickerQuery)
                )
              : availableProjects;
            const recentAvailableProjects = recentProjects
              .filter(project => !noteProjectIds.includes(project.id))
              .slice(0, 5);
            const canCreateProject = normalizedPickerQuery.length > 0 && !projectsByNameLower.has(normalizedPickerQuery);

            const handleProjectPickerSubmit = () => {
              const trimmed = pickerQuery.trim();
              if (!trimmed) {
                if (filteredProjects.length > 0) {
                  assignExistingProjectToNote(note.id, filteredProjects[0].id);
                } else {
                  closeProjectPicker();
                }
                return;
              }
              const lower = trimmed.toLowerCase();
              if (availableProjects.some(project => (project.name || '').toLowerCase() === lower)) {
                const target = availableProjects.find(project => (project.name || '').toLowerCase() === lower);
                if (target) {
                  assignExistingProjectToNote(note.id, target.id);
                  return;
                }
              }
              const partialMatch = availableProjects.find(project =>
                (project.name || '').toLowerCase().includes(lower)
              );
              if (partialMatch) {
                assignExistingProjectToNote(note.id, partialMatch.id);
                return;
              }
              createProjectForNote(note.id, trimmed);
            };

            return (
              <div
                key={`${rowKey}-project`}
                className={`relative px-4 py-3 text-sm text-gray-600 ${!isLastVisibleColumn ? 'border-r border-gray-200' : ''}`}
              >
                <div className="flex flex-wrap items-start gap-2">
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
                  <button
                    type="button"
                    data-project-picker-trigger="true"
                    onClick={() => {
                      if (isProjectPickerOpen) {
                        closeProjectPicker();
                      } else {
                        openProjectPicker(note.id);
                      }
                    }}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-200"
                    aria-label="Add project"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                {isProjectPickerOpen && (
                  <div
                    ref={projectPickerRef}
                    className="absolute left-0 top-full z-30 mt-2 w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        ref={projectPickerInputRef}
                        value={pickerQuery}
                        onChange={(event) => updateProjectPickerQuery(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            handleProjectPickerSubmit();
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            closeProjectPicker();
                          }
                        }}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                        placeholder="Search or create project…"
                      />
                    </div>
                    {recentAvailableProjects.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                          Recent
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {recentAvailableProjects.map(project => (
                            <button
                              key={`recent-${project.id}`}
                              type="button"
                              onClick={() => assignExistingProjectToNote(note.id, project.id)}
                              className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                            >
                              <Folder size={12} /> {project.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="mt-3 max-h-40 overflow-y-auto space-y-1">
                      {filteredProjects.length > 0 ? (
                        filteredProjects.map(project => (
                          <button
                            key={`match-${project.id}`}
                            type="button"
                            onClick={() => assignExistingProjectToNote(note.id, project.id)}
                            className="w-full rounded px-2 py-1 text-left text-sm text-gray-700 hover:bg-green-50"
                          >
                            {project.name}
                          </button>
                        ))
                      ) : (
                        <p className="text-xs text-gray-400">No matching projects.</p>
                      )}
                    </div>
                    {canCreateProject && (
                      <button
                        type="button"
                        onClick={() => createProjectForNote(note.id, pickerQuery)}
                        className="mt-3 w-full rounded border border-green-200 px-2 py-1 text-sm font-medium text-green-700 hover:bg-green-50"
                      >
                        Create "{pickerQuery.trim()}"
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          }
          
          if (column.id === 'session') {
            if (!isNoteRow) {
              return (
                <div
                  key={`${rowKey}-session`}
                  className={`relative px-4 py-3 text-sm text-gray-600 truncate ${!isLastVisibleColumn ? 'border-r border-gray-200' : ''}`}
                >
                  {sessionLabel}
                </div>
              );
            }
            const hasSession = !!note.sessionId;
            const bubbleBaseClasses = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-300';
            const bubbleClasses = hasSession
              ? `${bubbleBaseClasses} bg-blue-100 text-blue-700 hover:bg-blue-200`
              : `${bubbleBaseClasses} bg-gray-100 text-gray-500 hover:bg-gray-200`;
            return (
              <div
                key={`${rowKey}-session`}
                className={`relative px-4 py-3 text-sm text-gray-600 ${!isLastVisibleColumn ? 'border-r border-gray-200' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => handleSessionBubbleClick(note)}
                  className={bubbleClasses}
                >
                  {hasSession ? (
                    <>
                      <Clock size={12} /> {sessionLabel}
                    </>
                  ) : (
                    <>
                      <Plus size={12} /> Set Session
                    </>
                  )}
                </button>
              </div>
            );
          }
          
          if (column.id === 'dueDate') {
            return (
              <div
                key={`${rowKey}-due`}
                className={`relative px-4 py-3 text-sm text-gray-600 ${!isLastVisibleColumn ? 'border-r border-gray-200' : ''}`}
              >
                {isNoteRow ? (
                  <button
                    type="button"
                    onClick={() => promptEditNoteDueDate(note)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition ${
                      note.dueDate ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                    title="Click to edit due date"
                  >
                    <Calendar size={12} />
                    {note.dueDate ? dueDateValue : 'Set Due Date'}
                  </button>
                ) : (
                  dueDateValue
                )}
              </div>
            );
          }
          
          if (column.id === 'urgent') {
            return (
              <div
                key={`${rowKey}-urgent`}
                className={`relative flex items-start px-4 py-3 text-sm text-gray-600 ${!isLastVisibleColumn ? 'border-r border-gray-200' : ''}`}
              >
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
              <div
                key={`${rowKey}-status`}
                className={`relative flex items-start px-4 py-3 ${!isLastVisibleColumn ? 'border-r border-gray-200' : ''}`}
              >
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
              <div
                key={`${rowKey}-created`}
                className={`relative px-4 py-3 text-sm text-gray-600 ${!isLastVisibleColumn ? 'border-r border-gray-200' : ''}`}
              >
                {isNoteRow && note.createdAt ? formatDateShort(note.createdAt) : '—'}
              </div>
            );
          }
          
          if (column.id === 'actions') {
            return (
              <div
                key={`${rowKey}-actions`}
                className={`relative px-4 py-3 pr-6 flex items-start justify-end gap-2 ${!isLastVisibleColumn ? 'border-r border-gray-200' : ''}`}
              >
                {isNoteRow ? (
                  <>
                    <button
                      onClick={() => {
                        setEditingNote(note);
                        setShowNoteModal(true);
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
                      aria-label="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200"
                      aria-label="Delete"
                    >
                      <Trash2 size={16} />
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

  const sessionDetailsNote = useMemo(() => {
    if (!sessionDetailsTarget) return null;
    return data.notes.find(note => note.id === sessionDetailsTarget.noteId) || null;
  }, [data.notes, sessionDetailsTarget]);

  const sessionDetailsSession = useMemo(() => {
    if (!sessionDetailsNote || !sessionDetailsNote.sessionId) return null;
    return sessionsById.get(sessionDetailsNote.sessionId) || null;
  }, [sessionDetailsNote, sessionsById]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  useEffect(() => {
    setCollapsedGroups(new Set());
  }, [groupBy]);

  useEffect(() => {
    if (!projectPickerState.noteId && !showAutosaveMenu) return;
    const handleClickOutside = (event) => {
      if (projectPickerState.noteId) {
        if (projectPickerRef.current && projectPickerRef.current.contains(event.target)) return;
        if (event.target.closest('[data-project-picker-trigger=\"true\"]')) return;
        setProjectPickerState({ noteId: null, query: '' });
      }
      if (showAutosaveMenu) {
        if (autosaveMenuRef.current && autosaveMenuRef.current.contains(event.target)) return;
        if (autosaveButtonRef.current && autosaveButtonRef.current.contains(event.target)) return;
        setShowAutosaveMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [projectPickerState.noteId, showAutosaveMenu]);

  useEffect(() => {
    if (projectPickerState.noteId && projectPickerInputRef.current) {
      projectPickerInputRef.current.focus();
    }
  }, [projectPickerState.noteId]);

  useEffect(() => {
    if (!autosaveReady || typeof window === 'undefined') return;

    const saveAutosave = () => {
      const snapshot = {
        id: generateId(),
        timestamp: Date.now(),
        data: cloneDeep(dataRef.current),
        selectedNoteIds: Array.from(selectedIdsRef.current)
      };
      setAutosaves(prev => {
        const next = [snapshot, ...prev].slice(0, AUTOSAVE_MAX_COUNT);
        try {
          window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(next));
        } catch (error) {
          console.error('Failed to persist autosave', error);
        }
        return next;
      });
    };

    saveAutosave();
    autosaveTimerRef.current = window.setInterval(saveAutosave, AUTOSAVE_INTERVAL_MS);
    return () => {
      if (autosaveTimerRef.current) {
        clearInterval(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [autosaveReady]);

  const handleUndo = useCallback(() => {
    if (!lastUndo) return;
    const { snapshot } = lastUndo;
    if (snapshot?.data) {
      applySnapshot(snapshot.data, snapshot.selectedNoteIds || []);
    }
    setLastUndo(null);
  }, [lastUndo, applySnapshot]);

  const restoreAutosave = useCallback((entry) => {
    if (!entry) return;
    const snapshot = captureUndoSnapshot();
    applySnapshot(cloneDeep(entry.data), entry.selectedNoteIds || []);
    registerUndo('Restore autosave', snapshot);
    setShowAutosaveMenu(false);
  }, [applySnapshot, captureUndoSnapshot, registerUndo]);

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

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedNoteIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleNoteIds.forEach(id => next.delete(id));
      } else {
        visibleNoteIds.forEach(id => next.add(id));
      }
      return next;
    });
  }, [allVisibleSelected, visibleNoteIds]);

  useEffect(() => {
    const handleGlobalShortcut = (event) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const active = document.activeElement;
      const isEditable =
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.isContentEditable);

      if (event.key === '/' && !isEditable) {
        event.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select?.();
        }
        return;
      }

      if ((event.key === 'n' || event.key === 'N') && !isEditable) {
        event.preventDefault();
        if (quickEntryInputRef.current) {
          quickEntryInputRef.current.focus();
          quickEntryInputRef.current.select?.();
        }
        return;
      }

      if ((event.key === 'a' || event.key === 'A') && event.shiftKey && !isEditable) {
        event.preventDefault();
        toggleSelectAllVisible();
      }
    };

    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, [toggleSelectAllVisible]);

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
    const snapshot = captureUndoSnapshot();
    setData(prev => ({
      ...prev,
      notes: prev.notes.map(note => {
        if (!selectedNoteIds.has(note.id)) return note;
        return updater(note);
      })
    }));
    registerUndo(description, snapshot);
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
    const typeName = noteTypesById.get(value)?.name || value;
    applyBulkUpdate(`Set type to ${typeName}`, (note) => ({
      ...note,
      type: value,
      updatedAt: Date.now()
    }));
  };

  const handleBulkProjectAdd = (value) => {
    if (!value) return;
    const project = projectsById.get(value);
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
    const project = projectsById.get(value);
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
      : sessionsById.get(value)?.title || 'selected session';
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
    deleteNotesByIds(ids, `Delete ${ids.length} item${ids.length === 1 ? '' : 's'}`);
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
                  ref={quickEntryInputRef}
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
                    const project = projectsById.get(projectId);
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
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <div className="flex flex-wrap gap-2 items-center">
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
                type="button"
                onClick={handleUndo}
                disabled={!lastUndo}
                title={lastUndo ? `Undo ${lastUndo.label}` : 'Nothing to undo'}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm border ${lastUndo ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50' : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'}`}
              >
                <RotateCcw size={16} /> Undo
              </button>
              <div className="relative">
                <button
                  type="button"
                  ref={autosaveButtonRef}
                  onClick={() => setShowAutosaveMenu(prev => !prev)}
                  disabled={autosaves.length === 0}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm border ${autosaves.length > 0 ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50' : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'}`}
                >
                  Autosaves
                </button>
                {showAutosaveMenu && autosaves.length > 0 && (
                  <div
                    ref={autosaveMenuRef}
                    className="absolute right-0 z-40 mt-2 w-72 rounded-lg border border-gray-200 bg-white shadow-lg"
                  >
                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                      {autosaves.map(entry => (
                        <button
                          key={entry.id}
                          type="button"
                          className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50"
                          onClick={() => restoreAutosave(entry)}
                        >
                          <div className="font-medium text-gray-700">
                            {new Date(entry.timestamp).toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            {entry.selectedNoteIds?.length || 0} selected
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setShowColumnMenu(true)}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                Columns
              </button>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setSearchQuery('');
                      event.stopPropagation();
                    }
                  }}
                  placeholder="Search or use /tags"
                  aria-label="Search items"
                  className="pl-9 pr-8 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
                  type="text"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
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
        {Object.entries(groupedNotes).map(([groupName, notes]) => {
          if (notes.length === 0) return null;
          const isGroupCollapsed = groupBy !== 'none' && collapsedGroups.has(groupName);
          return (
            <div key={groupName} className="mb-6">
              {groupBy !== 'none' && (
                <div className="mb-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleGroupCollapse(groupName)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    aria-label={isGroupCollapsed ? `Expand ${groupName}` : `Collapse ${groupName}`}
                  >
                    {isGroupCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <h2 className="text-lg font-semibold text-gray-700">{groupName}</h2>
                </div>
              )}
              {(!isGroupCollapsed || groupBy === 'none') && (
                <div className="bg-white border border-gray-200 rounded-lg">
                  <div className="overflow-x-auto">
                    <div style={{ minWidth: `${gridMinWidth}px` }}>
                      <div
                        className="grid items-stretch gap-0 border-b border-gray-200 bg-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-700 select-none rounded-t-lg"
                        style={{ gridTemplateColumns }}
                      >
                        <div className="relative flex items-center justify-center px-4 py-3 border-r border-gray-200 bg-gray-100">
                          <input
                            ref={selectAllRef}
                            type="checkbox"
                            className="h-4 w-4"
                            checked={allVisibleSelected && visibleNoteIds.length > 0}
                            disabled={visibleNoteIds.length === 0}
                            onChange={toggleSelectAllVisible}
                            aria-label="Select all visible items"
                          />
                        </div>
                        <div className={`relative flex flex-col gap-3 px-4 py-3 bg-gray-100 ${visibleColumns.length > 0 ? 'border-r border-gray-200' : ''}`}>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 cursor-not-allowed"
                              aria-label="Item column"
                              disabled
                            >
                              <GripVertical size={14} aria-hidden="true" />
                            </button>
                            <span className="text-gray-700">Item</span>
                          </div>
                          {visibleColumns.length > 0 && (
                            <button
                              type="button"
                              onMouseDown={(event) => handleColumnResizeMouseDown(event, '__item__')}
                              className="absolute top-0 right-0 h-full w-2 cursor-col-resize"
                              aria-label="Resize Item column"
                            />
                          )}
                        </div>
                        {visibleColumns.map((column, index) => {
                          const draggable = !column.alwaysVisible || column.id !== 'actions';
                          const isSorted = sortConfig.columnId === column.id;
                          const isLast = index === visibleColumns.length - 1;
                          return (
                            <div
                              key={`header-${column.id}`}
                              className={`relative flex flex-col gap-3 px-4 py-3 bg-gray-100 ${!isLast ? 'border-r border-gray-200' : ''} ${column.id === 'actions' ? 'pr-12' : ''}`}
                              onDragOver={(event) => handleColumnDragOver(event, column.id)}
                              onDrop={(event) => handleColumnDrop(event, column.id)}
                            >
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${draggable ? 'cursor-grab text-gray-400 hover:text-gray-600' : 'cursor-not-allowed text-gray-300'}`}
                                  aria-label={`Drag ${column.label} column`}
                                  draggable={draggable}
                                  onDragStart={(event) => draggable && handleColumnDragStart(event, column.id)}
                                  onDragEnd={handleColumnDragEnd}
                                >
                                  <GripVertical size={14} aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSort(column.id)}
                                  className={`flex items-center gap-1 text-left text-gray-700 bg-transparent ${column.id === 'actions' ? 'cursor-default' : 'cursor-pointer'}`}
                                  disabled={column.id === 'actions'}
                                >
                                  <span>{column.label}</span>
                                  {column.id !== 'actions' && (
                                    <span className="text-gray-400">
                                      {isSorted ? (sortConfig.direction === 'asc' ? '↑' : '↓') : <ArrowUpDown size={14} />}
                                    </span>
                                  )}
                                </button>
                              </div>
                              {column.filterable && column.id !== 'actions' ? (
                                <select
                                  value={columnFilters[column.id] || ''}
                                  onChange={(event) => handleColumnFilterChange(column.id, event.target.value)}
                                  className="text-xs border border-gray-300 rounded px-2 py-1 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                                >
                                  <option value="">All</option>
                                  {renderColumnFilterOptions(column.id)}
                                </select>
                              ) : (
                                <span className="block h-1" />
                              )}
                              <button
                                type="button"
                                onMouseDown={(event) => handleColumnResizeMouseDown(event, column.id)}
                                className="absolute top-0 right-0 h-full w-2 cursor-col-resize"
                                aria-label={`Resize ${column.label} column`}
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
              )}
            </div>
          );
        })}
        
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

      {sessionDetailsTarget && sessionDetailsNote && (
        <SessionDetailsModal
          note={sessionDetailsNote}
          session={sessionDetailsSession}
          sessions={data.sessions}
          projects={data.projects}
          people={data.people}
          onClose={() => setSessionDetailsTarget(null)}
          onChangeSession={(nextSessionId) => updateNoteSession(sessionDetailsNote.id, nextSessionId)}
        />
      )}
      
      {showNoteModal && (
        <NoteModal
          note={editingNote}
          projects={data.projects}
          noteTypes={data.noteTypes}
          sessions={data.sessions}
          defaultSessionId={activeSession?.id || null}
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
function NoteModal({ note, projects, noteTypes, sessions, defaultSessionId, selectedProject, onClose, onSave, onDelete }) {
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
  const [sessionId, setSessionId] = useState(() => {
    if (note?.sessionId) return note.sessionId;
    if (note && !note.sessionId) return '';
    if (!note && defaultSessionId) return defaultSessionId;
    return '';
  });
  const sessionOptions = Array.isArray(sessions) ? sessions : [];
  const selectedSession = sessionId ? sessionOptions.find(session => session.id === sessionId) || null : null;
  const sessionProjectName = selectedSession?.projectId
    ? projects.find(project => project.id === selectedSession.projectId)?.name || 'Unknown Project'
    : null;

  useEffect(() => {
    if (note?.sessionId) {
      setSessionId(note.sessionId);
    } else if (note) {
      setSessionId('');
    } else if (defaultSessionId) {
      setSessionId(defaultSessionId);
    } else {
      setSessionId('');
    }
  }, [note?.id, note?.sessionId, defaultSessionId]);
  
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
        sessionId: sessionId ? sessionId : null,
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Session</label>
            <select
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No Session</option>
              {sessionOptions.map(session => (
                <option key={session.id} value={session.id}>
                  {session.title || 'Untitled Session'}
                </option>
              ))}
            </select>
            <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              {selectedSession ? (
                <div className="space-y-1 text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-700">{selectedSession.title || 'Untitled Session'}</span>
                    {selectedSession.isActive && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                        Active
                      </span>
                    )}
                  </div>
                  <p><span className="font-medium text-gray-700">Type:</span> {toTitleCase(selectedSession.type || 'Session')}</p>
                  {sessionProjectName && (
                    <p><span className="font-medium text-gray-700">Project:</span> {sessionProjectName}</p>
                  )}
                  <p><span className="font-medium text-gray-700">Start:</span> {selectedSession.startTime ? formatDate(selectedSession.startTime) : 'Not recorded'}</p>
                  <p><span className="font-medium text-gray-700">End:</span> {selectedSession.endTime ? formatDate(selectedSession.endTime) : 'In progress'}</p>
                </div>
              ) : (
                <p className="text-xs text-gray-500">No session selected for this item.</p>
              )}
            </div>
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

function SessionDetailsModal({ note, session, sessions, projects, people, onClose, onChangeSession }) {
  if (!note) return null;
  const [selectedSessionId, setSelectedSessionId] = useState(() => session?.id || '');
  const sessionOptions = Array.isArray(sessions) ? sessions : [];
  const projectList = Array.isArray(projects) ? projects : [];

  useEffect(() => {
    if (session?.id) {
      setSelectedSessionId(session.id);
    } else {
      setSelectedSessionId('');
    }
  }, [session?.id, note?.id]);

  const peopleById = useMemo(() => {
    const map = new Map();
    if (Array.isArray(people)) {
      people.forEach(person => {
        if (person?.id) {
          map.set(person.id, person.name || 'Unnamed Person');
        }
      });
    }
    return map;
  }, [people]);

  const selectedSession = selectedSessionId
    ? sessionOptions.find(item => item.id === selectedSessionId) || null
    : null;

  const displaySession = selectedSession || session;

  const sessionProjectName = displaySession?.projectId
    ? projectList.find(project => project.id === displaySession.projectId)?.name || 'Unknown Project'
    : null;

  const participantNames = Array.isArray(displaySession?.participants)
    ? displaySession.participants
        .map(participantId => peopleById.get(participantId) || participantId)
        .filter(Boolean)
    : [];

  const handleSubmit = (event) => {
    event.preventDefault();
    onChangeSession(selectedSessionId || null);
    onClose();
  };

  const handleRemove = () => {
    setSelectedSessionId('');
    onChangeSession(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Session Details</h2>
            <p className="mt-1 text-sm text-gray-500">Adjust the session attached to this item.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close session details"
          >
            <X size={20} />
          </button>
        </div>
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Item</p>
          <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{note.content || 'Untitled item'}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Session</label>
            <select
              value={selectedSessionId}
              onChange={(event) => setSelectedSessionId(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No Session</option>
              {sessionOptions.map(option => {
                const labelDate = option.startTime ? formatDateShort(option.startTime) : null;
                const label = option.title || 'Untitled Session';
                return (
                  <option key={option.id} value={option.id}>
                    {labelDate ? `${label} — ${labelDate}` : label}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            {displaySession ? (
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800">{displaySession.title || 'Untitled Session'}</span>
                  {!displaySession.endTime && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                      Active
                    </span>
                  )}
                </div>
                <p><span className="font-medium text-gray-700">Type:</span> {toTitleCase(displaySession.type || 'Session')}</p>
                {sessionProjectName && (
                  <p><span className="font-medium text-gray-700">Project:</span> {sessionProjectName}</p>
                )}
                <p><span className="font-medium text-gray-700">Start:</span> {displaySession.startTime ? formatDate(displaySession.startTime) : 'Not recorded'}</p>
                <p><span className="font-medium text-gray-700">End:</span> {displaySession.endTime ? formatDate(displaySession.endTime) : 'In progress'}</p>
                <p><span className="font-medium text-gray-700">Participants:</span> {participantNames.length > 0 ? participantNames.join(', ') : 'Not specified'}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No session is currently associated with this item.</p>
            )}
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleRemove}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
            >
              Remove Session
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Apply
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
