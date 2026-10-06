/**
 * `GET /sitemap.xml` — every page a crawler should know about, listed by
 * `@sdxc/sitemap`. The list is derived from the guides and the manifests, so a package
 * published or a guide written is discoverable on the next deploy without an edit here.
 *
 * URLs are built on the site's own origin rather than on the host that served the
 * request, because a sitemap fetched from a preview deployment would otherwise invite a
 * crawler to index the preview.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { xml } from "@sdxc/http/response";
import { Sitemap } from "@sdxc/sitemap";
import { createAction } from "remix/router";

import { withBundleCache } from "~/app/http/caching";
import { listGuides } from "~/app/services/docs";
import { listPackageGroups } from "~/app/services/packages";
import { absoluteUrl } from "~/app/services/site";
import { listUiPages } from "~/app/services/ui-pages";
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
	let sitemap = new Sitemap();

	sitemap.append(new URL(absoluteUrl(routes.home.href())), {
		priority: PRIORITY.home,
		frequency: "weekly",
	});
	sitemap.append(new URL(absoluteUrl(routes.docs.index.href())), {
		priority: PRIORITY.hub,
		frequency: "weekly",
	});
	sitemap.append(new URL(absoluteUrl(routes.api.index.href())), {
		priority: PRIORITY.packageIndex,
		frequency: "weekly",
	});

	for (let section of await listGuides()) {
		for (let guide of section.guides) {
			let updated = guide.frontmatter.lastUpdated;

			sitemap.append(new URL(absoluteUrl(routes.docs.show.href({ slug: guide.slug }))), {
				priority: PRIORITY.guide,
				frequency: "monthly",
				...(updated ? { updatedAt: new Date(updated) } : {}),
			});
		}
	}

	for (let group of listPackageGroups()) {
		for (let entry of group.packages) {
			sitemap.append(new URL(absoluteUrl(routes.api.show.href({ name: entry.directory }))), {
				priority: PRIORITY.package,
				frequency: "weekly",
			});
		}
	}

	for (let page of await listUiPages()) {
		sitemap.append(new URL(absoluteUrl(page.href)), {
			priority: PRIORITY.reference,
			frequency: "weekly",
		});
	}

	return await withBundleCache(ctx.request, xml(sitemap.toString()));
});
