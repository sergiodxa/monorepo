/**
 * `/sitemap.xml` controller. Decides every route the site declares, listing the homepage,
 * every marketing page in `resources/content/marketing.ts`, the legal pages and every
 * documentation page, so search engines discover the full public site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { xml } from "@sdxc/http/response";
import { fromRoutes } from "@sdxc/sitemap/remix";
import { createAction } from "remix/router";

import { listDocs } from "~/app/services/docs";
import { audiences, comparisons, features, useCases } from "~/resources/content/marketing";
import routes from "~/routes/web";

/** The marketing pages one content record lists, each at its slug. */
function marketingPages(records: object, priority: number, updatedAt: Date) {
	return Object.keys(records).map((slug) => ({
		params: { slug },
		priority,
		frequency: "monthly" as const,
		updatedAt,
	}));
}

/** GET /sitemap.xml — the site's sitemap. */
export default createAction(routes.sitemap, async ({ request }) => {
	let updatedAt = new Date();
	let docSections = await listDocs();

	let sitemap = fromRoutes(routes, request.url, {
		home: { priority: 1, frequency: "weekly", updatedAt },
		health: false,
		statusPage: false,
		statusPageCalendar: false,
		statusPageCalendarJson: false,
		statusPageMaintenanceEvent: false,
		statusPageMaintenanceEventJson: false,
		trial: false,
		digestUnsubscribe: false,
		invite: false,
		sitemap: false,
		auth: false,
		logout: false,
		marketing: {
			feature: marketingPages(features, 0.8, updatedAt),
			audience: marketingPages(audiences, 0.7, updatedAt),
			useCase: marketingPages(useCases, 0.7, updatedAt),
			comparison: marketingPages(comparisons, 0.6, updatedAt),
		},
		browserFlows: { priority: 0.9, frequency: "monthly", updatedAt },
		trust: false,
		mcp: {
			index: { priority: 0.8, frequency: "monthly", updatedAt },
		},
		legal: {
			privacy: { priority: 0.3, frequency: "yearly", updatedAt },
			terms: { priority: 0.3, frequency: "yearly", updatedAt },
		},
		docs: {
			index: false,
			show: docSections.flatMap((section) =>
				section.docs.map((doc) => ({
					params: { slug: doc.path.replace(/^\/docs\//, "") },
					priority: 0.7,
					frequency: "weekly" as const,
					updatedAt,
				})),
			),
		},
		app: false,
		api: false,
	});

	return xml(sitemap.toString(), {
		headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
	});
});
