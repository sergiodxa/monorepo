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
import * as s from "remix/data-schema";
import { createAction } from "remix/fetch-router";
import { css } from "remix/ui";

import { getViewer } from "~/app/http/middleware/auth";
import { getDocLoader, listDocs, markdown } from "~/app/services/docs";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import { neutral } from "~/resources/theme";
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

	/** Builds the `home > ... > <segment>` trail, one crumb per slug segment. */
	function buildBreadcrumbs(leafLabel: string) {
		let segments = slug.split("/");

		return [
			{ label: ctx.i18next.t("docs.breadcrumb.home"), href: routes.docs.index.href() },
			...segments.map((segment, index) => {
				let isLast = index === segments.length - 1;
				return {
					label: isLast ? leafLabel : segment.replace(/-/g, " "),
					href: isLast
						? undefined
						: routes.docs.show.href({ slug: segments.slice(0, index + 1).join("/") }),
				};
			}),
		];
	}

	let renderNotFound = () => {
		return ctx.render(
			<DocumentLayout
				title={`${ctx.i18next.t("docs.error.notFoundTitle")} | ${ctx.i18next.t("docs.meta.title")}`}
			>
				<DocsLayout
					sections={sections}
					activePath={activePath}
					breadcrumbs={buildBreadcrumbs(ctx.i18next.t("docs.error.notFoundTitle"))}
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
				breadcrumbs={buildBreadcrumbs(frontmatter.title)}
				isSignedIn={isSignedIn}
				dashboardLabel={dashboardLabel}
				startLabel={startLabel}
				sidebarTitle={sidebarTitle}
				sidebarDescription={sidebarDescription}
				searchPlaceholder={searchPlaceholder}
				toggleNavLabel={toggleNavLabel}
			>
				<article>
					<header>
						<h1>{frontmatter.title}</h1>
						<p
							mix={[
								css({
									fontSize: "1.0625rem",
									color: "oklch(0.52 0.01 145)",
									margin: "8px 0 32px",
									"@media (prefers-color-scheme: dark)": { color: neutral[400] },
								}),
							]}
						>
							{frontmatter.description}
						</p>
						{frontmatter.lastUpdated && (
							<p
								mix={[
									css({
										fontSize: "0.8125rem",
										color: neutral[500],
										"@media (prefers-color-scheme: dark)": {
											color: neutral[400],
										},
									}),
								]}
							>
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
