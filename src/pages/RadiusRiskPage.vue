<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { ArrowDownAZ, RefreshCw, Search, ShieldAlert } from "lucide-vue-next";
import RadiusModuleTabs from "../components/RadiusModuleTabs.vue";
import { loadRadiusMultiMac, loadRadiusRejectRisk, type RadiusRow } from "../services/radiusApi";

const props = defineProps<{ kind: "reject" | "multi" }>();
const hours = ref(24);
const minMacs = ref(2);
const items = ref<RadiusRow[]>([]);
const loading = ref(false);
const error = ref("");
const keyword = ref("");
const sortOrder = ref<"desc" | "asc">("desc");
const page = ref(1);
const pageSize = ref(20);
const isMulti = computed(() => props.kind === "multi");
const filteredItems = computed(() => {
  const term = keyword.value.trim().toLowerCase();
  const rows = term ? items.value.filter(row => [row.username, row.macs, row.reasons, row.nas_count].join(" ").toLowerCase().includes(term)) : items.value;
  const value = (row: RadiusRow) => Number(isMulti.value ? row.mac_count : row.reject_count) || 0;
  return [...rows].sort((a, b) => sortOrder.value === "desc" ? value(b) - value(a) : value(a) - value(b));
});
const pageCount = computed(() => Math.max(1, Math.ceil(filteredItems.value.length / pageSize.value)));
const visibleItems = computed(() => filteredItems.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value));
const macs = (row: RadiusRow) => String(row.macs || "").split(", ").filter(Boolean);
async function load() {
  loading.value = true;
  error.value = "";
  try {
    const response = isMulti.value ? await loadRadiusMultiMac(hours.value, minMacs.value, 500) : await loadRadiusRejectRisk(hours.value, 500);
    items.value = response.items || [];
    page.value = 1;
  } catch (err) { error.value = err instanceof Error ? err.message : "加载失败"; }
  finally { loading.value = false; }
}
function setHours(value: number) { hours.value = value; load(); }
watch(() => props.kind, load);
onMounted(load);
</script>

<template>
  <div class="aiops-page radius-page" :class="{ loading }">
    <section class="aiops-page-head"><div><span><ShieldAlert :size="15" /> Radius 风险分析</span><h1>{{ isMulti ? "多终端拨号账号" : "高频认证拒绝" }}</h1><p>{{ isMulti ? "仅使用成功认证和 Accounting 建立可信关系；当前加载窗口内符合条件的全部结果，MAC 以独立标签展示。" : "识别密码错误、无订购、账号异常等持续拒绝账号，并可按账号、原因或 MAC 筛选。" }}</p></div><div class="aiops-range"><button v-for="value in [1,24,168,720]" :key="value" :class="{ active: hours === value }" @click="setHours(value)">{{ value === 168 ? "7 天" : value === 720 ? "30 天" : `${value}h` }}</button></div><button class="btn btn-secondary" @click="load"><RefreshCw :size="15" />刷新</button></section>
    <RadiusModuleTabs />
    <section class="card aiops-filter-bar radius-risk-filter"><label><Search :size="15" /><input v-model="keyword" :placeholder="isMulti ? '账号 / 终端 MAC / NAS' : '账号 / 原因 / MAC'" @input="page = 1" /></label><select v-if="isMulti" v-model="minMacs" @change="load"><option :value="2">至少 2 个 MAC</option><option :value="3">至少 3 个 MAC</option><option :value="4">至少 4 个 MAC</option></select><button class="btn btn-secondary" @click="sortOrder = sortOrder === 'desc' ? 'asc' : 'desc'"><ArrowDownAZ :size="15" />{{ sortOrder === "desc" ? "数量从高到低" : "数量从低到高" }}</button><span>已加载 {{ items.length }} 条，匹配 {{ filteredItems.length }} 条</span></section>
    <div v-if="error" class="aiops-notice error">{{ error }}</div>
    <section class="card aiops-table-card radius-data-table-card"><div class="table-scroll"><table class="data-table aiops-table radius-risk-table"><thead><tr><th>账号</th><th>{{ isMulti ? "可信 MAC 数" : "拒绝次数" }}</th><th>{{ isMulti ? "成功认证 / Accounting" : "终端 MAC 数" }}</th><th>NAS 数</th><th>{{ isMulti ? "拨号终端 MAC" : "主要原因" }}</th><th>最后出现</th></tr></thead><tbody><tr v-for="row in visibleItems" :key="String(row.username)"><td><RouterLink class="radius-account-link" :to="{ path: '/radius', query: { keyword: row.username } }">{{ row.username }}</RouterLink></td><td><strong>{{ isMulti ? row.mac_count : row.reject_count }}</strong></td><td>{{ isMulti ? `${row.auth_count || 0} / ${row.accounting_count || 0}` : row.mac_count }}</td><td>{{ row.nas_count }}</td><td v-if="isMulti" class="radius-mac-chip-cell"><RouterLink v-for="mac in macs(row)" :key="mac" class="radius-mac-chip" :to="{ path: '/onu-search', query: { type: 'terminal_mac', keyword: mac } }">{{ mac }}</RouterLink></td><td v-else class="radius-wide-cell">{{ row.reasons }}</td><td>{{ row.last_seen }}</td></tr><tr v-if="!visibleItems.length"><td colspan="6" class="radius-empty">当前窗口暂无符合条件的风险记录</td></tr></tbody></table></div><footer class="radius-pager"><span>第 {{ page }} / {{ pageCount }} 页</span><select v-model="pageSize" @change="page = 1"><option :value="20">20 条/页</option><option :value="50">50 条/页</option><option :value="100">100 条/页</option></select><button class="btn btn-secondary" :disabled="page <= 1" @click="page--">上一页</button><button class="btn btn-secondary" :disabled="page >= pageCount" @click="page++">下一页</button></footer></section>
  </div>
</template>
