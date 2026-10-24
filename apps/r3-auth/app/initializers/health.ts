/**
 * The dependency health check `GET /health` answers. It probes every binding the server
 * reads and every third party a sign-in feature calls, read-only, so a monitor polling it
 * turns red when a dependency breaks rather than when the first visitor hits it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { HealthCheck } from "@sdxc/health";
import { env } from "cloudflare:workers";

import type { AppContext } from "~/app/initializers/router";

import { readPolarAccessToken } from "~/app/initializers/billing";

/** The prefix every signing key file is stored under in the bucket. */
const SIGNING_KEY_PREFIX = "signing:key";

/**
 * GitHub, Polar and the breach lookup each serve one feature with a fallback (the other
 * sign-in methods, the best-effort billing mirror, an advisory check), so their outages
 * warn; the database, KV and the signing keys fail the report, since no token issues without them.
 */
export const health = new HealthCheck<AppContext>({
	serviceId: "auth",
	description: "The OpenID Connect provider behind auth.sergiodxa.com",
	releaseId: env.CF_VERSION_METADATA.id,
});

health
	.probe("database", (ctx) => ctx.db.exec("SELECT 1"), { componentType: "datastore" })
	.probe("kv", () => env.KV.get("healthcheck"), { componentType: "datastore" })
	.probe(
		"signing-keys",
		/** A token can only be signed with a stored key, so an empty bucket fails like an unreachable one. */
		async () => {
			let listed = await env.R2.list({ prefix: SIGNING_KEY_PREFIX, limit: 1 });
			if (listed.objects.length === 0) throw new Error("No signing key is stored");
		},
		{ componentType: "datastore" },
	)
	.probe("polar-secret", () => readPolarAccessToken(), { critical: false })
	.probe("polar", (_, signal) => fetch("https://api.polar.sh/healthz", { signal }), {
		critical: false,
		componentType: "system",
		links: { about: "https://status.polar.sh" },
	})
	.probe(
		"github",
		(_, signal) =>
			fetch("https://api.github.com/rate_limit", {
				headers: { Accept: "application/vnd.github+json", "User-Agent": "auth.sergiodxa.com" },
				signal,
			}),
		{
			critical: false,
			componentType: "system",
			links: { about: "https://www.githubstatus.com" },
			affectedEndpoints: ["/auth/github", "/auth/github/callback"],
		},
	)
	.probe(
		"pwned-passwords",
		(_, signal) => fetch("https://api.pwnedpasswords.com/range/00000", { signal }),
		{ critical: false, componentType: "system" },
	);
