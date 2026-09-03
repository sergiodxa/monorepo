# Blog SaaS — First Deployment

Everything required to deploy `apps/blog-saas` from scratch. Run all commands from
the repo root with `bunx wrangler` (never a global `wrangler`). Replace the
placeholder ids in `wrangler.jsonc` as you create each resource.

## 0. Prerequisites

- A Cloudflare account with **Workers Paid** (Durable Objects + SQLite) and, for
  custom domains, **Cloudflare for SaaS** enabled on the zone.
- The `sergiodxa.com` zone (or your own) added to Cloudflare.
- **auth-saas deployed first** with a `sso.blog.sergiodxa.com` tenant, because the
  dashboard and every blog admin log in against it. From that tenant you need:
  - a **dashboard OIDC client** (confidential; redirect URI
    `https://blog.sergiodxa.com/auth/callback`) → `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET`
  - a **management (M2M) client** with permission to create clients via the
    Management API → `SSO_MANAGEMENT_CLIENT_ID` / `SSO_MANAGEMENT_CLIENT_SECRET`
- A **Polar** account with a product + a `page_views` meter (see step 6).
- A Cloudflare API token with `Zone:DNS:Edit`, `SSL and Certificates:Edit`
  (custom hostnames), and `Account Analytics:Read` → `CF_API_TOKEN`; plus your
  `CF_ZONE_ID` and `CF_ACCOUNT_ID`.

## 1. Create the control-plane resources

```bash
bunx wrangler d1 create blog-saas-platform
bunx wrangler kv namespace create SLUG_CACHE
bunx wrangler queues create blog-saas-jobs
```

Copy the returned `database_id` and KV `id` into `wrangler.jsonc`
(`d1_databases[0].database_id`, `kv_namespaces[0].id`). The queue carries the
background jobs the cron triggers enqueue, and a deploy referencing a queue that
does not exist fails, so create it before step 5. The Analytics Engine dataset
(`blog-saas-analytics`) and the `BLOG` Durable Object are created on first deploy —
no manual step.

## 2. Apply control-plane migrations

```bash
bun run --cwd apps/blog-saas db:remote:migrate
```

## 3. Zone / DNS setup (not automatable via wrangler)

On the `sergiodxa.com` zone:

1. **Proxied wildcard record** `*.blog.sergiodxa.com` (CNAME to the worker, orange
   cloud) so tenant subdomains reach the worker.
2. **Proxied fallback origin** `fallback.blog.sergiodxa.com`, then set it as the
   zone's **Cloudflare for SaaS fallback origin** so custom-hostname traffic lands
   on this worker.
3. An explicit route `sso.blog.sergiodxa.com/*` pointing at the **auth-saas**
   worker (more-specific pattern wins over the wildcard).

The routes in `wrangler.jsonc` (`blog.sergiodxa.com` custom domain, the wildcard,
and the fallback) bind the worker; the DNS records above must exist for them to
resolve.

## 4. Set secrets

```bash
cd apps/blog-saas
for name in COOKIE_SESSION_SECRET OIDC_CLIENT_ID OIDC_CLIENT_SECRET \
  SSO_MANAGEMENT_CLIENT_ID SSO_MANAGEMENT_CLIENT_SECRET \
  CF_API_TOKEN CF_ZONE_ID CF_ACCOUNT_ID \
  POLAR_ACCESS_TOKEN POLAR_WEBHOOK_SECRET POLAR_PRODUCT_ID; do
  bunx wrangler secret put "$name"
done
```

`COOKIE_SESSION_SECRET` is any long random string (e.g. `openssl rand -hex 32`).
The `OIDC_*` / `SSO_MANAGEMENT_*` values come from the auth-saas sso tenant
(step 0). `PLATFORM_DOMAIN` and `OIDC_ISSUER` are plain vars already in
`wrangler.jsonc` — change them there if your domain differs.

## 5. Deploy

```bash
bun run --cwd apps/blog-saas cf:deploy
```

## 6. Polar billing

1. Create a **meter** named `page_views` (aggregation: sum over `metadata.views`).
2. Create a recurring monthly **product** with the base price and a metered
   overage price tied to the meter; note its id → `POLAR_PRODUCT_ID`.
3. Optionally attach a meter-credit benefit for the included allowance.
4. Add a **webhook** to `https://blog.sergiodxa.com/api/webhooks/polar` and set its
   signing secret → `POLAR_WEBHOOK_SECRET`.

> Note: deliveries are verified against `POLAR_WEBHOOK_SECRET` and fail closed while
> it is unset, so set the secret before pointing the webhook at production.

## 7. Post-deploy checks

- `curl https://blog.sergiodxa.com/health` → `{"status":"ok"}`.
- Visit `https://blog.sergiodxa.com`, sign in (redirects to the sso tenant), and
  create a blog. The dashboard should show it `active` with a `{slug}.blog.sergiodxa.com`
  link that serves the engine.
- Add a custom domain from the blog's page; follow the TXT + CNAME instructions;
  the `0 2 * * *` cron activates it once validation passes.

## Self-hosting a single blog (no platform)

`@sdxc/blog-engine` runs standalone on a plain Worker + D1 — no Durable Object or
control plane needed. See the engine's [README](../../packages/blog-engine/README.md).
