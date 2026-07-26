<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { Clock3, Pencil, Play, Plus, RefreshCw, Trash2 } from "lucide-vue-next";
import AiopsModuleTabs from "../components/AiopsModuleTabs.vue";
import { aiopsApi } from "../services/aiopsApi";

type Task = Record<string, any> & { id: number; task_name: string; enabled: boolean };
const items = ref<Task[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const notice = ref("");
const showCreate = ref(false);
const editingId = ref<number | null>(null);
const form = reactive({ task_name: "每日智能分析", task_type: "ai_analysis", schedule_type: "daily", daily_time: "08:00", interval_minutes: 60, cron_expr: "0 8 * * *", hours: 24, max_tool_rounds: 2, llm_usage_key: "aiops_scheduled_analysis", remark: "", enabled: true });

function time(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("zh-CN", { hour12: false });
}
function schedule(task: Task) {
  if (task.schedule_type === "daily") return `每天 ${task.daily_time || "08:00"}`;
  if (task.schedule_type === "cron") return `Cron ${task.cron_expr || "-"}`;
  return `每 ${task.interval_minutes || 60} 分钟`;
}
async function load() {
  loading.value = true; error.value = "";
  try { items.value = (await aiopsApi<{ items: Task[] }>("/report-tasks")).items || []; }
  catch (err) { error.value = err instanceof Error ? err.message : "任务加载失败"; }
  finally { loading.value = false; }
}
function resetForm(task?: Task) {
  editingId.value = task?.id || null;
  Object.assign(form, {
    task_name: task?.task_name || "每日智能分析", task_type: task?.task_type || "ai_analysis",
    schedule_type: task?.schedule_type || "daily", daily_time: task?.daily_time || "08:00",
    interval_minutes: task?.interval_minutes || 60, cron_expr: task?.cron_expr || "0 8 * * *",
    hours: task?.hours || 24, max_tool_rounds: task?.max_tool_rounds ?? 2,
    llm_usage_key: task?.llm_usage_key || "aiops_scheduled_analysis", remark: task?.remark || "", enabled: task?.enabled ?? true,
  });
  showCreate.value = true;
}
async function saveTask() {
  saving.value = true; error.value = "";
  try {
    await aiopsApi(editingId.value ? `/report-tasks/${editingId.value}` : "/report-tasks", { method: editingId.value ? "PUT" : "POST", body: JSON.stringify(form) });
    showCreate.value = false; notice.value = editingId.value ? "分析任务已更新" : "分析任务已创建"; editingId.value = null; await load();
  } catch (err) { error.value = err instanceof Error ? err.message : "任务创建失败"; }
  finally { saving.value = false; }
}
async function action(task: Task, name: "enable" | "disable" | "run-now") {
  error.value = "";
  try {
    await aiopsApi(`/report-tasks/${task.id}/${name}`, { method: "POST", body: "{}" });
    notice.value = name === "run-now" ? "任务已进入执行队列" : `任务已${name === "enable" ? "启用" : "停用"}`;
    await load();
  } catch (err) { error.value = err instanceof Error ? err.message : "操作失败"; }
}
async function remove(task: Task) {
  if (!window.confirm(`确认删除任务“${task.task_name}”？`)) return;
  try { await aiopsApi(`/report-tasks/${task.id}`, { method: "DELETE" }); await load(); }
  catch (err) { error.value = err instanceof Error ? err.message : "删除失败"; }
}
onMounted(load);
</script>

<template>
  <div class="aiops-page" :class="{ loading }">
    <section class="aiops-page-head"><div><span>AIOps · 自动化</span><h1>智能分析任务</h1><p>统一编排周期分析、模型用途与结果落库；任务执行仍由 AIOps 调度器负责。</p></div><div class="aiops-head-actions"><button class="btn btn-secondary" @click="load"><RefreshCw :size="15" />刷新</button><button class="btn btn-primary" @click="resetForm()"><Plus :size="15" />新建任务</button></div></section>
    <AiopsModuleTabs />
    <div v-if="error" class="aiops-notice error">{{ error }}</div><div v-if="notice" class="aiops-notice success">{{ notice }}</div>
    <form v-if="showCreate" class="card aiops-editor aiops-editor-wide" @submit.prevent="saveTask"><label><span>任务名称</span><input v-model="form.task_name" required /></label><label><span>调度方式</span><select v-model="form.schedule_type"><option value="daily">每天</option><option value="interval">固定间隔</option><option value="cron">Cron</option></select></label><label v-if="form.schedule_type === 'daily'"><span>执行时间</span><input v-model="form.daily_time" type="time" /></label><label v-else-if="form.schedule_type === 'interval'"><span>间隔分钟</span><input v-model.number="form.interval_minutes" type="number" min="1" /></label><label v-else><span>Cron 表达式</span><input v-model="form.cron_expr" /></label><label><span>分析窗口（小时）</span><input v-model.number="form.hours" type="number" min="1" max="168" /></label><label><span>工具轮次</span><input v-model.number="form.max_tool_rounds" type="number" min="0" max="6" /></label><label><span>模型用途</span><select v-model="form.llm_usage_key"><option value="aiops_scheduled_analysis">AIOps 定时分析</option><option value="aiops_manual_analysis">AIOps 手动分析</option></select></label><label><span>备注</span><input v-model="form.remark" /></label><div class="aiops-editor-actions"><button type="button" class="btn btn-secondary" @click="showCreate=false">取消</button><button class="btn btn-primary" :disabled="saving">{{ saving ? "保存中…" : editingId ? "更新任务" : "创建任务" }}</button></div></form>
    <section class="aiops-admin-grid"><article v-for="task in items" :key="task.id" class="card aiops-admin-card"><header><span class="aiops-status-dot" :class="task.enabled ? 'ok' : 'muted'"></span><div><h2>{{ task.task_name }}</h2><p>{{ schedule(task) }} · 分析最近 {{ task.hours || 24 }} 小时</p></div><b :class="task.enabled ? 'status-ok' : 'status-muted'">{{ task.enabled ? "运行中" : "已停用" }}</b></header><dl><div><dt>上次执行</dt><dd>{{ time(task.last_run_at) }}</dd></div><div><dt>下次执行</dt><dd>{{ time(task.next_run_at) }}</dd></div><div><dt>最近结果</dt><dd>{{ task.last_status || "尚未运行" }}</dd></div></dl><footer><button class="btn btn-secondary" @click="action(task, 'run-now')"><Play :size="14" />立即执行</button><button class="btn btn-secondary" @click="resetForm(task)"><Pencil :size="14" />编辑</button><button class="btn btn-secondary" @click="action(task, task.enabled ? 'disable' : 'enable')"><Clock3 :size="14" />{{ task.enabled ? "停用" : "启用" }}</button><button class="btn btn-danger-ghost" @click="remove(task)"><Trash2 :size="14" />删除</button></footer></article><div v-if="!items.length && !loading" class="card aiops-empty"><strong>尚未配置分析任务</strong><span>新建任务后，调度器会按计划生成智能分析报告。</span></div></section>
  </div>
</template>
