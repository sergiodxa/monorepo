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
import { font, text } from "@sdxc/u/typography";
import { Typeset } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { withBundleCache } from "~/app/http/caching";
import notFound from "~/app/http/controllers/docs-not-found";
import { adsDayTag } from "~/app/services/ads";
import { prepareArticle, tableOfContents } from "~/app/services/article";
import { MARKDOWN_OPTIONS, readGuide } from "~/app/services/docs";
import { buildGuidesNav } from "~/app/services/navigation";
import { absoluteUrl } from "~/config/constants";
import DocsAside, { hasDocsAside } from "~/resources/components/docs-aside";
import GuideOutcomes from "~/resources/components/guide-outcomes";
import { DOCS_COMPONENTS } from "~/resources/components/markdown-components";
import PageActions from "~/resources/components/page-actions";
import PageTitle from "~/resources/components/page-title";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** Where a guide's own file is read on GitHub, which is what its `Open` menu points at. */
const GUIDE_SOURCE_BASE =
	"https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/docs/";

export default createAction(routes.docs.show, async (ctx) => {
	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);
	let tree = await buildGuidesNav();

	let source = await readGuide(slug);
	if (source === null) return notFound(ctx, tree);

	let parsed = Markdown.parse(source, MARKDOWN_OPTIONS);
	if (isFailure(parsed)) {
		ctx.log.fail(parsed.error, { slug, line: parsed.error.position?.start.line ?? null });
		return notFound(ctx, tree);
	}

	let prepared = prepareArticle(parsed.data.document, MARKDOWN_OPTIONS);
	if (isFailure(prepared)) {
		ctx.log.fail(prepared.error, { slug, line: prepared.error.position?.start.line ?? null });
		return notFound(ctx, tree);
	}

	let { frontmatter } = parsed.data;
	let document = prepared.data;
	let anchors = tableOfContents(document);
	let markdownHref = routes.markdown.docs.href({ slug });
	let activePath = routes.docs.show.href({ slug });

	/** `docs / <section> / <title>`: only the root is somewhere a reader can go. */
	let breadcrumbs = [
		{ label: "Documentation", href: routes.docs.index.href() },
		{ label: frontmatter.section.title },
		{ label: frontmatter.title },
	];

	let response = ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={`${frontmatter.title} — sdxc`}
			description={frontmatter.description}
			canonical={ctx.url.href}
			og={{ type: "article" }}
		>
			<DocsLayout
				tree={tree}
				activePath={activePath}
				breadcrumbs={breadcrumbs}
				aside={
					hasDocsAside(anchors) ? <DocsAside anchors={anchors} path={activePath} /> : undefined
				}
			>
				<article>
					<header mix={[vstack({ gap: 3 })]}>
						<PageTitle eyebrow={frontmatter.section.title} title={frontmatter.title}>
							{frontmatter.description}
						</PageTitle>
						<p mix={[m(0), font("mono"), text("xs"), fg("neutral.muted")]}>
							Last updated {frontmatter.lastUpdated}
						</p>

						<PageActions
							markdownHref={markdownHref}
							markdownUrl={absoluteUrl(markdownHref)}
							sourceUrl={`${GUIDE_SOURCE_BASE}${slug}.md`}
						/>

						<GuideOutcomes outcomes={frontmatter.outcomes} />
					</header>

					<Typeset preset="docs" mix={[m("2.5rem", 0, 0, 0)]}>
						{toRemix(document, { components: DOCS_COMPONENTS })}
					</Typeset>
				</article>
			</DocsLayout>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, adsDayTag());
});
