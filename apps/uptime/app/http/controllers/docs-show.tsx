/**
 * `/docs/*slug` serves one documentation page, and `/docs/*slug.md` its Markdown twin. Its
 * frontmatter supplies the title, lead, notice, last-updated date and curated next pages,
 * so a doc carries its own chrome; the shell adds feedback, a route to support and the pager.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { TableOfContents } from "@sdxc/ui";

import { highlight } from "@sdxc/highlight/markdown";
import { redirect } from "@sdxc/http/response";
import { Markdown } from "@sdxc/markdown";
import { toPlainText } from "@sdxc/markdown/plain";
import { headings } from "@sdxc/markdown/plugin/headings";
import { toRemix } from "@sdxc/markdown/remix";
import { isFailure } from "@sdxc/result";
import { border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import {
	Alert,
	DocsFeedback,
	DocsPageHeader,
	NextSteps,
	PageActions,
	PlanNotice,
	Typeset,
} from "@sdxc/ui";
import { readCodeTabsCookie } from "@sdxc/ui/mixins";
import { DocsNotFound } from "@sdxc/ui/patterns";
import { findNeighbours } from "@sdxc/ui/utils";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import { expandReference, operationReferences } from "~/app/http/openapi/reference";
import { SEO } from "~/app/initializers/seo";
import { apiProblems } from "~/app/services/api/problems";
import { findDoc, getDocLoader, listDocs, MARKDOWN_OPTIONS, toDocsTree } from "~/app/services/docs";
import { endpointSections } from "~/app/services/docs-api";
import { apiReferenceComponents } from "~/resources/components/docs-api-reference";
import { docsMarkdownComponents } from "~/resources/components/docs-markdown";
import DocsSearchForm from "~/resources/components/docs-search-form";
import DocsLayout, { buildDocsLabels, supportHref } from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import { buildMarketingChrome } from "~/resources/layouts/marketing";
import routes from "~/routes/web";

/** The slug prefix of the API resource pages, which lay each endpoint out in two columns. */
const API_RESOURCES = "api/resources/";

/** The suffix that asks for a page's Markdown source instead of its HTML. */
const MARKDOWN_SUFFIX = ".md";

/** The pages a reader who missed is offered, in this order; a path no doc serves is skipped. */
const POPULAR_PATHS = [
	"/docs/quickstart",
	"/docs/guides/add-a-monitor",
	"/docs/guides/choose-who-gets-alerted",
	"/docs/troubleshooting/not-receiving-alerts",
];

/** Old doc paths and the page that now answers them, so a saved link keeps working. */
const MOVED: Readonly<Record<string, string>> = { overview: "/docs" };

/**
 * Whether `slug` is the path of an API problem `type`, which the API sends as an absolute
 * URL under `/docs/api/errors/`, so a developer following one lands on the error reference.
 */
function isProblemType(slug: string): boolean {
	return apiProblems.entries().some((entry) => new URL(entry.type).pathname === `/docs/${slug}`);
}

/**
 * GET /docs/*slug — an individual documentation page. Falls back to the shared docs
 * description when frontmatter omits one; a `?feedback=sent` query thanks the reader under
 * the page header, where the reloaded page opens, and in place of the feedback form.
 */
export default createAction(routes.docs.show, async (ctx) => {
	let { slug: requested } = s.parse(s.object({ slug: s.string() }), ctx.params);
	let twin = requested.endsWith(MARKDOWN_SUFFIX);
	let slug = twin ? requested.slice(0, -MARKDOWN_SUFFIX.length) : requested;
	let t = ctx.intl.t;
	let sections = await listDocs();
	let isSignedIn = getViewer() !== null;
	let activePath = routes.docs.show.href({ slug });
	let chrome = buildMarketingChrome(t);
	let labels = buildDocsLabels(t);
	let tree = toDocsTree(sections, labels.nav);

	/**
	 * The 404 page for an unknown slug or an unparseable doc: a search already filled in
	 * from the missing path and the pages most readers want, kept out of the search index.
	 */
	let renderNotFound = () => {
		let popular = POPULAR_PATHS.flatMap((path) => findDoc(sections, path) ?? []);
		return ctx.render(
			<DocumentLayout
				assets={ctx.assets}
				title={`${t("docs.error.notFoundTitle")} | ${t("docs.meta.title")}`}
				locale={ctx.locale}
			>
				<DocsLayout
					isSignedIn={isSignedIn}
					chrome={chrome}
					sections={sections}
					activePath={activePath}
					labels={labels}
				>
					<DocsNotFound
						path={activePath}
						search={
							<DocsSearchForm
								label={t("docs.search.label")}
								placeholder={t("docs.search.placeholder")}
								submit={t("docs.search.submit")}
								query={slug.split("/").at(-1)?.replace(/[-_]+/g, " ")}
							/>
						}
						links={popular.map((doc) => ({
							title: doc.frontmatter.title,
							href: doc.path,
							description: doc.frontmatter.description,
						}))}
						labels={{
							eyebrow: t("docs.notFound.eyebrow"),
							title: t("docs.error.notFoundTitle"),
							body: t("docs.error.notFoundDescription"),
							linksTitle: t("docs.notFound.links"),
						}}
					/>
				</DocsLayout>
			</DocumentLayout>,
			{ status: 404 },
		);
	};

	if (isProblemType(slug)) return redirect(routes.docs.show.href({ slug: "api/errors" }));
	let moved = MOVED[slug];
	if (moved) return redirect(moved, { status: redirect.Status.Permanent });

	let docLoader = getDocLoader(slug);
	if (!docLoader) return renderNotFound();

	let source = await docLoader.loader();

	/**
	 * An API reference page names the operations whose scope, errors and schemas the
	 * OpenAPI document renders into it. A placeholder naming no operation is logged and
	 * the page renders its prose alone, since the rest of the page still holds.
	 */
	let reference = slug.startsWith(API_RESOURCES);
	let expanded = expandReference(source, twin || !reference ? "markdown" : "tags");
	if (isFailure(expanded)) {
		ctx.log.warn("docs.reference_failed", {
			file: docLoader.path,
			message: expanded.error.message,
		});
	}
	let content = isFailure(expanded) ? source : expanded.data;

	if (twin) {
		return new Response(content, {
			headers: { "Content-Type": "text/markdown; charset=utf-8" },
		});
	}

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

	let paintedBody = isFailure(painted) ? outlined : painted.data;
	let body = reference ? endpointSections(paintedBody) : paintedBody;
	let anchors = outlineOf(outlined).filter((item) => !reference || item.level === 2);
	let section = frontmatter.section.title;
	let { previous, next } = findNeighbours(tree, activePath, { boundary: "section" });
	let upNext = (frontmatter.next ?? []).flatMap((path) => findDoc(sections, path) ?? []);
	let feedbackSent = ctx.url.searchParams.get("feedback") === "sent";

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={`${frontmatter.title} | ${t("docs.meta.title")}`}
			locale={ctx.locale}
			seo={{
				description: frontmatter.description || t("docs.meta.description"),
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
				section={section}
				wide={reference}
				footer={
					<DocsFeedback
						id="docs-feedback"
						mix={[raw({ scrollMarginBlockStart: "var(--ui-docs-scroll-margin)" })]}
						action={routes.docs.feedback.href()}
						page={activePath}
						state={feedbackSent ? "sent" : "idle"}
						labels={{
							question: t("docs.feedback.question"),
							yes: t("docs.feedback.yes"),
							no: t("docs.feedback.no"),
							note: t("docs.feedback.note"),
							send: t("docs.feedback.send"),
							thanks: t("docs.feedback.thanks"),
						}}
					/>
				}
				pageEnd={
					<>
						{upNext.length > 0 ? (
							<NextSteps
								title={t("docs.next.title")}
								id="up-next"
								items={upNext.map((doc) => ({
									title: doc.frontmatter.title,
									href: doc.path,
									description: doc.frontmatter.description,
								}))}
							/>
						) : null}

						<aside
							aria-labelledby="docs-questions"
							mix={[
								vstack({ gap: 2 }),
								p(5),
								rounded("lg"),
								border({ color: "neutral.border", width: 1, style: "solid" }),
							]}
						>
							<h2
								id="docs-questions"
								mix={[m(0), text("base"), weight("semibold"), fg("neutral.emphasis")]}
							>
								{t("docs.questions.title")}
							</h2>
							<p mix={[m(0), text("sm"), fg("neutral")]}>
								{t("docs.questions.body")}{" "}
								<a href={supportHref(activePath)} mix={[fg("brand"), weight("medium")]}>
									{t("docs.questions.link")}
								</a>
							</p>
						</aside>
					</>
				}
			>
				<article>
					<DocsPageHeader
						crumbsLabel={t("app.layout.breadcrumbs.label")}
						crumbs={[
							{ label: t("docs.shell.root"), href: routes.docs.index.href() },
							{ label: section },
							{ label: frontmatter.title },
						]}
						title={frontmatter.title}
						description={frontmatter.description}
						notice={frontmatter.notice ? <PlanNotice>{frontmatter.notice}</PlanNotice> : undefined}
						updated={
							frontmatter.lastUpdated
								? { label: t("docs.shell.updated"), date: frontmatter.lastUpdated }
								: undefined
						}
						actions={
							<PageActions
								markdownHref={`${activePath}${MARKDOWN_SUFFIX}`}
								labels={{
									copy: t("docs.actions.copy"),
									copied: t("docs.actions.copied"),
									failed: t("docs.actions.failed"),
									more: t("docs.actions.more"),
								}}
								links={pageLinks(t, `${ctx.url.origin}${activePath}`)}
							/>
						}
					/>

					{feedbackSent ? (
						<Alert color="success" live="polite" mix={[m(0, 0, "2rem", 0)]}>
							<Alert.Content>
								<Alert.Description>{t("docs.feedback.thanks")}</Alert.Description>
							</Alert.Content>
						</Alert>
					) : null}

					<Typeset preset="docs">
						{toRemix(body, {
							components: {
								...docsMarkdownComponents({
									copy: t("docs.code.copy"),
									copied: t("docs.code.copied"),
									alerts: {
										note: t("docs.alerts.note"),
										tip: t("docs.alerts.tip"),
										important: t("docs.alerts.important"),
										warning: t("docs.alerts.warning"),
										caution: t("docs.alerts.caution"),
									},
									t,
								}),
								...(reference
									? apiReferenceComponents({
											t,
											operations: operationReferences(),
											language: readCodeTabsCookie(
												ctx.request.headers.get("Cookie"),
												"api-language",
											),
										})
									: {}),
							},
						})}
					</Typeset>
				</article>
			</DocsLayout>
		</DocumentLayout>,
	);
});

/**
 * The page's outline in reading order: every `h2` and `h3` with an id, and each step of a
 * procedure, whose title is drawn as a heading at the step's own anchor.
 */
function outlineOf(document: Markdown.Document): TableOfContents.Item[] {
	let items: TableOfContents.Item[] = [];
	let visit = (nodes: readonly Markdown.Node[]) => {
		for (let node of nodes) {
			if (node.type === "heading") {
				let { id } = node.attributes;
				if (typeof id === "string" && (node.level === 2 || node.level === 3)) {
					items.push({ id, text: toPlainText(node), level: node.level });
				}
				continue;
			}
			if (node.type !== "tag") continue;
			if (node.name === "step") {
				let { id, title } = node.attributes;
				if (typeof id === "string" && typeof title === "string") {
					items.push({ id, text: title, level: 2 });
				}
				continue;
			}
			if (node.name === "steps") visit(node.children);
		}
	};
	visit(document.children);
	return items;
}

/**
 * The page's menu beside "Copy page": its Markdown source, and the page handed to an
 * assistant that can answer a question about it.
 */
function pageLinks(t: Translate, url: string): PageActions.Link[] {
	let prompt = encodeURIComponent(t("docs.actions.prompt", { url }));
	return [
		{
			label: t("docs.actions.markdown"),
			description: t("docs.actions.markdownDescription"),
			href: `${url}${MARKDOWN_SUFFIX}`,
		},
		{
			label: t("docs.actions.claude"),
			description: t("docs.actions.assistantDescription"),
			href: `https://claude.ai/new?q=${prompt}`,
			external: true,
		},
		{
			label: t("docs.actions.chatgpt"),
			description: t("docs.actions.assistantDescription"),
			href: `https://chatgpt.com/?q=${prompt}`,
			external: true,
		},
	];
}
