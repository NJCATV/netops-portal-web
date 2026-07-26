import { api } from "./api";

export type AiopsWindow = {
  hours: number;
  syslog_parsed: number;
  trap_raw: number;
  alarm_events: number;
};

export type AiopsOverview = {
  ok: boolean;
  hours: number;
  windows: AiopsWindow[];
  latest_syslog?: Record<string, unknown> | null;
  latest_alarm_event?: Record<string, unknown> | null;
};

export type AiopsEvent = {
  event_id?: string;
  event_type?: string;
  event_family?: string;
  device_name?: string;
  device_ip?: string;
  object_key?: string;
  event_status?: string;
  event_count?: number;
  first_seen?: string;
  last_seen?: string;
  severity_max?: string;
  event_summary?: string;
};

export type AiChatMessage = {
  id?: number;
  role: "user" | "assistant";
  content: string;
  evidence?: Record<string, unknown> | null;
  model?: string;
  provider?: string;
  model_error?: string | null;
  created_at?: string;
};

export type AiChatSession = {
  id: number;
  title: string;
  message_count: number;
  last_message_at?: string;
};

export function aiopsApi<T>(path: string, options: RequestInit = {}) {
  return api<T>(`/aiops${path}`, options);
}

export function loadAiopsOverview(hours = 24) {
  return aiopsApi<AiopsOverview>(`/runtime/overview?hours=${hours}`);
}

export function loadAiopsFreshness() {
  return aiopsApi<Record<string, unknown>>("/runtime/freshness");
}

export function loadAiopsEvents(hours = 24, limit = 20) {
  return aiopsApi<{ ok: boolean; items: AiopsEvent[]; total: number }>(`/alarm-events?hours=${hours}&limit=${limit}`);
}
