<script setup lang="ts">
import * as echarts from "echarts";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

type BatchTrendPoint = {
  collect_batches: string;
  sample_time?: string;
  total_count?: number | string;
  success_count?: number | string;
  fail_count?: number | string;
};

const props = defineProps<{ points: BatchTrendPoint[] }>();

const chartEl = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

function num(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function batchLabel(value: string) {
  const text = String(value || "");
  return /^\d{10}$/.test(text) ? `${text.slice(4, 6)}-${text.slice(6, 8)} ${text.slice(8, 10)}:00` : text;
}

function render() {
  if (!chartEl.value) return;
  if (!chart) chart = echarts.init(chartEl.value);
  const points = props.points || [];
  chart.setOption({
    animationDuration: 550,
    animationDurationUpdate: 450,
    color: ["#2563eb", "#ef4444"],
    grid: { left: 42, right: 20, top: 34, bottom: points.length > 18 ? 54 : 30, containLabel: true },
    tooltip: {
      trigger: "axis",
      confine: true,
      backgroundColor: "rgba(15, 23, 42, .94)",
      borderWidth: 0,
      textStyle: { color: "#fff", fontSize: 12 },
      axisPointer: { type: "line", lineStyle: { color: "#94a3b8", type: "dashed" } },
      formatter: (params: Array<{ axisValue: string; marker: string; seriesName: string; value: number }>) => {
        const first = params[0];
        if (!first) return "";
        return [`批次：${first.axisValue}`, ...params.map((item) => `${item.marker}${item.seriesName}：${item.value}`)].join("<br/>");
      }
    },
    legend: { top: 2, right: 10, itemWidth: 10, itemHeight: 10, textStyle: { color: "#64748b", fontSize: 12 } },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: points.map((item) => item.collect_batches),
      axisLine: { lineStyle: { color: "#e2e8f0" } },
      axisTick: { show: false },
      axisLabel: { color: "#64748b", hideOverlap: true, formatter: batchLabel }
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      splitLine: { lineStyle: { color: "#e8edf5", type: "dashed" } },
      axisLabel: { color: "#64748b" }
    },
    dataZoom: [
      { type: "inside", throttle: 50, start: points.length > 48 ? Math.max(0, 100 - 48 / points.length * 100) : 0, end: 100 },
      {
        show: points.length > 18,
        type: "slider",
        height: 16,
        bottom: 10,
        borderColor: "transparent",
        fillerColor: "rgba(37, 99, 235, .14)",
        handleStyle: { color: "#2563eb" },
        dataBackground: { lineStyle: { color: "#bfdbfe" }, areaStyle: { color: "#dbeafe" } }
      }
    ],
    series: [
      {
        name: "采集成功",
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 5,
        lineStyle: { width: 3 },
        areaStyle: { color: "rgba(37, 99, 235, .12)" },
        data: points.map((item) => num(item.success_count))
      },
      {
        name: "采集失败",
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 4,
        lineStyle: { width: 2 },
        data: points.map((item) => num(item.fail_count))
      }
    ]
  });
}

function resize() { chart?.resize(); }

onMounted(() => {
  render();
  window.addEventListener("resize", resize);
});

watch(() => props.points, render, { deep: true });

onBeforeUnmount(() => {
  window.removeEventListener("resize", resize);
  chart?.dispose();
  chart = null;
});
</script>

<template>
  <div ref="chartEl" class="collection-batch-echart"></div>
</template>
