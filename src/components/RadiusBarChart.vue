<script setup lang="ts">
import * as echarts from "echarts";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { RadiusRow } from "../services/radiusApi";

const props = withDefaults(defineProps<{ items: RadiusRow[]; labelKey: string; valueKey: string; color?: string }>(), { color: "#2563eb" });
const chartEl = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

function render() {
  if (!chartEl.value) return;
  if (!chart) chart = echarts.init(chartEl.value);
  const rows = props.items.slice(0, 12).reverse();
  chart.setOption({
    animationDuration: 420,
    grid: { left: 12, right: 28, top: 14, bottom: 12, containLabel: true },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, confine: true },
    xAxis: { type: "value", axisLabel: { color: "#64748b" }, splitLine: { lineStyle: { color: "#edf2f7", type: "dashed" } } },
    yAxis: { type: "category", data: rows.map(row => String(row[props.labelKey] || "未知").slice(0, 24)), axisLabel: { color: "#64748b", width: 150, overflow: "truncate" }, axisLine: { show: false }, axisTick: { show: false } },
    series: [{ type: "bar", data: rows.map(row => Number(row[props.valueKey] || 0)), barMaxWidth: 20, itemStyle: { color: props.color, borderRadius: [0, 5, 5, 0] }, label: { show: true, position: "right", color: "#475569", fontSize: 10 } }]
  }, true);
}
const resize = () => chart?.resize();
onMounted(() => { render(); window.addEventListener("resize", resize); });
watch(() => [props.items, props.labelKey, props.valueKey, props.color], render, { deep: true });
onBeforeUnmount(() => { window.removeEventListener("resize", resize); chart?.dispose(); });
</script>

<template><div ref="chartEl" class="radius-bar-chart"></div></template>
