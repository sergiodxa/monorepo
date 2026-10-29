/**
 * `GET /sitemap.xml` — every page a crawler should know about, listed by
 * `@sdxc/sitemap`. The list is derived from the guides, the manifests and the two
 * catalogues, so a package published, a guide written or a utility, component or mixin
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { xml } from "@sdxc/http/response";
import { fromRoutes } from "@sdxc/sitemap/remix";
import { createAction } from "remix/router";

import { withBundleCache } from "~/app/http/caching";
import { listCataloguePages } from "~/app/services/catalogue-pages";
import { listGuides } from "~/app/services/docs";
import { listPackageGroups } from "~/app/services/packages";
import { SITE_URL } from "~/config/constants";
import routes from "~/routes/web";

/** How a landing page ranks against a reference page, which is what `priority` orders. */
const PRIORITY = {
	home: 1,
	hub: 0.9,
	guide: 0.8,
	packageIndex: 0.9,
	package: 0.7,
	reference: 0.6,
} as const;

export default createAction(routes.sitemap, async (ctx) => {
	let [sections, catalogue] = await Promise.all([listGuides(), listCataloguePages()]);

	let reference = { priority: PRIORITY.reference, frequency: "weekly" as const };

	let sitemap = fromRoutes(routes, SITE_URL, {
		home: { priority: PRIORITY.home, frequency: "weekly" },
		philosophy: false,
		showcase: false,
		security: false,
		maintenance: false,
		sponsors: false,
		docs: {
			index: { priority: PRIORITY.hub, frequency: "weekly" },
			changelog: false,
			show: sections.flatMap((section) =>
				section.guides.map((guide) => {
					let updated = guide.frontmatter.lastUpdated;
					return {
						params: { slug: guide.slug },
						priority: PRIORITY.guide,
						frequency: "monthly" as const,
						...(updated ? { updatedAt: new Date(updated) } : {}),
					};
				}),
			),
		},
		api: {
			index: { priority: PRIORITY.packageIndex, frequency: "weekly" },
			utility: catalogue.flatMap((page) =>
				page.kind === "utility" ? [{ params: page.params, ...reference }] : [],
			),
			component: catalogue.flatMap((page) =>
				page.kind === "component" ? [{ params: page.params, ...reference }] : [],
			),
			uiExport: catalogue.flatMap((page) =>
				page.kind === "export" ? [{ params: page.params, ...reference }] : [],
			),
			show: listPackageGroups().flatMap((group) =>
				group.packages.map((entry) => ({
					params: { name: entry.directory },
					priority: PRIORITY.package,
					frequency: "weekly" as const,
				})),
			),
		},
		moved: false,
		markdown: false,
		frames: false,
		examples: false,
		llms: false,
		sitemap: false,
		feed: false,
		searchIndex: false,
		mcp: false,
		search: false,
		searchFrame: false,
		health: false,
		schemas: false,
		robots: false,
	});

	return await withBundleCache(ctx.request, xml(sitemap.toString()));
});
