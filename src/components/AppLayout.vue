<script setup lang="ts">
import { computed, onMounted, ref, type Component } from "vue";
import { useRoute } from "vue-router";
import { Activity, BarChart3, Bot, BrainCircuit, Building2, ChevronDown, ChevronLeft, ChevronRight, CircleGauge, DatabaseZap, History, KeyRound, LayoutDashboard, Menu, MonitorCog, Moon, Network, RadioTower, Search, ServerCog, Settings, ShieldCheck, Sun, Users, Waves } from "lucide-vue-next";
import type { User } from "../types";
import { api } from "../services/api";

const props = defineProps<{ user: User | null; title: string; subtitle: string }>();
const emit = defineEmits<{ logout: []; "change-password": [] }>();
const route = useRoute();
const collapsed = ref(false);
const drawerOpen = ref(false);
const userMenuOpen = ref(false);
const savedTheme = localStorage.getItem("netops2026_web_theme");
const theme = ref(savedTheme === "dark" ? "dark" : "light");
const brandIcon = "/brand/jscn-icon.webp";
const allowedMenuKeys = ref<Set<string> | null>(null);

type MenuItem = { menuKey: string; path: string; label: string; icon: Component; roles?: string[] };
const allMenuGroups: Array<{ label: string; items: MenuItem[] }> = [
  { label: "总览", items: [{ menuKey: "netops.dashboard", path: "/dashboard", label: "统一驾驶舱", icon: LayoutDashboard }] },
  { label: "FTTH 网络管理", items: [
    { menuKey: "netops.onu_search", path: "/onu-search", label: "单台 ONU 查询", icon: Search },
    { menuKey: "netops.quality", path: "/quality", label: "ONU 质差管理", icon: Activity },
    { menuKey: "netops.performance", path: "/performance", label: "OLT 性能看板", icon: CircleGauge },
    { menuKey: "netops.collector", path: "/collector", label: "采集监控", icon: DatabaseZap },
    { menuKey: "netops.devices", path: "/devices", label: "OLT 设备管理", icon: RadioTower },
    { menuKey: "netops.boss_users", path: "/boss-users", label: "BOSS 用户管理", icon: Users }
  ] },
  { label: "HFC 网络管理", items: [{ menuKey: "netops.hfc", path: "/hfc", label: "CM MAC 查询", icon: Waves }, { menuKey: "netops.cmts_devices", path: "/cmts-devices", label: "CMTS 设备管理", icon: RadioTower, roles: ["super_admin", "org_admin"] }] },
  { label: "Radius 管理", items: [{ menuKey: "netops.radius", path: "/radius", label: "Radius 管理系统", icon: ShieldCheck }] },
  { label: "智能运维", items: [
    { menuKey: "netops.aiops", path: "/aiops/board", label: "AIOps 运维看板", icon: BrainCircuit },
    { menuKey: "netops.aiops", path: "/aiops", label: "AIOps 运维中心", icon: Activity },
    { menuKey: "netops.ai_assistant", path: "/ai-assistant", label: "AI 问答", icon: Bot },
    { menuKey: "netops.aiops_knowledge", path: "/aiops/knowledge", label: "知识库", icon: DatabaseZap }
  ] },
  { label: "系统管理", items: [
    { menuKey: "netops.settings", path: "/settings", label: "系统配置", icon: Settings, roles: ["super_admin"] },
    { menuKey: "netops.users", path: "/users", label: "用户管理", icon: Users, roles: ["super_admin", "org_admin"] },
    { menuKey: "netops.orgs", path: "/user-orgs", label: "用户组织管理", icon: Building2, roles: ["super_admin", "org_admin"] },
    { menuKey: "netops.device_orgs", path: "/device-orgs", label: "设备组织管理", icon: RadioTower, roles: ["super_admin", "org_admin"] },
    { menuKey: "netops.permissions", path: "/permissions", label: "权限管理", icon: ShieldCheck, roles: ["super_admin"] },
    { menuKey: "netops.system_audit", path: "/system-audit", label: "系统审计与使用分析", icon: BarChart3, roles: ["super_admin"] },
    { menuKey: "netops.infrastructure", path: "/infrastructure", label: "基础设施监控", icon: ServerCog, roles: ["super_admin"] },
    { menuKey: "netops.aiops_admin", path: "/aiops/admin", label: "AIOps 系统管理", icon: MonitorCog, roles: ["super_admin", "org_admin"] }
  ] }
];
const menuGroups = computed(() => allMenuGroups.map(group => ({ ...group, items: group.items.filter(item => {
  const roleAllowed = !item.roles || item.roles.includes(props.user?.role_code || "normal_user");
  return roleAllowed && (!allowedMenuKeys.value || allowedMenuKeys.value.has(item.menuKey));
}) })).filter(group => group.items.length));
function applyTheme(value: string) { theme.value = value === "dark" ? "dark" : "light"; localStorage.setItem("netops2026_web_theme", theme.value); document.documentElement.dataset.theme = theme.value; }
function isActive(path: string) {
  if (path === "/radius") return route.path === "/radius" || route.path.startsWith("/radius/");
  if (path === "/aiops/admin") return ["/aiops/admin", "/aiops/models", "/aiops/settings", "/aiops/audit"].includes(route.path);
  if (path === "/aiops") return ["/aiops", "/aiops/events", "/aiops/analysis", "/aiops/syslog", "/aiops/trap", "/aiops/rules", "/aiops/tasks"].includes(route.path);
  return route.path === path;
}
onMounted(async () => {
  applyTheme(theme.value);
  try {
    const data = await api<{items:any[]}>("/navigation");
    const menuKeys = (data.items || []).map(item => String(item.menu_key || "")).filter(key => key.startsWith("netops."));
    allowedMenuKeys.value = new Set(menuKeys);
  } catch { allowedMenuKeys.value = null; }
});
</script>

<template>
  <div class="app-shell" :class="{ 'is-collapsed': collapsed, 'drawer-open': drawerOpen }">
    <div class="drawer-mask" @click="drawerOpen = false"></div>
    <aside class="sidebar">
      <div class="brand"><img class="brand-logo" :src="brandIcon" alt="南京安播智维平台" /><div class="brand-text"><strong>南京安播智维平台</strong><span>网络管理平台</span></div></div>
      <nav class="nav-list">
        <section v-for="group in menuGroups" :key="group.label" class="nav-section">
          <div class="nav-section-title">{{ group.label }}</div>
          <RouterLink v-for="item in group.items" :key="item.path" :to="item.path" class="nav-item" :class="{ active: isActive(item.path) }" :title="collapsed ? item.label : undefined" @click="drawerOpen = false">
            <span class="nav-icon"><component :is="item.icon" :size="18" :stroke-width="1.9" /></span><span class="nav-label">{{ item.label }}</span>
          </RouterLink>
        </section>
      </nav>
      <button class="collapse-btn" :title="collapsed ? '展开菜单' : '收起菜单'" @click="collapsed = !collapsed"><ChevronRight v-if="collapsed" :size="17" /><ChevronLeft v-else :size="17" /></button>
    </aside>
    <main class="main-shell">
      <header class="topbar">
        <div class="topbar-left"><button class="mobile-menu" @click="drawerOpen = true"><Menu :size="18" /></button><div class="topbar-crumb"><Network :size="15" /> 接入网运维 / {{ title }}</div></div>
        <div class="topbar-actions">
          <a class="legacy-entry-btn" href="/2025/" title="旧版支持到12月31日，请逐步切换使用"><History :size="16" /><span>旧版入口</span></a>
          <button class="theme-toggle" :title="theme === 'dark' ? '切换浅色主题' : '切换深色主题'" @click="applyTheme(theme === 'dark' ? 'light' : 'dark')"><Sun v-if="theme === 'dark'" :size="17" /><Moon v-else :size="17" /><span>{{ theme === 'dark' ? '浅色' : '深色' }}</span></button>
          <div class="user-menu"><button class="user-chip" @click="userMenuOpen = !userMenuOpen"><span class="avatar">{{ (user?.real_name || user?.name || user?.mobile || '用').slice(0, 1) }}</span><span><strong>{{ user?.real_name || user?.name || user?.mobile || '当前用户' }}</strong><em>{{ user?.org_name || '南京分公司' }}</em></span><ChevronDown :size="15" /></button><div v-if="userMenuOpen" class="user-menu-pop"><button @click="userMenuOpen = false; emit('change-password')"><KeyRound :size="15" />修改密码</button><button @click="emit('logout')">退出登录</button></div></div>
        </div>
      </header>
      <section class="content-shell"><slot /></section>
      <footer class="platform-footer">© 2026 江苏有线南京分公司安播中心 版权所有</footer>
    </main>
  </div>
</template>
