/**
 * `/docs/*slug` controller. Resolves the wildcard slug to a doc file, parses
 * its Markdoc content and frontmatter, and renders the frontmatter title,
 * description, and last-updated date above the content from
 * `@pkg/markdown/client`'s `renderToRemix`, composed directly into the
 * shared `DocsLayout` sidebar chrome. The frontmatter description doubles as
 * the page's `<head>` meta/Open Graph description.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToRemix } from "@pkg/markdown/client";
import { isFailure } from "@pkg/result";
import { fg } from "@pkg/u/color";
import { vstack } from "@pkg/u/layout";
import { m, mbe } from "@pkg/u/size";
import { fontSize } from "@pkg/u/typography";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import { SEO } from "~/app/lib/seo";
import { getDocLoader, listDocs, markdown } from "~/app/services/docs";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/**
 * GET /docs/*slug — an individual documentation page. Falls back to the
 * shared docs description when frontmatter omits one, and to bare
 * title/canonical/OG metadata since author/date coverage varies across docs.
 */
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
	let breadcrumbLabel = ctx.i18next.t("app.layout.breadcrumbs.label");

	/**
	 * Builds the `docs > ... > <segment>` trail, one crumb per URL segment.
	 * Only the `docs` root links anywhere — intermediate segments group and
	 * order doc files, so they render as plain text alongside the current one.
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

	/**
	 * The 404 page for an unknown slug or an unparseable doc, kept out of the
	 * search index since a canonical link here would tell crawlers this URL
	 * is real, indexable content.
	 */
	let renderNotFound = () => {
		return ctx.render(
			<DocumentLayout
				title={`${ctx.i18next.t("docs.error.notFoundTitle")} | ${ctx.i18next.t("docs.meta.title")}`}
				locale={ctx.locale}
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
					breadcrumbLabel={breadcrumbLabel}
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
		<DocumentLayout
			title={`${frontmatter.title} | ${ctx.i18next.t("docs.meta.title")}`}
			locale={ctx.locale}
			seo={{
				description: frontmatter.description || ctx.i18next.t("docs.meta.description"),
				canonical: SEO.canonical(ctx.url),
				og: { type: "article" },
			}}
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
				breadcrumbLabel={breadcrumbLabel}
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
