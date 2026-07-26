<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import EmptyState from "../components/EmptyState.vue";
import PerformanceTrendChart from "../components/PerformanceTrendChart.vue";
import StatusTag from "../components/StatusTag.vue";
import { api } from "../services/api";

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

type PerfRule = {
  olt_cpu_warning: number;
  olt_cpu_critical: number;
  olt_mem_warning: number;
  olt_mem_critical: number;
  board_cpu_warning: number;
  board_cpu_critical: number;
  board_mem_warning: number;
  board_mem_critical: number;
  stale_minutes: number;
  include_collect_failures: boolean;
  rule_version: string;
};

type PerfRow = OltDevice & {
  cpu_usage?: number | string | null;
  mem_usage?: number | string | null;
  board_count?: number | string | null;
  board_cpu_max?: number | string | null;
  board_mem_max?: number | string | null;
  latest_time?: string | null;
  status?: string;
  status_label?: string;
  is_abnormal?: boolean;
};

type PerfResponse = {
  items: PerfRow[];
  total: number;
  page: number;
  size: number;
  stats: Record<string, string | number>;
  trend: Record<string, string | number | null>[];
  trend_bucket_hours?: number;
  rule: PerfRule;
};

type TrendDevice = OltDevice & {
  device_cpu_max?: number | string | null;
  device_mem_max?: number | string | null;
  board_cpu_max?: number | string | null;
  board_mem_max?: number | string | null;
};

type BoardRow = {
  slot_id?: string;
  board_name?: string;
  cpu_usage?: number | string | null;
  mem_usage?: number | string | null;
  query_time?: string;
  status?: string;
};

type PortRow = {
  if_index?: string;
  port_category?: string;
  if_speed_bps?: number | string | null;
  if_admin_status?: number | string | null;
  if_oper_status?: number | string | null;
};

const defaultRule: PerfRule = {
  olt_cpu_warning: 80,
  olt_cpu_critical: 90,
  olt_mem_warning: 80,
  olt_mem_critical: 90,
  board_cpu_warning: 80,
  board_cpu_critical: 90,
  board_mem_warning: 80,
  board_mem_critical: 90,
  stale_minutes: 30,
  include_collect_failures: false,
  rule_version: "olt_perf_web_80_90"
};

const devices = ref<OltDevice[]>([]);
const selectedIds = ref<number[]>([]);
const selectionMode = ref<"all" | "custom">("all");
const expandedGroups = ref<Set<string>>(new Set());
const deviceKeyword = ref("");
const keyword = ref("");
const conditionCpu = ref(true);
const conditionMem = ref(true);
const conditionCollectFailure = ref(false);
const sortBy = ref<"abnormal" | "cpu" | "mem">("abnormal");
const sortOrder = ref<"asc" | "desc">("desc");
const page = ref(1);
const size = ref(20);
const total = ref(0);
const rows = ref<PerfRow[]>([]);
const stats = ref<Record<string, string | number>>({});
const trend = ref<Record<string, string | number | null>[]>([]);
const trendBucketHours = ref(1);
const trendLoading = ref(false);
const trendRange = ref<{ start: string; end: string } | null>(null);
const trendPointOpen = ref(false);
const trendPointLoading = ref(false);
const trendPointTitle = ref("");
const trendPointDevices = ref<TrendDevice[]>([]);
const rule = ref<PerfRule>({ ...defaultRule });
const hours = ref(24);
const loading = ref(false);
const tableLoading = ref(false);
const error = ref("");
const autoRefresh = ref(true);
const lastRefresh = ref("");
const filterCollapsed = ref(false);

const detailOpen = ref(false);
const detailLoading = ref(false);
const detailDevice = ref<PerfRow | null>(null);
const boards = ref<BoardRow[]>([]);
const ports = ref<PortRow[]>([]);
const detailHistory = ref<Record<string, string | number | null>[]>([]);
const selectedBoard = ref("");
const selectedPort = ref("");
const portHistory = ref<Record<string, string | number | null>[]>([]);
const portHistoryLoaded = ref(false);
const portHistorySampleCount = ref(0);
const detailHours = ref(24);

let timer: number | undefined;

const pages = computed(() => Math.max(1, Math.ceil(total.value / size.value)));
const selectedSet = computed(() => new Set(selectionMode.value === "all" ? devices.value.map((d) => d.olt_device_id) : selectedIds.value));
const selectedCount = computed(() => selectionMode.value === "all" ? devices.value.length : selectedIds.value.length);
const allSelected = computed(() => selectionMode.value === "all" || selectedIds.value.length === devices.value.length);
const latestCollection = computed(() => {
  const value = String(stats.value.latest_time || "");
  return value && value !== "-" ? value.slice(5, 16) : "-";
});
const tableScopeHint = computed(() => {
  const conditions = [
    conditionCpu.value ? "CPU 异常" : "",
    conditionMem.value ? "内存异常" : "",
    conditionCollectFailure.value ? "采集失败" : ""
  ].filter(Boolean);
  return conditions.length ? `当前筛选：${conditions.join("、")}` : "当前筛选：正常设备";
});

const visiblePages = computed(() => {
  const count = Math.min(5, pages.value);
  const start = Math.min(Math.max(1, page.value - 2), Math.max(1, pages.value - count + 1));
  return Array.from({ length: count }, (_, index) => start + index);
});

const filteredDevices = computed(() => {
  const k = deviceKeyword.value.trim().toLowerCase();
  return devices.value.filter((device) => {
    if (!k) return true;
    return [regionLabel(device.region), device.room, device.name, device.device_model, device.primary_ip]
      .some((value) => String(value || "").toLowerCase().includes(k));
  });
});

const tree = computed(() => {
  const groups = new Map<string, OltDevice[]>();
  for (const device of filteredDevices.value) {
    const group = regionLabel(device.region);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(device);
  }
  return Array.from(groups, ([group, list]) => ({
    group,
    count: list.length,
    devices: [...list].sort((a, b) => compareText(`${a.room || ""}${a.name || ""}`, `${b.room || ""}${b.name || ""}`))
  })).sort((a, b) => compareText(a.group, b.group));
});

const kpis = computed(() => [
  { label: "OLT 总数", value: n(stats.value.total), hint: `${n(stats.value.perf_count)}台有性能`, tone: "blue", icon: "OLT" },
  { label: "板卡总数", value: n(stats.value.board_count), hint: `${n(stats.value.board_olt_count)}台有板卡`, tone: "green", icon: "BD" },
  { label: "CPU 告警", value: n(stats.value.cpu_alarm), hint: `阈值 ≥ ${rule.value.olt_cpu_warning}%`, tone: "danger", icon: "CPU" },
  { label: "内存告警", value: n(stats.value.mem_alarm), hint: `阈值 ≥ ${rule.value.olt_mem_warning}%`, tone: "danger", icon: "MEM" },
  { label: "采集时间", value: latestCollection.value, hint: autoRefresh.value ? "最新采集 · 自动刷新" : "最新成功采集", tone: "slate", icon: "⏱", kind: "time" }
]);

function n(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function regionLabel(value?: string) { return ({ chengbei:"城北",chengdong:"城东",chengnan:"城南",chengxi:"城西",gaochun:"高淳",jiangning:"江宁",lishui:"溧水",liuhe:"六合",pukou:"浦口",qixia:"栖霞",yuhua:"雨花" } as Record<string,string>)[value||""] || value || "未分区域"; }

function fmt(value: unknown, suffix = "") {
  if (value === null || value === undefined || value === "") return "-";
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return `${Math.round(parsed * 100) / 100}${suffix}`;
  return `${value}${suffix}`;
}

function compareText(a: string, b: string) {
  return String(a || "").localeCompare(String(b || ""), "zh-CN-u-co-pinyin", { numeric: true, sensitivity: "base" });
}

function statusTone(status?: string) {
  if (status === "critical") return "danger";
  if (status === "warning" || status === "stale") return "warn";
  if (status === "missing") return "muted";
  return "ok";
}

function queryString(includeSummary = true) {
  const params = new URLSearchParams({
    page: String(page.value),
    size: String(size.value),
    hours: String(hours.value),
    keyword: keyword.value,
    condition_cpu: conditionCpu.value ? "1" : "0",
    condition_mem: conditionMem.value ? "1" : "0",
    condition_collect_failure: conditionCollectFailure.value ? "1" : "0",
    sort_by: sortBy.value,
    sort_order: sortOrder.value,
    summary: includeSummary ? "1" : "0"
  });
  if (selectionMode.value === "custom") {
    params.set("olt_device_ids", selectedIds.value.length ? selectedIds.value.join(",") : "0");
  }
  return params.toString();
}

async function loadDevices() {
  const data = await api<{ items: OltDevice[] }>("/olt/device-tree");
  devices.value = data.items || [];
}

async function load(includeSummary = true, noCache = false, tableOnly = false) {
  if (tableOnly) tableLoading.value = true;
  else loading.value = true;
  error.value = "";
  try {
    const data = await api<PerfResponse>(`/olt/performance?${queryString(includeSummary)}${noCache ? "&no_cache=1" : ""}`);
    rows.value = data.items || [];
    total.value = data.total || 0;
    stats.value = data.stats || {};
    if (data.trend) trend.value = data.trend;
    trendBucketHours.value = Number(data.trend_bucket_hours || (hours.value <= 168 ? 1 : 4));
    trendRange.value = null;
    if (data.rule) rule.value = { ...rule.value, ...data.rule };
    lastRefresh.value = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  } catch (err) {
    error.value = err instanceof Error ? err.message : "加载 OLT 性能数据失败";
  } finally {
    loading.value = false;
    tableLoading.value = false;
  }
}

function selectedOltParams(params: URLSearchParams) {
  if (selectionMode.value === "custom") {
    params.set("olt_device_ids", selectedIds.value.length ? selectedIds.value.join(",") : "0");
  }
}

function trendBucketForRange(start: string, end: string) {
  const from = new Date(start.replace(" ", "T")).getTime();
  const to = new Date(end.replace(" ", "T")).getTime();
  const spanHours = Math.max(1, (to - from) / 3600000);
  if (spanHours <= 168) return 1;
  if (spanHours <= 336) return 2;
  return 4;
}

async function loadTrendRange(start: string, end: string, bucketHours: number) {
  if (!start || !end || trendLoading.value) return;
  if (trendRange.value?.start === start && trendRange.value?.end === end && trendBucketHours.value === bucketHours) return;
  trendLoading.value = true;
  try {
    const params = new URLSearchParams({ hours: String(hours.value), start, end, bucket_hours: String(bucketHours) });
    selectedOltParams(params);
    const data = await api<{ items: Record<string, string | number | null>[]; bucket_hours?: number }>(`/olt/performance/trend?${params}`);
    trend.value = data.items || [];
    trendBucketHours.value = Number(data.bucket_hours || bucketHours);
    trendRange.value = { start, end };
  } catch (err) {
    error.value = err instanceof Error ? err.message : "加载趋势明细失败";
  } finally {
    trendLoading.value = false;
  }
}

function onTrendZoom(payload: { start: string; end: string }) {
  const bucketHours = trendBucketForRange(payload.start, payload.end);
  loadTrendRange(payload.start, payload.end, bucketHours);
}

function resetTrendRange() {
  trendRange.value = null;
  load(true, true);
}

async function openTrendPoint(payload: { sampleTime: string }) {
  trendPointOpen.value = true;
  trendPointLoading.value = true;
  trendPointDevices.value = [];
  trendPointTitle.value = `${payload.sampleTime} ～ ${trendBucketHours.value === 1 ? "下一小时" : `${trendBucketHours.value} 小时内`}的异常设备`;
  try {
    const params = new URLSearchParams({ sample_time: payload.sampleTime, bucket_hours: String(trendBucketHours.value) });
    selectedOltParams(params);
    const data = await api<{ items: TrendDevice[] }>(`/olt/performance/trend-devices?${params}`);
    trendPointDevices.value = data.items || [];
  } catch (err) {
    error.value = err instanceof Error ? err.message : "加载时间点异常设备失败";
  } finally {
    trendPointLoading.value = false;
  }
}

function search() {
  page.value = 1;
  load(true, true);
}

function changeConditions() {
  page.value = 1;
  load(true, true);
}

function changeSort(nextSort: "cpu" | "mem") {
  if (sortBy.value === nextSort) {
    sortOrder.value = sortOrder.value === "desc" ? "asc" : "desc";
  } else {
    sortBy.value = nextSort;
    sortOrder.value = "desc";
  }
  page.value = 1;
  load(false, false, true);
}

function sortMark(metric: "cpu" | "mem") {
  if (sortBy.value !== metric) return "↕";
  return sortOrder.value === "desc" ? "↓" : "↑";
}

function refresh() {
  load(true, true);
}

function gotoPage(nextPage: number) {
  page.value = Math.min(pages.value, Math.max(1, nextPage));
  load(false, false, true);
}

function reset() {
  keyword.value = "";
  conditionCpu.value = true;
  conditionMem.value = true;
  conditionCollectFailure.value = false;
  sortBy.value = "abnormal";
  sortOrder.value = "desc";
  hours.value = 24;
  page.value = 1;
  selectionMode.value = "all";
  selectedIds.value = [];
  load(true, true);
}

function toggleGroup(group: string) {
  const next = new Set(expandedGroups.value);
  next.has(group) ? next.delete(group) : next.add(group);
  expandedGroups.value = next;
}

function setAllDevices() {
  selectionMode.value = "all";
  selectedIds.value = [];
}

function cancelAllDevices() {
  selectionMode.value = "custom";
  selectedIds.value = [];
}

function isDeviceChecked(id?: number) {
  return !!id && selectedSet.value.has(id);
}

function isGroupChecked(group: { devices: OltDevice[] }) {
  return group.devices.length > 0 && group.devices.every((device) => selectedSet.value.has(device.olt_device_id));
}

function setGroupDevices(group: { devices: OltDevice[] }) {
  const set = new Set(selectionMode.value === "all" ? devices.value.map((d) => d.olt_device_id) : selectedIds.value);
  const checked = isGroupChecked(group);
  for (const device of group.devices) checked ? set.delete(device.olt_device_id) : set.add(device.olt_device_id);
  if (set.size === devices.value.length) setAllDevices();
  else {
    selectionMode.value = "custom";
    selectedIds.value = Array.from(set);
  }
}

function toggleDevice(id: number) {
  const set = new Set(selectionMode.value === "all" ? devices.value.map((d) => d.olt_device_id) : selectedIds.value);
  set.has(id) ? set.delete(id) : set.add(id);
  if (set.size === devices.value.length) setAllDevices();
  else {
    selectionMode.value = "custom";
    selectedIds.value = Array.from(set);
  }
}

async function openDetail(row: PerfRow) {
  detailOpen.value = true;
  detailLoading.value = true;
  detailDevice.value = row;
  boards.value = [];
  ports.value = [];
  detailHistory.value = [];
  portHistory.value = [];
  portHistoryLoaded.value = false;
  portHistorySampleCount.value = 0;
  selectedBoard.value = "";
  selectedPort.value = "";
  try {
    const detail = await api<{ device: PerfRow; boards: BoardRow[]; ports: PortRow[]; rule: PerfRule }>(`/olt/performance/detail?olt_device_id=${row.olt_device_id}`);
    detailDevice.value = detail.device || row;
    boards.value = detail.boards || [];
    ports.value = detail.ports || [];
    if (detail.rule) rule.value = { ...rule.value, ...detail.rule };
    await loadDetailHistory();
    const initialPort = ports.value.find((port) => String(port.if_oper_status) === "1") || ports.value[0];
    if (initialPort?.if_index) await loadPortHistory(initialPort.if_index);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "加载单台 OLT 详情失败";
  } finally {
    detailLoading.value = false;
  }
}

async function loadDetailHistory() {
  if (!detailDevice.value) return;
  const scope = selectedBoard.value ? "board" : "device";
  const params = new URLSearchParams({
    olt_device_id: String(detailDevice.value.olt_device_id),
    scope,
    slot_id: selectedBoard.value,
    hours: String(detailHours.value)
  });
  const data = await api<{ items: Record<string, string | number | null>[] }>(`/olt/performance/history?${params.toString()}`);
  detailHistory.value = data.items || [];
}

async function loadPortHistory(ifIndex: string) {
  if (!detailDevice.value || !ifIndex) return;
  selectedPort.value = ifIndex;
  portHistoryLoaded.value = false;
  portHistorySampleCount.value = 0;
  const params = new URLSearchParams({
    olt_device_id: String(detailDevice.value.olt_device_id),
    if_index: ifIndex,
    hours: String(detailHours.value)
  });
  const data = await api<{ items: Record<string, string | number | null>[]; sample_count?: number }>(`/olt/performance/port-history?${params.toString()}`);
  portHistory.value = data.items || [];
  portHistorySampleCount.value = Number(data.sample_count || portHistory.value.length || 0);
  portHistoryLoaded.value = true;
}

function closeDetail() {
  detailOpen.value = false;
  detailDevice.value = null;
}

function setupTimer() {
  if (timer) window.clearInterval(timer);
  timer = window.setInterval(() => {
    if (autoRefresh.value && !loading.value && !detailLoading.value) load(true, true);
  }, 60000);
}

onMounted(async () => {
  await loadDevices();
  await load();
  setupTimer();
});

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer);
});
</script>

<template>
  <div class="perf-shell" :class="{ 'filter-collapsed': filterCollapsed }">
    <aside class="perf-filter card">
      <div class="filter-head">
        <div>
          <h2>查询与筛选</h2>
          <p>按区域、机房、OLT 和异常状态定位性能问题</p>
        </div>
        <button class="text-btn" @click="filterCollapsed = true">收起</button>
      </div>

      <div class="filter-query">
        <div class="filter-query-title">查询条件</div>
        <div class="field compact-field">
          <label>关键字</label>
          <input v-model="keyword" class="input" placeholder="OLT / 机房 / IP / 型号" @keydown.enter="search" />
        </div>
        <div class="field compact-field">
          <label>趋势范围</label>
          <select v-model.number="hours" class="select" @change="search">
            <option :value="24">近 24 小时</option>
            <option :value="168">近 7 天</option>
            <option :value="720">近 30 天</option>
          </select>
        </div>
        <label class="perf-switch" :title="`设备或任一板卡 CPU 达到 ${rule.olt_cpu_warning}% 即判定为 CPU 异常；达到 ${rule.olt_cpu_critical}% 为严重。`">
          <input v-model="conditionCpu" type="checkbox" @change="changeConditions" />
          <span>CPU 异常</span>
        </label>
        <label class="perf-switch" :title="`设备或任一板卡内存达到 ${rule.olt_mem_warning}% 即判定为内存异常；达到 ${rule.olt_mem_critical}% 为严重。`">
          <input v-model="conditionMem" type="checkbox" @change="changeConditions" />
          <span>内存异常</span>
        </label>
        <label class="perf-switch" :title="`设备或板卡最近一次成功性能采集距当前超过 ${rule.stale_minutes} 分钟，或从未采到性能指标，即判定为采集失败。`">
          <input v-model="conditionCollectFailure" type="checkbox" @change="changeConditions" />
          <span>采集失败</span>
        </label>
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
          <button :class="{ active: allSelected }" @click="setAllDevices">全部</button>
          <button :class="{ active: selectionMode === 'custom' && selectedIds.length === 0 }" @click="cancelAllDevices">清空</button>
        </div>
      </div>

      <div class="tree-caption">按区域分组（共 {{ tree.length }} 组）</div>
      <div class="olt-tree">
        <section v-for="group in tree" :key="group.group" class="tree-group">
          <div class="tree-group-row" :class="{ selected: isGroupChecked(group) }">
            <button class="select-check" :class="{ checked: isGroupChecked(group) }" @click="setGroupDevices(group)"><span>✓</span></button>
            <button class="tree-title" @click="toggleGroup(group.group)">
              <span>{{ expandedGroups.has(group.group) ? "−" : "+" }}</span>
              <strong>{{ group.group }}</strong>
              <em>{{ group.count }} 台</em>
            </button>
          </div>
          <div v-if="expandedGroups.has(group.group)" class="tree-devices">
            <label v-for="device in group.devices" :key="device.olt_device_id" class="tree-device">
              <input type="checkbox" :checked="isDeviceChecked(device.olt_device_id)" @change="toggleDevice(device.olt_device_id)" />
              <span :title="device.name">{{ device.room }} / {{ device.name }}</span>
              <small>{{ device.primary_ip }}</small>
            </label>
          </div>
        </section>
      </div>
    </aside>

    <button v-if="filterCollapsed" class="filter-open-btn" @click="filterCollapsed = false">展开筛选</button>

    <main class="perf-main">
      <div class="quality-page-actions">
        <div>
          <div class="breadcrumb">接入网运维 / OLT 性能监控</div>
          <h1>OLT 性能监控</h1>
          <p>监控设备与板卡 CPU、内存、采集时效和端口状态，异常优先展示</p>
        </div>
        <div class="page-action-buttons">
          <label class="auto-refresh">
            <input v-model="autoRefresh" type="checkbox" />
            <span>自动刷新</span>
          </label>
          <button class="btn btn-secondary" :disabled="loading" @click="refresh">刷新</button>
        </div>
      </div>

      <div v-if="error" class="quality-message error">{{ error }}</div>

      <div class="perf-kpi-grid" :class="{ loading }">
        <article v-for="item in kpis" :key="item.label" class="perf-kpi" :class="`tone-${item.tone}`">
          <i>{{ item.icon }}</i>
          <div>
            <label>{{ item.label }}</label>
            <strong :class="{ time: item.kind === 'time' }">{{ item.value }}</strong>
            <span>{{ item.hint }}</span>
          </div>
        </article>
      </div>

      <section class="card card-pad perf-trend-card" :class="{ loading: loading || trendLoading }">
        <div class="card-title">
          <div>
            <h2>全网性能趋势</h2>
            <p>全网所选 OLT 在时间范围内的历史最大值；不受左侧三项条件过滤</p>
          </div>
          <div class="trend-toolbar">
            <span class="muted">粒度 {{ trendBucketHours }} 小时 · 点击曲线点查看异常设备</span>
            <button v-if="trendRange" class="btn btn-secondary" @click="resetTrendRange">重置趋势</button>
            <span class="muted">最近刷新 {{ lastRefresh || "-" }}</span>
          </div>
        </div>
        <PerformanceTrendChart v-if="trend.length" :points="trend" mode="overview" :height="310" @zoom="onTrendZoom" @point-click="openTrendPoint" />
        <EmptyState v-else title="暂无性能趋势" description="当前范围内没有可展示的性能历史数据" />
      </section>

      <section class="card table-card perf-list-card" :class="{ loading: loading || tableLoading }">
        <div class="table-head">
          <div>
            <h2>设备性能明细</h2>
            <p>共 {{ total }} 台，{{ tableScopeHint }}；展示最新一次采集值</p>
          </div>
          <div class="table-tools">
            <label>每页显示</label>
            <select v-model.number="size" class="select tiny-select" @change="gotoPage(1)">
              <option :value="20">20</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
            </select>
          </div>
        </div>
        <EmptyState v-if="!loading && !rows.length" title="暂无设备" description="请调整筛选条件后重新查询" />
        <div v-else class="table-wrap">
          <table class="data-table perf-table perf-detail-table">
            <colgroup>
              <col class="perf-col-status" />
              <col class="perf-col-device" />
              <col class="perf-col-usage" />
              <col class="perf-col-board" />
              <col class="perf-col-count" />
              <col class="perf-col-time" />
              <col class="perf-col-action" />
            </colgroup>
            <thead>
              <tr>
                <th>状态</th>
                <th>OLT</th>
                <th>
                  <div class="perf-sort-head">
                    <button :class="{ active: sortBy === 'cpu' }" @click="changeSort('cpu')">CPU {{ sortMark("cpu") }}</button>
                    <button :class="{ active: sortBy === 'mem' }" @click="changeSort('mem')">内存 {{ sortMark("mem") }}</button>
                  </div>
                </th>
                <th>板卡峰值</th>
                <th>板卡数</th>
                <th>采集时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.olt_device_id" :class="`perf-row-${row.status}`">
                <td><StatusTag :value="row.status_label || '-'" :tone="statusTone(row.status)" /></td>
                <td class="perf-device-cell">
                  <strong>{{ regionLabel(row.region) }} / {{ row.name }}</strong>
                  <div class="muted">{{ row.room }} · {{ row.device_model }} · {{ row.primary_ip }}</div>
                </td>
                <td>
                  <div class="usage-pair">
                    <span>CPU <b>{{ fmt(row.cpu_usage, "%") }}</b></span>
                    <span>内存 <b>{{ fmt(row.mem_usage, "%") }}</b></span>
                  </div>
                </td>
                <td>
                  <div class="usage-pair">
                    <span>CPU <b>{{ fmt(row.board_cpu_max, "%") }}</b></span>
                    <span>内存 <b>{{ fmt(row.board_mem_max, "%") }}</b></span>
                  </div>
                </td>
                <td class="perf-board-count"><strong>{{ row.board_count || 0 }}</strong></td>
                <td class="perf-collected-time">{{ row.latest_time || "-" }}</td>
                <td class="perf-action-cell"><button class="outline-action" @click="openDetail(row)">查看详情</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="perf-mobile-list">
          <article v-for="row in rows" :key="`m-${row.olt_device_id}`" class="perf-mobile-card" :class="`perf-row-${row.status}`">
            <div>
              <StatusTag :value="row.status_label || '-'" :tone="statusTone(row.status)" />
              <strong>{{ regionLabel(row.region) }} / {{ row.name }}</strong>
              <span>{{ row.device_model }} · {{ row.primary_ip }}</span>
            </div>
            <div class="usage-pair"><span>CPU <b>{{ fmt(row.cpu_usage, "%") }}</b></span><span>内存 <b>{{ fmt(row.mem_usage, "%") }}</b></span></div>
            <button class="outline-action" @click="openDetail(row)">查看详情</button>
          </article>
        </div>
        <div v-if="rows.length" class="pagination modern-pagination">
          <button class="btn btn-secondary" :disabled="page <= 1 || tableLoading" @click="gotoPage(page - 1)">‹</button>
          <button v-for="p in visiblePages" :key="p" class="page-num" :class="{ active: page === p }" @click="gotoPage(p)">{{ p }}</button>
          <button class="btn btn-secondary" :disabled="page >= pages || tableLoading" @click="gotoPage(page + 1)">›</button>
        </div>
      </section>
    </main>

    <div v-if="trendPointOpen" class="quality-detail-mask" @click.self="trendPointOpen = false">
      <section class="quality-detail-panel trend-point-panel card">
        <header class="detail-panel-head">
          <div>
            <span>趋势时间点异常设备</span>
            <h2>{{ trendPointTitle }}</h2>
            <p>展示该时间桶内 CPU、内存或板卡指标达到告警阈值的 OLT。</p>
          </div>
          <button class="round-icon-btn" @click="trendPointOpen = false">×</button>
        </header>
        <div v-if="trendPointLoading" class="detail-loading">正在查询异常设备…</div>
        <EmptyState v-else-if="!trendPointDevices.length" title="该时间点没有异常设备" description="该时间桶内没有达到当前告警阈值的 CPU 或内存指标。" />
        <div v-else class="table-wrap">
          <table class="data-table perf-table">
            <thead><tr><th>OLT</th><th>设备峰值</th><th>板卡峰值</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="device in trendPointDevices" :key="device.olt_device_id">
                <td><strong>{{ regionLabel(device.region) }} / {{ device.name }}</strong><div class="muted">{{ device.device_model }} · {{ device.primary_ip }}</div></td>
                <td><div class="usage-pair"><span>CPU <b>{{ fmt(device.device_cpu_max, "%") }}</b></span><span>内存 <b>{{ fmt(device.device_mem_max, "%") }}</b></span></div></td>
                <td><div class="usage-pair"><span>CPU <b>{{ fmt(device.board_cpu_max, "%") }}</b></span><span>内存 <b>{{ fmt(device.board_mem_max, "%") }}</b></span></div></td>
                <td><button class="outline-action" @click="openDetail(device)">查看详情</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <div v-if="detailOpen" class="quality-detail-mask" @click.self="closeDetail">
      <section class="quality-detail-panel perf-detail-panel card">
        <header class="detail-panel-head">
          <div>
            <span>单台 OLT 性能详情</span>
            <h2>{{ regionLabel(detailDevice?.region) }} / {{ detailDevice?.name }}</h2>
            <p>{{ detailDevice?.device_model }} · {{ detailDevice?.primary_ip }} · ID {{ detailDevice?.olt_device_id }}</p>
          </div>
          <button class="round-icon-btn" @click="closeDetail">×</button>
        </header>

        <div class="detail-grid">
          <div><label>设备 CPU</label><strong>{{ fmt(detailDevice?.cpu_usage, "%") }}</strong><span>告警 {{ rule.olt_cpu_warning }}%，严重 {{ rule.olt_cpu_critical }}%</span></div>
          <div><label>设备内存</label><strong>{{ fmt(detailDevice?.mem_usage, "%") }}</strong><span>告警 {{ rule.olt_mem_warning }}%，严重 {{ rule.olt_mem_critical }}%</span></div>
          <div><label>板卡峰值</label><strong>{{ fmt(detailDevice?.board_cpu_max, "%") }} / {{ fmt(detailDevice?.board_mem_max, "%") }}</strong><span>{{ boards.length }} 块板卡</span></div>
          <div><label>采集状态</label><strong>{{ detailDevice?.status_label || "-" }}</strong><span>{{ detailDevice?.latest_time || "-" }}</span></div>
          <div><label>主备 IP</label><strong>{{ detailDevice?.primary_ip || "-" }}</strong><span>备用 {{ detailDevice?.backup_ip || "-" }}</span></div>
          <div><label>端口状态</label><strong>{{ ports.length }} 个端口</strong><span>历史来自端口计数器采样（10 分钟聚合）</span></div>
        </div>

        <div class="perf-detail-body" :class="{ loading: detailLoading }">
          <section class="card card-pad">
            <div class="card-title">
              <div>
                <h2>{{ selectedBoard ? `板卡 ${selectedBoard} 历史` : "设备性能历史" }}</h2>
                <p>CPU / 内存趋势，可切换板卡</p>
              </div>
              <div class="trend-toolbar">
                <select v-model.number="detailHours" class="select tiny-select" @change="loadDetailHistory">
                  <option :value="24">24 小时</option>
                  <option :value="168">7 天</option>
                  <option :value="720">30 天</option>
                </select>
                <button class="btn btn-secondary" @click="selectedBoard = ''; loadDetailHistory()">设备级</button>
              </div>
            </div>
            <PerformanceTrendChart v-if="detailHistory.length" :points="detailHistory" mode="device" :height="290" />
            <EmptyState v-else title="暂无历史曲线" description="当前范围内没有性能历史数据" />
          </section>

          <section class="card card-pad">
            <div class="card-title">
              <div><h2>板卡实时状态</h2><p>点击板卡切换历史曲线</p></div>
            </div>
            <div class="board-grid">
              <button
                v-for="board in boards"
                :key="board.slot_id"
                class="board-card"
                :class="[`status-${board.status}`, { active: selectedBoard === board.slot_id }]"
                @click="selectedBoard = board.slot_id || ''; loadDetailHistory()"
              >
                <span>槽位 {{ board.slot_id || "-" }}</span>
                <strong>{{ board.board_name || "板卡" }}</strong>
                <em>CPU {{ fmt(board.cpu_usage, "%") }} · MEM {{ fmt(board.mem_usage, "%") }}</em>
              </button>
            </div>
          </section>

          <section class="card card-pad">
            <div class="card-title">
              <div><h2>端口实时状态</h2><p>展示端口管理/运行状态；打开详情后自动查询一个 UP 端口的历史</p></div>
            </div>
            <div class="port-list">
              <button v-for="port in ports.slice(0, 80)" :key="port.if_index" class="port-chip" :class="{ active: selectedPort === port.if_index }" @click="loadPortHistory(port.if_index || '')">
                <strong>{{ port.if_index }}</strong>
                <span>{{ port.port_category || "port" }}</span>
                <em :class="{ ok: String(port.if_oper_status) === '1' }">{{ String(port.if_oper_status) === "1" ? "UP" : "DOWN" }}</em>
              </button>
            </div>
          </section>

          <section class="card card-pad">
            <div class="card-title">
              <div><h2>端口流量与状态历史</h2><p>{{ selectedPort ? `if_index ${selectedPort} · 近 ${detailHours} 小时 · ${portHistorySampleCount} 个采样点` : "正在选择端口" }}</p></div>
            </div>
            <PerformanceTrendChart v-if="portHistory.length" :points="portHistory" mode="port" :height="260" />
            <EmptyState v-else-if="portHistoryLoaded" title="该端口暂无历史采样" description="当前端口状态来自设备端口档案；近当前时间范围内未写入 ClickHouse 端口计数器样本，因此无法展示流量或状态变化曲线。" />
            <EmptyState v-else title="正在加载端口历史" description="读取端口计数器与状态采样。" />
          </section>
        </div>
      </section>
    </div>
  </div>
</template>
