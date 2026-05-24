export interface DatasetProfile {
  columns: string[];
  dtypes: Record<string, string>;
  shape: [number, number];
  sample_rows: (string | number)[][];
  numeric_stats: Record<string, { min: number; max: number; mean: number }>;
}

export interface Dataset {
  dataset_id: string;
  filename: string;
  profile?: DatasetProfile;
}

export interface QueryResult {
  type: "text" | "table" | "chart" | "error";
  content?: string;
  columns?: string[];
  rows?: (string | number)[][];
  library?: string;
  figure?: unknown;
  figure_json?: string;
  ename?: string;
  message?: string;
  _generated_code?: string;
}

export interface QueryRequest {
  dataset_id: string;
  query: string;
}
