# Claude Code Bridge

## What Is This
Claude Code is a powerful AI coding agent running on this machine. It can read, write, and edit files, run terminal commands, search codebases, and handle complex multi-step engineering tasks. Access it via HTTP bridge at localhost:3456.

## Prerequisites
The bridge server must be running. If it's not, open PowerShell and run:
```javascript
// Check if bridge is running
const http = require('http');
http.get('http://localhost:3456', (res) => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => console.log('Bridge status:', d));
}).on('error', () => console.log('Bridge not running - ask user to start it'));
```

## How To Call Claude Code

### The Standard Two-Step Pattern (Submit & Poll)
**ALWAYS use this pattern for all tasks to avoid timeouts.** Submit the task, get the ID, and then poll for status in subsequent steps.

```javascript
// Function to submit a task (returns task_id immediately)
function submitTask(prompt, session, tools, maxTurns) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      action: 'ask',
      prompt: prompt,
      session: session || 'default',
      tools: tools || ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'],
      maxTurns: maxTurns || 15
    });
    const http = require('http');
    const req = http.request('http://localhost:3456', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Function to check task status
function checkTask(taskId) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ action: 'status', task_id: taskId });
    const http = require('http');
    const req = http.request('http://localhost:3456', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Helper for human-readable listing
function listActiveTasks() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ action: 'list_tasks' });
    const http = require('http');
    const req = http.request('http://localhost:3456', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}
```

### Usage Pattern
1. **Submit**: Create the task and log the `task_id`.
2. **Poll**: Wait or perform other tasks, then check status.
3. **Format**: When presenting JSON data (like lists), format it cleanly for the user.


**Usage for long tasks:**

```javascript
// First execute block - submit the task
var task = await submitTask(
  "Build a complete stock market visualizer with Flask, yfinance, and charts",
  "stockviz",
  ["Read", "Write", "Edit", "Bash"],
  25
);
console.log("Task submitted:", task.task_id);
task.task_id  // Store this!
```

```javascript
// Second execute block - check status (run this separately, after waiting)
var status = await checkTask(task.task_id);
if (status.status === 'done') {
  console.log("✓ Complete!", status.result);
} else if (status.status === 'error') {
  console.log("✗ Error:", status.error);
} else {
  console.log("Status:", status.status, "- check again in a moment");
}
status
```

## When To Use Claude Code

**USE CLAUDE CODE FOR:**
- Writing, editing, or debugging code in any language
- Reading and analyzing files or codebases
- Running terminal commands that need reasoning about the output
- Refactoring, architecture decisions, code review
- Writing tests, fixing build errors
- Multi-step engineering tasks that build on each other
- Installing packages, configuring tools
- Any task where you would normally type into a terminal

**DO IT YOURSELF (desktop/browser automation) FOR:**
- Opening apps, clicking UI elements, navigating websites
- Filling forms, visual verification, taking screenshots
- Interacting with GUIs that have no CLI equivalent
- Downloading files from browsers
- Anything that requires seeing the screen

## Session Management

Use the `session` parameter to maintain context across related tasks:

```javascript
// Same session = Claude remembers everything
var r1 = await callClaude("Create a Flask app with user auth", "webapp");
// ... later ...
var r2 = await callClaude("Add a /dashboard route", "webapp");  // knows about the Flask app

// Different session = independent context
var r3 = await callClaude("Write a data pipeline script", "data");  // separate work
```

## Available Tools

Control what Claude Code can do per request:

| Tool  | What It Does          |
|-------|-----------------------|
| Read  | Read file contents    |
| Write | Create new files      |
| Edit  | Modify existing files |
| Bash  | Run terminal commands |
| Glob  | Find files by pattern |
| Grep  | Search file contents  |

```javascript
// Read-only analysis (safe)
await callClaude("Analyze this codebase for bugs", "review", ["Read", "Glob", "Grep"]);

// Full coding (can modify files)
await callClaude("Build a REST API", "backend", ["Read", "Edit", "Write", "Bash", "Glob", "Grep"]);

// Just terminal commands
await callClaude("Check disk space and running processes", "ops", ["Bash"]);
```

## Example: Complete Workflow

### Quick Task Workflow

Task: "Analyze a codebase for bugs"

```javascript
// Simple one-step call for quick tasks
var result = await callClaude(
  "Analyze the Python files in C:\\Users\\simularuser\\Desktop\\myapp\\ for potential bugs and security issues",
  "analysis",
  ["Read", "Glob", "Grep"],
  5
);
console.log("Analysis:", result.result);
```

### Long Task Workflow (Two-Step)

Task: "Build a Python web app and open it in the browser"

```javascript
// Step 1: Submit the long-running build task
var task = await submitTask(
  "Create a Python Flask app in C:\\Users\\simularuser\\Desktop\\webapp\\ that shows system stats (CPU, memory, disk). Include a requirements.txt. Install dependencies and start the server on port 5000.",
  "webapp",
  ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
  15
);
console.log("Task ID:", task.task_id);
```

```javascript
// Step 2: Check status (run this in a separate execute block after ~30-60 seconds)
var status = await checkTask(task.task_id);
if (status.status === 'done') {
  console.log("✓ Build complete!", status.result);

} else {
  console.log("Not ready yet, status:", status.status);
}
```

```javascript
// Step 3: Once done, verify the server is running (you do this part)
await wait({ waitTime: 2 });
var page = await browser.newtab("http://localhost:5000");
await page.wait({ waitTime: 2 });
await page.screenshot();
// Visually confirm the dashboard loads
```

```javascript
// Step 4: If something is wrong, send error back to Claude Code
var fixTask = await submitTask(
  "The page shows a 500 error. Check the Flask logs and fix the issue.",
  "webapp",  // same session - Claude remembers the app it built
  ["Read", "Edit", "Bash"],
  10
);
console.log("Fix task submitted:", fixTask.task_id);
```

## Example: Multi-Session Parallel Work

```javascript
// Kick off multiple independent tasks
var [backend, frontend, tests] = await Promise.all([
  callClaude("Build a FastAPI backend with CRUD endpoints", "backend"),
  callClaude("Create a React frontend with a todo list", "frontend"),
  callClaude("Write pytest tests for a user auth module", "tests")
]);
```

## Delegation Pattern

1. **Break** the user's request into GUI tasks (you) and coding tasks (Claude Code)
2. **Delegate** coding to Claude Code:
   - Quick tasks (< 30s): Use `callClaude()` directly
   - Long tasks (> 30s): Use `submitTask()` then poll with `checkTask()`
3. **Do** GUI tasks yourself via desktop/browser automation
4. **Verify** Claude Code's output — read files, run code, check in browser
5. **If something failed**, send the error back to Claude Code in the same session
6. **Report** combined results to the user

## When To Use Each Pattern

**Use `callClaude()` (single step) for:**
- Reading/analyzing files
- Simple code generation (< 50 lines)
- Quick refactors or bug fixes
- Running simple bash commands
- Tasks that complete in under 30 seconds

**Use `submitTask()` + `checkTask()` (two-step) for:**
- Building complete applications from scratch
- Installing dependencies and starting servers
- Large refactors or migrations
- Processing large codebases
- Any task with maxTurns > 15
- Anything that might take more than 30 seconds

## Reporting Results
When displaying lists of tasks or sessions, **DO NOT** just dump raw JSON. Format it as a clean Markdown table or list for readability.

### Example: Formatting Task List
```javascript
const response = await listActiveTasks();
const tasks = response.tasks;
console.log("| ID | Status | Session | Description | Started |");
console.log("|----|--------|---------|-------------|---------|");
for (const [id, info] of Object.entries(tasks)) {
  const date = new Date(info.started_at).toLocaleTimeString();
  console.log(`| ${id} | ${info.status} | ${info.session} | ${info.description} | ${date} |`);
}
```