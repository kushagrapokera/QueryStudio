import re
import logging

logger = logging.getLogger(__name__)


def detect_table(text: str) -> dict | None:
    """Detect and parse a table from df.to_string()-style text output.

    Returns {type: "table", columns, rows} or None.
    """
    lines = text.strip().split("\n")
    if len(lines) < 2:
        return None

    # df.to_string() output: header row then aligned data rows
    # Split by 2+ spaces to detect columns
    header_parts = re.split(r"\s{2,}", lines[0].strip())
    if len(header_parts) < 2:
        return None

    rows = []
    for line in lines[1:]:
        parts = re.split(r"\s{2,}", line.strip())
        if len(parts) == len(header_parts):
            rows.append(parts)

    if rows:
        return {"type": "table", "columns": header_parts, "rows": rows}
    return None


def parse_text_output(text: str) -> dict:
    """Parse captured stdout text into a structured result.

    Tries table detection first, falls back to plain text.
    """
    if not text or not text.strip():
        return {"type": "text", "content": ""}

    table = detect_table(text)
    if table:
        return table

    return {"type": "text", "content": text.strip()}
