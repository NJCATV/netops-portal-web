<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import EmptyState from "../components/EmptyState.vue";
import PowerLineChart from "../components/PowerLineChart.vue";
import StatusTag from "../components/StatusTag.vue";
import { api } from "../services/api";
import { loadRadiusProfile, type RadiusProfile } from "../services/radiusApi";
import type { HistoryPoint, OnuRecord } from "../types";

type SearchMode = "mac" | "terminal_mac" | "account" | "name" | "address";
type SearchHistory = { mode: SearchMode; keyword: string; time: string };
type TerminalResolution = {
  terminal_mac: string;
  terminal_mac_norm: string;
  accounts: string[];
  verified_accounts: string[];
  evidence: Array<Record<string, string | number | null>>;
  expected_onus: Array<Record<string, string | number | null>>;
  actual_mappings: Array<Record<string, string | number | null>>;
  mapping_source: { available: boolean; kind: string; label: string; freshness: string };
  status: string;
  status_label: string;
  is_conclusive: boolean;
};

const modes: Array<{ key: SearchMode; label: string; hint: string; placeholder: string }> = [
  { key: "mac", label: "ONU MAC", hint: "定位光猫设备本体", placeholder: "输入 ONU MAC，例如 D4:4D:9F:DB:98:43" },
  { key: "terminal_mac", label: "拨号终端 MAC", hint: "定位用户路由器或电脑", placeholder: "输入用户路由器/电脑的完整 MAC" },
  { key: "account", label: "GDF 账号", hint: "按宽带账号定位 ONU", placeholder: "输入 GDF 账号" },
  { key: "name", label: "用户姓名", hint: "按订购人姓名匹配", placeholder: "输入用户姓名" },
  { key: "address", label: "装机地址", hint: "按地址关键字匹配", placeholder: "输入装机地址关键字" }
];

const route = useRoute();
const mode = ref<SearchMode>("mac");
const keyword = ref("");
const loading = ref(false);
const realtimeLoading = ref(false);
const error = ref("");
const realtimeError = ref("");
const realtime = ref<any | null>(null);
const radiusProfile = ref<RadiusProfile | null>(null);
const terminalResolution = ref<TerminalResolution | null>(null);
const radiusLoading = ref(false);
const items = ref<OnuRecord[]>([]);
const primary = ref<OnuRecord | null>(null);
const history = ref<HistoryPoint[]>([]);
const range = ref(24);
const expandedKey = ref("");
const searchHistory = ref<SearchHistory[]>([]);

const rangeOptions = [
  { label: "近 24 小时", hours: 24 },
  { label: "近 7 天", hours: 168 },
  { label: "近 30 天", hours: 720 }
];

const activeMode = computed(() => modes.find((item) => item.key === mode.value) || modes[0]);
const selectedKey = computed(() => primary.value ? recordKey(primary.value) : "");
const historyPreview = computed(() => history.value.slice(-8).reverse());
const statusText = computed(() => {
  const status = String(primary.value?.status ?? "");
  if (["1", "online", "up"].includes(status)) return "在线";
  if (status === "2") return "离线";
  return status ? `状态码 ${status}` : "未知";
});
const powerBad = computed(() => {
  const rx = Number(primary.value?.rx_power);
  return Number.isFinite(rx) && (rx < -25 || rx > -8);
});

function fmt(value: unknown) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function recordKey(record: OnuRecord) {
  return `${record.onu_mac || ""}-${record.olt_device_id || ""}-${record.if_index || ""}`;
}

const radiusKeyword = computed(() => String(
  terminalResolution.value?.verified_accounts?.[0]
  || terminalResolution.value?.accounts?.[0]
  || primary.value?.gdf_account
  || ""
));
const terminalStatusTone = computed(() => {
  const status = terminalResolution.value?.status || "";
  if (status === "correct_onu") return "ok";
  if (["wrong_onu", "multi_actual_onu"].includes(status)) return "danger";
  return "warn";
});

function formatBytes(value: unknown) {
  let size = Number(value || 0);
  for (const unit of ["B", "KB", "MB", "GB", "TB"]) {
    if (size < 1024) return `${size.toFixed(unit === "B" ? 0 : 1)} ${unit}`;
    size /= 1024;
  }
  return `${size.toFixed(1)} PB`;
}

async function loadRadiusForOnu(record: OnuRecord) {
  const value = String(
    terminalResolution.value?.verified_accounts?.[0]
    || terminalResolution.value?.accounts?.[0]
    || record.gdf_account
    || ""
  ).trim();
  radiusProfile.value = null;
  if (!value) return;
  radiusLoading.value = true;
  try {
    radiusProfile.value = await loadRadiusProfile(value);
  } catch {
    radiusProfile.value = null;
  } finally {
    radiusLoading.value = false;
  }
}

function loadLocalHistory() {
  try {
    searchHistory.value = JSON.parse(localStorage.getItem("netops2026_onu_search_history") || "[]");
  } catch {
    searchHistory.value = [];
  }
}

function pushHistory() {
  const text = keyword.value.trim();
  if (!text) return;
  const next = [{ mode: mode.value, keyword: text, time: new Date().toLocaleString("zh-CN", { hour12: false }) }, ...searchHistory.value.filter((item) => item.keyword !== text || item.mode !== mode.value)].slice(0, 12);
  searchHistory.value = next;
  localStorage.setItem("netops2026_onu_search_history", JSON.stringify(next));
}

function clearHistory() {
  searchHistory.value = [];
  localStorage.removeItem("netops2026_onu_search_history");
}

async function useHistory(item: SearchHistory) {
  mode.value = item.mode;
  keyword.value = item.keyword;
  await search();
}

async function search() {
  if (!keyword.value.trim()) return;
  loading.value = true;
  error.value = "";
  realtimeError.value = "";
  realtime.value = null;
  history.value = [];
  expandedKey.value = "";
  terminalResolution.value = null;
  try {
    const data = await api<{
      items: OnuRecord[];
      primary: OnuRecord | null;
      terminal_resolution?: TerminalResolution | null;
    }>(
      `/onu/search?type=${encodeURIComponent(mode.value)}&keyword=${encodeURIComponent(keyword.value.trim())}`
    );
    items.value = data.items || [];
    primary.value = data.primary;
    terminalResolution.value = data.terminal_resolution || null;
    pushHistory();
    if (data.primary) {
      await loadHistory();
      realtimePower();
      loadRadiusForOnu(data.primary);
    } else if (!data.terminal_resolution) {
      error.value = "未找到匹配 ONU，请检查查询类型和输入内容。";
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : "查询失败，请稍后重试。";
    primary.value = null;
    items.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadHistory() {
  if (!primary.value) return;
  const data = await api<{ items: HistoryPoint[] }>(
    `/onu/history?onu_mac=${encodeURIComponent(primary.value.onu_mac)}&olt_device_id=${encodeURIComponent(primary.value.olt_device_id)}&hours=${range.value}`
  );
  history.value = data.items || [];
}

async function realtimePower() {
  if (!primary.value) return;
  realtimeLoading.value = true;
  realtimeError.value = "";
  try {
    realtime.value = await api("/onu/realtime-power", {
      method: "POST",
      body: JSON.stringify({
        onu_mac: primary.value.onu_mac,
        olt_device_id: primary.value.olt_device_id,
        if_index: primary.value.if_index
      })
    });
  } catch (err) {
    realtimeError.value = err instanceof Error ? err.message : "实时光功率获取失败";
  } finally {
    realtimeLoading.value = false;
  }
}

async function selectRecord(record: OnuRecord) {
  if (selectedKey.value === recordKey(record)) return;
  primary.value = record;
  loadRadiusForOnu(record);
  realtime.value = null;
  radiusProfile.value = null;
  realtimeError.value = "";
  history.value = [];
  await loadHistory();
  realtimePower();
}

async function toggleDetail(record: OnuRecord) {
  const key = recordKey(record);
  expandedKey.value = expandedKey.value === key ? "" : key;
  if (selectedKey.value !== key) await selectRecord(record);
}

function reset() {
  keyword.value = "";
  items.value = [];
  primary.value = null;
  history.value = [];
  realtime.value = null;
  error.value = "";
  realtimeError.value = "";
  expandedKey.value = "";
  terminalResolution.value = null;
}

onMounted(() => {
  loadLocalHistory();
  const queryType = String(route.query.type || "");
  const queryKeyword = String(route.query.keyword || "");
  if (queryKeyword) {
    if (modes.some((item) => item.key === queryType)) mode.value = queryType as SearchMode;
    keyword.value = queryKeyword;
    search();
  }
});
</script>

<template>
  <div class="onu-workbench">
    <aside class="onu-side">
      <section class="card card-pad onu-search-panel">
        <div class="card-title">
          <div>
            <h2>查询条件</h2>
            <p>ONU MAC 与用户拨号终端 MAC 分开查询，避免身份混用</p>
          </div>
        </div>
        <div class="onu-query-mode">
          <div>
            <span>查询方式</span>
            <small>{{ activeMode.hint }}</small>
          </div>
          <select v-model="mode" aria-label="查询方式">
            <option v-for="item in modes" :key="item.key" :value="item.key">{{ item.label }}</option>
          </select>
        </div>
        <div class="field">
          <label>请输入 {{ activeMode.label }}</label>
          <div class="input-wrap">
            <span class="input-icon">⌕</span>
            <input v-model="keyword" class="input" :placeholder="activeMode.placeholder" @keydown.enter="search" />
            <button v-if="keyword" class="clear-btn" @click="keyword = ''">×</button>
          </div>
        </div>
        <div class="filter-query-actions">
          <button class="btn btn-primary" :disabled="loading" @click="search">
            <span v-if="loading" class="mini-spinner"></span>{{ loading ? "查询中" : "查询" }}
          </button>
          <button class="btn btn-secondary" @click="reset">重置</button>
        </div>
      </section>

      <section v-if="searchHistory.length" class="card card-pad onu-history-panel">
        <div class="card-title">
          <div><h2>查询历史</h2><p>本机最近查询记录</p></div>
          <button class="text-btn" @click="clearHistory">清空历史</button>
        </div>
        <div class="onu-history-list">
          <button v-for="item in searchHistory" :key="`${item.mode}-${item.keyword}`" @click="useHistory(item)">
            <strong>{{ item.keyword }}</strong>
            <span>{{ item.time }}</span>
          </button>
        </div>
      </section>
    </aside>

    <main class="onu-main">
      <section class="card card-pad onu-result-head">
        <div class="card-title">
          <div>
            <h2>查询结果</h2>
            <p v-if="primary"><StatusTag :value="statusText" :tone="statusText === '在线' ? 'ok' : 'warn'" /> 最后上报时间：{{ primary.query_time || "-" }}</p>
            <p v-else>搜索后展示当前最可信记录、光功率趋势、实时指标和状态码</p>
          </div>
          <div class="page-action-buttons">
            <button class="btn btn-secondary" :disabled="!primary || realtimeLoading" @click="realtimePower">{{ realtimeLoading ? "刷新中" : "刷新数据" }}</button>
            <button class="btn btn-secondary" :disabled="!primary">关联主记录</button>
          </div>
        </div>

        <div v-if="loading" class="notice-card">
          <div class="loader"></div>
          <div><strong>正在查询 ONU</strong><p>正在匹配当前最可信记录，并准备实时光功率采集。</p></div>
        </div>
        <div v-else-if="error" class="notice-card error">
          <div class="notice-icon">!</div>
          <div><strong>查询失败或无结果</strong><p>{{ error }}</p></div>
        </div>
        <EmptyState v-else-if="!primary && !terminalResolution" title="请输入查询条件" description="可按 ONU MAC、拨号终端 MAC、GDF 账号、姓名或地址查询" />

        <template v-else-if="primary">
          <div class="onu-hero">
            <div class="onu-device-icon">ONU</div>
            <div>
              <h1 class="mono">{{ primary.display_mac || primary.onu_mac }}</h1>
              <p>ONU 设备 <StatusTag :value="primary.quality_bad ? (primary.quality_label || '质差') : '正常'" :tone="primary.quality_bad ? 'warn' : 'ok'" /></p>
            </div>
            <div class="hero-info">
              <label>所属 OLT</label>
              <strong>{{ fmt(primary.olt_name) }}</strong>
              <span>{{ fmt(primary.primary_ip) }} · ID {{ fmt(primary.olt_device_id) }}</span>
            </div>
            <div class="hero-info">
              <label>上联端口 / PON</label>
              <strong>{{ fmt(primary.uplink_port_norm || primary.pon_port) }}</strong>
              <span>if_index {{ fmt(primary.if_index) }}</span>
            </div>
            <div class="hero-info">
              <label>注册ID / GDF账号</label>
              <strong>{{ fmt(primary.gdf_account) }}</strong>
              <span>{{ fmt(primary.boss_region) }} / {{ fmt(primary.boss_grid) }}</span>
            </div>
            <div class="hero-info">
              <label>设备型号</label>
              <strong>{{ fmt(primary.device_model) }}</strong>
              <span>{{ fmt(primary.room_group) }} / {{ fmt(primary.room) }}</span>
            </div>
          </div>
        </template>
      </section>

      <section v-if="terminalResolution" class="card terminal-path-card">
        <div class="terminal-path-head">
          <div>
            <span>RADIUS → BOSS → OLT 路径核验</span>
            <h2>用户拨号终端定位链路</h2>
            <p>Radius 中的 MAC 是用户拨号终端，不是 ONU MAC；只有 OLT MAC 表证据才能认定实际 ONU。</p>
          </div>
          <StatusTag :value="terminalResolution.status_label" :tone="terminalStatusTone" />
        </div>
        <div class="terminal-path-flow">
          <article>
            <small>① 拨号终端 MAC</small>
            <strong class="mono">{{ terminalResolution.terminal_mac }}</strong>
            <em>用户路由器 / 电脑网卡</em>
          </article>
          <i>→</i>
          <article>
            <small>② Radius 实际账号</small>
            <strong>{{ terminalResolution.verified_accounts[0] || terminalResolution.accounts[0] || "未识别" }}</strong>
            <em>{{ terminalResolution.verified_accounts.length ? "Access-Accept 已验证" : terminalResolution.accounts.length ? "仅有 Accounting 证据" : "无成功拨号证据" }}</em>
          </article>
          <i>→</i>
          <article>
            <small>③ BOSS 预期 ONU</small>
            <strong class="mono">{{ terminalResolution.expected_onus[0]?.onu_mac || "未登记" }}</strong>
            <em>{{ terminalResolution.expected_onus.length }} 条开通关系</em>
          </article>
          <i>⇄</i>
          <article :class="{ unavailable: !terminalResolution.mapping_source.available }">
            <small>④ OLT 实际 ONU</small>
            <strong class="mono">{{ terminalResolution.actual_mappings[0]?.onu_mac || "待采集" }}</strong>
            <em>{{ terminalResolution.mapping_source.label }}</em>
          </article>
        </div>
        <div class="terminal-path-note">
          <strong>{{ terminalResolution.status_label }}</strong>
          <span v-if="terminalResolution.mapping_source.freshness">{{ terminalResolution.mapping_source.freshness }}</span>
          <span v-else>结论只使用成功认证/Accounting 与可用的 OLT 证据，不使用 ONU MAC 反查 Radius。</span>
        </div>
      </section>

      <template v-if="primary">
        <section class="card onu-radius-bridge">
          <div class="onu-radius-title">
            <div>
              <span>RADIUS 联动</span>
              <h2>宽带认证与流量画像</h2>
              <p v-if="radiusKeyword">仅使用已关联的 GDF 账号查询，不会把 ONU MAC 当成拨号终端 MAC。</p>
              <p v-else>该 ONU 尚未关联 GDF 账号，因此不自动查询 Radius，避免误用 ONU MAC。</p>
            </div>
            <RouterLink
              v-if="radiusKeyword"
              class="btn btn-secondary"
              :to="{ path: '/radius/search', query: { keyword: radiusKeyword } }"
            >查看完整 Radius 画像</RouterLink>
          </div>
          <div v-if="radiusLoading" class="onu-radius-loading"><span class="mini-spinner"></span>正在关联 Radius 数据…</div>
          <div v-else-if="radiusProfile?.matched" class="onu-radius-summary">
            <div><small>健康状态</small><strong>{{ radiusProfile.health.score }} 分 · {{ radiusProfile.health.label }}</strong></div>
            <div><small>最近认证</small><strong>{{ radiusProfile.summary.latest_auth_result || "-" }}</strong><em>{{ radiusProfile.summary.latest_auth_time || "-" }}</em></div>
            <div><small>24h 流量</small><strong>{{ formatBytes(Number(radiusProfile.summary.input_24h || 0) + Number(radiusProfile.summary.output_24h || 0)) }}</strong><em>上行 {{ formatBytes(radiusProfile.summary.input_24h) }}</em></div>
            <div><small>会话 / 终端</small><strong>{{ radiusProfile.summary.sessions || 0 }} / {{ radiusProfile.summary.mac_count || 0 }}</strong><em>{{ radiusProfile.summary.accounting_records || 0 }} 条 Accounting</em></div>
            <div class="onu-radius-issue" :class="radiusProfile.issues[0]?.level">
              <small>诊断结论</small><strong>{{ radiusProfile.issues[0]?.title || "未发现明显异常" }}</strong><em>{{ radiusProfile.issues[0]?.detail }}</em>
            </div>
          </div>
          <div v-else class="onu-radius-empty">{{ radiusKeyword ? "当前 GDF 暂未关联到 Radius 记录。" : "缺少 GDF 账号，未执行 Radius 查询。" }}</div>
        </section>

        <div class="onu-content-grid">
          <section class="card card-pad">
            <div class="card-title">
              <div><h2>光功率趋势</h2><p>RX 蓝色，TX 绿色。鼠标悬停查看具体时间和值。</p></div>
              <div class="trend-toolbar">
                <button v-for="opt in rangeOptions" :key="opt.hours" class="range-btn" :class="{ active: range === opt.hours }" @click="range = opt.hours; loadHistory()">{{ opt.label }}</button>
              </div>
            </div>
            <div class="legend"><span class="rx">RX (dBm)</span><span class="tx">TX (dBm)</span></div>
            <PowerLineChart v-if="history.length" :points="history" :height="286" />
            <EmptyState v-else title="暂无历史趋势" description="当前查询范围内没有光功率历史点" />
          </section>

          <aside class="onu-metric-column">
            <section class="card card-pad">
              <div class="card-title">
                <div><h2>关键指标</h2><p>最新值</p></div>
              </div>
              <div class="onu-metric-grid">
                <div><label>接收光功率 RX</label><strong :class="{ danger: powerBad }">{{ fmt(primary.rx_power) }} <small>dBm</small></strong></div>
                <div><label>发送光功率 TX</label><strong class="green">{{ fmt(primary.tx_power) }} <small>dBm</small></strong></div>
                <div><label>ONU 状态码</label><strong>{{ fmt(primary.status) }}</strong></div>
                <div><label>质差状态</label><strong>{{ primary.quality_bad ? fmt(primary.quality_label || primary.quality_code) : "正常" }}</strong></div>
              </div>
            </section>

            <section class="card card-pad">
              <div class="card-title">
                <div><h2>设备状态</h2><p>采集与业务状态</p></div>
              </div>
              <div class="status-list">
                <p><span>业务状态</span><b>{{ statusText }}</b></p>
                <p><span>管理状态</span><b>{{ statusText === "在线" ? "在线" : "待确认" }}</b></p>
                <p><span>光模块状态</span><b>{{ powerBad ? "异常" : "正常" }}</b></p>
                <p><span>采集时间</span><b>{{ fmt(primary.query_time) }}</b></p>
              </div>
            </section>
          </aside>
        </div>

        <div class="onu-content-grid lower">
          <section class="card table-card">
            <div class="table-head">
              <div><h2>疑似重复记录</h2><p>点击 MAC 可切换当前主记录，展开可查看 OLT 与历史摘要</p></div>
            </div>
            <div class="table-wrap">
              <table class="data-table">
                <thead><tr><th>ONU</th><th>OLT</th><th>端口</th><th>RX/TX</th><th>状态</th><th>时间</th><th>操作</th></tr></thead>
                <tbody>
                  <template v-for="(r, index) in items" :key="recordKey(r)">
                    <tr class="selectable-row" :class="{ selected: selectedKey === recordKey(r) }" @click="selectRecord(r)">
                      <td><button class="mac-button mono" @click.stop="selectRecord(r)">{{ r.display_mac || r.onu_mac }}</button><div class="muted">{{ index === 0 ? "主记录" : "疑似重复" }}</div></td>
                      <td>{{ r.olt_name }}<div class="muted">{{ r.device_model }} / {{ r.primary_ip }}</div></td>
                      <td>{{ r.uplink_port_norm || r.pon_port || "-" }}<div class="muted">{{ r.if_index }}</div></td>
                      <td><strong>{{ fmt(r.rx_power) }} / {{ fmt(r.tx_power) }}</strong></td>
                      <td><StatusTag :value="r.quality_bad ? (r.quality_label || '质差') : '正常'" :tone="r.quality_bad ? 'warn' : 'ok'" /></td>
                      <td>{{ r.query_time }}</td>
                      <td><button class="row-action" @click.stop="toggleDetail(r)">{{ expandedKey === recordKey(r) ? "收起" : "展开" }}</button></td>
                    </tr>
                    <tr v-if="expandedKey === recordKey(r)" class="detail-row">
                      <td colspan="7">
                        <div class="record-detail">
                          <div>
                            <h3>上联 OLT 详情</h3>
                            <table class="detail-table"><tbody>
                              <tr><th>OLT</th><td>{{ fmt(r.olt_name) }}</td><th>型号</th><td>{{ fmt(r.device_model) }}</td></tr>
                              <tr><th>区域/机房</th><td>{{ fmt(r.room_group) }} / {{ fmt(r.room) }}</td><th>设备 ID</th><td>{{ fmt(r.olt_device_id) }}</td></tr>
                              <tr><th>主 IP</th><td>{{ fmt(r.primary_ip) }}</td><th>备 IP</th><td>{{ fmt(r.backup_ip) }}</td></tr>
                              <tr><th>端口</th><td>{{ fmt(r.uplink_port_norm || r.pon_port) }}</td><th>if_index</th><td>{{ fmt(r.if_index) }}</td></tr>
                            </tbody></table>
                          </div>
                          <div>
                            <h3>光功率历史</h3>
                            <table v-if="historyPreview.length" class="detail-table compact">
                              <thead><tr><th>时间</th><th>RX</th><th>TX</th><th>状态</th></tr></thead>
                              <tbody><tr v-for="point in historyPreview" :key="point.sample_time"><td>{{ point.sample_time }}</td><td>{{ fmt(point.rx_power) }}</td><td>{{ fmt(point.tx_power) }}</td><td>{{ point.quality_bad ? "异常" : "正常" }}</td></tr></tbody>
                            </table>
                            <div v-else class="detail-empty">暂无历史光功率</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </section>

          <section class="card card-pad">
            <div class="card-title">
              <div><h2>实时采集结果</h2><p>{{ realtime ? "最近采集" : realtimeLoading ? "实时采集中" : "搜索后自动采集，也可手动刷新" }}</p></div>
              <button class="btn btn-primary" :disabled="realtimeLoading" @click="realtimePower">{{ realtimeLoading ? "刷新中" : "刷新实时光功率" }}</button>
            </div>
            <div v-if="realtimeError" class="quality-message error">{{ realtimeError }}</div>
            <div v-if="realtime" class="realtime-grid">
              <div class="metric-box"><label>RX (dBm)</label><strong>{{ fmt(realtime.rx_power) }}</strong></div>
              <div class="metric-box tx"><label>TX (dBm)</label><strong>{{ fmt(realtime.tx_power) }}</strong></div>
              <div class="metric-box"><label>来源</label><strong style="font-size:18px">{{ fmt(realtime.source || realtime.mode) }}</strong></div>
              <div class="metric-box"><label>采集时间</label><strong style="font-size:18px">{{ fmt(realtime.query_time) }}</strong></div>
            </div>
            <EmptyState v-else title="暂无实时采集" description="实时结果会使用当前主记录的 OLT 与 if_index" />
          </section>
        </div>
      </template>
    </main>
  </div>
</template>
