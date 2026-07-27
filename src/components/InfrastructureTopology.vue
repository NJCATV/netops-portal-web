<script setup lang="ts">
import { computed, type Component, ref } from "vue";
import { AppWindow, ArrowDownUp, BrainCircuit, ChevronRight, CircleAlert, Cloud, Database, Network, RadioTower, ShieldCheck, Workflow } from "lucide-vue-next";

type Status = "ok" | "warning" | "failed";
type Node = { id: string; name: string; host: string; role: string; status: Status; services: Array<{ key: string; label: string; status: Status }> };
type Link = { id: string; from: string; to: string; protocol: string; ports: string; direction: string; description: string; status: Status; firewall: string };
type CardKind = "external" | "collector" | "process" | "data" | "application";
type ArchitectureCard = { title: string; subtitle: string; tags: string[]; kind: CardKind; status: Status; nodeId?: string; linkId?: string };

const props = defineProps<{ nodes: Node[]; links: Link[] }>();
const emit = defineEmits<{ (event: "select-node", id: string): void }>();
const selectedId = ref("web-entry");
const nodeById = computed(() => new Map(props.nodes.map(item => [item.id, item])));
const visibleLinks = computed(() => props.links.filter(link => link.id !== "collector-mysql"));
const selected = computed(() => props.links.find(link => link.id === selectedId.value) || visibleLinks.value[0]);
const icons: Record<CardKind, Component> = { external: Cloud, collector: RadioTower, process: BrainCircuit, data: Database, application: AppWindow };

function tone(value?: string) { return value === "ok" ? "ok" : value === "warning" ? "warning" : "failed"; }
function statusLabel(value?: string) { return value === "ok" ? "正常" : value === "warning" ? "关注" : "故障"; }
function nodeStatus(id: string): Status { return nodeById.value.get(id)?.status || "warning"; }
function selectLink(id?: string) { if (id && props.links.some(link => link.id === id)) selectedId.value = id; }
function inspect(item: ArchitectureCard) {
  selectLink(item.linkId);
  if (item.nodeId) emit("select-node", item.nodeId);
}
const layers = computed(() => [
  { code: "L0", title: "外部网络层", note: "接入网络、Radius 与城域网网管", cards: [
    { title: "全城域网 OLT 设备", subtitle: "接入设备池 · SNMP 数据源", tags: ["OLT / PON", "全网设备"], kind: "external", status: nodeStatus("236"), linkId: "collector-api" },
    { title: "RADIUS NAS / BRAS", subtitle: "认证、计费与 CoA 报文镜像", tags: ["UDP 1812/1813", "镜像输入"], kind: "external", status: nodeStatus("213"), linkId: "radius-udp" },
    { title: "城域网网管系统", subtitle: "AIOps 告警、工单与事件回传", tags: ["告警回传", "工单协同"], kind: "external", status: nodeStatus("20"), linkId: "aiops-api" },
  ] satisfies ArchitectureCard[] },
  { code: "L1", title: "采集层", note: "协议适配、采集批次与报文解析", cards: [
    { title: "236 · SNMP 采集引擎", subtitle: "设备轮询、批次调度、查询 Agent", tags: ["TCP 18086", "SNMP"], kind: "collector", status: nodeStatus("236"), nodeId: "236", linkId: "collector-api" },
    { title: "213 · Radius 探针", subtitle: "抓包、认证解析、spool 缓冲", tags: ["UDP 1812/1813/3799", "Radius"], kind: "collector", status: nodeStatus("213"), nodeId: "213", linkId: "radius-udp" },
    { title: "采集批次与原始证据", subtitle: "实时状态、失败重试与审计留痕", tags: ["批次追踪", "证据链"], kind: "collector", status: nodeStatus("236"), nodeId: "236", linkId: "collector-api" },
  ] satisfies ArchitectureCard[] },
  { code: "L2", title: "处理层", note: "统一编排、规则分析和跨系统协同", cards: [
    { title: "233 · BFF / 业务编排", subtitle: "统一鉴权、权限、查询与服务代理", tags: ["127.0.0.1:7001", "API 编排"], kind: "process", status: nodeStatus("233"), nodeId: "233", linkId: "web-entry" },
    { title: "20 · AIOps 分析引擎", subtitle: "告警关联、知识库、智能研判", tags: ["HTTP 18080", "规则 / AI"], kind: "process", status: nodeStatus("20"), nodeId: "20", linkId: "aiops-api" },
    { title: "告警与工单编排", subtitle: "事件聚合、分派建议、城域网回传", tags: ["事件闭环", "自动化"], kind: "process", status: nodeStatus("20"), nodeId: "20", linkId: "aiops-api" },
  ] satisfies ArchitectureCard[] },
  { code: "L3", title: "数据层", note: "在线业务数据、历史分析和日志索引", cards: [
    { title: "236 · 采集 MySQL", subtitle: "设备、采集结果与业务查询数据", tags: ["TCP 3339", "在线数据"], kind: "data", status: nodeStatus("236"), nodeId: "236", linkId: "collector-api" },
    { title: "212 · ClickHouse 数据仓库", subtitle: "ONU、性能、Radius 历史分析", tags: ["TCP 8123", "分析仓库"], kind: "data", status: nodeStatus("212"), nodeId: "212", linkId: "clickhouse" },
    { title: "20 · ES / 日志索引", subtitle: "检索、告警原文与分析上下文", tags: ["ELK", "日志检索"], kind: "data", status: nodeStatus("20"), nodeId: "20", linkId: "aiops-api" },
  ] satisfies ArchitectureCard[] },
  { code: "L4", title: "应用层", note: "门户、看板、分析结果与运维协同", cards: [
    { title: "统一网管门户", subtitle: "浏览器统一入口 · Nginx / Vue", tags: ["233:5772", "HTTPS"], kind: "application", status: nodeStatus("233"), nodeId: "233", linkId: "web-entry" },
    { title: "AIOps 运维工作台", subtitle: "异常研判、运行日志与处置建议", tags: ["分析工作台", "实时态"], kind: "application", status: nodeStatus("20"), nodeId: "20", linkId: "aiops-api" },
    { title: "报表与告警触达", subtitle: "趋势、审计、工单与外部协同", tags: ["报表输出", "城域网协同"], kind: "application", status: nodeStatus("233"), nodeId: "233", linkId: "web-entry" },
  ] satisfies ArchitectureCard[] },
]);
</script>

<template>
  <section class="infra-topology architecture-topology card">
    <header class="infra-topology-head architecture-topology-head">
      <div>
        <span class="infra-eyebrow"><Network :size="14" /> NETOPS LOGICAL ARCHITECTURE</span>
        <h2>网络运维逻辑架构</h2>
        <p>按外部网络、采集、处理、数据、应用分层展示；服务器是承载节点，卡片表示真实运行的服务能力。</p>
      </div>
      <div class="infra-topology-legend"><span><i class="ok"></i>正常</span><span><i class="warning"></i>关注</span><span><i class="failed"></i>故障</span></div>
    </header>

    <div class="architecture-board">
      <svg class="architecture-flow" viewBox="0 0 1000 630" preserveAspectRatio="none" aria-hidden="true">
        <defs><marker id="architecture-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8z" /></marker></defs>
        <path class="flow-main" d="M310 82 V565" marker-end="url(#architecture-arrow)" />
        <path class="flow-main radius" d="M585 82 V565" marker-end="url(#architecture-arrow)" />
        <path class="flow-main data" d="M860 565 V430" marker-end="url(#architecture-arrow)" />
        <path class="flow-return" d="M585 315 C690 245 760 170 860 82" marker-end="url(#architecture-arrow)" />
        <circle class="architecture-packet" r="5"><animateMotion dur="5s" repeatCount="indefinite" path="M310 82 V565" /></circle>
        <circle class="architecture-packet mint" r="4"><animateMotion dur="4.2s" repeatCount="indefinite" path="M585 82 V565" /></circle>
      </svg>
      <section v-for="layer in layers" :key="layer.code" class="architecture-layer">
        <header><span>{{ layer.code }}</span><div><strong>{{ layer.title }}</strong><small>{{ layer.note }}</small></div></header>
        <div class="architecture-card-stack">
          <button v-for="item in layer.cards" :key="item.title" class="architecture-card" :class="[item.kind, tone(item.status)]" @click="inspect(item)">
            <span class="architecture-card-icon"><component :is="icons[item.kind]" :size="18" /></span><span class="architecture-card-copy"><strong>{{ item.title }}</strong><small>{{ item.subtitle }}</small><em><b v-for="tag in item.tags" :key="tag">{{ tag }}</b></em></span><i :class="tone(item.status)" />
          </button>
        </div>
      </section>
    </div>

    <div class="architecture-flow-key"><span><Workflow :size="14" /> 主业务链路：外部网络 → 采集 → 处理 → 数据 / 应用</span><span><ArrowDownUp :size="14" /> AIOps 通过告警、工单与事件接口回传城域网网管系统</span></div>
    <div class="architecture-link-list"><button v-for="item in visibleLinks" :key="item.id" :class="{ active: item.id === selectedId }" @click="selectLink(item.id)"><i :class="tone(item.status)" />{{ item.direction }} · {{ item.protocol }} {{ item.ports }}</button></div>
    <div v-if="selected" class="infra-topology-detail architecture-detail" :class="tone(selected.status)"><span class="infra-topology-detail-icon"><ArrowDownUp :size="18" /></span><div><strong>{{ selected.direction }} · {{ selected.protocol }} / {{ selected.ports }}</strong><p>{{ selected.description }}</p></div><span class="infra-firewall"><ShieldCheck :size="15" />{{ selected.firewall }}</span><span class="infra-link-status" :class="tone(selected.status)">{{ statusLabel(selected.status) }}<ChevronRight :size="14" /></span></div>
    <div class="architecture-security"><ShieldCheck :size="15" /><span><strong>安全基线：</strong>20、212、213、236 已启用 SSH Fail2ban；20、212、213 的业务端口由端口守卫限制来源。236 的入站白名单尚待确认完整来源矩阵后实施。</span><CircleAlert :size="14" /></div>
  </section>
</template>
