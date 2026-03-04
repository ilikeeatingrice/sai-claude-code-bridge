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

```javascript
// Helper function - use this in all Claude Code interactions
function callClaude(prompt, session, tools, maxTurns) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      action: 'ask',
      prompt: prompt,
      session: session || 'default',
      tools: tools || ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'],
      maxTurns: maxTurns || 10
    });
    const http = require('http');
    const req = http.request('http://localhost:3456', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}
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

Task: "Build a Python web app and open it in the browser"

```javascript
// Step 1: Delegate coding to Claude Code
var result = await callClaude(
  "Create a Python Flask app in C:\\Users\\simularuser\\Desktop\\webapp\\ that shows system stats (CPU, memory, disk). Include a requirements.txt. Install dependencies and start the server on port 5000.",
  "webapp",
  ["Read", "Write", "Edit", "Bash", "Glob", "Grep"]
);
console.log("Claude Code:", result.result);

// Step 2: Verify the server is running (you do this part)
await wait({ waitTime: 3 });
var page = await browser.newtab("http://localhost:5000");
await page.wait({ waitTime: 3 });
await page.screenshot();
// Visually confirm the dashboard loads

// Step 3: If something is wrong, send error back to Claude Code
var fix = await callClaude(
  "The page shows a 500 error. Check the Flask logs and fix the issue.",
  "webapp"  // same session - Claude remembers the app it built
);
console.log("Fix:", fix.result);
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
2. **Delegate** coding to Claude Code via the bridge
3. **Do** GUI tasks yourself via desktop/browser automation
4. **Verify** Claude Code's output — read files, run code, check in browser
5. **If something failed**, send the error back to Claude Code in the same session
6. **Report** combined results to the user

## Troubleshooting

- **Bridge not responding:** Ask user to run `node C:\Users\simularuser\Desktop\claude-bridge.js` in PowerShell
- **Timeout:** Increase `maxTurns` for complex tasks, or break into smaller prompts
- **Wrong output:** Send a follow-up in the same session with corrections
- **Need to start fresh:** Use a new session name