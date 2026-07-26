<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number;
  hint?: string;
  tone?: "blue" | "green" | "orange" | "red" | "slate";
}>();
</script>

<template>
  <article class="stat-card" :class="tone ? `stat-${tone}` : 'stat-blue'">
    <div class="stat-head">
      <span>{{ label }}</span>
      <i></i>
    </div>
    <strong>{{ value }}</strong>
    <p v-if="hint">{{ hint }}</p>
  </article>
</template>
