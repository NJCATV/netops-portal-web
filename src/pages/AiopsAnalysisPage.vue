<script setup lang="ts">
import { onMounted, ref } from "vue";
import { BrainCircuit, Play, RefreshCw } from "lucide-vue-next";
import AiopsModuleTabs from "../components/AiopsModuleTabs.vue";
import { aiopsApi } from "../services/aiopsApi";

const runs = ref<Record<string, any>[]>([]);
const loading = ref(false);
const running = ref(false);
const error = ref("");

function formatTime(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("zh-CN", { hour12: false });
}

async function load() {
  loading.value = true; error.value = "";
  try { const result = await aiopsApi<{ items: Record<string, any>[] }>("/ai-runs?limit=50"); runs.value = result.items || []; }
  catch (err) { error.value = err instanceof Error ? err.message : "AI 分析历史加载失败"; }
  finally { loading.value = false; }
}

async function runAnalysis() {
  running.value = true; error.value = "";
  try { await aiopsApi("/ai-runs", { method: "POST", body: JSON.stringify({ hours: 24, max_tool_rounds: 2, save_to_db: true }) }); await load(); }
  catch (err) { error.value = err instanceof Error ? err.message : "AI 分析启动失败"; }
  finally { running.value = false; }
}

onMounted(load);
</script>

<template>
  <div class="aiops-page" :class="{ loading }">
    <section class="aiops-page-head"><div><span>AIOps · 智能研判</span><h1>AI 分析</h1><p>AI 只分析经过规则聚合和权限过滤后的事件摘要，并保留证据和运行记录。</p></div><div><button class="btn btn-secondary" @click="load"><RefreshCw :size="15" />刷新</button><button class="btn btn-primary" :disabled="running" @click="runAnalysis"><Play :size="15" />{{ running ? '分析中…' : '分析最近 24 小时' }}</button></div></section>
    <AiopsModuleTabs />
    <div v-if="error" class="aiops-notice error">{{ error }}</div>
    <section class="card aiops-table-card"><div class="table-scroll"><table class="data-table aiops-table"><thead><tr><th>运行时间</th><th>状态</th><th>分析窗口</th><th>模型</th><th>必须处理</th><th>关注</th><th>耗时</th></tr></thead><tbody><tr v-for="run in runs" :key="run.run_uid || run.id"><td>{{ formatTime(run.created_at || run.started_at) }}</td><td><span class="status-tag">{{ run.status || '-' }}</span></td><td>{{ run.hours || run.metadata?.hours || '-' }} 小时</td><td>{{ run.model || run.model_name || '-' }}</td><td>{{ run.must_handle_count ?? run.metrics?.must_handle_count ?? '-' }}</td><td>{{ run.watch_count ?? run.metrics?.watch_count ?? '-' }}</td><td>{{ run.duration_ms ? `${run.duration_ms} ms` : '-' }}</td></tr></tbody></table></div><div v-if="!runs.length && !loading" class="aiops-empty"><BrainCircuit :size="30" /><strong>暂无 AI 分析记录</strong><span>具备执行权限的管理员可以发起一次分析。</span></div></section>
  </div>
</template>
