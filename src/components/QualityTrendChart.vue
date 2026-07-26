<script setup lang="ts">
import * as echarts from "echarts";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

type TrendPoint = {
  stat_date: string;
  bad_count: number | string;
  rx_low?: number | string;
  rx_high?: number | string;
  total_count?: number | string;
};

const props = defineProps<{
  points: TrendPoint[];
}>();

const chartEl = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

function num(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function render() {
  if (!chartEl.value) return;
  if (!chart) chart = echarts.init(chartEl.value);
  const dates = props.points.map((item) => item.stat_date);
  chart.setOption({
    animationDuration: 650,
    color: ["#2563eb", "#16a34a", "#f59e0b"],
    grid: { left: 42, right: 22, top: 28, bottom: 56, containLabel: true },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15, 23, 42, .92)",
      borderWidth: 0,
      textStyle: { color: "#fff", fontSize: 12 },
      axisPointer: { type: "line", lineStyle: { color: "#94a3b8", type: "dashed" } },
      valueFormatter: (value: unknown) => `${value} 台`
    },
    legend: {
      top: 0,
      right: 12,
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: "#64748b", fontSize: 12 }
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: dates,
      axisLine: { lineStyle: { color: "#e2e8f0" } },
      axisTick: { show: false },
      axisLabel: { color: "#64748b", formatter: (value: string) => value.slice(5) }
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      splitLine: { lineStyle: { color: "#e8edf5", type: "dashed" } },
      axisLabel: { color: "#64748b" }
    },
    dataZoom: [
      { type: "inside", throttle: 50 },
      {
        type: "slider",
        height: 18,
        bottom: 18,
        borderColor: "transparent",
        fillerColor: "rgba(37, 99, 235, .14)",
        handleStyle: { color: "#2563eb" },
        dataBackground: { lineStyle: { color: "#bfdbfe" }, areaStyle: { color: "#dbeafe" } }
      }
    ],
    series: [
      {
        name: "质差 ONU",
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 5,
        lineStyle: { width: 3 },
        areaStyle: { color: "rgba(37, 99, 235, .12)" },
        data: props.points.map((item) => num(item.bad_count))
      },
      {
        name: "低光",
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 4,
        lineStyle: { width: 2 },
        data: props.points.map((item) => num(item.rx_low))
      },
      {
        name: "高光",
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 4,
        lineStyle: { width: 2 },
        data: props.points.map((item) => num(item.rx_high))
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

onBeforeUnmount(() => {
  window.removeEventListener("resize", resize);
  chart?.dispose();
  chart = null;
});
</script>

<template>
  <div ref="chartEl" class="quality-echart"></div>
</template>
