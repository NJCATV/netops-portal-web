import { api, getToken, snapshotApi } from "./api";

export type RadiusRow = Record<string, string | number | null | undefined>;

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  return search.toString();
}

export function radiusApi<T>(path: string) {
  return api<T>(`/radius${path}`);
}

export function loadRadiusOverview(hours = 24) {
  return radiusApi<{ overview: RadiusRow; trend: RadiusRow[]; hours: number }>(`/overview?hours=${hours}`);
}

export function loadRadiusRecords(params: Record<string, string | number | undefined>) {
  return radiusApi<{ items: RadiusRow[]; total: number; page: number; page_size: number; observed?: RadiusRow; window?: RadiusRow; sort_by?: string; sort_order?: string }>(`/records?${query(params)}`);
}

export function loadRadiusAnalytics(hours = 24, section: "auth" | "session" = "auth") {
  return snapshotApi<{
    section?: string; summary?: RadiusRow;
    reasons: RadiusRow[]; nas: RadiusRow[]; reconnects: RadiusRow[];
    traffic_patterns: RadiusRow[]; online_sessions: RadiusRow[];
    traffic_rules?: RadiusRow;
    terminate_causes: RadiusRow[]; nas_restarts?: RadiusRow[];
    control_events: RadiusRow[]; protocol_quality: RadiusRow; hours: number;
    terminal_sharing: RadiusRow[]; ip_conflicts: RadiusRow[];
  }>(`/radius/analytics?hours=${hours}&section=${section}`, `radius:analytics:v2:${section}:${hours}`);
}

export function loadRadiusRejectRisk(hours = 24, limit = 500) {
  return radiusApi<{ items: RadiusRow[] }>(`/risk/reject?hours=${hours}&limit=${limit}`);
}

export function loadRadiusMultiMac(hours = 24, minMacs = 2) {
  return radiusApi<{ items: RadiusRow[]; hours: number; min_macs: number }>(`/risk/multi-mac?hours=${hours}&min_macs=${minMacs}`);
}

export function loadRadiusAccounting(hours = 24) {
  return snapshotApi<{ summary: RadiusRow; traffic: RadiusRow[]; quality: RadiusRow; coverage?: RadiusRow; anomalies: RadiusRow[]; anomaly_rules: RadiusRow; hours: number }>(
    `/radius/accounting?hours=${hours}`,
    `radius:accounting:${hours}`,
  );
}

export type RadiusProfile = {
  matched: boolean;
  query: RadiusRow;
  identity: { accounts: string[]; macs: string[]; last_seen: string };
  summary: RadiusRow;
  flow: RadiusRow[];
  sessions: RadiusRow[];
  records: RadiusRow[];
  associations: RadiusRow[];
  terminate_causes: RadiusRow[];
  issues: Array<{ level: string; code: string; title: string; detail: string }>;
  health: { score: number; label: string };
  onu_consistency: null | {
    terminal_mac: string;
    accounts: string[];
    verified_accounts: string[];
    expected_onus: RadiusRow[];
    actual_mappings: RadiusRow[];
    mapping_source: { available: boolean; kind: string; label: string; freshness: string };
    status: string;
    status_label: string;
    is_conclusive: boolean;
  };
};

export function loadRadiusProfile(keyword: string) {
  return radiusApi<RadiusProfile>(`/profile?keyword=${encodeURIComponent(keyword)}`);
}

export function loadRadiusIngestStatus() {
  return radiusApi<{ collector: RadiusRow; data: RadiusRow; quality: RadiusRow }>("/ingest/status");
}

export async function downloadRadiusCsv(params: Record<string, string | number | undefined>) {
  const response = await fetch(`/api/netops2026/radius/export.csv?${query(params)}`, {
    headers: { Authorization: `Bearer ${getToken()}` }
  });
  if (!response.ok) throw new Error(`导出失败 ${response.status}`);
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] || "radius-export.csv";
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
