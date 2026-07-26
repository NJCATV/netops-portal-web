<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { ChevronLeft, ChevronRight, History } from "lucide-vue-next";

type Run = Record<string, any>;
const props = defineProps<{ runs: Run[]; selectedUid?: string }>();
const emit = defineEmits<{ select: [run: Run] }>();
const viewport = ref<HTMLElement | null>(null);
const selectedIndex = computed(() => Math.max(0, props.runs.findIndex((run) => run.run_uid === props.selectedUid)));

function datePart(value: unknown) {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function timePart(value: unknown) {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function scroll(direction: -1 | 1) {
  const element = viewport.value;
  if (!element) return;
  element.scrollBy({ left: direction * Math.max(300, element.clientWidth * 0.78), behavior: "smooth" });
}

watch(() => props.selectedUid, async (uid) => {
  await nextTick();
  if (!uid || !viewport.value) return;
  viewport.value.querySelector<HTMLElement>(`[data-run-uid="${CSS.escape(uid)}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
});
</script>

<template>
  <section class="ai-run-carousel" aria-label="AI 分析历史选择器">
    <header>
      <span class="ai-run-carousel-icon"><History :size="18" /></span>
      <div><strong>分析结果</strong><small>选择历史节点查看当时的完整 AI 研判</small></div>
      <em>{{ runs.length ? selectedIndex + 1 : 0 }} / {{ runs.length }}</em>
      <nav><button title="较新的分析" @click="scroll(-1)"><ChevronLeft :size="17" /></button><button title="更早的分析" @click="scroll(1)"><ChevronRight :size="17" /></button></nav>
    </header>
    <div ref="viewport" class="ai-run-carousel-viewport">
      <div class="ai-run-carousel-track">
        <button v-for="run in runs" :key="run.run_uid" :data-run-uid="run.run_uid" :class="{ active: run.run_uid === selectedUid }" @click="emit('select', run)">
          <span><b>{{ datePart(run.created_at) }}</b><time>{{ timePart(run.created_at) }}</time></span>
          <strong>{{ run.overall_title || "AI 分析结果" }}</strong>
          <small>{{ run.hours || "—" }} 小时窗口 · {{ run.model_name || "智能分析" }}</small>
          <i>{{ run.run_uid === selectedUid ? "当前查看" : "查看报告" }}</i>
        </button>
      </div>
    </div>
  </section>
</template>
