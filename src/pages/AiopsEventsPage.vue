<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RefreshCw, Search, ShieldCheck } from "lucide-vue-next";
import AiopsModuleTabs from "../components/AiopsModuleTabs.vue";
import { aiopsApi, type AiopsEvent } from "../services/aiopsApi";

const hours = ref(24);
const query = ref("");
const events = ref<AiopsEvent[]>([]);
const total = ref(0);
const loading = ref(false);
const error = ref("");

function formatTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const params = new URLSearchParams({ hours: String(hours.value), limit: "100" });
    if (query.value.trim()) params.set("q", query.value.trim());
    const result = await aiopsApi<{ items: AiopsEvent[]; total: number }>(`/alarm-events?${params}`);
    events.value = result.items || [];
    total.value = result.total || 0;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "事件加载失败";
  } finally { loading.value = false; }
}

onMounted(load);
</script>

<template>
  <div class="aiops-page" :class="{ loading }">
    <section class="aiops-page-head"><div><span>AIOps · 事件中心</span><h1>聚合事件</h1><p>按设备、对象和事件族合并重复告警，保留首次、末次和累计次数。</p></div><button class="btn btn-secondary" @click="load"><RefreshCw :size="15" />刷新</button></section>
    <AiopsModuleTabs />
    <section class="card aiops-filter-bar"><label><Search :size="16" /><input v-model="query" placeholder="搜索事件、设备、IP 或对象" @keyup.enter="load" /></label><select v-model="hours" @change="load"><option :value="1">最近 1 小时</option><option :value="3">最近 3 小时</option><option :value="24">最近 24 小时</option><option :value="168">最近 7 天</option></select><button class="btn btn-primary" @click="load">查询</button><span>共 {{ total.toLocaleString() }} 条</span></section>
    <div v-if="error" class="aiops-notice error">{{ error }}</div>
    <section class="card aiops-table-card"><div class="table-scroll"><table class="data-table aiops-table"><thead><tr><th>级别</th><th>事件</th><th>设备</th><th>对象</th><th>状态</th><th>次数</th><th>首次发生</th><th>最后发生</th></tr></thead><tbody><tr v-for="item in events" :key="item.event_id || `${item.device_ip}-${item.last_seen}`"><td><span class="aiops-severity" :class="String(item.severity_max || '').toLowerCase()">{{ item.severity_max || '-' }}</span></td><td><strong>{{ item.event_type || item.event_family || '未分类事件' }}</strong><small>{{ item.event_summary || '-' }}</small></td><td>{{ item.device_name || item.device_ip || '-' }}</td><td>{{ item.object_key || '设备级' }}</td><td>{{ item.event_status || '-' }}</td><td>{{ item.event_count || 1 }}</td><td>{{ formatTime(item.first_seen) }}</td><td>{{ formatTime(item.last_seen) }}</td></tr></tbody></table></div><div v-if="!events.length && !loading" class="aiops-empty"><ShieldCheck :size="30" /><strong>没有符合条件的事件</strong></div></section>
  </div>
</template>
