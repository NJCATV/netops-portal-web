<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-vue-next";
import EmptyState from "../components/EmptyState.vue";
import { api } from "../services/api";

type BossUser = {
  company?: string;
  id_number?: string;
  name?: string;
  address?: string;
  region?: string;
  grid?: string;
  visit_datetime?: string;
  onu_serial_number?: string;
  onu_mac_norm?: string;
  display_mac?: string;
};

type BossAccess = { access_token: string; expires_at: number; ttl_seconds: number };
const ACCESS_KEY = "netops2026_boss_access";
const keyword = ref("");
const rows = ref<BossUser[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(20);
const loading = ref(false);
const uploading = ref(false);
const verifying = ref(false);
const message = ref("");
const error = ref("");
const accessToken = ref("");
const accessExpiresAt = ref(0);
const accessDialogOpen = ref(false);
const password = ref("");
const showPassword = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const accessMinutes = computed(() => Math.max(0, Math.ceil((accessExpiresAt.value * 1000 - Date.now()) / 60000)));

function restoreAccess() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(ACCESS_KEY) || "null") as BossAccess | null;
    if (saved?.access_token && Number(saved.expires_at) > Math.floor(Date.now() / 1000) + 5) {
      accessToken.value = saved.access_token;
      accessExpiresAt.value = Number(saved.expires_at);
      return true;
    }
  } catch {
    // Invalid session data is treated as expired authorization.
  }
  sessionStorage.removeItem(ACCESS_KEY);
  return false;
}

function clearAccess() {
  accessToken.value = "";
  accessExpiresAt.value = 0;
  sessionStorage.removeItem(ACCESS_KEY);
}

function bossApi<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  if (accessToken.value) headers.set("X-Boss-Access", accessToken.value);
  return api<T>(path, { ...options, headers });
}

function handleBossError(err: unknown, fallback: string) {
  const text = err instanceof Error ? err.message : fallback;
  if (text.includes("敏感访问授权") || text.includes("重新验证登录密码")) {
    clearAccess();
    accessDialogOpen.value = true;
  }
  return text;
}

async function verifyAccess() {
  if (!password.value) {
    error.value = "请输入当前登录密码";
    return;
  }
  verifying.value = true;
  error.value = "";
  try {
    const data = await api<BossAccess>("/boss/access", {
      method: "POST",
      body: JSON.stringify({ password: password.value }),
    });
    accessToken.value = data.access_token;
    accessExpiresAt.value = Number(data.expires_at);
    sessionStorage.setItem(ACCESS_KEY, JSON.stringify(data));
    password.value = "";
    showPassword.value = false;
    accessDialogOpen.value = false;
    await load();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "密码验证失败";
  } finally {
    verifying.value = false;
  }
}

async function load() {
  if (!accessToken.value || accessExpiresAt.value <= Math.floor(Date.now() / 1000)) {
    clearAccess();
    accessDialogOpen.value = true;
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    const data = await bossApi<{ items: BossUser[]; total: number }>(
      `/boss/users?page=${page.value}&size=${size.value}&keyword=${encodeURIComponent(keyword.value.trim())}`
    );
    rows.value = data.items || [];
    total.value = data.total || 0;
  } catch (err) {
    error.value = handleBossError(err, "加载失败");
  } finally {
    loading.value = false;
  }
}

function search() {
  if (keyword.value.trim() && keyword.value.trim().length < 4) {
    error.value = "请输入至少 4 个有效字符";
    return;
  }
  page.value = 1;
  load();
}

async function uploadFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  uploading.value = true;
  message.value = "";
  error.value = "";
  try {
    const form = new FormData();
    form.append("file", file);
    const data = await bossApi<{ total_rows: number; valid_rows: number; inserted: number; updated: number; skipped: number }>("/boss/users/import", {
      method: "POST",
      body: form,
      headers: {}
    });
    message.value = `导入完成：总行数 ${data.total_rows}，有效 ${data.valid_rows}，新增 ${data.inserted}，更新 ${data.updated}，跳过 ${data.skipped}`;
    await load();
  } catch (err) {
    error.value = handleBossError(err, "导入失败");
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = "";
  }
}

onMounted(() => {
  if (restoreAccess()) void load();
  else accessDialogOpen.value = true;
});
</script>

<template>
  <div class="page-grid">
    <section class="card card-pad">
      <div class="card-title">
        <div>
          <h2>BOSS ONU 信息增量导入</h2>
          <p>支持 Excel 列：公司、证号、区域、网格、入户时间日期、ONU序列号。不会覆盖姓名、地址、电话等缺失字段。</p>
        </div>
        <button class="btn btn-primary" :disabled="uploading" @click="fileInput?.click()">
          {{ uploading ? "导入中..." : "上传 Excel" }}
        </button>
      </div>
      <div class="boss-access-state"><ShieldCheck :size="15" /><span>敏感访问已加强保护</span><em v-if="accessToken">授权约 {{ accessMinutes }} 分钟后失效</em><button class="btn btn-secondary" @click="clearAccess(); accessDialogOpen = true">重新验证</button></div>
      <input ref="fileInput" type="file" accept=".xlsx" style="display:none" @change="uploadFile" />
      <div v-if="message" class="health-note">{{ message }}</div>
      <div v-if="error" class="health-note" style="color:var(--danger);background:var(--danger-soft);border-color:#fecaca">{{ error }}</div>
    </section>

    <section class="card search-card">
      <div class="search-row" style="margin-top:0">
        <div class="input-wrap">
          <span class="input-icon">⌕</span>
          <input v-model="keyword" class="input" placeholder="搜索 GDF账号、姓名、地址、区域、网格或 ONU MAC" @keydown.enter="search" />
          <button v-if="keyword" class="clear-btn" @click="keyword = ''">×</button>
        </div>
        <button class="btn btn-primary" :disabled="loading" @click="search">查询</button>
        <button class="btn btn-secondary" @click="keyword = ''; search()">重置</button>
      </div>
    </section>

    <section class="card table-card">
      <div class="card-title card-pad" style="margin-bottom:0">
        <div>
          <h2>BOSS 用户列表</h2>
          <p>共 {{ total }} 条，当前仅展示最近 {{ size }} 条</p>
        </div>
      </div>
      <EmptyState v-if="!loading && !rows.length" title="等待查询" description="验证登录密码后，请输入至少 4 个字符查询 BOSS 用户。" />
      <div v-else class="table-wrap">
        <table class="data-table">
          <thead>
            <tr><th>GDF账号</th><th>用户</th><th>区域/网格</th><th>ONU MAC</th><th>公司</th><th>入户时间</th><th>地址</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="`${r.onu_mac_norm}-${r.id_number}`">
              <td><strong>{{ r.id_number || "-" }}</strong></td>
              <td>{{ r.name || "-" }}</td>
              <td>{{ r.region || "-" }} / {{ r.grid || "-" }}</td>
              <td class="mono">{{ r.display_mac || r.onu_serial_number || "-" }}</td>
              <td>{{ r.company || "-" }}</td>
              <td>{{ r.visit_datetime || "-" }}</td>
              <td>{{ r.address || "-" }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="accessDialogOpen" class="boss-access-mask">
      <form class="boss-access-dialog" @submit.prevent="verifyAccess">
        <div class="boss-access-icon"><ShieldCheck :size="27" /></div>
        <div><h2>验证敏感数据访问</h2><p>BOSS 用户资料包含敏感信息。请输入当前平台登录密码，验证通过后获得 5 分钟访问授权。</p></div>
        <label><span>当前登录密码</span><div><KeyRound :size="16" /><input v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" autofocus /><button type="button" @click="showPassword = !showPassword"><EyeOff v-if="showPassword" :size="16" /><Eye v-else :size="16" /></button></div></label>
        <div v-if="error" class="boss-access-error">{{ error }}</div>
        <footer><button class="btn btn-primary" :disabled="verifying">{{ verifying ? "验证中…" : "验证并进入" }}</button></footer>
      </form>
    </div>
  </div>
</template>

<style scoped>
.boss-access-state{display:flex;align-items:center;gap:8px;margin-top:14px;padding:10px 12px;border:1px solid #dbe5ff;border-radius:10px;color:#3654c7;background:#f5f7ff;font-size:12px}.boss-access-state em{margin-left:auto;color:var(--muted);font-style:normal}.boss-access-state .btn{min-height:30px;padding:5px 10px}.boss-access-mask{position:fixed;inset:0;z-index:1100;display:grid;place-items:center;padding:24px;background:rgba(12,20,40,.55);backdrop-filter:blur(8px)}.boss-access-dialog{width:min(460px,100%);display:grid;gap:17px;padding:28px;border:1px solid #dce4f3;border-radius:20px;background:#fff;box-shadow:0 28px 80px rgba(15,23,42,.28)}.boss-access-icon{display:grid;place-items:center;width:52px;height:52px;border-radius:15px;color:#465fe7;background:#eef2ff}.boss-access-dialog h2{margin:0 0 6px;font-size:20px}.boss-access-dialog p{margin:0;color:var(--muted);font-size:13px;line-height:1.65}.boss-access-dialog label{display:grid;gap:6px}.boss-access-dialog label>span{font-size:12px;font-weight:700}.boss-access-dialog label>div{display:flex;align-items:center;gap:8px;height:42px;padding:0 11px;border:1px solid var(--line);border-radius:10px}.boss-access-dialog input{flex:1;min-width:0;border:0;outline:0}.boss-access-dialog label button{display:grid;place-items:center;border:0;color:var(--muted);background:transparent;cursor:pointer}.boss-access-error{padding:10px 12px;border-radius:9px;color:#b42318;background:#fff1f0;font-size:12px}.boss-access-dialog footer{display:flex;justify-content:flex-end}@media(max-width:700px){.boss-access-state{align-items:flex-start;flex-wrap:wrap}.boss-access-state em{width:100%;margin-left:23px}}
</style>
