<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppLayout from "./components/AppLayout.vue";
import InitialPasswordDialog from "./components/InitialPasswordDialog.vue";
import LoginPage from "./pages/LoginPage.vue";
import { clearToken, getToken, me } from "./services/api";
import type { User } from "./types";

const router = useRouter();
const route = useRoute();
const ready = ref(false);
const authenticated = ref(false);
const user = ref<User | null>(null);
const showInitialPassword = ref(false);
const showManualPassword = ref(false);
const visualPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "aiops";

const pageTitle = computed(() => String(route.meta.title || "南京安播智维平台"));
const pageSubtitle = computed(() => String(route.meta.subtitle || "广电网络运行维护"));

async function loadUser() {
  if (!getToken()) {
    authenticated.value = false;
    ready.value = true;
    return;
  }
  try {
    const data = await me();
    user.value = "user" in data ? data.user : data;
    authenticated.value = true;
    showInitialPassword.value = user.value?.password_status === "initial";
  } catch {
    clearToken();
    authenticated.value = false;
  } finally {
    ready.value = true;
  }
}

function handleLoggedIn(nextUser?: User) {
  user.value = nextUser || null;
  authenticated.value = true;
  showInitialPassword.value = nextUser?.password_status === "initial";
  router.replace("/dashboard");
}

function logout() {
  clearToken();
  user.value = null;
  authenticated.value = false;
  showInitialPassword.value = false;
}

function handlePasswordChanged() {
  showInitialPassword.value = false;
  showManualPassword.value = false;
  if (user.value) user.value.password_status = "normal";
}

onMounted(() => {
  if (visualPreview) {
    user.value = { id: 0, real_name: "视觉预览", role_code: "super_admin", org_name: "南京分公司" };
    authenticated.value = true;
    ready.value = true;
    return;
  }
  loadUser();
});
</script>

<template>
  <div v-if="!ready" class="boot-screen">正在进入南京安播智维平台...</div>
  <LoginPage v-else-if="!authenticated" @logged-in="handleLoggedIn" />
  <AppLayout
    v-else
    :user="user"
    :title="pageTitle"
    :subtitle="pageSubtitle"
    @change-password="showManualPassword = true"
    @logout="logout"
  >
    <RouterView />
  </AppLayout>
  <InitialPasswordDialog
    v-if="authenticated && (showInitialPassword || showManualPassword)"
    :initial="showInitialPassword"
    @changed="handlePasswordChanged"
    @skipped="showInitialPassword = false"
    @canceled="showManualPassword = false"
  />
</template>
