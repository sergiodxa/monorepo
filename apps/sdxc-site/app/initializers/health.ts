/**
 * The site's dependency health check, which `GET /health` answers with. It probes the two
 * stores the site reads, read-only, and GitHub, whose data the changelog and sponsors pages
 * serve from cache, so a GitHub outage warns while a broken binding fails.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { HealthCheck } from "@sdxc/health";
import { env } from "cloudflare:workers";

import type { AppContext } from "~/app/initializers/router";

import { siteCache } from "~/app/initializers/cache";
import { socialCards } from "~/app/models/social-cards";

/** GitHub refuses a call carrying no agent, so the probe names the site making it. */
const USER_AGENT = "sdxc.dev";

/**
 * The check every `/health` request runs. `releaseId` is the deployed Worker version, so a
 * report says which deploy answered it.
 */
export const health = new HealthCheck<AppContext>({
	serviceId: "sdxc",
	description: "The documentation site for the @sdxc packages",
	releaseId: env.CF_VERSION_METADATA.id,
	links: { about: "https://sdxc.dev" },
});

/** A read of a key nobody writes: reaching the namespace is what is checked. */
health.probe("cache", () => siteCache().read("health"), { componentType: "datastore" });

/** A `HEAD` of a key nobody writes, so the probe transfers no body and a miss still passes. */
health.probe("social-cards", () => socialCards().has("health"), { componentType: "datastore" });

/**
 * GitHub's rate-limit read spends none of the limit it reports, and with the site's token it
 * also proves the credential still works. Pages serve their cached copy while it fails.
 */
health.probe(
	"github",
	(_, signal) => {
		let headers = new Headers({ accept: "application/vnd.github+json", "user-agent": USER_AGENT });
		if (env.GITHUB_TOKEN) headers.set("authorization", `Bearer ${env.GITHUB_TOKEN}`);
		return fetch("https://api.github.com/rate_limit", { headers, signal });
	},
	{
		critical: false,
		componentType: "system",
		links: { about: "https://www.githubstatus.com" },
		affectedEndpoints: ["/docs/releases/changelog", "/sponsors"],
	},
);
