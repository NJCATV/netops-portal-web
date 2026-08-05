<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { Activity, BarChart3, Bot, LogIn, RefreshCw, ShieldAlert, Users } from "lucide-vue-next";
import { api } from "../services/api";

type AuditRow = Record<string, any>;
type AuditData = {
  overview: AuditRow;
  trends: AuditRow[];
  modules: AuditRow[];
  features: AuditRow[];
  users: AuditRow[];
  items: AuditRow[];
  total: number;
  page: number;
  page_size: number;
};

const filters = reactive({ hours: 168, module: "", result: "", user_keyword: "", keyword: "" });
const data = ref<AuditData>({ overview: {}, trends: [], modules: [], features: [], users: [], items: [], total: 0, page: 1, page_size: 30 });
const page = ref(1);
const loading = ref(false);
const error = ref("");

const moduleLabels: Record<string, string> = {
  auth: "登录与认证", aiops: "AIOps", collector: "采集监控", onu: "ONU 管理", olt: "OLT 管理", hfc: "HFC 网络", boss: "BOSS 数据", access: "账号与组织", settings: "系统配置", system_audit: "系统审计", dashboard: "统一驾驶舱", platform: "平台服务"
};
const resultLabels: Record<string, string> = { success: "成功", denied: "拒绝", failed: "失败" };
const maxTrend = computed(() => Math.max(1, ...data.value.trends.map(item => Number(item.request_count || 0))));
const totalPages = computed(() => Math.max(1, Math.ceil(Number(data.value.total || 0) / Number(data.value.page_size || 30))));
const successRate = computed(() => {
  const total = Number(data.value.overview.request_count || 0);
  const failed = data.value.modules.reduce((sum, item) => sum + Number(item.failure_count || 0), 0);
  return total ? Math.max(0, Math.round((1 - failed / total) * 1000) / 10) : 100;
});

function number(value: unknown) { return new Intl.NumberFormat("zh-CN").format(Number(value || 0)); }
function time(value: unknown) { if (!value) return "-"; const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("zh-CN", { hour12: false }); }
function moduleName(value: unknown) { const key = String(value || ""); return moduleLabels[key] || key || "平台服务"; }
function resultName(value: unknown) { const key = String(value || ""); return resultLabels[key] || key || "-"; }
function actionName(value: unknown) {
  const raw = String(value || "");
  const labels: Record<string, string> = { login: "用户登录", change_password: "修改密码", run_ai_analysis: "执行 AIOps 分析", ai_chat: "AI 问答", export_quality_excel: "导出 ONU 质差 Excel", import_boss_users: "导入 BOSS 用户", dashboard_visit: "进入统一驾驶舱" };
  return labels[raw] || raw.replace(/^get:/, "查看 · ").replace(/^post:/, "提交 · ").replace(/^put:/, "更新 · ").replace(/^patch:/, "更新 · ").replace(/^delete:/, "删除 · ").replaceAll(".", " / ");
}
function identityName(item: AuditRow) {
  if (item.display_name || item.username) return item.display_name || item.username;
  if (item.client_ip === "127.0.0.1" || item.client_ip === "::1") return "系统探针";
  return "未认证访问";
}
function identityDetail(item: AuditRow) {
  if (item.username) return `${item.username} · ${item.role_code || "-"}`;
  if (item.user_id) return `用户 ${item.user_id} · ${item.role_code || "-"}`;
  return "未绑定平台账号";
}
function trendHeight(item: AuditRow) { return `${Math.max(5, Math.round(Number(item.request_count || 0) / maxTrend.value * 100))}%`; }
function query(pageValue = page.value) {
  const params = new URLSearchParams({ hours: String(filters.hours), page: String(pageValue), page_size: "30" });
  if (filters.module) params.set("module", filters.module);
  if (filters.result) params.set("result", filters.result);
  if (filters.user_keyword.trim()) params.set("user_keyword", filters.user_keyword.trim());
  if (filters.keyword.trim()) params.set("keyword", filters.keyword.trim());
  return params.toString();
}
async function load(pageValue = 1) {
  loading.value = true; error.value = ""; page.value = pageValue;
  try { data.value = await api<AuditData>(`/system/audit?${query(pageValue)}`); }
  catch (err) { error.value = err instanceof Error ? err.message : "系统审计数据加载失败"; }
  finally { loading.value = false; }
}
function reset() { filters.module = ""; filters.result = ""; filters.user_keyword = ""; filters.keyword = ""; void load(); }

onMounted(() => { void load(); });
</script>

<template>
  <div class="system-audit-page" :class="{ loading }">
    <section class="page-heading system-audit-heading">
      <div><span>系统管理 / 超级管理员</span><h1>系统审计与使用分析</h1><p>记录平台登录和功能调用，不记录密码、令牌、查询值或请求正文。</p></div>
      <button class="btn btn-secondary" :disabled="loading" @click="load(page)"><RefreshCw :size="15" />刷新</button>
    </section>

    <section class="card system-audit-filter">
      <label><span>查询范围</span><select v-model.number="filters.hours"><option :value="24">近 24 小时</option><option :value="168">近 7 天</option><option :value="720">近 30 天</option><option :value="2160">近 90 天</option></select></label>
      <label><span>功能模块</span><select v-model="filters.module"><option value="">全部模块</option><option v-for="item in data.modules" :key="item.module" :value="item.module">{{ moduleName(item.module) }}</option></select></label>
      <label><span>执行结果</span><select v-model="filters.result"><option value="">全部结果</option><option value="success">成功</option><option value="denied">拒绝</option><option value="failed">失败</option></select></label>
      <label><span>用户搜索</span><input v-model="filters.user_keyword" placeholder="姓名、账号或用户 ID" @keyup.enter="load()" /></label>
      <label class="system-audit-search"><span>功能关键词</span><input v-model="filters.keyword" placeholder="功能或请求路径" @keyup.enter="load()" /></label>
      <div class="system-audit-filter-actions"><button class="btn btn-primary" :disabled="loading" @click="load()">查询</button><button class="btn btn-secondary" :disabled="loading" @click="reset">重置</button></div>
    </section>

    <div v-if="error" class="notice error">{{ error }}</div>

    <section class="system-audit-kpis">
      <article><span><Activity :size="19" /></span><div><small>功能调用请求</small><strong>{{ number(data.overview.request_count) }}</strong><em>当前筛选范围内</em></div></article>
      <article><span><Users :size="19" /></span><div><small>活跃用户</small><strong>{{ number(data.overview.active_users) }}</strong><em>已认证平台账号</em></div></article>
      <article><span><LogIn :size="19" /></span><div><small>登录成功 / 失败</small><strong>{{ number(data.overview.login_success) }} / {{ number(data.overview.login_failed) }}</strong><em>含失败登录审计</em></div></article>
      <article><span><Bot :size="19" /></span><div><small>AIOps 使用次数</small><strong>{{ number(data.overview.aiops_requests) }}</strong><em>分析、问答、日志等</em></div></article>
      <article><span><ShieldAlert :size="19" /></span><div><small>请求成功率</small><strong>{{ successRate }}%</strong><em>接口结果统计</em></div></article>
    </section>

    <section class="system-audit-grid">
      <article class="card system-audit-trend"><header><div><h2>使用趋势</h2><p>按天统计平台功能调用和活跃用户。</p></div><BarChart3 :size="20" /></header><div v-if="data.trends.length" class="system-audit-bars"><div v-for="item in data.trends" :key="item.day" class="system-audit-bar"><span>{{ number(item.request_count) }}</span><i :style="{ height: trendHeight(item) }"></i><small>{{ String(item.day).slice(5) }}</small></div></div><div v-else class="system-audit-empty">当前范围暂无审计记录</div></article>
      <article class="card system-audit-module"><header><div><h2>模块使用分布</h2><p>按 API 调用次数统计，帮助识别高频功能。</p></div></header><div v-if="data.modules.length" class="system-audit-module-list"><div v-for="item in data.modules" :key="item.module"><span>{{ moduleName(item.module) }}</span><b>{{ number(item.request_count) }}</b><small>{{ number(item.active_users) }} 位用户 · {{ number(item.failure_count) }} 异常</small><i><em :style="{ width: `${Math.max(4, Number(item.request_count || 0) / Math.max(1, Number(data.modules[0]?.request_count || 0)) * 100)}%` }"></em></i></div></div><div v-else class="system-audit-empty">暂无模块调用数据</div></article>
    </section>

    <section class="system-audit-grid system-audit-secondary-grid">
      <article class="card system-audit-feature"><header><div><h2>高频功能</h2><p>功能调用次数与最后一次使用时间。</p></div></header><ol><li v-for="item in data.features" :key="`${item.module}-${item.action}`"><b>{{ actionName(item.action) }}</b><span>{{ moduleName(item.module) }} · {{ number(item.request_count) }} 次 · {{ number(item.active_users) }} 人</span><small>{{ time(item.last_used_at) }}</small></li><li v-if="!data.features.length" class="system-audit-empty">暂无功能使用数据</li></ol></article>
      <article class="card system-audit-user"><header><div><h2>用户使用情况</h2><p>当前筛选范围内调用次数最多的账号。</p></div></header><ol><li v-for="item in data.users" :key="item.user_id"><b>{{ item.display_name || item.username || `用户 ${item.user_id}` }}</b><span>{{ item.role_code || "-" }} · {{ item.org_name || "未分配组织" }}</span><small>{{ number(item.request_count) }} 次 · {{ time(item.last_used_at) }}</small></li><li v-if="!data.users.length" class="system-audit-empty">暂无认证用户使用记录</li></ol></article>
    </section>

    <section class="card system-audit-log"><header><div><h2>审计明细</h2><p>共 {{ number(data.total) }} 条；仅保存路由、结果和必要身份信息。</p></div></header><div class="table-scroll"><table class="data-table"><thead><tr><th>时间</th><th>用户</th><th>模块 / 功能</th><th>结果</th><th>请求</th><th>耗时</th><th>来源 IP</th></tr></thead><tbody><tr v-for="item in data.items" :key="item.id"><td>{{ time(item.occurred_at) }}</td><td><strong>{{ item.display_name || item.username || "匿名" }}</strong><small>{{ item.username || "-" }} · {{ item.role_code || "-" }}</small></td><td><strong>{{ moduleName(item.module) }}</strong><small>{{ actionName(item.action) }}</small></td><td><span :class="['system-audit-result', item.result]">{{ resultName(item.result) }}</span><small>HTTP {{ item.status_code }}</small></td><td><code>{{ item.method }} {{ item.request_path }}</code></td><td>{{ item.duration_ms == null ? "-" : `${item.duration_ms} ms` }}</td><td>{{ item.client_ip || "-" }}</td></tr></tbody></table></div><div v-if="!loading && !data.items.length" class="system-audit-empty">当前筛选条件下暂无日志</div><footer><button class="btn btn-secondary" :disabled="page <= 1 || loading" @click="load(page - 1)">上一页</button><span>第 {{ page }} / {{ totalPages }} 页</span><button class="btn btn-secondary" :disabled="page >= totalPages || loading" @click="load(page + 1)">下一页</button></footer></section>
  </div>
</template>
