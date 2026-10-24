/**
 * The blog's health check: one read-only probe per stateful binding and per service a page
 * depends on, so `GET /health` fails when a binding, bucket or secret is gone. The queue,
 * the email sender and the rate limiters stay unprobed, since a probe would spend them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { HealthCheck } from "@sdxc/health";
import { env } from "cloudflare:workers";
import { sql } from "remix/data-table";

import type { AppContext } from "~/app/initializers/router";

/**
 * The health check `GET /health` answers with. Every binding is critical, since the pages
 * read each one; the identity provider only warns, because it signs in editors alone and
 * readers never need it.
 */
export const health = new HealthCheck<AppContext>({
	serviceId: "blog",
	description: "Sergio Xalambrí's blog, its feeds and its CMS",
	releaseId: env.CF_VERSION_METADATA.id,
	links: { about: "https://sergiodxa.com" },
});

health.probe("database", (ctx) => ctx.db.exec(sql`SELECT 1`), { componentType: "datastore" });

health.probe("cache", () => env.CACHE.get("health"), { componentType: "datastore" });
health.probe("auth", () => env.AUTH.get("health"), { componentType: "datastore" });
health.probe("redirects", () => env.REDIRECTS.get("health"), { componentType: "datastore" });

health.probe("backups", () => env.BACKUPS.head("health"), { componentType: "datastore" });
health.probe("social-cards", () => env.SOCIAL_CARDS.head("health"), {
	componentType: "datastore",
});

health.probe("client-id", () => env.CLIENT_ID.get());
health.probe("client-secret", () => env.CLIENT_SECRET.get());
health.probe("cookie-session-secret", () => env.COOKIE_SESSION_SECRET.get());
health.probe("wayback-access-key", () => env.WAYBACK_ACCESS_KEY.get());
health.probe("wayback-secret-key", () => env.WAYBACK_SECRET_KEY.get());
health.probe("activitypub-private-key", () => env.ACTIVITYPUB_PRIVATE_KEY.get());

health.probe(
	"auth-provider",
	(_, signal) => fetch("https://auth.sergiodxa.com/health", { signal }),
	{
		critical: false,
		componentType: "system",
		timeout: 5_000,
		affectedEndpoints: ["/login", "/auth/callback"],
	},
);
