# Auth SaaS — First Deployment

Everything required to deploy `apps/auth-saas` from scratch. Run all commands from
the repo root with `bunx wrangler`. Replace the placeholder ids in `wrangler.jsonc`
as you create each resource.

## 0. Prerequisites

- A Cloudflare account with **Workers Paid** (Durable Objects + SQLite).
- The zone(s) for your hostnames added to Cloudflare (e.g. `sergiodxa.com`).
- **Cloudflare Email Sending** enabled, with the sender address in `EMAIL_FROM`
  (a var in `wrangler.jsonc`) verified as a Destination Address / domain.
- **Cloudflare for SaaS** enabled on the zone if tenants will use custom domains.
- A **Polar** account with a product for tenant subscriptions → `POLAR_PRODUCT_ID`.
- A Cloudflare API token with `Zone:DNS:Edit` + `SSL and Certificates:Edit`
  (custom hostnames) → `CF_API_TOKEN`; plus `CF_ZONE_ID` and `CF_ACCOUNT_ID`.

## 1. Create the control-plane resources

```bash
bunx wrangler d1 create auth-saas-platform
bunx wrangler kv namespace create HOSTNAMES_KV
```

Copy the returned `database_id` and KV `id` into `wrangler.jsonc`
(`d1_databases[0].database_id`, `kv_namespaces[0].id`). The Analytics Engine dataset
(`auth-saas-analytics`), the `TENANT` Durable Object, the rate limiters, and the
`SEND_EMAIL` binding are provisioned on first deploy.

## 2. Apply control-plane migrations

```bash
bun run --cwd apps/auth-saas db:remote:migrate
```

## 3. Zone / DNS setup

The `routes` in `wrangler.jsonc` bind:

- `auth.sergiodxa.com` (custom domain) — the platform dashboard.
- `sso.sergiodxa.com/*` and `sso.blog.sergiodxa.com/*` — same-zone tenant hostnames.

Add the matching **proxied** DNS records for each hostname on its zone. Same-zone
hostnames are resolved to a tenant via the control-plane `hostnames` table
(Cloudflare for SaaS `custom_metadata` does not apply to own-zone hosts), cached in
`HOSTNAMES_KV`.

## 4. Set secrets

```bash
cd apps/auth-saas
for name in INTERNAL_SECRET SESSION_SECRET \
  CF_API_TOKEN CF_ZONE_ID CF_ACCOUNT_ID \
  POLAR_ACCESS_TOKEN POLAR_PRODUCT_ID POLAR_WEBHOOK_SECRET; do
  bunx wrangler secret put "$name"
done
```

`INTERNAL_SECRET` and `SESSION_SECRET` are long random strings
(`openssl rand -hex 32`). `INTERNAL_SECRET` must match what the control plane uses to
mint Management API tokens for tenant DOs. `PLATFORM_DOMAIN` and `EMAIL_FROM` are
plain vars in `wrangler.jsonc` — change them there if your domain differs.

## 5. Deploy

```bash
bun run --cwd apps/auth-saas cf:deploy
```

## 6. Bootstrap the platform + blog-sso tenant

The `blog-saas` platform depends on a tenant at `sso.blog.sergiodxa.com`. After the
first deploy, provision it (see ADR-010's runbook): create the tenant, a dashboard
OIDC client, and an M2M management client, then hand those credentials to
`apps/blog-saas` (its `OIDC_*` / `SSO_MANAGEMENT_*` secrets).

## 7. Post-deploy checks

- `curl https://auth.sergiodxa.com/health` → `{"status":"ok"}`.
- The tenant OIDC discovery document resolves, e.g.
  `curl https://sso.sergiodxa.com/.well-known/openid-configuration`.
- Sign in to the dashboard at `https://auth.sergiodxa.com` and create a tenant.

## Self-hosting the provider (no platform)

`@sdxc/oidc-provider` runs standalone on a plain Worker + D1. See the provider's
[README](../../packages/oidc-provider/README.md).
