# TaskFlow – Personal Checklist & Task Manager

A clean, responsive productivity dashboard (inspired by Notion, Todoist and Linear) for organizing studies, coding practice, open-source contributions and personal life.

Built with **plain HTML, CSS and vanilla JavaScript (ES6+)**. No frameworks, no build step, no backend, no dependencies. Tasks are saved in your browser's **LocalStorage**.

## Project structure

```
taskflow/
├── index.html   # page shell, dialogs, containers
├── style.css    # design system, light/dark themes, responsive layout
├── script.js    # all app logic (storage, tasks, filtering, rendering, events)
└── README.md
```

## Features

**Dashboard**
- Time-based greeting and today's date
- Prominent *Add Task* button
- Live statistics: total, completed, pending, overdue, due today (calculated from stored tasks, never hardcoded)
- Overall progress bar and a daily completion summary
- *Today's priorities* and *Upcoming* sections

**Tasks**
- Add / edit with validation: title (required), description, due date (required), due time, category (Study, Coding, Open Source, Personal, Work, Other), priority (Low / Medium / High), status, and a subtask checklist
- Past dates are allowed (the form warns that the task will be overdue)
- Complete, mark pending again, duplicate, view details, delete (with confirmation)
- Subtasks can be added, edited, ticked and removed independently; the card shows progress such as `1/3`
- Completed tasks stay in the *Completed* section until you delete them, and remain readable (softer colours, strike-through)

**Views (all working):** Dashboard · My Tasks · Today · Upcoming (grouped by date) · Overdue · Completed · Calendar · Categories · Settings

**Search, filter, sort**
- Search titles and descriptions from the top bar
- Filter by status, priority, category and due date (including a specific date). All filters and the search combine
- Sort by due date, priority, creation date or title (both directions)
- *Clear filters* resets everything

**Plan My Day:** star tasks as today's priorities (they reset automatically the next day), see a daily completion summary, and high-priority tasks are marked with a colour bar and a flag badge.

**Calendar:** monthly grid with tasks on their due dates. Click a date (or use the arrow keys) to see its tasks and create a new task for that date.

**Data safety**
- Unique ID, created / updated / completed timestamps per task
- Editing updates in place (no duplicates)
- Corrupted or partially invalid stored data is handled gracefully (the raw copy is kept under `taskflow.tasks.corrupted-backup`)
- Task text is always inserted as text, never as HTML
- Export all tasks and subtasks to JSON; import with validation and a **Merge / Replace / Cancel** choice; clear all data with explicit confirmation

**UX:** light/dark/system theme, toasts, empty states, keyboard-friendly controls, skip link, visible focus, labelled inputs, reduced-motion support, sidebar on desktop and a bottom bar plus slide-in menu on mobile.

## How to run

**Option 1 – just open it:** double-click `index.html`.

**Option 2 – VS Code Live Server (recommended while learning):**
1. Install the **Live Server** extension (Ritwick Dey) in VS Code.
2. Open the `taskflow` folder (File → Open Folder).
3. Right-click `index.html` → **Open with Live Server** (or click *Go Live* in the status bar).
4. The page reloads automatically whenever you save a file.

> LocalStorage is tied to the page's address (origin). `file:///…`, `http://127.0.0.1:5500` and `http://localhost:5500` each have **separate** storage. If you switch between ways of opening the app, use Export / Import to move your tasks.

## How LocalStorage works here

LocalStorage is a small key-value store built into your browser. TaskFlow keeps its data under these keys:

| Key | Contents |
|---|---|
| `taskflow.tasks.v1` | all tasks (with subtasks) as JSON |
| `taskflow.settings.v1` | theme and notification preference |
| `taskflow.notified.v1` | which reminders were already shown |

Things to know:
- Data stays on **this browser on this device**. It is not synced anywhere.
- Clearing browser/site data, or using a private/incognito window, can remove your tasks.
- Different browsers and profiles have separate storage.
- Browsers limit LocalStorage to roughly 5 MB (thousands of tasks, so rarely an issue).
- **Export a backup regularly** (Settings → Export JSON).

You can inspect it yourself: DevTools → Application → Local Storage.

## Reminders and their limits

Browser notifications are optional and off by default. Permission is requested only when you click **Enable notifications** in Settings. When enabled, TaskFlow shows a notification about 10 minutes before a task with a due time.

**Important limitation:** with no backend, a web page cannot run when the tab or browser is closed. Reminders therefore only work **while TaskFlow is open in a browser tab**. Reliable background reminders need a service worker with push notifications and a server, which is outside the scope of this version.

## How overdue is calculated

- Task **with** a due time: overdue once that exact local time has passed.
- Task **without** a due time: overdue only after the due date has fully passed (it becomes overdue the next day).
- Completed tasks are never overdue.
- All dates use the browser's local time zone. Due dates are stored as plain `YYYY-MM-DD` strings, so they never shift between time zones.

## Code overview (`script.js`)

The file is one self-contained function organized into labelled sections:

1. Constants · 2. Utilities (dates, DOM helper `el()`, icons) · 3. Storage (load, validate, save) · 4. Task operations (data only, no DOM) · 5. Selectors (stats, filter, sort) · 6. Toasts and confirm dialog · 7. UI building blocks (cards, chips, empty states) · 8. Views · 9. Task form and details dialogs · 10. Settings actions (theme, export/import, reminders) · 11. Navigation, `render()` and event wiring.

Design choices worth studying:
- **State → render:** `state` holds the data; `render()` rebuilds the current view from it. Elements are recreated on each render, so event listeners never pile up.
- **Safe DOM building:** `el(tag, props, ...children)` uses `textContent` and text nodes only.
- **Hash routing** (`#/today`) gives working back/forward buttons and keeps your place after a refresh.
- **Focus restore:** `data-focus-key` attributes let keyboard users keep their place after a re-render.

## Known limitations

- Data lives in one browser on one device (no sync, no accounts).
- Reminders only fire while the app is open (see above).
- No recurring tasks, drag-and-drop, or attachments.
- Calendar weeks start on Sunday, and there is no week or day view.
- If two tabs are open, the last one to save wins (tabs do refresh when another tab saves).
- Toasts shown while a dialog is open appear behind the dialog's dimmed backdrop.

## Ideas for future improvements

- Recurring tasks and reminders (daily practice habits, weekly reviews)
- Drag-and-drop to reorder tasks or move them between days on the calendar
- Tags in addition to categories; saved filters
- Streaks and weekly statistics charts for study / coding practice
- Keyboard shortcuts (e.g. `N` for a new task, `/` to search)
- Installable PWA with a service worker for offline use
- IndexedDB for larger data; later a backend or sync service
- Undo after delete; an archive instead of permanent deletion
- Rewrite in TypeScript or React once you are comfortable with the vanilla version