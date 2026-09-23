/**
 * `GET /docs/*slug` — one guide. The frontmatter supplies the heading, the summary
 * and the page's own meta description, so a guide carries its own chrome and the
 * sentence a search result shows is the sentence its author wrote.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Markdown } from "@sdxc/markdown";
import { toRemix } from "@sdxc/markdown/remix";
import { isFailure } from "@sdxc/result";
import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { text, tracking, weight } from "@sdxc/u/typography";
import { Typeset } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { withBundleCache } from "~/app/http/caching";
import notFound from "~/app/http/controllers/docs-not-found";
import { sponsorsTag } from "~/app/http/middleware/sponsors";
import { prepareArticle, tableOfContents } from "~/app/services/article";
import { MARKDOWN_OPTIONS, readGuide } from "~/app/services/docs";
import { buildNavTree } from "~/app/services/navigation";
import { absoluteUrl } from "~/app/services/site";
import { DOCS_COMPONENTS } from "~/resources/components/markdown-components";
import PageActions from "~/resources/components/page-actions";
import { TableOfContents } from "~/resources/components/table-of-contents";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** Where a guide's own file is read on GitHub, which is what its `Open` menu points at. */
const GUIDE_SOURCE_BASE =
	"https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc/resources/docs/";

export default createAction(routes.docs.show, async (ctx) => {
	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);
	let tree = await buildNavTree();

	let source = await readGuide(slug);
	if (source === null) return notFound(ctx, tree);

	let parsed = Markdown.parse(source, MARKDOWN_OPTIONS);
	if (isFailure(parsed)) {
		ctx.log.fail(parsed.error, { slug, line: parsed.error.position?.start.line ?? null });
		return notFound(ctx, tree);
	}

	let prepared = prepareArticle(parsed.data.document);
	if (isFailure(prepared)) {
		ctx.log.fail(prepared.error, { slug, line: prepared.error.position?.start.line ?? null });
		return notFound(ctx, tree);
	}

	let { frontmatter } = parsed.data;
	let document = prepared.data;
	let markdownHref = routes.markdown.docs.href({ slug });

	/** `docs / <section> / <title>`: only the root is somewhere a reader can go. */
	let breadcrumbs = [
		{ label: "Documentation", href: routes.docs.index.href() },
		{ label: frontmatter.section.title },
		{ label: frontmatter.title },
	];

	let response = await ctx.render(
		<DocumentLayout
			title={`${frontmatter.title} — sdxc`}
			description={frontmatter.description}
			canonical={ctx.url.href}
			og={{ type: "article" }}
			sponsors={ctx.sponsors}
		>
			<DocsLayout
				tree={tree}
				activePath={routes.docs.show.href({ slug })}
				breadcrumbs={breadcrumbs}
				aside={<TableOfContents anchors={tableOfContents(document)} />}
			>
				<article>
					<header mix={[vstack({ gap: 3 })]}>
						<h1 mix={[m(0), text("4xl"), weight("bold"), tracking("tight")]}>
							{frontmatter.title}
						</h1>
						<p mix={[m(0), text("lg"), fg("neutral")]}>{frontmatter.description}</p>
						{frontmatter.lastUpdated ? (
							<p mix={[m(0), text("sm"), fg("neutral.muted")]}>
								Last updated {frontmatter.lastUpdated}
							</p>
						) : null}

						<PageActions
							markdownHref={markdownHref}
							markdownUrl={absoluteUrl(markdownHref)}
							sourceUrl={`${GUIDE_SOURCE_BASE}${slug}.md`}
						/>
					</header>

					<Typeset preset="docs" mix={[m("2.5rem", 0, 0, 0)]}>
						{toRemix(document, { components: DOCS_COMPONENTS })}
					</Typeset>
				</article>
			</DocsLayout>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, sponsorsTag(ctx.sponsors));
});
