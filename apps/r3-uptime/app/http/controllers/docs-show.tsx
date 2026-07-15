/**
 * `/docs/*slug` controller. Resolves the wildcard slug to a doc file, parses its
 * Markdoc content and frontmatter, and renders the frontmatter title, description,
 * and last-updated date followed by the Markdoc content — rendered through
 * `@pkg/markdown-remix`'s `renderToRemix`, called directly rather than via the
 * package's `MarkdownView` component, since this composes the result into the
 * shared `DocsLayout` sidebar chrome rather than needing a standalone wrapper
 * element. An unknown slug or a parse failure renders the same 404 the router's
 * `defaultHandler` uses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToRemix } from "@pkg/markdown-remix";
import { isFailure } from "@pkg/result";
import * as s from "remix/data-schema";
import { createAction } from "remix/fetch-router";
import { css } from "remix/ui";

import { getDocLoader, listDocs, markdown } from "~/app/services/docs";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import { neutral } from "~/resources/theme";
import NotFoundView from "~/resources/views/not-found";
import routes from "~/routes/web";

/** GET /docs/*slug — an individual documentation page. */
export default createAction(routes.docs.show, async (ctx) => {
	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);
	let sections = await listDocs();

	let renderNotFound = () => {
		let props = {
			title: "Doc Not Found",
			description: "The page you're looking for doesn't exist or may have moved.",
		};
		return ctx.render(
			<DocumentLayout title={props.title}>
				<NotFoundView {...props} />
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
		<DocumentLayout title={`${frontmatter.title} | Documentation | Uptime`}>
			<DocsLayout sections={sections}>
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
