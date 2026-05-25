# QueryStudio

Natural-language analytics notebook. Ask questions in plain English — get charts, tables, and insights from your data.


## Features

- **Python Mode** — Upload CSV/Excel datasets, then ask questions in plain English. Generates and runs Python code to produce tables, charts, and summaries.
- **SQL Mode** — Connect to MySQL or Postgres databases, browse schema, then ask natural-language questions. Generates validated SQL, executes read-only, and returns results.

## Quick Start

### Backend

```bash
cd backend
conda run -n querystudio python run.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Usage

### Python Mode
1. Upload a CSV or Excel file via the sidebar
2. Type a question in the editor (e.g., "show average sales by month")
3. Click Run — generates Python code, executes it, and renders the result

### SQL Mode
1. Switch to the SQL tab in the sidebar
2. Click "+ Add Connection" and fill in your database details (MySQL/Postgres)
3. Once connected, browse tables and columns in the schema browser
4. Type a natural-language question (e.g., "how many appointments per doctor?")
5. Click Run — generates SQL, validates it, executes read-only, and shows results with a "Show generated SQL" toggle
