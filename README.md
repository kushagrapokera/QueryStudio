# QueryStudio

QueryStudio is a natural-language analytics platform that lets you explore data without writing SQL or Python manually. Simply ask questions in plain English, and QueryStudio generates the required code, executes it, and presents the results as tables, charts, and insights.


# Features

## Python Analytics Mode
- Upload CSV or Excel datasets.
- Ask questions in natural language.
- Automatically generates and executes Python code.
- Displays:
  - Interactive tables
  - Charts and visualizations
  - Statistical summaries
  - Data insights

### Example Questions
- Show average sales by month.
- Which product generated the highest revenue?
- Plot customer growth over time.
- Find missing values in the dataset.


## SQL Analytics Mode
- Connect to MySQL or PostgreSQL databases.
- Browse database schema (tables and columns).
- Ask questions in plain English.
- Automatically generates SQL queries.
- Validates queries before execution.
- Executes queries in **read-only mode** for safety.
- View or hide the generated SQL using the built-in toggle.

### Example Questions
- How many appointments does each doctor have?
- Show the top 10 customers by revenue.
- Which department has the highest average salary?
- List monthly sales for the current year.


## Supported Databases
- MySQL
- PostgreSQL

## Supported File Formats
- CSV
- Excel (.xlsx)

---


# Installation

## Backend

```bash
cd backend
conda run -n querystudio python run.py
```

The backend server will start on its configured port.

---

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Open your browser and navigate to:

```
http://localhost:5173
```


# Usage

## Python Mode

1. Upload a CSV or Excel dataset from the sidebar.
2. Enter a question in plain English.
3. Click **Run**.
4. QueryStudio will:
   - Generate Python code
   - Execute the code
   - Display tables, charts, and insights


## SQL Mode

1. Open the **SQL** tab.
2. Click **+ Add Connection**.
3. Enter your MySQL or PostgreSQL credentials.
4. Browse the database schema.
5. Ask a question in natural language.
6. Click **Run**.
7. View the generated SQL (optional) and the query results.


# Safety

- SQL execution is **read-only**.
- Generated queries are validated before execution.
- User databases are never modified.


