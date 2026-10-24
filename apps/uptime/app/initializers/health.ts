/**
 * The app's dependency health check, answering `GET /health`: every binding a page or a
 * monitor run reads, plus the services a user-facing feature calls. Probes only read, so a
 * monitor polling it every minute changes nothing and spends no budget.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { HealthCheck } from "@sdxc/health";
import { env } from "cloudflare:workers";

import { queryAnalytics } from "~/app/services/analytics";

/**
 * The storage and Durable Object probes are critical, since monitoring stops without them;
 * Analytics Engine reads, sign-in and billing only degrade the dashboard, so they warn.
 */
export const health = new HealthCheck<RequestContext>({
	serviceId: "ping",
	description: "Uptime monitoring, alerts and status pages",
	releaseId: env.CF_VERSION_METADATA.id,
})
	.probe("database", (ctx) => ctx.db.exec("SELECT 1"), { componentType: "datastore" })
	.probe("kv", () => env.KV.get("health"), { componentType: "datastore" })
	.probe("social-cards", () => env.SOCIAL_CARDS.head("health"), { componentType: "datastore" })
	.probe("flow-traces", () => env.FLOW_TRACES.head("health"), { componentType: "datastore" })
	.probe("geo-fetch", () => env.GEO_FETCH.getByName("health").ping(), {
		componentType: "component",
	})
	.probe("unsubscribe-secret", () => env.UNSUBSCRIBE_SECRET.get())
	.probe(
		"analytics-engine",
		(_, signal) =>
			queryAnalytics("SELECT count() as count FROM uptime_monitor_results LIMIT 1", signal),
		{ critical: false, componentType: "datastore" },
	)
	.probe("auth-provider", (_, signal) => fetch("https://auth.sergiodxa.com/health", { signal }), {
		critical: false,
		componentType: "system",
		timeout: 5_000,
	})
	.probe("polar", (_, signal) => fetch("https://api.polar.sh/healthz", { signal }), {
		critical: false,
		componentType: "system",
		timeout: 5_000,
		links: { about: "https://status.polar.sh" },
	});
