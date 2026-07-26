# 南京安播智维平台 Web

Vue 3 + Vite + TypeScript frontend for the operations platform.

模块架构、统一入口 `233:5772`、安全边界和发布方式见
[`docs/module-contract.md`](docs/module-contract.md)。跨模块调用关系见 `NJCATV/netops-ops`。

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Main Pages

| Route | Page |
| --- | --- |
| `/dashboard` | System overview dashboard |
| `/onu-search` | Single ONU query |
| `/quality` | ONU quality management |
| `/performance` | OLT performance monitoring |
| `/collector` | Collector status |
| `/devices` | OLT device management |
| `/probe` | New OLT probe |
| `/boss-users` | BOSS user import/search |
| `/settings` | Platform rule settings |
| `/infrastructure` | Super-admin infrastructure topology and service logs |
| `/radius` | Radius overview, records, risk and accounting views |
| `/system-audit` | Super-admin audit and feature-use analysis |

## Deployment

Build output is deployed on `JSCN-233`:

```text
/srv/netops/netops-portal-web/dist
```

The frontend calls the platform API through `/api/netops2026/*` and never connects to a database directly.
