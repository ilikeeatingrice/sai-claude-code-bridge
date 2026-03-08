# Sai-Claude Code Bridge

An HTTP bridge server that enables the [Sai AI assistant](https://www.simular.ai/) to delegate coding tasks to [Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview) — Anthropic's agentic coding tool. Sai handles desktop and browser automation while Claude Code handles code generation, file editing, terminal commands, and multi-step engineering workflows.

## How It Works

```
User Request
     |
     v
  Sai Agent
     |
     ├── GUI tasks (clicks, forms, browser) ──> Desktop Automation
     |
     └── Coding tasks ──> HTTP POST to localhost:3456 ──> Claude Code Bridge
                                                              |
                                                              v
                                                         Claude Code
                                                     (reads, writes, edits,
                                                      runs commands, etc.)
```

Sai submits coding tasks via HTTP, and the bridge server manages them asynchronously — queuing work, streaming progress, and returning results. Tasks run in **named sessions** so Claude Code retains context across related requests (e.g., "build a Flask app" then "add a /dashboard route" in the same session).

## Files

| File | Description |
|------|-------------|
| `claude_bridge.js` | The bridge server. An async HTTP server (port 3456) that accepts task requests, runs them through the Claude Code Agent SDK, and reports results. |
| `claude-code.md` | Reference documentation for Sai describing how to call the bridge, which tools to allow, session management, and delegation patterns. |

## Prerequisites

- **Node.js** (v18 or later)
- **Claude Code** installed and authenticated on the machine (`npm install -g @anthropic-ai/claude-code`)
- **Anthropic API key** configured for Claude Code (via `claude login` or environment variable)

## Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/ilikeeatingrice/sai-claude-code-bridge.git
   cd sai-claude-code-bridge
   ```

2. **Install the Claude Code Agent SDK dependency**

   ```bash
   npm install @anthropic-ai/claude-agent-sdk
   ```

3. **Start the bridge server**

   ```bash
   node claude_bridge.js
   ```

   You should see:

   ```
   === Claude Code Bridge (async) ===
   Port: 3456
   Ready.
   ```

## API Reference

All requests are `POST` to `http://localhost:3456` with a JSON body.

### Submit a Task

Submit a coding task to Claude Code. Returns immediately with a `task_id`.

```json
{
  "action": "ask",
  "prompt": "Create a Python Flask app with user authentication",
  "session": "webapp",
  "tools": ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
  "maxTurns": 15
}
```

**Response:**

```json
{ "task_id": "task_1", "status": "queued" }
```

### Check Task Status

Poll for task progress and results.

```json
{
  "action": "status",
  "task_id": "task_1"
}
```

**Response:**

```json
{
  "task_id": "task_1",
  "status": "done",
  "turns": 8,
  "activity": ["Write: app.py", "Bash: pip install flask", "..."],
  "elapsed_s": 42,
  "cost_usd": 0.0312,
  "result": "Created Flask app with login/register routes...",
  "error": null
}
```

Task statuses: `queued` | `running` | `done` | `error`

### List Tasks

```json
{ "action": "list" }
```

Returns a summary of all tasks with their status, session, turn count, and current step.

### List Sessions

```json
{ "action": "list_sessions" }
```

Returns the names of all active sessions.

## Available Tools

Control what Claude Code can do on each request by passing a `tools` array:

| Tool   | Capability              |
|--------|-------------------------|
| `Read` | Read file contents      |
| `Write`| Create new files        |
| `Edit` | Modify existing files   |
| `Bash` | Run terminal commands   |
| `Glob` | Find files by pattern   |
| `Grep` | Search within files     |

**Examples:**

```javascript
// Read-only analysis (safe — no modifications)
{ "tools": ["Read", "Glob", "Grep"] }

// Full coding (can create and modify files, run commands)
{ "tools": ["Read", "Edit", "Write", "Bash", "Glob", "Grep"] }

// Terminal-only
{ "tools": ["Bash"] }
```

## Session Management

Sessions let Claude Code maintain context across related tasks. Use the same `session` name for tasks that build on each other:

```javascript
// Task 1: Claude Code creates the app
{ "prompt": "Create a Flask app with user auth", "session": "webapp" }

// Task 2: Claude Code remembers the app it just built
{ "prompt": "Add a /dashboard route",            "session": "webapp" }

// Independent work uses a different session
{ "prompt": "Write a data pipeline script",      "session": "data" }
```

## Usage Patterns

### Quick Tasks (< 30 seconds)

For fast operations like reading files, small edits, or simple commands — submit and poll once:

```javascript
const task = await submitTask("Check for unused imports in src/", "cleanup", ["Read", "Glob", "Grep"], 5);
// Wait a few seconds, then:
const result = await checkTask(task.task_id);
```

### Long Tasks (> 30 seconds)

For building apps, large refactors, or multi-step workflows — submit, then poll periodically:

```javascript
const task = await submitTask(
  "Build a REST API with Express, add CRUD endpoints, write tests, and start the server",
  "backend",
  ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
  25
);
// Poll every 15-30 seconds until status is "done" or "error"
```

### Parallel Tasks

Run independent tasks concurrently using different sessions:

```javascript
const [backend, frontend, tests] = await Promise.all([
  submitTask("Build a FastAPI backend",       "backend"),
  submitTask("Create a React frontend",       "frontend"),
  submitTask("Write pytest tests for auth",   "tests")
]);
```

## Delegation Model

The Sai + Claude Code delegation pattern:

1. **Break** the user's request into GUI tasks and coding tasks
2. **Delegate** coding tasks to Claude Code via the bridge
3. **Handle** GUI tasks (clicks, forms, browser navigation) with Sai's desktop automation
4. **Verify** Claude Code's output — read files, run the app, check in the browser
5. **Iterate** — if something failed, send the error back to Claude Code in the same session
6. **Report** combined results to the user

## License

MIT
