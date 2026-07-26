<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import { Bot, Clock3, MessageSquarePlus, Send, Sparkles, Trash2 } from "lucide-vue-next";
import { aiopsApi, type AiChatMessage, type AiChatSession } from "../services/aiopsApi";

const sessions = ref<AiChatSession[]>([]);
const messages = ref<AiChatMessage[]>([]);
const currentSessionId = ref<number | null>(null);
const input = ref("");
const sending = ref(false);
const error = ref("");
const messagePanel = ref<HTMLElement | null>(null);

function formatTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}

async function scrollBottom() {
  await nextTick();
  if (messagePanel.value) messagePanel.value.scrollTop = messagePanel.value.scrollHeight;
}

async function loadSessions() {
  const result = await aiopsApi<{ items: AiChatSession[] }>("/fault-kb/chat/sessions?limit=30");
  sessions.value = result.items || [];
}

async function openSession(id: number) {
  error.value = "";
  try {
    const result = await aiopsApi<{ session: AiChatSession; messages: AiChatMessage[] }>(`/fault-kb/chat/sessions/${id}`);
    currentSessionId.value = result.session.id;
    messages.value = result.messages || [];
    scrollBottom();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "历史对话加载失败";
  }
}

function newChat() {
  currentSessionId.value = null;
  messages.value = [];
  input.value = "";
  error.value = "";
}

async function deleteSession(id: number) {
  await aiopsApi(`/fault-kb/chat/sessions/${id}`, { method: "DELETE" });
  if (currentSessionId.value === id) newChat();
  await loadSessions();
}

async function send() {
  const content = input.value.trim();
  if (!content || sending.value) return;
  error.value = "";
  messages.value.push({ role: "user", content, created_at: new Date().toISOString() });
  input.value = "";
  sending.value = true;
  scrollBottom();
  try {
    const result = await aiopsApi<{ session_id: number; answer: string; evidence?: Record<string, unknown>; model_error?: string; created_at?: string }>("/fault-kb/chat", {
      method: "POST",
      body: JSON.stringify({ message: content, limit: 10, session_id: currentSessionId.value }),
    });
    currentSessionId.value = result.session_id || currentSessionId.value;
    messages.value.push({ role: "assistant", content: result.answer || "暂时没有生成回答。", evidence: result.evidence, model_error: result.model_error, created_at: result.created_at });
    await loadSessions();
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI 助手调用失败";
    error.value = message;
    messages.value.push({ role: "assistant", content: `本次问答失败：${message}` });
  } finally {
    sending.value = false;
    scrollBottom();
  }
}

onMounted(async () => {
  try { await loadSessions(); } catch (err) { error.value = err instanceof Error ? err.message : "会话加载失败"; }
});
</script>

<template>
  <div class="assistant-page">
    <aside class="assistant-history card">
      <header><div><Sparkles :size="18" /><strong>AI 运维助手</strong></div><button class="round-icon-btn" title="新建对话" @click="newChat"><MessageSquarePlus :size="17" /></button></header>
      <button class="assistant-new" @click="newChat"><MessageSquarePlus :size="16" />新对话</button>
      <div class="assistant-session-list">
        <article v-for="session in sessions" :key="session.id" :class="{ active: currentSessionId === session.id }">
          <button @click="openSession(session.id)"><strong>{{ session.title }}</strong><span><Clock3 :size="12" />{{ formatTime(session.last_message_at) }} · {{ session.message_count }} 条</span></button>
          <button title="删除对话" @click="deleteSession(session.id)"><Trash2 :size="14" /></button>
        </article>
        <div v-if="!sessions.length" class="assistant-history-empty">暂无历史对话</div>
      </div>
    </aside>

    <section class="assistant-workspace card">
      <header><div class="assistant-avatar"><Bot :size="23" /></div><div><h1>AI 运维助手</h1><p>基于故障报告、值班报修经验和 AIOps 分析工具回答</p></div><span>统一账号 · 权限隔离</span></header>
      <div ref="messagePanel" class="assistant-messages">
        <section v-if="!messages.length" class="assistant-welcome">
          <span><Bot :size="34" /></span><h2>今天需要排查什么问题？</h2><p>可以描述用户现象、设备告警或业务影响，助手会自动判断是否需要检索故障知识库。</p>
          <div><button @click="input='用户反馈点播卡顿，应该按什么顺序排查？'">点播卡顿怎么排查？</button><button @click="input='宽带测速不达标有哪些常见原因？'">宽带测速不达标</button><button @click="input='帮我总结最近的高风险告警'">总结高风险告警</button></div>
        </section>
        <article v-for="(message, index) in messages" :key="message.id || index" :class="['assistant-message', message.role]">
          <span>{{ message.role === "user" ? "我" : "AI" }}</span>
          <div><p>{{ message.content }}</p><small v-if="message.created_at">{{ formatTime(message.created_at) }}</small><small v-if="message.model_error" class="error">模型调用异常：{{ message.model_error }}</small></div>
        </article>
        <article v-if="sending" class="assistant-message assistant"><span>AI</span><div class="assistant-thinking"><i></i><i></i><i></i><small>正在分析问题和相关知识...</small></div></article>
      </div>
      <div v-if="error" class="assistant-error">{{ error }}</div>
      <form class="assistant-composer" @submit.prevent="send">
        <textarea v-model="input" rows="3" placeholder="输入问题，Shift + Enter 发送" @keydown.shift.enter.prevent="send"></textarea>
        <div><span>回答可能包含 AI 推断，请结合原始证据核实。</span><button class="btn btn-primary" :disabled="sending || !input.trim()"><Send :size="16" />发送</button></div>
      </form>
    </section>
  </div>
</template>
