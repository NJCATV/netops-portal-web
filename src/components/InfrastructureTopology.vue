<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as echarts from "echarts";
import { ArrowDownUp, ChevronRight, CircleAlert, Network, ShieldCheck } from "lucide-vue-next";

type Status = "ok" | "warning" | "failed";
type Node = { id: string; name: string; host: string; role: string; status: Status; services: Array<{ key: string; label: string; status: Status }> };
type Link = { id: string; from: string; to: string; protocol: string; ports: string; direction: string; description: string; status: Status; firewall: string };

const props = defineProps<{ nodes: Node[]; links: Link[] }>();
const emit = defineEmits<{ (event: "select-node", id: string): void }>();
const chartEl = ref<HTMLDivElement | null>(null);
const selectedId = ref("web-entry");
let chart: echarts.ECharts | null = null;
let resizeObserver: ResizeObserver | null = null;

const nodeById = computed(() => new Map(props.nodes.map(item => [item.id, item])));
const visibleLinks = computed(() => props.links.filter(link => link.id !== "collector-mysql"));
const selected = computed(() => props.links.find(link => link.id === selectedId.value) || visibleLinks.value[0]);

function tone(value?: string) { return value === "ok" ? "ok" : value === "warning" ? "warning" : "failed"; }
function statusLabel(value?: string) { return value === "ok" ? "正常" : value === "warning" ? "关注" : "故障"; }
function statusColor(status?: string) { return status === "ok" ? "#31b46a" : status === "warning" ? "#f2a93b" : "#e55d67"; }
function selectLink(id: string) { if (props.links.some(link => link.id === id)) selectedId.value = id; }
function selectNode(id: string) {
  selectedId.value = visibleLinks.value.find(link => link.from === id || link.to === id)?.id || selectedId.value;
  emit("select-node", id);
}

function renderChart() {
  if (!chart) return;
  const points: Record<string, [number, number]> = {
    clients: [500, 62], "233": [500, 205], radius_nas: [92, 330], "236": [125, 470], "213": [375, 470], "212": [625, 470], "20": [875, 470],
  };
  const serviceOrder = ["236", "213", "212", "20"];
  const graphNodes: any[] = [
    { id: "clients", name: "平台用户", x: points.clients[0], y: points.clients[1], symbol: "circle", symbolSize: 78, itemStyle: { color: "#eef4ff", borderColor: "#6e8fff", borderWidth: 2, shadowBlur: 18, shadowColor: "rgba(76,112,255,.22)" }, label: { formatter: "{title|平台用户}\n{meta|Browser / VPN}" } },
    { id: "radius_nas", name: "Radius NAS / BRAS", x: points.radius_nas[0], y: points.radius_nas[1], symbol: "roundRect", symbolSize: [154, 58], itemStyle: { color: "#f5fbff", borderColor: "#66cdb5", borderWidth: 2, shadowBlur: 16, shadowColor: "rgba(54,195,162,.18)" }, label: { formatter: "{title|Radius NAS / BRAS}\n{meta|被动报文镜像}" } },
  ];
  const platform = nodeById.value.get("233");
  if (platform) graphNodes.push(toGraphNode(platform, points[platform.id], true));
  serviceOrder.forEach(id => { const item = nodeById.value.get(id); if (item) graphNodes.push(toGraphNode(item, points[id], false)); });
  const curves: Record<string, number> = { "web-entry": 0, "collector-api": -0.12, "radius-udp": -0.1, clickhouse: 0, "aiops-api": 0.12, "radius-sink": 0 };
  const edges = visibleLinks.value.map(link => ({
    id: link.id, source: link.from, target: link.to, name: `${link.protocol} · ${link.ports}`, value: link,
    lineStyle: { color: statusColor(link.status), width: link.id === selectedId.value ? 4 : 2.2, opacity: link.id === selectedId.value ? 1 : .58, curveness: curves[link.id] || 0 },
  }));
  chart.setOption({
    animationDurationUpdate: 380,
    tooltip: {
      trigger: "item", confine: true, borderWidth: 0, backgroundColor: "rgba(18,32,67,.96)", textStyle: { color: "#eff6ff", fontSize: 12 },
      formatter: (params: any) => params.dataType === "edge"
        ? `<b>${params.data.value.direction}</b><br/>${params.data.value.protocol} · ${params.data.value.ports}<br/><span style="color:#b9c8e5">${params.data.value.description}</span>`
        : `<b>${params.data.name}</b><br/><span style="color:#b9c8e5">${params.data.host || params.data.labelText || "接入来源"}</span>`,
    },
    series: [{
      type: "graph", layout: "none", roam: true, draggable: true, left: "5%", right: "5%", top: 24, bottom: 22,
      data: graphNodes, links: edges, edgeSymbol: ["none", "arrow"], edgeSymbolSize: [0, 9],
      lineStyle: { cap: "round" }, emphasis: { focus: "adjacency", lineStyle: { width: 4, opacity: 1 } },
      label: {
        show: true, position: "inside", align: "center", verticalAlign: "middle",
        rich: { title: { color: "#18233f", fontSize: 12, fontWeight: 800, lineHeight: 18 }, meta: { color: "#72809b", fontSize: 9, lineHeight: 13 } },
      },
    }],
  }, { notMerge: true });
  chart.off("click");
  chart.on("click", (params: any) => {
    if (params.dataType === "edge") selectLink(params.data.id);
    if (params.dataType === "node" && !["clients", "radius_nas"].includes(params.data.id)) selectNode(params.data.id);
  });
}

function toGraphNode(node: Node, point: [number, number], hub: boolean) {
  return {
    id: node.id, name: node.name, host: `${node.id} · ${node.host}`, x: point[0], y: point[1], symbol: "roundRect", symbolSize: hub ? [244, 96] : [210, 90],
    itemStyle: { color: "#fff", borderColor: statusColor(node.status), borderWidth: hub ? 3 : 2, shadowBlur: hub ? 26 : 18, shadowColor: `${statusColor(node.status)}33` },
    label: { formatter: `{meta|${node.id} · ${node.host}}\n{title|${node.name}}\n{meta|${node.role}}` },
  };
}

onMounted(async () => {
  await nextTick();
  if (!chartEl.value) return;
  chart = echarts.init(chartEl.value, undefined, { renderer: "canvas" });
  resizeObserver = new ResizeObserver(() => chart?.resize());
  resizeObserver.observe(chartEl.value);
  renderChart();
});
onBeforeUnmount(() => { resizeObserver?.disconnect(); chart?.dispose(); chart = null; });
watch([() => props.nodes, () => props.links, selectedId], renderChart, { deep: true });
</script>

<template>
  <section class="infra-topology topology-graph card">
    <header class="infra-topology-head topology-graph-head">
      <div>
        <span class="infra-eyebrow"><Network :size="14" /> LIVE SERVICE FABRIC</span>
        <h2>服务调用拓扑</h2>
        <p>统一入口为 <strong>172.31.1.233:5772</strong>。可拖动、滚轮缩放节点，悬浮链路查看协议与端口。</p>
      </div>
      <div class="infra-topology-legend"><span><i class="ok"></i>正常</span><span><i class="warning"></i>关注</span><span><i class="failed"></i>故障</span></div>
    </header>
    <div class="topology-graph-stage"><div ref="chartEl" class="topology-graph-canvas" /></div>
    <div class="topology-graph-links" aria-label="调用关系">
      <button v-for="item in visibleLinks" :key="item.id" :class="{ active: item.id === selectedId }" @click="selectLink(item.id)"><i :class="tone(item.status)" />{{ item.direction }} · {{ item.protocol }} {{ item.ports }}</button>
    </div>
    <div v-if="selected" class="infra-topology-detail topology-graph-detail" :class="tone(selected.status)">
      <span class="infra-topology-detail-icon"><ArrowDownUp :size="18" /></span><div><strong>{{ selected.direction }} · {{ selected.protocol }} / {{ selected.ports }}</strong><p>{{ selected.description }}</p></div><span class="infra-firewall"><ShieldCheck :size="15" />{{ selected.firewall }}</span><span class="infra-link-status" :class="tone(selected.status)">{{ statusLabel(selected.status) }}<ChevronRight :size="14" /></span>
    </div>
    <div class="topology-graph-security"><ShieldCheck :size="15" /><span><strong>安全基线：</strong>20、212、213、236 已启用 SSH Fail2ban；20、212、213 的业务端口由端口守卫限制来源。236 的入站白名单尚待确认完整来源矩阵后实施。</span><CircleAlert :size="14" /></div>
  </section>
</template>
