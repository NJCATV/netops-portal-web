<script setup lang="ts">
import { computed, ref } from "vue";
import { KeyRound, ShieldCheck } from "lucide-vue-next";
import { changePassword } from "../services/api";

const props = withDefaults(defineProps<{ initial?: boolean }>(), { initial: true });
const emit = defineEmits<{ changed: []; skipped: []; canceled: [] }>();
const oldPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const saving = ref(false);
const error = ref("");
const title = computed(() => props.initial ? "请修改初始密码" : "修改登录密码");

function passwordClassCount(value: string) {
  return [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(pattern => pattern.test(value)).length;
}

async function submit() {
  error.value = "";
  if (!oldPassword.value || !newPassword.value) {
    error.value = "请输入当前密码和新密码";
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    error.value = "两次输入的新密码不一致";
    return;
  }
  if (newPassword.value.length < 8 || passwordClassCount(newPassword.value) < 2) {
    error.value = "新密码至少 8 位，并包含字母、数字、特殊字符等至少两类字符";
    return;
  }
  saving.value = true;
  try {
    await changePassword(oldPassword.value, newPassword.value);
    emit("changed");
  } catch (value) {
    error.value = value instanceof Error ? value.message : "密码修改失败";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="initial-password-mask">
    <form class="initial-password-card" @submit.prevent="submit">
      <div class="initial-password-icon"><ShieldCheck :size="28" /></div>
      <div>
        <div class="eyebrow">{{ initial ? "首次登录安全提醒" : "账号安全" }}</div>
        <h2>{{ title }}</h2>
        <p v-if="initial">初始密码仅用于账号开通。建议现在修改；如需先处理工作，也可以暂时跳过，下次登录仍会提醒。</p>
        <p v-else>修改后请使用新密码登录，OA 用户名、OSS 账号和手机号共用同一平台密码。</p>
      </div>
      <label><span>当前密码</span><div><KeyRound :size="16"/><input v-model="oldPassword" type="password" autocomplete="current-password" /></div></label>
      <label><span>新密码</span><div><KeyRound :size="16"/><input v-model="newPassword" type="password" autocomplete="new-password" placeholder="至少 8 位，包含两类字符" /></div></label>
      <label><span>确认新密码</span><div><KeyRound :size="16"/><input v-model="confirmPassword" type="password" autocomplete="new-password" /></div></label>
      <div v-if="error" class="initial-password-error">{{ error }}</div>
      <footer>
        <button v-if="initial" type="button" class="btn btn-secondary" :disabled="saving" @click="emit('skipped')">暂时跳过</button>
        <button v-else type="button" class="btn btn-secondary" :disabled="saving" @click="emit('canceled')">取消</button>
        <button class="btn btn-primary" :disabled="saving">{{ saving ? "正在保存…" : (initial ? "修改并进入" : "确认修改") }}</button>
      </footer>
    </form>
  </div>
</template>

<style scoped>
.initial-password-mask{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:24px;background:rgba(12,20,40,.48);backdrop-filter:blur(8px)}
.initial-password-card{width:min(460px,100%);display:grid;gap:18px;padding:28px;border:1px solid #dce4f3;border-radius:22px;background:#fff;box-shadow:0 28px 80px rgba(15,23,42,.24)}
.initial-password-icon{width:54px;height:54px;display:grid;place-items:center;border-radius:16px;color:#465fe7;background:#eef2ff}
h2{margin:4px 0 8px;font-size:25px;color:#111827}p{margin:0;color:#64748b;line-height:1.7}.eyebrow{color:#4963e8;font-size:12px;font-weight:800;letter-spacing:.08em}
label{display:grid;gap:7px;color:#334155;font-size:13px;font-weight:700}label div{display:flex;align-items:center;gap:9px;padding:0 13px;border:1px solid #dbe3ef;border-radius:11px;color:#8190a7}input{width:100%;height:42px;border:0;outline:0;background:transparent;color:#111827;font:inherit}
.initial-password-error{padding:10px 12px;border-radius:10px;color:#b42318;background:#fff1f0;font-size:13px}footer{display:flex;justify-content:flex-end;gap:10px;margin-top:2px}
</style>
