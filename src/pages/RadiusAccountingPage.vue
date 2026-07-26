<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ArrowDownAZ, ArrowDownToLine, ArrowUpFromLine, DatabaseZap, RefreshCw, Search, Users } from "lucide-vue-next";
import RadiusModuleTabs from "../components/RadiusModuleTabs.vue";
import RadiusTrendChart from "../components/RadiusTrendChart.vue";
import { loadRadiusAccounting, type RadiusRow } from "../services/radiusApi";

const hours = ref(24);
const summary = ref<RadiusRow>({});
const quality = ref<RadiusRow>({});
const coverage = ref<RadiusRow>({});
const traffic = ref<RadiusRow[]>([]);
const users = ref<RadiusRow[]>([]);
const error = ref("");
const keyword = ref("");
const sortOrder = ref<"desc" | "asc">("desc");
const page = ref(1);
const pageSize = ref(30);
const bytes = (value: unknown) => {
  let n = Number(value || 0);
  for (const unit of ["B", "KB", "MB", "GB", "TB"]) {
    if (n < 1024) return `${n.toFixed(unit === "B" ? 0 : 1)} ${unit}`;
    n /= 1024;
  }
  return `${n.toFixed(1)} PB`;
};
const observedDuration = computed(() => {
  const seconds = Number(coverage.value.observed_seconds || 0);
  if (seconds < 60) return "不足 1 分钟";
  if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟`;
  return `${(seconds / 3600).toFixed(1)} 小时`;
});
const filteredUsers = computed(() => {
  const term = keyword.value.trim().toLowerCase();
  const rows = term ? users.value.filter(row => String(row.username || "").toLowerCase().includes(term)) : users.value;
  return [...rows].sort((a, b) => sortOrder.value === "desc"
    ? Number(b.total_bytes || 0) - Number(a.total_bytes || 0)
    : Number(a.total_bytes || 0) - Number(b.total_bytes || 0));
});
const pageCount = computed(() => Math.max(1, Math.ceil(filteredUsers.value.length / pageSize.value)));
const visibleUsers = computed(() => filteredUsers.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value));
async function load() {
  error.value = "";
  try {
    const data = await loadRadiusAccounting(hours.value);
    summary.value = data.summary;
    quality.value = data.quality || {};
    coverage.value = data.coverage || {};
    traffic.value = data.traffic;
    users.value = data.top_users;
    page.value = 1;
  } catch (err) { error.value = err instanceof Error ? err.message : "加载失败"; }
}
function setHours(value: number) { hours.value = value; load(); }
onMounted(load);
</script>

<template>
  <div class="aiops-page radius-page">
    <section class="aiops-page-head">
      <div><span><ArrowDownToLine :size="15" /> Radius Accounting</span><h1>当前窗口的全网会话流量</h1><p>这里的上、下行是所选窗口内相邻 Accounting 快照的真实增量汇总，不是每户的累计计数器，也不是瞬时速率。</p></div>
      <div class="aiops-range"><button v-for="value in [1, 24, 168, 720]" :key="value" :class="{ active: hours === value }" @click="setHours(value)">{{ value === 168 ? "7 天" : value === 720 ? "30 天" : `${value}h` }}</button></div>
      <button class="btn btn-secondary" @click="load"><RefreshCw :size="15" />刷新</button>
    </section>
    <RadiusModuleTabs />
    <div v-if="error" class="aiops-notice error">{{ error }}</div>
    <div class="radius-accounting-note"><DatabaseZap :size="17" /><div><strong>当前统计覆盖 {{ observedDuration }}</strong><p>选定窗口：最近 {{ hours === 168 ? "7 天" : hours === 720 ? "30 天" : `${hours} 小时` }}；实际数据：{{ coverage.first_event_time || "-" }} 至 {{ coverage.last_event_time || "-" }}。采集启动前没有历史数据时，较大窗口不会虚构历史流量。</p></div></div>
    <section class="aiops-kpis aiops-kpis-compact">
      <article><span class="aiops-kpi-icon"><ArrowUpFromLine /></span><div><em>窗口上行总量</em><strong>{{ bytes(summary.input_bytes) }}</strong><small>全部 GDF 有效增量之和</small></div></article>
      <article><span class="aiops-kpi-icon green"><ArrowDownToLine /></span><div><em>窗口下行总量</em><strong>{{ bytes(summary.output_bytes) }}</strong><small>全部 GDF 有效增量之和</small></div></article>
      <article><span class="aiops-kpi-icon amber"><Users /></span><div><em>账号 / 会话</em><strong>{{ Number(summary.users || 0).toLocaleString() }}</strong><small>{{ Number(summary.sessions || 0).toLocaleString() }} 个会话</small></div></article>
      <article><span class="aiops-kpi-icon"><DatabaseZap /></span><div><em>有效增量记录</em><strong>{{ Number(quality.delta_records || 0).toLocaleString() }}</strong><small>回退 {{ quality.rollback_records || 0 }} 次</small></div></article>
    </section>
    <article class="card radius-chart-card"><header><div><h2>动态流量趋势</h2><p>10 分钟粒度；鼠标悬停可查看每个时间段的上、下行增量。</p></div></header><RadiusTrendChart :points="traffic" kind="traffic" /></article>
    <article class="card aiops-table-card radius-data-table-card">
      <header class="radius-card-head"><div><h2>GDF 窗口流量排行</h2><p>仅展示当前窗口的总增量；可检索、排序、分页，并进入一键查询核对拨号记录。</p></div><label class="radius-inline-search"><Search :size="15" /><input v-model="keyword" placeholder="筛选 GDF 账号" @input="page = 1" /></label></header>
      <div class="table-scroll"><table class="data-table"><thead><tr><th>账号</th><th>上行</th><th>下行</th><th>总流量</th><th>会话</th><th>上下载比</th><th>回退</th></tr></thead><tbody><tr v-for="row in visibleUsers" :key="String(row.username)"><td><RouterLink class="radius-account-link" :to="{ path: '/radius', query: { keyword: row.username } }">{{ row.username }}</RouterLink></td><td>{{ bytes(row.input_bytes) }}</td><td>{{ bytes(row.output_bytes) }}</td><td><strong>{{ bytes(row.total_bytes) }}</strong></td><td>{{ row.sessions }}</td><td>{{ row.upload_ratio }}</td><td>{{ row.rollbacks }}</td></tr><tr v-if="!visibleUsers.length"><td colspan="7" class="radius-empty">当前筛选没有账号流量记录</td></tr></tbody></table></div>
      <footer class="radius-pager"><span>已加载前 {{ users.length }} 条，匹配 {{ filteredUsers.length }} 条</span><button class="btn btn-secondary" @click="sortOrder = sortOrder === 'desc' ? 'asc' : 'desc'"><ArrowDownAZ :size="14" />{{ sortOrder === "desc" ? "流量从高到低" : "流量从低到高" }}</button><select v-model="pageSize" @change="page = 1"><option :value="20">20 条/页</option><option :value="30">30 条/页</option><option :value="50">50 条/页</option></select><button class="btn btn-secondary" :disabled="page <= 1" @click="page--">上一页</button><b>{{ page }} / {{ pageCount }}</b><button class="btn btn-secondary" :disabled="page >= pageCount" @click="page++">下一页</button></footer>
    </article>
  </div>
</template>
