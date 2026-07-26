<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Eye, EyeOff, History, LockKeyhole, ShieldCheck, UserRound } from "lucide-vue-next";
import { login } from "../services/api";
import type { User } from "../types";

const emit = defineEmits<{ "logged-in": [user?: User] }>();
const account = ref("");
const password = ref("");
const remember = ref(false);
const showPassword = ref(false);
const loading = ref(false);
const error = ref("");
const brandWordmark = "/brand/jscn-wordmark.webp";
const REMEMBER_KEY = "netops2026_remembered_login";

onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem(REMEMBER_KEY) || "null");
    if (saved?.account) { account.value = saved.account; remember.value = true; }
  } catch { localStorage.removeItem(REMEMBER_KEY); }
});

async function submit() {
  error.value = ""; loading.value = true;
  try {
    const data = await login(account.value.trim(), password.value);
    if (remember.value) localStorage.setItem(REMEMBER_KEY, JSON.stringify({ account: account.value.trim() }));
    else localStorage.removeItem(REMEMBER_KEY);
    emit("logged-in", data.user);
  } catch (err) { error.value = err instanceof Error ? err.message : "登录失败"; }
  finally { loading.value = false; }
}
</script>

<template>
  <main class="login-page">
    <a class="login-legacy-link" href="/2025/" title="旧版支持到12月31日，请逐步切换使用"><History :size="16" />旧版入口</a>
    <div class="login-atmosphere"><span></span><span></span><span></span></div>
    <section class="login-story">
      <div class="login-story-badge"><ShieldCheck :size="17" /> 正式上线 · 安全 · 稳定 · 可观测</div>
      <h1>让每一次网络波动<br /><strong>都有迹可循</strong></h1>
      <p>统一连接设备、采集、性能与质差数据，让运维判断更快一步。</p>
      <div class="login-network-visual" aria-hidden="true"><i v-for="n in 14" :key="n"></i></div>
    </section>
    <form class="login-card" @submit.prevent="submit">
      <div class="login-brand"><img class="login-wordmark" :src="brandWordmark" alt="江苏有线 南京安播智维平台" /></div>
      <div class="login-welcome"><h2>欢迎登录</h2><p>请输入平台账号继续访问</p></div>
      <label class="login-input"><UserRound :size="18" /><input v-model="account" autocomplete="username" required placeholder="手机号、OA 账号或 OSS 账号" /></label>
      <label class="login-input"><LockKeyhole :size="18" /><input v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" required placeholder="请输入密码" /><button type="button" title="显示或隐藏密码" @click="showPassword = !showPassword"><EyeOff v-if="showPassword" :size="17" /><Eye v-else :size="17" /></button></label>
      <label class="remember-login"><input v-model="remember" type="checkbox" /><span>记住账号</span><em>不会保存密码</em></label>
      <button class="btn btn-primary login-submit" :disabled="loading">{{ loading ? "正在登录…" : "登录平台" }}</button>
      <div class="login-error">{{ error }}</div>
      <aside class="login-support-note">优先使用江苏有线南京分公司 <strong>OA 账号</strong>登录，也支持 OSS 账号或手机号。账号使用、权限等问题请联系南京安播中心。</aside>
      <footer>© 2026 江苏有线南京分公司安播中心 版权所有</footer>
    </form>
  </main>
</template>
