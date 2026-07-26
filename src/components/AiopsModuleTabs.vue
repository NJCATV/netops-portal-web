<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { me } from "../services/api";

type Tab = { path: string; label: string; roles?: string[] };
const role = ref("normal_user");
const tabs: Tab[] = [
  { path: "/aiops", label: "态势总览" },
  { path: "/aiops/analysis", label: "分析历史" },
  { path: "/aiops/events", label: "聚合事件" },
  { path: "/aiops/syslog", label: "Syslog" },
  { path: "/aiops/trap", label: "Trap" },
  { path: "/aiops/rules", label: "规则配置", roles: ["org_admin", "super_admin"] },
  { path: "/aiops/tasks", label: "定时任务", roles: ["org_admin", "super_admin"] },
];
const visibleTabs = computed(() => tabs.filter(tab => !tab.roles || tab.roles.includes(role.value)));

onMounted(async () => {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "aiops") {
    role.value = "super_admin";
    return;
  }
  try {
    const data = await me();
    role.value = ("user" in data ? data.user : data).role_code || "normal_user";
  } catch {
    role.value = "normal_user";
  }
});
</script>

<template>
  <nav class="aiops-tabs" aria-label="AIOps 模块导航">
    <RouterLink v-for="tab in visibleTabs" :key="tab.path" :to="tab.path">{{ tab.label }}</RouterLink>
  </nav>
</template>
