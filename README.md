# QueryStudio

Natural-language analytics notebook. Ask questions in plain English — get charts, tables, and insights from your data.

**Stack**: Flask + React + Monaco Editor + Plotly + Ollama Cloud (MiniMax 2.5 / Qwen3-Coder)

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

Open `http://localhost:5173`, upload a CSV or Excel file, and ask questions in plain English.
