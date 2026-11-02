/**
 * The frame every docs demo page renders in: the demo's own theme, a product header with
 * search, the kit's docs layout with the site's tree, rail and footer, and the article
 * skeleton a page fills — breadcrumb, title, actions, body, next steps and pager.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { ArrowUpRightIcon, FileTextIcon, SearchIcon, SparklesIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { m } from "@sdxc/u/size";
import { focusVisible, hover, when } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";
import { SearchField, Typeset } from "@sdxc/ui";
import {
	DocsFooter,
	DocsLayout,
	DocsNav,
	DocsPageHeader,
	DocsPager,
	findNeighbours,
	flattenDocsTree,
	NextSteps,
	PageActions,
} from "@sdxc/ui/docs";

import type { DemoDocsPage, DemoDocsSite } from "~/resources/views/demo-docs";

import DemoTheme from "~/resources/components/demo-theme";
import { demoDocsHref } from "~/resources/views/demo-docs";
import { DemoDocsFeedbackFrame } from "~/resources/views/demo-docs/feedback";
import routes from "~/routes/web";

/** The header bar: 3.5rem and its 1px rule, which the sticky docs chrome sits below. */
const HEADER_HEIGHT = "calc(3.5rem + 1px)";

/** The page segment the site's search answers at. */
export const SEARCH_PAGE = "search";

/** Where the demo credits the kit it is built with. */
const KIT_HREF = routes.api.component.href({ component: "docs-layout" });

namespace DemoDocsShell {
	export interface Props {
		site: DemoDocsSite;
		slug: string;
		/** The path being read, which marks one link in the tree as current. */
		activePath: string;
		/** The search box's value, on the search page. */
		query?: string;
		/** The page's headings; the hub, search and 404 pass none and draw no rail. */
		toc?: DemoDocsPage["toc"];
		/**
		 * Closes the page with "Was this page helpful?" about the page at `path` under the
		 * site; `sent` swaps it for the thanks.
		 */
		feedback?: { path: string; sent: boolean };
		children: RemixNode;
	}
}

/** Renders the themed header, the site's tree and the page between them. */
export function DemoDocsShell(handle: Handle<DemoDocsShell.Props>) {
	return () => {
		let { activePath, children, feedback, query, site, slug, toc = [] } = handle.props;
		let href = demoDocsHref(slug);

		return (
			<DemoTheme brand={site.theme.brand} neutral={site.theme.neutral} tokens={site.theme.tokens}>
				<div mix={[headingFace()]}>
					<DocsLayout
						dock="md"
						stickyTop={HEADER_HEIGHT}
						header={<DemoDocsHeader site={site} slug={slug} query={query} />}
						sidebar={
							<DocsNav
								tree={site.tree}
								activePath={activePath}
								filter={{
									label: "Filter pages",
									placeholder: "Filter pages",
									noResults: "No page title matches. Try search instead.",
								}}
								footer={
									<a href={href(SEARCH_PAGE)} mix={[navFooterLink()]}>
										<SearchIcon size={16} aria-hidden="true" />
										Search the docs
									</a>
								}
							/>
						}
						toc={toc}
						tocLabel="On this page"
						menuLabel="Menu"
						drawerLabel={site.tree.label}
						closeLabel="Close menu"
						footer={
							<DocsFooter
								legal={`© 2026 ${site.name}. A demo built with @sdxc/ui/docs.`}
								links={[
									{ label: "Docs home", href: href() },
									...(site.footerLinks ?? []),
									{ label: "Built with @sdxc/ui", href: KIT_HREF },
								]}
								linksLabel={`${site.name} links`}
							>
								{feedback ? (
									<DemoDocsFeedbackFrame slug={slug} path={feedback.path} sent={feedback.sent} />
								) : null}
							</DocsFooter>
						}
					>
						{children}
					</DocsLayout>
				</div>
			</DemoTheme>
		);
	};
}

/**
 * Sets the docs' headings in the face and weight a demo's tokens name, so a site can pair
 * serif headings with a sans body; a demo naming neither keeps the body's face. A heading
 * that sets its own face, such as a mono function name, keeps it.
 */
function headingFace() {
	return [
		raw({ inlineSize: "100%" }),
		when(
			"& :where(h1, h2, h3)",
			raw({
				fontFamily: "var(--demo-docs-heading-font, inherit)",
				fontWeight: "var(--demo-docs-heading-weight, 600)",
			}),
		),
	];
}

/** A row in the sidebar's foot, padded to line up with the page links above it. */
function navFooterLink() {
	return [
		hstack({ gap: 2, align: "center" }),
		raw({
			padding: "0.375rem 0.5rem",
			borderRadius: "0.375rem",
			textDecoration: "none",
		}),
		text("sm"),
		fg("neutral"),
		hover([fg("neutral.emphasis"), raw({ backgroundColor: "var(--ui-neutral-bg-tint)" })]),
		focusVisible(raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "-2px" })),
	];
}

namespace DemoDocsHeader {
	export interface Props {
		site: DemoDocsSite;
		slug: string;
		query?: string;
	}
}

/**
 * The product's bar: its wordmark home to the hub, a search box that submits to the site's
 * search page, and a credit to the kit. Under 40rem the box folds into a search link, so the
 * bar keeps one row at 320px.
 */
function DemoDocsHeader(handle: Handle<DemoDocsHeader.Props>) {
	return () => {
		let { query, site, slug } = handle.props;
		let href = demoDocsHref(slug);

		return (
			<div
				mix={[
					raw({
						borderBlockEnd: "1px solid var(--ui-neutral-border)",
						backgroundColor: "var(--ui-bg)",
					}),
				]}
			>
				<div
					mix={[
						hstack({ gap: 4, align: "center" }),
						raw({
							blockSize: "3.5rem",
							maxInlineSize: "88rem",
							marginInline: "auto",
							paddingInline: "1rem",
						}),
						media("(min-width: 48rem)", raw({ paddingInline: "1.5rem" })),
						media("(min-width: 64rem)", raw({ paddingInline: "2rem" })),
					]}
				>
					<a
						href={href()}
						mix={[
							hstack({ gap: 2, align: "center" }),
							raw({ textDecoration: "none", flexShrink: 0 }),
							fg("neutral.emphasis"),
							weight("semibold"),
						]}
					>
						{site.mark()}
						<span>{site.name}</span>
						<span
							mix={[
								fg("neutral.muted"),
								weight("normal"),
								media("(max-width: 23.99rem)", visuallyHidden()),
							]}
						>
							Docs
						</span>
					</a>

					<form
						method="get"
						action={href(SEARCH_PAGE)}
						role="search"
						mix={[
							raw({ flex: "1 1 auto", maxInlineSize: "22rem", marginInlineStart: "auto" }),
							media("(max-width: 39.99rem)", raw({ display: "none" })),
						]}
					>
						<SearchField>
							<SearchField.Input
								name="q"
								defaultValue={query}
								placeholder={`Search ${site.name} docs`}
								aria-label={`Search ${site.name} docs`}
							/>
						</SearchField>
					</form>

					<a
						href={href(SEARCH_PAGE)}
						aria-label={`Search ${site.name} docs`}
						mix={[
							hstack({ align: "center", justify: "center" }),
							raw({
								marginInlineStart: "auto",
								inlineSize: "2.75rem",
								blockSize: "2.75rem",
								borderRadius: "0.5rem",
							}),
							fg("neutral"),
							hover(raw({ backgroundColor: "var(--ui-neutral-bg-tint)" })),
							media("(min-width: 40rem)", raw({ display: "none" })),
						]}
					>
						<SearchIcon size={18} aria-hidden="true" />
					</a>

					<a
						href={KIT_HREF}
						mix={[
							hstack({ gap: 1, align: "center" }),
							raw({ flexShrink: 0, textDecoration: "none" }),
							text("sm"),
							fg("neutral.muted"),
							hover(fg("neutral.emphasis")),
							media("(max-width: 47.99rem)", raw({ display: "none" })),
						]}
					>
						A demo of @sdxc/ui/docs
						<ArrowUpRightIcon size={14} aria-hidden="true" />
					</a>
				</div>
			</div>
		);
	};
}

namespace DemoDocsArticle {
	export interface Props {
		site: DemoDocsSite;
		slug: string;
		/** The page's path under the site, which its Markdown twin is named after. */
		path: string;
		page: DemoDocsPage;
		/** The page's body, already rendered for the request. */
		children: RemixNode;
	}
}

/**
 * One page's article: the breadcrumb to its section, its title and lead with the page's
 * actions, the body set for reading, its hand-written next steps, then the pager, which
 * stays inside the page's section so it follows the path the section was written as.
 */
export function DemoDocsArticle(handle: Handle<DemoDocsArticle.Props>) {
	return () => {
		let { children, page, path, site, slug } = handle.props;
		let href = demoDocsHref(slug);
		let activePath = href(path);
		let section = flattenDocsTree(site.tree).find((entry) => entry.href === activePath)?.section;
		let { next, previous } = findNeighbours(site.tree, activePath, { boundary: "section" });
		let markdownHref = routes.demoDocs.markdown.href({ site: slug, page: path });

		return (
			<article mix={[vstack({ gap: 10, align: "stretch" })]}>
				<DocsPageHeader
					crumbs={[
						{ label: `${site.name} Docs`, href: href() },
						...(section ? [{ label: section }] : []),
						{ label: page.title },
					]}
					crumbsLabel="Breadcrumb"
					title={page.title}
					mono={page.mono}
					description={page.description}
					updated={{ label: "Last updated", date: page.updated, text: formatDate(page.updated) }}
					actions={
						<PageActions
							markdownHref={markdownHref}
							labels={{
								copy: "Copy page",
								copied: "Copied",
								failed: "Could not copy the page",
								more: "More page actions",
							}}
							links={[
								{
									label: "View as Markdown",
									description: "This page as plain text",
									href: markdownHref,
									icon: <FileTextIcon size={16} aria-hidden="true" />,
								},
								{
									label: "Open in Claude",
									description: "Ask questions about this page",
									href: `https://claude.ai/new?${new URLSearchParams({ q: `Read ${markdownHref} and help me with ${page.title}.` })}`,
									icon: <SparklesIcon size={16} aria-hidden="true" />,
									external: true,
								},
							]}
						/>
					}
				/>

				<Typeset preset="docs" mix={[m(0)]}>
					{children}
				</Typeset>

				{page.next ? (
					<NextSteps id="next-steps" title="Next steps" items={page.next} level={2} />
				) : null}

				<DocsPager
					previous={previous}
					next={next}
					section={section}
					labels={{ nav: "Pagination", previous: "Previous", next: "Next" }}
					mix={[raw({ marginBlockStart: "1rem" })]}
				/>
			</article>
		);
	};
}

/** Formats `YYYY-MM-DD` as the reader sees it ("October 28, 2026"), read as a calendar date. */
function formatDate(date: string): string {
	return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
		timeZone: "UTC",
	});
}
