<script setup lang="ts">
import * as echarts from "echarts";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

type Point = Record<string, string | number | null | undefined>;

const props = defineProps<{
  points: Point[];
  mode?: "overview" | "device" | "port";
  height?: number;
}>();

const emit = defineEmits<{
  (event: "point-click", payload: { sampleTime: string }): void;
  (event: "zoom", payload: { start: string; end: string }): void;
}>();

const chartEl = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;
let zoomTimer: number | undefined;

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildSeries() {
  if (props.mode === "port") {
    return [
      {
        name: "入方向计数",
        type: "line",
        smooth: true,
        symbol: "none",
        lineStyle: { width: 2.5 },
        data: props.points.map((p) => num(p.if_in_octets))
      },
      {
        name: "出方向计数",
        type: "line",
        smooth: true,
        symbol: "none",
        lineStyle: { width: 2.5 },
        data: props.points.map((p) => num(p.if_out_octets))
      }
    ];
  }
  if (props.mode === "device") {
    return [
      {
        name: "CPU",
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 4,
        lineStyle: { width: 3 },
        areaStyle: { opacity: 0.09 },
        data: props.points.map((p) => num(p.cpu_usage ?? p.cpu_max))
      },
      {
        name: "内存",
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 4,
        lineStyle: { width: 3 },
        areaStyle: { opacity: 0.06 },
        data: props.points.map((p) => num(p.mem_usage ?? p.mem_max))
      }
    ];
  }
  return [
    {
      name: "设备 CPU 最大",
      type: "line",
      smooth: true,
      symbol: "none",
      lineStyle: { width: 3 },
      areaStyle: { opacity: 0.08 },
      data: props.points.map((p) => num(p.device_cpu_max))
    },
    {
      name: "设备内存最大",
      type: "line",
      smooth: true,
      symbol: "none",
      lineStyle: { width: 2.5 },
      data: props.points.map((p) => num(p.device_mem_max))
    },
    {
      name: "板卡 CPU 最大",
      type: "line",
      smooth: true,
      symbol: "none",
      lineStyle: { width: 2.5 },
      data: props.points.map((p) => num(p.board_cpu_max))
    },
    {
      name: "板卡内存最大",
      type: "line",
      smooth: true,
      symbol: "none",
      lineStyle: { width: 2.5 },
      data: props.points.map((p) => num(p.board_mem_max))
    }
  ];
}

function render() {
  if (!chartEl.value) return;
  if (!chart) chart = echarts.init(chartEl.value);
  const dates = props.points.map((p) => String(p.sample_time || ""));
  chart.setOption({
    animationDuration: 700,
    color: ["#2563eb", "#16a34a", "#f59e0b", "#dc2626"],
    grid: { left: 42, right: 22, top: 38, bottom: 58, containLabel: true },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15, 23, 42, .93)",
      borderWidth: 0,
      textStyle: { color: "#fff", fontSize: 12 },
      axisPointer: { type: "line", lineStyle: { color: "#94a3b8", type: "dashed" } },
      valueFormatter: (value: unknown) => props.mode === "port" ? String(value ?? "-") : `${value ?? "-"}%`
    },
    legend: {
      top: 0,
      right: 8,
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
      axisLabel: { color: "#64748b", formatter: (value: string) => value.length > 10 ? value.slice(5, 16) : value }
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#e8edf5", type: "dashed" } },
      axisLabel: { color: "#64748b", formatter: (value: number) => props.mode === "port" ? `${value}` : `${value}%` }
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
    series: buildSeries()
  });
  chart.off("click");
  chart.on("click", (params) => {
    if (params.componentType !== "series" || params.dataIndex === undefined) return;
    const point = props.points[Number(params.dataIndex)];
    if (point?.sample_time) emit("point-click", { sampleTime: String(point.sample_time) });
  });
  chart.off("datazoom");
  chart.on("datazoom", () => {
    if (zoomTimer) window.clearTimeout(zoomTimer);
    zoomTimer = window.setTimeout(() => {
      const option = chart?.getOption() as unknown as { dataZoom?: Array<{ start?: number; end?: number }> } | undefined;
      const dataZoom = option?.dataZoom?.[0];
      if (!dataZoom || props.points.length < 2) return;
      const max = props.points.length - 1;
      const startIndex = Math.max(0, Math.min(max, Math.round((Number(dataZoom.start ?? 0) / 100) * max)));
      const endIndex = Math.max(startIndex, Math.min(max, Math.round((Number(dataZoom.end ?? 100) / 100) * max)));
      const start = props.points[startIndex]?.sample_time;
      const end = props.points[endIndex]?.sample_time;
      if (start && end) emit("zoom", { start: String(start), end: String(end) });
    }, 350);
  });
}

function resize() {
  chart?.resize();
}

onMounted(() => {
  render();
  window.addEventListener("resize", resize);
});

watch(() => [props.points, props.mode], render, { deep: true });

onBeforeUnmount(() => {
  if (zoomTimer) window.clearTimeout(zoomTimer);
  window.removeEventListener("resize", resize);
  chart?.dispose();
  chart = null;
});
</script>

<template>
  <div ref="chartEl" class="performance-echart" :style="{ height: `${height || 320}px` }"></div>
</template>
