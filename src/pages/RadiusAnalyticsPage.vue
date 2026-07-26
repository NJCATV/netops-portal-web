<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Activity, BarChart3, Power, RefreshCw, RotateCcw, TrendingUp } from "lucide-vue-next";
import RadiusModuleTabs from "../components/RadiusModuleTabs.vue";
import RadiusBarChart from "../components/RadiusBarChart.vue";
import { loadRadiusAnalytics, type RadiusRow } from "../services/radiusApi";

const hours = ref(24);
const reasons = ref<RadiusRow[]>([]);
const nas = ref<RadiusRow[]>([]);
const reconnects = ref<RadiusRow[]>([]);
const traffic = ref<RadiusRow[]>([]);
const trafficRules = ref<RadiusRow>({});
const online = ref<RadiusRow[]>([]);
const terminates = ref<RadiusRow[]>([]);
const nasRestarts = ref<RadiusRow[]>([]);
const controls = ref<RadiusRow[]>([]);
const protocolQuality = ref<RadiusRow>({});
const terminalSharing = ref<RadiusRow[]>([]);
const ipConflicts = ref<RadiusRow[]>([]);
const error = ref("");
const section = ref<"auth" | "session" | "traffic">("auth");
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
async function load() {
  error.value = "";
  try {
    const data = await loadRadiusAnalytics(hours.value);
    reasons.value = data.reasons;
    nas.value = data.nas;
    reconnects.value = data.reconnects || [];
    traffic.value = data.traffic_patterns || [];
    trafficRules.value = data.traffic_rules || {};
    online.value = data.online_sessions || [];
    terminates.value = data.terminate_causes || [];
    nasRestarts.value = data.nas_restarts || [];
    controls.value = data.control_events || [];
    protocolQuality.value = data.protocol_quality || {};
    terminalSharing.value = data.terminal_sharing || [];
    ipConflicts.value = data.ip_conflicts || [];
  } catch (err) {
    error.value = err instanceof Error ? err.message : "加载失败";
  }
}
onMounted(load);
</script>

<template>
  <div class="aiops-page radius-page">
    <section class="aiops-page-head">
      <div><span><BarChart3 :size="15" /> Radius 深度分析</span><h1>认证与会话健康分析</h1><p>覆盖拒绝原因、NAS 健康、在线会话、频繁重连、下线原因和流量异常观察；全网流量总览请使用 Accounting 页面。</p></div>
      <div class="aiops-range"><button v-for="value in [1, 24, 168, 720]" :key="value" :class="{ active: hours === value }" @click="hours = value; load()">{{ value }}h</button></div>
      <button class="btn btn-secondary" @click="load"><RefreshCw :size="15" />刷新</button>
    </section>
    <RadiusModuleTabs />
    <div v-if="error" class="aiops-notice error">{{ error }}</div>
    <section class="radius-analysis-kpis">
      <article class="card"><Activity /><div><small>在线活跃会话</small><strong>{{ online.length }}</strong><em>最近 15 分钟有 Start/Interim</em></div></article>
      <article class="card"><RotateCcw /><div><small>频繁重连账号</small><strong>{{ reconnects.length }}</strong><em>窗口内 Start ≥ 3</em></div></article>
      <article class="card"><TrendingUp /><div><small>异常流量账号</small><strong>{{ traffic.length }}</strong><em>当前窗口全部规则命中账号</em></div></article>
      <article class="card"><Power /><div><small>下线原因类型</small><strong>{{ terminates.length }}</strong><em>Accounting Stop 终止原因</em></div></article>
      <article class="card"><Power /><div><small>NAS 上下线事件</small><strong>{{ protocolQuality.nas_restart_events || 0 }}</strong><em>Accounting-On / Off</em></div></article>
      <article class="card"><Activity /><div><small>CoA / Disconnect</small><strong>{{ protocolQuality.control_packets || 0 }}</strong><em>NAK {{ protocolQuality.control_naks || 0 }} · 只读观察</em></div></article>
    </section>
    <nav class="radius-analysis-switch">
      <button :class="{ active: section === 'auth' }" @click="section = 'auth'">认证与 NAS</button>
      <button :class="{ active: section === 'session' }" @click="section = 'session'">会话与重连</button>
      <button :class="{ active: section === 'traffic' }" @click="section = 'traffic'">流量异常观察</button>
    </nav>
    <section v-if="section === 'auth'" class="radius-two-grid">
      <article class="card radius-chart-card"><header><div><h2>认证拒绝原因动态分布</h2><p>按当前窗口聚合，点击刷新后动态图随数据更新。</p></div></header><RadiusBarChart :items="reasons" label-key="name" value-key="value" color="#ef4444" /></article>
      <article class="card radius-chart-card"><header><div><h2>NAS 认证负载动态分布</h2><p>展示当前窗口认证总量最高的 NAS。</p></div></header><RadiusBarChart :items="nas" label-key="nas_ip" value-key="total" color="#2563eb" /></article>
      <article class="card aiops-table-card"><header class="radius-card-head"><h2>NAS 认证分布</h2></header><div class="table-scroll"><table class="data-table"><thead><tr><th>NAS</th><th>总量</th><th>通过</th><th>拒绝</th><th>拒绝率</th></tr></thead><tbody><tr v-for="row in nas" :key="String(row.nas_ip)"><td>{{ row.nas_ip }}</td><td>{{ row.total }}</td><td>{{ row.accepts }}</td><td>{{ row.rejects }}</td><td>{{ row.reject_rate }}%</td></tr></tbody></table></div></article>
      <article class="card aiops-table-card"><header class="radius-card-head"><div><h2>NAS 上下线 / 重启证据</h2><p>Accounting-On/Off 往往意味着 NAS 重启或计费状态重置。</p></div></header><div class="table-scroll"><table class="data-table"><thead><tr><th>NAS</th><th>事件</th><th>次数</th><th>最近时间</th></tr></thead><tbody><tr v-for="row in nasRestarts" :key="`${row.nas_ip}-${row.acct_status_type}`"><td>{{ row.nas_ip || "-" }}</td><td>{{ row.event_name }}</td><td>{{ row.value }}</td><td>{{ row.last_seen }}</td></tr><tr v-if="!nasRestarts.length"><td colspan="4" class="radius-empty">当前窗口未发现 NAS 上下线事件</td></tr></tbody></table></div></article>
      <article class="card aiops-table-card"><header class="radius-card-head"><div><h2>动态授权控制报文</h2><p>被动观测 UDP 3799 的 CoA/Disconnect，不从网管发起控制。</p></div></header><div class="table-scroll"><table class="data-table"><thead><tr><th>时间</th><th>动作</th><th>账号 / MAC</th><th>NAS</th><th>Error-Cause</th></tr></thead><tbody><tr v-for="(row,index) in controls" :key="`${row.event_time}-${index}`"><td>{{ row.event_time }}</td><td>{{ row.result }}</td><td>{{ row.username || "-" }}<small>{{ row.mac_addr }}</small></td><td>{{ row.nas_ip || row.dst_ip || "-" }}</td><td>{{ row.error_cause || "-" }}</td></tr><tr v-if="!controls.length"><td colspan="5" class="radius-empty">当前窗口未发现控制报文</td></tr></tbody></table></div></article>
    </section>
    <section v-else-if="section === 'session'" class="radius-two-grid">
      <article class="card aiops-table-card"><header class="radius-card-head"><div><h2>频繁重连账号</h2><p>点击账号进入一键诊断。</p></div></header><div class="table-scroll"><table class="data-table"><thead><tr><th>账号</th><th>Start</th><th>MAC</th><th>NAS</th><th>最后活动</th></tr></thead><tbody><tr v-for="row in reconnects" :key="String(row.username)"><td><RouterLink class="radius-account-link" :to="{ path: '/radius/search', query: { keyword: row.username } }">{{ row.username }}</RouterLink></td><td>{{ row.start_count }}</td><td>{{ row.mac_count }}</td><td>{{ row.nas_count }}</td><td>{{ row.last_seen }}</td></tr></tbody></table></div></article>
      <article class="card aiops-table-card"><header class="radius-card-head"><h2>当前活跃会话</h2></header><div class="table-scroll"><table class="data-table"><thead><tr><th>账号</th><th>MAC / IP</th><th>NAS</th><th>时长</th><th>最后活动</th></tr></thead><tbody><tr v-for="row in online" :key="`${row.acct_session_id}-${row.nas_ip}`"><td><RouterLink class="radius-account-link" :to="{ path: '/radius/search', query: { keyword: row.username } }">{{ row.username }}</RouterLink></td><td>{{ row.mac_addr }}<small>{{ row.framed_ip }}</small></td><td>{{ row.nas_ip }}</td><td>{{ Math.round(Number(row.session_seconds || 0) / 60) }} 分钟</td><td>{{ row.last_seen }}</td></tr></tbody></table></div></article>
      <article class="card aiops-table-card radius-terminate-card"><header class="radius-card-head"><h2>下线原因</h2></header><div class="radius-terminate-list"><div v-for="row in terminates" :key="String(row.terminate_cause)"><span>{{ row.name }}</span><strong>{{ Number(row.value || 0).toLocaleString() }}</strong></div></div></article>
      <article class="card aiops-table-card"><header class="radius-card-head"><div><h2>同一终端关联多个成功账号</h2><p>只使用 Access-Accept / Accounting 建立关系，拒绝尝试不计入。</p></div></header><div class="table-scroll"><table class="data-table"><thead><tr><th>拨号终端 MAC</th><th>账号数</th><th>账号</th><th>NAS 数</th><th>最后活动</th></tr></thead><tbody><tr v-for="row in terminalSharing" :key="String(row.mac_addr)"><td><RouterLink class="radius-account-link" :to="{ path: '/onu-search', query: { type: 'terminal_mac', keyword: row.mac_addr } }">{{ row.mac_addr }}</RouterLink></td><td>{{ row.account_count }}</td><td>{{ row.accounts }}</td><td>{{ row.nas_count }}</td><td>{{ row.last_seen }}</td></tr><tr v-if="!terminalSharing.length"><td colspan="5" class="radius-empty">当前窗口未发现可信的终端多账号关系</td></tr></tbody></table></div></article>
      <article class="card aiops-table-card"><header class="radius-card-head"><div><h2>Framed-IP 近实时多账号冲突</h2><p>只看最近 15 分钟，减少动态地址先后复用造成的误报；仍需结合在线会话复核。</p></div></header><div class="table-scroll"><table class="data-table"><thead><tr><th>Framed-IP</th><th>账号数</th><th>账号</th><th>MAC / NAS</th><th>最后活动</th></tr></thead><tbody><tr v-for="row in ipConflicts" :key="String(row.framed_ip)"><td>{{ row.framed_ip }}</td><td>{{ row.account_count }}</td><td>{{ row.accounts }}</td><td>{{ row.mac_count }} / {{ row.nas_count }}</td><td>{{ row.last_seen }}</td></tr><tr v-if="!ipConflicts.length"><td colspan="5" class="radius-empty">最近 15 分钟未发现 IP 多账号冲突</td></tr></tbody></table></div></article>
    </section>
    <article v-else class="card aiops-table-card">
      <header class="radius-card-head"><div><h2>异常流量账号</h2><p>{{ windowLabel }}内的全部规则命中账号，不再截取流量前 100。规则：总流量 ≥ {{ bytes(trafficRules.heavy_volume_bytes) }}，或上行 ≥ {{ bytes(trafficRules.upload_bytes) }} 且上/下行比 ≥ {{ trafficRules.upload_ratio || 4 }}。</p></div></header>
      <div class="table-scroll"><table class="data-table"><thead><tr><th>账号</th><th>窗口上行</th><th>窗口下行</th><th>窗口合计</th><th>上/下行比</th><th>会话</th><th>命中规则</th></tr></thead><tbody><tr v-for="row in traffic" :key="String(row.username)"><td><RouterLink class="radius-account-link" :to="{ path: '/radius', query: { keyword: row.username } }">{{ row.username }}</RouterLink></td><td>{{ bytes(row.input_bytes) }}</td><td>{{ bytes(row.output_bytes) }}</td><td><strong>{{ bytes(row.total_bytes) }}</strong></td><td>{{ row.upload_ratio }}</td><td>{{ row.sessions }}</td><td><span class="radius-observe-tag">{{ trafficReason(row) }}</span></td></tr><tr v-if="!traffic.length"><td colspan="7" class="radius-empty">当前窗口没有账号命中流量异常规则</td></tr></tbody></table></div>
    </article>
  </div>
</template>
