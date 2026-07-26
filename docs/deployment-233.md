# 233 portal deployment boundary

The unified portal is served by Nginx on **TCP 5772**. This is the sole browser entry shown in the infrastructure topology; `80` and `443` are not the NetOps entry.

Target artifact path: `/srv/netops/netops-portal-web/dist`.

The portal calls the Platform API only through the 233 Nginx reverse proxy at `/api/netops2026/`. The obsolete `/wx/api/netops2026/` prefix is removed at cutover; browser code must never call the 7001 loopback service directly.

The server-side cutover and security checks are defined in `NJCATV/netops-ops/docs/233-netops-naming-cutover.md`.
