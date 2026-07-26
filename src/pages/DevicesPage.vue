<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import EmptyState from "../components/EmptyState.vue";
import OrganizationTree, { type OrganizationTreeNode } from "../components/OrganizationTree.vue";
import StatusTag from "../components/StatusTag.vue";
import { api } from "../services/api";

type Device = Record<string, any> & { olt_device_id: number; name?: string };
type OrgRow = { region?: string; room_group?: string; room?: string; device_count?: number };
type Options = { regions: string[]; room_groups: string[]; rooms: string[]; brands: string[]; models: string[]; organizations: OrgRow[] };

const rows = ref<Device[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(20);
const loading = ref(false);
const saving = ref(false);
const probing = ref(false);
const error = ref("");
const message = ref("");
const options = ref<Options>({ regions: [], room_groups: [], rooms: [], brands: [], models: [], organizations: [] });
const filters = ref({ keyword: "", region: "", room: "", device_model: "", active: "1" });
const selected = ref<Set<number>>(new Set());
const formOpen = ref(false);
const editingId = ref<number | null>(null);
const form = ref(emptyForm());

function emptyForm() {
  return { name: "", region: "", room_group: "", room: "", brand: "", device_model: "", primary_ip: "", backup_ip: "", community: "", external_database: "", external_id: "", is_active: true };
}
const pages = computed(() => Math.max(1, Math.ceil(total.value / size.value)));
const allPageSelected = computed(() => rows.value.length > 0 && rows.value.every(row => selected.value.has(row.olt_device_id)));
function regionLabel(value: string) { return ({ chengbei: "城北", chengdong: "城东", chengnan: "城南", chengxi: "城西", gaochun: "高淳", jiangning: "江宁", lishui: "溧水", liuhe: "六合", pukou: "浦口", qixia: "栖霞", yuhua: "雨花" } as Record<string,string>)[value] || value || "未分区域"; }
const orgTree = computed(() => {
  const regions = new Map<string, Map<string, OrgRow[]>>();
  for (const item of options.value.organizations || []) {
    const region = item.region || "未分区域";
    const group = item.room_group || "未分机房组";
    if (!regions.has(region)) regions.set(region, new Map());
    if (!regions.get(region)!.has(group)) regions.get(region)!.set(group, []);
    regions.get(region)!.get(group)!.push(item);
  }
  return Array.from(regions, ([region, groups]) => ({ region, groups: Array.from(groups, ([group, rooms]) => ({ group, rooms, count: rooms.reduce((n, r) => n + Number(r.device_count || 0), 0) })), count: Array.from(groups.values()).flat().reduce((n, r) => n + Number(r.device_count || 0), 0) }));
});
const selectedOrgId = computed(() => filters.value.room ? `room:${filters.value.region}|${filters.value.room}` : filters.value.region ? `region:${filters.value.region}` : "");
const deviceOrgNodes = computed<OrganizationTreeNode[]>(() => orgTree.value.map(region => {
  const rooms = new Map<string, number>();
  region.groups.flatMap(group => group.rooms).forEach(room => rooms.set(room.room || "", (rooms.get(room.room || "") || 0) + Number(room.device_count || 0)));
  return {
    id: `region:${region.region}`, label: regionLabel(region.region), count: region.count, meta: { region: region.region },
    children: Array.from(rooms, ([room, count]) => ({ id: `room:${region.region}|${room}`, label: room || "未分机房", count, meta: { region: region.region, room } }))
  };
}));

function query() {
  const params = new URLSearchParams({ page: String(page.value), size: String(size.value) });
  for (const [key, value] of Object.entries(filters.value)) if (value !== "") params.set(key, value);
  return params.toString();
}
async function loadOptions() { options.value = await api<Options>("/olt/device-options"); }
async function load() {
  loading.value = true; error.value = "";
  try {
    const data = await api<{ items: Device[]; total: number }>(`/olt/devices?${query()}`);
    rows.value = data.items || []; total.value = data.total || 0;
  } catch (err) { error.value = err instanceof Error ? err.message : "设备加载失败"; }
  finally { loading.value = false; }
}
function search() { page.value = 1; selected.value = new Set(); load(); }
function reset() { filters.value = { keyword: "", region: "", room: "", device_model: "", active: "1" }; search(); }
function gotoPage(next: number) { page.value = Math.max(1, Math.min(pages.value, next)); selected.value = new Set(); load(); }
function chooseOrg(region: string, room = "") { filters.value.region = region === "未分区域" ? "" : region; filters.value.room = room || ""; search(); }
function chooseOrgNode(node: OrganizationTreeNode | null) { const meta = (node?.meta || {}) as any; chooseOrg(meta.region || "", meta.room || ""); }
function toggle(row: Device) { const next = new Set(selected.value); next.has(row.olt_device_id) ? next.delete(row.olt_device_id) : next.add(row.olt_device_id); selected.value = next; }
function togglePage() { selected.value = allPageSelected.value ? new Set() : new Set(rows.value.map(row => row.olt_device_id)); }
function openCreate() { editingId.value = null; form.value = emptyForm(); formOpen.value = true; }
function openEdit(row: Device) { editingId.value = row.olt_device_id; form.value = { ...emptyForm(), ...row, community: "", is_active: Boolean(row.is_active) }; formOpen.value = true; }

async function probe() {
  if (!form.value.primary_ip || !form.value.community) { error.value = "检测需要填写主 IP 和 SNMP 团体号"; return; }
  probing.value = true; error.value = "";
  try {
    const result: any = await api("/olt/probe", { method: "POST", body: JSON.stringify({ ip: form.value.primary_ip, community: form.value.community }) });
    const info = result?.device || result?.data || result || {};
    form.value.name = info.name || info.device_name || form.value.name;
    form.value.brand = info.brand || info.vendor || form.value.brand;
    form.value.device_model = info.device_model || info.model || form.value.device_model;
    message.value = "检测成功，已把识别到的信息填入设备表单，请确认组织信息后保存。";
  } catch (err) { error.value = err instanceof Error ? err.message : "设备检测失败"; }
  finally { probing.value = false; }
}

async function saveDevice() {
  saving.value = true; error.value = ""; message.value = "";
  try {
    const path = editingId.value ? `/olt/devices/${editingId.value}` : "/olt/devices";
    await api(path, { method: editingId.value ? "PUT" : "POST", body: JSON.stringify(form.value) });
    message.value = editingId.value ? "设备信息已更新" : "设备已加入采集清单";
    formOpen.value = false;
    await Promise.all([load(), loadOptions()]);
  } catch (err) { error.value = err instanceof Error ? err.message : "设备保存失败"; }
  finally { saving.value = false; }
}

onMounted(() => Promise.all([loadOptions(), load()]));
</script>

<template>
  <div class="manage-page">
    <section class="manage-hero card card-pad"><div><div class="eyebrow">OLT 资产中心</div><h1>OLT 设备管理</h1><p>维护设备基础档案；设备组织结构与区域映射统一在系统管理中维护。</p></div><div class="manage-hero-actions"><RouterLink class="btn btn-secondary" to="/device-orgs">设备组织管理</RouterLink><button class="btn btn-primary" @click="openCreate">+ 增加设备</button></div></section>
    <div v-if="error" class="quality-message error">{{ error }}</div><div v-if="message" class="quality-message success">{{ message }}</div>

    <div class="device-manage-layout">
      <OrganizationTree :nodes="deviceOrgNodes" :selected-id="selectedOrgId" title="设备组织" subtitle="区域 / 机房" :total-label="`${total} 台`" @select="chooseOrgNode" />

      <main class="device-manage-main">
        <section class="card manage-filter"><div class="manage-filter-grid"><input v-model="filters.keyword" class="input" placeholder="设备名称 / 主备 IP" @keydown.enter="search" /><select v-model="filters.region" class="select"><option value="">全部区域</option><option v-for="v in options.regions" :key="v" :value="v">{{ regionLabel(v) }}</option></select><select v-model="filters.room" class="select"><option value="">全部机房</option><option v-for="v in options.rooms" :key="v">{{ v }}</option></select><select v-model="filters.device_model" class="select"><option value="">全部型号</option><option v-for="v in options.models" :key="v">{{ v }}</option></select><select v-model="filters.active" class="select"><option value="">全部状态</option><option value="1">在用</option><option value="0">停用</option></select><div class="manage-filter-actions"><button class="btn btn-primary" @click="search">查询</button><button class="btn btn-secondary" @click="reset">重置</button></div></div></section>
        <section class="card table-card manage-table-card" :class="{ loading }"><div class="table-head"><div><h2>设备基础档案</h2><p>共 {{ total }} 台，已选 {{ selected.size }} 台</p></div><select v-model.number="size" class="select tiny-select" @change="gotoPage(1)"><option :value="20">20 条/页</option><option :value="50">50 条/页</option><option :value="100">100 条/页</option></select></div><EmptyState v-if="!loading && !rows.length" title="暂无设备" description="请调整筛选条件或新增设备。" /><div v-else class="table-wrap"><table class="data-table manage-data-table"><thead><tr><th><input type="checkbox" :checked="allPageSelected" @change="togglePage" /></th><th>设备</th><th>设备组织</th><th>品牌 / 型号</th><th>主备 IP</th><th>接入方式</th><th>基础配置</th><th>操作</th></tr></thead><tbody><tr v-for="r in rows" :key="r.olt_device_id"><td><input type="checkbox" :checked="selected.has(r.olt_device_id)" @change="toggle(r)" /></td><td><strong>{{ r.name }}</strong><div class="muted">设备 ID {{ r.olt_device_id }}</div></td><td>{{ regionLabel(r.region) }}<div class="muted">{{ r.room || '未分机房' }}</div></td><td>{{ r.brand || '-' }}<div class="muted">{{ r.device_model || '-' }}</div></td><td>{{ r.primary_ip || '-' }}<div class="muted">备用 {{ r.backup_ip || '-' }}</div></td><td><span class="source-badge" :class="{ external: r.external_database }">{{ r.external_database ? `外部同步 · ${r.external_database}` : '本地 SNMP' }}</span></td><td><StatusTag :value="r.is_active ? '在用' : '停用'" /><div class="muted">团体号 {{ r.community_configured ? '已配置' : '未配置' }} · {{ r.updated_at || '-' }}</div></td><td><button class="outline-action" @click="openEdit(r)">编辑</button></td></tr></tbody></table></div><div v-if="total" class="pagination modern-pagination"><button class="btn btn-secondary" :disabled="page <= 1" @click="gotoPage(page - 1)">‹</button><span>第 {{ page }} / {{ pages }} 页</span><button class="btn btn-secondary" :disabled="page >= pages" @click="gotoPage(page + 1)">›</button></div></section>
      </main>
    </div>

    <datalist id="regions"><option v-for="v in options.regions" :key="v" :value="v" /></datalist><datalist id="room-groups"><option v-for="v in options.room_groups" :key="v" :value="v" /></datalist><datalist id="rooms"><option v-for="v in options.rooms" :key="v" :value="v" /></datalist>
    <div v-if="formOpen" class="quality-detail-mask" @click.self="formOpen = false"><section class="quality-detail-panel device-form-panel card"><header class="detail-panel-head"><div><span>{{ editingId ? '编辑 OLT 设备' : '增加 OLT 设备' }}</span><h2>{{ form.name || '设备基础信息' }}</h2><p>新增时可先检测设备，识别型号后再直接加入采集清单。</p></div><button class="round-icon-btn" @click="formOpen = false">×</button></header><div class="device-form-grid"><div class="field"><label>主 IP *</label><input v-model="form.primary_ip" class="input" placeholder="192.168.x.x" /></div><div class="field"><label>SNMP 团体号{{ editingId ? '（留空不修改）' : ' *' }}</label><input v-model="form.community" class="input" type="password" /></div><button class="btn btn-secondary probe-button" :disabled="probing" @click="probe">{{ probing ? '检测中…' : '检测并识别设备' }}</button><div class="field"><label>设备名称 *</label><input v-model="form.name" class="input" /></div><div class="field"><label>备用 IP</label><input v-model="form.backup_ip" class="input" /></div><div class="field"><label>品牌</label><input v-model="form.brand" class="input" list="brands" /></div><div class="field"><label>型号</label><input v-model="form.device_model" class="input" list="models" /></div><div class="field"><label>区域</label><select v-model="form.region" class="select"><option value="">未分区域</option><option v-for="v in options.regions" :key="v" :value="v">{{ regionLabel(v) }}</option></select></div><div class="field"><label>机房</label><input v-model="form.room" class="input" list="rooms" /></div><div class="field"><label>外部数据源</label><input v-model="form.external_database" class="input" placeholder="留空表示本地 SNMP" /></div><div class="field"><label>外部设备 ID</label><input v-model="form.external_id" class="input" /></div><label class="perf-switch"><input v-model="form.is_active" type="checkbox" />加入采集清单</label></div><footer class="device-form-actions"><button class="btn btn-secondary" @click="formOpen = false">取消</button><button class="btn btn-primary" :disabled="saving" @click="saveDevice">{{ saving ? '保存中…' : '保存设备' }}</button></footer></section></div>
    <datalist id="brands"><option v-for="v in options.brands" :key="v" :value="v" /></datalist><datalist id="models"><option v-for="v in options.models" :key="v" :value="v" /></datalist>
  </div>
</template>
