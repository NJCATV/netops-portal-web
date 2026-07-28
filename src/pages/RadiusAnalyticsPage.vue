<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { Activity, BarChart3, Power, RefreshCw, RotateCcw, TrendingUp } from "lucide-vue-next";
import RadiusModuleTabs from "../components/RadiusModuleTabs.vue";
import RadiusBarChart from "../components/RadiusBarChart.vue";
import { readApiSnapshot } from "../services/api";
import { loadRadiusAnalytics, type RadiusRow } from "../services/radiusApi";

const props = defineProps<{ section: "auth" | "session" }>();
const hours = ref(24);
const reasons = ref<RadiusRow[]>([]);
const nas = ref<RadiusRow[]>([]);
const reconnects = ref<RadiusRow[]>([]);
const traffic = ref<RadiusRow[]>([]);
const trafficRules = ref<RadiusRow>({});
const online = ref<RadiusRow[]>([]);
const terminates = ref<RadiusRow[]>([]);
const controls = ref<RadiusRow[]>([]);
const protocolQuality = ref<RadiusRow>({});
const terminalSharing = ref<RadiusRow[]>([]);
const ipConflicts = ref<RadiusRow[]>([]);
const sessionSummary = ref<RadiusRow>({});
const error = ref("");
const loading = ref(false);
const section = computed(() => props.section);
const isAuth = computed(() => section.value === "auth");
const authTotal = computed(() => nas.value.reduce((sum, row) => sum + Number(row.total || 0), 0));
const authAccepts = computed(() => nas.value.reduce((sum, row) => sum + Number(row.accepts || 0), 0));
const authRejects = computed(() => nas.value.reduce((sum, row) => sum + Number(row.rejects || 0), 0));
const authAcceptRate = computed(() => authTotal.value ? authAccepts.value / authTotal.value * 100 : 0);
const topRejectReason = computed(() => String(reasons.value[0]?.name || "暂无拒绝"));
const nasAssessment = (row: RadiusRow) => {
  const total = Number(row.total || 0);
  const rate = Number(row.reject_rate || 0);
  if (total >= 100 && rate >= 50) return "优先排查";
  if (rate >= 20) return "持续观察";
  return "正常观察";
};
const bytes = (value: unknown) => {
  let n = Number(value || 0);
  for (const unit of ["B", "KB", "MB", "GB", "TB"]) {
    if (n < 1024) return `${n.toFixed(unit === "B" ? 0 : 1)} ${unit}`;
    n /= 1024;
  }
  return `${n.toFixed(1)} PB`;
};
const windowLabel = computed(() => hours.value === 1 ? "近 1 小时" : hours.value === 24 ? "近 24 小时" : hours.value === 168 ? "近 7 天" : "近 30 天");
const trafficReason = (row: RadiusRow) => [
  Number(row.heavy_volume) ? "窗口总量偏高" : "",
  Number(row.high_upload) ? "高上行结构" : "",
].filter(Boolean).join("、");
function applyData(data: Awaited<ReturnType<typeof loadRadiusAnalytics>>) {
  reasons.value = data.reasons || [];
  nas.value = data.nas || [];
  reconnects.value = data.reconnects || [];
  traffic.value = data.traffic_patterns || [];
  trafficRules.value = data.traffic_rules || {};
  online.value = data.online_sessions || [];
  terminates.value = data.terminate_causes || [];
  controls.value = data.control_events || [];
  protocolQuality.value = data.protocol_quality || {};
  terminalSharing.value = data.terminal_sharing || [];
  ipConflicts.value = data.ip_conflicts || [];
  sessionSummary.value = data.summary || {};
}
function resetData() {
  reasons.value = [];
  nas.value = [];
  reconnects.value = [];
  traffic.value = [];
  trafficRules.value = {};
  online.value = [];
  terminates.value = [];
  controls.value = [];
  protocolQuality.value = {};
  terminalSharing.value = [];
  ipConflicts.value = [];
  sessionSummary.value = {};
}
async function load(quiet = false) {
  if (!quiet) loading.value = true;
  error.value = "";
  try {
    const data = await loadRadiusAnalytics(hours.value, props.section);
    applyData(data);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "加载失败";
  } finally { loading.value = false; }
}
function loadCurrentSection() {
  const cached = readApiSnapshot<Awaited<ReturnType<typeof loadRadiusAnalytics>>>(
    `radius:analytics:v2:${props.section}:${hours.value}`,
  );
  if (cached) {
    applyData(cached);
    loading.value = false;
  } else {
    resetData();
  }
  void load(Boolean(cached));
}
onMounted(loadCurrentSection);
// Both routes render this same component. Vue reuses the component instance
// when an operator switches tabs, so onMounted alone leaves the new section
// showing empty refs until a full browser refresh.
watch(() => props.section, loadCurrentSection);
</script>

<template>
  <div class="aiops-page radius-page" :class="{ loading }">
    <section class="aiops-page-head">
      <div><span><BarChart3 :size="15" /> Radius 专项分析</span><h1>{{ isAuth ? "认证与 NAS 分析" : "会话与重连分析" }}</h1><p>{{ isAuth ? "聚焦认证拒绝、NAS 认证负载和被动观测的控制报文。" : "聚焦在线会话、频繁重连、下线原因与终端关联。" }}</p></div>
      <div class="aiops-range"><button v-for="value in [1, 24, 168, 720]" :key="value" :class="{ active: hours === value }" @click="hours = value; load()">{{ value }}h</button></div>
      <button class="btn btn-secondary" @click="load()"><RefreshCw :size="15" />刷新</button>
    </section>
    <RadiusModuleTabs />
    <div v-if="loading" class="aiops-notice">正在读取 Radius 汇总快照…</div>
    <div v-if="error" class="aiops-notice error">{{ error }}</div>
    <section class="radius-analysis-kpis" v-if="section === 'auth'">
      <article class="card"><Activity /><div><small>认证请求</small><strong>{{ authTotal.toLocaleString() }}</strong><em>{{ nas.length }} 台 NAS 产生认证报文</em></div></article>
      <article class="card"><Power /><div><small>认证通过率</small><strong>{{ authAcceptRate.toFixed(1) }}%</strong><em>通过 {{ authAccepts.toLocaleString() }} · 拒绝 {{ authRejects.toLocaleString() }}</em></div></article>
      <article class="card"><Activity /><div><small>首要拒绝原因</small><strong class="radius-kpi-text">{{ topRejectReason }}</strong><em>优先处理高频且影响 NAS 较多的原因</em></div></article>
      <article class="card"><Activity /><div><small>CoA / Disconnect</small><strong>{{ controls.length }}</strong><em>被动观测 UDP 3799 控制报文</em></div></article>
    </section>
    <section class="radius-analysis-kpis" v-else>
      <article class="card"><Activity /><div><small>近期活跃会话</small><strong>{{ online.length }}</strong><em>最近 60 分钟有 Start/Interim，非严格在线数</em></div></article>
      <article class="card"><RotateCcw /><div><small>频繁重连账号</small><strong>{{ reconnects.length }}</strong><em>窗口内 Start ≥ 3</em></div></article>
      <article class="card"><Power /><div><small>下线记录</small><strong>{{ Number(sessionSummary.stop_records || 0).toLocaleString() }}</strong><em>{{ sessionSummary.top_terminate_cause || "当前窗口暂无 Stop" }}</em></div></article>
      <article class="card"><Activity /><div><small>终端多账号关联</small><strong>{{ terminalSharing.length }}</strong><em>可信终端关联多个成功账号</em></div></article>
    </section>
    <section v-if="section === 'auth'" class="radius-two-grid">
      <article class="card radius-chart-card"><header><div><h2>认证拒绝原因动态分布</h2><p>按当前窗口聚合，点击刷新后动态图随数据更新。</p></div></header><RadiusBarChart :items="reasons" label-key="name" value-key="value" color="#ef4444" /></article>
      <article class="card radius-chart-card"><header><div><h2>NAS 认证负载动态分布</h2><p>展示当前窗口认证总量最高的 NAS。</p></div></header><RadiusBarChart :items="nas" label-key="nas_ip" value-key="total" color="#2563eb" /></article>
      <article class="card aiops-table-card"><header class="radius-card-head"><div><h2>NAS 认证处置优先级</h2><p>先看请求量，再看拒绝率；高拒绝率但样本很少的 NAS 不应直接判为故障。</p></div></header><div class="table-scroll"><table class="data-table"><thead><tr><th>NAS</th><th>请求</th><th>通过</th><th>拒绝</th><th>拒绝率</th><th>建议</th></tr></thead><tbody><tr v-for="row in nas" :key="String(row.nas_ip)"><td>{{ row.nas_ip }}</td><td>{{ row.total }}</td><td>{{ row.accepts }}</td><td>{{ row.rejects }}</td><td>{{ row.reject_rate }}%</td><td><span class="radius-observe-tag">{{ nasAssessment(row) }}</span></td></tr></tbody></table></div></article>
      <article class="card aiops-table-card"><header class="radius-card-head"><div><h2>动态授权控制报文</h2><p>被动观测 UDP 3799 的 CoA/Disconnect，不从网管发起控制。</p></div></header><div class="table-scroll"><table class="data-table"><thead><tr><th>时间</th><th>动作</th><th>账号 / MAC</th><th>NAS</th><th>Error-Cause</th></tr></thead><tbody><tr v-for="(row,index) in controls" :key="`${row.event_time}-${index}`"><td>{{ row.event_time }}</td><td>{{ row.result }}</td><td>{{ row.username || "-" }}<small>{{ row.mac_addr }}</small></td><td>{{ row.nas_ip || row.dst_ip || "-" }}</td><td>{{ row.error_cause || "-" }}</td></tr><tr v-if="!controls.length"><td colspan="5" class="radius-empty">当前窗口未发现控制报文</td></tr></tbody></table></div></article>
    </section>
    <section v-else-if="section === 'session'" class="radius-two-grid">
      <article class="card aiops-table-card"><header class="radius-card-head"><div><h2>频繁重连账号</h2><p>Start 次数高通常表示链路不稳、终端反复拨号或 NAS 会话异常；点击账号进入一键诊断。</p></div></header><div class="table-scroll"><table class="data-table"><thead><tr><th>账号</th><th>Start</th><th>MAC</th><th>NAS</th><th>最后活动</th></tr></thead><tbody><tr v-for="row in reconnects" :key="String(row.username)"><td><RouterLink class="radius-account-link" :to="{ path: '/radius/search', query: { keyword: row.username } }">{{ row.username }}</RouterLink></td><td>{{ row.start_count }}</td><td>{{ row.mac_count }}</td><td>{{ row.nas_count }}</td><td>{{ row.last_seen }}</td></tr><tr v-if="!reconnects.length"><td colspan="5" class="radius-empty">当前窗口没有 Start ≥ 3 的频繁重连账号。</td></tr></tbody></table></div></article>
      <article class="card aiops-table-card"><header class="radius-card-head"><div><h2>近期活跃会话</h2><p>用于定位最近仍有计费活动的会话；因镜像采样与 Stop 丢包，不作为精确在线人数。</p></div></header><div class="table-scroll"><table class="data-table"><thead><tr><th>账号</th><th>MAC / IP</th><th>NAS</th><th>时长</th><th>最后活动</th></tr></thead><tbody><tr v-for="row in online" :key="`${row.acct_session_id}-${row.nas_ip}`"><td><RouterLink class="radius-account-link" :to="{ path: '/radius/search', query: { keyword: row.username } }">{{ row.username }}</RouterLink></td><td>{{ row.mac_addr }}<small>{{ row.framed_ip }}</small></td><td>{{ row.nas_ip }}</td><td>{{ Math.round(Number(row.session_seconds || 0) / 60) }} 分钟</td><td>{{ row.last_seen }}</td></tr><tr v-if="!online.length"><td colspan="5" class="radius-empty">最近 60 分钟没有可确认的 Start/Interim 活跃会话。</td></tr></tbody></table></div></article>
      <article class="card aiops-table-card radius-terminate-card"><header class="radius-card-head"><div><h2>下线原因</h2><p>数字为 Accounting Stop 记录数；括号内保留协议代码，便于与 NAS 日志核对。</p></div></header><div class="radius-terminate-list"><div v-for="row in terminates" :key="String(row.terminate_cause)"><span>{{ row.name }}</span><strong>{{ Number(row.value || 0).toLocaleString() }}</strong></div><div v-if="!terminates.length" class="radius-empty">当前窗口没有 Accounting Stop 下线记录。</div></div></article>
      <article class="card aiops-table-card"><header class="radius-card-head"><div><h2>同一终端关联多个成功账号</h2><p>只使用 Access-Accept / Accounting 建立关系，拒绝尝试不计入。</p></div></header><div class="table-scroll"><table class="data-table"><thead><tr><th>拨号终端 MAC</th><th>账号数</th><th>账号</th><th>NAS 数</th><th>最后活动</th></tr></thead><tbody><tr v-for="row in terminalSharing" :key="String(row.mac_addr)"><td><RouterLink class="radius-account-link" :to="{ path: '/onu-search', query: { type: 'terminal_mac', keyword: row.mac_addr } }">{{ row.mac_addr }}</RouterLink></td><td>{{ row.account_count }}</td><td>{{ row.accounts }}</td><td>{{ row.nas_count }}</td><td>{{ row.last_seen }}</td></tr><tr v-if="!terminalSharing.length"><td colspan="5" class="radius-empty">当前窗口未发现可信的终端多账号关系</td></tr></tbody></table></div></article>
      <article class="card aiops-table-card"><header class="radius-card-head"><div><h2>Framed-IP 近实时多账号冲突</h2><p>只看最近 15 分钟，减少动态地址先后复用造成的误报；仍需结合在线会话复核。</p></div></header><div class="table-scroll"><table class="data-table"><thead><tr><th>Framed-IP</th><th>账号数</th><th>账号</th><th>MAC / NAS</th><th>最后活动</th></tr></thead><tbody><tr v-for="row in ipConflicts" :key="String(row.framed_ip)"><td>{{ row.framed_ip }}</td><td>{{ row.account_count }}</td><td>{{ row.accounts }}</td><td>{{ row.mac_count }} / {{ row.nas_count }}</td><td>{{ row.last_seen }}</td></tr><tr v-if="!ipConflicts.length"><td colspan="5" class="radius-empty">最近 15 分钟未发现 IP 多账号冲突</td></tr></tbody></table></div></article>
    </section>
    <article v-else-if="false" class="card aiops-table-card">
      <header class="radius-card-head"><div><h2>异常流量账号</h2><p>{{ windowLabel }}内的全部规则命中账号，不再截取流量前 100。规则：总流量 ≥ {{ bytes(trafficRules.heavy_volume_bytes) }}，或上行 ≥ {{ bytes(trafficRules.upload_bytes) }} 且上/下行比 ≥ {{ trafficRules.upload_ratio || 4 }}。</p></div></header>
      <div class="table-scroll"><table class="data-table"><thead><tr><th>账号</th><th>窗口上行</th><th>窗口下行</th><th>窗口合计</th><th>上/下行比</th><th>会话</th><th>命中规则</th></tr></thead><tbody><tr v-for="row in traffic" :key="String(row.username)"><td><RouterLink class="radius-account-link" :to="{ path: '/radius', query: { keyword: row.username } }">{{ row.username }}</RouterLink></td><td>{{ bytes(row.input_bytes) }}</td><td>{{ bytes(row.output_bytes) }}</td><td><strong>{{ bytes(row.total_bytes) }}</strong></td><td>{{ row.upload_ratio }}</td><td>{{ row.sessions }}</td><td><span class="radius-observe-tag">{{ trafficReason(row) }}</span></td></tr><tr v-if="!traffic.length"><td colspan="7" class="radius-empty">当前窗口没有账号命中流量异常规则</td></tr></tbody></table></div>
    </article>
  </div>
</template>
