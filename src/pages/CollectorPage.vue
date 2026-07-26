<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import CollectionBatchTrendChart from "../components/CollectionBatchTrendChart.vue";
import EmptyState from "../components/EmptyState.vue";
import StatusTag from "../components/StatusTag.vue";
import { api } from "../services/api";

type Tab = "tasks" | "batches" | "devices" | "history";
type Options = { regions: string[]; room_groups: string[]; rooms: string[]; models: string[] };

const tab = ref<Tab>("tasks");
const rows = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(20);
const loading = ref(false);
const error = ref("");
const batchTrend = ref<any[]>([]);
const batchHours = ref(48);
const longCostMs = ref(60000);
const options = ref<Options>({ regions: [], room_groups: [], rooms: [], models: [] });
const filters = ref({ keyword: "", region: "", room: "", device_model: "", status: "", source: "", result: "" });

const pages = computed(() => Math.max(1, Math.ceil(total.value / size.value)));
const tabs = [
  { key: "tasks" as const, label: "任务与外部同步", desc: "查看本地采集、外部同步、性能采集的运行与进度" },
  { key: "batches" as const, label: "采集批次", desc: "按小时批次汇总开始结束、成功失败与超长采集" },
  { key: "devices" as const, label: "OLT 单台采集", desc: "查看每台 OLT 最近一次连通、SNMP 和数据量" },
  { key: "history" as const, label: "采集历史", desc: "按设备查看每一轮采集结果与耗时" }
];

function endpoint() {
  return tab.value === "tasks" ? "/collector/tasks" : tab.value === "batches" ? "/collector/batches" : tab.value === "devices" ? "/collector/devices" : "/collector/history";
}

function query() {
  const params = new URLSearchParams({ page: String(page.value), size: String(size.value) });
  for (const [key, value] of Object.entries(filters.value)) if (value) params.set(key, value);
  if (tab.value === "history" && filters.value.status) params.set("result", filters.value.status);
  if (tab.value === "batches") params.set("hours", String(batchHours.value));
  return params.toString();
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const data = await api<{ items: any[]; total: number; trend?: any[]; long_cost_ms?: number }>(`${endpoint()}?${query()}`);
    rows.value = data.items || [];
    total.value = data.total || 0;
    if (tab.value === "batches") {
      batchTrend.value = data.trend || [];
      longCostMs.value = Number(data.long_cost_ms || 60000);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : "采集监控加载失败";
  } finally {
    loading.value = false;
  }
}

function changeTab(next: Tab) {
  tab.value = next;
  page.value = 1;
  filters.value.status = "";
  batchTrend.value = [];
  load();
}

function search() { page.value = 1; load(); }
function reset() {
  filters.value = { keyword: "", region: "", room: "", device_model: "", status: "", source: "", result: "" };
  page.value = 1;
  load();
}
function gotoPage(next: number) { page.value = Math.max(1, Math.min(pages.value, next)); load(); }
function taskLabel(value: string) {
  return ({ onu_local: "本地 ONU 采集", onu_external: "外部 ONU 同步", olt_performance: "OLT 性能采集", cmts_local: "本地 CMTS 采集", cmts_external: "外部 CMTS 同步" } as Record<string, string>)[value] || value;
}
function regionLabel(value: string) { return ({ chengbei: "城北", chengdong: "城东", chengnan: "城南", chengxi: "城西", gaochun: "高淳", jiangning: "江宁", lishui: "溧水", liuhe: "六合", pukou: "浦口", qixia: "栖霞", yuhua: "雨花" } as Record<string,string>)[value] || value || "-"; }
function sourceLabel(row: any) { return row.external_database ? `外部同步 · ${row.external_database}` : "本地 SNMP"; }
function resultLabel(row: any) { return row.last_result_status === "success" || (row.is_ping && row.is_snmp && !row.fail_reason) ? "成功" : row.last_result_status === "missing" ? "未采集" : "失败"; }
function fmtMs(value: unknown) { return value === null || value === undefined ? "-" : `${value} ms`; }
function fmtDuration(value: unknown) {
  const ms = Number(value || 0);
  if (!Number.isFinite(ms) || ms < 0) return "-";
  if (ms < 1000) return `${ms} ms`;
  const seconds = Math.round(ms / 1000);
  return seconds >= 60 ? `${Math.floor(seconds / 60)}分${seconds % 60}秒` : `${seconds} 秒`;
}
function batchLabel(value: unknown) {
  const text = String(value || "");
  return /^\d{10}$/.test(text) ? `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)} ${text.slice(8, 10)}:00` : text || "-";
}

let batchRefreshTimer: number | undefined;
function refreshBatchPeriodically() {
  window.clearInterval(batchRefreshTimer);
  batchRefreshTimer = window.setInterval(() => {
    if (tab.value === "batches" && !loading.value) load();
  }, 30000);
}

onMounted(async () => {
  try { options.value = await api<Options>("/olt/device-options"); } catch { /* filters remain usable */ }
  load();
  refreshBatchPeriodically();
});

onBeforeUnmount(() => window.clearInterval(batchRefreshTimer));
</script>

<template>
  <div class="manage-page">
    <section class="manage-hero card card-pad">
      <div><div class="eyebrow">采集运行中心</div><h1>采集监控</h1><p>任务、外部同步、单台 OLT 与历史结果统一查看，采集状态只在这里维护。</p></div>
      <button class="btn btn-secondary" :disabled="loading" @click="load">刷新</button>
    </section>

    <section class="manage-tabs card">
      <button v-for="item in tabs" :key="item.key" :class="{ active: tab === item.key }" @click="changeTab(item.key)">
        <strong>{{ item.label }}</strong><span>{{ item.desc }}</span>
      </button>
    </section>

    <section class="card manage-filter">
      <div class="manage-filter-grid">
        <template v-if="tab !== 'tasks'">
          <input v-model="filters.keyword" class="input" placeholder="设备名称 / IP" @keydown.enter="search" />
          <select v-model="filters.region" class="select"><option value="">全部区域</option><option v-for="v in options.regions" :key="v" :value="v">{{ regionLabel(v) }}</option></select>
          <select v-model="filters.room" class="select"><option value="">全部机房</option><option v-for="v in options.rooms" :key="v">{{ v }}</option></select>
          <select v-model="filters.device_model" class="select"><option value="">全部型号</option><option v-for="v in options.models" :key="v">{{ v }}</option></select>
        </template>
        <select v-if="tab === 'batches'" v-model.number="batchHours" class="select" @change="search">
          <option :value="6">近 6 小时</option><option :value="12">近 12 小时</option><option :value="24">近 24 小时</option><option :value="48">近 48 小时</option>
          <option :value="72">近 3 天</option><option :value="168">近 7 天</option><option :value="360">近 15 天</option><option :value="720">近 30 天</option>
        </select>
        <select v-if="tab !== 'tasks' && tab !== 'batches'" v-model="filters.status" class="select"><option value="">全部结果</option><option value="success">成功</option><option value="fail">失败</option><option v-if="tab === 'devices'" value="missing">未采集</option></select>
        <select v-if="tab === 'devices'" v-model="filters.source" class="select"><option value="">全部来源</option><option value="local">本地 SNMP</option><option value="external">外部同步</option></select>
        <div v-if="tab !== 'tasks'" class="manage-filter-actions"><button class="btn btn-primary" @click="search">查询</button><button class="btn btn-secondary" @click="reset">重置</button></div>
        <div v-else class="permission-note"><strong>任务自动刷新</strong><span>展示本地采集、外部同步和性能任务的最新一轮状态；点“刷新”获取当前进度。</span></div>
      </div>
    </section>

    <div v-if="error" class="quality-message error">{{ error }}</div>
    <section class="card table-card manage-table-card" :class="{ loading }">
      <div class="table-head"><div><h2>{{ tabs.find(item => item.key === tab)?.label }}</h2><p>共 {{ total }} 条</p></div><select v-model.number="size" class="select tiny-select" @change="gotoPage(1)"><option :value="20">20 条/页</option><option :value="50">50 条/页</option><option :value="100">100 条/页</option></select></div>
      <EmptyState v-if="!loading && !rows.length" title="暂无记录" description="请调整筛选条件后重新查询。" />

      <div v-else-if="tab === 'tasks'" class="task-monitor-grid">
        <article v-for="r in rows" :key="r.task_key" class="task-monitor-card">
          <div class="task-monitor-head"><div><strong>{{ taskLabel(r.task_key) }}</strong><span>{{ r.task_key }}</span></div><StatusTag :value="r.status || 'idle'" /></div>
          <div class="task-progress"><i :style="{ width: `${r.target_count ? Math.min(100, (Number(r.completed_count || 0) / Number(r.target_count)) * 100) : 0}%` }"></i></div>
          <div class="task-monitor-stats"><span>目标 <b>{{ r.target_count || 0 }}</b></span><span>成功 <b>{{ r.success_count || 0 }}</b></span><span>失败 <b>{{ r.fail_count || 0 }}</b></span><span>写入 <b>{{ r.power_rows || r.metric_rows || 0 }}</b></span></div>
          <p>{{ r.last_error || `最近完成：${r.last_finished_at || '-'}` }}</p>
          <div v-if="r.details?.length" class="task-source-list"><div v-for="d in r.details" :key="d.detail_key"><span>{{ d.detail_key }}</span><StatusTag :value="d.status" /><small>{{ d.completed_count || 0 }}/{{ d.target_count || 0 }} · {{ d.last_error || '正常' }}</small></div></div>
        </article>
      </div>

      <div v-else-if="tab === 'batches'" class="batch-monitor-body">
        <section class="batch-trend-panel">
          <div class="batch-trend-head"><div><h3>采集成功数量趋势</h3><p>按小时批次动态刷新，每 30 秒更新一次</p></div><span>超长阈值：单台 ≥ {{ fmtDuration(longCostMs) }}</span></div>
          <CollectionBatchTrendChart :points="batchTrend" />
        </section>
        <div class="table-wrap">
          <table class="data-table manage-data-table batch-data-table">
            <thead><tr><th>采集批次</th><th>开始 / 结束时间</th><th>批次跨时长</th><th>设备 / 采集次数</th><th>成功 / 失败</th><th>超长采集</th><th>最大单台耗时</th><th>来源</th></tr></thead>
            <tbody>
              <tr v-for="r in rows" :key="r.collect_batches">
                <td><strong>{{ batchLabel(r.collect_batches) }}</strong><div class="muted">{{ r.collect_batches }}</div></td>
                <td>{{ r.started_at || '-' }}<div class="muted">{{ r.finished_at || '-' }}</div></td>
                <td><strong :class="{ 'danger-text': Number(r.batch_cost_ms || 0) >= longCostMs }">{{ fmtDuration(r.batch_cost_ms) }}</strong></td>
                <td>{{ r.device_count || 0 }} 台<div class="muted">{{ r.total_count || 0 }} 次</div></td>
                <td><strong class="success-text">{{ r.success_count || 0 }}</strong> / <strong class="danger-text">{{ r.fail_count || 0 }}</strong></td>
                <td><span :class="{ 'danger-text': Number(r.long_count || 0) > 0 }">{{ r.long_count || 0 }} 台次</span></td>
                <td>{{ fmtDuration(r.max_cost_ms) }}</td>
                <td>{{ r.external_count ? `外部 ${r.external_count} 次` : '本地 SNMP' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-else class="table-wrap">
        <table class="data-table manage-data-table">
          <thead v-if="tab === 'devices'"><tr><th>OLT</th><th>区域 / 机房</th><th>来源</th><th>结果</th><th>Ping / SNMP</th><th>接口 / MAC / 光功率</th><th>耗时</th><th>完成时间</th></tr></thead>
          <thead v-else><tr><th>OLT</th><th>区域 / 机房</th><th>批次与来源</th><th>结果</th><th>接口 / MAC / 光功率</th><th>耗时</th><th>开始 / 完成</th></tr></thead>
          <tbody>
            <tr v-for="r in rows" :key="`${r.round_id || 'last'}-${r.olt_device_id}`">
              <td><strong>{{ r.name || `OLT ${r.olt_device_id}` }}</strong><div class="muted">{{ r.primary_ip || `ID ${r.olt_device_id}` }} · {{ r.device_model || '-' }}</div></td>
              <td>{{ regionLabel(r.region) }} / {{ r.room || '未分机房' }}</td>
              <template v-if="tab === 'devices'">
                <td><span class="source-badge" :class="{ external: r.external_database }">{{ sourceLabel(r) }}</span></td>
                <td><StatusTag :value="resultLabel(r)" /><div class="muted">{{ r.last_fail_reason || '-' }}</div></td>
                <td>{{ r.last_is_ping ? '通' : '断' }} / {{ r.last_is_snmp ? `正常 ${r.last_snmp_version || ''}` : '失败' }}</td>
                <td>{{ r.last_if_cnt || 0 }} / {{ r.last_mac_cnt || 0 }} / {{ r.last_power_cnt || 0 }}</td>
                <td>{{ fmtMs(r.last_total_cost_ms) }}<div class="muted">Ping {{ fmtMs(r.last_ping_cost_ms) }} · SNMP {{ fmtMs(r.last_snmp_cost_ms) }}</div></td>
                <td>{{ r.last_finished_at || '-' }}</td>
              </template>
              <template v-else>
                <td>{{ r.collect_batches || '-' }}<div class="muted">{{ r.external_database || '本地 SNMP' }}</div></td>
                <td><StatusTag :value="resultLabel(r)" /><div class="muted">{{ r.fail_reason || '-' }}</div></td>
                <td>{{ r.if_cnt || 0 }} / {{ r.mac_cnt || 0 }} / {{ r.power_cnt || 0 }}</td>
                <td>{{ fmtMs(r.total_cost_ms) }}</td>
                <td>{{ r.started_at || '-' }}<div class="muted">{{ r.finished_at || '-' }}</div></td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="total" class="pagination modern-pagination"><button class="btn btn-secondary" :disabled="page <= 1" @click="gotoPage(page - 1)">‹</button><span>第 {{ page }} / {{ pages }} 页</span><button class="btn btn-secondary" :disabled="page >= pages" @click="gotoPage(page + 1)">›</button></div>
    </section>
  </div>
</template>
