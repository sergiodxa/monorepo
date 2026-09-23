/**
 * `GET /rss.xml` — what has been written here, newest first, so a reader can follow the
 * documentation without visiting it.
 *
 * The guides are the dated content: each carries a `lastUpdated` its author wrote, which
 * is a real date for a real edit. Package references carry none — a package's dates are
 * its releases, which live on npm and on the repository's own releases — so they stay out
 * rather than arrive stamped with the day the feed happened to be generated.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { xml } from "@sdxc/http/response";
import { RSS } from "@sdxc/rss";
import { createAction } from "remix/router";

import { withBundleCache } from "~/app/http/caching";
import { listGuides } from "~/app/services/docs";
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from "~/app/services/site";
import routes from "~/routes/web";

/** One dated guide, flattened out of its section so the whole set can be ordered by date. */
interface Entry {
	title: string;
	description: string;
	href: string;
	section: string;
	publishedAt: Date;
}

export default createAction(routes.feed, async (ctx) => {
	let entries: Entry[] = [];

	for (let section of await listGuides()) {
		for (let guide of section.guides) {
			let { description, lastUpdated, title } = guide.frontmatter;
			if (!lastUpdated) continue;

			let publishedAt = new Date(lastUpdated);
			if (Number.isNaN(publishedAt.getTime())) continue;

			entries.push({
				title,
				description,
				section: section.title,
				href: absoluteUrl(routes.docs.show.href({ slug: guide.slug })),
				publishedAt,
			});
		}
	}

	entries.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

	let feed = new RSS({
		title: `${SITE_NAME} documentation`,
		description: SITE_DESCRIPTION,
		link: absoluteUrl(routes.home.href()),
		language: "en",
		lastBuildDate: entries[0]?.publishedAt.toUTCString(),
		atomLink: {
			href: absoluteUrl(routes.feed.href()),
			rel: "self",
			type: "application/rss+xml",
		},
	});

	for (let entry of entries) {
		feed.addItem({
			/* The URL is the identity, and it is permanent, so it doubles as the guid. */
			guid: { value: entry.href, isPermaLink: true },
			title: entry.title,
			description: entry.description,
			link: entry.href,
			category: [entry.section],
			pubDate: entry.publishedAt.toUTCString(),
		});
	}

	return await withBundleCache(ctx.request, xml(feed.toString()));
});
