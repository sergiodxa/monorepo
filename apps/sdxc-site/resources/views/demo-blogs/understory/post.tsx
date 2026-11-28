/**
 * Understory's post page, shaped by the post's kind: an essay or tutorial with its outline and
 * series, a note, a link out, a glossary term. Every page ends in the garden's connections:
 * the terms it uses, the posts linking to it, related posts, and its neighbours by date.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { ArrowRightIcon, ArrowUpRightIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { listStyle, raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { m, p } from "@sdxc/u/size";
import { balance, leading, pretty, text, weight } from "@sdxc/u/typography";
import { Avatar, Breadcrumbs, LinkButton } from "@sdxc/ui";
import { DocsPager, TableOfContents } from "@sdxc/ui/docs";

import type { DemoBlogPost } from "~/app/services/demo-blogs";
import type { DemoBlogContext, DemoBlogPostView } from "~/resources/views/demo-blogs";

import { SUBSCRIBE_PAGE, TAGS_PAGE } from "~/resources/views/demo-blogs";
import { linkHost, PostBody, PostDate } from "~/resources/views/demo-blogs/parts";
import { backlinksTo, termsUsedBy } from "~/resources/views/demo-blogs/understory/backlinks";
import {
	CardGrid,
	GardenCard,
	KindChip,
	kindHue,
	kindLabel,
	labelFace,
	partTitle,
	quietLink,
	SectionTitle,
	TendedBadge,
	tinted,
} from "~/resources/views/demo-blogs/understory/parts";

/** The width from which the outline and the terms move into a rail beside the prose. */
const RAIL_QUERY = "(min-width: 70rem)";

/** The prose column's measure. */
const MEASURE = "42rem";

namespace PostPage {
	export interface Props {
		view: DemoBlogPostView;
		context: DemoBlogContext;
	}
}

/**
 * One post: its header and body in a reading column, a rail with its outline and terms on
 * wide screens, then everything connected to it at full width.
 */
export function PostPage(handle: Handle<PostPage.Props>) {
	return () => {
		let { context, view } = handle.props;
		let { post } = view.article;
		let layout = context.site.kinds[post.kind]?.layout ?? "article";
		let terms = termsUsedBy(context.posts, post);
		let backlinks = backlinksTo(context.posts, post);
		let hasToc = layout === "article" && view.article.toc.length >= 2;
		let hasRail = hasToc || terms.length > 0;
		return (
			<div
				mix={[
					raw({
						inlineSize: "100%",
						maxInlineSize: "76rem",
						marginInline: "auto",
						paddingInline: "clamp(1rem, 4vw, 2rem)",
						paddingBlock: "2rem 4rem",
						boxSizing: "border-box",
					}),
					vstack({ gap: 12, align: "stretch" }),
				]}
			>
				<div
					mix={[
						raw({ display: "grid", gap: "2.5rem", gridTemplateColumns: "minmax(0, 1fr)" }),
						hasRail
							? media(
									RAIL_QUERY,
									raw({
										gridTemplateColumns: `minmax(0, ${MEASURE}) minmax(0, 16rem)`,
										gap: "4rem",
										justifyContent: "center",
									}),
								)
							: raw({ justifyContent: "center", gridTemplateColumns: `minmax(0, ${MEASURE})` }),
					]}
				>
					<article mix={[vstack({ gap: 6, align: "stretch" }), raw({ minInlineSize: 0 })]}>
						<Trail context={context} post={post} />
						<PostHeader context={context} post={post} layout={layout} />
						{view.series.length > 0 ? <SeriesBox context={context} view={view} /> : null}
						{hasToc ? (
							<div mix={[hasRail ? media(RAIL_QUERY, raw({ display: "none" })) : []]}>
								<TableOfContents items={view.article.toc} label="On this page" layout="bar" />
							</div>
						) : null}
						{layout === "term" ? <Definition post={post} /> : null}
						<PostBody document={view.article.document} />
						{layout === "bookmark" && post.url !== undefined ? (
							<p mix={[m(0)]}>
								<LinkButton href={post.url} rel="noreferrer" color="brand" variant="solid">
									Visit {linkHost(post.url)}
									<ArrowUpRightIcon size={16} aria-hidden="true" />
								</LinkButton>
							</p>
						) : null}
						<NextInSeries context={context} view={view} />
						<TopicLinks context={context} post={post} />
					</article>
					{hasRail ? (
						<aside
							aria-label="About this post"
							mix={[
								raw({ display: "none" }),
								media(
									RAIL_QUERY,
									raw({
										display: "flex",
										flexDirection: "column",
										gap: "2rem",
										position: "sticky",
										insetBlockStart: "6rem",
										alignSelf: "start",
									}),
								),
							]}
						>
							{hasToc ? <TableOfContents items={view.article.toc} label="On this page" /> : null}
							{terms.length > 0 ? <RailTerms context={context} terms={terms} /> : null}
						</aside>
					) : null}
				</div>

				<Connections context={context} view={view} terms={terms} backlinks={backlinks} />
			</div>
		);
	};
}

namespace Trail {
	export interface Props {
		context: DemoBlogContext;
		post: DemoBlogPost;
	}
}

/** The way back: the blog, then the post's kind as a filtered feed. */
function Trail(handle: Handle<Trail.Props>) {
	return () => {
		let { context, post } = handle.props;
		return (
			<Breadcrumbs aria-label="Breadcrumb">
				<Breadcrumbs.List>
					<Breadcrumbs.Item>
						<Breadcrumbs.Link href={context.href()}>{context.site.name}</Breadcrumbs.Link>
					</Breadcrumbs.Item>
					<Breadcrumbs.Item>
						<Breadcrumbs.Link href={`${context.href()}?type=${post.kind}`}>
							{context.site.kinds[post.kind]?.label ?? post.kind}
						</Breadcrumbs.Link>
					</Breadcrumbs.Item>
				</Breadcrumbs.List>
			</Breadcrumbs>
		);
	};
}

namespace PostHeader {
	export interface Props {
		context: DemoBlogContext;
		post: DemoBlogPost;
		layout: string;
	}
}

/**
 * The title block: kind chip, title, lead and the garden's dates, "planted" for when it went
 * out and "tended" for its last update. A term's lead is its definition, drawn below instead.
 */
function PostHeader(handle: Handle<PostHeader.Props>) {
	return () => {
		let { context, layout, post } = handle.props;
		return (
			<header data-slot="understory-post-header" mix={[vstack({ gap: 4, align: "start" })]}>
				<KindChip context={context} post={post} />
				<h1
					mix={[
						m(0),
						raw({
							fontSize:
								layout === "article"
									? "clamp(2.1rem, 1.4rem + 2.6vw, 3.25rem)"
									: "clamp(1.8rem, 1.3rem + 1.8vw, 2.5rem)",
							lineHeight: 1.1,
							fontVariantCaps: layout === "term" ? "small-caps" : undefined,
						}),
						balance(),
						fg("neutral.emphasis"),
					]}
				>
					{post.title}
				</h1>
				{layout === "term" ? null : (
					<p
						mix={[
							m(0),
							raw({
								fontSize: "1.25rem",
								fontFamily: "var(--demo-blog-reading-font)",
								fontStyle: "italic",
							}),
							leading("snug"),
							pretty(),
							fg("neutral"),
						]}
					>
						{post.description}
					</p>
				)}
				<p
					mix={[
						m(0),
						hstack({ gap: 2, align: "center" }),
						raw({ flexWrap: "wrap", columnGap: "0.75rem" }),
						...labelFace(),
						fg("neutral.muted"),
					]}
				>
					<span>
						Planted <PostDate date={post.date} style="long" />
					</span>
					{post.updated !== undefined ? <TendedBadge date={post.updated} /> : null}
					{layout === "article" ? <span>{post.minutes} min read</span> : null}
					<span>by {context.site.author.name}</span>
				</p>
			</header>
		);
	};
}

namespace Definition {
	export interface Props {
		post: DemoBlogPost;
	}
}

/** A term's one-sentence definition, set apart as the thing to remember from the page. */
function Definition(handle: Handle<Definition.Props>) {
	return () => {
		let { post } = handle.props;
		return (
			<p
				data-slot="understory-definition"
				mix={[
					m(0),
					tinted(kindHue(post.kind)),
					p(5),
					raw({ fontSize: "1.2rem", fontFamily: "var(--demo-blog-reading-font)" }),
					leading("snug"),
					pretty(),
					fg("neutral.emphasis"),
				]}
			>
				<dfn mix={[raw({ fontStyle: "normal", fontWeight: 600 })]}>{post.title}</dfn>:{" "}
				{post.description}
			</p>
		);
	};
}

namespace SeriesBox {
	export interface Props {
		context: DemoBlogContext;
		view: DemoBlogPostView;
	}
}

/** "Part n of m" and the whole series, open by default with the current part marked. */
function SeriesBox(handle: Handle<SeriesBox.Props>) {
	return () => {
		let { context, view } = handle.props;
		let { post } = view.article;
		return (
			<details open data-slot="understory-series-box" mix={[tinted(kindHue(post.kind)), p(4, 5)]}>
				<summary mix={[raw({ cursor: "pointer" }), weight("semibold"), fg("neutral.emphasis")]}>
					Part {post.part} of {view.series.length} in {post.series}
				</summary>
				<ol
					mix={[
						m(0),
						raw({ paddingInlineStart: "1.5rem", marginBlockStart: "0.75rem" }),
						vstack({ gap: 1, align: "stretch" }),
					]}
				>
					{view.series.map((part) => (
						<li>
							{part.path === post.path ? (
								<span aria-current="page" mix={[weight("semibold"), fg("brand")]}>
									{partTitle(part.title, post.series)} (you are here)
								</span>
							) : (
								<a href={context.href(part.path)} mix={[quietLink(), fg("neutral.emphasis")]}>
									{partTitle(part.title, post.series)}
								</a>
							)}
						</li>
					))}
				</ol>
			</details>
		);
	};
}

/** The next part of the series as the post's way on, ahead of anything chronological. */
function NextInSeries(handle: Handle<SeriesBox.Props>) {
	return () => {
		let { context, view } = handle.props;
		let { post } = view.article;
		let next = view.series.find((part) => (part.part ?? 0) === (post.part ?? 0) + 1);
		if (next === undefined) return null;
		return (
			<a
				href={context.href(next.path)}
				data-slot="understory-next-part"
				mix={[
					tinted(kindHue(next.kind)),
					p(5),
					hstack({ gap: 4, align: "center", justify: "between" }),
					raw({ textDecoration: "none" }),
					fg("neutral.emphasis"),
				]}
			>
				<span mix={[vstack({ gap: 1, align: "start" })]}>
					<span mix={[...labelFace(), fg("brand"), weight("semibold")]}>
						Next in {post.series}, part {next.part}
					</span>
					<span mix={[text("xl"), raw({ fontFamily: "var(--demo-blog-heading-font)" })]}>
						{partTitle(next.title, post.series)}
					</span>
				</span>
				<ArrowRightIcon size={20} aria-hidden="true" />
			</a>
		);
	};
}

/** The post's topics as links to each topic's page. */
function TopicLinks(handle: Handle<Trail.Props>) {
	return () => {
		let { context, post } = handle.props;
		if (post.tags.length === 0) return null;
		return (
			<p mix={[m(0), hstack({ gap: 3, align: "baseline" }), raw({ flexWrap: "wrap" }), text("sm")]}>
				<span mix={[...labelFace(), fg("neutral.muted"), raw({ textTransform: "uppercase" })]}>
					Filed under
				</span>
				{post.tags.map((tag) => (
					<a href={context.href(`${TAGS_PAGE}/${tag}`)} mix={[quietLink(), fg("brand")]}>
						#{tag}
					</a>
				))}
			</p>
		);
	};
}

namespace RailTerms {
	export interface Props {
		context: DemoBlogContext;
		terms: DemoBlogPost[];
	}
}

/** The glossary terms the post uses, each with its definition, beside the prose. */
function RailTerms(handle: Handle<RailTerms.Props>) {
	return () => {
		let { context, terms } = handle.props;
		return (
			<section
				aria-labelledby="rail-terms"
				data-slot="understory-rail-terms"
				mix={[vstack({ gap: 3, align: "stretch" })]}
			>
				<h2
					id="rail-terms"
					mix={[
						m(0),
						...labelFace(),
						fg("neutral.muted"),
						raw({ textTransform: "uppercase", fontFamily: "var(--understory-label-font)" }),
					]}
				>
					Terms used here
				</h2>
				<dl mix={[m(0), vstack({ gap: 3, align: "stretch" })]}>
					{terms.map((term) => (
						<div>
							<dt mix={[weight("semibold"), raw({ fontVariantCaps: "small-caps" })]}>
								<a href={context.href(term.path)} mix={[quietLink(), fg("neutral.emphasis")]}>
									{term.title}
								</a>
							</dt>
							<dd mix={[m(0), text("sm"), fg("neutral.muted"), pretty()]}>{term.description}</dd>
						</div>
					))}
				</dl>
			</section>
		);
	};
}

namespace Connections {
	export interface Props {
		context: DemoBlogContext;
		view: DemoBlogPostView;
		terms: DemoBlogPost[];
		backlinks: DemoBlogPost[];
	}
}

/**
 * Everything the post connects to, at full width: the terms it uses, "Linked from" (posts
 * whose body links here), related posts by shared topics, the author, and older and newer.
 */
function Connections(handle: Handle<Connections.Props>) {
	return () => {
		let { backlinks, context, terms, view } = handle.props;
		let { post } = view.article;
		let shown = new Set([...backlinks, ...terms].map((entry) => entry.path));
		let related = view.related.filter((entry) => !shown.has(entry.path));
		return (
			<footer mix={[vstack({ gap: 10, align: "stretch" })]}>
				{terms.length > 0 ? (
					<ConnectionGroup
						title="Terms in this post"
						note="the vocabulary it leans on"
						slot="understory-terms"
						narrowOnly
					>
						{terms.map((term) => (
							<GardenCard context={context} post={term} />
						))}
					</ConnectionGroup>
				) : null}
				<ConnectionGroup
					title="Linked from"
					note={
						backlinks.length === 0
							? undefined
							: `${backlinks.length} ${backlinks.length === 1 ? "post links" : "posts link"} here`
					}
					slot="understory-backlinks"
					empty={`Nothing links here yet. It is a young ${kindLabel(context, post).toLowerCase()}.`}
				>
					{backlinks.map((entry) => (
						<GardenCard context={context} post={entry} span={false} />
					))}
				</ConnectionGroup>
				{related.length > 0 ? (
					<ConnectionGroup
						title="Growing nearby"
						note="shares its topics"
						slot="understory-related"
					>
						{related.map((entry) => (
							<GardenCard context={context} post={entry} span={false} />
						))}
					</ConnectionGroup>
				) : null}
				{context.site.kinds[post.kind]?.layout === "term" ? (
					<GlossaryIndex context={context} post={post} />
				) : null}
				<AuthorNote context={context} />
				<DocsPager
					previous={neighbour(context, view.older)}
					next={neighbour(context, view.newer)}
					labels={{ nav: "Older and newer posts", previous: "Older", next: "Newer" }}
				/>
			</footer>
		);
	};
}

/** A neighbouring post as the pager names it, its kind as the section. */
function neighbour(context: DemoBlogContext, post: DemoBlogPost | null): DocsPager.Entry | null {
	if (post === null) return null;
	return { title: post.title, href: context.href(post.path), section: kindLabel(context, post) };
}

namespace ConnectionGroup {
	export interface Props {
		title: string;
		note?: string;
		slot: string;
		/**
		 * Shows the group only below the rail's width, for what the rail already lists beside
		 * the prose on a wide screen.
		 */
		narrowOnly?: boolean;
		/** What the group says instead of its grid when it has no posts. */
		empty?: string;
		children: RemixNode[];
	}
}

/** One titled group of connected posts, laid out as cards. */
function ConnectionGroup(handle: Handle<ConnectionGroup.Props>) {
	return () => {
		let { children, empty, narrowOnly = false, note, slot, title } = handle.props;
		return (
			<section
				data-slot={slot}
				mix={[
					vstack({ gap: 4, align: "stretch" }),
					narrowOnly ? media(RAIL_QUERY, raw({ display: "none" })) : [],
				]}
			>
				<SectionTitle note={note}>{title}</SectionTitle>
				{children.length === 0 && empty !== undefined ? (
					<p mix={[m(0), fg("neutral.muted")]}>{empty}</p>
				) : (
					<CardGrid min="15rem">{children}</CardGrid>
				)}
			</section>
		);
	};
}

namespace AuthorNote {
	export interface Props {
		context: DemoBlogContext;
	}
}

/** Who wrote it and the one invitation to subscribe, once, at the end. */
function AuthorNote(handle: Handle<AuthorNote.Props>) {
	return () => {
		let { href, site } = handle.props.context;
		return (
			<aside
				aria-label="About the author"
				data-slot="understory-author"
				mix={[
					tinted(140),
					p(5),
					raw({
						display: "grid",
						gap: "1rem",
						gridTemplateColumns: "auto minmax(0, 1fr)",
						alignItems: "start",
					}),
				]}
			>
				<Avatar size="lg">
					<Avatar.Fallback>{site.author.initials}</Avatar.Fallback>
				</Avatar>
				<div mix={[vstack({ gap: 3, align: "start" })]}>
					<p mix={[m(0), weight("semibold"), fg("neutral.emphasis")]}>
						{site.author.name}
						<span mix={[weight("normal"), fg("neutral.muted")]}> · {site.author.role}</span>
					</p>
					<p mix={[m(0), pretty(), raw({ fontFamily: "var(--demo-blog-reading-font)" })]}>
						{site.author.bio}
					</p>
					<LinkButton href={href(SUBSCRIBE_PAGE)} variant="outline" size="sm">
						Get the seasonal letter
					</LinkButton>
				</div>
			</aside>
		);
	};
}

namespace GlossaryIndex {
	export interface Props {
		context: DemoBlogContext;
		post: DemoBlogPost;
	}
}

/** Every glossary term A to Z, the current one marked, so a term page leads to its neighbours. */
function GlossaryIndex(handle: Handle<GlossaryIndex.Props>) {
	return () => {
		let { context, post } = handle.props;
		let terms = context.posts
			.filter((entry) => entry.kind === post.kind)
			.sort((a, b) => a.title.localeCompare(b.title));
		return (
			<nav
				aria-labelledby="glossary-index"
				data-slot="understory-glossary-index"
				mix={[vstack({ gap: 4, align: "stretch" })]}
			>
				<SectionTitle id="glossary-index" note="A to Z">
					The whole glossary
				</SectionTitle>
				<ul
					mix={[
						m(0),
						p(0),
						listStyle("none"),
						hstack({ gap: 2, align: "center" }),
						raw({ flexWrap: "wrap" }),
					]}
				>
					{terms.map((term) => (
						<li>
							<a
								href={context.href(term.path)}
								aria-current={term.path === post.path ? "page" : undefined}
								mix={[
									raw({
										display: "inline-flex",
										alignItems: "center",
										minBlockSize: "2.25rem",
										paddingInline: "0.875rem",
										borderRadius: "999px",
										textDecoration: "none",
										fontVariantCaps: "small-caps",
										letterSpacing: "0.03em",
									}),
									tinted(kindHue(term.kind)),
									fg("neutral.emphasis"),
									raw({
										'&[aria-current="page"]': {
											outline: "2px solid var(--ui-brand-border-strong)",
										},
									}),
								]}
							>
								{term.title}
							</a>
						</li>
					))}
				</ul>
			</nav>
		);
	};
}
