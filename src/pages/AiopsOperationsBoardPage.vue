<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { Bot, BrainCircuit, Clock3, Copy, Download, Eye, ListChecks, Play, RefreshCw, ShieldCheck, Sparkles, X, Zap } from "lucide-vue-next";
import AiopsRunCarousel from "../components/AiopsRunCarousel.vue";
import { aiopsApi, loadAiopsFreshness, loadAiopsOverview, type AiopsOverview } from "../services/aiopsApi";

type Run = Record<string, any>;
type Finding = Record<string, any>;
const runs = ref<Run[]>([]);
const selected = ref<Run | null>(null);
const overview = ref<AiopsOverview | null>(null);
const freshness = ref<Record<string, any>>({});
const loading = ref(false);
const running = ref(false);
const error = ref("");
const activeSection = ref("must_handle");
const analysisHours = ref(24);
const selectedFinding = ref<Finding | null>(null);
const findingTab = ref<"summary" | "evidence" | "actions" | "missing">("summary");
let pollTimer: number | undefined;

const successfulRuns = computed(() => runs.value.filter(run => run.status === "success"));
const result = computed(() => selected.value || {});
const sections = computed<Record<string, Finding[]>>(() => ({
  must_handle: result.value.must_handle || [],
  watch: result.value.watch || [],
  correlations: result.value.correlations || [],
  recovered: result.value.recovered || [],
  next_actions: result.value.next_actions || [],
  noise: result.value.noise || [],
  insufficient: result.value.insufficient || [],
}));
const sectionTabs = computed(() => [
  { key: "must_handle", label: "必须处理", count: sections.value.must_handle.length },
  { key: "watch", label: "重点关注", count: sections.value.watch.length },
  { key: "correlations", label: "关联分析", count: sections.value.correlations.length },
  { key: "recovered", label: "已恢复", count: sections.value.recovered.length },
  { key: "next_actions", label: "建议动作", count: sections.value.next_actions.length },
  { key: "noise", label: "规则与降噪", count: sections.value.noise.length },
  { key: "insufficient", label: "证据不足", count: sections.value.insufficient.length },
]);
const activeFindings = computed(() => sections.value[activeSection.value] || []);
const status = computed(() => result.value.overall_status || {});
const statusTone = computed(() => String(status.value.level || result.value.overall_level || "stable").toLowerCase());
const sourceWindow = computed(() => overview.value?.windows?.find(item => item.hours === Number(result.value.hours || analysisHours.value)) || overview.value?.windows?.find(item => item.hours === 24));

function formatTime(value: unknown, full = false) {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("zh-CN", full ? { hour12: false } : { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}
function formatTimelineTime(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}
function text(value: any, fallback = "-"): string {
  if (value === 0) return "0";
  if (Array.isArray(value)) return value.length ? value.map(item => text(item)).join("、") : fallback;
  if (value && typeof value === "object") return value.title || value.summary || value.action || JSON.stringify(value);
  return value || fallback;
}
function short(value: any, max = 210): string { const content = text(value, ""); return content.length > max ? `${content.slice(0, max)}…` : content; }
function severity(item: Finding) { return String(item.severity || item.level || item.priority || "info").toLowerCase(); }
function findingTitle(item: Finding) { return item.title || item.action || item.reason || item.conclusion || "AI 分析项"; }
function findingSummary(item: Finding) { return item.root_cause_hypothesis || item.judgment || item.conclusion || item.summary || item.reason || item.impact || item.action || "暂无摘要"; }
function findingDevice(item: Finding) { return item.managed_device_name || item.device_name || item.managed_device_ip || item.device_ip || (item.devices || []).join("、") || "多对象关联"; }
function firstEvidence(item: Finding) { const evidence = item.evidence || item.raw?.evidence || []; return short(Array.isArray(evidence) ? evidence[0] : evidence, 180) || "证据随报告原文保存"; }
function runModel(run: Run | null) { return run?.model_trace || [run?.llm_provider, run?.model_name].filter(Boolean).join(" / ") || "-"; }
function detailText(value: any, fallback = "暂无结构化内容") {
  if (!value) return fallback;
  if (Array.isArray(value)) return value.length ? value.map((item, index) => `${index + 1}. ${text(item)}`).join("\n") : fallback;
  if (typeof value === "object") return Object.entries(value).map(([key, item]) => `${key}：${text(item)}`).join("\n");
  return String(value);
}
function actionValue(item: Finding) { return item.recommended_actions || item.action || item.next_action || item.suggestion || item.raw?.recommended_actions; }
function evidenceValue(item: Finding) { return item.evidence || item.related_events || item.raw?.evidence; }
function missingValue(item: Finding) { return item.missing_data || item.missing || item.raw?.missing_data; }
function openFinding(item: Finding, tab: typeof findingTab.value = "summary") { selectedFinding.value = item; findingTab.value = tab; }

async function selectRun(run: Run) {
  error.value = "";
  try {
    selected.value = await aiopsApi<{ item: Run }>(`/ai-runs/${run.run_uid}`).then(data => data.item);
    activeSection.value = "must_handle";
  } catch (err) { error.value = err instanceof Error ? err.message : "分析报告加载失败"; }
}
async function load(preferredUid?: string) {
  loading.value = true; error.value = "";
  try {
    const [runData, overviewData, freshnessData] = await Promise.all([
      aiopsApi<{ items: Run[] }>("/ai-runs?limit=80"), loadAiopsOverview(24), loadAiopsFreshness(),
    ]);
    runs.value = runData.items || [];
    overview.value = overviewData;
    freshness.value = freshnessData;
    const target = runs.value.find(run => run.run_uid === preferredUid) || successfulRuns.value[0] || runs.value[0];
    if (target) await selectRun(target);
  } catch (err) { error.value = err instanceof Error ? err.message : "AIOps 运维看板加载失败"; }
  finally { loading.value = false; }
}
async function startAnalysis() {
  running.value = true; error.value = "";
  try {
    const created = await aiopsApi<{ run_uid: string }>("/ai-runs", { method: "POST", body: JSON.stringify({ hours: analysisHours.value, max_tool_rounds: 2, save_to_db: true }) });
    const uid = created.run_uid;
    if (pollTimer) window.clearInterval(pollTimer);
    pollTimer = window.setInterval(async () => {
      try {
        const data = await aiopsApi<{ item: Run }>(`/ai-runs/${uid}`);
        if (["success", "failed"].includes(data.item.status)) {
          if (pollTimer) window.clearInterval(pollTimer);
          running.value = false;
          await load(uid);
        }
      } catch { /* keep the board usable while the background run continues */ }
    }, 5000);
  } catch (err) { running.value = false; error.value = err instanceof Error ? err.message : "AI 分析启动失败"; }
}
function copySuggestion(item: Finding) { navigator.clipboard?.writeText(text(item.recommended_actions || item.action || findingSummary(item), "")); }
function exportMarkdown() {
  if (!selected.value) return;
  const lines = [`# ${status.value.title || selected.value.overall_title || "AIOps AI 分析报告"}`, "", status.value.summary || selected.value.summary_text || "", ""];
  for (const tab of sectionTabs.value) {
    lines.push(`## ${tab.label}`);
    for (const item of sections.value[tab.key] || []) lines.push(`- **${findingTitle(item)}**：${findingSummary(item)}`);
    if (!tab.count) lines.push("- 暂无");
    lines.push("");
  }
  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `aiops-${selected.value.run_uid || Date.now()}.md`; anchor.click(); URL.revokeObjectURL(url);
}
onMounted(load);
onBeforeUnmount(() => { if (pollTimer) window.clearInterval(pollTimer); });
</script>

<template>
  <div class="ai-board" :class="[`tone-${statusTone}`, { loading }]">
    <div v-if="error" class="aiops-notice error">{{ error }}</div>
    <section v-if="running" class="ai-run-progress"><span><i></i></span><div><Sparkles :size="18" /><strong>AI 正在关联 Syslog、Trap 与 Events</strong><small>后台持续分析，完成后自动切换到最新报告</small></div></section>

    <AiopsRunCarousel :runs="successfulRuns" :selected-uid="selected?.run_uid" @select="selectRun" />

    <section class="ai-report-hero">
      <div class="ai-report-copy"><div class="ai-risk-row"><span>{{ statusTone.toUpperCase() }} / {{ status.title || selected?.overall_title || "等待分析" }}</span><b>AI 智能分析引擎</b></div><h1>{{ status.title || selected?.overall_title || "暂无 AI 分析结论" }}</h1><p>{{ status.summary || selected?.summary_text || "触发分析后，这里会展示当前窗口的风险判断、证据和处置建议。" }}</p><strong>{{ status.ai_conclusion || status.conclusion || "AI 将优先提炼影响业务的核心异常" }}</strong></div>
      <div class="ai-board-bot"><span class="bot-orbit one"></span><span class="bot-orbit two"></span><div class="bot-face"><i></i><i></i></div><div class="bot-core"><Zap :size="18" /></div><div class="bot-shadow"></div><article><strong>AI 助手判断</strong><p>{{ status.assistant_text || status.summary || selected?.summary_text || "正在等待有效分析结果。" }}</p><small>核心风险 {{ sections.must_handle.length }} 项 · 重点关注 {{ sections.watch.length }} 项</small></article></div>
    </section>

    <section class="ai-board-layout">
      <main>
        <div class="ai-report-tabs"><button v-for="tab in sectionTabs" :key="tab.key" :class="{ active: activeSection === tab.key }" @click="activeSection = tab.key">{{ tab.label }} <b>{{ tab.count }}</b></button></div>
        <div class="ai-source-strip"><span>Syslog <b>{{ sourceWindow?.syslog_parsed?.toLocaleString() || 0 }}</b></span><span>Trap <b>{{ sourceWindow?.trap_raw?.toLocaleString() || 0 }}</b></span><span>Events <b>{{ sourceWindow?.alarm_events?.toLocaleString() || 0 }}</b></span><span>{{ freshness.is_fresh ? "实时" : "延迟" }} · {{ formatTime(freshness.latest_alarm_event_at) }}</span></div>
        <section class="ai-finding-list">
          <header><div><h2>{{ sectionTabs.find(tab => tab.key === activeSection)?.label }}</h2><p>AI 优先展示结论，证据和建议按需展开。</p></div><ShieldCheck :size="21" /></header>
          <article v-for="(item,index) in activeFindings" :key="item.id || item.finding_uid || index" :class="severity(item)"><i></i><div><div><strong>{{ findingTitle(item) }}</strong><span>{{ severity(item) }}</span></div><small>{{ findingDevice(item) }} · {{ text(item.object_key, "设备级") }} · {{ text(item.lifecycle_status, "状态待确认") }}</small><p>{{ findingSummary(item) }}</p><em>关键证据：{{ firstEvidence(item) }}</em><footer><button @click="openFinding(item, 'evidence')"><Eye :size="13" />查看证据</button><button @click="openFinding(item, 'actions')"><ListChecks :size="13" />建议动作</button><button @click="copySuggestion(item)"><Copy :size="13" />复制建议</button></footer></div></article>
          <div v-if="!activeFindings.length" class="aiops-empty"><ShieldCheck :size="32" /><strong>当前分类暂无分析项</strong><span>可切换其他分类或时间节点。</span></div>
        </section>
      </main>
      <aside class="ai-board-side">
        <section><header><BrainCircuit :size="18" /><strong>AI 分析信息</strong><span class="ai-analysis-state" :class="freshness.is_fresh ? 'ok' : 'late'">{{ freshness.is_fresh ? "实时" : "延迟" }}</span></header><dl><div><dt>分析时间</dt><dd>{{ formatTimelineTime(selected?.created_at) }}</dd></div><div><dt>分析窗口</dt><dd>{{ formatTime(selected?.window_start, true) }} 至 {{ formatTime(selected?.window_end, true) }}</dd></div><div><dt>模型</dt><dd>{{ runModel(selected) }}</dd></div><div><dt>数据状态</dt><dd>{{ freshness.is_fresh ? "实时" : "存在延迟" }}，{{ formatTime(freshness.latest_alarm_event_at) }} 更新</dd></div><div><dt>执行状态 / 耗时</dt><dd>{{ selected?.status || "-" }} · {{ selected?.duration_ms ? `${Math.round(selected.duration_ms / 1000)} 秒` : "-" }}</dd></div></dl><div class="ai-manual-analysis"><label>手动分析窗口<select v-model.number="analysisHours"><option :value="4">最近 4 小时</option><option :value="12">最近 12 小时</option><option :value="24">最近 24 小时</option><option :value="72">最近 72 小时</option></select></label><button class="btn btn-primary" :disabled="running" @click="startAnalysis"><Play :size="15" />{{ running ? "AI 正在分析…" : "重新分析" }}</button></div><button class="btn btn-secondary" @click="load()"><RefreshCw :size="15" />刷新数据</button><button class="btn btn-secondary" @click="exportMarkdown"><Download :size="15" />导出 Markdown</button><RouterLink class="btn btn-secondary" to="/aiops/analysis"><Clock3 :size="15" />查看分析历史</RouterLink></section>
        <section class="ai-mini-summary"><header><Bot :size="18" /><strong>恢复 / 降噪</strong></header><div><article><b>{{ sections.recovered.length }}</b><span>已恢复</span></article><article><b>{{ sections.noise.length }}</b><span>噪声项</span></article><article><b>{{ sections.insufficient.length }}</b><span>证据不足</span></article></div><p>{{ sections.noise.slice(0,3).map(findingTitle).join(" / ") || "当前没有主要噪声类型。" }}</p></section>
      </aside>
    </section>
    <div v-if="selectedFinding" class="ai-finding-drawer-mask" @click.self="selectedFinding = null">
      <aside class="ai-finding-drawer"><header><div><span>{{ severity(selectedFinding) }}</span><h2>{{ findingTitle(selectedFinding) }}</h2><p>{{ findingDevice(selectedFinding) }} · {{ text(selectedFinding.object_key, "设备级") }}</p></div><button @click="selectedFinding = null"><X :size="20" /></button></header><nav><button :class="{ active: findingTab === 'summary' }" @click="findingTab = 'summary'">概要</button><button :class="{ active: findingTab === 'evidence' }" @click="findingTab = 'evidence'">证据</button><button :class="{ active: findingTab === 'actions' }" @click="findingTab = 'actions'">建议动作</button><button :class="{ active: findingTab === 'missing' }" @click="findingTab = 'missing'">缺失数据</button></nav><section v-if="findingTab === 'summary'"><h3>AI 研判结论</h3><p>{{ findingSummary(selectedFinding) }}</p><h3>影响范围</h3><p>{{ detailText(selectedFinding.impact) }}</p></section><section v-else-if="findingTab === 'evidence'"><h3>关键证据</h3><pre>{{ detailText(evidenceValue(selectedFinding)) }}</pre></section><section v-else-if="findingTab === 'actions'"><h3>建议动作</h3><pre>{{ detailText(actionValue(selectedFinding)) }}</pre><button class="btn btn-primary" @click="copySuggestion(selectedFinding)"><Copy :size="14" />复制全部建议</button></section><section v-else><h3>待补充数据</h3><pre>{{ detailText(missingValue(selectedFinding)) }}</pre></section></aside>
    </div>
  </div>
</template>
