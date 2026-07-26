<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RefreshCw, Search } from "lucide-vue-next";
import AiopsModuleTabs from "../components/AiopsModuleTabs.vue";
import { aiopsApi } from "../services/aiopsApi";

const props = defineProps<{ kind: "syslog" | "trap" }>();
const items = ref<Record<string, any>[]>([]);
const total = ref(0);
const hours = ref(24);
const query = ref("");
const loading = ref(false);
const error = ref("");
const title = computed(() => props.kind === "syslog" ? "Syslog 检索" : "SNMP Trap 检索");
const endpoint = computed(() => props.kind === "syslog" ? "/syslog/latest" : "/trap");

function formatTime(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("zh-CN", { hour12: false });
}

async function load() {
  loading.value = true; error.value = "";
  try {
    const params = new URLSearchParams({ hours: String(hours.value), limit: "100" });
    if (query.value.trim()) params.set("q", query.value.trim());
    const result = await aiopsApi<{ items: Record<string, any>[]; total?: number }>(`${endpoint.value}?${params}`);
    items.value = result.items || []; total.value = result.total ?? items.value.length;
  } catch (err) { error.value = err instanceof Error ? err.message : "日志加载失败"; }
  finally { loading.value = false; }
}

onMounted(load);
</script>

<template>
  <div class="aiops-page" :class="{ loading }">
    <section class="aiops-page-head"><div><span>AIOps · 原始证据</span><h1>{{ title }}</h1><p>面向故障回溯保留原始证据，查询结果自动受当前组织范围约束。</p></div><button class="btn btn-secondary" @click="load"><RefreshCw :size="15" />刷新</button></section>
    <AiopsModuleTabs />
    <section class="card aiops-filter-bar"><label><Search :size="16" /><input v-model="query" placeholder="搜索设备、IP、事件或原始内容" @keyup.enter="load" /></label><select v-model="hours" @change="load"><option :value="1">最近 1 小时</option><option :value="24">最近 24 小时</option><option :value="168">最近 7 天</option></select><button class="btn btn-primary" @click="load">查询</button><span>共 {{ total.toLocaleString() }} 条</span></section>
    <div v-if="error" class="aiops-notice error">{{ error }}</div>
    <section class="card aiops-table-card"><div class="table-scroll"><table class="data-table aiops-table"><thead><tr><th>时间</th><th>设备</th><th>{{ kind === 'syslog' ? '事件族/编码' : 'Trap/OID' }}</th><th>级别</th><th>原始内容</th></tr></thead><tbody><tr v-for="(item,index) in items" :key="item._id || `${item.timestamp || item['@timestamp']}-${index}`"><td>{{ formatTime(item.timestamp || item['@timestamp']) }}</td><td><strong>{{ item.device_name || item.managed_device_name || item.device_ip || item.managed_device_ip || '-' }}</strong><small>{{ item.device_ip || item.managed_device_ip || item.trap_sender_ip || '' }}</small></td><td>{{ kind === 'syslog' ? (item.event_family || item.event_code || '-') : (item.alarm_name || item.trap_oid_name || item.trap_oid || '-') }}</td><td>{{ item.severity || item.alarm_severity || '-' }}</td><td class="aiops-raw-cell">{{ item.raw_message || '-' }}</td></tr></tbody></table></div><div v-if="!items.length && !loading" class="aiops-empty"><strong>没有符合条件的数据</strong></div></section>
  </div>
</template>
