# @raoxxxwq/pi-tasks

A [pi](https://pi.dev) extension that brings Claude Code-style task tracking and coordination to pi. Track multi-step work with structured tasks, dependency management, and a persistent visual widget.

> **Status:** Early release.

<img width="600" alt="pi-tasks screenshot" src="https://github.com/tintinweb/pi-tasks/raw/master/media/screenshot.png" />

## Features

- **4 LLM-callable tools** — `TaskCreate`, `TaskList`, `TaskGet`, `TaskUpdate`
- **Persistent widget** — live task list above the editor with `✔` / `◼` / `◻` status icons, task numbers, and an active spinner for in-progress work
- **System-reminder injection** — periodic `<system-reminder>` nudges when task tools have not been used recently
- **Dependency management** — bidirectional `blocks` / `blockedBy` relationships with warnings for cycles, self-deps, and dangling references
- **Shared task lists** — multiple pi sessions can share a file-backed task list for coordination
- **File locking** — concurrent access is safe when multiple sessions share a task list
- **Auto-clear completed tasks** — optional delayed cleanup for completed work

## Install

```bash
pi install npm:@raoxxxwq/pi-tasks
```

Or load directly for development:

```bash
pi -e ./src/index.ts
```

## Widget

The extension renders a persistent widget above the editor:

```
● 4 tasks (1 done, 1 in progress, 2 open)
  ✔ #1 Design the flux capacitor
  ✳ #2 Acquiring plutonium... (2m 49s · ↑ 4.1k ↓ 1.2k)
  ◻ #3 Install flux capacitor in DeLorean › blocked by #1
  ◻ #4 Test time travel at 88 mph › blocked by #2, #3
```

| Icon | Meaning |
|------|---------|
| `✔` | Completed (strikethrough + dim) |
| `◼` | In-progress (not actively executing) |
| `◻` | Pending |
| `✳` / `✽` | Active in-progress task (shows `activeForm`, elapsed time, token counts) |

### Widget display settings

How tasks are sorted and how many are shown can be configured via `/tasks` -> Settings (saved to `.pi/tasks-config.json`).

| Setting | Values | Default | Behaviour |
|---------|--------|---------|-----------|
| `sortOrder` | `id` / `status` / `recent` / `oldest` | `id` | `id` = creation order; `status` groups completed -> in-progress -> pending; `recent` / `oldest` = by last-updated time |
| `maxVisible` | `5`-`100` | `10` | Caps how many task lines the widget shows (ignored when `showAll` is on) |
| `showAll` | `true` / `false` | `false` | When `true`, every task is shown regardless of `maxVisible` |
| `hiddenAt` | `bottom` / `top` | `bottom` | When the list overflows `maxVisible`, where the `... and N more` collapse happens |

> Note: the widget's `status` order is completed-first, which is the reverse of the `TaskList` tool's pending-first order.

## Tools

### `TaskCreate`

Create a structured task. Used proactively for complex multi-step work.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `subject` | string | yes | Brief imperative title |
| `description` | string | yes | Detailed context and acceptance criteria |
| `activeForm` | string | no | Present continuous form for spinner (for example, `Running tests`) |
| `metadata` | object | no | Arbitrary key-value pairs |

### `TaskList`

List all tasks with status, owner, and blocked-by info.

Sort order: pending first, then in-progress, then completed (each group by ID).

### `TaskGet`

Get full details for a specific task.

Shows owner (if set) and open (non-completed) dependency edges. Non-empty metadata is displayed as JSON.

### `TaskUpdate`

Update task fields, status, metadata, and dependencies.

| Parameter | Type | Description |
|-----------|------|-------------|
| `taskId` | string | Task ID (required) |
| `status` | `pending` / `in_progress` / `completed` / `deleted` | New status |
| `subject` | string | New title |
| `description` | string | New description |
| `activeForm` | string | Spinner text |
| `owner` | string | Owner or assignee label |
| `metadata` | object | Shallow merge (null values delete keys) |
| `addBlocks` | string[] | Task IDs this task blocks |
| `addBlockedBy` | string[] | Task IDs that block this task |

Setting `status: "deleted"` permanently removes the task.

## Task Lifecycle

```
pending -> in_progress -> completed
                     -> deleted (permanently removed)
```

Tasks are created as `pending`. Mark `in_progress` before starting work, `completed` when done. `deleted` removes entirely and IDs never reset.

## Dependency Management

- **Bidirectional edges** — `addBlocks` / `addBlockedBy` maintain both sides automatically
- **Dependency warnings** — cycles, self-dependencies, and references to non-existent tasks are stored but produce warnings in tool responses
- **Display-time filtering** — `TaskList` only shows non-completed blockers in `[blocked by ...]`
- **Raw data preserved** — `TaskGet` shows all edges, including completed blockers
- **Cleanup on deletion** — removing a task cleans up all edges pointing to it

## Task Storage

Task storage is controlled by the `taskScope` setting (`/tasks` -> Settings -> Task storage):

| Mode | File | Behaviour |
|------|------|-----------|
| `memory` | *(none)* | In-memory only — tasks lost when session ends |
| `session` **(default)** | `<cwd>/.pi/tasks/tasks-<sessionId>.json` | Per-session file — isolated between sessions, survives resume |
| `project` | `<cwd>/.pi/tasks/tasks.json` | Shared across all sessions in the project |

On new session start, if all persisted tasks are completed they are auto-cleared for a clean slate. On session resume, all tasks (including completed) are shown so the user can review progress. Empty session files are automatically deleted when all tasks are cleared.

### Auto-clear completed tasks

The `autoClearCompleted` setting controls automatic cleanup of completed tasks:

| Mode | Behaviour |
|------|-----------|
| `never` | Completed tasks stay visible until manually cleared via `/tasks` -> Clear completed |
| `on_list_complete` **(default)** | Cleared after all tasks are done and a few idle turns pass |
| `on_task_complete` | Each completed task is cleared individually after a few turns |

Both auto-clear modes use a turn-based delay for non-jarring UX.

Settings (`taskScope`, `autoClearCompleted`, `sortOrder`, `maxVisible`, `showAll`, `hiddenAt`) are saved to `<cwd>/.pi/tasks-config.json`.

### Override via environment variables

| Variable | Value | Behaviour |
|----------|-------|-----------|
| `PI_TASKS` | `off` | In-memory only (CI / automation) |
| `PI_TASKS` | `sprint-1` | Named shared list at `~/.pi/tasks/sprint-1.json` |
| `PI_TASKS` | `/abs/path/tasks.json` | Explicit absolute file path |
| `PI_TASKS` | `./tasks.json` | Relative path resolved from cwd |
| *(unset)* | | Uses `taskScope` setting (default: `session`) |
| `PI_TASKS_DEBUG` | `1` | Trace extension debug logs to stderr |

Named and explicit paths use a file-locked store with stale-lock detection.

## `/tasks` Command

Interactive menu:

```
Tasks
├─ View all tasks (4)
├─ Create task
├─ Clear completed (1)
├─ Clear all (4)
└─ Settings
```

- **View all tasks** — select a task to see details and take actions (start, complete, delete)
- **Create task** — input prompts for subject and description
- **Clear completed** — remove all completed tasks
- **Clear all** — remove all tasks regardless of status
- **Settings** — configure task storage, auto-clear completed tasks, and widget display settings

## Architecture

```
src/
├── index.ts            # Extension entry: 4 tools + /tasks command + widget
├── types.ts            # Task and store data types
├── task-store.ts       # File-backed store with CRUD, dependencies, locking
├── auto-clear.ts       # Turn-based auto-clearing of completed tasks
├── reminder-cadence.ts # Reminder cadence logic
├── tasks-config.ts     # Config persistence -> .pi/tasks-config.json
└── ui/
    ├── task-widget.ts    # Persistent widget with status icons and spinner
    └── settings-menu.ts  # /tasks -> Settings panel
```

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

## License

MIT — [tintinweb](https://github.com/tintinweb)