"use client";
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Plus, Folder, Calendar, Clock, AlertCircle, MessageSquare, ChevronDown, ChevronRight, X, Edit2, Trash2, Play, Square } from 'lucide-react';

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
  { id: 'type', label: 'Type' },
  { id: 'project', label: 'Project' },
  { id: 'session', label: 'Session' },
  { id: 'dueDate', label: 'Due Date' },
  { id: 'urgent', label: 'Urgent' },
  { id: 'status', label: 'Status' },
  { id: 'createdAt', label: 'Date Created' },
  { id: 'actions', label: 'Actions', alwaysVisible: true }
];

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
  const [activeSession, setActiveSession] = useState(null);
  const [filterBy, setFilterBy] = useState('all');
  const [groupBy, setGroupBy] = useState('none');
  const [selectedSessionFilter, setSelectedSessionFilter] = useState(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [showComments, setShowComments] = useState(new Set());
  const [collapsedNotes, setCollapsedNotes] = useState(new Set());
  // const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showProjectAutocomplete, setShowProjectAutocomplete] = useState(false);
  const [selectedAutocompleteIndex, setSelectedAutocompleteIndex] = useState(0);
  const [appliedTags, setAppliedTags] = useState({ type: 'note', isUrgent: false, dueDate: null, projectId: null });
  const [tagFilter, setTagFilter] = useState(null);
  const [columnVisibility, setColumnVisibility] = useState(() => ({ ...INITIAL_COLUMN_VISIBILITY }));
  const [columnOrder, setColumnOrder] = useState(() => COLUMN_DEFS.map(col => col.id));
  const [columnWidths, setColumnWidths] = useState(() => COLUMN_DEFS.reduce((acc, column) => {
    acc[column.id] = column.id === 'actions' ? 140 : 160;
    return acc;
  }, {}));
  const [itemColumnWidth, setItemColumnWidth] = useState(420);
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

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleColumnResizeMouseMove);
      document.removeEventListener('mouseup', handleColumnResizeMouseUp);
    };
  }, [handleColumnResizeMouseMove, handleColumnResizeMouseUp]);

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

  const handleTagFilter = (type, value, label) => {
    setTagFilter(prev => 
      prev && prev.type === type && prev.value === value
        ? null
        : { type, value, label }
    );
  };

  const isTagActive = (type, value) => 
    tagFilter?.type === type && tagFilter.value === value;

  const clearTagFilter = () => setTagFilter(null);

  const handleSessionFilter = (sessionId) => {
    if (!sessionId) return;
    const currentTarget = selectedSessionFilter || activeSession?.id;
    if (filterBy === 'session' && currentTarget === sessionId) {
      setFilterBy('all');
      setSelectedSessionFilter(null);
    } else {
      setFilterBy('session');
      setSelectedSessionFilter(sessionId);
    }
    clearTagFilter();
  };

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

  const orderedColumns = useMemo(() => {
    const prioritized = columnOrder
      .map(id => COLUMN_DEFS.find(col => col.id === id))
      .filter(Boolean);
    const missing = COLUMN_DEFS.filter(col => !columnOrder.includes(col.id));
    return [...prioritized, ...missing];
  }, [columnOrder]);

  const visibleColumns = orderedColumns.filter(isColumnVisible);

  const gridTemplateColumns = useMemo(() => {
    const primaryWidth = Math.max(240, itemColumnWidth);
    const otherTemplates = visibleColumns.map(column => `${Math.max(120, columnWidths[column.id] || 160)}px`);
    return [primaryWidth ? `${primaryWidth}px` : 'minmax(320px, 2fr)', ...otherTemplates].join(' ');
  }, [visibleColumns, columnWidths, itemColumnWidth]);

  const gridMinWidth = useMemo(() => {
    const primaryWidth = Math.max(240, itemColumnWidth);
    const otherWidth = visibleColumns.reduce((sum, column) => sum + Math.max(120, columnWidths[column.id] || 160), 0);
    return Math.max(640, primaryWidth + otherWidth);
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
    const proposed = Math.max(140, state.initialWidth + delta);
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
      ? Math.max(240, itemColumnWidth)
      : Math.max(120, columnWidths[columnId] || 160);
    columnResizeStateRef.current = {
      columnId,
      startX: event.clientX,
      initialWidth
    };
    document.addEventListener('mousemove', handleColumnResizeMouseMove);
    document.addEventListener('mouseup', handleColumnResizeMouseUp);
  }, [columnWidths, itemColumnWidth, handleColumnResizeMouseMove, handleColumnResizeMouseUp]);

  // Parse tags from note content
  const parseTags = (text) => {
    const tags = {
      type: 'note',
      isUrgent: false,
      dueDate: null,
      projectId: null,
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
              tags.projectId = project.id;
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
    return data.projects.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
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
    setAppliedTags(prev => ({ ...prev, projectId: project.id }));
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
  const removeTag = (tagType) => {
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
        newTags.projectId = null;
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
    const finalProjectId = appliedTags.projectId || selectedProject;

    const newNote = {
      id: generateId(),
      projectId: finalProjectId,
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
    setAppliedTags({ type: 'note', isUrgent: false, dueDate: null, projectId: null });
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
    if (editingNote?.id) {
      setData(prev => ({
        ...prev,
        notes: prev.notes.map(n => {
          if (n.id !== editingNote.id) return n;
          return {
            ...n,
            ...noteData,
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
        projectId: noteData.projectId || editingNote?.projectId || selectedProject || null,
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

  const cycleStatus = (note) => {
    const current = STATUS_ORDER.includes(note.status) ? note.status : 'not_started';
    const nextStatus = STATUS_ORDER[(STATUS_ORDER.indexOf(current) + 1) % STATUS_ORDER.length];
    setData(prev => ({
      ...prev,
      notes: prev.notes.map(n => {
        if (n.id !== note.id) return n;
        return {
          ...n,
          status: nextStatus,
          sessionId: activeSession?.id || n.sessionId || null,
          updatedAt: Date.now()
        };
      })
    }));
  };

  const handleStatusInteraction = (event, note, label) => {
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      handleTagFilter('status', note.status, label);
      return;
    }
    event.preventDefault();
    cycleStatus(note);
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
        projectId: parent.projectId,
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
      switch (filterBy) {
        case 'project':
          if (selectedProject) return note.projectId === selectedProject;
          return true;
        case 'urgent':
          return !!note.isUrgent;
        case 'due_week': {
          if (!note.dueDate) return false;
          const now = Date.now();
          const weekFromNow = now + 7 * 24 * 60 * 60 * 1000;
          return note.dueDate <= weekFromNow;
        }
        case 'to_do':
          return note.type === 'to_do' && note.status !== 'done';
        case 'session': {
          if (selectedSessionFilter === SESSION_FILTER_ALL) {
            return !!note.sessionId;
          }
          const sessionId = selectedSessionFilter || activeSession?.id;
          return sessionId ? note.sessionId === sessionId : !!note.sessionId;
        }
        default:
          return true;
      }
    };

    const matchesTagFilter = (note) => {
      if (!tagFilter) return true;
      if (tagFilter.type === 'project') {
        return note.projectId === tagFilter.value;
      }
      if (tagFilter.type === 'type') {
        return note.type === tagFilter.value;
      }
      if (tagFilter.type === 'status') {
        return note.status === tagFilter.value;
      }
      return true;
    };

    const matchingNotes = new Set();
    allNotes.forEach(note => {
      if (matchesFilter(note) && matchesTagFilter(note)) {
        matchingNotes.add(note.id);
      }
    });

    if (matchingNotes.size === 0 && filterBy === 'all' && !tagFilter) {
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

    const topLevel = allNotes
      .filter(n => !n.parentId && visibleNotes.has(n.id))
      .sort((a, b) => b.createdAt - a.createdAt);

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
        const project = data.projects.find(p => p.id === note.projectId);
        const key = project ? project.name : 'No Project';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(note);
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
    const project = isNoteRow
      ? data.projects.find(p => p.id === note.projectId)
      : null;
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
    const noteStatusLabel = isNoteRow
      ? STATUS_LABELS[note.status] || STATUS_LABELS.not_started
      : null;
    const noteStatusClasses = isNoteRow && note.status === 'done'
      ? 'bg-green-100 text-green-700'
      : isNoteRow && note.status === 'in_progress'
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-gray-100 text-gray-600';
    const statusActive = isNoteRow && note.status ? isTagActive('status', note.status) : false;
    const sessionTarget = selectedSessionFilter || activeSession?.id;
    const sessionActive = noteSession ? filterBy === 'session' && sessionTarget === noteSession.id : false;
    const commentTypeActive = !isNoteRow && comment ? isTagActive('type', comment.type) : false;
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
            <button
              type="button"
              onClick={() => handleTagFilter('type', comment.type, typeLabel)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200 ${commentTypeActive ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-gray-50' : ''}`}
            >
              {typeLabel}
            </button>
            {commentSession && (
              <button
                type="button"
                onClick={() => handleSessionFilter(commentSession.id)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 ${filterBy === 'session' && sessionTarget === commentSession.id ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-gray-50' : ''}`}
              >
                <Clock size={12} /> {commentSession.title}
              </button>
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
    
    const projectName = project ? project.name : '—';
    const sessionLabel = isNoteRow
      ? noteSession?.title || '—'
      : commentSession?.title || '—';
    const dueDateValue = isNoteRow && note.dueDate
      ? formatDateShort(note.dueDate)
      : '—';
    const urgentValue = isNoteRow && note.isUrgent
      ? <span className="inline-flex items-center gap-1 text-xs text-red-600"><AlertCircle size={12} /> Urgent</span>
      : '—';
    
    return (
      <div
        key={rowKey}
        className={rowClassName}
        style={{ gridTemplateColumns: gridTemplateColumns }}
      >
        {contentCell}
        {visibleColumnsList.map(column => {
          if (column.id === 'type') {
            return (
              <div key={`${rowKey}-type`} className="text-sm text-gray-700">
                {isNoteRow ? (
                  <button
                    type="button"
                    onClick={() => handleTagFilter('type', note.type, typeLabel)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200 ${isTagActive('type', note.type) ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-white' : ''}`}
                  >
                    {typeLabel}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleTagFilter('type', comment.type, typeLabel)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200 ${isTagActive('type', comment.type) ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-gray-50' : ''}`}
                  >
                    {typeValue}
                  </button>
                )}
              </div>
            );
          }
          
          if (column.id === 'project') {
            return (
              <div key={`${rowKey}-project`} className="text-sm text-gray-600 truncate">
                {isNoteRow ? projectName : '—'}
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
                {urgentValue}
              </div>
            );
          }
          
          if (column.id === 'status') {
            return (
              <div key={`${rowKey}-status`} className="flex items-center">
                {isNoteRow ? (
                  <button
                    type="button"
                    onClick={(event) => handleStatusInteraction(event, note, noteStatusLabel)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition ${noteStatusClasses} hover:opacity-90 ${statusActive ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-white' : ''}`}
                    title="Click to cycle status · Cmd/Ctrl+Click to filter"
                  >
                    {noteStatusLabel}
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
              <div key={`${rowKey}-actions`} className="flex items-center gap-1 justify-end">
                {isNoteRow ? (
                  <>
                    <button
                      onClick={() => {
                        setEditingNote(note);
                        setShowNoteModal(true);
                      }}
                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                      aria-label="Edit"
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
  const groupedNotes = getGroupedNotes(topLevelNotes);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto">
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
              {(appliedTags.type !== 'note' || appliedTags.isUrgent || appliedTags.dueDate || appliedTags.projectId) && (
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
                  {appliedTags.projectId && (
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                      <Folder size={12} />
                      <span className="font-medium">
                        {data.projects.find(p => p.id === appliedTags.projectId)?.name}
                      </span>
                      <button
                        onClick={() => removeTag('project')}
                        className="hover:bg-green-200 rounded-full p-0.5"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Action Bar */}
          <div className="flex gap-2 mt-4 flex-wrap">
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
            
            <div className="flex gap-2 ml-auto flex-wrap items-center">
              <button
                onClick={() => setShowColumnMenu(true)}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                Columns
              </button>
              <select
                value={filterBy}
                onChange={(e) => {
                  const value = e.target.value;
                  setFilterBy(value);
                  if (value === 'session' && !selectedSessionFilter) {
                    if (activeSession) {
                      setSelectedSessionFilter(activeSession.id);
                    } else if (data.sessions.length > 0) {
                      setSelectedSessionFilter(data.sessions[data.sessions.length - 1].id);
                    } else {
                      setSelectedSessionFilter(SESSION_FILTER_ALL);
                    }
                  }
                }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Items</option>
                <option value="project">Current Project</option>
                <option value="urgent">Urgent</option>
                <option value="due_week">Due This Week</option>
                <option value="to_do">Active To-Dos</option>
                <option value="session">Session Origin</option>
              </select>
              
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

              {data.sessions.length > 0 && (
                <select
                  value={selectedSessionFilter === SESSION_FILTER_ALL ? 'all' : selectedSessionFilter || ''}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === 'all') {
                      setSelectedSessionFilter(SESSION_FILTER_ALL);
                    } else if (next) {
                      setSelectedSessionFilter(next);
                    } else {
                      setSelectedSessionFilter(null);
                    }
                  }}
                  disabled={filterBy !== 'session'}
                  className={`px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${filterBy !== 'session' ? 'bg-gray-100 text-gray-500' : ''}`}
                >
                  <option value="">{activeSession ? 'Active Session' : 'Latest Session'}</option>
                  <option value="all">All Sessions</option>
                  {data.sessions.map(s => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              )}

              {tagFilter && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm">
                  <span>
                    {(tagFilter.type === 'project' && 'Project') ||
                     (tagFilter.type === 'type' && 'Type') ||
                     (tagFilter.type === 'status' && 'Status') ||
                     'Tag'}: {tagFilter.label}
                  </span>
                  <button
                    type="button"
                    onClick={clearTagFilter}
                    className="p-0.5 rounded-full hover:bg-blue-200 text-blue-700"
                    aria-label="Clear tag filter"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-6">
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
                      className="grid items-center gap-3 px-3 py-2 border-b border-gray-200 bg-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-600 select-none"
                      style={{ gridTemplateColumns }}
                    >
                      <div className="flex items-center gap-2">
                        <span>Item</span>
                        <span
                          className="ml-auto h-4 w-2 cursor-col-resize rounded-full bg-gray-300 hover:bg-gray-500"
                          onMouseDown={(event) => handleColumnResizeMouseDown(event, '__item__')}
                          role="separator"
                        />
                      </div>
                      {visibleColumns.map(column => {
                        const draggable = !column.alwaysVisible || column.id !== 'actions';
                        return (
                          <div
                            key={`header-${column.id}`}
                            className={`flex items-center gap-2 truncate ${draggable ? 'cursor-move' : ''}`}
                            draggable={draggable}
                            onDragStart={(event) => draggable && handleColumnDragStart(event, column.id)}
                            onDragOver={(event) => handleColumnDragOver(event, column.id)}
                            onDrop={(event) => handleColumnDrop(event, column.id)}
                            onDragEnd={handleColumnDragEnd}
                          >
                            <span>{column.label}</span>
                            <span
                              className="ml-auto h-4 w-2 cursor-col-resize rounded-full bg-gray-300 hover:bg-gray-500"
                              onMouseDown={(event) => handleColumnResizeMouseDown(event, column.id)}
                              role="separator"
                            />
                          </div>
                        );
                      })}
                      <div
                        className="h-6"
                        onDragOver={(event) => handleColumnDragOver(event, '__end__')}
                        onDrop={(event) => handleColumnDrop(event, '__end__')}
                      />
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
  const [projectId, setProjectId] = useState(note?.projectId || selectedProject || '');
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
        projectId: projectId || null,
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No project</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
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
