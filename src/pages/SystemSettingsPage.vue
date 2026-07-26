<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "../services/api";

type OnuRxRule = {
  onu_rx_low_dbm: number;
  onu_rx_high_dbm: number;
  onu_rx_invalid_min_dbm: number;
  onu_rx_invalid_max_dbm: number;
  onu_valid_rx_min_dbm: number;
  onu_valid_rx_max_dbm: number;
  onu_rule_version: string;
};

type PerfRule = {
  olt_cpu_warning: number;
  olt_cpu_critical: number;
  olt_mem_warning: number;
  olt_mem_critical: number;
  board_cpu_warning: number;
  board_cpu_critical: number;
  board_mem_warning: number;
  board_mem_critical: number;
  stale_minutes: number;
  rule_version: string;
};

const onuRule = ref<OnuRxRule>({
  onu_rx_low_dbm: -25,
  onu_rx_high_dbm: -8,
  onu_rx_invalid_min_dbm: -40,
  onu_rx_invalid_max_dbm: 0,
  onu_valid_rx_min_dbm: -40,
  onu_valid_rx_max_dbm: 5,
  onu_rule_version: "onu_rx_web_-25_-8"
});

const perfRule = ref<PerfRule>({
  olt_cpu_warning: 80,
  olt_cpu_critical: 90,
  olt_mem_warning: 80,
  olt_mem_critical: 90,
  board_cpu_warning: 80,
  board_cpu_critical: 90,
  board_mem_warning: 80,
  board_mem_critical: 90,
  stale_minutes: 30,
  rule_version: "olt_perf_web_80_90"
});

const loading = ref(false);
const savingOnu = ref(false);
const savingPerf = ref(false);
const message = ref("");
const error = ref("");

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const data = await api<{ quality: { onu_rx_rule: OnuRxRule }; performance: { olt_rule: PerfRule } }>("/settings");
    onuRule.value = { ...onuRule.value, ...(data.quality?.onu_rx_rule || {}) };
    perfRule.value = { ...perfRule.value, ...(data.performance?.olt_rule || {}) };
  } catch (err) {
    error.value = err instanceof Error ? err.message : "加载配置失败";
  } finally {
    loading.value = false;
  }
}

async function saveOnu() {
  savingOnu.value = true;
  message.value = "";
  error.value = "";
  try {
    const data = await api<{ onu_rx_rule: OnuRxRule }>("/settings/quality/onu-rx-rule", {
      method: "POST",
      body: JSON.stringify(onuRule.value)
    });
    onuRule.value = data.onu_rx_rule;
    message.value = "ONU 光功率规则已保存";
  } catch (err) {
    error.value = err instanceof Error ? err.message : "保存 ONU 光功率规则失败";
  } finally {
    savingOnu.value = false;
  }
}

async function savePerf() {
  savingPerf.value = true;
  message.value = "";
  error.value = "";
  try {
    const data = await api<{ olt_rule: PerfRule }>("/settings/performance/olt-rule", {
      method: "POST",
      body: JSON.stringify(perfRule.value)
    });
    perfRule.value = data.olt_rule;
    message.value = "OLT 性能告警规则已保存";
  } catch (err) {
    error.value = err instanceof Error ? err.message : "保存 OLT 性能规则失败";
  } finally {
    savingPerf.value = false;
  }
}

function resetOnu() {
  onuRule.value = {
    onu_rx_low_dbm: -25,
    onu_rx_high_dbm: -8,
    onu_rx_invalid_min_dbm: -40,
    onu_rx_invalid_max_dbm: 0,
    onu_valid_rx_min_dbm: -40,
    onu_valid_rx_max_dbm: 5,
    onu_rule_version: "onu_rx_web_-25_-8"
  };
}

function resetPerf() {
  perfRule.value = {
    olt_cpu_warning: 80,
    olt_cpu_critical: 90,
    olt_mem_warning: 80,
    olt_mem_critical: 90,
    board_cpu_warning: 80,
    board_cpu_critical: 90,
    board_mem_warning: 80,
    board_mem_critical: 90,
    stale_minutes: 30,
    rule_version: "olt_perf_web_80_90"
  };
}

onMounted(load);
</script>

<template>
  <div class="settings-grid">
    <div v-if="message || error" class="quality-message" :class="{ error: !!error }">{{ error || message }}</div>

    <section class="card card-pad settings-card" :class="{ loading }">
      <div class="card-title">
        <div>
          <h2>ONU 光功率质差规则</h2>
          <p>用于质差管理、趋势统计、导出和日报规则。RX = 0、正数、低于无效下限均不计入质差。</p>
        </div>
      </div>

      <div class="settings-form">
        <label>
          <span>低光阈值</span>
          <input v-model.number="onuRule.onu_rx_low_dbm" class="input" type="number" step="0.1" />
          <em>RX 小于该值判定为接收光过低</em>
        </label>
        <label>
          <span>高光阈值</span>
          <input v-model.number="onuRule.onu_rx_high_dbm" class="input" type="number" step="0.1" />
          <em>RX 大于该值判定为接收光过高</em>
        </label>
        <label>
          <span>无效最小值</span>
          <input v-model.number="onuRule.onu_rx_invalid_min_dbm" class="input" type="number" step="0.1" />
          <em>RX 小于等于该值不计入质差</em>
        </label>
        <label>
          <span>无效最大值</span>
          <input v-model.number="onuRule.onu_rx_invalid_max_dbm" class="input" type="number" step="0.1" />
          <em>RX = 0 或正数不计入质差</em>
        </label>
        <label>
          <span>有效范围最小值</span>
          <input v-model.number="onuRule.onu_valid_rx_min_dbm" class="input" type="number" step="0.1" />
          <em>用于后续劣化分析的有效边界</em>
        </label>
        <label>
          <span>有效范围最大值</span>
          <input v-model.number="onuRule.onu_valid_rx_max_dbm" class="input" type="number" step="0.1" />
          <em>用于后续劣化分析的有效边界</em>
        </label>
        <label class="settings-wide">
          <span>规则版本</span>
          <input v-model="onuRule.onu_rule_version" class="input" />
          <em>调整阈值时建议同步更新版本号，便于追溯历史口径。</em>
        </label>
      </div>

      <div class="settings-rule-preview">
        当前规则：低光 &lt; {{ onuRule.onu_rx_low_dbm }} dBm，高光 &gt; {{ onuRule.onu_rx_high_dbm }} dBm；
        RX = 0、正数、RX &lt;= {{ onuRule.onu_rx_invalid_min_dbm }} dBm 均视为无效值。
      </div>
      <div class="settings-actions">
        <button class="btn btn-primary" :disabled="savingOnu" @click="saveOnu">{{ savingOnu ? "保存中" : "保存光功率规则" }}</button>
        <button class="btn btn-secondary" @click="resetOnu">恢复默认值</button>
      </div>
    </section>

    <section class="card card-pad settings-card" :class="{ loading }">
      <div class="card-title">
        <div>
          <h2>OLT 性能告警规则</h2>
          <p>用于性能监控页面的设备 CPU、内存、板卡 CPU、板卡内存和采集超时判定。</p>
        </div>
      </div>

      <div class="settings-form">
        <label>
          <span>OLT CPU 告警</span>
          <input v-model.number="perfRule.olt_cpu_warning" class="input" type="number" step="1" />
          <em>设备 CPU 大于等于该值显示告警</em>
        </label>
        <label>
          <span>OLT CPU 严重</span>
          <input v-model.number="perfRule.olt_cpu_critical" class="input" type="number" step="1" />
          <em>设备 CPU 大于等于该值显示严重</em>
        </label>
        <label>
          <span>OLT 内存告警</span>
          <input v-model.number="perfRule.olt_mem_warning" class="input" type="number" step="1" />
          <em>设备内存大于等于该值显示告警</em>
        </label>
        <label>
          <span>OLT 内存严重</span>
          <input v-model.number="perfRule.olt_mem_critical" class="input" type="number" step="1" />
          <em>设备内存大于等于该值显示严重</em>
        </label>
        <label>
          <span>板卡 CPU 告警</span>
          <input v-model.number="perfRule.board_cpu_warning" class="input" type="number" step="1" />
          <em>任一板卡 CPU 大于等于该值显示告警</em>
        </label>
        <label>
          <span>板卡 CPU 严重</span>
          <input v-model.number="perfRule.board_cpu_critical" class="input" type="number" step="1" />
          <em>任一板卡 CPU 大于等于该值显示严重</em>
        </label>
        <label>
          <span>板卡内存告警</span>
          <input v-model.number="perfRule.board_mem_warning" class="input" type="number" step="1" />
          <em>任一板卡内存大于等于该值显示告警</em>
        </label>
        <label>
          <span>板卡内存严重</span>
          <input v-model.number="perfRule.board_mem_critical" class="input" type="number" step="1" />
          <em>任一板卡内存大于等于该值显示严重</em>
        </label>
        <label>
          <span>采集超时分钟</span>
          <input v-model.number="perfRule.stale_minutes" class="input" type="number" step="1" />
          <em>超过该时间未更新即标记为采集超时</em>
        </label>
        <label>
          <span>规则版本</span>
          <input v-model="perfRule.rule_version" class="input" />
          <em>用于追溯性能告警口径</em>
        </label>
      </div>

      <div class="settings-rule-preview">
        当前规则：OLT CPU / 内存告警 {{ perfRule.olt_cpu_warning }}% / {{ perfRule.olt_mem_warning }}%，
        板卡 CPU / 内存告警 {{ perfRule.board_cpu_warning }}% / {{ perfRule.board_mem_warning }}%，
        采集超时 {{ perfRule.stale_minutes }} 分钟。
      </div>
      <div class="settings-actions">
        <button class="btn btn-primary" :disabled="savingPerf" @click="savePerf">{{ savingPerf ? "保存中" : "保存性能规则" }}</button>
        <button class="btn btn-secondary" @click="resetPerf">恢复默认值</button>
      </div>
    </section>
  </div>
</template>
