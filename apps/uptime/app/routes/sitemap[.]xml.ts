/**
 * Route that generates the site's sitemap.xml. It holds a static list of landing,
 * feature, use-case, audience, comparison, and legal pages with priorities and
 * change frequencies, appends dynamically listed documentation pages, and emits
 * the XML with caching headers so search engines can discover every URL.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { xml } from "@pkg/http/response";
import { Sitemap } from "@pkg/sitemap";

import { listDocs } from "~/modules/docs";

import type { Route } from "./+types/sitemap[.]xml";

// All landing pages with their paths and priorities
const LANDING_PAGES = [
	// Homepage
	{ path: "/", priority: 1.0, frequency: "weekly" },

	// Features
	{ path: "/features/monitors", priority: 0.8, frequency: "monthly" },
	{ path: "/features/alerts", priority: 0.8, frequency: "monthly" },
	{ path: "/features/status-pages", priority: 0.8, frequency: "monthly" },
	{ path: "/features/analytics", priority: 0.8, frequency: "monthly" },
	{ path: "/features/teams", priority: 0.8, frequency: "monthly" },
	{ path: "/features/api", priority: 0.8, frequency: "monthly" },
	{ path: "/features/integrations", priority: 0.8, frequency: "monthly" },
	{ path: "/features/maintenance", priority: 0.8, frequency: "monthly" },
	{ path: "/features/dns", priority: 0.8, frequency: "monthly" },
	{ path: "/features/ssl", priority: 0.8, frequency: "monthly" },
	{ path: "/features/cron-jobs", priority: 0.8, frequency: "monthly" },
	{ path: "/features/content-monitoring", priority: 0.8, frequency: "monthly" },

	// Use Cases
	{ path: "/use-cases/website-monitoring", priority: 0.7, frequency: "monthly" },
	{ path: "/use-cases/api-monitoring", priority: 0.7, frequency: "monthly" },
	{ path: "/use-cases/cron-jobs", priority: 0.7, frequency: "monthly" },
	{ path: "/use-cases/healthcheck", priority: 0.7, frequency: "monthly" },
	{ path: "/use-cases/ecommerce", priority: 0.7, frequency: "monthly" },
	{ path: "/use-cases/saas", priority: 0.7, frequency: "monthly" },
	{ path: "/use-cases/microservices", priority: 0.7, frequency: "monthly" },

	// For (audience)
	{ path: "/for/solo-devs", priority: 0.7, frequency: "monthly" },
	{ path: "/for/startups", priority: 0.7, frequency: "monthly" },
	{ path: "/for/agencies", priority: 0.7, frequency: "monthly" },
	{ path: "/for/enterprises", priority: 0.7, frequency: "monthly" },
	{ path: "/for/devops", priority: 0.7, frequency: "monthly" },
	{ path: "/for/indie-hackers", priority: 0.7, frequency: "monthly" },

	// Comparison pages
	{ path: "/vs/uptimerobot", priority: 0.6, frequency: "monthly" },
	{ path: "/vs/better-uptime", priority: 0.6, frequency: "monthly" },
	{ path: "/vs/pingdom", priority: 0.6, frequency: "monthly" },
	{ path: "/vs/statuscake", priority: 0.6, frequency: "monthly" },
	{ path: "/vs/datadog", priority: 0.6, frequency: "monthly" },
	{ path: "/vs/site24x7", priority: 0.6, frequency: "monthly" },
	{ path: "/vs/checkly", priority: 0.6, frequency: "monthly" },
	{ path: "/vs/ohdear", priority: 0.6, frequency: "monthly" },
	{ path: "/vs/cronitor", priority: 0.6, frequency: "monthly" },
	{ path: "/vs/healthchecks", priority: 0.6, frequency: "monthly" },

	// Legal
	{ path: "/terms", priority: 0.3, frequency: "yearly" },
	{ path: "/privacy", priority: 0.3, frequency: "yearly" },
] as const;

export async function loader({ request }: Route.LoaderArgs) {
	let updatedAt = new Date();

	// Get all documentation pages
	let docSections = await listDocs();
	let docPages = docSections.flatMap((section) =>
		section.docs.map((doc) => ({
			path: doc.path,
			priority: 0.7,
			frequency: "weekly" as const,
		})),
	);

	let allPages = [...LANDING_PAGES, ...docPages];

	let sitemap = new Sitemap();

	for (let page of allPages) {
		sitemap.append(new URL(page.path, request.url), {
			updatedAt,
			...page,
		});
	}

	return xml(sitemap.toString(), {
		headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
	});
}
