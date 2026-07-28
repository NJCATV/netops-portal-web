<template>
  <nav class="aiops-tabs radius-tabs" aria-label="Radius 功能导航">
    <RouterLink to="/radius">一键查询</RouterLink>
    <RouterLink to="/radius/overview">运行总览</RouterLink>
    <RouterLink to="/radius/records">认证明细</RouterLink>
    <RouterLink to="/radius/reject">拒绝风险</RouterLink>
    <RouterLink to="/radius/multi-mac">多终端账号</RouterLink>
    <RouterLink to="/radius/analytics/auth">认证与 NAS</RouterLink>
    <RouterLink to="/radius/analytics/session">会话与重连</RouterLink>
    <RouterLink to="/radius/accounting">Accounting 与流量异常</RouterLink>
  </nav>
</template>
