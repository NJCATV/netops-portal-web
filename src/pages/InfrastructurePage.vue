<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { Activity, CircleAlert, CircleCheck, CircleX, Cpu, Database, ExternalLink, HardDrive, MemoryStick, RefreshCw, ServerCog, Terminal } from "lucide-vue-next";
import EmptyState from "../components/EmptyState.vue";
import InfrastructureTopology from "../components/InfrastructureTopology.vue";
import { api } from "../services/api";

type Service = { key: string; label: string; status: "ok" | "warning" | "failed"; detail?: string };
type Node = { id: string; name: string; host: string; role: string; hostname?: string; status: "ok" | "warning" | "failed"; error?: string; observed_at?: string; response_ms?: number; management?: Array<{ label: string; url: string }>; services: Service[]; resources: Record<string, any> };
type TopologyLink = { id: string; from: string; to: string; protocol: string; ports: string; direction: string; description: string; status: "ok" | "warning" | "failed"; firewall: string };
type Snapshot = { observed_at: string; nodes: Node[]; components: Array<Service & { node_id: string; node_name: string }>; topology: TopologyLink[]; summary: Record<string, number> };
type ServiceLogs = { status: string; service: string; observed_at?: string; source?: { kind: string; label: string; name: string }; message?: string; lines: string[] };

const data = ref<Snapshot | null>(null);
const loading = ref(true);
const refreshing = ref(false);
const error = ref("");
const selectedNode = ref<Node | null>(null);
const selectedService = ref<Service | null>(null);
const logs = ref<ServiceLogs | null>(null);
const logsLoading = ref(false);
let timer: number | undefined;

const orderedNodes = computed(() => data.value?.nodes || []);
const healthyRate = computed(() => {
  const total = Number(data.value?.summary?.total_components || 0);
  const failed = Number(data.value?.summary?.failed_components || 0);
  return total ? Math.round((total - failed) * 100 / total) : 0;
});

function bytes(value: unknown) {
  const raw = Number(value || 0);
  if (!raw) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(raw) / Math.log(1024)));
  return `${(raw / 1024 ** index).toFixed(index >= 3 ? 1 : 0)} ${units[index]}`;
}
function percent(value: unknown) { const n = Number(value); return Number.isFinite(n) ? `${n.toFixed(1)}%` : "-"; }
function tone(value?: string) { return value === "ok" ? "ok" : value === "warning" ? "warning" : "failed"; }
function statusLabel(value?: string) { return value === "ok" ? "运行正常" : value === "warning" ? "需关注" : "故障 / 不可达"; }
function resource(node: Node, key: "cpu_percent" | "memory" | "disk") { return node.resources?.[key] || {}; }
function observed(node: Node) { return node.observed_at ? `${node.observed_at}${node.response_ms != null ? ` · ${node.response_ms} ms` : ""}` : "暂未采集"; }
async function load(force = false) {
  if (force) refreshing.value = true; else loading.value = true;
  error.value = "";
  try { data.value = await api<Snapshot>(`/infrastructure/overview${force ? "?refresh=1" : ""}`); }
  catch (err) { error.value = err instanceof Error ? err.message : "基础设施监控加载失败"; }
  finally { loading.value = false; refreshing.value = false; }
}
function open(url: string) { window.open(url, "_blank", "noopener,noreferrer"); }
async function loadLogs() {
  if (!selectedNode.value || !selectedService.value) return;
  if (selectedNode.value.id === "212") {
    logs.value = { status: "not_available", service: selectedService.value.key, message: "212 当前通过 ClickHouse 只读指标采集运行状态；尚未部署主机日志探针。", lines: [] };
    return;
  }
  logsLoading.value = true;
  try { logs.value = await api<ServiceLogs>(`/infrastructure/logs?node_id=${encodeURIComponent(selectedNode.value.id)}&service=${encodeURIComponent(selectedService.value.key)}&limit=100`); }
  catch (err) { logs.value = { status: "not_available", service: selectedService.value.key, message: err instanceof Error ? err.message : "日志加载失败", lines: [] }; }
  finally { logsLoading.value = false; }
}
function inspectNode(node: Node, service?: Service) {
  selectedNode.value = node;
  selectedService.value = service || node.services[0] || null;
  logs.value = null;
  void loadLogs();
}
function inspectTopologyNode(id: string) { const node = data.value?.nodes.find(item => item.id === id); if (node) inspectNode(node); }

onMounted(() => { void load(); timer = window.setInterval(() => { void load(true); if (selectedNode.value && selectedService.value) void loadLogs(); }, 30000); });
onBeforeUnmount(() => { if (timer) window.clearInterval(timer); });
</script>

<template>
  <div class="infra-page">
    <EmptyState v-if="loading && !data" title="正在采集基础设施状态" description="汇总服务器资源、关键组件与数据服务的实时健康情况。" />
    <template v-else-if="data">
      <header class="infra-hero">
        <div><span class="infra-eyebrow"><Activity :size="14" /> INFRASTRUCTURE OBSERVABILITY</span><h1>基础设施监控</h1><p>服务器资源、核心服务与数据组件统一巡检；状态由 20 秒缓存的实时探针和服务连通性共同判定。</p></div>
        <div class="infra-hero-summary"><span>核心组件健康度</span><strong>{{ healthyRate }}%</strong><small>{{ data.summary.total_components - data.summary.failed_components }} / {{ data.summary.total_components }} 正常 · {{ data.observed_at }} 更新</small><button class="btn btn-secondary" :disabled="refreshing" @click="load(true)"><RefreshCw :size="15" :class="{ spinning: refreshing }" />刷新状态</button></div>
      </header>

      <p v-if="error" class="cockpit-error">{{ error }}</p>

      <section class="infra-summary-strip">
        <article><ServerCog :size="20" /><div><small>受监控服务器</small><strong>{{ data.summary.total_nodes }}</strong><em>{{ data.summary.healthy_nodes }} 台正常</em></div></article>
        <article class="ok"><CircleCheck :size="20" /><div><small>核心组件正常</small><strong>{{ data.summary.total_components - data.summary.failed_components }}</strong><em>采集、平台、AIOps、数据仓库</em></div></article>
        <article :class="data.summary.warning_nodes ? 'warning' : 'ok'"><CircleAlert :size="20" /><div><small>资源需关注</small><strong>{{ data.summary.warning_nodes }}</strong><em>CPU、内存或磁盘 ≥ 85%</em></div></article>
        <article :class="data.summary.failed_nodes ? 'failed' : 'ok'"><CircleX :size="20" /><div><small>故障服务器</small><strong>{{ data.summary.failed_nodes }}</strong><em>{{ data.summary.failed_components }} 个组件异常</em></div></article>
      </section>

      <InfrastructureTopology v-if="data.topology?.length" :nodes="data.nodes" :links="data.topology" @select-node="inspectTopologyNode" />

      <section v-if="selectedNode" class="infra-log-panel card">
        <header><div><span class="infra-eyebrow"><Terminal :size="14" /> SERVICE RUNTIME LOGS</span><h2>{{ selectedNode.name }} · {{ selectedService?.label || '运行状态' }}</h2><p>仅展示平台预置的服务日志尾部；每 30 秒自动刷新，不提供任意文件读取。</p></div><button class="btn btn-secondary" :disabled="logsLoading" @click="loadLogs"><RefreshCw :size="15" :class="{ spinning: logsLoading }" />刷新日志</button></header>
        <div class="infra-log-service-tabs"><button v-for="service in selectedNode.services" :key="service.key" :class="{ active: selectedService?.key === service.key }" @click="inspectNode(selectedNode, service)"><i :class="tone(service.status)"></i>{{ service.label }}</button></div>
        <div class="infra-log-meta"><span v-if="logs?.source">{{ logs.source.label }} · {{ logs.source.name }}</span><span v-if="logs?.observed_at">{{ logs.observed_at }} 更新</span></div>
        <p v-if="logs?.message" class="infra-log-empty">{{ logs.message }}</p>
        <pre v-else class="infra-log-output">{{ logsLoading && !logs ? '正在读取受控日志…' : (logs?.lines?.join('\n') || '该服务暂未输出可展示的日志') }}</pre>
      </section>

      <section class="infra-node-grid">
        <article v-for="node in orderedNodes" :key="node.id" class="infra-node-card" :class="tone(node.status)">
          <header class="infra-node-clickable" @click="inspectNode(node)"><div class="infra-node-title"><span class="infra-server-icon"><ServerCog :size="21" /></span><div><div class="infra-node-name"><h2>{{ node.name }}</h2><i :class="tone(node.status)"></i></div><p>{{ node.host }} · {{ node.role }}</p></div></div><span class="infra-state" :class="tone(node.status)">{{ statusLabel(node.status) }}</span></header>
          <div v-if="node.error" class="infra-probe-error"><CircleX :size="15" />{{ node.error }}</div>
          <template v-else>
            <div class="infra-resource-grid">
              <div><Cpu :size="17" /><span><small>CPU {{ node.resources?.cpu_cores ? `· ${node.resources.cpu_cores} 核` : "" }}</small><b>{{ percent(resource(node, 'cpu_percent')) }}</b><em>负载 {{ node.resources?.load_1 ?? "-" }}</em></span></div>
              <div><MemoryStick :size="17" /><span><small>内存</small><b>{{ percent(resource(node, 'memory').used_percent) }}</b><em>{{ bytes(resource(node, 'memory').used_bytes) }} / {{ bytes(resource(node, 'memory').total_bytes) }}</em></span></div>
              <div><HardDrive :size="17" /><span><small>磁盘 {{ resource(node, 'disk').path || "/" }}</small><b>{{ percent(resource(node, 'disk').used_percent) }}</b><em>可用 {{ bytes(resource(node, 'disk').free_bytes) }}</em></span></div>
            </div>
            <div class="infra-service-list"><button v-for="service in node.services" :key="service.key" class="infra-service-row" @click="inspectNode(node, service)"><i :class="tone(service.status)"></i><strong>{{ service.label }}</strong><span>{{ service.detail || statusLabel(service.status) }}</span><Terminal :size="14" /></button></div>
          </template>
          <footer><span>{{ observed(node) }}</span><div v-if="node.management?.length" class="infra-management"><button v-for="entry in node.management" :key="entry.label" @click="open(entry.url)">{{ entry.label }}<ExternalLink :size="13" /></button></div></footer>
        </article>
      </section>

      <section class="card infra-component-card"><header><div><span class="infra-eyebrow">COMPONENT LIGHTS</span><h2>核心组件运行情况</h2><p>绿灯为探针/服务检查通过；黄灯表示需关注；红灯表示服务不可达或关键进程不在运行。</p></div></header><div class="infra-component-lights"><article v-for="item in data.components" :key="`${item.node_id}-${item.key}`"><i :class="tone(item.status)"></i><div><strong>{{ item.label }}</strong><small>{{ item.node_id }} · {{ item.node_name }}</small></div><span>{{ item.status === "ok" ? "正常" : item.status === "warning" ? "关注" : "故障" }}</span></article></div></section>
    </template>
    <EmptyState v-else title="基础设施监控不可用" :description="error || '暂未获得监控数据。'" />
  </div>
</template>
