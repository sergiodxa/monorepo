/**
 * `GET /demo/docs/:site(/*page)` — a complete sample docs site built from `@sdxc/ui/docs`:
 * its hub at the root, its pages, a search page and a 404 that searches. Marked `noindex,
 * nofollow`, since each site documents an invented product rather than sdxc.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { readCodeTabsCookie, searchQueryFromPath } from "@sdxc/ui/docs";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { withStreamCache } from "~/app/http/caching";
import defaultHandler from "~/app/http/controllers/default-handler";
import { searchDemoDocs } from "~/app/services/demo-docs-search";
import { rememberedTabsVariant } from "~/app/services/remembered-tabs";
import DocumentLayout from "~/resources/layouts/document";
import { demoDocsHref, findDemoDocsSite } from "~/resources/views/demo-docs";
import {
	demoDocsThanksHref,
	FEEDBACK_SENT_PARAM,
	findFeedbackPage,
} from "~/resources/views/demo-docs/feedback";
import { DemoDocsHome, DemoDocsMissing, DemoDocsSearch } from "~/resources/views/demo-docs/pages";
import { DemoDocsArticle, DemoDocsShell, SEARCH_PAGE } from "~/resources/views/demo-docs/shell";
import routes from "~/routes/web";

/** The directive every demo carries, which keeps it out of results and its links unfollowed. */
const DEMO_ROBOTS = "noindex, nofollow";

/** The params a request carries; `page` is absent on the hub. */
const PARAMS = s.object({ site: s.string(), page: s.optional(s.string()) });

/**
 * Renders the hub, a page, the search page or the site's own 404. The vote action's address,
 * which an enhanced vote leaves in the location bar, returns a reload to the page voted on.
 * An unknown page inside a known site answers `404` in its shell, search pre-filled.
 */
export default createAction(routes.demoDocs.show, async (ctx) => {
	let { page: path, site: slug } = s.parse(PARAMS, ctx.params);
	let site = await findDemoDocsSite(slug);
	if (site === null) return defaultHandler(ctx);

	let href = demoDocsHref(slug);
	let cookie = ctx.request.headers.get("Cookie");
	let variant = `${ctx.url.search}|${rememberedTabsVariant(cookie)}`;
	let render = async (options: { title: string; body: RemixNode; status?: number }) => {
		let renderPage = async () =>
			ctx.render(
				<DocumentLayout
					assets={ctx.assets}
					title={`${options.title} — ${site.name} Docs`}
					description={site.description}
					robots={DEMO_ROBOTS}
					siteFooter={false}
				>
					{options.body}
				</DocumentLayout>,
				{ status: options.status ?? 200 },
			);
		if (options.status !== undefined && options.status !== 200) return await renderPage();
		return await withStreamCache(ctx.request, variant, renderPage);
	};

	if (path === undefined) {
		return render({
			title: "Documentation",
			body: (
				<DemoDocsShell site={site} slug={slug} activePath={href()}>
					<DemoDocsHome site={site} slug={slug} />
				</DemoDocsShell>
			),
		});
	}

	if (path === SEARCH_PAGE) {
		let query = ctx.url.searchParams.get("q") ?? "";
		return render({
			title: query.trim() === "" ? "Search" : `Search: ${query.trim()}`,
			body: (
				<DemoDocsShell site={site} slug={slug} activePath={href(SEARCH_PAGE)} query={query}>
					<DemoDocsSearch
						site={site}
						slug={slug}
						query={query}
						results={searchDemoDocs(site, slug, query)}
					/>
				</DemoDocsShell>
			),
		});
	}

	if (ctx.url.pathname === routes.demoDocs.feedback.href({ site: slug })) {
		let voted = await findFeedbackPage(slug, ctx.url.searchParams.get("page") ?? "");
		let location = voted === null ? href() : demoDocsThanksHref(slug, voted);
		return new Response(null, { status: 303, headers: { Location: location } });
	}

	let page = Object.hasOwn(site.pages, path) ? site.pages[path] : undefined;
	if (page === undefined) {
		return render({
			title: "Page not found",
			status: 404,
			body: (
				<DemoDocsShell site={site} slug={slug} activePath={ctx.url.pathname}>
					<DemoDocsMissing
						site={site}
						slug={slug}
						path={ctx.url.pathname}
						query={searchQueryFromPath(ctx.url.pathname)}
					/>
				</DemoDocsShell>
			),
		});
	}

	return render({
		title: page.title,
		body: (
			<DemoDocsShell
				site={site}
				slug={slug}
				activePath={href(path)}
				toc={page.toc}
				feedback={{ path, sent: ctx.url.searchParams.has(FEEDBACK_SENT_PARAM) }}
			>
				<DemoDocsArticle site={site} slug={slug} path={path} page={page}>
					{page.render({ tab: (syncKey) => readCodeTabsCookie(cookie, syncKey) })}
				</DemoDocsArticle>
			</DemoDocsShell>
		),
	});
});
