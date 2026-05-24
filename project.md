We are building a **natural-language analytics notebook** — a code-editor-style interface where users ask questions in plain English, and the system automatically generates, executes, and displays SQL or Python results inside the same workspace. Instead of only generating code like a chatbot, the platform acts as an intelligent execution environment for data analysis.

### How it behaves

The interface is closer to a lightweight Jupyter-style editor or code workspace than to a chat app. Users work in an execution-driven environment where code is generated from their query, run by the system, and shown inline with the result. That means Python and SQL are not just output formats — they are the actual execution layers of the product.

### What it does

This project has two main workflows:

1. **Python workflow** — Users upload CSV or Excel files and ask for analysis or visualizations. The system generates Python-based analysis, executes it, and renders the result as tables, summaries, or charts.
2. **SQL workflow** — Users connect their Postgres or MySQL databases, the system uses schema context to generate SQL from natural language, executes it through a controlled layer, and displays the returned data in tabular or visual form.

## Python part

For the Python side, you should think of it as a **lightweight Flask-based execution engine for dataset analysis**, not a full Jupyter clone. Since this is a project and you are using a small SLM, the Python flow should be mostly **stateless per request**, with only minimal context passed to the model, rather than full notebook-style persistent runtime state.

### Python module

The Python module of your product should do these things:

- Accept CSV/Excel uploads and convert them into a dataframe.
- Extract a compact dataset profile such as column names, dtypes, and small sample rows.
- Generate Python code from the natural-language query using the dataset profile as context.
- Execute that code safely in an isolated runtime.
- Return outputs as text, table data, errors, or Plotly JSON for visualization.

That means the Python side is best described as a **controlled execution service behind Flask**, not a fully stateful notebook kernel.

## Recommended stack

| Layer | Recommended tech | Why |
|---|---|---|
| Web backend | Flask | Simple API layer and easy to implement for a project |
| Data handling | pandas, numpy | Core dataframe and numeric processing |
| Excel support | openpyxl | Standard engine for `.xlsx` files |
| Visualization | Plotly | Easy JSON serialization and frontend rendering |
| Python runtime | Custom Python worker or subprocess runner | Simpler than IPython kernel for a project |
| Session store | Optional lightweight metadata store | Only for file reference, user/workspace ID, and recent query context |
| Task queue | Optional, not required for v1 | Useful only if jobs become long-running |
| Sandbox | subprocess runner | Safety, timeout control, and simple isolation |
| Frontend rendering | React + CodeMirror/Monaco + react-plotly.js | Good editor UX with inline chart rendering |

## Execution model

### Custom Python worker

Use a **custom Python worker or subprocess-based execution model**.

Instead of maintaining a full shared notebook namespace, your worker can:

- receive the dataset/file reference,
- load it as `df`,
- receive the current user query,
- receive compact schema/profile context,
- generate Python,
- execute it independently,
- return structured output.

This is easier to build and better suited to your small-model constraint.

### Why this is better for your project

- Simpler for v1.
- Easier to integrate with Flask.
- Easier to control imports, outputs, and runtime limits.
- Avoids context overflow for a 1–2B SLM.
- Good enough for a project/demo.

## Context strategy

### Use this strategy

- Keep the uploaded dataset stored and reloadable as `df`.
- Send only:
  - column names,
  - dtypes,
  - small sample rows,
  - the user’s current query,
  - optionally the last **one** query if needed.
- Regenerate Python from scratch for each request.
- Execute each request independently.

This is the most important correction to your original write-up. You do **not** need full session persistence for your project unless you want true notebook-style variable reuse across runs. With your small SLM, compact context is the better design.

## Output handling

Your executor should standardize Python outputs into structured JSON.

**Text**
```json
{"type":"text","content":"Top 5 categories by revenue are ..."}
```

**Table**
```json
{
  "type":"table",
  "columns":["month","revenue"],
  "rows":[["2026-01",1200],["2026-02",1400]]
}
```

**Chart**
```json
{
  "type":"chart",
  "library":"plotly",
  "figure":{"...":"plotly json"}
}
```

**Error**
```json
{
  "type":"error",
  "ename":"KeyError",
  "message":"Column 'sale' not found"
}
```

Plotly JSON is a strong fit here because it can be rendered directly in the frontend.


## SQL workflow


# SQL Module

For the SQL side, you are building a **schema-aware NL-to-SQL execution module** that connects to Postgres or MySQL, reads schema metadata either through a **direct database connection** or through **MCP**, generates SQL from natural language, executes it through a controlled read-only layer, and returns results as tables or chart-ready JSON. This fits your project better because direct connection is simpler for normal use, while MCP can be supported as an optional access mode when users prefer not to expose database access directly inside the interface. 

The SQL module is therefore not just “text-to-SQL.” It is a full **text-to-SQL-to-execution-to-rendering** pipeline.

## What the SQL module should do

- Connect to **Postgres** or **MySQL** through either:
  - a **direct read-only database connection**, or
  - an **MCP-backed database layer**. 
- Extract schema information such as:
  - table names,
  - column names,
  - data types,
  - primary keys,
  - foreign keys,
  - indexes,
  - constraints.
- Build a compact schema context for the SLM/LLM.
- Generate SQL from the user’s natural-language request.
- Execute the generated SQL through a **read-only** query path.
- Return results in JSON, then render them as tables or visualizations in the frontend.

## Architecture

A good SQL flow for your project is:

1. User connects a Postgres or MySQL database.
2. Backend either:
   - connects directly to the database, or
   - talks to an MCP server.
3. Schema metadata is retrieved.
4. Backend compresses the schema into model-friendly context.
5. User asks a natural-language question.
6. The model generates SQL.
7. Backend validates the SQL.
8. SQL is executed through the direct DB layer or MCP layer.
9. Query results are returned as JSON rows.
10. Frontend renders the output as a data table or chart.

This means your backend is the **orchestration and safety layer**, while database access can happen through either integration mode depending on the user’s preference.

## Recommended stack

| Layer | Recommended tech | Purpose |
|---|---|---|
| Backend API | Flask | Main API and orchestration layer |
| Database access | Direct Postgres/MySQL connector + optional MCP support | Flexible schema introspection and controlled SQL execution |
| SQL generation | **MiniMax 2.5** | Primary model for NL-to-SQL and general instruction following   |
| Optional fallback model | `qwen3-coder:480b` | Use only if you need stronger code-first SQL generation   |
| Query validation | Python validation layer | Restrict dangerous SQL and enforce read-only behavior |
| Result transport | JSON | Convert query results into tabular/chart-ready format |
| Frontend | React + CodeMirror/Monaco + table/chart renderer | SQL editor and inline result display |
| Charts | Plotly or frontend chart lib | Optional visualization of SQL results |

## Model choice

For this project, the better default model is **MiniMax 2.5**. Your product is not purely a coding assistant; it needs to understand natural language, generate SQL, handle user-facing analytical prompts, and work smoothly across SQL and Python workflows. That makes MiniMax 2.5 the better primary model.

`qwen3-coder:480b` is still useful, but it is better treated as a **secondary or fallback model** for cases where you want more code-specialized SQL generation. Qwen3-Coder is more code-focused, while MiniMax 2.5 is the stronger fit for a mixed product workflow

## Database access model

The most important design decision is **read-only access**. Your system must never connect with full write privileges. PostgreSQL supports predefined roles such as `pg_read_all_data`, and MySQL commonly uses a dedicated account with `SELECT` privileges and optional `SHOW VIEW` privileges if view inspection is needed. 
For your project, the right options are:

- **Postgres**
  - dedicated read-only user,
  - role-based access using `pg_read_all_data`,
  - or access limited to reporting views only. 

- **MySQL**
  - dedicated read-only user with `SELECT`,
  - optional `SHOW VIEW` if schema/view inspection is needed,
  - or access only to curated views. 

This gives you enough real access to show results while keeping the system safe.

## Best practice for safety

Even for a project, add these controls:

- Allow only `SELECT` queries.
- Reject `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE`.
- Add a default row limit such as `LIMIT 100` when missing.
- Add query timeout.
- Log generated SQL before execution.
- Prefer read-only views where possible.

This matters because even a good model can generate inefficient or unsafe SQL.

## Schema context strategy

Since you may use compact models in some parts of the system, do **not** send the entire database schema when it is large. Instead, build a compact schema context:

- database type: Postgres/MySQL,
- relevant schema name,
- selected table names,
- selected column names and types,
- key relationships,
- optionally 2–3 representative sample rows.

Instead of dumping raw metadata JSON, convert it into a concise prompt format such as:

- `customers(id, name, country, created_at)`
- `orders(id, customer_id, amount, order_date)`
- `orders.customer_id -> customers.id`

This is much easier for the model to consume.

## Query generation strategy

For SQL generation, your prompt should include:

- DB type: PostgreSQL or MySQL
- allowed tables
- allowed columns
- relationships
- user question
- strict instruction to generate only read-only SQL
- output only SQL, with no explanation

A good target output is:

```sql
SELECT customer_id, SUM(amount) AS total_amount
FROM orders
GROUP BY customer_id
ORDER BY total_amount DESC
LIMIT 10;
```

## Query execution

After SQL generation, do not execute blindly. Add a validation step:

- parse or regex-check the query,
- verify it begins with `SELECT` or `WITH`,
- block chained statements,
- block forbidden keywords,
- optionally auto-inject `LIMIT`.

Then execute through either the **direct DB connection** or the **MCP tool layer**, depending on the active connection mode. 

## Output handling

Standardize SQL results into JSON like this:

**Table**
```json
{
  "type":"table",
  "columns":["customer_id","total_amount"],
  "rows":[[1,12000],[2,9800]]
}
```

**Chart-ready**
```json
{
  "type":"chart_data",
  "columns":["month","revenue"],
  "rows":[["2026-01",1200],["2026-02",1600]]
}
```

**Error**
```json
{
  "type":"error",
  "message":"Column 'revenu' does not exist"
}
```

This keeps the frontend simple because the renderer only needs to know whether it is showing a table, chart, or error.

