<script setup lang="ts">
const tabs = [
  { path: "/aiops/admin", label: "管理总览" },
  { path: "/aiops/models", label: "模型管理" },
  { path: "/aiops/settings", label: "系统设置" },
  { path: "/aiops/audit", label: "审计日志" },
];
</script>

<template>
  <nav class="aiops-tabs aiops-admin-tabs" aria-label="AIOps 系统管理导航">
    <RouterLink v-for="tab in tabs" :key="tab.path" :to="tab.path">{{ tab.label }}</RouterLink>
  </nav>
</template>
