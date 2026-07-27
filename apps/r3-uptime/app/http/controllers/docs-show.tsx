/**
 * `/docs/*slug` controller. Resolves the wildcard slug to a doc file, parses its
 * Markdoc content and frontmatter, and renders the frontmatter title, description,
 * and last-updated date followed by the Markdoc content — rendered through
 * `@pkg/markdown-remix`'s `renderToRemix`, called directly rather than via the
 * package's `MarkdownView` component, since this composes the result into the
 * shared `DocsLayout` sidebar chrome rather than needing a standalone wrapper
 * element. The current slug also drives the layout's active nav link and its
 * `docs > overview`-style breadcrumb trail. An unknown slug or a parse failure
 * renders the same not-found content inside that same chrome.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToRemix } from "@pkg/markdown-remix";
import { isFailure } from "@pkg/result";
import { fg } from "@pkg/u/color";
import { vstack } from "@pkg/u/layout";
import { m, mbe } from "@pkg/u/size";
import { fontSize } from "@pkg/u/typography";
import * as s from "remix/data-schema";
import { createAction } from "remix/fetch-router";

import { getViewer } from "~/app/http/middleware/auth";
import { getDocLoader, listDocs, markdown } from "~/app/services/docs";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** GET /docs/*slug — an individual documentation page. */
export default createAction(routes.docs.show, async (ctx) => {
	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);
	let sections = await listDocs();
	let isSignedIn = getViewer() !== null;
	let activePath = routes.docs.show.href({ slug });

	let dashboardLabel = ctx.i18next.t("docs.header.cta.in");
	let startLabel = ctx.i18next.t("docs.header.cta.out");
	let sidebarTitle = ctx.i18next.t("docs.sidebar.title");
	let sidebarDescription = ctx.i18next.t("docs.sidebar.description");
	let searchPlaceholder = ctx.i18next.t("docs.sidebar.searchPlaceholder");
	let toggleNavLabel = ctx.i18next.t("docs.sidebar.openMenu");

	/**
	 * Builds the `docs > ... > <segment>` trail, one crumb per URL path segment. Only
	 * the `docs` root segment links anywhere — every doc slug under it (`concepts`,
	 * `api`, `api/resources`, `team`, ...) is a directory used to group and order doc
	 * files, not a real page on its own, so intermediate segments render as plain,
	 * non-clickable text alongside the current (last) segment.
	 */
	function buildBreadcrumbs() {
		let pathSegments = activePath.split("/").filter(Boolean);

		return pathSegments.map((segment, index) => {
			let isRoot = index === 0;
			return {
				label: segment.replace(/-/g, " "),
				href: isRoot ? routes.docs.index.href() : undefined,
			};
		});
	}

	let renderNotFound = () => {
		return ctx.render(
			<DocumentLayout
				title={`${ctx.i18next.t("docs.error.notFoundTitle")} | ${ctx.i18next.t("docs.meta.title")}`}
			>
				<DocsLayout
					sections={sections}
					activePath={activePath}
					breadcrumbs={buildBreadcrumbs()}
					isSignedIn={isSignedIn}
					dashboardLabel={dashboardLabel}
					startLabel={startLabel}
					sidebarTitle={sidebarTitle}
					sidebarDescription={sidebarDescription}
					searchPlaceholder={searchPlaceholder}
					toggleNavLabel={toggleNavLabel}
				>
					<h1>{ctx.i18next.t("docs.error.notFoundTitle")}</h1>
					<p>{ctx.i18next.t("docs.error.notFoundDescription")}</p>
				</DocsLayout>
			</DocumentLayout>,
			{ status: 404 },
		);
	};

	let docLoader = getDocLoader(slug);
	if (!docLoader) return renderNotFound();

	let content = await docLoader.loader();
	let result = markdown.parse(content);
	if (isFailure(result)) return renderNotFound();

	let { content: parsedContent, frontmatter } = result.data;

	return ctx.render(
		<DocumentLayout title={`${frontmatter.title} | ${ctx.i18next.t("docs.meta.title")}`}>
			<DocsLayout
				sections={sections}
				activePath={activePath}
				breadcrumbs={buildBreadcrumbs()}
				isSignedIn={isSignedIn}
				dashboardLabel={dashboardLabel}
				startLabel={startLabel}
				sidebarTitle={sidebarTitle}
				sidebarDescription={sidebarDescription}
				searchPlaceholder={searchPlaceholder}
				toggleNavLabel={toggleNavLabel}
			>
				<article>
					<header mix={[vstack({ gap: "2px" }), mbe("2rem")]}>
						<h1 mix={[m("0")]}>{frontmatter.title}</h1>
						<p mix={[fontSize("1.0625rem"), fg("neutral"), m("6px", "0", "0", "0")]}>
							{frontmatter.description}
						</p>
						{frontmatter.lastUpdated && (
							<p mix={[fontSize("0.8125rem"), fg("neutral.muted"), m("0")]}>
								{ctx.i18next.t("docs.lastUpdated", { date: frontmatter.lastUpdated })}
							</p>
						)}
					</header>

					{renderToRemix(parsedContent)}
				</article>
			</DocsLayout>
		</DocumentLayout>,
	);
});
