  const http = require("http");
  const { query } = require("@anthropic-ai/claude-agent-sdk");

  const sessions = {};
  const tasks = {};
  let taskCounter = 0;

  async function runClaude(taskId, prompt, sessionName, options) {
      try {
          const queryOptions = {
              maxTurns: options.maxTurns || 10,
              allowedTools: options.tools || ["Read", "Edit", "Write", "Bash", "Glob", "Grep"]
          };

          if (sessions[sessionName]) {
              queryOptions.resume = sessions[sessionName];
          }

          tasks[taskId].status = "running";
          tasks[taskId].started_at = Date.now();
          console.log("[" + taskId + "] Running...");

          let result = null;
          let sessionId = null;
          const activity = [];
          let turnCount = 0;

          for await (const msg of query({ prompt, options: queryOptions })) {
              if (msg.session_id) sessionId = msg.session_id;

              if (msg.type === "assistant" && msg.message && msg.message.content) {
                  for (const block of msg.message.content) {
                      if (block.type === "tool_use") {
                          turnCount++;
                          const entry = {
                              turn: turnCount,
                              tool: block.name,
                              time: Date.now()
                          };

                          if (block.input) {
                              if (block.input.file_path) entry.file = block.input.file_path;
                              if (block.input.command) entry.command = block.input.command.substring(0, 100);
                              if (block.input.pattern) entry.pattern = block.input.pattern;
                              if (block.input.description) entry.description = block.input.description;
                          }

                          activity.push(block.name + (entry.file ? ": " + entry.file : "") + (entry.command ? ": " +
  entry.command : ""));
                          tasks[taskId].current_step = entry;
                          tasks[taskId].activity = activity;
                          tasks[taskId].turns = turnCount;

                          console.log("[" + taskId + "] Turn " + turnCount + ": " + block.name + (entry.file ||
  entry.command ? " -> " + (entry.file || entry.command) : ""));
                      }
                  }
              }

              if (msg.type === "result") {
                  result = msg.result;
                  tasks[taskId].cost_usd = msg.total_cost_usd;
                  tasks[taskId].num_turns = msg.num_turns;
                  tasks[taskId].duration_api_ms = msg.duration_api_ms;
              }
          }

          if (sessionId) sessions[sessionName] = sessionId;

          tasks[taskId].status = "done";
          tasks[taskId].result = result;
          tasks[taskId].session_id = sessionId;
          tasks[taskId].finished_at = Date.now();
          tasks[taskId].duration_s = Math.round((tasks[taskId].finished_at - tasks[taskId].started_at) / 1000);
          tasks[taskId].current_step = null;
          console.log("[" + taskId + "] Done in " + tasks[taskId].duration_s + "s, " + turnCount + " turns, $" +
  (tasks[taskId].cost_usd || 0).toFixed(4));

      } catch (e) {
          tasks[taskId].status = "error";
          tasks[taskId].error = e.message;
          tasks[taskId].finished_at = Date.now();
          console.log("[" + taskId + "] Error: " + e.message);
      }
  }

  const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", chunk => body += chunk);
      req.on("end", () => {

          try {
              const request = JSON.parse(body);
              const action = request.action || "ask";

              if (action === "ask") {
                  const taskId = "task_" + (++taskCounter);
                  const sessionName = request.session || "default";

                  tasks[taskId] = {
                      status: "queued",
                      prompt: request.prompt,
                      session: sessionName,
                      queued_at: Date.now(),
                      turns: 0,
                      tools_used: [],
                      activity: [],
                      current_step: null
                  };

                  console.log("[" + taskId + "] Queued: " + request.prompt.substring(0, 80));

                  res.writeHead(200, { "Content-Type": "application/json" });
                  res.end(JSON.stringify({ task_id: taskId, status: "queued" }));

                  setImmediate(() => {
                      runClaude(taskId, request.prompt, sessionName, {
                          maxTurns: request.maxTurns,
                          tools: request.tools
                      });
                  });

              } else if (action === "status") {
                  const task = tasks[request.task_id];
                  res.writeHead(200, { "Content-Type": "application/json" });
                  if (!task) {
                      res.end(JSON.stringify({ error: "Unknown task_id" }));
                  } else {
                      const elapsed = task.started_at ? Math.round((Date.now() - task.started_at) / 1000) : 0;
                      res.end(JSON.stringify({
                          task_id: request.task_id,
                          status: task.status,
                          session: task.session,
                          prompt: task.prompt,
                          turns: task.turns,
                          current_step: task.current_step,
                          activity: task.activity,
                          elapsed_s: elapsed,
                          duration_s: task.duration_s || null,
                          cost_usd: task.cost_usd || null,
                          num_turns: task.num_turns || null,
                          result: task.result || null,
                          error: task.error || null,
                          session_id: task.session_id || null
                      }));
                  }

              } else if (action === "list") {
                  const summary = {};
                  for (const [id, t] of Object.entries(tasks)) {
                      const elapsed = t.started_at ? Math.round((Date.now() - t.started_at) / 1000) : 0;
                      summary[id] = {
                          status: t.status,
                          session: t.session,
                          turns: t.turns,
                          elapsed_s: elapsed,
                          prompt: t.prompt.substring(0, 60),
                          current_step: t.current_step
                      };
                  }
                  res.writeHead(200, { "Content-Type": "application/json" });
                  res.end(JSON.stringify(summary));

              } else if (action === "sessions") {
                  res.writeHead(200, { "Content-Type": "application/json" });
                  res.end(JSON.stringify({ sessions }));

              } else {
                  res.writeHead(200, { "Content-Type": "application/json" });
                  res.end(JSON.stringify({ error: "Unknown action" }));
              }

          } catch (e) {
              console.error("Parse error:", e.message);
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: e.message }));
          }
      });
  });

  server.listen(3456, () => {
      console.log("=== Claude Code Bridge (async) ===");
      console.log("Port: 3456");
      console.log("");
      console.log("API:");
      console.log("  ask:      POST { action, prompt, session, tools, maxTurns }");
      console.log("            Returns { task_id } immediately");
      console.log("");
      console.log("  status:   POST { action: 'status', task_id }");
      console.log("            Returns { status, turns, activity, result, cost_usd, ... }");
      console.log("");
      console.log("  list:     POST { action: 'list' }");
      console.log("  sessions: POST { action: 'sessions' }");
      console.log("");
      console.log("Ready.");
  });