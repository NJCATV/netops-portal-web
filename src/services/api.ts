import type { ApiResult, User } from "../types";

const API_BASE = "/wx/api/netops2026";
const TOKEN_KEY = "netops2026_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  return requestApi<T>(API_BASE + path, options);
}

export async function adminApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  return requestApi<T>(`/wx/api/admin${path}`, options);
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
