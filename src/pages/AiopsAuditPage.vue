<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Bot, LogIn, MessageSquareText, RefreshCw, ScrollText } from "lucide-vue-next";
import AiopsAdminTabs from "../components/AiopsAdminTabs.vue";
import { aiopsApi } from "../services/aiopsApi";

type Audit = Record<string, any>;
type AuditTab = "operation" | "chat" | "qq" | "login";
const route = useRoute();
const router = useRouter();
const operations = ref<Audit[]>([]);
const chats = ref<Audit[]>([]);
const qq = ref<Audit[]>([]);
const logins = ref<Audit[]>([]);
const active = ref<AuditTab>("operation");
const loading = ref(false);
const error = ref("");
const tabs = computed(() => [
  { key: "chat" as AuditTab, label: "AI 问答日志", count: chats.value.length, icon: MessageSquareText },
  { key: "qq" as AuditTab, label: "QQ 问答审计", count: qq.value.length, icon: Bot },
  { key: "operation" as AuditTab, label: "操作日志", count: operations.value.length, icon: ScrollText },
  { key: "login" as AuditTab, label: "登录日志", count: logins.value.length, icon: LogIn },
]);
function normalizeTab(value: unknown): AuditTab { return ["operation", "chat", "qq", "login"].includes(String(value)) ? String(value) as AuditTab : "operation"; }
function time(value: unknown) { if (!value) return "-"; const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("zh-CN", { hour12: false }); }
function chatPreview(item: Audit) { const messages = item.latest_messages; return Array.isArray(messages) && messages.length ? messages.map((message: any) => `${message.role === "user" ? "问" : "答"}：${message.content || ""}`).join(" / ") : "暂无消息摘要"; }
function switchTab(tab: AuditTab) { active.value = tab; void router.replace({ query: { ...route.query, tab } }); }
async function load() {
  loading.value = true; error.value = "";
  try {
    const [operationData, chatData, qqData, loginData] = await Promise.all([
      aiopsApi<{items: Audit[]}>("/system/operation-logs?limit=100"),
      aiopsApi<{items: Audit[]}>("/fault-kb/chat/logs?limit=100"),
      aiopsApi<{items: Audit[]}>("/system/qq-audit-logs?limit=100"),
      aiopsApi<{items: Audit[]}>("/system/login-logs?limit=100"),
    ]);
    operations.value = operationData.items || [];
    chats.value = chatData.items || [];
    qq.value = qqData.items || [];
    logins.value = loginData.items || [];
  } catch (err) { error.value = err instanceof Error ? err.message : "审计日志加载失败"; }
  finally { loading.value = false; }
}
watch(() => route.query.tab, value => { active.value = normalizeTab(value); }, { immediate: true });
onMounted(load);
</script>

<template>
  <div class="aiops-page" :class="{ loading }">
    <section class="aiops-page-head"><div><span>AIOps · 安全治理</span><h1>审计与日志</h1><p>恢复原 AIOps 的四类日志视图，分别查看 AI 问答、QQ 问答、管理操作和统一登录。</p></div><button class="btn btn-secondary" @click="load"><RefreshCw :size="15" />刷新</button></section>
    <AiopsAdminTabs />
    <div v-if="error" class="aiops-notice error">{{ error }}</div>
    <section class="aiops-audit-summary"><button v-for="tab in tabs" :key="tab.key" :class="{ active: active === tab.key }" @click="switchTab(tab.key)"><span><component :is="tab.icon" :size="18" /></span><div><strong>{{ tab.count }}</strong><small>{{ tab.label }}</small></div></button></section>
    <section class="card aiops-audit">
      <nav><button v-for="tab in tabs" :key="tab.key" :class="{ active: active === tab.key }" @click="switchTab(tab.key)"><component :is="tab.icon" :size="16" />{{ tab.label }} <b>{{ tab.count }}</b></button></nav>
      <div class="table-scroll">
        <table v-if="active === 'chat'" class="data-table aiops-table"><thead><tr><th>最近时间</th><th>平台用户</th><th>会话</th><th>消息数</th><th>最近问答</th></tr></thead><tbody><tr v-for="item in chats" :key="item.id"><td>{{ time(item.last_message_at || item.updated_at) }}</td><td>{{ item.username || '-' }}</td><td><strong>{{ item.title || `会话 ${item.id}` }}</strong></td><td>{{ item.message_count || 0 }}</td><td class="aiops-raw-cell">{{ chatPreview(item) }}</td></tr></tbody></table>
        <table v-else-if="active === 'qq'" class="data-table aiops-table"><thead><tr><th>时间</th><th>事件 / 结果</th><th>群 / 用户</th><th>问题</th><th>回答摘要</th><th>耗时</th></tr></thead><tbody><tr v-for="item in qq" :key="item.id"><td>{{ time(item.ts) }}</td><td><strong>{{ item.event || '-' }}</strong><small>{{ item.status || item.reason || '-' }}</small></td><td>{{ item.group_id || '-' }} / {{ item.user_id || '-' }}</td><td class="aiops-raw-cell">{{ item.question || '-' }}</td><td class="aiops-raw-cell">{{ item.answer_preview || item.error || '-' }}</td><td>{{ item.duration_ms ? `${item.duration_ms} ms` : '-' }}</td></tr></tbody></table>
        <table v-else-if="active === 'operation'" class="data-table aiops-table"><thead><tr><th>时间</th><th>操作者</th><th>动作</th><th>资源</th><th>来源 IP</th><th>详情</th></tr></thead><tbody><tr v-for="item in operations" :key="item.id"><td>{{ time(item.created_at) }}</td><td>{{ item.actor || '-' }}</td><td><strong>{{ item.action || '-' }}</strong></td><td>{{ item.resource_type || '-' }} / {{ item.resource_id || '-' }}</td><td>{{ item.client_ip || '-' }}</td><td class="aiops-raw-cell">{{ item.detail ? JSON.stringify(item.detail) : '-' }}</td></tr></tbody></table>
        <table v-else class="data-table aiops-table"><thead><tr><th>时间</th><th>账号</th><th>结果</th><th>角色 / 组织</th><th>来源 IP</th><th>说明</th></tr></thead><tbody><tr v-for="item in logins" :key="item.id"><td>{{ time(item.created_at || item.ts) }}</td><td>{{ item.username || '-' }}</td><td><strong>{{ item.status || '-' }}</strong></td><td>{{ item.role_code || '-' }} / {{ item.org_name || '-' }}</td><td>{{ item.client_ip || '-' }}</td><td>{{ item.reason || '-' }}</td></tr></tbody></table>
      </div>
      <div v-if="!loading && !tabs.find(tab => tab.key === active)?.count" class="aiops-empty"><strong>当前分类暂无日志</strong><span>这表示接口已正常返回，但尚未产生对应记录。</span></div>
    </section>
  </div>
</template>
