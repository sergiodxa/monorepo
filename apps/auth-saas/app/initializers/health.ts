/**
 * The platform's dependency health check behind `GET /health`: the control-plane database,
 * every KV namespace, the transfers bucket and the tenant Durable Object are critical; Polar,
 * which only billing needs, degrades the report to `warn`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { HealthCheck } from "@sdxc/health";
import { env } from "cloudflare:workers";

/**
 * The name every probe reads or addresses. A tenant Durable Object is addressed by a tenant
 * id or the platform domain, so the instance under this name never holds a tenant.
 */
const PROBE_KEY = "healthcheck";

/** Every KV namespace the Worker reads, each probed by one read of {@link PROBE_KEY}. */
const KV_BINDINGS = [
	"HOSTNAMES_KV",
	"FLAGS",
	"MAIL_RATE_LIMIT_KV",
	"TURNSTILE_CHALLENGE_KV",
	"DEVICE_APPROVAL_SESSION_RATE_LIMIT_KV",
	"DEVICE_APPROVAL_ADDRESS_RATE_LIMIT_KV",
	"MAGIC_LINK_RATE_LIMIT_KV",
] as const;

/**
 * The health check every `GET /health` request runs, answered on the platform host. Every
 * probe only reads; a missing KV key or R2 object passes, because reaching the store is what
 * is checked.
 */
export const health = new HealthCheck<RequestContext>({
	serviceId: "auth-saas",
	releaseId: env.CF_VERSION_METADATA.id,
})
	.probe("platform-db", (ctx) => ctx.db.exec("SELECT 1"), { componentType: "datastore" })
	.probe("r2", () => env.R2.head(PROBE_KEY), { componentType: "datastore" })
	.probe("tenant", () => env.TENANT.getByName(PROBE_KEY).ping(), {
		componentType: "component",
	})
	.probe("polar", (_, signal) => fetch("https://api.polar.sh/healthz", { signal }), {
		critical: false,
		timeout: 5_000,
		componentType: "system",
		links: { about: "https://status.polar.sh" },
		affectedEndpoints: [
			"/billing/tenants/{tenantId}/checkout",
			"/billing/tenants/{tenantId}/portal",
		],
	});

for (let binding of KV_BINDINGS) {
	health.probe(binding.toLowerCase(), () => env[binding].get(PROBE_KEY), {
		componentType: "datastore",
	});
}
