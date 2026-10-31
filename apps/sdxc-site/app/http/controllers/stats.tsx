/**
 * `GET /stats` — npm download history for every published package, for the maintainer to
 * watch usage grow. The page is linked from nowhere, kept out of search engines and the
 * sitemap, and renders from the snapshot the daily schedule stores.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { waitUntil } from "cloudflare:workers";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { StatsQuery } from "~/resources/components/package-table";

import { siteCache } from "~/app/initializers/cache";
import {
	collectionDaily,
	currentPackages,
	needsRefresh,
	readNpmStats,
	refreshNpmStats,
	summarizePackage,
} from "~/app/services/npm-stats";
import { listPackages } from "~/app/services/packages";
import SiteHeader from "~/resources/components/site-header";
import DocumentLayout from "~/resources/layouts/document";
import StatsPage from "~/resources/views/stats";
import routes from "~/routes/web";

/** The directive the page carries in its markup and its headers alike. */
const STATS_ROBOTS = "noindex, nofollow";

/**
 * How long a refresh a page starts may keep reading npm: inside the request when nothing is
 * stored yet, and inside the time the runtime grants work after the response otherwise.
 */
const REFRESH_BUDGET = { inline: 20_000, background: 25_000 };

/** The ranges a link on the page writes. */
const rangeSchema = s.enum_(["30", "90", "all"]);

/** The columns a link on the page sorts by. */
const sortSchema = s.enum_(["name", "week", "growth", "month", "total"]);

/**
 * Reads the reader's choices from the address.
 *
 * @param url The request URL.
 * @returns Each control's value, or its default where the address names none or an unknown
 * one, so a hand-typed value never breaks the page.
 */
function readQuery(url: URL): StatsQuery {
	let range = s.parseSafe(rangeSchema, url.searchParams.get("range"));
	let sort = s.parseSafe(sortSchema, url.searchParams.get("sort"));

	return {
		range: range.success ? range.value : "90",
		sort: sort.success ? sort.value : "week",
		package: url.searchParams.get("package"),
	};
}

export default createAction(routes.stats, async (ctx) => {
	let cache = siteCache();
	let snapshot = await readNpmStats(cache);

	/**
	 * Nothing stored is read from npm before answering, so the first visit shows what one
	 * budget could read; a snapshot with packages behind is answered from and continued in
	 * the background. The daily schedule does the rest.
	 */
	if (snapshot === null) {
		let outcome = await refreshNpmStats(cache, { budget: REFRESH_BUDGET.inline });
		ctx.log.set({ npmStats: "inline", read: outcome.read, remaining: outcome.remaining });
		snapshot = outcome.snapshot;
	} else if (needsRefresh(snapshot)) {
		ctx.log.set({ npmStats: "background" });
		waitUntil(refreshNpmStats(cache, { budget: REFRESH_BUDGET.background }).catch(() => undefined));
	}

	let query = readQuery(ctx.url);
	let summaries = snapshot.packages.map(summarizePackage);
	let focus = summaries.find((row) => row.stats.directory === query.package) ?? null;
	if (focus === null) query = { ...query, package: null };

	let response = ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={focus ? `${focus.stats.name} downloads — sdxc` : "npm downloads — sdxc"}
			robots={STATS_ROBOTS}
		>
			<SiteHeader />
			<StatsPage
				snapshot={snapshot}
				rows={summaries}
				collection={collectionDaily(snapshot)}
				focus={focus}
				query={query}
				current={currentPackages(snapshot)}
				published={listPackages().length}
			/>
		</DocumentLayout>,
	);

	response.headers.set("X-Robots-Tag", STATS_ROBOTS);
	response.headers.set("Cache-Control", "private, max-age=300");
	return response;
});
