<script setup lang="ts">
defineProps<{ title?: string; description?: string }>();
</script>

<template>
  <div class="empty-state">
    <div class="empty-illustration"></div>
    <strong>{{ title || "暂无数据" }}</strong>
    <p>{{ description || "请调整查询条件后重试。" }}</p>
  </div>
</template>
