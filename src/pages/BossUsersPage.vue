<script setup lang="ts">
import { onMounted, ref } from "vue";
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

const keyword = ref("");
const rows = ref<BossUser[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(30);
const loading = ref(false);
const uploading = ref(false);
const message = ref("");
const error = ref("");
const fileInput = ref<HTMLInputElement | null>(null);

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const data = await api<{ items: BossUser[]; total: number }>(
      `/boss/users?page=${page.value}&size=${size.value}&keyword=${encodeURIComponent(keyword.value.trim())}`
    );
    rows.value = data.items || [];
    total.value = data.total || 0;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "加载失败";
  } finally {
    loading.value = false;
  }
}

function search() {
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
    const data = await api<{ total_rows: number; valid_rows: number; inserted: number; updated: number; skipped: number }>("/boss/users/import", {
      method: "POST",
      body: form,
      headers: {}
    });
    message.value = `导入完成：总行数 ${data.total_rows}，有效 ${data.valid_rows}，新增 ${data.inserted}，更新 ${data.updated}，跳过 ${data.skipped}`;
    await load();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "导入失败";
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = "";
  }
}

onMounted(load);
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
      <EmptyState v-if="!loading && !rows.length" title="暂无 BOSS 用户" description="请上传 Excel 或调整查询条件。" />
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
  </div>
</template>
