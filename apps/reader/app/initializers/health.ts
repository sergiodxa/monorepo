/**
 * The reader's dependency health check: every stateful binding a page or a poll reads, the
 * identity provider every page needs, and the payment platform behind upgrades, probed
 * read-only so a monitor polling `/health` every minute changes nothing it reports on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { HealthCheck } from "@sdxc/health";
import { env } from "cloudflare:workers";

import type { AppContext } from "~/app/initializers/router";

import { feedStore } from "~/app/models/feed-store";
import { pingCatalog } from "~/app/models/registry";
import { userStore } from "~/app/models/user-store";

/**
 * The name every binding probe addresses, so probing creates at most one extra Durable
 * Object per class and reads one KV key nothing writes.
 */
const PROBE_NAME = "healthcheck";

/**
 * The check `GET /health` answers with. Only the identity provider is critical among the
 * third parties: every page needs a signed-in reader, while a Polar outage only stops
 * upgrades and portal visits, so it reports `warn` and the app stays `200`.
 */
export const health = new HealthCheck<AppContext>({
	serviceId: "reader",
	description: "A feed reader that keeps each reader's subscriptions in their own storage",
	releaseId: env.CF_VERSION_METADATA.id,
	timeout: 2_000,
})
	.probe("catalog", () => pingCatalog(), { componentType: "datastore" })
	.probe("kv", () => env.KV.get(PROBE_NAME), { componentType: "datastore" })
	.probe("user-store", () => userStore(PROBE_NAME).ping(), { componentType: "datastore" })
	.probe("feed-store", () => feedStore(PROBE_NAME).ping(), { componentType: "datastore" })
	.probe("unsubscribe-secret", () => env.UNSUBSCRIBE_SECRET.get(), { componentType: "component" })
	.probe("auth-provider", (_, signal) => fetch("https://auth.sergiodxa.com/health", { signal }), {
		componentType: "system",
		timeout: 5_000,
	})
	.probe("polar", (_, signal) => fetch("https://api.polar.sh/healthz", { signal }), {
		componentType: "system",
		critical: false,
		timeout: 5_000,
		links: { about: "https://status.polar.sh" },
		affectedEndpoints: ["/billing/checkout/{plan}", "/billing/portal"],
	});
