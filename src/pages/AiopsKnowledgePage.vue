<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { BookOpen, FileText, Layers3, RefreshCw, Search, UploadCloud, Wrench, X } from "lucide-vue-next";
import { aiopsApi } from "../services/aiopsApi";

type KnowledgeTab = "reports" | "repairs" | "documents" | "topics" | "import";
type ImportKind = "report" | "repair" | "document";
type Row = Record<string, any>;

const tab = ref<KnowledgeTab>("reports");
const summary = ref<Row>({});
const items = ref<Row[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 15;
const loading = ref(false);
const error = ref("");
const selected = ref<Row | null>(null);
const importing = ref<ImportKind | "">("");
const importResult = ref<Row | null>(null);
const importFiles = reactive<Record<ImportKind, File[]>>({ report: [], repair: [], document: [] });
const filters = reactive({ q: "", service: "", symptom: "", knowledgeValue: "", includeNoise: false });

const tabs: { key: KnowledgeTab; label: string; hint: string }[] = [
  { key: "reports", label: "正式故障报告", hint: "结构化故障结论与处置依据" },
  { key: "repairs", label: "值班报修经验", hint: "一线值班和报修处置记录" },
  { key: "documents", label: "运维文档", hint: "制度、手册与专题资料" },
  { key: "topics", label: "故障主题", hint: "按业务与症状聚合的经验主题" },
  { key: "import", label: "导入管理", hint: "上传报告、报修表和运维文档" },
];
const importCards: { key: ImportKind; title: string; tag: string; accept: string; multiple: boolean; hint: string }[] = [
  { key: "report", title: "故障报告知识库", tag: "正式报告", accept: ".zip,.doc,.docx,.xlsx", multiple: true, hint: "上传按日期命名的故障排查报告 Word，或包含报告和台账的 ZIP。" },
  { key: "repair", title: "值班报修知识库", tag: "Excel 流水", accept: ".xlsx,.xls", multiple: false, hint: "上传值班、报修和故障汇总 Excel，按稳定记录 ID 增量更新。" },
  { key: "document", title: "运维文档知识库", tag: "手册 / FAQ", accept: ".zip,.doc,.docx,.xlsx", multiple: true, hint: "上传运维手册、专题资料、FAQ 或错误代码表，自动切块入库。" },
];

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));
const currentTab = computed(() => tabs.find((item) => item.key === tab.value)!);

function buildParams() {
  const params = new URLSearchParams({ limit: String(pageSize), offset: String((page.value - 1) * pageSize) });
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.service.trim()) params.set("service", filters.service.trim());
  if (filters.symptom.trim() && tab.value !== "topics") params.set("canonical_symptom", filters.symptom.trim());
  if (filters.knowledgeValue && tab.value !== "topics") params.set("knowledge_value", filters.knowledgeValue);
  if (tab.value === "reports") params.set("source_type", "formal_fault_report");
  if (tab.value === "documents") params.set("source_type", "document_kb");
  if (tab.value === "repairs" && filters.includeNoise) params.set("include_noise", "true");
  return params;
}

async function loadSummary() {
  summary.value = await aiopsApi<Row>("/fault-kb/summary");
}

async function loadList() {
  if (tab.value === "import") { items.value = []; total.value = 0; return; }
  const endpoint = tab.value === "documents" ? "reports" : tab.value;
  const data = await aiopsApi<{ items: Row[]; total: number }>(`/fault-kb/${endpoint}?${buildParams()}`);
  items.value = data.items || [];
  total.value = data.total || 0;
}

async function load(includeSummary = false) {
  loading.value = true;
  error.value = "";
  try {
    await Promise.all([loadList(), includeSummary ? loadSummary() : Promise.resolve()]);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "知识库加载失败";
  } finally {
    loading.value = false;
  }
}

async function switchTab(next: KnowledgeTab) {
  tab.value = next;
  page.value = 1;
  selected.value = null;
  if (next !== "import") await load();
}

function chooseImportFiles(kind: ImportKind, event: Event) {
  const input = event.target as HTMLInputElement;
  importFiles[kind] = Array.from(input.files || []);
}

async function uploadImport(kind: ImportKind) {
  if (!importFiles[kind].length) return;
  importing.value = kind;
  error.value = "";
  importResult.value = null;
  try {
    const form = new FormData();
    form.append("kind", kind === "repair" ? "repair" : "formal");
    form.append("rebuild", "false");
    form.append("rebuild_aggregates", "true");
    form.append("drop_noise", "false");
    importFiles[kind].forEach((file) => form.append("files", file, file.name));
    importResult.value = await aiopsApi<Row>("/fault-kb/import/upload", { method: "POST", body: form });
    importFiles[kind] = [];
    await loadSummary();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "知识库导入失败";
  } finally {
    importing.value = "";
  }
}

async function search() {
  page.value = 1;
  await load();
}

async function changePage(next: number) {
  if (next < 1 || next > totalPages.value) return;
  page.value = next;
  await load();
}

function text(value: unknown, fallback = "—") {
  if (Array.isArray(value)) return value.filter(Boolean).join("；") || fallback;
  return String(value || "").trim() || fallback;
}

function title(row: Row) {
  return text(row.knowledge_title || row.title || row.topic_label || row.canonical_symptom_label || row.fault_content, "未命名知识条目");
}

onMounted(() => load(true));
</script>

<template>
  <div class="aiops-page" :class="{ loading }">
    <section class="aiops-page-head aiops-kb-head">
      <div><span>AIOps · 经验沉淀</span><h1>故障知识库</h1><p>复用原 AIOps 的分类体系，集中检索故障报告、值班经验、运维文档和聚合主题。</p></div>
      <button class="btn btn-secondary" @click="load(true)"><RefreshCw :size="15" />刷新</button>
    </section>

    <section class="aiops-kb-metrics">
      <article><FileText :size="21" /><div><strong>{{ (summary.formal_report_count || 0).toLocaleString() }}</strong><span>正式故障报告</span></div></article>
      <article><Wrench :size="21" /><div><strong>{{ (summary.repair_count || 0).toLocaleString() }}</strong><span>值班报修经验</span></div></article>
      <article><BookOpen :size="21" /><div><strong>{{ (summary.document_count || 0).toLocaleString() }}</strong><span>运维文档</span></div></article>
      <article><Layers3 :size="21" /><div><strong>{{ (summary.topic_count || 0).toLocaleString() }}</strong><span>故障主题</span></div></article>
    </section>

    <section class="card aiops-kb-tabs">
      <button v-for="item in tabs" :key="item.key" :class="{ active: tab === item.key }" @click="switchTab(item.key)">
        <strong>{{ item.label }}</strong><small>{{ item.hint }}</small>
      </button>
    </section>

    <section v-if="tab !== 'import'" class="card aiops-kb-filters">
      <label class="aiops-kb-search"><Search :size="17" /><input v-model="filters.q" placeholder="搜索现象、原因、处置方法或文件" @keyup.enter="search" /></label>
      <input v-model="filters.service" placeholder="业务系统" @keyup.enter="search" />
      <input v-if="tab !== 'topics'" v-model="filters.symptom" placeholder="故障症状" @keyup.enter="search" />
      <select v-if="tab !== 'topics'" v-model="filters.knowledgeValue"><option value="">全部知识价值</option><option value="reference">可参考</option><option value="aggregate_only">仅聚合</option><option value="low_value">低价值</option></select>
      <label v-if="tab === 'repairs'" class="aiops-kb-check"><input v-model="filters.includeNoise" type="checkbox" />包含噪声</label>
      <button class="btn btn-primary" @click="search">查询</button>
    </section>

    <div v-if="error" class="aiops-notice error">{{ error }}</div>
    <section v-if="tab !== 'import'" class="card aiops-kb-result">
      <header><div><h2>{{ currentTab.label }}</h2><p>{{ currentTab.hint }}</p></div><span>共 {{ total.toLocaleString() }} 条</span></header>

      <div v-if="items.length" class="table-responsive">
        <table v-if="tab === 'reports' || tab === 'documents'" class="data-table aiops-kb-table">
          <thead><tr><th>标题</th><th>业务</th><th>故障现象</th><th>原因 / 内容摘要</th><th>处置方法</th><th>来源</th></tr></thead>
          <tbody><tr v-for="(item, index) in items" :key="item.record_id || index" @click="selected = item"><td><strong>{{ title(item) }}</strong><small>{{ text(item.occurred_date) }}</small></td><td>{{ text(item.service) }}</td><td>{{ text(item.canonical_symptom_label || item.canonical_symptom) }}</td><td>{{ text(item.root_cause || item.knowledge_content || item.fault_content) }}</td><td>{{ text(item.fix_method || item.investigation_steps) }}</td><td>{{ text(item.report_file || item.source_file) }}</td></tr></tbody>
        </table>
        <table v-else-if="tab === 'repairs'" class="data-table aiops-kb-table">
          <thead><tr><th>日期</th><th>业务</th><th>故障内容</th><th>处理结果</th><th>知识价值</th><th>来源</th></tr></thead>
          <tbody><tr v-for="(item, index) in items" :key="item.record_id || index" @click="selected = item"><td>{{ text(item.occurred_date) }}</td><td>{{ text(item.service) }}</td><td><strong>{{ text(item.fault_content) }}</strong></td><td>{{ text(item.handling_result) }}</td><td><span class="status-badge">{{ text(item.knowledge_value) }}</span></td><td>{{ text(item.source_file) }}<small>{{ text(item.source_sheet, '') }}</small></td></tr></tbody>
        </table>
        <table v-else class="data-table aiops-kb-table">
          <thead><tr><th>故障主题</th><th>业务</th><th>主题来源</th><th>正式报告</th><th>值班记录</th><th>可参考案例</th><th>最近出现</th></tr></thead>
          <tbody><tr v-for="(item, index) in items" :key="item.aggregate_id || index" @click="selected = item"><td><strong>{{ title(item) }}</strong><small>{{ text(item.canonical_symptom) }}</small></td><td>{{ text(item.service) }}</td><td>{{ text(item.topic_source) }}</td><td>{{ item.formal_count || 0 }}</td><td>{{ item.duty_count || 0 }}</td><td>{{ item.reference_count || 0 }}</td><td>{{ text(item.last_seen) }}</td></tr></tbody>
        </table>
      </div>
      <div v-else-if="!loading" class="aiops-empty"><BookOpen :size="30" /><strong>当前分类没有符合条件的知识条目</strong><span>可调整查询条件后重新检索。</span></div>
      <footer class="aiops-kb-pager"><span>第 {{ page }} / {{ totalPages }} 页</span><div><button class="btn btn-secondary" :disabled="page <= 1" @click="changePage(page - 1)">上一页</button><button class="btn btn-secondary" :disabled="page >= totalPages" @click="changePage(page + 1)">下一页</button></div></footer>
    </section>

    <section v-else class="aiops-kb-import-grid">
      <article v-for="card in importCards" :key="card.key" class="card aiops-kb-import-card"><header><span><UploadCloud :size="21" /></span><div><h2>{{ card.title }}</h2><small>{{ card.tag }}</small></div></header><p>{{ card.hint }}</p><label><input type="file" :accept="card.accept" :multiple="card.multiple" @change="chooseImportFiles(card.key, $event)" /><span><UploadCloud :size="18" /><b>{{ importFiles[card.key].length ? `已选择 ${importFiles[card.key].length} 个文件` : '选择或拖入文件' }}</b><small>{{ card.accept }}</small></span></label><button class="btn btn-primary" :disabled="!importFiles[card.key].length || importing === card.key" @click="uploadImport(card.key)">{{ importing === card.key ? '正在解析并导入…' : `上传到${card.title}` }}</button></article>
      <div v-if="importResult" class="card aiops-kb-import-result"><strong>导入完成</strong><p>文件已经解析、写入 Elasticsearch，并重建故障主题聚合。</p><pre>{{ JSON.stringify(importResult.report || importResult, null, 2) }}</pre></div>
    </section>

    <div v-if="selected" class="aiops-kb-detail-mask" @click.self="selected = null">
      <aside class="aiops-kb-detail"><header><div><span>{{ currentTab.label }}</span><h2>{{ title(selected) }}</h2></div><button @click="selected = null"><X :size="20" /></button></header><dl><template v-for="(value, key) in selected" :key="key"><div v-if="value !== null && value !== '' && (!Array.isArray(value) || value.length)"><dt>{{ key }}</dt><dd>{{ text(value) }}</dd></div></template></dl></aside>
    </div>
  </div>
</template>
