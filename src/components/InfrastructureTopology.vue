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
const services = computed(() => ["236", "213", "212", "20"].map(id => nodeById.value.get(id)).filter(Boolean) as Node[]);
const selectableLinks = computed(() => props.links.filter(link => link.id !== "collector-mysql"));
const selected = computed(() => props.links.find(link => link.id === selectedId.value) || selectableLinks.value[0]);

function tone(value?: string) { return value === "ok" ? "ok" : value === "warning" ? "warning" : "failed"; }
function statusLabel(value?: string) { return value === "ok" ? "正常" : value === "warning" ? "关注" : "故障"; }
function node(id: string) { return nodeById.value.get(id); }
function link(id: string) { return props.links.find(item => item.id === id); }
function linkTone(id: string) { return tone(link(id)?.status); }
function selectLink(id: string) { if (link(id)) selectedId.value = id; }
function selectNode(id: string) {
  selectedId.value = selectableLinks.value.find(item => item.from === id || item.to === id)?.id || selectedId.value;
  emit("select-node", id);
}
</script>

<template>
  <section class="infra-topology topology-v3 card">
    <header class="infra-topology-head topology-v3-head">
      <div>
        <span class="infra-eyebrow"><Network :size="14" /> VERIFIED SERVICE FABRIC</span>
        <h2>服务调用拓扑</h2>
        <p>浏览器只通过 <strong>172.31.1.233:5772</strong> 进入平台；按实际调用关系展示采集、Radius、数据仓库与 AIOps。</p>
      </div>
      <div class="infra-topology-legend" aria-label="状态图例"><span><i class="ok"></i>正常</span><span><i class="warning"></i>关注</span><span><i class="failed"></i>故障</span></div>
    </header>

    <div class="topology-v3-canvas">
      <div class="topology-v3-zone zone-entry">01 · 用户入口</div>
      <div class="topology-v3-zone zone-platform">02 · 平台中枢</div>
      <div class="topology-v3-zone zone-services">03 · 采集、分析与数据服务</div>
      <svg class="topology-v3-wires" viewBox="0 0 1000 610" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <marker id="topology-v3-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8z" /></marker>
        </defs>
        <path class="topology-v3-wire" :class="[linkTone('web-entry'), { selected: selectedId === 'web-entry' }]" d="M500 105 L500 168" marker-end="url(#topology-v3-arrow)" @click="selectLink('web-entry')" />
        <path class="topology-v3-wire" :class="[linkTone('collector-api'), { selected: selectedId === 'collector-api' }]" d="M450 288 C390 340 245 380 125 440" marker-end="url(#topology-v3-arrow)" @click="selectLink('collector-api')" />
        <path class="topology-v3-wire" :class="[linkTone('radius-udp'), { selected: selectedId === 'radius-udp' }]" d="M126 360 C190 382 280 400 375 440" marker-end="url(#topology-v3-arrow)" @click="selectLink('radius-udp')" />
        <path class="topology-v3-wire" :class="[linkTone('clickhouse'), { selected: selectedId === 'clickhouse' }]" d="M500 288 L625 440" marker-end="url(#topology-v3-arrow)" @click="selectLink('clickhouse')" />
        <path class="topology-v3-wire" :class="[linkTone('aiops-api'), { selected: selectedId === 'aiops-api' }]" d="M550 288 C630 340 790 382 875 440" marker-end="url(#topology-v3-arrow)" @click="selectLink('aiops-api')" />
        <path class="topology-v3-wire radius" :class="[linkTone('radius-sink'), { selected: selectedId === 'radius-sink' }]" d="M455 505 L545 505" marker-end="url(#topology-v3-arrow)" @click="selectLink('radius-sink')" />
        <circle v-if="linkTone('web-entry') !== 'failed'" class="topology-v3-pulse" r="5"><animateMotion dur="2.2s" repeatCount="indefinite" path="M500 105 L500 168" /></circle>
        <circle v-if="linkTone('collector-api') !== 'failed'" class="topology-v3-pulse" r="5"><animateMotion dur="3.4s" repeatCount="indefinite" path="M450 288 C390 340 245 380 125 440" /></circle>
        <circle v-if="linkTone('aiops-api') !== 'failed'" class="topology-v3-pulse mint" r="5"><animateMotion dur="3.4s" repeatCount="indefinite" path="M550 288 C630 340 790 382 875 440" /></circle>
        <circle v-if="linkTone('radius-sink') !== 'failed'" class="topology-v3-pulse mint" r="4"><animateMotion dur="2.7s" repeatCount="indefinite" path="M455 505 L545 505" /></circle>
      </svg>

      <button class="topology-v3-client" @click="selectLink('web-entry')"><Globe2 :size="17" /><strong>平台用户</strong><small>Browser / VPN</small></button>
      <button class="topology-v3-hub" :class="tone(node('233')?.status)" @click="selectNode('233')">
        <span class="topology-v3-icon"><ServerCog :size="22" /></span><span><small>233 · {{ node('233')?.host }}</small><strong>{{ node('233')?.name || '统一网管平台' }}</strong><em>5772 入口 · Nginx · Vue · BFF</em></span><i :class="tone(node('233')?.status)" />
      </button>
      <button class="topology-v3-radius-source" @click="selectLink('radius-udp')"><Globe2 :size="16" /><strong>Radius NAS / BRAS</strong><small>被动报文镜像</small></button>
      <div class="topology-v3-service-grid">
        <button v-for="item in services" :key="item.id" class="topology-v3-node" :class="[`node-${item.id}`, tone(item.status)]" @click="selectNode(item.id)">
          <span class="topology-v3-icon"><ServerCog :size="19" /></span><span><small>{{ item.id }} · {{ item.host }}</small><strong>{{ item.name }}</strong><em>{{ item.role }}</em></span><i :class="tone(item.status)" />
          <div class="topology-v3-service-chips"><b v-for="service in item.services.slice(0, 2)" :key="service.key" :class="tone(service.status)">{{ service.label }}</b></div>
        </button>
      </div>
    </div>

    <div class="topology-v3-link-list" aria-label="调用关系">
      <button v-for="item in selectableLinks" :key="item.id" :class="{ active: item.id === selectedId }" @click="selectLink(item.id)"><i :class="tone(item.status)" />{{ item.direction }} · {{ item.protocol }} {{ item.ports }}</button>
    </div>
    <div v-if="selected" class="infra-topology-detail topology-v3-detail" :class="tone(selected.status)">
      <span class="infra-topology-detail-icon"><ArrowDownUp :size="18" /></span><div><strong>{{ selected.direction }} · {{ selected.protocol }} / {{ selected.ports }}</strong><p>{{ selected.description }}</p></div><span class="infra-firewall"><ShieldCheck :size="15" />{{ selected.firewall }}</span><span class="infra-link-status" :class="tone(selected.status)">{{ statusLabel(selected.status) }}<ChevronRight :size="14" /></span>
    </div>
    <div class="topology-v3-security"><ShieldCheck :size="15" /><span><strong>安全基线：</strong>20、212、213、236 已启用 SSH Fail2ban；20、212、213 的业务端口由端口守卫限制来源。236 的入站白名单尚待确认完整来源矩阵后实施。</span><CircleAlert :size="14" /></div>
  </section>
</template>
