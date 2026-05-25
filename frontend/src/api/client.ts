import axios from "axios";
import type { Dataset, QueryRequest, QueryResult } from "../types";

const api = axios.create({
  baseURL: "/api",
});

export async function uploadFile(file: File): Promise<Dataset> {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post("/upload", form);
  return res.data;
}

export async function listDatasets(): Promise<Dataset[]> {
  const res = await api.get("/datasets");
  return res.data;
}

export async function runPythonQuery(req: QueryRequest): Promise<QueryResult> {
  const res = await api.post("/query", req);
  return res.data;
}

export async function healthCheck(): Promise<{ status: string }> {
  const res = await api.get("/health");
  return res.data;
}

// Connection management (Phase 2)

import type {
  Connection,
  ConnectionTestResult,
  CreateConnectionRequest,
  UpdateModeRequest,
  SqlQueryRequest,
  SqlQueryResult,
  SchemaResponse,
} from "../types";

export async function createConnection(
  req: CreateConnectionRequest
): Promise<Connection> {
  const res = await api.post("/connections", req);
  return res.data;
}

export async function listConnections(): Promise<Connection[]> {
  const res = await api.get("/connections");
  return res.data;
}

export async function getConnection(id: string): Promise<Connection> {
  const res = await api.get(`/connections/${id}`);
  return res.data;
}

export async function deleteConnection(id: string): Promise<void> {
  await api.delete(`/connections/${id}`);
}

export async function testConnection(
  req: CreateConnectionRequest
): Promise<ConnectionTestResult> {
  const res = await api.post("/connections/test", req);
  return res.data;
}

export async function updateConnectionMode(
  id: string,
  req: UpdateModeRequest
): Promise<Connection> {
  const res = await api.put(`/connections/${id}/mode`, req);
  return res.data;
}

export async function runSqlQuery(
  connId: string,
  req: SqlQueryRequest
): Promise<SqlQueryResult> {
  const res = await api.post(`/connections/${connId}/query`, req);
  return res.data;
}

export async function getSchema(connId: string): Promise<SchemaResponse> {
  const res = await api.get(`/connections/${connId}/schema`);
  return res.data;
}
