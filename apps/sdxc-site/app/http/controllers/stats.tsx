/**
 * `GET /stats(.:format)` — usage stats for every published package: npm downloads, adoption,
 * GitHub and site events as a page, every snapshot as `.json`, or a `.md` report for an agent.
 * Linked from nowhere, kept out of search engines and the sitemap, and rendered from storage.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json, markdown } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { StatsQuery } from "~/resources/components/package-table";

import defaultHandler from "~/app/http/controllers/default-handler";
import { siteCache } from "~/app/initializers/cache";
import { collectionDaily, currentPackages, summarizePackage } from "~/app/services/npm-stats";
import { listPackages } from "~/app/services/packages";
import { loadStats, STATS_ROBOTS, statsJSON, statsMarkdown } from "~/app/services/stats-report";
import SiteHeader from "~/resources/components/site-header";
import AdoptionSection from "~/resources/components/stats/adoption-section";
import GitHubSection from "~/resources/components/stats/github-section";
import SiteEventsSection from "~/resources/components/stats/site-events-section";
import DocumentLayout from "~/resources/layouts/document";
import StatsPage from "~/resources/views/stats";
import routes from "~/routes/web";

/**
 * The formats the address can name. No extension is the page; an unknown one is a 404, so
 * `/stats.xml` never answers with the page under a misleading name.
 */
const paramsSchema = s.object({ format: s.optional(s.enum_(["json", "md"])) });

/** The headers every format carries: out of search engines, and only in the reader's cache. */
const STATS_HEADERS = { "X-Robots-Tag": STATS_ROBOTS, "Cache-Control": "private, max-age=300" };

/** The ranges a link on the page writes. */
const rangeSchema = s.enum_(["30", "90", "all"]);

/** The columns a link on the page sorts by. */
const sortSchema = s.enum_(["name", "week", "growth", "month", "total", "jsdelivr"]);

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
	let params = s.parseSafe(paramsSchema, ctx.params);
	if (!params.success) return defaultHandler(ctx);

	let data = await loadStats(siteCache());
	let published = listPackages().length;
	if (params.value.format === "json") {
		return json(statsJSON(data, published), { headers: STATS_HEADERS });
	}
	if (params.value.format === "md") {
		return markdown(statsMarkdown(data, published), { headers: STATS_HEADERS });
	}

	let { adoption, events, github, npm: snapshot } = data;

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
				published={published}
				sections={
					<>
						<AdoptionSection snapshot={adoption} />
						<GitHubSection snapshot={github} />
						<SiteEventsSection events={events} />
					</>
				}
			/>
		</DocumentLayout>,
	);

	for (let [name, value] of Object.entries(STATS_HEADERS)) response.headers.set(name, value);
	return response;
});
