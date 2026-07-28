<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ArrowDownAZ, Download, RefreshCw, Search } from "lucide-vue-next";
import RadiusModuleTabs from "../components/RadiusModuleTabs.vue";
import { readApiSnapshot, writeApiSnapshot } from "../services/api";
import { downloadRadiusCsv, loadRadiusRecords, type RadiusRow } from "../services/radiusApi";

const eventType = ref<"auth" | "accounting" | "control">("auth");
const keyword = ref("");
const result = ref("");
const page = ref(1);
const pageSize = ref(50);
const total = ref(0);
const items = ref<RadiusRow[]>([]);
const loading = ref(false);
const error = ref("");
const sortBy = ref("event_time");
const sortOrder = ref<"asc" | "desc">("desc");
const observed = ref<RadiusRow>({});
const windowInfo = ref<RadiusRow>({});

function toInputTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
const endTime = ref(toInputTime(new Date()));
const startTime = ref(toInputTime(new Date(Date.now() - 24 * 3600_000)));
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));
const rangeLabel = computed(() => {
  const first = String(observed.value.first_event_time || "");
  const last = String(observed.value.last_event_time || "");
  return first && last ? `实际命中：${first} 至 ${last}` : "当前条件下暂无记录";
});
type RecordsResult = Awaited<ReturnType<typeof loadRadiusRecords>>;
function applyData(data: RecordsResult) {
  items.value = data.items;
  total.value = Number(data.total);
  observed.value = data.observed || {};
  windowInfo.value = data.window || {};
}
function isDefaultQuery() {
  return eventType.value === "auth" && !keyword.value && !result.value
    && page.value === 1 && pageSize.value === 50
    && sortBy.value === "event_time" && sortOrder.value === "desc";
}

async function load(quiet = false) {
  if (!quiet) loading.value = true;
  error.value = "";
  try {
    const data = await loadRadiusRecords({
      event_type: eventType.value, keyword: keyword.value,
      result: eventType.value === "auth" ? result.value : "",
      start_time: startTime.value, end_time: endTime.value,
      sort_by: sortBy.value, sort_order: sortOrder.value,
      page: page.value, page_size: pageSize.value
    });
    applyData(data);
    if (isDefaultQuery()) writeApiSnapshot("radius:records:auth:default", data, sessionStorage);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "加载失败";
  } finally {
    loading.value = false;
  }
}
function search() { page.value = 1; load(); }
function preset(hours: number) {
  endTime.value = toInputTime(new Date());
  startTime.value = toInputTime(new Date(Date.now() - hours * 3600_000));
  search();
}
function resultLabel(row: RadiusRow) {
  if (eventType.value === "accounting") return ({ 1: "上线", 2: "下线", 3: "在线更新", 7: "NAS 上线", 8: "NAS 下线" } as Record<number, string>)[Number(row.acct_status_type)] || `状态 ${row.acct_status_type || "-"}`;
  return String(row.result || "-");
}
function eventLabel(row: RadiusRow) {
  return row.event_type === "auth" ? "拨号认证" : row.event_type === "control" ? "控制报文" : "Accounting";
}
async function exportCsv() {
  await downloadRadiusCsv({ event_type: eventType.value, keyword: keyword.value,
    result: eventType.value === "auth" ? result.value : "", start_time: startTime.value, end_time: endTime.value });
}
onMounted(() => {
  const cached = readApiSnapshot<RecordsResult>("radius:records:auth:default", sessionStorage);
  if (cached) {
    applyData(cached);
    loading.value = false;
  }
  void load(Boolean(cached));
});
</script>

<template>
  <div class="aiops-page radius-page" :class="{ loading }">
    <section class="aiops-page-head">
      <div><span><Search :size="15" /> Radius 协议明细</span><h1>拨号认证、Accounting 与控制记录</h1><p>可按指定起止时间定位账号、终端 MAC、IP、会话、NAS 和认证结果；表内记录就是用户的拨号与会话证据。</p></div>
      <button class="btn btn-secondary" @click="exportCsv"><Download :size="15" />导出当前筛选 CSV</button>
    </section>
    <RadiusModuleTabs />
    <section class="card aiops-filter-bar radius-record-filter">
      <label><Search :size="15" /><input v-model="keyword" placeholder="账号 / 终端 MAC / IP / 会话" @keyup.enter="search" /></label>
      <select v-model="eventType" @change="search"><option value="auth">拨号认证</option><option value="accounting">Accounting</option><option value="control">CoA / Disconnect</option></select>
      <select v-if="eventType === 'auth'" v-model="result" @change="search"><option value="">全部结果</option><option value="accept">通过</option><option value="reject">拒绝</option></select>
      <label class="radius-date-field">开始<input v-model="startTime" type="datetime-local" /></label>
      <label class="radius-date-field">结束<input v-model="endTime" type="datetime-local" /></label>
      <select v-model="sortBy" @change="search"><option value="event_time">按时间</option><option value="username">按账号</option><option value="result_code">按结果</option><option value="nas_ip">按 NAS</option></select>
      <button class="btn btn-secondary radius-sort-button" @click="sortOrder = sortOrder === 'desc' ? 'asc' : 'desc'; search()"><ArrowDownAZ :size="15" />{{ sortOrder === "desc" ? "倒序" : "正序" }}</button>
      <button class="btn btn-primary" @click="search"><RefreshCw :size="15" />查询</button>
    </section>
    <div class="radius-time-presets"><button v-for="value in [1, 24, 168, 720]" :key="value" @click="preset(value)">{{ value === 168 ? "7 天" : value === 720 ? "30 天" : `${value} 小时` }}</button><span>{{ rangeLabel }}</span></div>
    <div v-if="error" class="aiops-notice error">{{ error }}</div>
    <section class="card aiops-table-card radius-data-table-card">
      <div class="table-scroll"><table class="data-table aiops-table radius-records-table"><thead><tr><th>时间 / 类型</th><th>账号</th><th>结果</th><th>原因 / 错误码</th><th>NAS / 报文方向</th><th>终端 MAC / IP</th><th>端口 / 会话</th></tr></thead><tbody>
        <tr v-for="row in items" :key="String(row.event_id)"><td><strong>{{ row.event_time }}</strong><small>{{ eventLabel(row) }}</small></td><td><strong>{{ row.username || "-" }}</strong><small>{{ row.raw_username }}</small></td><td><span class="radius-result" :class="Number(row.result_code) === 2 || [41, 44].includes(Number(row.result_code)) ? 'ok' : Number(row.result_code) === 11 ? '' : 'bad'">{{ resultLabel(row) }}</span></td><td class="radius-reason-cell">{{ row.reason_zh || row.reply_raw || (row.error_cause ? `Error-Cause ${row.error_cause}` : "-") }}</td><td>{{ row.nas_ip || row.nas_identifier || "-" }}<small v-if="row.src_ip || row.dst_ip">{{ row.src_ip }} → {{ row.dst_ip }}</small></td><td><strong>{{ row.mac_addr || "-" }}</strong><small>{{ row.framed_ip }}</small></td><td class="radius-session-cell">{{ row.nas_port_id || row.nas_port || "-" }}<small>{{ row.acct_session_id }}</small></td></tr>
        <tr v-if="!items.length"><td colspan="7" class="radius-empty">当前时间范围内暂无记录</td></tr>
      </tbody></table></div>
      <footer class="radius-pager"><span>共 {{ total.toLocaleString() }} 条 · 第 {{ page }} / {{ pageCount }} 页</span><select v-model="pageSize" @change="search"><option :value="30">30 条/页</option><option :value="50">50 条/页</option><option :value="100">100 条/页</option><option :value="200">200 条/页</option></select><button class="btn btn-secondary" :disabled="page <= 1" @click="page--; load()">上一页</button><button class="btn btn-secondary" :disabled="page >= pageCount" @click="page++; load()">下一页</button></footer>
    </section>
  </div>
</template>
