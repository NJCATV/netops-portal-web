<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import EmptyState from "../components/EmptyState.vue";
import PowerLineChart from "../components/PowerLineChart.vue";
import QualityTrendChart from "../components/QualityTrendChart.vue";
import StatusTag from "../components/StatusTag.vue";
import { api, downloadUrl, getToken } from "../services/api";
import type { HistoryPoint } from "../types";

type OltDevice = {
  olt_device_id: number;
  name?: string;
  region?: string;
  room_group?: string;
  room?: string;
  device_model?: string;
  primary_ip?: string;
  backup_ip?: string;
};

type QualityRow = {
  region?: string;
  room_group?: string;
  room?: string;
  olt_device_id?: number;
  olt_name?: string;
  device_model?: string;
  primary_ip?: string;
  backup_ip?: string;
  pon_port?: string;
  if_index?: string;
  onu_mac?: string;
  display_mac?: string;
  rx_power?: number | string;
  tx_power?: number | string;
  quality_code?: string;
  quality_label?: string;
  query_time?: string;
  gdf_account?: string;
  customer_name?: string;
  business_type?: string;
  optical_node_code?: string;
  optical_node_location?: string;
  bad_count?: number | string;
  total_onu?: number | string;
  rx_low?: number | string;
  rx_high?: number | string;
  worst_rx?: number | string;
  latest_time?: string;
};

type TrendPoint = {
  stat_date: string;
  bad_count: number | string;
  rx_low?: number | string;
  rx_high?: number | string;
  total_count?: number | string;
};

type QualityResponse = {
  items: QualityRow[];
  total: number;
  page: number;
  size: number;
  stats?: Record<string, string | number>;
  trend?: TrendPoint[];
  top_olts?: QualityRow[];
  port_groups?: QualityRow[];
  rule?: OnuRxRule;
};

type OnuRxRule = {
  onu_rx_low_dbm: number;
  onu_rx_high_dbm: number;
  onu_rx_invalid_min_dbm: number;
  onu_rx_invalid_max_dbm: number;
  onu_valid_rx_min_dbm: number;
  onu_valid_rx_max_dbm: number;
  onu_rule_version: string;
};

const today = new Date().toISOString().slice(0, 10);
const date = ref(today);
const qualityCode = ref("");
const includeUnknownPorts = ref(false);
const trendDays = ref(30);
const page = ref(1);
const size = ref(20);
const total = ref(0);
const rows = ref<QualityRow[]>([]);
const stats = ref<Record<string, string | number>>({});
const trend = ref<TrendPoint[]>([]);
const topOlts = ref<QualityRow[]>([]);
const portGroups = ref<QualityRow[]>([]);
const rule = ref<OnuRxRule>({
  onu_rx_low_dbm: -25,
  onu_rx_high_dbm: -8,
  onu_rx_invalid_min_dbm: -40,
  onu_rx_invalid_max_dbm: 0,
  onu_valid_rx_min_dbm: -40,
  onu_valid_rx_max_dbm: 5,
  onu_rule_version: "onu_rx_web_-25_-8"
});
const devices = ref<OltDevice[]>([]);
const selectedIds = ref<number[]>([]);
const selectionMode = ref<"all" | "custom">("all");
const expandedGroups = ref<Set<string>>(new Set());
const expandedRooms = ref<Set<string>>(new Set());
const deviceKeyword = ref("");
const onlySelected = ref(false);
const filterCollapsed = ref(false);
const loading = ref(false);
const summaryLoading = ref(false);
const tableLoading = ref(false);
const portLoading = ref(false);
const exporting = ref(false);
const exportStage = ref<"preparing" | "downloading">("preparing");
const exportProgress = ref<number | null>(null);
const treeLoading = ref(false);
const error = ref("");
const notice = ref("");
const detailRow = ref<QualityRow | null>(null);
const detailHistory = ref<HistoryPoint[]>([]);
const detailLoading = ref(false);
const qualityPayloadCache = new Map<string, QualityResponse>();

const pages = computed(() => Math.max(1, Math.ceil(total.value / size.value)));
const visiblePages = computed(() => {
  const count = Math.min(5, pages.value);
  const start = Math.min(Math.max(1, page.value - 2), Math.max(1, pages.value - count + 1));
  return Array.from({ length: count }, (_, index) => start + index);
});
const selectedCount = computed(() => selectionMode.value === "all" ? devices.value.length : selectedIds.value.length);
const allSelected = computed(() => selectionMode.value === "all" || selectedIds.value.length === devices.value.length);
const selectedSet = computed(() => new Set(selectionMode.value === "all" ? devices.value.map((d) => d.olt_device_id) : selectedIds.value));
const totalDelta = computed(() => n(stats.value.total_delta));
const totalDeltaLabel = computed(() => {
  if (!totalDelta.value) return "较上一日持平";
  return `较上一日 ${totalDelta.value > 0 ? "+" : ""}${totalDelta.value}`;
});

const filteredDevices = computed(() => {
  const keyword = deviceKeyword.value.trim().toLowerCase();
  return devices.value.filter((device) => {
    if (onlySelected.value && !selectedSet.value.has(device.olt_device_id)) return false;
    if (!keyword) return true;
    return [regionLabel(device.region), device.room, device.name, device.primary_ip, device.device_model]
      .some((value) => String(value || "").toLowerCase().includes(keyword));
  });
});

const tree = computed(() => {
  const groups = new Map<string, Map<string, OltDevice[]>>();
  for (const device of filteredDevices.value) {
    const group = regionLabel(device.region);
    const room = device.room || "未填写机房";
    if (!groups.has(group)) groups.set(group, new Map());
    const rooms = groups.get(group)!;
    if (!rooms.has(room)) rooms.set(room, []);
    rooms.get(room)!.push(device);
  }
  const sortedGroupEntries = Array.from(groups).sort(([a], [b]) => compareRoomGroup(a, b));
  return sortedGroupEntries.map(([group, rooms]) => ({
    group,
    count: Array.from(rooms.values()).reduce((sum, list) => sum + list.length, 0),
    rooms: Array.from(rooms, ([room, list]) => ({
      room,
      devices: [...list].sort((a, b) => compareText(a.name || "", b.name || ""))
    })).sort((a, b) => compareText(a.room, b.room))
  }));
});

const portSummary = computed(() => {
  const groups = portGroups.value;
  const oltCount = new Set(groups.map((r) => r.olt_device_id).filter(Boolean)).size;
  const ponCount = groups.length;
  const bad = groups.reduce((sum, r) => sum + n(r.bad_count), 0);
  const totalOnu = groups.reduce((sum, r) => sum + n(r.total_onu), 0);
  const rxLow = groups.reduce((sum, r) => sum + n(r.rx_low), 0);
  const rxHigh = groups.reduce((sum, r) => sum + n(r.rx_high), 0);
  const worst = groups.map((r) => Number(r.worst_rx)).filter(Number.isFinite).sort((a, b) => a - b)[0];
  const latest = groups.map((r) => r.latest_time || "").sort().at(-1) || "-";
  return { oltCount, ponCount, bad, totalOnu, rxLow, rxHigh, worst: Number.isFinite(worst) ? worst : "-", latest };
});

function compactTimestamp(value: unknown) {
  const text = String(value || "").trim().replace("T", " ");
  if (!text || text === "-") return "-";
  const match = text.match(/^\d{4}[-\/]([01]\d)[-\/]([0-3]\d)\s+([0-2]\d):([0-5]\d)/);
  return match ? `${match[1]}-${match[2]} ${match[3]}:${match[4]}` : text;
}

const kpis = computed(() => [
  { label: "质差 ONU 总量", value: total.value, hint: totalDeltaLabel.value, tone: "danger", icon: "!" },
  { label: "低光值数量", value: n(stats.value.rx_low), hint: `RX < ${rule.value.onu_rx_low_dbm} dBm`, tone: "blue", icon: "~" },
  { label: "高光值数量", value: n(stats.value.rx_high), hint: `RX > ${rule.value.onu_rx_high_dbm} dBm`, tone: "orange", icon: "*" },
  { label: "涉及 OLT", value: n(stats.value.involved_olt), hint: "当前筛选范围", tone: "blue", icon: "OLT" },
  { label: "最近更新时间", value: compactTimestamp(stats.value.latest_time), hint: "每 5 分钟刷新", tone: "slate", icon: "◷" }
]);

function n(value: unknown) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function regionLabel(value?: string) { return ({ chengbei:"城北",chengdong:"城东",chengnan:"城南",chengxi:"城西",gaochun:"高淳",jiangning:"江宁",lishui:"溧水",liuhe:"六合",pukou:"浦口",qixia:"栖霞",yuhua:"雨花" } as Record<string,string>)[value||""] || value || "未分区域"; }

function compareText(a: string, b: string) {
  return String(a || "").localeCompare(String(b || ""), "zh-CN-u-co-pinyin", { numeric: true, sensitivity: "base" });
}

function compareRoomGroup(a: string, b: string) {
  const priority: Record<string, number> = {
    "城东": 0,
    "城北": 1,
    "城南": 2,
    "城西": 3
  };
  const pa = priority[a] ?? 100;
  const pb = priority[b] ?? 100;
  if (pa !== pb) return pa - pb;
  return compareText(a, b);
}

function queryString(forExport = false) {
  const params = new URLSearchParams({
    page: String(page.value),
    size: String(forExport ? 50000 : size.value),
    date: date.value,
    quality_code: qualityCode.value,
    include_unknown_ports: includeUnknownPorts.value ? "1" : "0",
    trend_days: String(trendDays.value)
  });
  if (selectionMode.value === "custom") {
    params.set("olt_device_ids", selectedIds.value.length ? selectedIds.value.join(",") : "0");
  } else if (selectedIds.value.length && selectedIds.value.length !== devices.value.length) {
    params.set("olt_device_ids", selectedIds.value.join(","));
  }
  return params.toString();
}

async function loadDevices() {
  treeLoading.value = true;
  try {
    const data = await api<{ items: OltDevice[] }>("/olt/device-tree");
    devices.value = data.items || [];
  } finally {
    treeLoading.value = false;
  }
}

function applyQualityPayload(data: QualityResponse, includeSummary: boolean, scope: "full" | "table" | "port" | "summary") {
  if (scope === "summary") {
    stats.value = { ...stats.value, ...(data.stats || {}) };
    trend.value = data.trend || [];
    topOlts.value = data.top_olts || [];
    portGroups.value = data.port_groups || [];
    if (data.rule) rule.value = { ...rule.value, ...data.rule };
    return;
  }
  if (scope === "port") {
    portGroups.value = data.port_groups || [];
    if (data.rule) rule.value = { ...rule.value, ...data.rule };
    return;
  }
  rows.value = data.items || [];
  total.value = data.total || 0;
  stats.value = { ...stats.value, ...(data.stats || {}) };
  if (includeSummary) {
    trend.value = data.trend || [];
    topOlts.value = data.top_olts || [];
    portGroups.value = data.port_groups || [];
  }
  if (data.rule) rule.value = { ...rule.value, ...data.rule };
}

async function load(includeSummary = true, noCache = false, scope: "full" | "table" | "port" = "full") {
  const requestKey = `${queryString()}&summary=${includeSummary ? "1" : "0"}`;
  const cached = !noCache && scope === "full" ? qualityPayloadCache.get(requestKey) : undefined;
  if (scope === "table") tableLoading.value = true;
  else if (scope === "port") portLoading.value = true;
  else loading.value = true;
  error.value = "";
  notice.value = "";
  if (cached) {
    applyQualityPayload(cached, includeSummary, scope);
    loading.value = false;
  }
  try {
    const data = await api<QualityResponse>(`/onu/quality-daily?${queryString()}&summary=${includeSummary ? 1 : 0}${noCache ? "&no_cache=1" : ""}`);
    applyQualityPayload(data, includeSummary, scope);
    if (scope === "full") qualityPayloadCache.set(requestKey, data);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "加载质差数据失败";
  } finally {
    if (scope === "table") tableLoading.value = false;
    else if (scope === "port") portLoading.value = false;
    else loading.value = false;
  }
}

async function loadSummary(noCache = false) {
  const requestKey = `${queryString()}&summary=1&summary_only=1`;
  const cached = !noCache ? qualityPayloadCache.get(requestKey) : undefined;
  summaryLoading.value = true;
  if (cached) applyQualityPayload(cached, true, "summary");
  try {
    const data = await api<QualityResponse>(`/onu/quality-daily?${queryString()}&summary=1&summary_only=1${noCache ? "&no_cache=1" : ""}`);
    applyQualityPayload(data, true, "summary");
    qualityPayloadCache.set(requestKey, data);
  } catch (err) {
    if (!rows.value.length) error.value = err instanceof Error ? err.message : "加载质差汇总失败";
  } finally {
    summaryLoading.value = false;
  }
}

async function loadProgressively(noCache = false) {
  await load(false, noCache, "full");
  void loadSummary(noCache);
}

function search() {
  page.value = 1;
  loadProgressively();
}

function reset() {
  date.value = today;
  qualityCode.value = "";
  includeUnknownPorts.value = false;
  selectedIds.value = [];
  selectionMode.value = "all";
  deviceKeyword.value = "";
  onlySelected.value = false;
  search();
}

function refresh() {
  loadProgressively(true);
}

function refreshPortGroups() {
  portLoading.value = true;
  loadSummary(true).finally(() => { portLoading.value = false; });
}

function changeTrendDays(days: number) {
  trendDays.value = days;
  page.value = 1;
  loadSummary();
}

function toggleGroup(group: string) {
  const next = new Set(expandedGroups.value);
  next.has(group) ? next.delete(group) : next.add(group);
  expandedGroups.value = next;
}

function toggleRoom(key: string) {
  const next = new Set(expandedRooms.value);
  next.has(key) ? next.delete(key) : next.add(key);
  expandedRooms.value = next;
}

function setAllDevices() {
  selectionMode.value = "all";
  selectedIds.value = [];
}

function cancelAllDevices() {
  selectionMode.value = "custom";
  selectedIds.value = [];
  onlySelected.value = false;
}

function toggleOnlySelected() {
  onlySelected.value = !onlySelected.value;
}

function setRoomDevices(list: OltDevice[]) {
  const set = new Set(selectionMode.value === "all" ? devices.value.map((d) => d.olt_device_id) : selectedIds.value);
  const allIn = list.every((d) => selectedSet.value.has(d.olt_device_id));
  for (const device of list) {
    allIn ? set.delete(device.olt_device_id) : set.add(device.olt_device_id);
  }
  if (set.size === devices.value.length) {
    setAllDevices();
  } else {
    selectionMode.value = "custom";
    selectedIds.value = Array.from(set);
  }
}

function groupDevices(group: { rooms: Array<{ devices: OltDevice[] }> }) {
  return group.rooms.flatMap((room) => room.devices);
}

function isGroupChecked(group: { rooms: Array<{ devices: OltDevice[] }> }) {
  const list = groupDevices(group);
  return list.length > 0 && list.every((device) => selectedSet.value.has(device.olt_device_id));
}

function setGroupDevices(group: { rooms: Array<{ devices: OltDevice[] }> }) {
  setRoomDevices(groupDevices(group));
}

function isRoomChecked(list: OltDevice[]) {
  return list.length > 0 && list.every((device) => selectedSet.value.has(device.olt_device_id));
}

function toggleDevice(id: number) {
  const set = new Set(selectionMode.value === "all" ? devices.value.map((d) => d.olt_device_id) : selectedIds.value);
  set.has(id) ? set.delete(id) : set.add(id);
  if (set.size === devices.value.length) {
    setAllDevices();
  } else {
    selectionMode.value = "custom";
    selectedIds.value = Array.from(set);
  }
}

function removeSelected(id: number) {
  if (selectionMode.value === "all") {
    selectedIds.value = devices.value.map((d) => d.olt_device_id).filter((deviceId) => deviceId !== id);
    selectionMode.value = "custom";
    return;
  }
  selectedIds.value = selectedIds.value.filter((deviceId) => deviceId !== id);
}

function isDeviceChecked(id?: number) {
  if (!id) return false;
  return selectedSet.value.has(id);
}

async function exportExcel() {
  exporting.value = true;
  exportStage.value = "preparing";
  exportProgress.value = null;
  notice.value = "";
  error.value = "";
  try {
    const token = getToken();
    const res = await fetch(downloadUrl(`/onu/quality-daily/export?${queryString(true)}`), {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || "导出失败");
    }
    exportStage.value = "downloading";
    const totalBytes = Number(res.headers.get("Content-Length") || 0);
    const reader = res.body?.getReader();
    let blob: Blob;
    if (!reader) {
      blob = await res.blob();
      exportProgress.value = 100;
    } else {
      const chunks: ArrayBuffer[] = [];
      let receivedBytes = 0;
      exportProgress.value = totalBytes > 0 ? 0 : null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        const chunk = new Uint8Array(value.byteLength);
        chunk.set(value);
        chunks.push(chunk.buffer);
        receivedBytes += value.byteLength;
        if (totalBytes > 0) {
          exportProgress.value = Math.min(99, Math.round(receivedBytes / totalBytes * 100));
        }
      }
      blob = new Blob(chunks, { type: res.headers.get("Content-Type") || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      exportProgress.value = 100;
    }
    const disposition = res.headers.get("Content-Disposition") || "";
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    const fallbackMatch = disposition.match(/filename=([^;]+)/i);
    const filename = utf8Match
      ? decodeURIComponent(utf8Match[1])
      : fallbackMatch ? fallbackMatch[1].replaceAll('"', "") : `onu_quality_${date.value}_${Date.now()}.xlsx`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    notice.value = "导出完成";
  } catch (err) {
    error.value = err instanceof Error ? err.message : "导出失败";
  } finally {
    exporting.value = false;
    window.setTimeout(() => { exportProgress.value = null; }, 800);
  }
}

async function openDetail(row: QualityRow) {
  detailRow.value = row;
  detailHistory.value = [];
  const mac = row.onu_mac || row.display_mac || "";
  if (!mac) return;
  detailLoading.value = true;
  try {
    const params = new URLSearchParams({
      onu_mac: mac,
      olt_device_id: String(row.olt_device_id || ""),
      hours: "168"
    });
    const data = await api<{ items: HistoryPoint[] }>(`/onu/history?${params.toString()}`);
    detailHistory.value = data.items || [];
  } catch (err) {
    error.value = err instanceof Error ? err.message : "加载单台历史失败";
  } finally {
    detailLoading.value = false;
  }
}

function closeDetail() {
  detailRow.value = null;
  detailHistory.value = [];
}

function gotoPage(nextPage: number, includeSummary = false) {
  page.value = Math.min(pages.value, Math.max(1, nextPage));
  load(includeSummary, false, includeSummary ? "full" : "table");
}

onMounted(async () => {
  await loadDevices();
  await loadProgressively();
});
</script>

<template>
  <div class="quality-shell" :class="{ 'filter-collapsed': filterCollapsed }">
    <aside class="quality-filter card">
      <div class="filter-head">
        <div>
          <h2>查询与筛选</h2>
          <p>按日期、规则、区域和 OLT 定位异常</p>
        </div>
        <button class="text-btn" @click="filterCollapsed = true">收起</button>
      </div>

      <div class="filter-query">
        <div class="filter-query-title">查询条件</div>
        <div class="field compact-field">
          <label>统计日期</label>
          <input v-model="date" class="input" type="date" />
        </div>
        <div class="field compact-field">
          <label>规则筛选</label>
          <select v-model="qualityCode" class="select">
            <option value="">全部规则</option>
            <option value="rx_low">接收光过低</option>
            <option value="rx_high">接收光过高</option>
          </select>
        </div>
        <div
          class="quality-rule-fields"
          :title="`阈值由系统配置锁定；RX = 0、正数、RX <= ${rule.onu_rx_invalid_min_dbm} dBm 不计入质差。`"
        >
          <span class="rule-pill">低光 &lt; <strong>{{ rule.onu_rx_low_dbm }}</strong> dBm</span>
          <span class="rule-pill">高光 &gt; <strong>{{ rule.onu_rx_high_dbm }}</strong> dBm</span>
          <span class="rule-help" :data-tip="`阈值由系统配置锁定；RX = 0、正数、RX <= ${rule.onu_rx_invalid_min_dbm} dBm 不计入质差。`">?</span>
        </div>
        <div class="filter-query-actions">
          <button class="btn btn-primary" :disabled="loading" @click="search">
            <span v-if="loading" class="mini-spinner"></span>{{ loading ? "查询中" : "开始查询" }}
          </button>
          <button class="btn btn-secondary" @click="reset">重置</button>
        </div>
      </div>

      <div class="filter-device-block">
        <div class="filter-subhead">
          <div>
            <h3>设备筛选</h3>
            <p>筛选 OLT / 机房 / 区域</p>
          </div>
          <strong>{{ selectedCount }} / {{ devices.length }}</strong>
        </div>

        <div class="filter-search">
          <span>⌕</span>
          <input v-model="deviceKeyword" placeholder="筛选 OLT / 机房 / 区域" />
        </div>

        <div class="filter-chips">
          <button :class="{ active: allSelected && !onlySelected }" @click="setAllDevices">全部</button>
          <button :class="{ active: selectionMode === 'custom' && selectedCount === 0 }" @click="cancelAllDevices">清空</button>
          <button :class="{ active: onlySelected }" @click="toggleOnlySelected">已选</button>
        </div>
      </div>

      <div class="tree-caption">按机房分组（共 {{ tree.length }} 个机房组）</div>
      <EmptyState v-if="treeLoading" title="正在加载设备" description="读取 OLT 机房层级" />
      <div v-else class="olt-tree">
        <section v-for="group in tree" :key="group.group" class="tree-group">
          <div class="tree-group-row" :class="{ selected: isGroupChecked(group) }">
            <button class="select-check" :class="{ checked: isGroupChecked(group) }" @click="setGroupDevices(group)">
              <span>✓</span>
            </button>
            <button class="tree-title" @click="toggleGroup(group.group)">
              <span>{{ expandedGroups.has(group.group) ? "−" : "+" }}</span>
              <strong>{{ group.group }}</strong>
              <em>{{ group.count }} 台</em>
            </button>
          </div>
          <div v-if="expandedGroups.has(group.group)" class="tree-rooms">
            <div v-for="room in group.rooms" :key="`${group.group}-${room.room}`" class="tree-room">
              <div class="tree-room-row">
                <button class="select-check small" :class="{ checked: isRoomChecked(room.devices) }" @click="setRoomDevices(room.devices)">
                  <span>✓</span>
                </button>
                <button class="tree-room-title" @click="toggleRoom(`${group.group}-${room.room}`)">
                  <span>{{ expandedRooms.has(`${group.group}-${room.room}`) ? "−" : "+" }}</span>
                  <strong>{{ room.room }}</strong>
                  <em>{{ room.devices.length }} 台</em>
                </button>
              </div>
              <div v-if="expandedRooms.has(`${group.group}-${room.room}`)" class="tree-devices">
                <label v-for="device in room.devices" :key="device.olt_device_id" class="tree-device">
                  <input type="checkbox" :checked="isDeviceChecked(device.olt_device_id)" @change="toggleDevice(device.olt_device_id)" />
                  <span :title="device.name">{{ regionLabel(device.region) }} / {{ device.name }}</span>
                  <small>{{ device.primary_ip }}</small>
                </label>
              </div>
            </div>
          </div>
        </section>
      </div>
    </aside>

    <button v-if="filterCollapsed" class="filter-open-btn" @click="filterCollapsed = false">展开设备筛选</button>

    <main class="quality-main">
      <div class="quality-page-actions">
        <div>
          <div class="breadcrumb">接入网运维 / ONU 质差管理</div>
          <h1>ONU 质差管理</h1>
          <p>监控全网 ONU 质差情况，定位影响用户体验的异常设备</p>
        </div>
        <div class="page-action-buttons">
          <button class="btn btn-primary" :disabled="exporting" @click="exportExcel">
            {{ exporting ? "导出中" : "⇩ 导出 Excel" }}
          </button>
          <button class="btn btn-secondary" :disabled="loading" @click="refresh">↻ 刷新</button>
        </div>
      </div>

      <div v-if="exporting" class="export-progress" role="status" aria-live="polite">
        <div class="export-progress-head">
          <span>{{ exportStage === "preparing" ? "正在生成 Excel" : "正在下载 Excel" }}</span>
          <strong>{{ exportProgress === null ? "处理中" : `${exportProgress}%` }}</strong>
        </div>
        <div class="export-progress-track" :class="{ indeterminate: exportProgress === null }" aria-hidden="true">
          <span :style="exportProgress === null ? undefined : { width: `${exportProgress}%` }"></span>
        </div>
      </div>

      <div v-if="notice || error" class="quality-message" :class="{ error: !!error }">{{ error || notice }}</div>

      <div class="quality-kpi-strip" :class="{ loading }">
        <article v-for="item in kpis" :key="item.label" class="quality-kpi" :class="`tone-${item.tone}`">
          <i>{{ item.icon }}</i>
          <div>
            <label>{{ item.label }}</label>
            <strong :class="{ 'time-value': item.label === '最近更新时间' }">{{ item.value }}</strong>
            <span>{{ item.hint }}</span>
          </div>
        </article>
      </div>

      <section class="card card-pad quality-chart-card quality-chart-wide" :class="{ loading }">
        <div class="card-title">
          <div><h2>质差数量变化趋势</h2><p>鼠标悬停查看明细，滚轮或底部滑块缩放时间范围</p></div>
          <div class="segmented compact-segmented">
            <button :class="{ active: trendDays === 30 }" @click="changeTrendDays(30)">近 30 天</button>
            <button :class="{ active: trendDays === 365 }" @click="changeTrendDays(365)">近 1 年</button>
          </div>
        </div>
        <EmptyState v-if="!trend.length && !loading" title="暂无趋势数据" description="当前日期范围没有可展示的质差趋势。" />
        <QualityTrendChart v-else :points="trend" />
      </section>

      <div class="quality-rank-row">
        <section class="card card-pad port-rank-card" :class="{ loading: loading || summaryLoading || portLoading }">
          <div class="card-title">
            <div><h2>端口异常聚合 Top</h2><p>按 OLT / PON 聚合，展示影响最大的 200 个端口</p></div>
            <label class="port-toggle">
              <input v-model="includeUnknownPorts" type="checkbox" @change="refreshPortGroups" />
              <span>未识别端口参与排序</span>
            </label>
          </div>
          <div class="rank-scroll">
          <div class="rank-table">
            <div class="rank-row rank-head port-rank-row"><span></span><strong>OLT</strong><strong>端口</strong><strong>光节点位置</strong><b>质差/总数</b></div>
            <div v-for="(row, index) in portGroups" :key="`${row.olt_device_id}-${row.pon_port}`" class="port-row rank-row port-rank-row">
              <span :class="{ medal: index < 3 }">{{ index + 1 }}</span>
              <strong :title="`${regionLabel(row.region)} / ${row.olt_name}`">{{ regionLabel(row.region) }} / {{ row.olt_name }}</strong>
              <strong :title="row.pon_port || '-'">{{ row.pon_port || "-" }}</strong>
              <strong class="node-location" :title="row.optical_node_location || row.optical_node_code || '-'">
                {{ row.optical_node_location || row.optical_node_code || "-" }}
              </strong>
              <b>{{ row.bad_count }} / {{ row.total_onu }}</b>
            </div>
          </div>
          </div>
        </section>

        <section class="card card-pad quality-top-card" :class="{ loading: loading || summaryLoading }">
          <div class="card-title">
            <div><h2>OLT 质差 Top</h2><p>按 OLT 维度展示影响最大的 100 台设备</p></div>
          </div>
          <div class="rank-scroll">
          <div class="rank-table">
            <div class="rank-row rank-head"><span></span><strong>OLT</strong><b>质差/总数</b><b>低光/高光</b><b>最差 RX</b></div>
            <div v-for="(row, index) in topOlts" :key="row.olt_device_id" class="top-row rank-row">
              <span :class="{ medal: index < 3 }">{{ index + 1 }}</span>
              <strong :title="`${regionLabel(row.region)} / ${row.olt_name}`">{{ regionLabel(row.region) }} / {{ row.olt_name }}</strong>
              <b>{{ row.bad_count }} / {{ row.total_onu || "-" }}</b>
              <b>{{ row.rx_low }} / {{ row.rx_high }}</b>
              <b class="danger-text">{{ row.worst_rx || "-" }}</b>
            </div>
          </div>
          </div>
        </section>
      </div>

      <section class="card table-card abnormal-card" :class="{ loading: loading || tableLoading }">
        <div class="table-head">
          <div>
            <h2>异常 ONU 列表</h2>
            <p>共 {{ total }} 条数据</p>
          </div>
          <div class="table-tools">
            <button class="text-btn">⚙ 表格设置</button>
            <label>每页显示：</label>
            <select v-model="size" class="select tiny-select" @change="gotoPage(1)">
              <option :value="20">20</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
            </select>
          </div>
        </div>
        <div v-if="error" class="notice-card error card-pad"><div class="notice-icon">!</div><p>{{ error }}</p></div>
        <EmptyState v-else-if="!loading && !tableLoading && !rows.length" title="暂无异常 ONU" description="请调整日期、规则或设备范围后重新查询。" />
        <div v-else class="table-wrap">
          <table class="data-table quality-data-table">
            <thead><tr><th>机房 / OLT</th><th>PON</th><th>ONU</th><th>ONU MAC</th><th>RX / TX (dBm)</th><th>原因</th><th>最新时间</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="row in rows" :key="`${row.olt_device_id}-${row.onu_mac}-${row.query_time}`">
                <td>{{ regionLabel(row.region) }} / {{ row.olt_name }}<div class="muted">{{ row.room }} · ID {{ row.olt_device_id }}</div></td>
                <td>{{ row.pon_port || "-" }}</td>
                <td>{{ row.if_index || "-" }}</td>
                <td><strong class="mono">{{ row.display_mac || row.onu_mac }}</strong><div class="muted">{{ row.gdf_account || "-" }}</div></td>
                <td><strong>{{ row.rx_power }} / {{ row.tx_power }}</strong></td>
                <td><StatusTag :value="row.quality_code === 'rx_high' ? '高光值告警' : '低光值告警'" /></td>
                <td>{{ row.query_time }}</td>
                <td><button class="outline-action" @click="openDetail(row)">详情定位</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="rows.length" class="quality-mobile-list">
          <article v-for="row in rows" :key="`mobile-${row.olt_device_id}-${row.onu_mac}-${row.query_time}`" class="quality-mobile-card">
            <div class="quality-mobile-card-head">
              <div>
                <strong class="mono">{{ row.display_mac || row.onu_mac }}</strong>
                <span>{{ regionLabel(row.region) }} / {{ row.room }}</span>
              </div>
              <StatusTag :value="row.quality_code === 'rx_high' ? '高光值告警' : '低光值告警'" />
            </div>
            <div class="quality-mobile-card-grid">
              <p><label>OLT</label><b>{{ row.olt_name || "-" }}</b></p>
              <p><label>PON</label><b>{{ row.pon_port || "-" }}</b></p>
              <p><label>ONU</label><b>{{ row.if_index || "-" }}</b></p>
              <p><label>RX / TX</label><b class="danger-text">{{ row.rx_power }} / {{ row.tx_power }}</b></p>
              <p><label>账号</label><b>{{ row.gdf_account || "-" }}</b></p>
              <p><label>时间</label><b>{{ row.query_time || "-" }}</b></p>
            </div>
            <button class="outline-action" @click="openDetail(row)">详情定位</button>
          </article>
        </div>
        <div class="pagination modern-pagination">
          <button class="btn btn-secondary" :disabled="page <= 1 || loading || tableLoading" @click="gotoPage(page - 1)">‹</button>
          <button v-if="visiblePages[0] > 1" class="page-num" @click="gotoPage(1)">1</button>
          <span v-if="visiblePages[0] > 2">…</span>
          <button v-for="p in visiblePages" :key="p" class="page-num" :class="{ active: page === p }" @click="gotoPage(p)">{{ p }}</button>
          <span v-if="visiblePages[visiblePages.length - 1] < pages - 1">…</span>
          <button v-if="visiblePages[visiblePages.length - 1] < pages" class="page-num" @click="gotoPage(pages)">{{ pages }}</button>
          <button class="btn btn-secondary" :disabled="page >= pages || loading || tableLoading" @click="gotoPage(page + 1)">›</button>
          <span>跳至</span>
          <input class="page-jump" :value="page" @change="gotoPage(Number(($event.target as HTMLInputElement).value) || 1)" />
          <span>页</span>
        </div>
      </section>
    </main>

    <div v-if="detailRow" class="quality-detail-mask" @click.self="closeDetail">
      <section class="quality-detail-panel card">
        <header class="detail-panel-head">
          <div>
            <span>单台 ONU 定位</span>
            <h2>{{ detailRow.display_mac || detailRow.onu_mac }}</h2>
            <p>{{ regionLabel(detailRow.region) }} / {{ detailRow.room }} / {{ detailRow.olt_name }}</p>
          </div>
          <button class="round-icon-btn" @click="closeDetail">×</button>
        </header>
        <div class="detail-grid">
          <div><label>OLT</label><strong>{{ detailRow.olt_name }}</strong><span>{{ detailRow.device_model }} · ID {{ detailRow.olt_device_id }}</span></div>
          <div><label>管理 IP</label><strong>{{ detailRow.primary_ip || "-" }}</strong><span>备用 {{ detailRow.backup_ip || "-" }}</span></div>
          <div><label>PON / if_index</label><strong>{{ detailRow.pon_port || "-" }}</strong><span>{{ detailRow.if_index || "-" }}</span></div>
          <div><label>RX / TX</label><strong class="danger-text">{{ detailRow.rx_power }} / {{ detailRow.tx_power }}</strong><span>{{ detailRow.query_time }}</span></div>
          <div><label>BOSS 用户</label><strong>{{ detailRow.customer_name || "-" }}</strong><span>{{ detailRow.gdf_account || "-" }}</span></div>
          <div><label>业务匹配</label><strong>{{ detailRow.business_type || "-" }}</strong><span>{{ detailRow.optical_node_code || detailRow.optical_node_location || "-" }}</span></div>
        </div>
        <div class="detail-history-card">
          <div class="card-title">
            <div><h2>近 7 天光功率历史</h2><p>当前列表记录对应 OLT 与 if_index</p></div>
          </div>
          <EmptyState v-if="detailLoading" title="正在加载历史" description="读取 ClickHouse 光功率样本" />
          <EmptyState v-else-if="!detailHistory.length" title="暂无历史记录" description="当前 ONU 没有可展示的光功率历史。" />
          <PowerLineChart v-else :points="detailHistory" :height="280" />
        </div>
      </section>
    </div>
  </div>
</template>
