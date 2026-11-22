/**
 * `GET /showcase/:slug` — one item's case study, read as a story: its headline and buttons to
 * open it and its source, a cover shot, then the Markdown with each highlighted screenshot set
 * between the paragraphs it illustrates, a rail of facts beside it, and what it is built from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { ArrowUpRightIcon } from "@sdxc/icons";
import { iife } from "@sdxc/iife";
import { toRemix } from "@sdxc/markdown/remix";
import { isFailure } from "@sdxc/result";
import { border, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { gap, grid, gridTemplate, hstack, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { is, m, maxIs, p } from "@sdxc/u/size";
import { font, leading, text, weight } from "@sdxc/u/typography";
import { LinkButton, Typeset } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { Anchor } from "~/app/services/article";
import type { ShowcaseItem } from "~/app/services/case-studies";
import type { ShowcaseUsage } from "~/scripts/showcase-usage";

import { withBundleCache } from "~/app/http/caching";
import defaultHandler from "~/app/http/controllers/default-handler";
import { pageSchema, seo } from "~/app/initializers/seo";
import { tableOfContents } from "~/app/services/article";
import { filterOf, kindLabel, readCaseStudy, showcaseHref } from "~/app/services/case-studies";
import Hero from "~/resources/components/hero";
import { DOCS_COMPONENTS } from "~/resources/components/markdown-components";
import { ProseHeading, ProseParagraph } from "~/resources/components/prose";
import SectionBlock from "~/resources/components/section-block";
import { ShowcaseKindChips, ShowcaseScreenshot } from "~/resources/components/showcase-gallery";
import SiteHeader from "~/resources/components/site-header";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The width the cover, the article and its rail share, so the figures line up with the cover. */
const PAGE_WIDTH = "72rem";

/** Renders the case study, or the site's 404 for a slug with none. */
export default createAction(routes.showcase.show, async (ctx) => {
	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);
	let result = await readCaseStudy(slug);
	if (isFailure(result)) {
		ctx.log.fail(result.error, { slug });
		return defaultHandler(ctx);
	}
	if (result.data === null) return defaultHandler(ctx);

	let { document, item, usage } = result.data;
	let title = `${item.title} — Showcase — sdxc`;
	let anchors = [
		...tableOfContents(document).filter((anchor) => anchor.level === 2),
		...(usage.packages.length > 0 ? [{ id: "built-with", text: "Built with", level: 2 }] : []),
	];

	let response = ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={title}
			description={item.summary}
			canonical={ctx.url.href}
			schema={pageSchema({
				name: item.headline,
				description: item.summary,
				url: seo.canonical(ctx.url),
				cardTitle: title,
			})}
		>
			<SiteHeader activePath={routes.showcase.index.href()} />

			<main mix={[vstack({ align: "center" }), is("100%")]}>
				<Hero>
					<div mix={[vstack({ gap: 5, align: "start" }), maxIs("48rem")]}>
						<nav aria-label="Breadcrumb" mix={[text("sm"), fg("neutral")]}>
							<a href={routes.showcase.index.href()}>Showcase</a>
							{" / "}
							<a href={showcaseHref(filterOf(item))}>
								{item.kind === "production" ? "In production" : `${kindLabel(item)}s`}
							</a>
							{" / "}
							<span aria-current="page">{item.title}</span>
						</nav>
						<ShowcaseKindChips item={item} />
						<ProseHeading level={1}>{item.headline}</ProseHeading>
						<ProseParagraph>{item.summary}</ProseParagraph>
						<CaseStudyActions item={item} />
					</div>
				</Hero>

				{item.cover === null ? null : (
					<div mix={[is("100%"), maxIs(PAGE_WIDTH), p(0, 4)]}>
						<ShowcaseScreenshot
							id="cover"
							src={item.cover.src}
							alt={item.cover.alt}
							width={1440}
							height={900}
							fetchpriority="high"
							mix={[
								border({ color: "neutral" }),
								raw({
									display: "block",
									inlineSize: "100%",
									blockSize: "auto",
									borderRadius: "var(--ui-radius-xl, 1rem)",
									boxShadow: "0 24px 60px -32px color-mix(in oklch, CanvasText 35%, transparent)",
								}),
							]}
						/>
					</div>
				)}

				<div
					mix={[
						is("100%"),
						maxIs(PAGE_WIDTH),
						p(16, 4),
						grid(),
						gap(12),
						media("(min-width: 64rem)", gridTemplate({ columns: "minmax(0, 1fr) 16rem" })),
					]}
				>
					<article id="case-study" mix={[raw({ minInlineSize: 0, maxInlineSize: "46rem" })]}>
						<Typeset preset="docs">
							{toRemix(document, { components: { ...DOCS_COMPONENTS, image: CaseStudyFigure } })}
						</Typeset>
					</article>
					<CaseStudyRail item={item} usage={usage} anchors={anchors} />
				</div>

				{usage.packages.length > 0 ? (
					<SectionBlock id="built-with" title="Built with" tone="tinted">
						<UsageList
							id="packages"
							title={`${usage.packages.length} @sdxc/* packages`}
							links={usage.packages.map((name) => ({
								label: name,
								href: routes.api.show.href({ name: name.slice("@sdxc/".length) }),
							}))}
						/>
						{usage.components.length > 0 ? (
							<UsageList
								id="components"
								title={`${usage.components.length} @sdxc/ui components, mixins and behaviors`}
								links={usage.components.map((component) => ({
									label: component.name,
									href: `${routes.api.show.href({ name: "ui" })}/${component.path}`,
								}))}
							/>
						) : null}
						<p mix={[m(0), text("sm"), fg("neutral"), leading("relaxed")]}>
							Read from the imports in its source at build time.
						</p>
					</SectionBlock>
				) : null}

				<SectionBlock id="more" title="See more in the showcase" tone="grid" align="center">
					<p>
						Every item has a case study like this one, from the apps in production to each demo.
					</p>
					<LinkButton href={showcaseHref()} color="neutral" variant="outline">
						Back to the showcase
					</LinkButton>
				</SectionBlock>
			</main>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response);
});

namespace CaseStudyActions {
	export interface Props {
		item: ShowcaseItem;
	}
}

/** The buttons to open the item and to read its source; one with no deployment links its source alone. */
function CaseStudyActions(handle: Handle<CaseStudyActions.Props>) {
	return () => {
		let { item } = handle.props;
		let external = item.kind === "production";
		return (
			<div mix={[hstack({ gap: 3, align: "center" }), raw({ flexWrap: "wrap" })]}>
				{item.liveHref === null ? null : (
					<LinkButton href={item.liveHref} rel={external ? "noreferrer" : undefined}>
						{iife(() => {
							if (!external) return "Open the demo";
							return item.category === "landing" ? "Open the page" : "Open the app";
						})}
						{external ? <ArrowUpRightIcon size={16} aria-hidden="true" /> : null}
					</LinkButton>
				)}
				<LinkButton href={item.sourceHref} rel="noreferrer" color="neutral" variant="outline">
					View the source
					<ArrowUpRightIcon size={16} aria-hidden="true" />
				</LinkButton>
			</div>
		);
	};
}

namespace CaseStudyFigure {
	export interface Props {
		src: string;
		/** The Markdown image's title, which reads as the figure's caption. */
		title?: string;
		/** The image's alternative text, as the Markdown wrote it between the brackets. */
		children?: RemixNode;
	}
}

/**
 * A screenshot the Markdown places between paragraphs, drawn as a figure with its caption. It
 * runs wider than the text on a wide screen, so a highlighted feature reads at a glance.
 */
function CaseStudyFigure(handle: Handle<CaseStudyFigure.Props>) {
	return () => {
		let { children, src, title } = handle.props;
		let alt = plainText(children);
		return (
			<figure
				mix={[vstack({ gap: 3, align: "stretch" }), raw({ margin: "2.5rem 0", display: "flex" })]}
			>
				<a href={src} mix={[raw({ display: "block" })]}>
					<ShowcaseScreenshot
						src={src}
						alt={alt}
						loading="lazy"
						mix={[
							border({ color: "neutral" }),
							raw({
								display: "block",
								inlineSize: "100%",
								blockSize: "auto",
								marginInline: "auto",
								maxBlockSize: "44rem",
								objectFit: "contain",
								borderRadius: "var(--ui-radius-lg, 0.75rem)",
								backgroundColor: "var(--ui-neutral-bg-tint, Canvas)",
							}),
						]}
					/>
				</a>
				{title === undefined || title === "" ? null : (
					<figcaption mix={[text("sm"), fg("neutral"), leading("snug")]}>{title}</figcaption>
				)}
			</figure>
		);
	};
}

/** The text a rendered alternative text holds, for the `alt` attribute. */
function plainText(node: RemixNode): string {
	if (typeof node === "string" || typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map((part: RemixNode) => plainText(part)).join("");
	return "";
}

namespace CaseStudyRail {
	export interface Props {
		item: ShowcaseItem;
		usage: ShowcaseUsage;
		anchors: Anchor[];
	}
}

/**
 * The facts beside the story: what kind of thing it is, how much of the collection it uses,
 * where to open it, and every section by the id a shared link can name. It sticks while the
 * reader scrolls on a wide screen and sits under the story on a narrow one.
 */
function CaseStudyRail(handle: Handle<CaseStudyRail.Props>) {
	return () => {
		let { anchors, item, usage } = handle.props;
		let facts: Array<{ label: string; value: RemixNode }> = [
			{ label: "Kind", value: kindLabel(item) },
			{ label: "Packages", value: `${usage.packages.length} from @sdxc` },
			{ label: "Components", value: `${usage.components.length} from @sdxc/ui` },
			...(item.liveHref === null
				? []
				: [
						{
							label: item.kind === "demo" ? "Demo" : "Live",
							value: <a href={item.liveHref}>Open it</a>,
						},
					]),
			{ label: "Source", value: <a href={item.sourceHref}>GitHub</a> },
		];
		return (
			<aside
				aria-label="About this case study"
				mix={[
					vstack({ gap: 8, align: "stretch" }),
					text("sm"),
					media(
						"(min-width: 64rem)",
						raw({ position: "sticky", insetBlockStart: "6rem", alignSelf: "start" }),
					),
				]}
			>
				<dl mix={[m(0), grid(), gridTemplate({ columns: "auto 1fr" }), gap(2, 4)]}>
					{facts.map((fact) => (
						<>
							<dt key={`${fact.label}-term`} mix={[fg("neutral")]}>
								{fact.label}
							</dt>
							<dd key={`${fact.label}-value`} mix={[m(0), weight("medium")]}>
								{fact.value}
							</dd>
						</>
					))}
				</dl>
				<nav aria-label="On this page" mix={[vstack({ gap: 2, align: "start" })]}>
					<p mix={[m(0), fg("neutral"), weight("medium")]}>On this page</p>
					<ul mix={[vstack({ gap: 1.5, align: "start" }), m(0), p(0), raw({ listStyle: "none" })]}>
						{anchors.map((anchor) => (
							<li key={anchor.id}>
								<a href={`#${anchor.id}`}>{anchor.text}</a>
							</li>
						))}
					</ul>
				</nav>
			</aside>
		);
	};
}

namespace UsageList {
	export interface Props {
		id: string;
		title: string;
		links: Array<{ label: string; href: string }>;
	}
}

/** One titled list of links to the reference pages of what the item imports. */
function UsageList(handle: Handle<UsageList.Props>) {
	return () => {
		let { id, links, title } = handle.props;
		return (
			<div id={id} mix={[vstack({ gap: 3, align: "stretch" })]}>
				<h3 mix={[m(0), text("base"), weight("semibold")]}>{title}</h3>
				<ul
					mix={[
						grid(),
						gridTemplate({ columns: "repeat(auto-fill, minmax(min(100%, 12rem), 1fr))" }),
						gap(2, 4),
						m(0),
						p(0),
						text("sm"),
						font("mono"),
						raw({ listStyle: "none" }),
					]}
				>
					{links.map((link) => (
						<li key={link.href}>
							<a href={link.href}>{link.label}</a>
						</li>
					))}
				</ul>
			</div>
		);
	};
}
