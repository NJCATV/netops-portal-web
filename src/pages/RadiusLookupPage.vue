<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Activity, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, CheckCircle2,
  CircleGauge, Clock3, Network, RefreshCw, Search, ShieldCheck, Smartphone, UserRound
} from "lucide-vue-next";
import EmptyState from "../components/EmptyState.vue";
import RadiusModuleTabs from "../components/RadiusModuleTabs.vue";
import RadiusTrendChart from "../components/RadiusTrendChart.vue";
import { loadRadiusProfile, type RadiusProfile } from "../services/radiusApi";

const route = useRoute();
const router = useRouter();
const keyword = ref("");
const loading = ref(false);
const error = ref("");
const profile = ref<RadiusProfile | null>(null);
const activeDetail = ref<"sessions" | "records" | "relations">("sessions");

const bytes = (value: unknown) => {
  let n = Number(value || 0);
  for (const unit of ["B", "KB", "MB", "GB", "TB"]) {
    if (n < 1024) return `${n.toFixed(unit === "B" ? 0 : 1)} ${unit}`;
    n /= 1024;
  }
  return `${n.toFixed(1)} PB`;
};
const duration = (value: unknown) => {
  const seconds = Number(value || 0);
  if (seconds < 60) return `${seconds} 秒`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟`;
  return `${(seconds / 3600).toFixed(1)} 小时`;
};
const statusName = (value: unknown) => ({ 1: "上线", 2: "下线", 3: "在线更新" }[Number(value)] || `状态 ${value || "-"}`);
const resultName = (row: Record<string, unknown>) =>
  row.event_type === "auth" ? String(row.result || "-") : row.event_type === "control" ? String(row.result || "控制报文") : statusName(row.acct_status_type);
const recordTypeName = (row: Record<string, unknown>) =>
  row.event_type === "auth" ? "拨号认证" : row.event_type === "control" ? "控制报文" : "Accounting";
const acceptRate = computed(() => {
  const s = profile.value?.summary || {};
  return Number(s.auth_total) ? Number(s.accept_total || 0) / Number(s.auth_total) * 100 : 0;
});
const total24h = computed(() =>
  Number(profile.value?.summary.input_24h || 0) + Number(profile.value?.summary.output_24h || 0)
);
const primaryAccount = computed(() => profile.value?.identity.accounts?.[0] || "");
const primaryMac = computed(() => profile.value?.identity.macs?.[0] || "");
const onuLink = computed(() => primaryAccount.value
  ? { path: "/onu-search", query: { type: "account", keyword: primaryAccount.value } }
  : { path: "/onu-search", query: { type: "terminal_mac", keyword: primaryMac.value } });

async function search() {
  const value = keyword.value.trim();
  if (value.length < 4) {
    error.value = "请输入完整 GDF 账号或 MAC（至少 4 个字符）";
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    profile.value = await loadRadiusProfile(value);
    router.replace({ query: { keyword: value } });
  } catch (err) {
    error.value = err instanceof Error ? err.message : "查询失败";
    profile.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  keyword.value = String(route.query.keyword || "");
  if (keyword.value) search();
});
</script>

<template>
  <div class="aiops-page radius-page radius-lookup-page">
    <section class="radius-lookup-hero">
      <div>
        <span class="radius-lookup-eyebrow"><ShieldCheck :size="15" /> RADIUS 360° 用户画像</span>
        <h1>账号、终端、会话和问题，一次查清</h1>
        <p>输入 GDF 账号或 MAC，自动串联认证记录、Accounting 流量、在线会话、终端关系和异常线索。</p>
      </div>
    </section>

    <section class="card radius-lookup-query-card">
      <header>
        <div>
          <span>一键查询</span>
          <h2>输入账号或拨号终端 MAC</h2>
          <p>支持 GDF/GDC 业务账号，以及带分隔符或连续 12 位的完整终端 MAC。</p>
        </div>
      </header>
      <div class="radius-lookup-search">
        <Search :size="19" />
        <input v-model="keyword" placeholder="例如 GDF12345678 或 D4:4D:9F:DB:98:43" @keydown.enter="search" />
        <button class="btn btn-primary" :disabled="loading" @click="search">
          <RefreshCw v-if="loading" class="spin" :size="16" />
          <Search v-else :size="16" />{{ loading ? "分析中" : "一键查询" }}
        </button>
      </div>
    </section>

    <RadiusModuleTabs />
    <div v-if="error" class="aiops-notice error">{{ error }}</div>
    <EmptyState v-if="!profile && !loading" title="等待查询" description="支持 GDF/GDC 业务账号，以及有分隔符或无分隔符的完整 MAC。" />

    <template v-if="profile">
      <section class="radius-profile-head card">
        <div class="radius-profile-icon"><UserRound /></div>
        <div class="radius-profile-identity">
          <span>主账号</span>
          <h2>{{ primaryAccount || "未识别账号" }}</h2>
          <p>
            <Smartphone :size="13" /> {{ primaryMac || "未识别 MAC" }}
            <Network :size="13" /> 最近活动 {{ profile.identity.last_seen || "-" }}
          </p>
          <div class="radius-id-chips">
            <i v-for="account in profile.identity.accounts" :key="account">{{ account }}</i>
            <i v-for="mac in profile.identity.macs" :key="mac" class="mac">{{ mac }}</i>
          </div>
        </div>
        <div class="radius-health-ring" :class="profile.health.label">
          <strong>{{ profile.health.score }}</strong><span>健康分</span><em>{{ profile.health.label }}</em>
        </div>
        <RouterLink v-if="primaryAccount || primaryMac" class="btn btn-secondary" :to="onuLink">
          联查 FTTH ONU
        </RouterLink>
      </section>

      <section class="radius-lookup-kpis">
        <article class="card"><span><Activity /></span><div><small>认证成功率</small><strong>{{ acceptRate.toFixed(1) }}%</strong><em>{{ profile.summary.accept_total || 0 }} / {{ profile.summary.auth_total || 0 }}</em></div></article>
        <article class="card"><span class="green"><ArrowUpFromLine /></span><div><small>24h 上行</small><strong>{{ bytes(profile.summary.input_24h) }}</strong><em>流量计数已统一为字节</em></div></article>
        <article class="card"><span class="blue"><ArrowDownToLine /></span><div><small>24h 下行</small><strong>{{ bytes(profile.summary.output_24h) }}</strong><em>合计 {{ bytes(total24h) }}</em></div></article>
        <article class="card"><span class="amber"><Clock3 /></span><div><small>会话 / MAC</small><strong>{{ profile.summary.sessions || 0 }} / {{ profile.summary.mac_count || 0 }}</strong><em>{{ profile.summary.accounting_records || 0 }} 条计费记录</em></div></article>
      </section>

      <section class="radius-diagnosis-grid">
        <article class="card radius-issue-panel">
          <header><div><h2>智能问题诊断</h2><p>规则只给出线索，不把疑似流量模式直接判定为违规。</p></div><CircleGauge :size="21" /></header>
          <div class="radius-issue-list">
            <div v-for="issue in profile.issues" :key="issue.code" :class="issue.level">
              <CheckCircle2 v-if="issue.level === 'ok'" :size="18" />
              <AlertTriangle v-else :size="18" />
              <div><strong>{{ issue.title }}</strong><p>{{ issue.detail }}</p></div>
            </div>
          </div>
        </article>
        <article class="card radius-profile-facts">
          <header><h2>快速结论</h2></header>
          <dl>
            <div><dt>最近认证</dt><dd>{{ profile.summary.latest_auth_result || "-" }}<small>{{ profile.summary.latest_auth_reason || "无拒绝原因" }}</small></dd></div>
            <div><dt>认证时间</dt><dd>{{ profile.summary.latest_auth_time || "-" }}</dd></div>
            <div><dt>Accounting</dt><dd>{{ profile.summary.latest_accounting_time || "-" }}</dd></div>
            <div><dt>30 天流量</dt><dd>{{ bytes(Number(profile.summary.input_30d || 0) + Number(profile.summary.output_30d || 0)) }}</dd></div>
            <div><dt>NAS 数量</dt><dd>{{ profile.summary.nas_count || 0 }}</dd></div>
            <div><dt>计数器回退</dt><dd>{{ profile.summary.rollback_count || 0 }} 次</dd></div>
          </dl>
        </article>
      </section>

      <section v-if="profile.onu_consistency" class="card terminal-path-card">
        <div class="terminal-path-head">
          <div>
            <span>FTTH ONU 一致性核验</span>
            <h2>{{ profile.onu_consistency.status_label }}</h2>
            <p>拨号终端 {{ profile.onu_consistency.terminal_mac }} → GDF → BOSS 预期 ONU；实际 ONU 只有在 OLT MAC 表存在时才给出结论。</p>
          </div>
          <RouterLink class="btn btn-secondary" :to="{ path: '/onu-search', query: { type: 'terminal_mac', keyword: profile.onu_consistency.terminal_mac } }">
            查看完整定位链路
          </RouterLink>
        </div>
        <div class="terminal-path-note">
          <strong>{{ profile.onu_consistency.mapping_source.label }}</strong>
          <span>{{ profile.onu_consistency.mapping_source.freshness || "已使用可用 OLT 映射证据完成核验。" }}</span>
        </div>
      </section>

      <article class="card radius-chart-card">
        <header><div><h2>近 7 天逐小时流量</h2><p>按同一账号 + NAS + Session 的相邻累计计数器计算增量。</p></div></header>
        <RadiusTrendChart v-if="profile.flow.length" :points="profile.flow" kind="traffic" />
        <EmptyState v-else title="暂无可计算流量" description="首次看到的会话快照只建立基线，下一次 Interim-Update 后开始产生增量。" />
      </article>

      <article class="card aiops-table-card radius-profile-detail">
        <header class="radius-card-head radius-detail-head">
          <div><h2>关联明细</h2><p>会话、最近事件和账号-MAC 关系可交叉核对。</p></div>
        </header>
        <nav class="radius-detail-tabs" aria-label="关联明细类型">
          <button :class="{ active: activeDetail === 'sessions' }" @click="activeDetail = 'sessions'"><span>01</span><strong>会话汇总</strong><em>{{ profile.sessions.length }} 条</em></button>
          <button :class="{ active: activeDetail === 'records' }" @click="activeDetail = 'records'"><span>02</span><strong>拨号与会话记录</strong><em>{{ profile.records.length }} 条</em></button>
          <button :class="{ active: activeDetail === 'relations' }" @click="activeDetail = 'relations'"><span>03</span><strong>账号与终端关系</strong><em>{{ profile.associations.length }} 条</em></button>
        </nav>
        <div class="table-scroll">
          <table v-if="activeDetail === 'sessions'" class="data-table">
            <thead><tr><th>会话 / NAS</th><th>状态</th><th>终端 / IP</th><th>时长</th><th>上行 / 下行</th><th>最后活动</th></tr></thead>
            <tbody><tr v-for="row in profile.sessions" :key="`${row.acct_session_id}-${row.nas_ip}`"><td><strong>{{ row.acct_session_id }}</strong><small>{{ row.nas_ip }}</small></td><td>{{ statusName(row.latest_status) }}</td><td>{{ row.mac_addr || "-" }}<small>{{ row.framed_ip || "-" }}</small></td><td>{{ duration(row.session_seconds) }}</td><td>{{ bytes(row.input_bytes) }} / {{ bytes(row.output_bytes) }}</td><td>{{ row.last_seen }}</td></tr></tbody>
          </table>
          <table v-else-if="activeDetail === 'records'" class="data-table">
            <thead><tr><th>时间</th><th>类型 / 结果</th><th>账号</th><th>MAC / IP</th><th>NAS</th><th>流量增量</th><th>原因</th></tr></thead>
            <tbody><tr v-for="(row, index) in profile.records" :key="`${row.event_time}-${index}`"><td>{{ row.event_time }}</td><td><strong>{{ recordTypeName(row) }}</strong><small>{{ resultName(row) }}</small></td><td>{{ row.username }}</td><td>{{ row.mac_addr || "-" }}<small>{{ row.framed_ip || "-" }}</small></td><td>{{ row.nas_ip }}</td><td>{{ bytes(Number(row.input_delta || 0) + Number(row.output_delta || 0)) }}</td><td>{{ row.reason_zh || (Number(row.counter_rollback) ? "计数器回退" : "-") }}</td></tr></tbody>
          </table>
          <table v-else class="data-table">
            <thead><tr><th>账号</th><th>拨号终端 MAC</th><th>成功 / 拒绝 / Accounting</th><th>30 天流量</th><th>最后活动</th></tr></thead>
            <tbody><tr v-for="row in profile.associations" :key="`${row.username}-${row.mac_addr}`"><td><strong>{{ row.username }}</strong></td><td><RouterLink class="radius-account-link" :to="{ path: '/onu-search', query: { type: 'terminal_mac', keyword: row.mac_addr } }">{{ row.mac_addr }}</RouterLink></td><td>{{ row.accept_count }} / {{ row.reject_count }} / {{ row.accounting_count }}</td><td>{{ bytes(row.traffic_bytes) }}</td><td>{{ row.last_seen }}</td></tr></tbody>
          </table>
        </div>
      </article>
    </template>
  </div>
</template>
