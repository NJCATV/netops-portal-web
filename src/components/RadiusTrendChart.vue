<script setup lang="ts">
import * as echarts from "echarts";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { RadiusRow } from "../services/radiusApi";

const props = defineProps<{ points: RadiusRow[]; kind?: "auth" | "traffic" }>();
const chartEl = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;
const number = (value: unknown) => Number(value || 0);
const bytes = (value: unknown) => {
  let amount = number(value);
  for (const unit of ["B", "KB", "MB", "GB", "TB"]) {
    if (amount < 1024) return `${amount.toFixed(unit === "B" ? 0 : 1)} ${unit}`;
    amount /= 1024;
  }
  return `${amount.toFixed(1)} PB`;
};

function render() {
  if (!chartEl.value) return;
  if (!chart) chart = echarts.init(chartEl.value);
  const traffic = props.kind === "traffic";
  chart.setOption({
    animationDuration: 450,
    color: traffic ? ["#2563eb", "#10b981"] : ["#10b981", "#ef4444"],
    grid: { left: 36, right: 24, top: 42, bottom: 35, containLabel: true },
    tooltip: traffic ? {
      trigger: "axis",
      confine: true,
      formatter: (raw: unknown) => {
        const rows = (Array.isArray(raw) ? raw : [raw]) as Array<Record<string, unknown>>;
        const bucket = String(rows[0]?.axisValue || "-");
        const total = rows.reduce((sum, row) => sum + number(row.value), 0);
        return `${bucket}<br/>${rows.map(row => `${String(row.marker || "")} ${String(row.seriesName || "")}: <b>${bytes(row.value)}</b>`).join("<br/>")}<br/><span style="color:#64748b">本 10 分钟合计：${bytes(total)}</span>`;
      }
    } : { trigger: "axis", confine: true },
    legend: { top: 4, right: 8, textStyle: { color: "#64748b" } },
    graphic: traffic ? [{
      type: "group",
      left: 58,
      top: 8,
      silent: true,
      children: [
        { type: "rect", shape: { width: 320, height: 34, r: 6 }, style: { fill: "rgba(239,246,255,.92)", stroke: "#bfdbfe", lineWidth: 1 } },
        { type: "text", style: { x: 9, y: 8, text: "每个点 = 该 10 分钟全网流量增量", fill: "#334155", font: "600 11px sans-serif" } },
        { type: "text", style: { x: 9, y: 21, text: "首尾低值通常是未满 10 分钟的时间桶", fill: "#64748b", font: "10px sans-serif" } }
      ]
    }] : [],
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
        formatter: traffic ? (value: number) => bytes(value) : undefined
      },
      splitLine: { lineStyle: { color: "#e8edf5", type: "dashed" } }
    },
    series: traffic
      ? [
          { name: "下行（每 10 分钟）", type: "line", smooth: false, showSymbol: false, areaStyle: { opacity: .1 }, data: props.points.map(row => number(row.output_bytes)) },
          { name: "上行（每 10 分钟）", type: "line", smooth: false, showSymbol: false, data: props.points.map(row => number(row.input_bytes)) }
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
