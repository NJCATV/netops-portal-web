<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, DatabaseZap, RefreshCw, Search, Users } from "lucide-vue-next";
import RadiusModuleTabs from "../components/RadiusModuleTabs.vue";
import RadiusTrendChart from "../components/RadiusTrendChart.vue";
import { loadRadiusAccounting, type RadiusRow } from "../services/radiusApi";

const hours = ref(24);
const summary = ref<RadiusRow>({});
const quality = ref<RadiusRow>({});
const coverage = ref<RadiusRow>({});
const traffic = ref<RadiusRow[]>([]);
const anomalies = ref<RadiusRow[]>([]);
const anomalyRules = ref<RadiusRow>({});
const error = ref("");
const anomalyKeyword = ref("");
const anomalySort = ref<"total" | "upload" | "ratio">("total");
const anomalyPage = ref(1);
const anomalyPageSize = ref(20);
const bytes = (value: unknown) => {
  let n = Number(value || 0);
  for (const unit of ["B", "KB", "MB", "GB", "TB"]) {
    if (n < 1024) return `${n.toFixed(unit === "B" ? 0 : 1)} ${unit}`;
    n /= 1024;
  }
  return `${n.toFixed(1)} PB`;
};
const totalBytes = computed(() => Number(summary.value.input_bytes || 0) + Number(summary.value.output_bytes || 0));
const averageRate = computed(() => {
  const seconds = Number(coverage.value.observed_seconds || 0);
  if (!seconds) return "-";
  const bitsPerSecond = totalBytes.value * 8 / seconds;
  if (bitsPerSecond >= 1024 ** 3) return `${(bitsPerSecond / 1024 ** 3).toFixed(1)} Gbit/s`;
  if (bitsPerSecond >= 1024 ** 2) return `${(bitsPerSecond / 1024 ** 2).toFixed(1)} Mbit/s`;
  return `${Math.round(bitsPerSecond / 1024)} Kbit/s`;
});
const observedDuration = computed(() => {
  const seconds = Number(coverage.value.observed_seconds || 0);
  if (seconds < 60) return "不足 1 分钟";
  if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟`;
  return `${(seconds / 3600).toFixed(1)} 小时`;
});
const windowLabel = computed(() => hours.value === 1 ? "近 1 小时" : hours.value === 24 ? "近 24 小时" : hours.value === 168 ? "近 7 天" : "近 30 天");
const filteredAnomalies = computed(() => {
  const term = anomalyKeyword.value.trim().toLowerCase();
  const rows = term ? anomalies.value.filter(row => String(row.username || "").toLowerCase().includes(term)) : anomalies.value;
  const value = (row: RadiusRow) => anomalySort.value === "upload"
    ? Number(row.input_bytes || 0)
    : anomalySort.value === "ratio"
      ? Number(row.upload_ratio || 0)
      : Number(row.total_bytes || 0);
  return [...rows].sort((a, b) => value(b) - value(a));
});
const anomalyPageCount = computed(() => Math.max(1, Math.ceil(filteredAnomalies.value.length / anomalyPageSize.value)));
const visibleAnomalies = computed(() => filteredAnomalies.value.slice((anomalyPage.value - 1) * anomalyPageSize.value, anomalyPage.value * anomalyPageSize.value));
const anomalyReason = (row: RadiusRow) => [
  Number(row.heavy_volume) ? "窗口总量偏高" : "",
  Number(row.high_upload) ? "高上行结构" : "",
].filter(Boolean);
async function load() {
  error.value = "";
  try {
    const data = await loadRadiusAccounting(hours.value);
    summary.value = data.summary;
    quality.value = data.quality || {};
    coverage.value = data.coverage || {};
    traffic.value = data.traffic;
    anomalies.value = data.anomalies || [];
    anomalyRules.value = data.anomaly_rules || {};
    anomalyPage.value = 1;
  } catch (err) { error.value = err instanceof Error ? err.message : "加载失败"; }
}
function setHours(value: number) { hours.value = value; load(); }
onMounted(load);
</script>

<template>
  <div class="aiops-page radius-page">
    <section class="aiops-page-head">
      <div><span><ArrowDownToLine :size="15" /> Radius Accounting</span><h1>全网 Accounting 流量（窗口累计）</h1><p>上方是所选时间内的全网累计流量；下方图表是每 10 分钟的流量增量。两者来自同一批 Accounting 数据，图中每个时间点相加即为上方累计量。</p></div>
      <div class="aiops-range"><button v-for="value in [1, 24, 168, 720]" :key="value" :class="{ active: hours === value }" @click="setHours(value)">{{ value === 168 ? "7 天" : value === 720 ? "30 天" : `${value}h` }}</button></div>
      <button class="btn btn-secondary" @click="load"><RefreshCw :size="15" />刷新</button>
    </section>
    <RadiusModuleTabs />
    <div v-if="error" class="aiops-notice error">{{ error }}</div>
    <div class="radius-accounting-note"><DatabaseZap :size="17" /><div><strong>当前统计覆盖 {{ observedDuration }} · 平均总速率 {{ averageRate }}</strong><p>选定窗口：最近 {{ hours === 168 ? "7 天" : hours === 720 ? "30 天" : `${hours} 小时` }}；实际数据：{{ coverage.first_event_time || "-" }} 至 {{ coverage.last_event_time || "-" }}。首尾不足 10 分钟的图表点为不完整时间桶，数值偏低不代表流量骤降。</p></div></div>
    <section class="aiops-kpis aiops-kpis-compact">
      <article><span class="aiops-kpi-icon"><ArrowUpFromLine /></span><div><em>统计窗口累计上行</em><strong>{{ bytes(summary.input_bytes) }}</strong><small>所有账号相邻快照增量之和 · 非实时速率</small></div></article>
      <article><span class="aiops-kpi-icon green"><ArrowDownToLine /></span><div><em>统计窗口累计下行</em><strong>{{ bytes(summary.output_bytes) }}</strong><small>所有账号相邻快照增量之和 · 非实时速率</small></div></article>
      <article><span class="aiops-kpi-icon amber"><Users /></span><div><em>去重账号 / 计费会话</em><strong>{{ Number(summary.users || 0).toLocaleString() }}</strong><small>{{ Number(summary.sessions || 0).toLocaleString() }} 个会话 · 非当前在线数</small></div></article>
      <article><span class="aiops-kpi-icon"><DatabaseZap /></span><div><em>可计算快照增量</em><strong>{{ Number(quality.delta_records || 0).toLocaleString() }}</strong><small>同会话相邻计数器差值 · 回退 {{ quality.rollback_records || 0 }} 次</small></div></article>
    </section>
    <article class="card radius-chart-card"><header><div><h2>10 分钟全网流量增量（非累计、非实时速率）</h2><p>每个点代表该 10 分钟内全部账号的相邻快照增量之和；纵轴以 GB/TB 显示。鼠标悬停可查看上、下行及该时间桶合计。</p></div></header><RadiusTrendChart :points="traffic" kind="traffic" /></article>
    <article class="card aiops-table-card radius-anomaly-card">
      <header class="radius-card-head radius-anomaly-head">
        <div><h2><AlertTriangle :size="18" /> 异常流量账号 <em>{{ anomalies.length }}</em></h2><p>{{ windowLabel }}内满足流量巡检条件的账号。当前阈值：总流量 ≥ {{ bytes(anomalyRules.heavy_volume_bytes) }}，或上行 ≥ {{ bytes(anomalyRules.upload_bytes) }} 且上/下行比 ≥ {{ anomalyRules.upload_ratio || 4 }}；阈值随所选窗口同比例调整。</p></div>
      </header>
      <div class="radius-anomaly-toolbar">
        <label><Search :size="15" /><input v-model="anomalyKeyword" placeholder="搜索 GDF 账号" @input="anomalyPage = 1" /></label>
        <select v-model="anomalySort" @change="anomalyPage = 1"><option value="total">按窗口总流量排序</option><option value="upload">按上行流量排序</option><option value="ratio">按上/下行比排序</option></select>
        <span>匹配 {{ filteredAnomalies.length }} 个异常账号</span>
      </div>
      <div class="table-scroll"><table class="data-table"><thead><tr><th>账号</th><th>窗口上行</th><th>窗口下行</th><th>窗口总量</th><th>上/下行比</th><th>会话</th><th>命中规则</th><th>最后活动</th></tr></thead><tbody><tr v-for="row in visibleAnomalies" :key="String(row.username)"><td><RouterLink class="radius-account-link" :to="{ path: '/radius', query: { keyword: row.username } }">{{ row.username }}</RouterLink></td><td>{{ bytes(row.input_bytes) }}</td><td>{{ bytes(row.output_bytes) }}</td><td><strong>{{ bytes(row.total_bytes) }}</strong></td><td>{{ row.upload_ratio }}</td><td>{{ row.sessions }}</td><td><span class="radius-anomaly-tags"><i v-for="reason in anomalyReason(row)" :key="reason">{{ reason }}</i></span></td><td>{{ row.last_seen }}</td></tr><tr v-if="!visibleAnomalies.length"><td colspan="8" class="radius-empty">当前窗口没有账号命中流量异常规则</td></tr></tbody></table></div>
      <footer class="radius-pager"><span>第 {{ anomalyPage }} / {{ anomalyPageCount }} 页</span><select v-model="anomalyPageSize" @change="anomalyPage = 1"><option :value="20">20 条/页</option><option :value="50">50 条/页</option><option :value="100">100 条/页</option></select><button class="btn btn-secondary" :disabled="anomalyPage <= 1" @click="anomalyPage--">上一页</button><button class="btn btn-secondary" :disabled="anomalyPage >= anomalyPageCount" @click="anomalyPage++">下一页</button></footer>
    </article>
  </div>
</template>
