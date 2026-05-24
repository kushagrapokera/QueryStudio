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
