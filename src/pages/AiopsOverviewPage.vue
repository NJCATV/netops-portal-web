<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Activity, Bot, BrainCircuit, Clock3, RadioTower, RefreshCw, ShieldCheck, Siren } from "lucide-vue-next";
import AiopsModuleTabs from "../components/AiopsModuleTabs.vue";
import { loadAiopsEvents, loadAiopsFreshness, loadAiopsOverview, type AiopsEvent, type AiopsOverview } from "../services/aiopsApi";

const hours = ref(24);
const loading = ref(false);
const error = ref("");
const overview = ref<AiopsOverview | null>(null);
const freshness = ref<Record<string, unknown>>({});
const events = ref<AiopsEvent[]>([]);

const selectedWindow = computed(() => overview.value?.windows?.find(item => item.hours === hours.value) || overview.value?.windows?.at(-1));
const freshnessTone = computed(() => freshness.value.is_fresh === true ? "ok" : freshness.value.is_fresh === false ? "warning" : "muted");

function formatTime(value: unknown) {
  if (!value) return "暂无";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("zh-CN", { hour12: false });
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const [overviewData, freshnessData, eventData] = await Promise.all([
      loadAiopsOverview(hours.value),
      loadAiopsFreshness(),
      loadAiopsEvents(hours.value, 8),
    ]);
    overview.value = overviewData;
    freshness.value = freshnessData;
    events.value = eventData.items || [];
  } catch (err) {
    error.value = err instanceof Error ? err.message : "AIOps 数据加载失败";
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="aiops-page" :class="{ loading }">
    <section class="aiops-hero">
      <div>
        <span class="aiops-eyebrow"><BrainCircuit :size="15" /> AIOps 智能运维</span>
        <h1>从告警洪峰中提炼真正需要处理的风险</h1>
        <p>统一查看 Syslog、Trap、聚合事件和 AI 研判；拥有 AIOps 页面权限的用户可查看完整运维数据。</p>
      </div>
      <div class="aiops-hero-actions">
        <div class="aiops-range">
          <button v-for="value in [1, 3, 24]" :key="value" :class="{ active: hours === value }" @click="hours = value; load()">{{ value }} 小时</button>
        </div>
        <button class="btn btn-secondary" @click="load"><RefreshCw :size="15" />刷新</button>
        <RouterLink class="btn btn-primary" to="/ai-assistant"><Bot :size="16" />询问 AI 助手</RouterLink>
      </div>
    </section>

    <AiopsModuleTabs />

    <div v-if="error" class="aiops-notice error"><Siren :size="18" /><span><strong>AIOps 暂不可用</strong>{{ error }}</span></div>

    <section class="aiops-kpis">
      <article><span class="aiops-kpi-icon blue"><Activity :size="21" /></span><div><em>解析 Syslog</em><strong>{{ (selectedWindow?.syslog_parsed || 0).toLocaleString() }}</strong><small>最近 {{ hours }} 小时</small></div></article>
      <article><span class="aiops-kpi-icon amber"><RadioTower :size="21" /></span><div><em>接收 Trap</em><strong>{{ (selectedWindow?.trap_raw || 0).toLocaleString() }}</strong><small>原始 Trap 消息</small></div></article>
      <article><span class="aiops-kpi-icon red"><Siren :size="21" /></span><div><em>聚合事件</em><strong>{{ (selectedWindow?.alarm_events || 0).toLocaleString() }}</strong><small>已降噪事件</small></div></article>
      <article><span class="aiops-kpi-icon green"><ShieldCheck :size="21" /></span><div><em>聚合新鲜度</em><strong class="aiops-health" :class="freshnessTone">{{ freshness.is_fresh === true ? "正常" : freshness.is_fresh === false ? "滞后" : "待确认" }}</strong><small>延迟 {{ freshness.alarm_lag_seconds ?? "-" }} 秒</small></div></article>
    </section>

    <section class="aiops-grid">
      <article class="card aiops-event-card">
        <header><div><h2>最新聚合事件</h2><p>相同设备和对象的重复告警已合并</p></div><RouterLink to="/aiops/events">查看全部</RouterLink></header>
        <div class="aiops-event-list">
          <RouterLink v-for="item in events" :key="item.event_id || `${item.device_ip}-${item.last_seen}`" to="/aiops/events" class="aiops-event-row">
            <span class="aiops-severity" :class="String(item.severity_max || '').toLowerCase()">{{ item.severity_max || "-" }}</span>
            <div><strong>{{ item.event_type || item.event_family || "未分类事件" }}</strong><small>{{ item.device_name || item.device_ip || "未知设备" }} · {{ item.object_key || "设备级" }}</small></div>
            <b>{{ item.event_count || 1 }} 次</b><time>{{ formatTime(item.last_seen) }}</time>
          </RouterLink>
          <div v-if="!events.length && !loading" class="aiops-empty"><ShieldCheck :size="30" /><strong>当前窗口暂无聚合事件</strong><span>可以切换时间范围或检查数据新鲜度。</span></div>
        </div>
      </article>

      <aside class="aiops-side-stack">
        <article class="card aiops-fresh-card"><header><Clock3 :size="19" /><h2>数据链路</h2></header><dl><div><dt>最新 Syslog</dt><dd>{{ formatTime(freshness.latest_syslog_at) }}</dd></div><div><dt>最新聚合事件</dt><dd>{{ formatTime(freshness.latest_alarm_event_at) }}</dd></div><div><dt>聚合延迟</dt><dd>{{ freshness.alarm_lag_seconds ?? "-" }} 秒</dd></div></dl></article>
        <RouterLink class="aiops-assistant-card" to="/ai-assistant"><span><Bot :size="25" /></span><div><strong>AI 运维助手</strong><p>结合故障知识库查询处置经验，也可以直接问普通问题。</p></div><b>开始对话 →</b></RouterLink>
      </aside>
    </section>
  </div>
</template>
