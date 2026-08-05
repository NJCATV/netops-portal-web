import { createApp } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";
import App from "./App.vue";
import DashboardPage from "./pages/DashboardPage.vue";
import OnuSearchPage from "./pages/OnuSearchPage.vue";
import QualityPage from "./pages/QualityPage.vue";
import OltPerformancePage from "./pages/OltPerformancePage.vue";
import CollectorPage from "./pages/CollectorPage.vue";
import DevicesPage from "./pages/DevicesPage.vue";
import BossUsersPage from "./pages/BossUsersPage.vue";
import SystemSettingsPage from "./pages/SystemSettingsPage.vue";
import UsersPage from "./pages/UsersPage.vue";
import OrganizationsPage from "./pages/OrganizationsPage.vue";
import DeviceOrganizationsPage from "./pages/DeviceOrganizationsPage.vue";
import PermissionsPage from "./pages/PermissionsPage.vue";
import CmSearchPage from "./pages/CmSearchPage.vue";
import CmtsDevicesPage from "./pages/CmtsDevicesPage.vue";
import PlaceholderPage from "./pages/PlaceholderPage.vue";
import SystemAuditPage from "./pages/SystemAuditPage.vue";
import { recordUsageEvent } from "./services/api";
import "./styles.css";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/dashboard" },
    { path: "/dashboard", component: DashboardPage, meta: { title: "统一驾驶舱", subtitle: "系统运行、采集质量、质差变化与风险汇总" } },
    { path: "/onu-search", component: OnuSearchPage, meta: { title: "单台 ONU 查询", subtitle: "按 MAC、GDF账号、姓名、地址检索，快速定位当前最可信记录" } },
    { path: "/quality", component: QualityPage, meta: { title: "ONU 质差管理", subtitle: "质差筛选、趋势分析、导出和批量定位" } },
    { path: "/performance", component: OltPerformancePage, meta: { title: "OLT 性能看板", subtitle: "OLT CPU、内存与最近性能采集状态" } },
    { path: "/collector", component: CollectorPage, meta: { title: "采集监控", subtitle: "采集成功率、慢设备、失败原因与最近进度" } },
    { path: "/devices", component: DevicesPage, meta: { title: "OLT 设备管理", subtitle: "设备基础档案、组织归属和新增检测" } },
    { path: "/boss-users", component: BossUsersPage, meta: { title: "BOSS 用户管理", subtitle: "上传 BOSS ONU Excel，增量更新 GDF账号、区域和网格" } },
    { path: "/probe", redirect: "/devices" },
    { path: "/hfc", component: CmSearchPage, meta: { title: "CM MAC 查询", subtitle: "按 MAC 地址定位 CM、CMTS、端口与信号指标" } },
    { path: "/cmts-devices", component: CmtsDevicesPage, meta: { title: "CMTS 设备管理", subtitle: "维护 HFC CMTS 设备档案与采集范围", admin: true } },
    { path: "/radius", component: () => import("./pages/RadiusLookupPage.vue"), meta: { title: "Radius 一键查询", subtitle: "按 GDF 账号或 MAC 汇总认证、流量、会话与问题诊断" } },
    { path: "/radius/search", component: () => import("./pages/RadiusLookupPage.vue"), meta: { title: "Radius 一键查询", subtitle: "按 GDF 账号或 MAC 汇总认证、流量、会话与问题诊断" } },
    { path: "/radius/overview", component: () => import("./pages/RadiusOverviewPage.vue"), meta: { title: "Radius 运行总览", subtitle: "认证、风险、Accounting 流量与采集链路" } },
    { path: "/radius/records", component: () => import("./pages/RadiusRecordsPage.vue"), meta: { title: "Radius 认证明细", subtitle: "认证记录检索与导出" } },
    { path: "/radius/reject", component: () => import("./pages/RadiusRiskPage.vue"), props: { kind: "reject" }, meta: { title: "Radius 拒绝风险", subtitle: "高频拒绝账号分析" } },
    { path: "/radius/multi-mac", component: () => import("./pages/RadiusRiskPage.vue"), props: { kind: "multi" }, meta: { title: "Radius 多终端账号", subtitle: "账号终端关联分析" } },
    { path: "/radius/analytics", redirect: "/radius/analytics/auth" },
    { path: "/radius/analytics/auth", component: () => import("./pages/RadiusAnalyticsPage.vue"), props: { section: "auth" }, meta: { title: "Radius 认证与 NAS", subtitle: "拒绝原因、NAS 认证负载与控制报文" } },
    { path: "/radius/analytics/session", component: () => import("./pages/RadiusAnalyticsPage.vue"), props: { section: "session" }, meta: { title: "Radius 会话与重连", subtitle: "活跃会话、频繁重连与终端关联" } },
    { path: "/radius/accounting", component: () => import("./pages/RadiusAccountingPage.vue"), meta: { title: "Radius Accounting 与流量异常", subtitle: "会话流量趋势与异常账号观察" } },
    { path: "/aiops/board", component: () => import("./pages/AiopsOperationsBoardPage.vue"), meta: { title: "AIOps 运维看板", subtitle: "AI 研判结果、证据与处置建议" } },
    { path: "/aiops", component: () => import("./pages/AiopsOverviewPage.vue"), meta: { title: "AIOps 智能运维", subtitle: "日志、Trap、聚合事件与 AI 研判" } },
    { path: "/aiops/events", component: () => import("./pages/AiopsEventsPage.vue"), meta: { title: "AIOps 聚合事件", subtitle: "按设备和对象聚合重复告警" } },
    { path: "/aiops/analysis", component: () => import("./pages/AiopsAnalysisPage.vue"), meta: { title: "AIOps AI 分析", subtitle: "受控工具、证据链与分析历史" } },
    { path: "/aiops/syslog", component: () => import("./pages/AiopsLogsPage.vue"), props: { kind: "syslog" }, meta: { title: "Syslog 检索", subtitle: "结构化日志与原始证据" } },
    { path: "/aiops/trap", component: () => import("./pages/AiopsLogsPage.vue"), props: { kind: "trap" }, meta: { title: "SNMP Trap 检索", subtitle: "Trap 翻译、告警定义与原始证据" } },
    { path: "/aiops/knowledge", component: () => import("./pages/AiopsKnowledgePage.vue"), meta: { title: "AIOps 故障知识库", subtitle: "故障报告和值班报修经验" } },
    { path: "/aiops/tasks", component: () => import("./pages/AiopsTasksPage.vue"), meta: { title: "AIOps 分析任务", subtitle: "周期分析、执行计划与结果落库" } },
    { path: "/aiops/rules", component: () => import("./pages/AiopsRulesPage.vue"), meta: { title: "AIOps 分析规则", subtitle: "自然语言降噪、提权与报告规则" } },
    { path: "/aiops/models", component: () => import("./pages/AiopsModelsPage.vue"), meta: { title: "AIOps 模型配置", subtitle: "模型供应商、能力与用途绑定" } },
    { path: "/aiops/audit", component: () => import("./pages/AiopsAuditPage.vue"), meta: { title: "AIOps 操作审计", subtitle: "管理操作、AI 对话与机器人调用日志" } },
    { path: "/aiops/settings", component: () => import("./pages/AiopsSettingsPage.vue"), meta: { title: "AIOps 运行设置", subtitle: "分析参数与 QQ 机器人运行状态" } },
    { path: "/aiops/admin", component: () => import("./pages/AiopsAdminPage.vue"), meta: { title: "AIOps 系统管理", subtitle: "模型、设置与审计统一管理", admin: true } },
    { path: "/ai-assistant", component: () => import("./pages/AiAssistantPage.vue"), meta: { title: "AI 运维助手", subtitle: "故障知识问答与处置经验检索" } },
    { path: "/settings", component: SystemSettingsPage, meta: { title: "系统配置", subtitle: "统一配置质差规则、阈值和系统参数" } },
    { path: "/users", component: UsersPage, meta: { title: "用户管理", subtitle: "统一账号、组织、角色和状态管理", admin: true } },
    { path: "/orgs", redirect: "/user-orgs" },
    { path: "/user-orgs", component: OrganizationsPage, meta: { title: "用户组织管理", subtitle: "公司、区域、班组与用户权限边界", admin: true } },
    { path: "/device-orgs", component: DeviceOrganizationsPage, meta: { title: "设备组织管理", subtitle: "设备区域、机房及用户组织映射", admin: true } },
    { path: "/permissions", component: PermissionsPage, meta: { title: "权限管理", subtitle: "角色、用户类型与功能访问边界", admin: true } },
    { path: "/system-audit", component: SystemAuditPage, meta: { title: "系统审计与使用分析", subtitle: "登录、功能调用与用户使用情况，仅超级管理员可见", admin: true } }
    ,{ path: "/infrastructure", component: () => import("./pages/InfrastructurePage.vue"), meta: { title: "基础设施监控", subtitle: "服务器资源、核心服务和数据组件健康状态，仅超级管理员可见", admin: true } }
  ]
});

router.afterEach(to => {
  if (to.path === "/dashboard") return;
  void recordUsageEvent("page_view", to.path, String(to.meta.title || "")).catch(() => undefined);
});

createApp(App).use(router).mount("#app");
