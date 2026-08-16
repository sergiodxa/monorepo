/**
 * `/sitemap.xml` controller. Lists the homepage, every `/features`, `/for`,
 * `/use-cases`, and `/vs` marketing page (derived from `resources/content/marketing.ts`'s
 * content records, not a hardcoded URL list, so a new content entry is picked up
 * automatically), the legal pages, and every documentation page, then serializes them
 * with `@pkg/sitemap`. It exists so search engines can discover the full public site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { xml } from "@pkg/http/response";
import { Sitemap } from "@pkg/sitemap";
import { createAction } from "remix/router";

import { listDocs } from "~/app/services/docs";
import { audiences, comparisons, features, useCases } from "~/resources/content/marketing";
import routes from "~/routes/web";

interface StaticPage {
	path: string;
	priority: number;
	frequency: Sitemap.Frequency;
}

const STATIC_PAGES: StaticPage[] = [
	{ path: routes.home.href(), priority: 1, frequency: "weekly" },
	...Object.keys(features).map((slug) => ({
		path: routes.marketing.feature.href({ slug }),
		priority: 0.8,
		frequency: "monthly" as const,
	})),
	...Object.keys(useCases).map((slug) => ({
		path: routes.marketing.useCase.href({ slug }),
		priority: 0.7,
		frequency: "monthly" as const,
	})),
	...Object.keys(audiences).map((slug) => ({
		path: routes.marketing.audience.href({ slug }),
		priority: 0.7,
		frequency: "monthly" as const,
	})),
	...Object.keys(comparisons).map((slug) => ({
		path: routes.marketing.comparison.href({ slug }),
		priority: 0.6,
		frequency: "monthly" as const,
	})),
	{ path: routes.legal.terms.href(), priority: 0.3, frequency: "yearly" },
	{ path: routes.legal.privacy.href(), priority: 0.3, frequency: "yearly" },
];

/** GET /sitemap.xml — the site's sitemap. */
export default createAction(routes.sitemap, async ({ request }) => {
	let updatedAt = new Date();

	let docSections = await listDocs();
	let docPages: StaticPage[] = docSections.flatMap((section) =>
		section.docs.map((doc) => ({ path: doc.path, priority: 0.7, frequency: "weekly" as const })),
	);

	let sitemap = new Sitemap();

	for (let page of [...STATIC_PAGES, ...docPages]) {
		sitemap.append(new URL(page.path, request.url), {
			updatedAt,
			priority: page.priority,
			frequency: page.frequency,
		});
	}

	return xml(sitemap.toString(), {
		headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
	});
});
