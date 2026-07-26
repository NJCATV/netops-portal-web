<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Activity, Database, Gauge, RefreshCw, ShieldCheck, Users } from "lucide-vue-next";
import RadiusModuleTabs from "../components/RadiusModuleTabs.vue";
import RadiusTrendChart from "../components/RadiusTrendChart.vue";
import { loadRadiusIngestStatus, loadRadiusOverview, type RadiusRow } from "../services/radiusApi";

const hours = ref(24);
const overview = ref<RadiusRow>({});
const trend = ref<RadiusRow[]>([]);
const collector = ref<RadiusRow>({});
const freshness = ref<RadiusRow>({});
const quality = ref<RadiusRow>({});
const loading = ref(false);
const error = ref("");
const rejectionRate = computed(() => {
  const total = Number(overview.value.auth_total || 0);
  return total ? `${(Number(overview.value.reject_total || 0) / total * 100).toFixed(2)}%` : "0%";
});
const healthy = computed(() => Number(freshness.value.lag_seconds || 999999) < 180 && Number(collector.value.spool_pending || 0) < 10000);
const number = (value: unknown) => Number(value || 0).toLocaleString();
const bytes = (value: unknown) => {
  let n = Number(value || 0);
  for (const unit of ["B", "KB", "MB", "GB", "TB"]) {
    if (n < 1024) return `${n.toFixed(unit === "B" ? 0 : 1)} ${unit}`;
    n /= 1024;
  }
  return `${n.toFixed(1)} PB`;
};

async function load() {
  loading.value = true; error.value = "";
  try {
    const [summary, status] = await Promise.all([loadRadiusOverview(hours.value), loadRadiusIngestStatus()]);
    overview.value = summary.overview || {};
    trend.value = summary.trend || [];
    collector.value = status.collector || {};
    freshness.value = status.data || {};
    quality.value = status.quality || {};
  } catch (err) { error.value = err instanceof Error ? err.message : "Radius 数据加载失败"; }
  finally { loading.value = false; }
}
onMounted(load);
</script>

<template>
  <div class="aiops-page radius-page" :class="{ loading }">
    <section class="aiops-page-head"><div><span><ShieldCheck :size="15" /> Radius 管理</span><h1>认证、风险与流量统一分析</h1><p>采集程序直接写入 ClickHouse，网管统一负责登录、权限、查询和审计。</p></div><div class="aiops-range"><button v-for="value in [1,24,72,168]" :key="value" :class="{active:hours===value}" @click="hours=value;load()">{{ value }}h</button></div><button class="btn btn-secondary" @click="load"><RefreshCw :size="15" />刷新</button></section>
    <RadiusModuleTabs />
    <div v-if="error" class="aiops-notice error">{{ error }}</div>
    <section class="aiops-kpis">
      <article><span class="aiops-kpi-icon"><Activity /></span><div><em>认证请求</em><strong>{{ number(overview.auth_total) }}</strong><small>通过 {{ number(overview.accept_total) }}</small></div></article>
      <article><span class="aiops-kpi-icon red"><ShieldCheck /></span><div><em>拒绝率</em><strong>{{ rejectionRate }}</strong><small>拒绝 {{ number(overview.reject_total) }}</small></div></article>
      <article><span class="aiops-kpi-icon amber"><Users /></span><div><em>认证账号</em><strong>{{ number(overview.auth_users) }}</strong><small>会话 {{ number(overview.sessions) }} · Challenge {{ number(quality.challenges) }}</small></div></article>
      <article><span class="aiops-kpi-icon green"><Database /></span><div><em>Accounting 流量</em><strong>{{ bytes(overview.traffic_bytes) }}</strong><small>{{ number(overview.accounting_total) }} 条 · NAS 上下线 {{ number(overview.nas_restart_events) }}</small></div></article>
    </section>
    <section class="radius-main-grid">
      <article class="card radius-chart-card"><header><div><h2>认证趋势</h2><p>10 分钟粒度的通过与拒绝响应</p></div></header><RadiusTrendChart :points="trend" /></article>
      <aside class="card radius-health-card"><header><Gauge :size="20" /><div><h2>采集链路</h2><p :class="healthy?'ok':'warning'">{{ healthy ? "运行正常" : "需要关注" }}</p></div></header><dl><div><dt>最新数据</dt><dd>{{ freshness.latest_event_time || "-" }}</dd></div><div><dt>数据延迟</dt><dd>{{ freshness.lag_seconds ?? "-" }} 秒</dd></div><div><dt>本地待重放</dt><dd>{{ number(collector.spool_pending) }} 条</dd></div><div><dt>内核丢包</dt><dd>{{ number(collector.tcpdump_kernel_dropped) }} 包</dd></div><div><dt>ClickHouse 重试</dt><dd>{{ number(collector.sink_retries) }} 次</dd></div><div><dt>未配对响应 / 过期请求</dt><dd>{{ number(collector.unmatched_auth_responses) }} / {{ number(collector.expired_auth_requests) }}</dd></div><div><dt>格式错误 / 未知 Code</dt><dd>{{ number(collector.malformed_packets) }} / {{ number(collector.unknown_radius_codes) }}</dd></div><div><dt>CoA / Disconnect</dt><dd>{{ number(quality.control_packets) }} 包</dd></div><div><dt>缺失账号 / MAC</dt><dd>{{ number(quality.missing_username) }} / {{ number(quality.missing_terminal_mac) }}</dd></div></dl></aside>
    </section>
  </div>
</template>
