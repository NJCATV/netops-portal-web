import type { ApiResult, User } from "../types";

const API_BASE = "/api/netops2026";
const TOKEN_KEY = "netops2026_token";
const SNAPSHOT_PREFIX = "netops2026_snapshot";
const inflight = new Map<string, Promise<unknown>>();

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function tokenScope() {
  let hash = 2166136261;
  for (const char of getToken()) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function snapshotKey(name: string) {
  return `${SNAPSHOT_PREFIX}:${tokenScope()}:${name}`;
}

export function readApiSnapshot<T>(name: string, storage: Storage = localStorage): T | null {
  try {
    const raw = storage.getItem(snapshotKey(name));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data?: T };
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

export function writeApiSnapshot<T>(name: string, data: T, storage: Storage = localStorage) {
  try {
    storage.setItem(snapshotKey(name), JSON.stringify({ saved_at: Date.now(), data }));
  } catch {
    // Storage quota or privacy mode must never block the live API response.
  }
}

export function snapshotApi<T>(path: string, name: string, storage: Storage = localStorage): Promise<T> {
  const key = `${tokenScope()}:${path}`;
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const pending = api<T>(path)
    .then(data => {
      writeApiSnapshot(name, data, storage);
      return data;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, pending);
  return pending;
}

export function prewarmOperationsPages() {
  if (!getToken()) return;
  void snapshotApi("/dashboard?hours=24", "dashboard:24").catch(() => undefined);
  void snapshotApi("/radius/analytics?hours=24&section=auth", "radius:analytics:v2:auth:24").catch(() => undefined);
  void snapshotApi("/radius/analytics?hours=24&section=session", "radius:analytics:v2:session:24").catch(() => undefined);
  void snapshotApi("/radius/accounting?hours=24", "radius:accounting:24").catch(() => undefined);
  void snapshotApi(
    "/radius/records?event_type=auth&page=1&page_size=50&sort_by=event_time&sort_order=desc&hours=24",
    "radius:records:auth:default",
    sessionStorage,
  ).catch(() => undefined);
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  return requestApi<T>(API_BASE + path, options);
}

export async function adminApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Keep the current platform under its own public namespace. The preserved
  // /2025 application still owns legacy /api/admin/* routes on port 7003.
  return requestApi<T>(`/api/netops2026/admin${path}`, options);
}

async function requestApi<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(url, { ...options, headers });
  const body = (await res.json().catch(() => ({}))) as ApiResult<T>;
  if (!res.ok || body.code !== 0) {
    throw new Error(body.message || `请求失败 ${res.status}`);
  }
  return body.data;
}

export async function login(account: string, password: string) {
  const data = await api<{ access_token?: string; token?: string; next_action?: string; user?: User }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ account, password })
  });
  const token = data.access_token || data.token || "";
  if (!token) throw new Error("登录返回缺少 token");
  setToken(token);
  return data;
}

export function me() {
  return api<{ user: User; next_action?: string } | User>("/auth/me");
}

export function changePassword(oldPassword: string, newPassword: string) {
  return api<{ user: User; next_action?: string }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
  });
}

export function downloadUrl(path: string) {
  return API_BASE + path;
}
