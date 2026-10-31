/**
 * `/docs/*slug` serves one documentation page. Its frontmatter supplies the title,
 * description and last-updated date drawn above the body, so a doc carries its own
 * chrome, and the description doubles as the page's meta and Open Graph description.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { highlight } from "@sdxc/highlight/markdown";
import { redirect } from "@sdxc/http/response";
import { Markdown } from "@sdxc/markdown";
import { headings, tableOfContents } from "@sdxc/markdown/plugin/headings";
import { toRemix } from "@sdxc/markdown/remix";
import { isFailure } from "@sdxc/result";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { font, text } from "@sdxc/u/typography";
import { Breadcrumbs, Typeset } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { DocsTocAnchor } from "~/resources/components/docs-toc";

import { getViewer } from "~/app/http/middleware/auth";
import { expandReference } from "~/app/http/openapi/reference";
import { SEO } from "~/app/initializers/seo";
import { apiProblems } from "~/app/services/api/problems";
import { findNeighbours, getDocLoader, listDocs, MARKDOWN_OPTIONS } from "~/app/services/docs";
import { docsMarkdownComponents } from "~/resources/components/docs-markdown";
import DocsLayout, { buildDocsLabels } from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import { buildMarketingChrome } from "~/resources/layouts/marketing";
import routes from "~/routes/web";

/**
 * Whether `slug` is the path of an API problem `type`, which the API sends as an absolute
 * URL under `/docs/api/errors/`, so a developer following one lands on the error reference.
 */
function isProblemType(slug: string): boolean {
	return apiProblems.entries().some((entry) => new URL(entry.type).pathname === `/docs/${slug}`);
}

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
	let chrome = buildMarketingChrome(ctx.intl.t);
	let labels = buildDocsLabels(ctx.intl.t);
	let section = sections.find((entry) => entry.docs.some((doc) => doc.path === activePath));

	/**
	 * The 404 page for an unknown slug or an unparseable doc, kept out of the search
	 * index since a canonical link here would tell crawlers this URL is real content.
	 */
	let renderNotFound = () => {
		return ctx.render(
			<DocumentLayout
				assets={ctx.assets}
				title={`${ctx.intl.t("docs.error.notFoundTitle")} | ${ctx.intl.t("docs.meta.title")}`}
				locale={ctx.locale}
			>
				<DocsLayout
					isSignedIn={isSignedIn}
					chrome={chrome}
					sections={sections}
					activePath={activePath}
					labels={labels}
				>
					<Typeset preset="docs">
						<h1>{ctx.intl.t("docs.error.notFoundTitle")}</h1>
						<p>{ctx.intl.t("docs.error.notFoundDescription")}</p>
						<p>
							<a href={routes.docs.index.href()}>{ctx.intl.t("docs.shell.backToIndex")}</a>
						</p>
					</Typeset>
				</DocsLayout>
			</DocumentLayout>,
			{ status: 404 },
		);
	};

	if (isProblemType(slug)) return redirect(routes.docs.show.href({ slug: "api/errors" }));

	let docLoader = getDocLoader(slug);
	if (!docLoader) return renderNotFound();

	let source = await docLoader.loader();

	/**
	 * An API reference page names the operations whose scope, errors and schemas the
	 * OpenAPI document renders into it. A placeholder naming no operation is logged and
	 * the page renders its prose alone, since the rest of the page still holds.
	 */
	let expanded = expandReference(source);
	if (isFailure(expanded)) {
		ctx.log.warn("docs.reference_failed", {
			file: docLoader.path,
			message: expanded.error.message,
		});
	}
	let content = isFailure(expanded) ? source : expanded.data;

	let parsed = Markdown.parse(content, MARKDOWN_OPTIONS);
	if (isFailure(parsed)) {
		ctx.log.warn("docs.parse_failed", {
			file: docLoader.path,
			line: parsed.error.position?.start.line ?? null,
			message: parsed.error.message,
		});
		return renderNotFound();
	}

	let { document, frontmatter } = parsed.data;

	/**
	 * Every heading gets an id first, so the "On this page" links have targets even when
	 * the painter below gives up; token colors are decoration, so a painter that fails
	 * costs the page its highlighting and keeps its prose, with the line it stood on logged.
	 */
	let anchored = Markdown.walk(document, headings());
	let outlined = isFailure(anchored) ? document : anchored.data;
	let painted = Markdown.walk(outlined, highlight);
	if (isFailure(painted)) {
		ctx.log.warn("docs.highlight_failed", {
			file: docLoader.path,
			line: painted.error.position?.start.line ?? null,
			message: painted.error.message,
		});
	}

	let body = isFailure(painted) ? outlined : painted.data;
	let anchors = flattenAnchors(tableOfContents(outlined));
	let { previous, next } = findNeighbours(sections, activePath);

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={`${frontmatter.title} | ${ctx.intl.t("docs.meta.title")}`}
			locale={ctx.locale}
			seo={{
				description: frontmatter.description || ctx.intl.t("docs.meta.description"),
				canonical: SEO.canonical(ctx.url),
				og: { type: "article" },
			}}
		>
			<DocsLayout
				isSignedIn={isSignedIn}
				chrome={chrome}
				sections={sections}
				activePath={activePath}
				labels={labels}
				anchors={anchors}
				previous={previous}
				next={next}
			>
				<article>
					<header mix={[vstack({ gap: 3 }), m(0, 0, "2.5rem", 0)]}>
						<Breadcrumbs aria-label={ctx.intl.t("app.layout.breadcrumbs.label")}>
							<Breadcrumbs.List>
								<Breadcrumbs.Item>
									<Breadcrumbs.Link href={routes.docs.index.href()}>
										{ctx.intl.t("docs.shell.root")}
									</Breadcrumbs.Link>
								</Breadcrumbs.Item>
								{section ? (
									<Breadcrumbs.Item>
										<Breadcrumbs.Link mix={[raw({ textDecoration: "none" })]}>
											{section.title}
										</Breadcrumbs.Link>
									</Breadcrumbs.Item>
								) : null}
								<Breadcrumbs.Item>
									<Breadcrumbs.Link aria-current="page">{frontmatter.title}</Breadcrumbs.Link>
								</Breadcrumbs.Item>
							</Breadcrumbs.List>
						</Breadcrumbs>

						<h1
							mix={[
								m(0),
								text("4xl"),
								font("sans"),
								fg("neutral.emphasis"),
								raw({
									textWrap: "balance",
									fontWeight: 650,
									letterSpacing: "-0.02em",
									lineHeight: 1.1,
								}),
							]}
						>
							{frontmatter.title}
						</h1>
						<p mix={[m(0), text("lg"), fg("neutral"), raw({ textWrap: "pretty" })]}>
							{frontmatter.description}
						</p>
						{frontmatter.lastUpdated && (
							<p mix={[m(0), font("mono"), text("xs"), fg("neutral.muted")]}>
								{ctx.intl.t("docs.lastUpdated", { date: frontmatter.lastUpdated })}
							</p>
						)}
					</header>

					<Typeset preset="docs">
						{toRemix(body, {
							components: docsMarkdownComponents({
								copy: ctx.intl.t("docs.code.copy"),
								copied: ctx.intl.t("docs.code.copied"),
								alerts: {
									note: ctx.intl.t("docs.alerts.note"),
									tip: ctx.intl.t("docs.alerts.tip"),
									important: ctx.intl.t("docs.alerts.important"),
									warning: ctx.intl.t("docs.alerts.warning"),
									caution: ctx.intl.t("docs.alerts.caution"),
								},
							}),
						})}
					</Typeset>
				</article>
			</DocsLayout>
		</DocumentLayout>,
	);
});

/** The table of contents in reading order, one entry per heading, as the rail lists it. */
function flattenAnchors(entries: ReturnType<typeof tableOfContents>): DocsTocAnchor[] {
	return entries.flatMap((entry) => [
		{ id: entry.id, text: entry.text, level: entry.level },
		...flattenAnchors(entry.children),
	]);
}
