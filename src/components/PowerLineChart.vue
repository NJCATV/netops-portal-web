<script setup lang="ts">
import * as echarts from "echarts";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { HistoryPoint } from "../types";

const props = defineProps<{ points: HistoryPoint[]; height?: number }>();

const chartEl = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function labelTime(value: unknown) {
  const text = String(value || "");
  return text.length > 10 ? text.slice(5, 16) : text;
}

function render() {
  if (!chartEl.value) return;
  if (!chart) chart = echarts.init(chartEl.value);

  const points = props.points || [];
  const dates = points.map((item) => String(item.sample_time || ""));
  const rx = points.map((item) => num(item.rx_power));
  const tx = points.map((item) => num(item.tx_power));
  const zoomStart = points.length > 96 ? Math.max(0, 100 - (96 / points.length) * 100) : 0;

  chart.setOption({
    animationDuration: 650,
    color: ["#2563eb", "#16a34a"],
    grid: { left: 42, right: 18, top: 24, bottom: points.length > 24 ? 46 : 28, containLabel: true },
    tooltip: {
      trigger: "axis",
      confine: true,
      backgroundColor: "rgba(255, 255, 255, .96)",
      borderColor: "rgba(148, 163, 184, .32)",
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: "#0f172a", fontSize: 12, fontWeight: 700 },
      axisPointer: { type: "line", lineStyle: { color: "#94a3b8", type: "dashed" } },
      valueFormatter: (value: unknown) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? `${parsed.toFixed(2)} dBm` : "-";
      }
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: dates,
      axisLine: { lineStyle: { color: "#e2e8f0" } },
      axisTick: { show: false },
      axisLabel: { color: "#64748b", formatter: labelTime, hideOverlap: true }
    },
    yAxis: {
      type: "value",
      min: (value: { min: number }) => Math.min(-35, Math.floor(value.min / 5) * 5),
      max: (value: { max: number }) => Math.max(5, Math.ceil(value.max / 5) * 5),
      splitNumber: 4,
      axisLabel: { color: "#64748b", formatter: "{value}" },
      splitLine: { lineStyle: { color: "#e8edf5", type: "dashed" } }
    },
    dataZoom: [
      { type: "inside", start: zoomStart, end: 100, throttle: 50, zoomOnMouseWheel: true, moveOnMouseMove: true },
      {
        show: points.length > 24,
        type: "slider",
        start: zoomStart,
        end: 100,
        height: 16,
        bottom: 10,
        borderColor: "transparent",
        fillerColor: "rgba(37, 99, 235, .14)",
        handleSize: 14,
        handleStyle: { color: "#2563eb" },
        brushSelect: false,
        dataBackground: { lineStyle: { color: "#bfdbfe" }, areaStyle: { color: "#dbeafe" } }
      }
    ],
    series: [
      {
        name: "RX",
        type: "line",
        smooth: true,
        showSymbol: points.length <= 36,
        symbol: "circle",
        symbolSize: 5,
        lineStyle: { width: 3 },
        itemStyle: { borderWidth: 2, borderColor: "#fff" },
        areaStyle: { opacity: 0.08 },
        connectNulls: true,
        data: rx
      },
      {
        name: "TX",
        type: "line",
        smooth: true,
        showSymbol: points.length <= 36,
        symbol: "circle",
        symbolSize: 5,
        lineStyle: { width: 3 },
        itemStyle: { borderWidth: 2, borderColor: "#fff" },
        connectNulls: true,
        data: tx
      }
    ]
  });
}

function resize() {
  chart?.resize();
}

onMounted(() => {
  render();
  window.addEventListener("resize", resize);
});

watch(() => props.points, render, { deep: true });
watch(() => props.height, () => setTimeout(resize, 0));

onBeforeUnmount(() => {
  window.removeEventListener("resize", resize);
  chart?.dispose();
  chart = null;
});
</script>

<template>
  <div ref="chartEl" class="power-echart" :style="{ height: `${height || 260}px` }"></div>
</template>
