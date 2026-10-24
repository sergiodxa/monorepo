/**
 * The worker's one health check, answered at `GET /health`. The worker keeps no storage, so it
 * probes the two services the funnel cannot work without: Polar for pricing and checkout, and
 * Buttondown for the sample chapter and the newsletter.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { HealthCheck } from "@sdxc/health";
import { env } from "cloudflare:workers";

import type { AppContext } from "~/app/initializers/router";

/** Both providers sit across the internet, so each gets longer than the check's default. */
const PROVIDER_TIMEOUT_MS = 5_000;

/**
 * Polar's liveness endpoint is unauthenticated; Buttondown has none, so its ping reads the
 * account with the worker's own key, which also proves that key still works. Either failing
 * answers `503`, since the site cannot sell or hand out the sample without it.
 */
export const health = new HealthCheck<AppContext>({
	serviceId: "books",
	description: "The book's sales and sample-chapter site",
	releaseId: env.CF_VERSION_METADATA.id,
})
	.probe("polar", (_, signal) => fetch("https://api.polar.sh/healthz", { signal }), {
		componentType: "system",
		timeout: PROVIDER_TIMEOUT_MS,
		links: { about: "https://status.polar.sh" },
		affectedEndpoints: ["/release", "/upgrade", "/api/checkout/{type}"],
	})
	.probe(
		"buttondown",
		(_, signal) =>
			fetch("https://api.buttondown.com/v1/ping", {
				headers: { Authorization: `Token ${env.BUTTONDOWN_API_KEY}` },
				signal,
			}),
		{
			componentType: "system",
			timeout: PROVIDER_TIMEOUT_MS,
			affectedEndpoints: ["/sample", "/api/subscribe"],
		},
	);
