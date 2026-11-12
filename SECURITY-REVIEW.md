# Security review summary

Review scope: Stage 3 customer delivery flow and adjacent existing endpoints/configuration.

The previous reusable Storage signed-URL delivery was replaced with 256-bit random claim tokens. Only SHA-256 token hashes are persisted, prior active claims are revoked when issuing a replacement, and claims expire after seven days. The claim URL is still a bearer credential: anyone who receives or is forwarded the link can access the delivery resources until it expires or is revoked.

| # | Severity | File | Lines | Finding | Confidence | Status |
|---|----------|------|-------|---------|------------|--------|
| 1 | MEDIUM | [create-delivery-link/index.ts](supabase/functions/create-delivery-link/index.ts) | 63-86 | The customer claim URL is a reusable bearer credential for up to seven days and can be forwarded. | 8/10 | Residual risk; revocation and replacement are supported. |
| 2 | MEDIUM | [create-order/index.ts](supabase/functions/create-order/index.ts) | 18-70 | Public order creation has no rate limiting or CAPTCHA, allowing automated submissions to create admin workload. | 8/10 | Not changed; outside the delivery implementation scope. |
| 3 | LOW | [_shared/security.ts](supabase/functions/_shared/security.ts), [vite.config.ts](vite.config.ts) | 1-39; 4-10 | The deployment origin (`SITE_URL`) and frontend base path (`VITE_BASE_PATH`) are configured separately; drift can break CORS or claim-link routing. | 9/10 | Verify both settings match the deployed site. |

No Supabase migration was applied, and no function was deployed as part of this implementation.
