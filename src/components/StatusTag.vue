<script setup lang="ts">
const props = defineProps<{
  value?: string | number | boolean | null;
  tone?: "ok" | "warn" | "danger" | "info" | "muted";
}>();

function normalize() {
  const raw = String(props.value ?? "-");
  if (props.tone) return { text: raw, tone: props.tone };
  if (["success", "正常", "online", "1", "true"].includes(raw)) return { text: raw === "1" ? "在线" : raw, tone: "ok" };
  if (["running", "partial", "实时刷新中"].includes(raw)) return { text: raw, tone: "info" };
  if (["fail", "failed", "error", "offline", "0", "false"].includes(raw)) return { text: raw === "0" ? "离线" : raw, tone: "danger" };
  if (raw.includes("告警") || raw.includes("质差") || raw.includes("rx_")) return { text: raw, tone: "warn" };
  return { text: raw, tone: "muted" };
}
</script>

<template>
  <span class="status-tag" :class="`tag-${normalize().tone}`">{{ normalize().text }}</span>
</template>
