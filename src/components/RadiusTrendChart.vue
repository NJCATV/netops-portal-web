<script setup lang="ts">
import * as echarts from "echarts";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { RadiusRow } from "../services/radiusApi";

const props = defineProps<{ points: RadiusRow[]; kind?: "auth" | "traffic" }>();
const chartEl = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;
const number = (value: unknown) => Number(value || 0);

function render() {
  if (!chartEl.value) return;
  if (!chart) chart = echarts.init(chartEl.value);
  const traffic = props.kind === "traffic";
  chart.setOption({
    animationDuration: 450,
    color: traffic ? ["#2563eb", "#10b981"] : ["#10b981", "#ef4444"],
    grid: { left: 36, right: 24, top: 42, bottom: 35, containLabel: true },
    tooltip: { trigger: "axis", confine: true },
    legend: { top: 4, right: 8, textStyle: { color: "#64748b" } },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: props.points.map(row => String(row.bucket || "")),
      axisLabel: { color: "#64748b", hideOverlap: true },
      axisLine: { lineStyle: { color: "#dbe3ee" } }
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: "#64748b",
        formatter: traffic ? (value: number) => `${(value / 1024 / 1024).toFixed(0)}M` : undefined
      },
      splitLine: { lineStyle: { color: "#e8edf5", type: "dashed" } }
    },
    series: traffic
      ? [
          { name: "下行", type: "line", smooth: true, showSymbol: false, areaStyle: { opacity: .1 }, data: props.points.map(row => number(row.output_bytes)) },
          { name: "上行", type: "line", smooth: true, showSymbol: false, data: props.points.map(row => number(row.input_bytes)) }
        ]
      : [
          { name: "认证通过", type: "line", smooth: true, showSymbol: false, areaStyle: { opacity: .1 }, data: props.points.map(row => number(row.accepts)) },
          { name: "认证拒绝", type: "line", smooth: true, showSymbol: false, data: props.points.map(row => number(row.rejects)) }
        ]
  }, true);
}

const resize = () => chart?.resize();
onMounted(() => { render(); window.addEventListener("resize", resize); });
watch(() => [props.points, props.kind], render, { deep: true });
onBeforeUnmount(() => { window.removeEventListener("resize", resize); chart?.dispose(); });
</script>

<template><div ref="chartEl" class="radius-trend-chart"></div></template>
