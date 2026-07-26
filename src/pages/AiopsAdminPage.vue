<script setup lang="ts">
import { Bot, BrainCircuit, Database, ExternalLink, LogIn, MessageSquareText, ScrollText, Settings2, ShieldCheck } from "lucide-vue-next";
import AiopsAdminTabs from "../components/AiopsAdminTabs.vue";

const managementCards = [
  { path: "/aiops/models", title: "模型与供应商", text: "维护模型端点、健康状态和分析/问答用途绑定。", icon: BrainCircuit },
  { path: "/aiops/settings", title: "AIOps 运行设置", text: "管理分析窗口、刷新策略和 QQ 机器人运行状态。", icon: Settings2 },
];
const auditCards = [
  { path: "/aiops/audit?tab=chat", title: "AI 问答日志", text: "查看统一平台 AI 问答会话、消息数和最近内容。", icon: MessageSquareText },
  { path: "/aiops/audit?tab=qq", title: "QQ 问答审计", text: "查看群、用户、问题、回复结果和调用耗时。", icon: Bot },
  { path: "/aiops/audit?tab=operation", title: "AIOps 操作日志", text: "追踪模型、规则、任务和系统设置的变更记录。", icon: ScrollText },
  { path: "/aiops/audit?tab=login", title: "统一登录日志", text: "查看平台身份、角色、组织、来源 IP 和认证结果。", icon: LogIn },
];
</script>

<template>
  <div class="aiops-page">
    <section class="aiops-page-head ai-admin-head"><div><span>AIOps · SYSTEM CONTROL</span><h1>AIOps 系统管理</h1><p>作为整个网管“系统管理”的子模块，统一维护模型、运行参数和四类审计日志。</p></div><ShieldCheck :size="32" /></section>
    <AiopsAdminTabs />
    <section class="aiops-admin-grid">
      <div class="aiops-admin-section-title"><h2>模型与运行</h2><p>配置 AI 能力、用途绑定和运行参数。</p></div>
      <RouterLink v-for="card in managementCards" :key="card.path" :to="card.path" class="card aiops-admin-card-link"><span><component :is="card.icon" :size="23" /></span><div><h2>{{ card.title }}</h2><p>{{ card.text }}</p><b>进入管理 →</b></div></RouterLink>
      <article class="card aiops-admin-card-link"><span><Database :size="23" /></span><div><h2>数据与服务</h2><p>MySQL、Elasticsearch、Scheduler 与 QQ Adapter 由 20 服务器承载。</p><b>统一运行架构</b></div></article>
      <a class="card aiops-admin-card-link" href="/2026/legacy-aiops/" target="_blank" rel="noopener"><span><ExternalLink :size="23" /></span><div><h2>旧版入口</h2><p>在统一登录保护下查看原版完整页面；浏览器不会直接访问 20 服务器。</p><b>打开原版页面 →</b></div></a>
      <div class="aiops-admin-section-title"><h2>审计与日志</h2><p>按原 AIOps 系统分类查看，不再混成一张无结构页面。</p></div>
      <RouterLink v-for="card in auditCards" :key="card.path" :to="card.path" class="card aiops-admin-card-link"><span><component :is="card.icon" :size="23" /></span><div><h2>{{ card.title }}</h2><p>{{ card.text }}</p><b>查看日志 →</b></div></RouterLink>
    </section>
  </div>
</template>
