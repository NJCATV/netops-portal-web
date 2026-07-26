<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  Activity, AlertTriangle, Bot, BrainCircuit, CheckCircle2, ChevronRight, CircleDotDashed, Clock3,
  Cpu, Database, Eye, Gauge, Network, Radio, RefreshCw, Router, ServerCog, ShieldCheck, Signal, Sparkles,
  UsersRound, Wifi, Zap
} from "lucide-vue-next";
import EmptyState from "../components/EmptyState.vue";
import { api } from "../services/api";
import { aiopsApi, loadAiopsOverview, type AiopsOverview } from "../services/aiopsApi";
import { loadRadiusIngestStatus, loadRadiusOverview, loadRadiusRejectRisk, type RadiusRow } from "../services/radiusApi";

type Point = Record<string, string | number | null | undefined>;
type Risk = { kind: string; severity: "high" | "medium" | "low"; title: string; region: string; device: string; latest_time: string; path: string; count?: number };
type Dashboard = {
  hours: number;
  device: { olt_total: number; cmts_total: number; total: number };
  platform: { active_accounts: number; online_users: number; today_active_users: number; total_visits: number; today_visits: number; online_window_minutes: number };
  collect: { total: number; success_count: number; fail_count: number; success_rate: number; latest_finished_at?: string; olt: Record<string, number>; cmts: Record<string, number> };
  quality: { current_bad?: number; latest_time?: string };
  perf: { cpu_alarm?: number; mem_alarm?: number; board_count?: number; latest_time?: string };
  quality_trend: Point[];
  performance_trend: Point[];
  collection_trend: Point[];
  risk_list: Risk[];
  risk_summary: { total: number; quality_count: number; performance_count: number };
  regions: Array<{ region: string; label: string; device_total: number; local_total: number; external_total: number; success_rate: number | null; risk_count: number }>;
  freshness: Record<string, string | null>;
  infrastructure?: { observed_at?: string; summary: { total_components?: number; failed_components?: number; warning_nodes?: number }; components: Array<{ key: string; label: string; status: "ok" | "warning" | "failed"; node_id: string; node_name: string }> };
};

const router = useRouter();
const data = ref<Dashboard | null>(null);
const aiopsOverview = ref<AiopsOverview | null>(null);
const latestAiRun = ref<Record<string, any> | null>(null);
const radiusOverview = ref<RadiusRow>({});
const radiusCollector = ref<RadiusRow>({});
const radiusFreshness = ref<RadiusRow>({});
const radiusRejects = ref<RadiusRow[]>([]);
const radiusAvailable = ref(false);
const loading = ref(true);
const refreshing = ref(false);
const loadError = ref("");
const hours = ref(24);
let refreshTimer: number | undefined;
const ranges = [{ label: "近 24 小时", value: 24 }, { label: "近 7 天", value: 168 }, { label: "近 30 天", value: 720 }];

function number(value: unknown) { return Number(value || 0); }
function formatCount(value: unknown) {
  const amount = number(value);
  const abs = Math.abs(amount);
  const compact = (scale: number, suffix: string) => {
    const scaled = amount / scale;
    const digits = Math.abs(scaled) >= 100 ? 0 : Math.abs(scaled) >= 10 ? 1 : 2;
    return `${scaled.toFixed(digits).replace(/\.?0+$/, "")}${suffix}`;
  };
  if (abs >= 1_000_000_000) return compact(1_000_000_000, "B");
  if (abs >= 1_000_000) return compact(1_000_000, "M");
  if (abs >= 1_000) return compact(1_000, "K");
  return amount.toLocaleString("zh-CN");
}
function shortTime(value?: string | null) {
  if (!value) return "暂无数据";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  const delta = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (delta < 1) return "刚刚更新";
  if (delta < 60) return `${delta} 分钟前`;
  if (delta < 1440) return `${Math.floor(delta / 60)} 小时前`;
  return `${Math.floor(delta / 1440)} 天前`;
}
function pointTime(point: Point) {
  const raw = String(point.sample_time || point.stat_date || "");
  return raw.length > 10 ? raw.slice(5, 16) : raw.slice(5);
}
function polyline(source: Point[], key: string, maxValue?: number) {
  if (!source.length) return "";
  const max = maxValue || Math.max(1, ...source.map(item => number(item[key]))) * 1.12;
  return source.map((item, index) => {
    const x = 54 + index * (910 / Math.max(source.length - 1, 1));
    const y = 170 - number(item[key]) / max * 132;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}
function pointX(index: number, length: number) { return 54 + index * (910 / Math.max(length - 1, 1)); }
function pointY(value: unknown, source: Point[], key: string, maxValue?: number) {
  const max = maxValue || Math.max(1, ...source.map(item => number(item[key]))) * 1.12;
  return 170 - number(value) / max * 132;
}
const quality = computed(() => data.value?.quality_trend || []);
const collection = computed(() => data.value?.collection_trend || []);
const qualityScale = computed(() => Math.max(1, ...quality.value.map(point => number(point.bad_count))) * 1.12);
const collectionFailMax = computed(() => Math.max(1, ...collection.value.map(point => number(point.fail_count))));
const healthTone = computed(() => number(data.value?.collect.success_rate) >= 95 ? "good" : number(data.value?.collect.success_rate) >= 80 ? "watch" : "bad");
const riskCount = computed(() => number(data.value?.risk_summary?.total));
const radiusAuthTotal = computed(() => number(radiusOverview.value.auth_total));
const radiusRejectTotal = computed(() => number(radiusOverview.value.reject_total));
const radiusRejectRate = computed(() => radiusAuthTotal.value ? radiusRejectTotal.value / radiusAuthTotal.value * 100 : 0);
const radiusAcceptRate = computed(() => radiusAuthTotal.value ? number(radiusOverview.value.accept_total) / radiusAuthTotal.value * 100 : 0);
const radiusHealthy = computed(() => Number(radiusFreshness.value.lag_seconds || 999999) < 180 && Number(radiusCollector.value.spool_pending || 0) < 10000 && Number(radiusCollector.value.tcpdump_kernel_dropped || 0) === 0);
const lastValue = (source: Point[], key: string) => source.length ? number(source[source.length - 1][key]) : 0;
function axisValue(scale: number, y: number) { return Math.round(scale * Math.max(0, 170 - y) / 132); }
function formatBytes(value: unknown) {
  let size = number(value);
  for (const unit of ["B", "KB", "MB", "GB", "TB"]) {
    if (size < 1024) return `${size.toFixed(unit === "B" ? 0 : 1)} ${unit}`;
    size /= 1024;
  }
  return `${size.toFixed(1)} PB`;
}
function radiusReason(item: RadiusRow) { return String(item.reasons || item.reason_zh || item.reason || "认证异常"); }

function normalizeDashboard(raw: Partial<Dashboard>): Dashboard {
  const rawCollect = raw.collect || {} as Dashboard["collect"];
  const total = number(rawCollect.total || number(rawCollect.success_count) + number(rawCollect.fail_count));
  return {
    hours: number(raw.hours) || hours.value,
    device: { olt_total: number(raw.device?.olt_total || raw.device?.total), cmts_total: number(raw.device?.cmts_total), total: number(raw.device?.total) },
    platform: { active_accounts: number(raw.platform?.active_accounts), online_users: number(raw.platform?.online_users), today_active_users: number(raw.platform?.today_active_users), total_visits: number(raw.platform?.total_visits), today_visits: number(raw.platform?.today_visits), online_window_minutes: number(raw.platform?.online_window_minutes) || 5 },
    collect: {
      total, success_count: number(rawCollect.success_count), fail_count: number(rawCollect.fail_count),
      success_rate: number(rawCollect.success_rate || (total ? number(rawCollect.success_count) * 100 / total : 0)), latest_finished_at: rawCollect.latest_finished_at,
      olt: rawCollect.olt || { total, success_count: number(rawCollect.success_count), fail_count: number(rawCollect.fail_count), success_rate: total ? number(rawCollect.success_count) * 100 / total : 0 },
      cmts: rawCollect.cmts || { total: 0, success_count: 0, fail_count: 0, success_rate: 0 }
    },
    quality: raw.quality || {}, perf: raw.perf || {}, quality_trend: raw.quality_trend || [], performance_trend: raw.performance_trend || [], collection_trend: raw.collection_trend || [], risk_list: raw.risk_list || [], risk_summary: raw.risk_summary || { total: number(raw.quality?.current_bad), quality_count: number(raw.quality?.current_bad), performance_count: number(raw.perf?.cpu_alarm) + number(raw.perf?.mem_alarm) }, regions: raw.regions || [],
    freshness: raw.freshness || { olt_collect: rawCollect.latest_finished_at || null, cmts_collect: null, quality: raw.quality?.latest_time || null, performance: raw.perf?.latest_time || null }
  };
}

async function markPresence(visit: boolean) {
  try {
    await api("/dashboard/presence", { method: "POST", body: JSON.stringify({ visit }) });
  } catch {
    // Presence is supplementary; a transient write failure must not hide operations data.
  }
}
async function loadDashboard(quiet = false) {
  if (quiet) refreshing.value = true;
  else loading.value = true;
  loadError.value = "";
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    data.value = normalizeDashboard(await api<Partial<Dashboard>>(`/dashboard?hours=${hours.value}`, { signal: controller.signal }));
  } catch (error) {
    loadError.value = error instanceof DOMException && error.name === "AbortError"
      ? "驾驶舱数据加载超时，请稍后重试"
      : error instanceof Error ? error.message : "驾驶舱数据加载失败";
  } finally {
    window.clearTimeout(timeout);
    loading.value = false;
    refreshing.value = false;
  }
}
async function loadAiopsSummary() {
  try {
    const [overview, history] = await Promise.all([
      loadAiopsOverview(24),
      aiopsApi<{ items: Record<string, any>[] }>("/ai-runs?limit=1"),
    ]);
    aiopsOverview.value = overview;
    latestAiRun.value = history.items?.[0] || null;
  } catch {
    // AIOps is independently permissioned; the network cockpit must remain usable without it.
    aiopsOverview.value = null;
    latestAiRun.value = null;
  }
}
async function loadRadiusSummary() {
  try {
    const [summary, status, rejects] = await Promise.all([
      loadRadiusOverview(hours.value),
      loadRadiusIngestStatus(),
      loadRadiusRejectRisk(hours.value, 3),
    ]);
    radiusOverview.value = summary.overview || {};
    radiusCollector.value = status.collector || {};
    radiusFreshness.value = status.data || {};
    radiusRejects.value = rejects.items || [];
    radiusAvailable.value = true;
  } catch {
    // Radius is independently permissioned; the cockpit remains available when it is not granted.
    radiusAvailable.value = false;
  }
}
function selectRange(value: number) { if (hours.value !== value) { hours.value = value; void loadRadiusSummary(); loadDashboard(); } }
function navigate(path: string) { router.push(path); }

onMounted(async () => {
  void markPresence(true);
  void loadAiopsSummary();
  void loadRadiusSummary();
  await loadDashboard();
  refreshTimer = window.setInterval(async () => { await markPresence(false); void loadAiopsSummary(); void loadRadiusSummary(); loadDashboard(true); }, 60000);
});
onBeforeUnmount(() => { if (refreshTimer) window.clearInterval(refreshTimer); });
</script>

<template>
  <div class="cockpit-page cockpit-v2">
    <EmptyState v-if="loading && !data" title="正在汇聚全网运行数据" description="正在合并网络、采集、性能、质量与平台运营数据。" />
    <template v-else-if="data">
      <header class="ops-hero">
        <div class="ops-hero-copy">
          <div class="ops-live"><i></i> 实时运行中</div>
          <span class="eyebrow">NETWORK INTELLIGENCE CENTER</span>
          <h1>全网运行驾驶舱</h1>
          <p>以网络健康为主线，联动设备采集、服务风险与平台活跃度。</p>
        </div>
        <div class="ops-hero-actions">
          <div class="ops-update"><Clock3 :size="15" /><span>数据最新于</span><b>{{ shortTime(data.collect.latest_finished_at) }}</b></div>
          <div class="range-switch" aria-label="统计时间范围"><button v-for="range in ranges" :key="range.value" :class="{ active: hours === range.value }" @click="selectRange(range.value)">{{ range.label }}</button></div>
          <button class="btn btn-secondary cockpit-refresh" :disabled="refreshing" @click="loadDashboard(true)"><RefreshCw :size="16" :class="{ spinning: refreshing }" />刷新</button>
        </div>
      </header>

      <p v-if="loadError" class="cockpit-error">{{ loadError }}，当前保留最近一次成功加载的数据。</p>

      <section class="ops-metrics" aria-label="平台关键指标">
        <article class="ops-metric device"><span class="metric-icon"><Network :size="20" /></span><div><small>接入设备</small><strong>{{ formatCount(data.device.total) }}</strong><em>{{ data.device.olt_total }} OLT · {{ data.device.cmts_total }} CMTS</em></div></article>
        <article class="ops-metric health" :class="healthTone"><span class="metric-icon"><Gauge :size="20" /></span><div><small>采集健康度</small><strong>{{ number(data.collect.success_rate).toFixed(1) }}%</strong><em>{{ formatCount(data.collect.success_count) }} / {{ formatCount(data.collect.total) }} 本轮成功</em></div></article>
        <article class="ops-metric alert"><span class="metric-icon"><AlertTriangle :size="20" /></span><div><small>待处置风险对象</small><strong>{{ formatCount(riskCount) }}</strong><em>光路 {{ formatCount(data.risk_summary.quality_count) }} · 性能 {{ formatCount(data.risk_summary.performance_count) }}</em></div></article>
        <article class="ops-metric account"><span class="metric-icon"><UsersRound :size="20" /></span><div><small>已开通账号</small><strong>{{ formatCount(data.platform.active_accounts) }}</strong><em>当前权限范围内已启用</em></div></article>
        <article class="ops-metric radius-reject" :class="{ watch: radiusRejectRate >= 1, muted: !radiusAvailable }" @click="navigate('/radius/reject')"><span class="metric-icon"><ShieldCheck :size="20" /></span><div><small>Radius 拒绝率</small><strong>{{ radiusAvailable ? `${radiusRejectRate.toFixed(2)}%` : "-" }}</strong><em>{{ radiusAvailable ? `拒绝 ${formatCount(radiusRejectTotal)} / 认证 ${formatCount(radiusAuthTotal)}` : "Radius 数据不可用或无权限" }}</em></div></article>
        <article class="ops-metric radius-traffic" :class="{ muted: !radiusAvailable }" @click="navigate('/radius/accounting')"><span class="metric-icon"><Database :size="20" /></span><div><small>Accounting 流量</small><strong>{{ radiusAvailable ? formatBytes(radiusOverview.traffic_bytes) : "-" }}</strong><em>{{ radiusAvailable ? `${formatCount(radiusOverview.accounting_total)} 条计费记录 · 当前窗口` : "Radius 数据不可用或无权限" }}</em></div></article>
      </section>

      <section v-if="data.infrastructure" class="ops-component-strip" aria-label="核心组件运行情况">
        <header><div><span class="card-kicker">CORE COMPONENTS</span><h2>核心组件运行情况</h2><p>绿灯为正常，红灯表示关键服务不可达或未运行。</p></div><button class="ops-link" @click="navigate('/infrastructure')">基础设施监控 <ChevronRight :size="15" /></button></header>
        <div class="ops-component-lights"><article v-for="item in data.infrastructure.components" :key="`${item.node_id}-${item.key}`"><i :class="item.status"></i><div><strong>{{ item.label }}</strong><small>{{ item.node_id }} · {{ item.node_name }}</small></div><span>{{ item.status === 'ok' ? '正常' : item.status === 'warning' ? '关注' : '故障' }}</span></article></div>
      </section>

      <section v-if="aiopsOverview" class="ops-ai-brief" aria-label="AIOps 智能态势摘要">
        <div class="ops-ai-identity"><div class="ops-ai-robot"><span></span><i></i><b><Bot :size="19" /></b></div><div><span><Sparkles :size="14" /> AIOPS INTELLIGENCE</span><h2>AI 智能态势</h2><p>{{ latestAiRun?.overall_title || latestAiRun?.summary_text || "持续关联 Syslog、Trap 与聚合事件" }}</p></div></div>
        <div class="ops-ai-counts"><article><small>24h Syslog</small><strong>{{ formatCount(aiopsOverview.windows?.find(item => item.hours === 24)?.syslog_parsed) }}</strong></article><article><small>24h Trap</small><strong>{{ formatCount(aiopsOverview.windows?.find(item => item.hours === 24)?.trap_raw) }}</strong></article><article><small>聚合事件</small><strong>{{ formatCount(aiopsOverview.windows?.find(item => item.hours === 24)?.alarm_events) }}</strong></article><article><small>最新分析</small><strong class="compact">{{ shortTime(latestAiRun?.created_at) }}</strong></article></div>
        <div class="ops-ai-actions"><button class="btn btn-secondary" @click="navigate('/ai-assistant')"><Bot :size="15" />询问 AI</button><button class="btn btn-primary" @click="navigate('/aiops/board')"><BrainCircuit :size="15" />进入运维看板<ChevronRight :size="14" /></button></div>
      </section>

      <section v-if="radiusAvailable" class="ops-radius-brief" aria-label="Radius 接入认证态势">
        <div class="ops-radius-identity">
          <span><ShieldCheck :size="14" /> ACCESS SERVICE · RADIUS</span>
          <h2>接入认证与会话态势</h2>
          <p>聚合认证质量、Accounting 流量与抓包采集链路；仅突出需要处置的接入风险。</p>
        </div>
        <div class="ops-radius-stats">
          <article><small>认证通过率</small><strong>{{ radiusAcceptRate.toFixed(2) }}%</strong><em>{{ formatCount(radiusOverview.accept_total) }} 次通过</em></article>
          <article :class="{ hot: radiusRejectRate >= 1 }"><small>拒绝账号风险</small><strong>{{ formatCount(radiusRejectTotal) }}</strong><em>{{ radiusRejectRate.toFixed(2) }}% · 点击查看处置</em></article>
          <article><small>活跃会话 / 账号</small><strong>{{ formatCount(radiusOverview.sessions) }} / {{ formatCount(radiusOverview.auth_users) }}</strong><em>当前统计窗口</em></article>
        </div>
        <div class="ops-radius-ingest" :class="{ warning: !radiusHealthy }">
          <span><i></i>{{ radiusHealthy ? "采集链路正常" : "采集链路需关注" }}</span>
          <small>延迟 {{ radiusFreshness.lag_seconds ?? "-" }} 秒 · 待重放 {{ formatCount(radiusCollector.spool_pending) }} · 内核丢包 {{ formatCount(radiusCollector.tcpdump_kernel_dropped) }}</small>
          <em>{{ shortTime(String(radiusFreshness.latest_event_time || "")) }}</em>
        </div>
        <div class="ops-radius-risks">
          <button v-for="item in radiusRejects" :key="String(item.username)" @click="navigate('/radius/reject')"><strong>{{ item.username || "未知账号" }}</strong><span>{{ radiusReason(item) }} · {{ formatCount(item.reject_count) }} 次</span></button>
          <span v-if="!radiusRejects.length">当前窗口没有高频认证拒绝账号</span>
        </div>
        <div class="ops-radius-actions">
          <button class="btn btn-secondary" @click="navigate('/radius/reject')">拒绝风险 <ChevronRight :size="14" /></button>
          <button class="btn btn-primary" @click="navigate('/radius/overview')">Radius 总览 <ChevronRight :size="14" /></button>
        </div>
      </section>

      <section class="ops-command-grid">
        <section class="ops-topology-card">
          <header class="ops-card-head">
            <div><span class="card-kicker">NETWORK FABRIC</span><h2>网络服务链路</h2><p>核心平台到接入网络的实时态势模拟，节点数来自当前可见范围。</p></div>
            <button class="ops-link" @click="navigate('/collector')">采集监控 <ChevronRight :size="15" /></button>
          </header>
          <div class="topology-scene">
            <div class="topology-glow"></div><div class="topology-grid"></div>
            <svg class="topology-lines" viewBox="0 0 1000 420" preserveAspectRatio="none" aria-hidden="true">
              <defs><linearGradient id="topologyLine" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#7c9cff" stop-opacity=".18"/><stop offset=".5" stop-color="#a9baff"/><stop offset="1" stop-color="#57e0bd" stop-opacity=".25"/></linearGradient></defs>
              <path class="topology-link route-a" d="M505 203 C410 120 295 106 168 126" /><path class="topology-link route-b" d="M505 203 C612 120 736 111 856 144" /><path class="topology-link route-c" d="M505 203 C418 283 292 301 164 285" /><path class="topology-link route-d" d="M505 203 C620 282 742 303 860 279" />
              <path class="topology-flow flow-a" d="M505 203 C410 120 295 106 168 126" /><path class="topology-flow flow-b" d="M505 203 C612 120 736 111 856 144" /><path class="topology-flow flow-c" d="M505 203 C418 283 292 301 164 285" /><path class="topology-flow flow-d" d="M505 203 C620 282 742 303 860 279" />
              <circle class="topology-packet packet-blue" r="5"><animateMotion dur="3.2s" repeatCount="indefinite" path="M505 203 C410 120 295 106 168 126" /></circle><circle class="topology-packet packet-mint" r="4"><animateMotion dur="4.1s" repeatCount="indefinite" path="M505 203 C612 120 736 111 856 144" /></circle><circle class="topology-packet packet-blue" r="4"><animateMotion dur="3.7s" repeatCount="indefinite" path="M505 203 C418 283 292 301 164 285" /></circle><circle class="topology-packet packet-mint" r="5"><animateMotion dur="4.5s" repeatCount="indefinite" path="M505 203 C620 282 742 303 860 279" /></circle>
            </svg>
            <div class="topology-radar"></div><div class="topology-core"><span class="core-orbit orbit-one"></span><span class="core-orbit orbit-two"></span><span class="core-orbit orbit-three"></span><div class="core-disc"><Zap :size="23" /><b>安播智能平台</b><small>核心服务中枢</small></div></div>
            <button class="topology-node node-olt" @click="navigate('/collector')"><Router :size="19" /><span><small>OLT 接入层</small><b>{{ formatCount(data.device.olt_total) }}</b></span><i class="node-state good"></i></button>
            <button class="topology-node node-cmts" @click="navigate('/cmts-devices')"><Wifi :size="19" /><span><small>CMTS 接入层</small><b>{{ formatCount(data.device.cmts_total) }}</b></span><i class="node-state good"></i></button>
            <button class="topology-node node-quality" @click="navigate('/quality')"><Signal :size="19" /><span><small>光路风险 ONU</small><b>{{ formatCount(data.quality.current_bad) }}</b></span><i class="node-state warning"></i></button>
            <button class="topology-node node-perf" @click="navigate('/performance')"><Cpu :size="19" /><span><small>性能告警</small><b>{{ formatCount(number(data.perf.cpu_alarm) + number(data.perf.mem_alarm)) }}</b></span><i class="node-state" :class="riskCount ? 'warning' : 'good'"></i></button>
            <div class="topology-caption"><CircleDotDashed :size="15" /><span>信号流以动画示意，指标为实时采集结果</span></div>
          </div>
        </section>

        <aside class="ops-pulse-card">
          <header class="ops-card-head compact"><div><span class="card-kicker">LIVE PULSE</span><h2>实时运行脉冲</h2></div><span class="ops-pulse-dot"></span></header>
          <div class="pulse-score" :class="healthTone"><div class="pulse-ring"><svg viewBox="0 0 96 96"><circle cx="48" cy="48" r="39" /><circle cx="48" cy="48" r="39" :style="{ strokeDashoffset: `${245 - 245 * Math.min(100, number(data.collect.success_rate)) / 100}` }" /></svg><b>{{ number(data.collect.success_rate).toFixed(0) }}<small>%</small></b></div><div><strong>采集健康</strong><p>{{ healthTone === 'good' ? '运行稳定，网络采集处于健康区间' : healthTone === 'watch' ? '采集成功率需要持续关注' : '采集状态异常，建议优先处置' }}</p></div></div>
          <div class="pulse-sources"><article><span><ServerCog :size="16" />OLT 采集</span><b>{{ number(data.collect.olt.success_rate).toFixed(1) }}%</b><i><em :style="{ width: `${Math.min(100, number(data.collect.olt.success_rate))}%` }"></em></i></article><article><span><Wifi :size="16" />CMTS 采集</span><b>{{ number(data.collect.cmts.success_rate).toFixed(1) }}%</b><i><em :style="{ width: `${Math.min(100, number(data.collect.cmts.success_rate))}%` }"></em></i></article></div>
          <div class="pulse-freshness"><span><Activity :size="15" />性能</span><b>{{ shortTime(data.freshness.performance) }}</b><span><Signal :size="15" />光功率</span><b>{{ shortTime(data.freshness.quality) }}</b></div>
          <button class="pulse-action" @click="navigate('/collector')">查看失败设备 <ChevronRight :size="15" /></button>
        </aside>
      </section>

      <section class="ops-insight-grid">
        <section class="ops-panel trend-panel"><header class="ops-card-head"><div><span class="card-kicker">SIGNAL HISTORY</span><h2>关键趋势</h2><p>左侧为完整自然日质量快照；右侧为当前范围内每轮采集失败设备数。</p></div><span class="grain-tag">质差：日级 · 采集：{{ hours <= 168 ? '小时级' : '日级' }}</span></header><div class="trend-split"><article><div class="mini-title"><span class="orange-bullet"></span>ONU 质差数量 <em>最近 {{ quality.length }} 日 · {{ formatCount(lastValue(quality, 'bad_count')) }} 台</em></div><svg v-if="quality.length" viewBox="0 0 1000 200" preserveAspectRatio="none"><line v-for="y in [38,82,126,170]" :key="y" x1="54" x2="964" :y1="y" :y2="y" class="mini-grid" /><text v-for="y in [38,82,126,170]" :key="`quality-y-${y}`" x="46" :y="y + 3" text-anchor="end" class="mini-axis">{{ axisValue(qualityScale, y) }}</text><line x1="54" x2="54" y1="38" y2="170" class="mini-axis-line" /><line x1="54" x2="964" y1="170" y2="170" class="mini-axis-line" /><polyline :points="polyline(quality, 'bad_count')" class="quality-line" /><circle v-for="(point,index) in quality" :key="index" :cx="pointX(index,quality.length)" :cy="pointY(point.bad_count,quality,'bad_count')" r="3" class="quality-dot"><title>{{ pointTime(point) }} · {{ formatCount(point.bad_count) }} 台</title></circle><text v-for="(point,index) in quality.filter((_, index) => index === 0 || index === Math.floor(quality.length / 2) || index === quality.length - 1)" :key="`quality-label-${index}`" :x="pointX(quality.indexOf(point),quality.length)" y="190" text-anchor="middle" class="mini-axis">{{ pointTime(point) }}</text></svg><div v-else class="mini-empty">暂无完整自然日质量历史</div></article><article><div class="mini-title"><span class="red-bullet"></span>采集失败设备 <em>最新 {{ formatCount(lastValue(collection, 'fail_count')) }} 台 · 点击查看明细</em></div><svg v-if="collection.length" viewBox="0 0 1000 200" preserveAspectRatio="none" class="collection-mini-chart" @click="navigate('/collector')"><line v-for="y in [38,82,126,170]" :key="y" x1="54" x2="964" :y1="y" :y2="y" class="mini-grid" /><text v-for="y in [38,82,126,170]" :key="`fail-y-${y}`" x="46" :y="y + 3" text-anchor="end" class="mini-axis">{{ axisValue(collectionFailMax * 1.12, y) }}</text><line x1="54" x2="54" y1="38" y2="170" class="mini-axis-line" /><line x1="54" x2="964" y1="170" y2="170" class="mini-axis-line" /><rect v-for="(point,index) in collection" :key="`failure-${index}`" class="collection-mini-bar" :x="pointX(index,collection.length) - Math.max(3, 120 / collection.length)" :y="170 - Math.max(2, number(point.fail_count) / collectionFailMax * 132)" :width="Math.max(5, 220 / collection.length)" :height="Math.max(2, number(point.fail_count) / collectionFailMax * 132)"><title>{{ pointTime(point) }} · 失败 {{ formatCount(point.fail_count) }} 台</title></rect><text v-for="(point,index) in collection.filter((_, index) => index === 0 || index === Math.floor(collection.length / 2) || index === collection.length - 1)" :key="`fail-label-${index}`" :x="pointX(collection.indexOf(point),collection.length)" y="190" text-anchor="middle" class="mini-axis">{{ pointTime(point) }}</text></svg><div v-else class="mini-empty">暂无采集轮次历史</div></article></div></section>

        <section class="ops-panel risk-panel"><header class="ops-card-head"><div><span class="card-kicker">ACTION QUEUE</span><h2>待处置风险</h2><p>同类风险已聚合，按影响对象数量与严重度排序。</p></div><button class="ops-link" @click="navigate('/quality')">查看全部 <ChevronRight :size="15" /></button></header><div v-if="data.risk_list.length" class="risk-list-v2"><button v-for="risk in data.risk_list.slice(0, 5)" :key="`${risk.kind}-${risk.title}`" @click="navigate(risk.path)"><span class="risk-badge" :class="risk.severity">{{ risk.severity === 'high' ? '高' : risk.severity === 'medium' ? '中' : '低' }}</span><span><strong>{{ risk.title }} <em>× {{ formatCount(risk.count) }}</em></strong><small>{{ risk.region || '当前可见范围' }} · {{ risk.device }}</small></span><time>{{ shortTime(risk.latest_time) }}</time><ChevronRight :size="14" /></button></div><div v-else class="quiet-state"><CheckCircle2 :size="22" /><strong>当前没有待处置风险</strong><span>网络运行平稳</span></div></section>

        <section class="ops-panel region-panel"><header class="ops-card-head"><div><span class="card-kicker">REGION COVERAGE</span><h2>区域设备与采集覆盖</h2><p>设备数含外部同步；采集率仅计算本平台本地采集设备，外部同步不会被误判为失败。</p></div></header><div v-if="data.regions.length" class="region-list-v2"><article v-for="region in data.regions" :key="region.region"><div><strong>{{ region.label }}</strong><small>{{ region.device_total ? `${formatCount(region.device_total)} 台 · 本地 ${formatCount(region.local_total)} · 外部 ${formatCount(region.external_total)}` : '暂无设备' }}</small></div><div class="region-progress"><span><i :class="{ muted: region.success_rate === null }" :style="{ width: `${region.success_rate === null ? 100 : Math.min(100, number(region.success_rate))}%` }"></i></span><b :class="{ synced: region.success_rate === null }">{{ region.success_rate === null ? (region.external_total ? '外部同步' : '暂无采集') : `本地 ${number(region.success_rate).toFixed(1)}%` }}</b></div><em :class="{ hot: region.risk_count > 0 }">{{ region.risk_count ? `${formatCount(region.risk_count)} 风险` : '稳定' }}</em></article></div><div v-else class="quiet-state"><Network :size="22" /><strong>暂无区域数据</strong></div></section>
      </section>

      <footer class="ops-freshness"><span><span class="fresh-label">数据新鲜度</span><i></i></span><span><ServerCog :size="16" />OLT 采集 <b>{{ shortTime(data.freshness.olt_collect) }}</b></span><span><Activity :size="16" />OLT 性能 <b>{{ shortTime(data.freshness.performance) }}</b></span><span><Signal :size="16" />ONU 光功率 <b>{{ shortTime(data.freshness.quality) }}</b></span><span><Wifi :size="16" />CMTS 采集 <b>{{ shortTime(data.freshness.cmts_collect) }}</b></span><time>在线用户按 {{ data.platform.online_window_minutes }} 分钟心跳计算</time></footer>
    </template>
    <EmptyState v-else title="驾驶舱暂不可用" :description="loadError || '未能加载驾驶舱数据，请稍后刷新。'" />
  </div>
</template>
