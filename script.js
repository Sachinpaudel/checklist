/* ==========================================================================
   TaskFlow – personal checklist & task manager (vanilla JavaScript)

   File map
     1. Constants
     2. Utilities (dates, ids, DOM helpers, icons)
     3. Storage (LocalStorage load / save / validate)
     4. Task operations (create, update, delete, duplicate, subtasks)
     5. Selectors (statistics, filtering, sorting)
     6. Toasts and confirmation dialog
     7. UI building blocks (cards, chips, empty states …)
     8. Views (dashboard, lists, calendar, categories, settings)
     9. Task form dialog and task details dialog
    10. Settings actions (theme, export/import, clear data, reminders)
    11. Navigation, rendering and event wiring
   Everything lives inside one function so nothing leaks into the global scope.
   ========================================================================== */
(() => {
  'use strict';

  /* ======================================================================
     1. CONSTANTS
     ====================================================================== */
  const STORAGE_KEYS = {
    tasks: 'taskflow.tasks.v1',
    settings: 'taskflow.settings.v1',
    notified: 'taskflow.notified.v1',
    corruptedBackup: 'taskflow.tasks.corrupted-backup',
  };

  const BACKUP_APP_NAME = 'TaskFlow';
  const BACKUP_VERSION = 1;
  const MAX_TITLE_LENGTH = 120;
  const MAX_DESCRIPTION_LENGTH = 2000;
  const MAX_SUBTASK_LENGTH = 120;
  const MAX_SUBTASKS = 50;
  const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
  const REMINDER_LEAD_MINUTES = 10;

  const CATEGORIES = ['Study', 'Coding', 'Open Source', 'Personal', 'Work', 'Other'];
  const PRIORITIES = ['Low', 'Medium', 'High'];
  const PRIORITY_RANK = { Low: 1, Medium: 2, High: 3 };
  const THEMES = ['light', 'dark', 'system'];

  const STATUS_FILTER_OPTIONS = [
    { value: 'all', label: 'All statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'completed', label: 'Completed' },
    { value: 'overdue', label: 'Overdue' },
  ];
  const PRIORITY_FILTER_OPTIONS = [{ value: 'all', label: 'All priorities' }, ...PRIORITIES.map((p) => ({ value: p, label: p }))];
  const CATEGORY_FILTER_OPTIONS = [{ value: 'all', label: 'All categories' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))];
  const DUE_FILTER_OPTIONS = [
    { value: 'all', label: 'Any date' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'today', label: 'Today' },
    { value: 'tomorrow', label: 'Tomorrow' },
    { value: 'next7', label: 'Next 7 days' },
    { value: 'month', label: 'This month' },
    { value: 'custom', label: 'Specific date…' },
  ];
  const SORT_OPTIONS = [
    { value: 'due-asc', label: 'Due date (soonest)' },
    { value: 'due-desc', label: 'Due date (latest)' },
    { value: 'priority-desc', label: 'Priority (high → low)' },
    { value: 'priority-asc', label: 'Priority (low → high)' },
    { value: 'created-desc', label: 'Created (newest)' },
    { value: 'created-asc', label: 'Created (oldest)' },
    { value: 'title-asc', label: 'Title (A → Z)' },
    { value: 'title-desc', label: 'Title (Z → A)' },
  ];

  // Sidebar / navigation definition. `id` doubles as the URL hash (#/today).
  const ROUTES = [
    { id: 'dashboard', label: 'Dashboard', icon: 'layout' },
    { id: 'tasks', label: 'My Tasks', icon: 'list' },
    { id: 'today', label: 'Today', icon: 'sun' },
    { id: 'upcoming', label: 'Upcoming', icon: 'clock' },
    { id: 'overdue', label: 'Overdue', icon: 'alert' },
    { id: 'completed', label: 'Completed', icon: 'check-circle' },
    { id: 'calendar', label: 'Calendar', icon: 'calendar' },
    { id: 'categories', label: 'Categories', icon: 'folder' },
    { id: 'settings', label: 'Settings', icon: 'sliders' },
  ];
  const BOTTOM_NAV_ROUTES = ['dashboard', 'today', 'tasks', 'calendar'];

  // SVG path data (24x24 grid, stroke style). Icons are built with createElementNS, never innerHTML.
  const ICON_PATHS = {
    plus: 'M12 5v14M5 12h14',
    edit: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z',
    trash: 'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6',
    copy: 'M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2zM5 15H4a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1',
    star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
    check: 'M20 6L9 17l-5-5',
    'check-circle': 'M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4L12 14l-3-3',
    'check-square': 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
    calendar: 'M3 5h18v16H3zM16 3v4M8 3v4M3 10h18',
    sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
    menu: 'M3 6h18M3 12h18M3 18h18',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    layout: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
    alert: 'M12 3L2 20h20zM12 10v4M12 17h.01',
    folder: 'M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
    sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3',
    'chevron-left': 'M15 18l-6-6 6-6',
    'chevron-right': 'M9 18l6-6-6-6',
    x: 'M18 6L6 18M6 6l12 12',
    flag: 'M4 22V4M4 4h13l-2 4 2 4H4',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
    inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.5 5.1L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z',
    eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  };

  /* ======================================================================
     State (the single source of truth for what is on screen)
     ====================================================================== */
  const state = {
    tasks: [],
    settings: { theme: 'system', notificationsEnabled: false },
    view: 'dashboard',
    filters: createDefaultFilters(),
    sort: 'due-asc',
    calendar: { year: 0, month: 0, selected: '' },
    selectedCategory: null,
    detailsTaskId: null,
  };

  // References to static DOM elements, filled in by cacheRefs() once the page is ready.
  const refs = {};

  function createDefaultFilters() {
    return { search: '', status: 'all', priority: 'all', category: 'all', due: 'all', dueDate: '' };
  }

  /* ======================================================================
     2. UTILITIES
     ====================================================================== */

  // ---- Dates: always local time, stored as plain "YYYY-MM-DD" strings so time zones never shift a due date.
  const pad = (number) => String(number).padStart(2, '0');

  function toDateKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function todayKey() {
    return toDateKey(new Date());
  }

  function parseDateKey(key) {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function isValidDateKey(key) {
    if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
    // Round-trip check rejects impossible dates such as 2026-02-31.
    return toDateKey(parseDateKey(key)) === key;
  }

  function isValidTimeKey(value) {
    return value === '' || (typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value));
  }

  function addDays(key, amount) {
    const date = parseDateKey(key);
    date.setDate(date.getDate() + amount);
    return toDateKey(date);
  }

  // The exact moment a task is due (end of nothing: without a time we use the start of the due day).
  function getDueMoment(task) {
    const due = parseDateKey(task.dueDate);
    if (task.dueTime) {
      const [hours, minutes] = task.dueTime.split(':').map(Number);
      due.setHours(hours, minutes, 0, 0);
    }
    return due;
  }

  /**
   * A task is overdue when it is not completed and its due moment has passed.
   * - With a due time: overdue once that exact time has passed.
   * - Without a due time: overdue only after the whole due date has passed.
   */
  function isOverdue(task, now = new Date()) {
    if (task.status === 'completed') return false;
    if (task.dueTime) return getDueMoment(task) < now;
    return task.dueDate < toDateKey(now);
  }

  function isValidIso(value) {
    return typeof value === 'string' && !Number.isNaN(Date.parse(value));
  }

  function formatLongDate(date) {
    return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  function formatShortDate(key) {
    const date = parseDateKey(key);
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    if (date.getFullYear() !== new Date().getFullYear()) options.year = 'numeric';
    return date.toLocaleDateString(undefined, options);
  }

  function formatRelativeDay(key) {
    const today = todayKey();
    if (key === today) return 'Today';
    if (key === addDays(today, 1)) return 'Tomorrow';
    if (key === addDays(today, -1)) return 'Yesterday';
    return formatShortDate(key);
  }

  function formatTime(timeKey) {
    const [hours, minutes] = timeKey.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function formatDueText(task) {
    const day = formatRelativeDay(task.dueDate);
    return task.dueTime ? `${day}, ${formatTime(task.dueTime)}` : day;
  }

  function formatTimestamp(iso) {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  function getGreeting(now = new Date()) {
    const hour = now.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function pluralize(count, word) {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
  }

  function slugify(text) {
    return text.toLowerCase().replace(/\s+/g, '-');
  }

  function generateId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function classNames(...parts) {
    return parts.filter(Boolean).join(' ');
  }

  // ---- DOM helpers. Text is always set with textContent / text nodes, so task text can never inject HTML.
  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    let pendingValue;
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'dataset') Object.assign(node.dataset, value);
      else if (key === 'value') pendingValue = value; // set after children so <select> options exist
      else if (key === 'checked' || key === 'disabled') node[key] = value;
      else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
      else node.setAttribute(key, value === true ? '' : String(value));
    }
    appendChildren(node, children);
    if (pendingValue !== undefined) node.value = pendingValue;
    return node;
  }

  function appendChildren(parent, children) {
    for (const child of children.flat(Infinity)) {
      if (child === null || child === undefined || child === false) continue;
      parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
  }

  function icon(name, size = 18) {
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', 'icon');
    const path = document.createElementNS(svgNs, 'path');
    path.setAttribute('d', ICON_PATHS[name] || '');
    svg.append(path);
    return svg;
  }

  /* ======================================================================
     3. STORAGE
     ====================================================================== */

  /** Turn untrusted data (from LocalStorage or an import file) into a clean task, or null if unusable. */
  function sanitizeTask(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    if (!title || !isValidDateKey(raw.dueDate)) return null;

    const nowIso = new Date().toISOString();
    const status = raw.status === 'completed' ? 'completed' : 'pending';
    const createdAt = isValidIso(raw.createdAt) ? raw.createdAt : nowIso;
    const seenSubtaskIds = new Set();
    const subtasks = Array.isArray(raw.subtasks)
      ? raw.subtasks
          .map(sanitizeSubtask)
          .filter((subtask) => {
            if (!subtask || seenSubtaskIds.has(subtask.id)) return false;
            seenSubtaskIds.add(subtask.id);
            return true;
          })
          .slice(0, MAX_SUBTASKS)
      : [];

    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : generateId(),
      title: title.slice(0, MAX_TITLE_LENGTH),
      description: typeof raw.description === 'string' ? raw.description.slice(0, MAX_DESCRIPTION_LENGTH) : '',
      dueDate: raw.dueDate,
      dueTime: isValidTimeKey(raw.dueTime) ? raw.dueTime : '',
      category: CATEGORIES.includes(raw.category) ? raw.category : 'Other',
      priority: PRIORITIES.includes(raw.priority) ? raw.priority : 'Medium',
      status,
      subtasks,
      planDate: isValidDateKey(raw.planDate) ? raw.planDate : '',
      createdAt,
      updatedAt: isValidIso(raw.updatedAt) ? raw.updatedAt : createdAt,
      completedAt: status === 'completed' ? (isValidIso(raw.completedAt) ? raw.completedAt : nowIso) : null,
    };
  }

  function sanitizeSubtask(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    if (!title) return null;
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : generateId(),
      title: title.slice(0, MAX_SUBTASK_LENGTH),
      done: raw.done === true,
    };
  }

  function loadTasks() {
    let rawText = null;
    try {
      rawText = localStorage.getItem(STORAGE_KEYS.tasks);
      if (!rawText) return [];
      const parsed = JSON.parse(rawText);
      if (!Array.isArray(parsed)) throw new Error('Stored tasks are not a list.');
      const seenIds = new Set();
      return parsed
        .map(sanitizeTask)
        .filter((task) => {
          if (!task || seenIds.has(task.id)) return false;
          seenIds.add(task.id);
          return true;
        });
    } catch (error) {
      console.warn('TaskFlow: stored tasks could not be read.', error);
      // Keep a copy of the unreadable data so it is never silently destroyed.
      try {
        if (rawText) localStorage.setItem(STORAGE_KEYS.corruptedBackup, rawText);
      } catch (backupError) { /* storage may be full; nothing else we can do */ }
      showToast('Your saved tasks could not be read, so TaskFlow started fresh. A raw copy was kept in this browser.', 'error');
      return [];
    }
  }

  function persistTasks() {
    try {
      localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(state.tasks));
      return true;
    } catch (error) {
      console.error('TaskFlow: saving failed.', error);
      showToast('Could not save to this browser (storage may be full or blocked). Export a backup if you can.', 'error');
      return false;
    }
  }

  function loadSettings() {
    const defaults = { theme: 'system', notificationsEnabled: false };
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings));
      if (!parsed || typeof parsed !== 'object') return defaults;
      return {
        theme: THEMES.includes(parsed.theme) ? parsed.theme : defaults.theme,
        notificationsEnabled: parsed.notificationsEnabled === true,
      };
    } catch (error) {
      return defaults;
    }
  }

  function persistSettings() {
    try {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
    } catch (error) {
      console.warn('TaskFlow: settings could not be saved.', error);
    }
  }

  /* ======================================================================
     4. TASK OPERATIONS (these change data; they never touch the DOM)
     ====================================================================== */
  function findTask(taskId) {
    return state.tasks.find((task) => task.id === taskId) || null;
  }

  function createTask(data) {
    const nowIso = new Date().toISOString();
    const task = {
      id: generateId(),
      title: data.title,
      description: data.description,
      dueDate: data.dueDate,
      dueTime: data.dueTime,
      category: data.category,
      priority: data.priority,
      status: data.status,
      subtasks: data.subtasks,
      planDate: '',
      createdAt: nowIso,
      updatedAt: nowIso,
      completedAt: data.status === 'completed' ? nowIso : null,
    };
    state.tasks.push(task);
    persistTasks();
    return task;
  }

  /** Update an existing task in place (never creates a duplicate). Returns the task or null. */
  function updateTask(taskId, changes) {
    const task = findTask(taskId);
    if (!task) return null;
    const wasCompleted = task.status === 'completed';
    Object.assign(task, changes);
    const nowIso = new Date().toISOString();
    if (task.status === 'completed' && !wasCompleted) task.completedAt = nowIso;
    if (task.status !== 'completed') task.completedAt = null;
    task.updatedAt = nowIso;
    persistTasks();
    return task;
  }

  function deleteTask(taskId) {
    const before = state.tasks.length;
    state.tasks = state.tasks.filter((task) => task.id !== taskId);
    if (state.tasks.length !== before) persistTasks();
    return state.tasks.length !== before;
  }

  function duplicateTask(taskId) {
    const original = findTask(taskId);
    if (!original) return null;
    const nowIso = new Date().toISOString();
    const copy = {
      ...original,
      id: generateId(),
      title: `${original.title} (copy)`.slice(0, MAX_TITLE_LENGTH),
      status: 'pending',
      subtasks: original.subtasks.map((subtask) => ({ id: generateId(), title: subtask.title, done: false })),
      planDate: '',
      createdAt: nowIso,
      updatedAt: nowIso,
      completedAt: null,
    };
    state.tasks.push(copy);
    persistTasks();
    return copy;
  }

  /** Run `change(task)` on one task, stamp updatedAt and save. Used for subtask edits and priority toggles. */
  function modifyTask(taskId, change) {
    const task = findTask(taskId);
    if (!task) return null;
    change(task);
    task.updatedAt = new Date().toISOString();
    persistTasks();
    return task;
  }

  /* ======================================================================
     5. SELECTORS (read-only calculations on the task list)
     ====================================================================== */
  function getStats(tasks) {
    const now = new Date();
    const today = toDateKey(now);
    return {
      total: tasks.length,
      completed: tasks.filter((task) => task.status === 'completed').length,
      pending: tasks.filter((task) => task.status === 'pending').length,
      overdue: tasks.filter((task) => isOverdue(task, now)).length,
      dueToday: tasks.filter((task) => task.dueDate === today).length,
    };
  }

  function getDailySummary() {
    const today = todayKey();
    const dueToday = state.tasks.filter((task) => task.dueDate === today);
    const dueTodayDone = dueToday.filter((task) => task.status === 'completed').length;
    const completedToday = state.tasks.filter(
      (task) => task.completedAt && toDateKey(new Date(task.completedAt)) === today
    ).length;
    return {
      dueTodayCount: dueToday.length,
      dueTodayDone,
      completedToday,
      percent: dueToday.length ? Math.round((dueTodayDone / dueToday.length) * 100) : 0,
    };
  }

  function describeDailySummary(summary) {
    if (summary.dueTodayCount === 0) {
      return summary.completedToday
        ? `Nothing is due today, and you completed ${pluralize(summary.completedToday, 'task')} today.`
        : 'Nothing is due today.';
    }
    const base = `${summary.dueTodayDone} of ${pluralize(summary.dueTodayCount, 'task')} due today completed`;
    return summary.completedToday ? `${base} · ${summary.completedToday} finished today in total` : base;
  }

  function matchesDueFilter(task, filters, today) {
    switch (filters.due) {
      case 'overdue': return isOverdue(task);
      case 'today': return task.dueDate === today;
      case 'tomorrow': return task.dueDate === addDays(today, 1);
      case 'next7': return task.dueDate >= today && task.dueDate <= addDays(today, 6);
      case 'month': return task.dueDate.slice(0, 7) === today.slice(0, 7);
      case 'custom': return filters.dueDate ? task.dueDate === filters.dueDate : true;
      default: return true;
    }
  }

  /** Search, status, priority, category and due-date filters all apply together (logical AND). */
  function applyFilters(tasks, filters) {
    const query = filters.search.trim().toLowerCase();
    const today = todayKey();
    const now = new Date();
    return tasks.filter((task) => {
      if (query && !`${task.title}\n${task.description}`.toLowerCase().includes(query)) return false;
      if (filters.status === 'pending' && task.status !== 'pending') return false;
      if (filters.status === 'completed' && task.status !== 'completed') return false;
      if (filters.status === 'overdue' && !isOverdue(task, now)) return false;
      if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
      if (filters.category !== 'all' && task.category !== filters.category) return false;
      return matchesDueFilter(task, filters, today);
    });
  }

  function compareTitles(a, b) {
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true });
  }

  function compareDue(a, b) {
    // Tasks with a time sort before untimed tasks on the same day.
    const keyA = `${a.dueDate} ${a.dueTime || '99:99'}`;
    const keyB = `${b.dueDate} ${b.dueTime || '99:99'}`;
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  }

  function sortTasks(tasks, sortKey) {
    const sorted = [...tasks];
    const comparators = {
      'due-asc': (a, b) => compareDue(a, b) || compareTitles(a, b),
      'due-desc': (a, b) => compareDue(b, a) || compareTitles(a, b),
      'priority-desc': (a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || compareDue(a, b),
      'priority-asc': (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || compareDue(a, b),
      'created-desc': (a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0),
      'created-asc': (a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0),
      'title-asc': (a, b) => compareTitles(a, b),
      'title-desc': (a, b) => compareTitles(b, a),
    };
    sorted.sort(comparators[sortKey] || comparators['due-asc']);
    return sorted;
  }

  function hasActiveFilters() {
    const f = state.filters;
    return Boolean(f.search.trim()) || f.status !== 'all' || f.priority !== 'all' || f.category !== 'all' || f.due !== 'all';
  }

  const isPlannedForToday = (task) => task.planDate === todayKey();

  /* ======================================================================
     6. TOASTS AND CONFIRMATION DIALOG
     ====================================================================== */
  function showToast(message, type = 'success') {
    if (!refs.toastRegion) return;
    const iconName = type === 'error' ? 'alert' : type === 'info' ? 'bell' : 'check-circle';
    const toast = el(
      'div',
      { class: `toast toast-${type}`, role: type === 'error' ? 'alert' : 'status' },
      icon(iconName, 18),
      el('span', { text: message }),
      el('button', { type: 'button', class: 'toast-close', 'aria-label': 'Dismiss notification', onClick: () => removeToast(toast) }, icon('x', 14))
    );
    refs.toastRegion.append(toast);
    while (refs.toastRegion.children.length > 4) refs.toastRegion.firstElementChild.remove();
    window.setTimeout(() => removeToast(toast), type === 'error' ? 7000 : 3500);
  }

  function removeToast(toast) {
    if (!toast.isConnected) return;
    toast.classList.add('is-leaving');
    window.setTimeout(() => toast.remove(), 160);
  }

  /**
   * Ask the user to confirm something. Resolves to 'confirm', 'secondary' or 'cancel'.
   * Buttons use onclick properties so listeners never pile up between calls.
   */
  function askConfirmation({ title, message, confirmLabel = 'Confirm', secondaryLabel = '', danger = false }) {
    if (refs.confirmDialog.open) return Promise.resolve('cancel');
    return new Promise((resolve) => {
      let result = 'cancel';
      refs.confirmTitle.textContent = title;
      refs.confirmMessage.textContent = message;
      refs.confirmOk.textContent = confirmLabel;
      refs.confirmOk.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
      refs.confirmSecondary.hidden = !secondaryLabel;
      refs.confirmSecondary.textContent = secondaryLabel;

      const finish = (value) => () => {
        result = value;
        refs.confirmDialog.close();
      };
      refs.confirmOk.onclick = finish('confirm');
      refs.confirmSecondary.onclick = finish('secondary');
      refs.confirmCancel.onclick = finish('cancel');
      refs.confirmDialog.addEventListener('close', () => resolve(result), { once: true });
      refs.confirmDialog.showModal();
      // Focus the safe choice first when the action is destructive.
      (danger ? refs.confirmCancel : refs.confirmOk).focus();
    });
  }

  /* ======================================================================
     7. UI BUILDING BLOCKS
     ====================================================================== */
  function iconButton({ iconName, label, onClick, pressed, focusKey, className = '' }) {
    return el(
      'button',
      {
        type: 'button',
        class: classNames('icon-btn', className),
        'aria-label': label,
        title: label,
        'aria-pressed': pressed === undefined ? undefined : String(pressed),
        'data-focus-key': focusKey,
        onClick,
      },
      icon(iconName)
    );
  }

  function createPageHeader(title, subtitle, actions = []) {
    return el(
      'header',
      { class: 'page-header' },
      el('div', {}, el('h1', { text: title, tabindex: '-1' }), subtitle ? el('p', { class: 'page-subtitle', text: subtitle }) : null),
      actions.length ? el('div', { class: 'page-actions' }, actions) : null
    );
  }

  function createPanel({ title, count, note, actions, children = [] }) {
    return el(
      'section',
      { class: 'panel' },
      el(
        'div',
        { class: 'panel-header' },
        el('h2', { class: 'panel-title' }, title, count !== undefined ? el('span', { class: 'count', text: String(count) }) : null),
        actions ? el('div', { class: 'page-actions' }, actions) : null
      ),
      note ? el('p', { class: 'panel-note', text: note }) : null,
      children
    );
  }

  function createEmptyState({ iconName = 'inbox', title, message, actionLabel, onAction, compact = false }) {
    return el(
      'div',
      { class: classNames('empty-state', compact && 'compact') },
      el('span', { class: 'empty-icon' }, icon(iconName, 24)),
      el('h3', { text: title }),
      message ? el('p', { text: message }) : null,
      actionLabel ? el('button', { type: 'button', class: 'btn btn-primary', onClick: onAction }, el('span', { class: 'btn-label', text: actionLabel })) : null
    );
  }

  function createProgressBar(percent, label) {
    const fill = el('div', { class: 'progress-fill' });
    fill.style.width = `${percent}%`;
    return el(
      'div',
      { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(percent), 'aria-label': label },
      fill
    );
  }

  function createStatCard({ label, value, iconName, tone, onClick }) {
    return el(
      'button',
      { type: 'button', class: classNames('stat-card', tone && `tone-${tone}`), onClick },
      el('span', { class: 'stat-icon' }, icon(iconName, 20)),
      el('span', { class: 'stat-value', text: String(value) }),
      el('span', { class: 'stat-label', text: label })
    );
  }

  function createCategoryChip(category) {
    return el('span', { class: 'chip', dataset: { category: slugify(category) } }, el('span', { class: 'dot' }), category);
  }

  function createPriorityBadge(priority) {
    return el('span', { class: `badge badge-${priority.toLowerCase()}` }, priority === 'High' ? icon('flag', 12) : null, priority);
  }

  function createTaskCard(task) {
    const done = task.status === 'completed';
    const overdue = isOverdue(task);
    const planned = isPlannedForToday(task);
    const subtaskTotal = task.subtasks.length;
    const subtaskDone = task.subtasks.filter((subtask) => subtask.done).length;

    const checkbox = el('input', {
      type: 'checkbox',
      class: 'check-input',
      checked: done,
      'aria-label': done ? `Mark “${task.title}” as pending` : `Mark “${task.title}” as completed`,
      'data-focus-key': `toggle-${task.id}`,
      onChange: () => handleToggleComplete(task.id),
    });

    const dueChip = el(
      'span',
      { class: classNames('chip', overdue && 'is-overdue', !done && !overdue && task.dueDate === todayKey() && 'is-today') },
      icon(task.dueTime ? 'clock' : 'calendar', 14),
      formatDueText(task),
      overdue ? ' · Overdue' : null
    );

    let subtaskChip = null;
    if (subtaskTotal > 0) {
      const fill = el('span');
      fill.style.width = `${Math.round((subtaskDone / subtaskTotal) * 100)}%`;
      subtaskChip = el(
        'span',
        { class: 'chip', title: 'Subtask progress' },
        icon('check-square', 14),
        `${subtaskDone}/${subtaskTotal}`,
        el('span', { class: 'mini-progress', 'aria-hidden': 'true' }, fill)
      );
    }

    return el(
      'article',
      { class: classNames('task-card', done && 'is-completed', overdue && 'is-overdue'), dataset: { priority: task.priority } },
      el('label', { class: 'check' }, checkbox, el('span', { class: 'check-box' }, icon('check', 14))),
      el(
        'div',
        { class: 'task-body' },
        el('button', { type: 'button', class: 'task-title', text: task.title, 'data-focus-key': `open-${task.id}`, onClick: () => openDetails(task.id) }),
        el('div', { class: 'task-meta' }, dueChip, createPriorityBadge(task.priority), createCategoryChip(task.category), subtaskChip),
        task.description ? el('p', { class: 'task-description', text: task.description }) : null
      ),
      el(
        'div',
        { class: 'task-actions' },
        iconButton({
          iconName: 'star',
          label: planned ? 'Remove from today’s priorities' : 'Add to today’s priorities',
          pressed: planned,
          focusKey: `star-${task.id}`,
          onClick: () => handleTogglePriority(task.id),
        }),
        iconButton({ iconName: 'edit', label: `Edit “${task.title}”`, focusKey: `edit-${task.id}`, onClick: () => openTaskForm({ task }) }),
        iconButton({ iconName: 'copy', label: `Duplicate “${task.title}”`, focusKey: `dup-${task.id}`, onClick: () => handleDuplicate(task.id) }),
        iconButton({ iconName: 'trash', label: `Delete “${task.title}”`, className: 'danger', focusKey: `del-${task.id}`, onClick: () => handleDelete(task.id) })
      )
    );
  }

  function createTaskList(tasks, emptyState) {
    if (tasks.length === 0) return createEmptyState(emptyState);
    return el('div', { class: 'task-list' }, tasks.map(createTaskCard));
  }

  function createSelectField({ id, label, options, value, onChange }) {
    return el(
      'div',
      { class: 'field' },
      el('label', { for: id, text: label }),
      el(
        'select',
        { id, value, 'data-focus-key': id, onChange: (event) => onChange(event.target.value) },
        options.map((option) => el('option', { value: option.value, text: option.label }))
      )
    );
  }

  /* ======================================================================
     8. VIEWS – each returns a DOM element for <main>
     ====================================================================== */

  // ---- Dashboard
  function renderDashboardView() {
    const now = new Date();
    const stats = getStats(state.tasks);
    const percent = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;
    const summary = getDailySummary();

    const priorities = sortTasks(state.tasks.filter(isPlannedForToday), 'due-asc').sort(
      (a, b) => Number(a.status === 'completed') - Number(b.status === 'completed')
    );
    const upcoming = sortTasks(
      state.tasks.filter((task) => task.status === 'pending' && task.dueDate > todayKey()),
      'due-asc'
    ).slice(0, 5);

    const hero = el(
      'section',
      { class: 'hero' },
      el(
        'div',
        {},
        el('p', { class: 'eyebrow', text: formatLongDate(now) }),
        el('h1', { text: getGreeting(now), tabindex: '-1' }),
        el('p', { class: 'page-subtitle', text: describeDailySummary(summary) })
      ),
      el('button', { type: 'button', class: 'btn btn-primary btn-lg', onClick: () => openTaskForm() }, icon('plus'), el('span', { class: 'btn-label', text: 'Add Task' }))
    );

    const statsGrid = el(
      'section',
      { class: 'stats-grid', 'aria-label': 'Task statistics' },
      createStatCard({ label: 'Total tasks', value: stats.total, iconName: 'list', onClick: () => goToTasksWith({}) }),
      createStatCard({ label: 'Completed', value: stats.completed, iconName: 'check-circle', tone: 'success', onClick: () => navigate('completed') }),
      createStatCard({ label: 'Pending', value: stats.pending, iconName: 'clock', tone: 'warning', onClick: () => goToTasksWith({ status: 'pending' }) }),
      createStatCard({ label: 'Overdue', value: stats.overdue, iconName: 'alert', tone: 'danger', onClick: () => navigate('overdue') }),
      createStatCard({ label: 'Due today', value: stats.dueToday, iconName: 'sun', onClick: () => navigate('today') })
    );

    const progressPanel = createPanel({
      title: 'Overall progress',
      children: [
        el('div', { class: 'progress-meta' }, el('span', { class: 'progress-percent', text: `${percent}%` }), el('span', { class: 'page-subtitle', text: `${stats.completed} of ${pluralize(stats.total, 'task')} completed` })),
        createProgressBar(percent, 'Overall completion'),
        el('p', { class: 'progress-caption', text: stats.total ? describeDailySummary(summary) : 'Add your first task to start tracking progress.' }),
      ],
    });

    const prioritiesPanel = createPanel({
      title: 'Today’s priorities',
      count: priorities.length,
      actions: [el('button', { type: 'button', class: 'btn btn-secondary btn-sm', onClick: () => navigate('today') }, 'Plan my day')],
      children: [
        createTaskList(priorities, {
          iconName: 'star',
          title: 'No priorities picked yet',
          message: 'Star the tasks that matter most today, or open Plan My Day to choose them.',
          compact: true,
        }),
      ],
    });

    const upcomingPanel = createPanel({
      title: 'Upcoming',
      count: upcoming.length,
      actions: [el('button', { type: 'button', class: 'btn btn-secondary btn-sm', onClick: () => navigate('upcoming') }, 'View all')],
      children: [
        createTaskList(upcoming, {
          iconName: 'calendar',
          title: 'Nothing coming up',
          message: 'Tasks with a future due date will show up here.',
          compact: true,
        }),
      ],
    });

    return el('div', { class: 'view' }, hero, statsGrid, progressPanel, el('div', { class: 'two-column' }, prioritiesPanel, upcomingPanel));
  }

  function goToTasksWith(filterChanges) {
    state.filters = { ...createDefaultFilters(), ...filterChanges };
    refs.searchInput.value = '';
    navigate('tasks');
  }

  // ---- My Tasks (search + filters + sorting)
  function renderTasksView() {
    const filtered = sortTasks(applyFilters(state.tasks, state.filters), state.sort);
    const f = state.filters;

    const toolbar = el(
      'div',
      { class: 'toolbar', role: 'group', 'aria-label': 'Filter and sort tasks' },
      createSelectField({ id: 'filter-status', label: 'Status', options: STATUS_FILTER_OPTIONS, value: f.status, onChange: (v) => setFilter('status', v, 'filter-status') }),
      createSelectField({ id: 'filter-priority', label: 'Priority', options: PRIORITY_FILTER_OPTIONS, value: f.priority, onChange: (v) => setFilter('priority', v, 'filter-priority') }),
      createSelectField({ id: 'filter-category', label: 'Category', options: CATEGORY_FILTER_OPTIONS, value: f.category, onChange: (v) => setFilter('category', v, 'filter-category') }),
      createSelectField({ id: 'filter-due', label: 'Due date', options: DUE_FILTER_OPTIONS, value: f.due, onChange: (v) => setFilter('due', v, 'filter-due') }),
      f.due === 'custom'
        ? el(
            'div',
            { class: 'field' },
            el('label', { for: 'filter-due-date', text: 'On date' }),
            el('input', { id: 'filter-due-date', type: 'date', value: f.dueDate, 'data-focus-key': 'filter-due-date', onChange: (event) => setFilter('dueDate', event.target.value, 'filter-due-date') })
          )
        : null,
      createSelectField({ id: 'sort-by', label: 'Sort by', options: SORT_OPTIONS, value: state.sort, onChange: (v) => { state.sort = v; render({ focusKey: 'sort-by' }); } })
    );

    const searchNote = f.search.trim() ? ` matching “${f.search.trim()}”` : '';
    const footer = el(
      'div',
      { class: 'toolbar-footer' },
      el('span', { 'aria-live': 'polite', text: `Showing ${filtered.length} of ${pluralize(state.tasks.length, 'task')}${searchNote}` }),
      el('button', { type: 'button', class: 'btn btn-secondary btn-sm', disabled: !hasActiveFilters(), onClick: clearFilters }, 'Clear filters')
    );

    const emptyState = state.tasks.length === 0
      ? { iconName: 'list', title: 'No tasks yet', message: 'Create your first task to start organizing your day.', actionLabel: 'Add Task', onAction: () => openTaskForm() }
      : { iconName: 'search', title: 'No tasks match these filters', message: 'Try a different search or clear the filters to see everything.', actionLabel: 'Clear filters', onAction: clearFilters };

    return el(
      'div',
      { class: 'view' },
      createPageHeader('My Tasks', 'Every task in one place. Search, filter and sort to find what you need.', [
        el('button', { type: 'button', class: 'btn btn-primary', onClick: () => openTaskForm() }, icon('plus'), el('span', { class: 'btn-label', text: 'Add Task' })),
      ]),
      el('section', { class: 'panel' }, toolbar, footer),
      createTaskList(filtered, emptyState)
    );
  }

  function setFilter(key, value, focusKey) {
    state.filters[key] = value;
    render({ focusKey });
  }

  function clearFilters() {
    state.filters = createDefaultFilters();
    refs.searchInput.value = '';
    render();
    showToast('Filters cleared.', 'info');
  }

  // ---- Today (daily summary + Plan My Day)
  function renderTodayView() {
    const today = todayKey();
    const summary = getDailySummary();
    const byDue = (list) => sortTasks(list, 'due-asc');

    const priorities = byDue(state.tasks.filter(isPlannedForToday)).sort(
      (a, b) => Number(a.status === 'completed') - Number(b.status === 'completed')
    );
    const alsoDueToday = byDue(state.tasks.filter((task) => task.dueDate === today && !isPlannedForToday(task)));
    const overdueEarlier = byDue(state.tasks.filter((task) => isOverdue(task) && task.dueDate < today && !isPlannedForToday(task)));

    // Pending tasks that could still be starred for today
    const candidates = byDue(state.tasks.filter((task) => task.status === 'pending' && !isPlannedForToday(task)));
    const addPriorityControl = candidates.length
      ? el(
          'div',
          { class: 'field' },
          el('label', { for: 'plan-add', text: 'Add any pending task to today’s priorities' }),
          el(
            'select',
            {
              id: 'plan-add',
              'data-focus-key': 'plan-add',
              onChange: (event) => {
                if (event.target.value) handleTogglePriority(event.target.value);
              },
            },
            el('option', { value: '', text: 'Choose a task…' }),
            candidates.map((task) => el('option', { value: task.id, text: `${task.title} (${formatRelativeDay(task.dueDate)})` }))
          )
        )
      : null;

    const summaryPanel = createPanel({
      title: 'Daily completion summary',
      children: [
        el('div', { class: 'progress-meta' }, el('span', { class: 'progress-percent', text: `${summary.percent}%` }), el('span', { class: 'page-subtitle', text: describeDailySummary(summary) })),
        createProgressBar(summary.percent, 'Completion of tasks due today'),
      ],
    });

    const planPanel = createPanel({
      title: 'Plan My Day',
      count: priorities.length,
      note: 'Pick the few tasks that matter most today with the ★ button. Priorities reset automatically tomorrow.',
      children: [
        createTaskList(priorities, { iconName: 'star', title: 'No priorities yet', message: 'Star a task below, or choose one from the list.', compact: true }),
        addPriorityControl ? el('div', { style: 'margin-top:14px' }, addPriorityControl) : null,
      ],
    });

    const sections = [summaryPanel, planPanel];
    if (alsoDueToday.length) sections.push(createPanel({ title: 'Also due today', count: alsoDueToday.length, children: [createTaskList(alsoDueToday, {})] }));
    if (overdueEarlier.length) sections.push(createPanel({ title: 'Overdue – needs attention', count: overdueEarlier.length, children: [createTaskList(overdueEarlier, {})] }));

    if (priorities.length === 0 && alsoDueToday.length === 0 && overdueEarlier.length === 0) {
      sections.push(
        createEmptyState({ iconName: 'sun', title: 'A clear day', message: 'Nothing is due today. Add a task or enjoy the free time.', actionLabel: 'Add Task', onAction: () => openTaskForm({ presetDate: today }) })
      );
    }

    return el(
      'div',
      { class: 'view' },
      createPageHeader('Today', formatLongDate(new Date()), [
        el('button', { type: 'button', class: 'btn btn-primary', onClick: () => openTaskForm({ presetDate: today }) }, icon('plus'), el('span', { class: 'btn-label', text: 'Add Task' })),
      ]),
      el('div', { class: 'stack' }, sections)
    );
  }

  // ---- Upcoming (future pending tasks grouped by date)
  function renderUpcomingView() {
    const today = todayKey();
    const upcoming = sortTasks(state.tasks.filter((task) => task.status === 'pending' && task.dueDate > today), 'due-asc');

    const groups = new Map();
    for (const task of upcoming) {
      if (!groups.has(task.dueDate)) groups.set(task.dueDate, []);
      groups.get(task.dueDate).push(task);
    }

    const content = upcoming.length
      ? [...groups.entries()].map(([dateKey, tasks]) =>
          el(
            'section',
            { class: 'group' },
            el('h2', { class: 'group-heading', text: `${formatRelativeDay(dateKey)} · ${formatLongDate(parseDateKey(dateKey))}` }),
            createTaskList(tasks, {})
          )
        )
      : createEmptyState({ iconName: 'calendar', title: 'Nothing upcoming', message: 'Pending tasks with a future due date will appear here, grouped by day.', actionLabel: 'Add Task', onAction: () => openTaskForm({ presetDate: addDays(today, 1) }) });

    return el('div', { class: 'view' }, createPageHeader('Upcoming', `${pluralize(upcoming.length, 'pending task')} scheduled after today.`), content);
  }

  // ---- Overdue
  function renderOverdueView() {
    const overdue = sortTasks(state.tasks.filter((task) => isOverdue(task)), 'due-asc');
    return el(
      'div',
      { class: 'view' },
      createPageHeader('Overdue', overdue.length ? `${pluralize(overdue.length, 'task')} past ${overdue.length === 1 ? 'its' : 'their'} due ${overdue.length === 1 ? 'date' : 'dates'}.` : 'Nothing is overdue.'),
      createTaskList(overdue, { iconName: 'check-circle', title: 'You’re all caught up', message: 'No pending task has passed its due date or time.' })
    );
  }

  // ---- Completed
  function renderCompletedView() {
    const completed = state.tasks
      .filter((task) => task.status === 'completed')
      .sort((a, b) => (a.completedAt < b.completedAt ? 1 : a.completedAt > b.completedAt ? -1 : 0));

    const actions = completed.length
      ? [el('button', { type: 'button', class: 'btn btn-danger-outline', onClick: handleClearCompleted }, icon('trash'), el('span', { class: 'btn-label', text: 'Delete all completed' }))]
      : [];

    return el(
      'div',
      { class: 'view' },
      createPageHeader('Completed', 'Finished tasks stay here until you delete them.', actions),
      createTaskList(completed, { iconName: 'check-circle', title: 'No completed tasks yet', message: 'Tick the checkbox on a task and it will be kept here.' })
    );
  }

  // ---- Calendar
  function setCalendarMonth(year, month) {
    const first = new Date(year, month, 1);
    state.calendar.year = first.getFullYear();
    state.calendar.month = first.getMonth();
    const today = new Date();
    const containsToday = today.getFullYear() === first.getFullYear() && today.getMonth() === first.getMonth();
    state.calendar.selected = containsToday ? toDateKey(today) : toDateKey(first);
  }

  function selectCalendarDate(dateKey, focus = false) {
    const date = parseDateKey(dateKey);
    state.calendar.selected = dateKey;
    state.calendar.year = date.getFullYear();
    state.calendar.month = date.getMonth();
    render({ focusKey: focus ? `cal-${dateKey}` : `cal-${dateKey}` });
  }

  function handleCalendarKeydown(event, dateKey) {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(event.key in moves)) return;
    event.preventDefault();
    selectCalendarDate(addDays(dateKey, moves[event.key]), true);
  }

  function buildCalendarDays(year, month) {
    const firstOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cellCount = Math.ceil((firstOfMonth.getDay() + daysInMonth) / 7) * 7; // weeks start on Sunday
    const days = [];
    for (let index = 0; index < cellCount; index += 1) {
      days.push(new Date(year, month, 1 - firstOfMonth.getDay() + index));
    }
    return days;
  }

  function renderCalendarView() {
    const { year, month, selected } = state.calendar;
    const today = todayKey();
    const days = buildCalendarDays(year, month);

    const tasksByDate = new Map();
    for (const task of sortTasks(state.tasks, 'due-asc')) {
      if (!tasksByDate.has(task.dueDate)) tasksByDate.set(task.dueDate, []);
      tasksByDate.get(task.dueDate).push(task);
    }

    // Roving tabindex: only one day is in the tab order; arrow keys move between days.
    const firstOfMonthKey = toDateKey(new Date(year, month, 1));
    const focusableKey = days.some((day) => toDateKey(day) === selected) ? selected : firstOfMonthKey;

    const weekdayLabels = Array.from({ length: 7 }, (_, index) =>
      el('span', { text: new Date(2023, 0, 1 + index).toLocaleDateString(undefined, { weekday: 'short' }) })
    ); // 1 Jan 2023 was a Sunday

    const cells = days.map((day) => {
      const key = toDateKey(day);
      const dayTasks = tasksByDate.get(key) || [];
      const isOutside = day.getMonth() !== month;
      const label = `${formatLongDate(day)}, ${dayTasks.length ? pluralize(dayTasks.length, 'task') : 'no tasks'}`;
      return el(
        'button',
        {
          type: 'button',
          class: classNames('cal-day', isOutside && 'is-outside', key === today && 'is-today', key === selected && 'is-selected'),
          tabindex: key === focusableKey ? '0' : '-1',
          'aria-label': label,
          'aria-pressed': String(key === selected),
          'data-focus-key': `cal-${key}`,
          onClick: () => selectCalendarDate(key),
          onKeydown: (event) => handleCalendarKeydown(event, key),
        },
        el('span', { class: 'cal-day-number', text: String(day.getDate()) }),
        dayTasks.length
          ? el(
              'span',
              { class: 'cal-pills', 'aria-hidden': 'true' },
              dayTasks.slice(0, 2).map((task) => el('span', { class: classNames('cal-pill', task.status === 'completed' && 'is-completed'), dataset: { priority: task.priority }, text: task.title })),
              dayTasks.length > 2 ? el('span', { class: 'cal-more', text: `+${dayTasks.length - 2} more` }) : null
            )
          : null,
        dayTasks.length ? el('span', { class: 'cal-count', 'aria-hidden': 'true', text: String(dayTasks.length) }) : null
      );
    });

    const monthTitle = new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const calendarPanel = el(
      'section',
      { class: 'panel' },
      el(
        'div',
        { class: 'panel-header' },
        el('h2', { class: 'calendar-title', 'aria-live': 'polite', text: monthTitle }),
        el(
          'div',
          { class: 'calendar-nav' },
          iconButton({ iconName: 'chevron-left', label: 'Previous month', focusKey: 'cal-prev', onClick: () => { setCalendarMonth(year, month - 1); render({ focusKey: 'cal-prev' }); } }),
          el('button', { type: 'button', class: 'btn btn-secondary btn-sm', 'data-focus-key': 'cal-today', onClick: () => { const now = new Date(); setCalendarMonth(now.getFullYear(), now.getMonth()); render({ focusKey: 'cal-today' }); } }, 'Today'),
          iconButton({ iconName: 'chevron-right', label: 'Next month', focusKey: 'cal-next', onClick: () => { setCalendarMonth(year, month + 1); render({ focusKey: 'cal-next' }); } })
        )
      ),
      el('div', { class: 'calendar-weekdays', 'aria-hidden': 'true' }, weekdayLabels),
      el('div', { class: 'calendar-grid', role: 'group', 'aria-label': `Calendar for ${monthTitle}` }, cells)
    );

    const selectedTasks = tasksByDate.get(selected) || [];
    const sidePanel = el(
      'aside',
      { class: 'panel calendar-side', 'aria-label': 'Tasks for the selected day' },
      el('div', { class: 'panel-header' }, el('h2', { text: formatLongDate(parseDateKey(selected)) }), el('span', { class: 'count', text: String(selectedTasks.length) })),
      el('button', { type: 'button', class: 'btn btn-primary btn-sm', style: 'margin-bottom:14px', onClick: () => openTaskForm({ presetDate: selected }) }, icon('plus', 16), 'Add task for this date'),
      createTaskList(selectedTasks, { iconName: 'calendar', title: 'Nothing scheduled', message: 'No tasks are due on this date.', compact: true })
    );

    return el('div', { class: 'view' }, createPageHeader('Calendar', 'See what is due each day. Use the arrow keys to move between days.'), el('div', { class: 'calendar-layout' }, calendarPanel, sidePanel));
  }

  // ---- Categories
  function renderCategoriesView() {
    const cards = CATEGORIES.map((category) => {
      const inCategory = state.tasks.filter((task) => task.category === category);
      const done = inCategory.filter((task) => task.status === 'completed').length;
      const percent = inCategory.length ? Math.round((done / inCategory.length) * 100) : 0;
      return el(
        'button',
        {
          type: 'button',
          class: 'category-card',
          'aria-pressed': String(state.selectedCategory === category),
          'data-focus-key': `category-${slugify(category)}`,
          onClick: () => {
            state.selectedCategory = state.selectedCategory === category ? null : category;
            render({ focusKey: `category-${slugify(category)}` });
          },
        },
        createCategoryChip(category),
        el('span', { class: 'category-numbers', text: `${inCategory.length - done} pending · ${done} done` }),
        createProgressBar(percent, `${category} completion`)
      );
    });

    const children = [el('section', { class: 'category-grid', 'aria-label': 'Categories' }, cards)];

    if (state.selectedCategory) {
      const inCategory = sortTasks(state.tasks.filter((task) => task.category === state.selectedCategory), 'due-asc');
      const pending = inCategory.filter((task) => task.status === 'pending');
      const completed = inCategory.filter((task) => task.status === 'completed');
      children.push(
        createPanel({
          title: state.selectedCategory,
          count: inCategory.length,
          actions: [el('button', { type: 'button', class: 'btn btn-primary btn-sm', onClick: () => openTaskForm({ presetCategory: state.selectedCategory }) }, icon('plus', 16), `Add ${state.selectedCategory} task`)],
          children: [
            inCategory.length === 0
              ? createEmptyState({ iconName: 'folder', title: `No ${state.selectedCategory} tasks`, message: 'Add one to get this category started.', compact: true })
              : el(
                  'div',
                  {},
                  pending.length ? el('div', { class: 'group' }, el('h3', { class: 'group-heading', text: 'Pending' }), createTaskList(pending, {})) : null,
                  completed.length ? el('div', { class: 'group' }, el('h3', { class: 'group-heading', text: 'Completed' }), createTaskList(completed, {})) : null
                ),
          ],
        })
      );
    } else {
      children.push(createEmptyState({ iconName: 'folder', title: 'Pick a category', message: 'Select a category above to see and manage its tasks.', compact: true }));
    }

    return el('div', { class: 'view' }, createPageHeader('Categories', 'Organize your work by area of life.'), el('div', { class: 'stack' }, children));
  }

  // ---- Settings
  function renderSettingsView() {
    const themeOptions = [
      { value: 'light', label: 'Light' },
      { value: 'dark', label: 'Dark' },
      { value: 'system', label: 'Match system' },
    ];

    const appearance = createPanel({
      title: 'Appearance',
      children: [
        el(
          'div',
          { class: 'settings-row' },
          el('div', {}, el('h3', { text: 'Theme' }), el('p', { text: 'Choose a light or dark interface, or follow your device setting.' })),
          el(
            'fieldset',
            { class: 'segmented' },
            el('legend', { class: 'visually-hidden', text: 'Theme' }),
            themeOptions.map((option) =>
              el(
                'label',
                { class: 'segment' },
                el('input', { type: 'radio', name: 'theme', value: option.value, checked: state.settings.theme === option.value, onChange: () => setTheme(option.value) }),
                el('span', { text: option.label })
              )
            )
          )
        ),
      ],
    });

    const notificationsSupported = 'Notification' in window;
    const notificationsOn = state.settings.notificationsEnabled && notificationsSupported && Notification.permission === 'granted';
    const reminders = createPanel({
      title: 'Reminders',
      children: [
        el(
          'div',
          { class: 'settings-row' },
          el(
            'div',
            {},
            el('h3', { text: 'Browser notifications' }),
            el('p', { text: notificationsSupported ? `Get a notification about ${REMINDER_LEAD_MINUTES} minutes before a timed task is due.` : 'This browser does not support notifications.' })
          ),
          notificationsSupported
            ? el(
                'button',
                { type: 'button', class: classNames('btn', notificationsOn ? 'btn-secondary' : 'btn-primary'), onClick: notificationsOn ? disableNotifications : enableNotifications },
                icon('bell', 16),
                notificationsOn ? 'Turn off' : 'Enable notifications'
              )
            : null
        ),
        el('div', { class: 'info-box', text: 'Important: reminders only work while TaskFlow is open in a browser tab. Without a server, a web page cannot wake itself up after you close the tab or the browser.' }),
      ],
    });

    const storageBytes = (localStorage.getItem(STORAGE_KEYS.tasks) || '').length;
    const data = createPanel({
      title: 'Your data',
      children: [
        el('p', { class: 'panel-note', text: `${pluralize(state.tasks.length, 'task')} stored in this browser (about ${(storageBytes / 1024).toFixed(1)} KB).` }),
        el(
          'div',
          { class: 'settings-row' },
          el('div', {}, el('h3', { text: 'Export backup' }), el('p', { text: 'Download all tasks and subtasks as a JSON file.' })),
          el('button', { type: 'button', class: 'btn btn-secondary', onClick: exportData }, icon('download', 16), 'Export JSON')
        ),
        el(
          'div',
          { class: 'settings-row' },
          el('div', {}, el('h3', { text: 'Import backup' }), el('p', { text: 'Load a TaskFlow JSON backup. You will choose whether to merge it or replace your current tasks.' })),
          el('button', { type: 'button', class: 'btn btn-secondary', onClick: () => refs.importFile.click() }, icon('upload', 16), 'Import JSON')
        ),
        el(
          'div',
          { class: 'settings-row' },
          el('div', {}, el('h3', { text: 'Clear all data' }), el('p', { text: 'Permanently delete every task and reset your settings.' })),
          el('button', { type: 'button', class: 'btn btn-danger-outline', onClick: handleClearAllData }, icon('trash', 16), 'Clear all data')
        ),
        el('div', { class: 'info-box', text: 'Your tasks live in this browser’s LocalStorage, on this device only. They are not synced anywhere, and clearing your browser’s site data (or using a private window) can remove them. Export a backup regularly.' }),
      ],
    });

    return el('div', { class: 'view' }, createPageHeader('Settings', 'Theme, reminders and your data.'), el('div', { class: 'settings-grid' }, appearance, reminders, data));
  }

  /* ======================================================================
     9. DIALOGS: task form and task details
     ====================================================================== */
  const formState = { mode: 'add', taskId: null, subtasks: [], snapshot: '' };
  const formFieldMap = () => ({
    title: { input: refs.taskTitle, error: refs.taskTitleError },
    description: { input: refs.taskDescription, error: refs.taskDescriptionError },
    dueDate: { input: refs.taskDate, error: refs.taskDateError },
    dueTime: { input: refs.taskTime, error: refs.taskTimeError },
  });

  function populateSelect(select, values) {
    select.replaceChildren(...values.map((value) => el('option', { value, text: value })));
  }

  function openTaskForm({ task = null, presetDate = '', presetCategory = '' } = {}) {
    if (task && refs.detailsDialog.open) closeDetails();

    formState.mode = task ? 'edit' : 'add';
    formState.taskId = task ? task.id : null;
    refs.taskDialogTitle.textContent = task ? 'Edit task' : 'Add task';
    refs.taskSubmit.textContent = task ? 'Save changes' : 'Add task';

    refs.taskTitle.value = task ? task.title : '';
    refs.taskDescription.value = task ? task.description : '';
    refs.taskDate.value = task ? task.dueDate : presetDate || todayKey();
    refs.taskTime.value = task ? task.dueTime : '';
    refs.taskCategory.value = task ? task.category : presetCategory || CATEGORIES[0];
    refs.taskPriority.value = task ? task.priority : 'Medium';
    refs.taskStatus.value = task ? task.status : 'pending';
    refs.taskNewSubtask.value = '';
    formState.subtasks = task ? task.subtasks.map((subtask) => ({ ...subtask })) : [];

    clearFormErrors();
    renderFormSubtasks();
    updateDateHint();
    formState.snapshot = getFormSnapshot();

    if (!refs.taskDialog.open) refs.taskDialog.showModal();
    refs.taskTitle.focus();
  }

  function getTaskFormValues() {
    return {
      title: refs.taskTitle.value.trim(),
      description: refs.taskDescription.value.trim(),
      dueDate: refs.taskDate.value,
      dueTime: refs.taskTime.value,
      category: refs.taskCategory.value,
      priority: refs.taskPriority.value,
      status: refs.taskStatus.value,
    };
  }

  function getFormSnapshot() {
    return JSON.stringify({ ...getTaskFormValues(), pendingSubtask: refs.taskNewSubtask.value.trim(), subtasks: formState.subtasks });
  }

  function validateTaskForm() {
    const values = getTaskFormValues();
    const errors = {};
    if (!values.title) errors.title = 'Please enter a task title.';
    else if (values.title.length > MAX_TITLE_LENGTH) errors.title = `The title must be ${MAX_TITLE_LENGTH} characters or fewer.`;
    if (values.description.length > MAX_DESCRIPTION_LENGTH) errors.description = `The description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`;
    if (!values.dueDate) errors.dueDate = 'Please choose a due date.';
    else if (!isValidDateKey(values.dueDate)) errors.dueDate = 'That is not a valid calendar date.';
    if (!isValidTimeKey(values.dueTime)) errors.dueTime = 'Enter a valid time, for example 14:30.';
    if (!CATEGORIES.includes(values.category)) values.category = 'Other';
    if (!PRIORITIES.includes(values.priority)) values.priority = 'Medium';
    if (values.status !== 'completed') values.status = 'pending';
    return { values, errors };
  }

  function clearFormErrors() {
    for (const { input, error } of Object.values(formFieldMap())) {
      error.textContent = '';
      input.removeAttribute('aria-invalid');
    }
    refs.taskSubtaskError.textContent = '';
  }

  function showFormErrors(errors) {
    clearFormErrors();
    let firstInvalid = null;
    for (const [field, { input, error }] of Object.entries(formFieldMap())) {
      if (errors[field]) {
        error.textContent = errors[field];
        input.setAttribute('aria-invalid', 'true');
        if (!firstInvalid) firstInvalid = input;
      }
    }
    if (firstInvalid) firstInvalid.focus();
  }

  function updateDateHint() {
    const value = refs.taskDate.value;
    refs.taskDateHint.textContent = isValidDateKey(value) && value < todayKey()
      ? 'This date is in the past, so the task will show as overdue until it is completed.'
      : '';
  }

  function renderFormSubtasks() {
    refs.taskSubtaskList.replaceChildren(
      ...formState.subtasks.map((subtask, index) =>
        el(
          'li',
          { class: 'form-subtask' },
          el(
            'label',
            { class: 'check' },
            el('input', {
              type: 'checkbox',
              class: 'check-input',
              checked: subtask.done,
              'aria-label': `Subtask ${index + 1} completed`,
              onChange: (event) => { subtask.done = event.target.checked; },
            }),
            el('span', { class: 'check-box' }, icon('check', 14))
          ),
          el('input', {
            type: 'text',
            value: subtask.title,
            maxlength: MAX_SUBTASK_LENGTH,
            'aria-label': `Subtask ${index + 1} title`,
            onInput: (event) => { subtask.title = event.target.value; },
            onKeydown: (event) => { if (event.key === 'Enter') event.preventDefault(); }, // Enter must not submit the whole form
          }),
          iconButton({
            iconName: 'x',
            label: `Remove subtask ${index + 1}`,
            className: 'danger',
            onClick: () => {
              formState.subtasks.splice(index, 1);
              renderFormSubtasks();
              refs.taskNewSubtask.focus();
            },
          })
        )
      )
    );
  }

  function addFormSubtask() {
    const title = refs.taskNewSubtask.value.trim();
    refs.taskSubtaskError.textContent = '';
    if (!title) {
      refs.taskSubtaskError.textContent = 'Type a checklist item first.';
      refs.taskNewSubtask.focus();
      return;
    }
    if (formState.subtasks.length >= MAX_SUBTASKS) {
      refs.taskSubtaskError.textContent = `You can add up to ${MAX_SUBTASKS} subtasks per task.`;
      return;
    }
    formState.subtasks.push({ id: generateId(), title: title.slice(0, MAX_SUBTASK_LENGTH), done: false });
    refs.taskNewSubtask.value = '';
    renderFormSubtasks();
    refs.taskNewSubtask.focus();
  }

  function handleTaskFormSubmit() {
    // Include a half-typed subtask so it is not silently lost.
    if (refs.taskNewSubtask.value.trim()) addFormSubtask();

    const { values, errors } = validateTaskForm();
    showFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const subtasks = formState.subtasks
      .map((subtask) => ({ id: subtask.id, title: subtask.title.trim().slice(0, MAX_SUBTASK_LENGTH), done: subtask.done }))
      .filter((subtask) => subtask.title);
    const data = { ...values, subtasks };

    if (formState.mode === 'edit') {
      if (!updateTask(formState.taskId, data)) {
        showToast('That task no longer exists, so it could not be updated.', 'error');
        refs.taskDialog.close();
        render();
        return;
      }
      showToast('Task updated.');
    } else {
      createTask(data);
      showToast('Task added.');
    }
    refs.taskDialog.close();
    render();
  }

  /** Close the form, asking first if there are unsaved changes. */
  async function requestCloseTaskForm() {
    if (getFormSnapshot() !== formState.snapshot) {
      const choice = await askConfirmation({ title: 'Discard changes?', message: 'You have unsaved changes in this task. If you close now they will be lost.', confirmLabel: 'Discard changes', danger: true });
      if (choice !== 'confirm') return;
    }
    refs.taskDialog.close();
  }

  // ---- Details dialog
  function openDetails(taskId) {
    state.detailsTaskId = taskId;
    refreshDetails();
    if (state.detailsTaskId && !refs.detailsDialog.open) refs.detailsDialog.showModal();
  }

  function closeDetails() {
    state.detailsTaskId = null;
    if (refs.detailsDialog.open) refs.detailsDialog.close();
  }

  function refreshDetails() {
    if (!state.detailsTaskId) return;
    const task = findTask(state.detailsTaskId);
    if (!task) {
      closeDetails();
      return;
    }

    const draftSubtask = document.getElementById('detail-new-subtask');
    const draftText = draftSubtask ? draftSubtask.value : '';
    const done = task.status === 'completed';
    const planned = isPlannedForToday(task);
    const subtaskDone = task.subtasks.filter((subtask) => subtask.done).length;

    const addInput = el('input', {
      id: 'detail-new-subtask',
      type: 'text',
      maxlength: MAX_SUBTASK_LENGTH,
      placeholder: 'Add a checklist item and press Enter',
      value: draftText,
      'data-focus-key': 'detail-new-subtask',
      onKeydown: (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          handleAddSubtask(task.id, addInput);
        }
      },
    });

    const subtaskRows = task.subtasks.map((subtask) =>
      el(
        'li',
        { class: classNames('subtask-row', subtask.done && 'is-done') },
        el(
          'label',
          { class: 'check' },
          el('input', { type: 'checkbox', class: 'check-input', checked: subtask.done, 'aria-label': `Mark subtask “${subtask.title}” as ${subtask.done ? 'not done' : 'done'}`, 'data-focus-key': `dsub-${subtask.id}`, onChange: () => handleToggleSubtask(task.id, subtask.id) }),
          el('span', { class: 'check-box' }, icon('check', 14))
        ),
        el('input', {
          type: 'text',
          value: subtask.title,
          maxlength: MAX_SUBTASK_LENGTH,
          'aria-label': 'Subtask title',
          // Saved on change (Enter or leaving the field); no re-render so typing is never interrupted.
          onChange: (event) => handleRenameSubtask(task.id, subtask.id, event.target),
        }),
        iconButton({ iconName: 'x', label: `Remove subtask “${subtask.title}”`, className: 'danger', focusKey: `dsub-del-${subtask.id}`, onClick: () => handleRemoveSubtask(task.id, subtask.id) })
      )
    );

    const content = [
      el(
        'header',
        { class: 'dialog-header' },
        el('div', {}, el('h2', { id: 'details-title', text: task.title })),
        iconButton({ iconName: 'x', label: 'Close details', focusKey: 'details-close', onClick: closeDetails })
      ),
      el(
        'div',
        { class: 'dialog-body' },
        el(
          'div',
          { class: 'task-meta' },
          el('span', { class: classNames('badge badge-status', done && 'is-done') }, icon(done ? 'check-circle' : 'clock', 12), done ? 'Completed' : 'Pending'),
          createPriorityBadge(task.priority),
          createCategoryChip(task.category),
          el(
            'span',
            { class: classNames('chip', isOverdue(task) && 'is-overdue') },
            icon(task.dueTime ? 'clock' : 'calendar', 14),
            `${formatLongDate(parseDateKey(task.dueDate))}${task.dueTime ? `, ${formatTime(task.dueTime)}` : ''}`,
            isOverdue(task) ? ' · Overdue' : null
          ),
          planned ? el('span', { class: 'chip is-today' }, icon('star', 14), 'Today’s priority') : null
        ),
        el(
          'section',
          { class: 'detail-section' },
          el('h3', { text: 'Description' }),
          el('p', { class: classNames('detail-description', !task.description && 'is-empty'), text: task.description || 'No description.' })
        ),
        el(
          'section',
          { class: 'detail-section' },
          el('h3', {}, 'Subtasks ', task.subtasks.length ? el('span', { class: 'count', text: `${subtaskDone}/${task.subtasks.length}` }) : null),
          task.subtasks.length ? el('ul', { class: 'subtask-list' }, subtaskRows) : el('p', { class: 'detail-description is-empty', text: 'No subtasks yet.' }),
          el(
            'div',
            { class: 'subtask-add' },
            el('label', { for: 'detail-new-subtask', class: 'visually-hidden', text: 'New subtask' }),
            addInput,
            el('button', { type: 'button', class: 'btn btn-secondary', onClick: () => handleAddSubtask(task.id, addInput) }, 'Add')
          )
        ),
        el(
          'div',
          { class: 'detail-times' },
          el('span', { text: `Created ${formatTimestamp(task.createdAt)}` }),
          task.updatedAt !== task.createdAt ? el('span', { text: `Last edited ${formatTimestamp(task.updatedAt)}` }) : null,
          task.completedAt ? el('span', { text: `Completed ${formatTimestamp(task.completedAt)}` }) : null
        )
      ),
      el(
        'footer',
        { class: 'dialog-footer' },
        el('button', { type: 'button', class: 'btn btn-danger-outline push-left', 'data-focus-key': 'details-delete', onClick: () => handleDelete(task.id) }, icon('trash', 16), 'Delete'),
        el('button', { type: 'button', class: 'btn btn-secondary', onClick: () => handleTogglePriority(task.id) }, icon('star', 16), planned ? 'Remove priority' : 'Today’s priority'),
        el('button', { type: 'button', class: 'btn btn-secondary', onClick: () => handleDuplicate(task.id) }, icon('copy', 16), 'Duplicate'),
        el('button', { type: 'button', class: 'btn btn-secondary', onClick: () => openTaskForm({ task }) }, icon('edit', 16), 'Edit'),
        el('button', { type: 'button', class: 'btn btn-primary', 'data-focus-key': 'details-toggle', onClick: () => handleToggleComplete(task.id) }, icon(done ? 'clock' : 'check', 16), done ? 'Mark as pending' : 'Mark as completed')
      ),
    ];

    refs.detailsContent.replaceChildren(...content.flat());
  }

  /* ======================================================================
     Task action handlers (data change + feedback + re-render)
     ====================================================================== */
  function handleToggleComplete(taskId) {
    const task = findTask(taskId);
    if (!task) return;
    const completing = task.status !== 'completed';
    updateTask(taskId, { status: completing ? 'completed' : 'pending' });
    showToast(completing ? 'Task completed. Nice work!' : 'Task moved back to pending.');
    render();
  }

  function handleTogglePriority(taskId) {
    const task = findTask(taskId);
    if (!task) return;
    const planning = !isPlannedForToday(task);
    modifyTask(taskId, (target) => { target.planDate = planning ? todayKey() : ''; });
    showToast(planning ? 'Added to today’s priorities.' : 'Removed from today’s priorities.', 'info');
    render();
  }

  function handleDuplicate(taskId) {
    const copy = duplicateTask(taskId);
    if (!copy) return;
    showToast('Task duplicated.');
    render();
  }

  async function handleDelete(taskId) {
    const task = findTask(taskId);
    if (!task) return;
    const choice = await askConfirmation({
      title: 'Delete this task?',
      message: `“${task.title}” and its subtasks will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Delete task',
      danger: true,
    });
    if (choice !== 'confirm') return;
    deleteTask(taskId);
    if (state.detailsTaskId === taskId) closeDetails();
    showToast('Task deleted.');
    render();
  }

  async function handleClearCompleted() {
    const completedCount = state.tasks.filter((task) => task.status === 'completed').length;
    if (!completedCount) return;
    const choice = await askConfirmation({
      title: 'Delete all completed tasks?',
      message: `${pluralize(completedCount, 'completed task')} will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Delete completed tasks',
      danger: true,
    });
    if (choice !== 'confirm') return;
    state.tasks = state.tasks.filter((task) => task.status !== 'completed');
    persistTasks();
    showToast(`Deleted ${pluralize(completedCount, 'completed task')}.`);
    render();
  }

  function handleToggleSubtask(taskId, subtaskId) {
    modifyTask(taskId, (task) => {
      const subtask = task.subtasks.find((item) => item.id === subtaskId);
      if (subtask) subtask.done = !subtask.done;
    });
    render();
  }

  function handleAddSubtask(taskId, inputElement) {
    const title = inputElement.value.trim();
    if (!title) {
      showToast('Type a checklist item first.', 'error');
      inputElement.focus();
      return;
    }
    const task = findTask(taskId);
    if (!task) return;
    if (task.subtasks.length >= MAX_SUBTASKS) {
      showToast(`You can add up to ${MAX_SUBTASKS} subtasks per task.`, 'error');
      return;
    }
    modifyTask(taskId, (target) => target.subtasks.push({ id: generateId(), title: title.slice(0, MAX_SUBTASK_LENGTH), done: false }));
    inputElement.value = '';
    render({ focusKey: 'detail-new-subtask' });
  }

  function handleRenameSubtask(taskId, subtaskId, inputElement) {
    const newTitle = inputElement.value.trim();
    const task = findTask(taskId);
    const subtask = task && task.subtasks.find((item) => item.id === subtaskId);
    if (!subtask) return;
    if (!newTitle) {
      inputElement.value = subtask.title; // empty names are not allowed; restore the old one
      showToast('A subtask needs a name. Use the ✕ button to remove it.', 'error');
      return;
    }
    modifyTask(taskId, () => { subtask.title = newTitle.slice(0, MAX_SUBTASK_LENGTH); });
  }

  function handleRemoveSubtask(taskId, subtaskId) {
    modifyTask(taskId, (task) => { task.subtasks = task.subtasks.filter((item) => item.id !== subtaskId); });
    render({ focusKey: 'detail-new-subtask' });
  }

  /* ======================================================================
     10. SETTINGS ACTIONS
     ====================================================================== */
  function prefersDark() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function getResolvedTheme() {
    return state.settings.theme === 'system' ? (prefersDark() ? 'dark' : 'light') : state.settings.theme;
  }

  function applyTheme() {
    const resolved = getResolvedTheme();
    document.documentElement.dataset.theme = resolved;
    const toggle = refs.themeToggle;
    toggle.replaceChildren(icon(resolved === 'dark' ? 'sun' : 'moon'));
    const label = resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('title', label);
  }

  function setTheme(theme) {
    if (!THEMES.includes(theme)) return;
    state.settings.theme = theme;
    persistSettings();
    applyTheme();
  }


  function exportData() {
    const payload = { app: BACKUP_APP_NAME, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), tasks: state.tasks };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = el('a', { href: url, download: `taskflow-backup-${todayKey()}.json` });
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`Exported ${pluralize(state.tasks.length, 'task')}.`);
  }

  /** Validate a backup file's text. Returns a clean task list or throws an Error with a friendly message. */
  function parseBackup(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (error) {
      throw new Error('That file is not valid JSON.');
    }
    const rawTasks = Array.isArray(data) ? data : data && Array.isArray(data.tasks) ? data.tasks : null;
    if (!rawTasks) throw new Error('This does not look like a TaskFlow backup (no task list found).');
    if (rawTasks.length === 0) throw new Error('The backup does not contain any tasks.');

    const cleaned = new Map(); // keyed by id so duplicates inside the file collapse to one
    let invalidCount = 0;
    for (const raw of rawTasks) {
      const task = sanitizeTask(raw);
      if (task) cleaned.set(task.id, task);
      else invalidCount += 1;
    }
    if (invalidCount > 0) {
      throw new Error(`${invalidCount} of ${rawTasks.length} tasks in this file are invalid (each needs a title and a due date like 2026-12-31). Nothing was imported.`);
    }
    return [...cleaned.values()];
  }

  /** Merge keeps current tasks, adds new ones, and keeps whichever copy was edited most recently when ids match. */
  function mergeTasks(existing, incoming) {
    const byId = new Map(existing.map((task) => [task.id, task]));
    let added = 0;
    let updated = 0;
    for (const task of incoming) {
      const current = byId.get(task.id);
      if (!current) {
        byId.set(task.id, task);
        added += 1;
      } else if (task.updatedAt > current.updatedAt) {
        byId.set(task.id, task);
        updated += 1;
      }
    }
    return { tasks: [...byId.values()], added, updated };
  }

  async function handleImportFile(file) {
    if (!file) return;
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('That file is too large to be a TaskFlow backup (limit 5 MB).');
      const incoming = parseBackup(await file.text());
      const choice = await askConfirmation({
        title: 'Import backup?',
        message: `This backup contains ${pluralize(incoming.length, 'task')}. You currently have ${pluralize(state.tasks.length, 'task')}. Merge adds the backup’s tasks to yours (the most recently edited copy wins if a task exists in both). Replace deletes your current tasks first.`,
        confirmLabel: 'Replace my tasks',
        secondaryLabel: 'Merge with my tasks',
        danger: false,
      });
      if (choice === 'cancel') {
        showToast('Import cancelled. Nothing was changed.', 'info');
        return;
      }
      if (choice === 'confirm') {
        state.tasks = incoming;
        persistTasks();
        showToast(`Imported ${pluralize(incoming.length, 'task')}, replacing your previous tasks.`);
      } else {
        const result = mergeTasks(state.tasks, incoming);
        state.tasks = result.tasks;
        persistTasks();
        showToast(`Merged backup: ${result.added} added, ${result.updated} updated.`);
      }
      render();
    } catch (error) {
      showToast(error.message || 'The file could not be imported.', 'error');
    }
  }

  async function handleClearAllData() {
    const choice = await askConfirmation({
      title: 'Delete all TaskFlow data?',
      message: `All ${pluralize(state.tasks.length, 'task')}, their subtasks and your settings will be permanently erased from this browser. Export a backup first if you might need them.`,
      confirmLabel: 'Delete everything',
      danger: true,
    });
    if (choice !== 'confirm') return;
    try {
      Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    } catch (error) { /* ignore: storage unavailable */ }
    state.tasks = [];
    state.settings = { theme: 'system', notificationsEnabled: false };
    state.filters = createDefaultFilters();
    state.selectedCategory = null;
    refs.searchInput.value = '';
    notifiedKeys.clear();
    applyTheme();
    showToast('All data deleted.');
    render();
  }

  // ---- Reminders (only work while this page is open; see README)
  const notifiedKeys = new Set();

  function loadNotifiedKeys() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.notified));
      if (Array.isArray(stored)) stored.filter((key) => typeof key === 'string').forEach((key) => notifiedKeys.add(key));
    } catch (error) { /* start empty */ }
  }

  function persistNotifiedKeys() {
    try {
      localStorage.setItem(STORAGE_KEYS.notified, JSON.stringify([...notifiedKeys].slice(-200)));
    } catch (error) { /* not critical */ }
  }

  async function enableNotifications() {
    if (!('Notification' in window)) {
      showToast('This browser does not support notifications.', 'error');
      return;
    }
    if (Notification.permission === 'denied') {
      showToast('Notifications are blocked for this site. Allow them in your browser’s site settings, then try again.', 'error');
      return;
    }
    // Permission is requested only now, in response to the user's click.
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission === 'granted') {
      state.settings.notificationsEnabled = true;
      persistSettings();
      showToast('Notifications enabled. Keep TaskFlow open in a tab to receive reminders.');
      checkReminders();
    } else {
      showToast('Notifications were not enabled.', 'info');
    }
    render();
  }

  function disableNotifications() {
    state.settings.notificationsEnabled = false;
    persistSettings();
    showToast('Notifications turned off.', 'info');
    render();
  }

  function checkReminders() {
    if (!state.settings.notificationsEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;
    const now = new Date();
    let changed = false;
    for (const task of state.tasks) {
      if (task.status !== 'pending' || !task.dueTime) continue;
      const minutesUntilDue = (getDueMoment(task) - now) / 60000;
      if (minutesUntilDue > REMINDER_LEAD_MINUTES || minutesUntilDue < -60) continue;
      const key = `${task.id}|${task.dueDate}|${task.dueTime}`;
      if (notifiedKeys.has(key)) continue;
      notifiedKeys.add(key);
      changed = true;
      try {
        const body = minutesUntilDue > 0 ? `Due at ${formatTime(task.dueTime)}` : `Was due at ${formatTime(task.dueTime)}`;
        new Notification(task.title, { body });
      } catch (error) {
        console.warn('TaskFlow: could not show a notification.', error);
      }
    }
    if (changed) persistNotifiedKeys();
  }

  /* ======================================================================
     11. NAVIGATION, RENDERING AND EVENT WIRING
     ====================================================================== */
  const viewRenderers = {
    dashboard: renderDashboardView,
    tasks: renderTasksView,
    today: renderTodayView,
    upcoming: renderUpcomingView,
    overdue: renderOverdueView,
    completed: renderCompletedView,
    calendar: renderCalendarView,
    categories: renderCategoriesView,
    settings: renderSettingsView,
  };

  let focusHeadingOnNextRoute = true;
  let lastRenderStamp = '';

  function getRouteFromHash() {
    const id = window.location.hash.replace(/^#\/?/, '');
    return viewRenderers[id] ? id : 'dashboard';
  }

  function navigate(routeId, { focusHeading = true } = {}) {
    focusHeadingOnNextRoute = focusHeading;
    if (window.location.hash === `#/${routeId}`) {
      handleRouteChange();
    } else {
      window.location.hash = `#/${routeId}`; // triggers hashchange → handleRouteChange
    }
  }

  function handleRouteChange() {
    state.view = getRouteFromHash();
    const shouldFocus = focusHeadingOnNextRoute;
    focusHeadingOnNextRoute = true;
    closeDrawer();
    render();
    window.scrollTo(0, 0);
    if (shouldFocus) {
      const heading = refs.main.querySelector('h1');
      if (heading) heading.focus({ preventScroll: true });
    }
  }

  /**
   * Redraw the current view from state. Keyboard focus is restored to the element with the same
   * data-focus-key so using the keyboard never loses your place after a change.
   */
  function render({ focusKey } = {}) {
    const active = document.activeElement;
    const keyToRestore = focusKey || (active && active.dataset ? active.dataset.focusKey : '');

    try {
      refs.main.replaceChildren(viewRenderers[state.view]());
    } catch (error) {
      console.error('TaskFlow: a view failed to render.', error);
      refs.main.replaceChildren(createEmptyState({ iconName: 'alert', title: 'Something went wrong', message: 'Please refresh the page. Your saved tasks were not changed.' }));
    }

    refreshNavigation();
    if (refs.detailsDialog.open) refreshDetails();

    if (keyToRestore) {
      const target = document.querySelector(`[data-focus-key="${CSS.escape(keyToRestore)}"]`);
      if (target) target.focus({ preventScroll: true });
    }
  }

  function buildNavigation() {
    const makeLink = (route) =>
      el(
        'a',
        { class: 'nav-link', href: `#/${route.id}`, dataset: { route: route.id } },
        icon(route.icon, 20),
        el('span', { class: 'nav-label', text: route.label }),
        el('span', { class: 'nav-badge', dataset: { badge: route.id }, hidden: true })
      );

    refs.sidebarNav.replaceChildren(...ROUTES.map(makeLink));

    const moreButton = el(
      'button',
      { type: 'button', class: 'nav-more', 'aria-label': 'More navigation options', 'aria-expanded': 'false', 'aria-controls': 'sidebar', id: 'more-button', onClick: openDrawer },
      icon('more', 20),
      el('span', { class: 'nav-label', text: 'More' })
    );
    refs.bottomNav.replaceChildren(...BOTTOM_NAV_ROUTES.map((id) => makeLink(ROUTES.find((route) => route.id === id))), moreButton);
  }

  function refreshNavigation() {
    const now = new Date();
    const today = toDateKey(now);
    const badgeCounts = {
      today: state.tasks.filter((task) => task.status === 'pending' && task.dueDate === today).length,
      overdue: state.tasks.filter((task) => isOverdue(task, now)).length,
    };
    document.querySelectorAll('.nav-link').forEach((link) => {
      if (link.dataset.route === state.view) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.querySelectorAll('.nav-badge').forEach((badge) => {
      const count = badgeCounts[badge.dataset.badge] || 0;
      badge.textContent = String(count);
      badge.hidden = count === 0;
    });
  }

  // ---- Mobile drawer
  function openDrawer() {
    refs.sidebar.classList.add('is-open');
    refs.sidebarOverlay.hidden = false;
    refs.menuButton.setAttribute('aria-expanded', 'true');
    const moreButton = document.getElementById('more-button');
    if (moreButton) moreButton.setAttribute('aria-expanded', 'true');
    const current = refs.sidebarNav.querySelector('[aria-current="page"]') || refs.sidebarNav.querySelector('a');
    if (current) current.focus();
  }

  function closeDrawer() {
    if (!refs.sidebar.classList.contains('is-open')) return;
    refs.sidebar.classList.remove('is-open');
    refs.sidebarOverlay.hidden = true;
    refs.menuButton.setAttribute('aria-expanded', 'false');
    const moreButton = document.getElementById('more-button');
    if (moreButton) moreButton.setAttribute('aria-expanded', 'false');
  }

  function isAnyDialogOpen() {
    return refs.taskDialog.open || refs.detailsDialog.open || refs.confirmDialog.open;
  }

  /** Runs every 30 s: sends reminders and refreshes the screen once per minute (overdue status, greeting, midnight). */
  function tick() {
    checkReminders();
    const now = new Date();
    const stamp = `${toDateKey(now)} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    if (stamp === lastRenderStamp) return;
    const active = document.activeElement;
    const typing = active && refs.main.contains(active) && /^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName);
    if (isAnyDialogOpen() || typing) return; // try again on the next tick
    lastRenderStamp = stamp;
    render();
  }

  function cacheRefs() {
    const byId = (id) => document.getElementById(id);
    Object.assign(refs, {
      sidebar: byId('sidebar'),
      sidebarNav: byId('sidebar-nav'),
      sidebarOverlay: byId('sidebar-overlay'),
      bottomNav: byId('bottom-nav'),
      menuButton: byId('menu-button'),
      searchInput: byId('search-input'),
      themeToggle: byId('theme-toggle'),
      addTaskButton: byId('add-task-button'),
      main: byId('main-content'),
      toastRegion: byId('toast-region'),
      importFile: byId('import-file'),
      // task form
      taskDialog: byId('task-dialog'),
      taskForm: byId('task-form'),
      taskDialogTitle: byId('task-dialog-title'),
      taskDialogClose: byId('task-dialog-close'),
      taskTitle: byId('task-title'),
      taskTitleError: byId('task-title-error'),
      taskDescription: byId('task-description'),
      taskDescriptionError: byId('task-description-error'),
      taskDate: byId('task-date'),
      taskDateError: byId('task-date-error'),
      taskDateHint: byId('task-date-hint'),
      taskTime: byId('task-time'),
      taskTimeError: byId('task-time-error'),
      taskCategory: byId('task-category'),
      taskPriority: byId('task-priority'),
      taskStatus: byId('task-status'),
      taskSubtaskList: byId('task-subtask-list'),
      taskNewSubtask: byId('task-new-subtask'),
      taskAddSubtask: byId('task-add-subtask'),
      taskSubtaskError: byId('task-subtask-error'),
      taskCancel: byId('task-cancel'),
      taskSubmit: byId('task-submit'),
      // details + confirm
      detailsDialog: byId('details-dialog'),
      detailsContent: byId('details-content'),
      confirmDialog: byId('confirm-dialog'),
      confirmTitle: byId('confirm-title'),
      confirmMessage: byId('confirm-message'),
      confirmOk: byId('confirm-ok'),
      confirmSecondary: byId('confirm-secondary'),
      confirmCancel: byId('confirm-cancel'),
    });
  }

  /** Static elements get their listeners exactly once, here. Dynamic elements bind their own when created. */
  function bindStaticEvents() {
    refs.addTaskButton.addEventListener('click', () => openTaskForm());
    refs.themeToggle.addEventListener('click', () => setTheme(getResolvedTheme() === 'dark' ? 'light' : 'dark'));
    refs.menuButton.addEventListener('click', openDrawer);
    refs.sidebarOverlay.addEventListener('click', closeDrawer);
    refs.sidebarNav.addEventListener('click', (event) => { if (event.target.closest('a')) closeDrawer(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeDrawer(); });

    // Typing in the search box shows matching tasks in "My Tasks".
    refs.searchInput.addEventListener('input', () => {
      state.filters.search = refs.searchInput.value;
      if (state.view !== 'tasks') navigate('tasks', { focusHeading: false });
      else render();
    });

    // Task form
    refs.taskForm.addEventListener('submit', (event) => {
      event.preventDefault();
      handleTaskFormSubmit();
    });
    refs.taskDialogClose.addEventListener('click', requestCloseTaskForm);
    refs.taskCancel.addEventListener('click', requestCloseTaskForm);
    // Escape counts as an explicit cancel, but still protects unsaved work.
    refs.taskDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      requestCloseTaskForm();
    });
    refs.taskAddSubtask.addEventListener('click', addFormSubtask);
    refs.taskNewSubtask.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addFormSubtask();
      }
    });
    refs.taskDate.addEventListener('input', updateDateHint);
    refs.taskDate.addEventListener('change', updateDateHint);
    [refs.taskTitle, refs.taskDate, refs.taskTime, refs.taskDescription].forEach((input) =>
      input.addEventListener('input', () => {
        input.removeAttribute('aria-invalid');
      })
    );

    // Details dialog: clicking the dark backdrop closes it
    refs.detailsDialog.addEventListener('click', (event) => { if (event.target === refs.detailsDialog) closeDetails(); });
    refs.detailsDialog.addEventListener('close', () => { state.detailsTaskId = null; });

    // Import
    refs.importFile.addEventListener('change', async () => {
      const file = refs.importFile.files && refs.importFile.files[0];
      await handleImportFile(file);
      refs.importFile.value = ''; // allow importing the same file again later
    });

    window.addEventListener('hashchange', handleRouteChange);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

    // Keep several open tabs in sync: another tab saved something, so reload from storage.
    window.addEventListener('storage', (event) => {
      if (event.key === null || event.key === STORAGE_KEYS.tasks) {
        state.tasks = loadTasks();
        render();
      }
    });

    if (typeof window.matchMedia === 'function') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const onSystemThemeChange = () => { if (state.settings.theme === 'system') applyTheme(); };
      if (media.addEventListener) media.addEventListener('change', onSystemThemeChange);
    }
  }

  function init() {
    cacheRefs();

    // Static icons
    document.getElementById('brand-mark').append(icon('check', 18));
    document.getElementById('search-icon').append(icon('search', 18));
    document.getElementById('add-task-icon').append(icon('plus', 18));
    refs.menuButton.append(icon('menu', 20));
    refs.taskDialogClose.append(icon('x', 18));

    // Form dropdowns come from the same constants the rest of the app uses
    populateSelect(refs.taskCategory, CATEGORIES);
    populateSelect(refs.taskPriority, PRIORITIES);

    state.settings = loadSettings();
    state.tasks = loadTasks();
    loadNotifiedKeys();

    const now = new Date();
    setCalendarMonth(now.getFullYear(), now.getMonth());

    applyTheme();
    buildNavigation();
    bindStaticEvents();

    state.view = getRouteFromHash();
    lastRenderStamp = `${toDateKey(now)} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    render();

    checkReminders();
    window.setInterval(tick, 30000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();