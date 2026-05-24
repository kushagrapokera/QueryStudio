# QueryStudio — Implementation Plan

## Overview

QueryStudio is a Flask + React natural-language analytics notebook. Users ask questions in plain English; the system generates and executes Python or SQL, then renders results inline in an editor-style workspace.

---

## Build Order (Why Python First)

| Phase | Workflow | Rationale |
|---|---|---|
| 1 | **Python workflow first** | Simpler — no DB connections, no schema introspection. Gives us the full execution pipeline (Flask → subprocess → structured output → frontend rendering) to validate end-to-end. Everything learned here feeds directly into the SQL phase. |
| 2 | SQL workflow second | Reuses the same frontend rendering, same API patterns, same structured JSON output format. New pieces: DB connection management, schema introspection, SQL validation. |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend (React + Vite)        │
│  Monaco Editor  │  Result Renderer  │  File Upload│
└──────────────────────┬──────────────────────────┘
                       │  REST API (JSON)
┌──────────────────────▼──────────────────────────┐
│                Flask Backend                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Upload   │  │ Code Gen │  │ SQL Engine   │  │
│  │ & Profile│  │ & Exec   │  │ (Phase 2)    │  │
│  └──────────┘  └──────────┘  └──────────────┘  │
│                       │                          │
└───────────────────────┼──────────────────────────┘
                        │
          ┌─────────────┼──────────────────┐
          ▼             ▼                  ▼
     Ollama Cloud   subprocess     ┌──────────────┐
     (MiniMax 2.5   runner         │  Postgres /   │
      / Qwen3)      (Python)       │   MySQL       │
                                   │  ┌─────────┐  │
                                   │  │ Direct  │  │
                                   │  │ connect │  │
                                   │  ├─────────┤  │
                                   │  │ MCP     │  │
                                   │  │ server  │  │
                                   │  └─────────┘  │
                                   └──────────────┘
```

---

## Model Strategy

| Model | Role | When to Use |
|---|---|---|
| **MiniMax 2.5** | Primary model | NL-to-Python, NL-to-SQL, general instruction following, mixed analytical prompts |
| **Qwen3-Coder:480b** | Fallback | Code-heavy SQL generation, complex pandas operations, when MiniMax output needs refinement |

**Access**: Both via Ollama Cloud API keys.

**Context strategy**: Keep prompts compact. Never dump full datasets or schemas. Send only column names, dtypes, sample rows, and the user's current query.

---

## Phase 1 — Python Workflow

### Step 1.1 — Project Scaffold
- [ ] **Flask backend scaffold**
  - App factory pattern, config loading, CORS setup, error handlers
  - `app/` package with `routes/`, `services/`, `models/` structure
  - `requirements.txt` (Flask, pandas, numpy, openpyxl, plotly, python-dotenv)
- [ ] **React frontend scaffold**
  - Vite + React + TypeScript
  - Basic layout: sidebar (file list / queries) + main panel (editor + results)
  - Install deps: `@monaco-editor/react`, `react-plotly.js`, `axios`
- [ ] **API blueprint**
  - `POST /api/upload` — upload CSV/Excel
  - `POST /api/query` — ask a question (Python mode)
  - `GET /api/datasets` — list uploaded datasets

### Step 1.2 — File Upload & Dataset Profiling
- [x] Upload endpoint accepts CSV/Excel, saves to `uploads/` directory
- [x] Parse file into pandas DataFrame
- [x] Extract compact profile:
  - Column names
  - Data types
  - Shape (rows × columns)
  - First 3–5 sample rows
  - Basic stats for numeric columns (min, max, mean)
- [x] Store profile in memory/session (lightweight — file path + profile JSON)
- [x] Return profile to frontend for display

### Step 1.3 — LLM Integration (Python Code Gen)
- [x] Ollama Cloud API client module
  - Generic `generate(prompt, model)` function
  - Model fallback logic: try MiniMax, fall back to Qwen3 on failure
- [x] Build Python code generation prompt:
  - Dataset profile (columns, dtypes, samples)
  - User question
  - Instruction: output ONLY Python code, no explanation
  - Instruction: use `df` as the dataframe variable
  - Instruction: use `print()` for text output, store Plotly figures as `fig`
- [x] Parse model response to extract code block
- [x] Handle malformed responses (retry or error)

### Step 1.4 — Safe Python Execution
- [x] Subprocess-based runner (`subprocess.run` with timeout)
- [x] Sandbox constraints:
  - Timeout (30 seconds)
  - Restricted imports via wrapper (safe list: pandas, numpy, plotly, json, math, statistics)
  - No network access (os, subprocess not available in wrapper)
- [x] Inject dataset as CSV into subprocess (subprocess reads CSV from disk)
- [x] Capture stdout, stderr, return code
- [x] Structured output via wrapper JSON + parser fallback:

| Output Type | Detection | Format |
|---|---|---|
| Table | `print(df.to_json(...))` or detected DataFrame print | `{type: "table", columns, rows}` |
| Chart | `fig.show()` or `fig.to_json()` in stdout | `{type: "chart", library: "plotly", figure}` |
| Text | Plain stdout | `{type: "text", content}` |
| Error | stderr or non-zero exit | `{type: "error", ename, message}` |

### Step 1.5 — API Wiring
- [x] `POST /api/query` endpoint:
  1. Receive `{dataset_id, query}`
  2. Load dataset profile
  3. Call LLM for code generation
  4. Execute code in subprocess
  5. Parse output into structured JSON
  6. Return to frontend
- [x] Request logging (for debugging and audit)

### Step 1.6 — Frontend: Editor + Results
- [x] Monaco Editor component with SQL/Python syntax highlighting toggle
- [x] Result renderer components:
  - `TextResult` — plain text display
  - `TableResult` — sortable HTML table with CSV download
  - `ChartResult` — Plotly chart (via react-plotly.js)
  - `ErrorResult` — formatted error with expandable traceback
- [x] Query submission flow:
  1. User types question
  2. Loading state while backend generates + executes
  3. Result appears inline below the editor
- [x] Query history panel (last N queries with click-to-recall)
- [x] File/dataset selector UI

### Step 1.7 — Basic Polish
- [x] Loading indicators and disabled states
- [x] Error display for API failures (extracts backend message)
- [x] Empty states (no dataset, no queries yet — context-aware)
- [x] Responsive layout basics
- [x] Keyboard shortcut hint (Ctrl+Enter)
- [x] Text truncation for long results (40-line fold with "Show all")

---

## Phase 2 — SQL Workflow

### Step 2.1 — Database Connection Management
- [ ] Connection endpoints:
  - `POST /api/connections` — save a new connection
  - `GET /api/connections` — list saved connections
  - `DELETE /api/connections/:id` — remove connection
- [ ] **Two connection modes**:
  - **Direct mode**: host, port, database, user, password → backend uses psycopg2/MySQL connector directly
  - **MCP mode**: MCP server URL/configuration → backend routes DB operations through MCP tool calls
- [ ] Read-only user enforcement reminder for direct connections
- [ ] Test connection endpoint (works for both modes)
- [ ] `/api/connections/:id/mode` — switch or detect connection mode

### Step 2.2 — Schema Introspection
- [ ] Schema extraction endpoint: `GET /api/connections/:id/schema`
- [ ] Schema retrieval works through **both connection modes**:
  - **Direct**: query `information_schema` tables via psycopg2/MySQL connector
  - **MCP**: use MCP tool calls (e.g., `list_tables`, `describe_table`) to fetch schema metadata
- [ ] For each connected database, extract:
  - Table names
  - Column names + data types
  - Primary keys
  - Foreign keys
  - Indexes
  - 2–3 sample rows per table
- [ ] Compact schema formatter (for LLM prompt):
  ```
  customers(id:int, name:varchar, country:varchar, created_at:timestamp)
  orders(id:int, customer_id:int, amount:decimal, order_date:date)
  orders.customer_id → customers.id
  ```

### Step 2.3 — SQL Generation (LLM)
- [ ] Build SQL generation prompt:
  - Database type (Postgres/MySQL)
  - Compact schema context
  - User question
  - Instruction: output ONLY SQL, no explanation
  - Instruction: use only `SELECT` or `WITH` queries
  - Instruction: include `LIMIT` when absent
- [ ] Use MiniMax 2.5 as primary, Qwen3-Coder as fallback for complex queries
- [ ] Parse and extract SQL from model response

### Step 2.4 — SQL Validation Layer
- [ ] Parse/validate generated SQL:
  - Must begin with `SELECT` or `WITH`
  - Reject: `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE`
  - Reject chained/multiple statements
  - Auto-inject `LIMIT 100` when no `LIMIT` clause present
  - Check for dangerous patterns (e.g., `pg_sleep` , heavy cartesian joins)
- [ ] Return validation error if query fails checks

### Step 2.5 — SQL Execution (Two Paths)
- [ ] **Execution router** — detect connection mode and dispatch accordingly:
  - **Direct mode**: execute via psycopg2/MySQL connector with read-only enforcement
  - **MCP mode**: execute via MCP tool call (e.g., `run_sql` or `execute_query` tool)
- [ ] Query timeout (e.g., 30 seconds) for both modes
- [ ] Auto-inject `LIMIT 100` for SELECT queries missing a LIMIT clause
- [ ] Result formatting (same for both modes):
  - Fetch all rows, convert to `{type: "table", columns, rows}` JSON
  - Detect chart-ready data (numeric + date columns)
- [ ] `POST /api/connections/:id/query` endpoint:
  1. Load schema context
  2. Generate SQL via LLM
  3. Validate SQL
  4. Execute SQL via the appropriate path (direct or MCP)
  5. Return structured JSON

### Step 2.6 — Frontend: SQL Tab + Schema Browser
- [ ] Tab/mode switch: Python ↔ SQL
- [ ] Connection manager UI (add/edit/delete connections)
- [ ] Schema browser panel (expandable table list with columns)
- [ ] SQL result rendering (reuse Python result components)
- [ ] Option to view generated SQL before execution

---

## Phase 3 — Integration & Polish

### Step 3.1 — Session & State
- [ ] Lightweight user/workspace concept (local storage or simple cookie)
- [ ] Recent queries list (last 5–10 per workspace)
- [ ] File reference persistence across page reloads (basic)

### Step 3.2 — Error Handling & Edge Cases
- [ ] LLM timeout / unavailable → clear user message + retry option
- [ ] Subprocess crash → structured error with diagnostics
- [ ] DB connection loss → reconnect or clear notification
- [ ] Large dataset handling → truncation warnings
- [ ] Empty results display

### Step 3.3 — UX Refinements
- [ ] Theme toggle (light/dark)
- [ ] Keyboard shortcuts (Ctrl+Enter to run query)
- [ ] Result export (CSV download for tables)
- [ ] Copy generated code to clipboard
- [ ] Query cancellation (stop button for long-running queries)

### Step 3.4 — Code Quality
- [ ] Backend error handling consistency
- [ ] Frontend TypeScript types for all API responses
- [ ] Basic input sanitization (file names, query strings)
- [ ] Configuration via environment variables

---

## Project File Structure (Target)

```
querystudio/
├── backend/
│   ├── app/
│   │   ├── __init__.py          # App factory
│   │   ├── config.py            # Configuration
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── upload.py        # File upload endpoints
│   │   │   ├── python_query.py  # Python query endpoint
│   │   │   ├── connections.py   # DB connection endpoints (Phase 2)
│   │   │   └── sql_query.py     # SQL query endpoints (Phase 2)
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── profiler.py      # Dataset profiling
│   │   │   ├── llm_client.py    # Ollama Cloud API client
│   │   │   ├── python_executor.py  # Subprocess runner
│   │   │   ├── output_parser.py # Structured output parsing
│   │   │   ├── schema.py        # Schema introspection (Phase 2)
│   │   │   ├── sql_validator.py # SQL validation (Phase 2)
│   │   │   ├── sql_executor.py  # SQL execution — direct (Phase 2)
│   │   │   └── mcp_client.py    # MCP-based schema + query client (Phase 2)
│   │   └── models/
│   │       └── __init__.py
│   ├── uploads/                 # Uploaded files directory
│   ├── requirements.txt
│   └── .env                     # API keys, config
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Layout/
│   │   │   ├── Editor/
│   │   │   │   └── QueryEditor.tsx    # Monaco wrapper
│   │   │   ├── Results/
│   │   │   │   ├── ResultRenderer.tsx
│   │   │   │   ├── TableResult.tsx
│   │   │   │   ├── ChartResult.tsx
│   │   │   │   └── ErrorResult.tsx
│   │   │   ├── Sidebar/
│   │   │   ├── FileUpload/
│   │   │   └── ConnectionManager/    # Phase 2
│   │   ├── api/
│   │   │   └── client.ts        # Axios API client
│   │   ├── types/
│   │   │   └── index.ts         # Shared TypeScript types
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
└── implementation.md
```

---

## Key Technical Decisions

| Decision | Choice | Why |
|---|---|---|
| Frontend build | Vite + React + TypeScript | Fast dev, good DX, standard React setup |
| Code editor | Monaco Editor | Richer feature set than CodeMirror, SQL/Python support built-in |
| Charts | Plotly (react-plotly.js) | Same library in both Python and frontend — figure JSON passes through directly |
| Python execution | subprocess with timeout | Simpler than IPython kernel, good for stateless per-request model |
| LLM access | Ollama Cloud API (REST) | Consistent interface for both MiniMax 2.5 and Qwen3-Coder |
| SQL access (direct) | psycopg2 / MySQL connector | Simple, well-understood, full control over read-only enforcement |
| SQL access (MCP) | MCP client module (HTTP to MCP server) | Parallel path — schema + queries via MCP tools, same output format |
| CSS | Tailwind CSS | Fast iteration, utility-first, good with React |
| Output format | Structured JSON | Unified renderer on frontend, type-based dispatch |

---

## Estimated Sequence

```
Week 1:  Phase 1 Steps 1.1–1.3 (scaffold, upload, LLM client)
Week 2:  Phase 1 Steps 1.4–1.5 (execution, API wiring)
Week 3:  Phase 1 Steps 1.6–1.7 (frontend, polish)
Week 4:  Phase 2 Steps 2.1–2.3 (connections, schema, SQL gen)
Week 5:  Phase 2 Steps 2.4–2.6 (validation, execution, frontend)
Week 6+: Phase 3 (integration, polish, edge cases)
```

This is a rough guide — adjust based on actual velocity.
