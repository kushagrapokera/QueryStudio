import os
from io import StringIO
import pandas as pd


def _expand_single_column_csv(df: pd.DataFrame) -> pd.DataFrame:
    """Split CSVs where each full row was wrapped into a single quoted field."""
    if df.shape[1] != 1:
        return df

    only_col = df.columns[0]
    values = df[only_col].dropna().astype(str)
    if not values.empty and not values.str.contains(",").all():
        return df

    raw_lines = [str(only_col).strip()] + [value.strip() for value in values.tolist()]
    expanded = pd.read_csv(StringIO("\n".join(raw_lines)), sep=",")

    if expanded.shape[1] <= 1:
        return df

    expanded.columns = [str(col).strip() for col in expanded.columns]
    for col in expanded.select_dtypes(include=["object"]).columns:
        expanded[col] = expanded[col].map(lambda value: value.strip() if isinstance(value, str) else value)

    return expanded


def load_dataset(filepath: str) -> pd.DataFrame:
    """Load a CSV or Excel file into a pandas DataFrame."""
    ext = os.path.splitext(filepath)[1].lower()
    if ext == ".csv":
        # Try common encodings. PowerShell on Windows often saves UTF-16 LE.
        encodings = ["utf-8", "utf-16-le", "utf-16", "latin-1", "cp1252"]
        for enc in encodings:
            try:
                df = pd.read_csv(filepath, encoding=enc)
                return _expand_single_column_csv(df)
            except (UnicodeDecodeError, UnicodeError):
                continue
        # Last resort: let pandas auto-detect
        return _expand_single_column_csv(pd.read_csv(filepath))
    elif ext in (".xlsx", ".xls"):
        return pd.read_excel(filepath)
    raise ValueError(f"Unsupported file type: {ext}")


def _numeric_stats(df: pd.DataFrame) -> dict:
    """Compute min, max, mean for numeric columns."""
    stats = {}
    for col in df.select_dtypes(include=["number"]).columns:
        series = df[col].dropna()
        if not series.empty:
            stats[col] = {
                "min": round(float(series.min()), 4),
                "max": round(float(series.max()), 4),
                "mean": round(float(series.mean()), 4),
            }
    return stats


def profile_dataset(filepath: str) -> dict:
    """Profile a dataset file and return a compact summary."""
    df = load_dataset(filepath)

    columns = list(df.columns)
    dtypes = {col: str(df[col].dtype) for col in columns}
    shape = list(df.shape)  # [rows, cols]
    sample_rows = df.head(5).fillna("").to_dict(orient="split")["data"]
    # Convert all values to strings for safe JSON serialization
    sample_rows = [
        [str(v) if not isinstance(v, (int, float)) else v for v in row]
        for row in sample_rows
    ]
    stats = _numeric_stats(df)

    return {
        "columns": columns,
        "dtypes": dtypes,
        "shape": shape,
        "sample_rows": sample_rows,
        "numeric_stats": stats,
    }
