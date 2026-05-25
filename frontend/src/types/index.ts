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

// Connection management (Phase 2)

export type ConnectionType = "direct" | "mcp";
export type DbType = "postgres" | "mysql";

export interface DirectConnectionParams {
  db_type: DbType;
  host: string;
  port: number;
  database: string;
  user: string;
  has_password?: boolean;
}

export interface McpConnectionParams {
  url: string;
  has_api_key?: boolean;
}

export interface Connection {
  id: string;
  type: ConnectionType;
  label: string;
  params: DirectConnectionParams | McpConnectionParams;
  read_only_reminder?: boolean;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
}

export interface CreateConnectionRequest {
  type: ConnectionType;
  label?: string;
  params:
    | (DirectConnectionParams & { password: string })
    | (McpConnectionParams & { api_key?: string });
}

export interface UpdateModeRequest {
  mode: ConnectionType;
}

// Schema types (Step 2.6)

export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
}

export interface ForeignKey {
  column: string;
  references_table: string;
  references_column: string;
}

export interface SchemaTable {
  name: string;
  type: string;
  estimated_rows: number;
  columns: SchemaColumn[];
  primary_key: string[];
  foreign_keys: ForeignKey[];
  indexes: unknown[];
  sample_rows: (string | number | null)[][];
}

export interface SchemaResponse {
  db_type: string;
  database: string;
  tables: SchemaTable[];
  _compact?: string;
}

// SQL Query (Step 2.5)

export interface SqlQueryRequest {
  query: string;
  timeout?: number;
}

export interface ChartReadyInfo {
  has_chart_data: boolean;
  numeric_columns: string[];
  date_columns: string[];
}

export interface SqlQueryResult {
  type: "table" | "error";
  columns?: string[];
  rows?: (string | number | null)[][];
  row_count?: number;
  _generated_sql?: string;
  _chart_ready?: ChartReadyInfo;
  error?: string;
  ename?: string;
  message?: string;
}
