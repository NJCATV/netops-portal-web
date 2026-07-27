<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowDownUp, ChevronRight, CircleAlert, Globe2, Network, ServerCog, ShieldCheck } from "lucide-vue-next";

type Service = { key: string; label: string; status: "ok" | "warning" | "failed"; detail?: string };
type Node = { id: string; name: string; host: string; role: string; status: "ok" | "warning" | "failed"; services: Service[] };
type Link = { id: string; from: string; to: string; protocol: string; ports: string; direction: string; description: string; status: "ok" | "warning" | "failed"; firewall: string };

const props = defineProps<{ nodes: Node[]; links: Link[] }>();
const emit = defineEmits<{ (event: "select-node", id: string): void }>();
const selectedId = ref("web-entry");
const nodeById = computed(() => new Map(props.nodes.map(item => [item.id, item])));
const serviceNodes = computed(() => ["236", "213", "212", "20"].map(id => nodeById.value.get(id)).filter(Boolean) as Node[]);
const selected = computed(() => props.links.find(link => link.id === selectedId.value) || props.links[0]);

function tone(value?: string) { return value === "ok" ? "ok" : value === "warning" ? "warning" : "failed"; }
function label(value?: string) { return value === "ok" ? "正常" : value === "warning" ? "关注" : "故障"; }
function node(id: string) { return nodeById.value.get(id); }
function linkTone(id: string) { return tone(props.links.find(link => link.id === id)?.status); }
function selectLink(id: string) { selectedId.value = id; }
function selectNode(id: string) {
  selectedId.value = props.links.find(link => link.from === id || link.to === id)?.id || selectedId.value;
  emit("select-node", id);
}
</script>

<template>
  <section class="infra-topology topology-v2 card">
    <header class="infra-topology-head topology-v2-head">
      <div>
        <span class="infra-eyebrow"><Network :size="14" /> VERIFIED SERVICE FABRIC</span>
        <h2>服务调用拓扑</h2>
        <p>以统一入口 <strong>172.31.1.233:5772</strong> 为起点，按生产调用方向展示采集、Radius、数据仓库和 AIOps 服务域。</p>
      </div>
      <div class="infra-topology-legend"><span><i class="ok"></i>正常</span><span><i class="warning"></i>关注</span><span><i class="failed"></i>故障</span></div>
    </header>

    <div class="topology-v2-stage">
      <div class="topology-v2-zone ingress">01 · 用户入口</div>
      <div class="topology-v2-zone platform">02 · 平台中枢</div>
      <div class="topology-v2-zone services">03 · 采集、分析与数据服务域</div>

      <svg class="topology-v2-svg" viewBox="0 0 1280 680" role="img" aria-label="以 233:5772 为入口的网络管理平台服务拓扑">
        <defs>
          <pattern id="topology-v2-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="currentColor" stroke-opacity=".08"/></pattern>
          <linearGradient id="topology-v2-line" x1="0" x2="1"><stop stop-color="#4f7cff" stop-opacity=".35"/><stop offset=".5" stop-color="#5a9dff"/><stop offset="1" stop-color="#4ce1c1" stop-opacity=".45"/></linearGradient>
          <filter id="topology-v2-glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="1280" height="680" fill="url(#topology-v2-grid)"/>
        <path class="topology-v2-link" :class="[linkTone('web-entry'), { selected: selectedId === 'web-entry' }]" d="M640 108 L640 204" @click="selectLink('web-entry')"/>
        <path class="topology-v2-link" :class="[linkTone('collector-api'), { selected: selectedId === 'collector-api' }]" d="M525 324 C440 365 308 400 190 492" @click="selectLink('collector-api')"/>
        <path class="topology-v2-link muted" :class="[linkTone('collector-mysql'), { selected: selectedId === 'collector-mysql' }]" d="M545 335 C432 432 310 490 190 540" @click="selectLink('collector-mysql')"/>
        <path class="topology-v2-link" :class="[linkTone('aiops-api'), { selected: selectedId === 'aiops-api' }]" d="M755 324 C850 365 984 404 1090 492" @click="selectLink('aiops-api')"/>
        <path class="topology-v2-link" :class="[linkTone('clickhouse'), { selected: selectedId === 'clickhouse' }]" d="M640 335 L735 488" @click="selectLink('clickhouse')"/>
        <path class="topology-v2-link radius" :class="[linkTone('radius-udp'), { selected: selectedId === 'radius-udp' }]" d="M73 355 C116 405 250 448 452 495" @click="selectLink('radius-udp')"/>
        <path class="topology-v2-link radius" :class="[linkTone('radius-sink'), { selected: selectedId === 'radius-sink' }]" d="M545 550 C602 585 670 585 735 550" @click="selectLink('radius-sink')"/>

        <g class="topology-v2-label" @click="selectLink('web-entry')"><rect x="660" y="145" width="156" height="40" rx="9"/><text x="673" y="162">HTTPS · 5772</text><text x="673" y="176">统一网管入口</text></g>
        <g class="topology-v2-label" @click="selectLink('collector-api')"><rect x="255" y="376" width="143" height="40" rx="9"/><text x="268" y="393">HTTP · 18086</text><text x="268" y="407">采集状态 / 查询</text></g>
        <g class="topology-v2-label" @click="selectLink('collector-mysql')"><rect x="235" y="505" width="138" height="40" rx="9"/><text x="248" y="522">MySQL · 3339</text><text x="248" y="536">采集业务数据</text></g>
        <g class="topology-v2-label" @click="selectLink('aiops-api')"><rect x="892" y="376" width="160" height="40" rx="9"/><text x="905" y="393">HTTP + 签名 · 18080</text><text x="905" y="407">AIOps 服务代理</text></g>
        <g class="topology-v2-label" @click="selectLink('clickhouse')"><rect x="674" y="404" width="145" height="40" rx="9"/><text x="687" y="421">ClickHouse · 8123</text><text x="687" y="435">历史分析查询</text></g>
        <g class="topology-v2-label" @click="selectLink('radius-udp')"><rect x="82" y="407" width="142" height="40" rx="9"/><text x="95" y="424">RADIUS / UDP</text><text x="95" y="438">1812 / 1813 / 3799</text></g>
        <g class="topology-v2-label" @click="selectLink('radius-sink')"><rect x="566" y="587" width="148" height="40" rx="9"/><text x="579" y="604">ClickHouse · 8123</text><text x="579" y="618">Radius 解析落库</text></g>

        <g filter="url(#topology-v2-glow)">
          <circle v-if="linkTone('web-entry') !== 'failed'" class="topology-v2-flow" r="5"><animateMotion dur="2.5s" repeatCount="indefinite" path="M640 108 L640 204"/></circle>
          <circle v-if="linkTone('collector-api') !== 'failed'" class="topology-v2-flow" r="5"><animateMotion dur="3.6s" repeatCount="indefinite" path="M525 324 C440 365 308 400 190 492"/></circle>
          <circle v-if="linkTone('aiops-api') !== 'failed'" class="topology-v2-flow mint" r="5"><animateMotion dur="3.6s" repeatCount="indefinite" path="M755 324 C850 365 984 404 1090 492"/></circle>
          <circle v-if="linkTone('clickhouse') !== 'failed'" class="topology-v2-flow" r="5"><animateMotion dur="3s" repeatCount="indefinite" path="M640 335 L735 488"/></circle>
          <circle v-if="linkTone('radius-sink') !== 'failed'" class="topology-v2-flow mint" r="4"><animateMotion dur="2.8s" repeatCount="indefinite" path="M545 550 C602 585 670 585 735 550"/></circle>
        </g>
      </svg>

      <div class="topology-v2-client"><Globe2 :size="18"/><span>平台用户</span><small>Browser / VPN</small></div>
      <button class="topology-v2-hub" :class="tone(node('233')?.status)" @click="selectNode('233')">
        <span class="topology-v2-icon"><ServerCog :size="21"/></span><span><small>233 · {{ node('233')?.host }}</small><strong>{{ node('233')?.name || '统一网管平台' }}</strong><em>5772 入口 · Nginx · Vue · BFF</em></span><i :class="tone(node('233')?.status)"></i>
      </button>
      <div class="topology-v2-radius-source"><Globe2 :size="16"/><span>Radius NAS / BRAS</span><small>报文镜像</small></div>
      <div class="topology-v2-server-grid">
        <button v-for="item in serviceNodes" :key="item.id" class="topology-v2-node" :class="tone(item.status)" @click="selectNode(item.id)">
          <span class="topology-v2-icon"><ServerCog :size="19"/></span><span><small>{{ item.id }} · {{ item.host }}</small><strong>{{ item.name }}</strong><em>{{ item.role }}</em></span><i :class="tone(item.status)"></i>
          <div><b v-for="service in item.services.slice(0, 2)" :key="service.key" :class="tone(service.status)">{{ service.label }}</b></div>
        </button>
      </div>
    </div>

    <div v-if="selected" class="infra-topology-detail topology-v2-detail" :class="tone(selected.status)">
      <span class="infra-topology-detail-icon"><ArrowDownUp :size="18"/></span><div><strong>{{ selected.direction }} · {{ selected.protocol }} / {{ selected.ports }}</strong><p>{{ selected.description }}</p></div><span class="infra-firewall"><ShieldCheck :size="15"/>{{ selected.firewall }}</span><span class="infra-link-status" :class="tone(selected.status)">{{ label(selected.status) }}<ChevronRight :size="14"/></span>
    </div>
    <div class="topology-v2-security"><ShieldCheck :size="15"/><span><strong>已纳入安全基线：</strong>20、212、213、236 已配置 SSH Fail2ban；20、212、213 使用端口守卫。具体允许来源和例外以部署仓库中的安全清单为准。</span><CircleAlert :size="14"/></div>
  </section>
</template>
