/**
 * Low Tide's logbook parts: one row shape per kind of post, the month headings a stream is
 * ruled into, the type filter with its counts, and the pager. A stream reads as a log because
 * every row keeps its kind in a margin column and its date at the end.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { ArrowLeftIcon, ArrowRightIcon, ArrowUpRightIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { listStyle, raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { m, p } from "@sdxc/u/size";
import { focusVisible, hover, when } from "@sdxc/u/state";
import { font, leading, text, textDecoration, tracking, weight } from "@sdxc/u/typography";

import type { DemoBlogPost } from "~/app/services/demo-blogs";
import type { DemoBlogContext } from "~/resources/views/demo-blogs";

import { linkHost, PostBody, PostDate } from "~/resources/views/demo-blogs/parts";

/** The column a stream reads in: wide enough for a code line, narrow enough for prose. */
export const STREAM_MEASURE = "46rem";

/** The width from which a row's kind moves out into the margin column. */
export const GUTTER_QUERY = "(min-width: 52rem)";

/** The margin column holding each row's kind. */
const GUTTER = "6.5rem";

/** The rule between rows and under headings, a hairline in the page's border colour. */
const HAIRLINE = "1px solid var(--ui-neutral-border)";

/** A post's kind as a margin label reads it: short, upper case, monospace. */
export function kindLabel(context: DemoBlogContext, post: DemoBlogPost): string {
	return context.site.kinds[post.kind]?.singular ?? post.kind;
}

/** The small monospace label set in a row's margin, and above the title on a phone. */
export function labelStyle() {
	return [
		m(0),
		font("mono"),
		raw({ fontSize: "0.6875rem", letterSpacing: "0.08em", textTransform: "uppercase" }),
		fg("brand"),
		weight("medium"),
	];
}

/** A link inside running copy: inherits the colour, underlined thinly, brand on hover. */
export function quietLink() {
	return [
		fg("inherit"),
		raw({
			textDecorationThickness: "1px",
			textUnderlineOffset: "0.2em",
			textDecorationColor: "var(--ui-neutral-border-strong)",
		}),
		hover([fg("brand"), raw({ textDecorationColor: "currentColor" })]),
		focusVisible(raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" })),
	];
}

/** A title link: no underline until hovered, so a column of titles reads as type. */
export function titleLink() {
	return [
		fg("neutral.emphasis"),
		textDecoration("none"),
		hover([fg("brand"), textDecoration("underline")]),
		focusVisible(raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" })),
	];
}

/** The serif face the blog's headings use, for a title that is not a heading element. */
export function headingFont() {
	return raw({ fontFamily: "var(--demo-blog-heading-font, inherit)", fontWeight: 600 });
}

namespace StreamRow {
	export interface Props {
		post: DemoBlogPost;
		context: DemoBlogContext;
	}
}

/**
 * One post in a stream, in the shape its kind takes: an article by its title and lead, a note
 * in full, a link by where it goes and why, a glossary term as a definition card.
 */
export function StreamRow(handle: Handle<StreamRow.Props>) {
	return () => {
		let { context, post } = handle.props;
		let href = context.href(post.path);

		return (
			<li
				data-slot="stream-row"
				data-kind={post.kind}
				mix={[
					vstack({ gap: 2, align: "stretch" }),
					raw({ paddingBlock: "1.25rem", borderBlockEnd: HAIRLINE }),
					media(
						GUTTER_QUERY,
						raw({
							display: "grid",
							gridTemplateColumns: `${GUTTER} minmax(0, 1fr)`,
							columnGap: "1.5rem",
						}),
					),
				]}
			>
				<p mix={[labelStyle(), media(GUTTER_QUERY, raw({ paddingBlockStart: "0.35rem" }))]}>
					<a
						href={`${context.href()}?type=${post.kind}`}
						mix={[fg("inherit"), textDecoration("none")]}
					>
						{kindLabel(context, post)}
					</a>
				</p>
				<div mix={[vstack({ gap: 2, align: "stretch" }), raw({ minInlineSize: 0 })]}>
					<RowBody post={post} context={context} href={href} />
				</div>
			</li>
		);
	};
}

namespace Row {
	export interface Props extends StreamRow.Props {
		/** The post's own page. */
		href: string;
	}
}

/** The row's content in the shape its kind's layout names. */
function RowBody(handle: Handle<Row.Props>) {
	return () => {
		let { context, post } = handle.props;
		let layout = context.site.kinds[post.kind]?.layout ?? "article";
		if (layout === "note") return <NoteRow {...handle.props} />;
		if (layout === "bookmark") return <BookmarkRow {...handle.props} />;
		if (layout === "term") return <TermRow {...handle.props} />;
		return <ArticleRow {...handle.props} />;
	};
}

/** An article or tutorial: its title, its lead and the facts a reader picks by. */
function ArticleRow(handle: Handle<Row.Props>) {
	return () => {
		let { context, href, post } = handle.props;
		return (
			<>
				<h3
					mix={[
						m(0),
						headingFont(),
						raw({ fontSize: "1.375rem" }),
						leading("tight"),
						tracking("tight"),
					]}
				>
					<a href={href} mix={[titleLink()]}>
						{post.title}
					</a>
				</h3>
				<p mix={[m(0), fg("neutral"), leading("relaxed")]}>{post.description}</p>
				<RowMeta post={post} context={context}>
					<span>{post.minutes} min read</span>
					{post.series !== undefined && post.part !== undefined ? (
						<span>
							Part {post.part} of {post.series}
						</span>
					) : null}
				</RowMeta>
			</>
		);
	};
}

/** A note, in full, so the stream is where it is read; its date links to its own page. */
function NoteRow(handle: Handle<Row.Props>) {
	return () => {
		let { context, href, post } = handle.props;
		return (
			<>
				<h3 mix={[m(0), headingFont(), raw({ fontSize: "1.0625rem" }), leading("snug")]}>
					<a href={href} mix={[titleLink()]}>
						{post.title}
					</a>
				</h3>
				{post.body === null ? (
					<p mix={[m(0), fg("neutral")]}>{post.description}</p>
				) : (
					<PostBody document={post.body} preset="docs" size="1rem" />
				)}
				<RowMeta post={post} context={context} />
			</>
		);
	};
}

/** A link out: the page's title going straight to it, its host, and why it was saved. */
function BookmarkRow(handle: Handle<Row.Props>) {
	return () => {
		let { context, href, post } = handle.props;
		let url = post.url ?? href;
		return (
			<>
				<h3
					mix={[
						m(0),
						headingFont(),
						raw({ fontSize: "1.1875rem" }),
						leading("snug"),
						hstack({ gap: 2, align: "baseline" }),
						raw({ flexWrap: "wrap" }),
					]}
				>
					<a href={url} rel="noreferrer" mix={[titleLink()]}>
						{post.title}
					</a>
					<HostChip url={url} />
				</h3>
				<p mix={[m(0), fg("neutral"), leading("relaxed")]}>{post.description}</p>
				<RowMeta post={post} context={context}>
					<a href={href} mix={[quietLink()]}>
						Why I saved it
					</a>
				</RowMeta>
			</>
		);
	};
}

namespace HostChip {
	export interface Props {
		url: string;
	}
}

/**
 * The host a link goes to with an arrow out, so a reader knows where they are going before
 * they click, and the arrow never wraps away from what it marks.
 */
export function HostChip(handle: Handle<HostChip.Props>) {
	return () => (
		<span
			mix={[
				hstack({ gap: 1, align: "center" }),
				raw({ display: "inline-flex", whiteSpace: "nowrap" }),
				font("mono"),
				raw({
					fontSize: "0.75rem",
					fontWeight: 400,
					paddingInline: "0.4rem",
					paddingBlock: "0.05rem",
					borderRadius: "999px",
					border: HAIRLINE,
					fontFamily: "var(--ui-font-mono)",
				}),
				fg("neutral.muted"),
			]}
		>
			{linkHost(handle.props.url)}
			<ArrowUpRightIcon size={12} aria-hidden="true" />
		</span>
	);
}

/** A glossary term as a small card: the word and its definition, the entry one click away. */
function TermRow(handle: Handle<Row.Props>) {
	return () => {
		let { context, href, post } = handle.props;
		return (
			<>
				<a
					href={href}
					data-slot="term-card"
					mix={[
						vstack({ gap: 1, align: "stretch" }),
						p(4),
						raw({
							borderRadius: "var(--ui-radius-lg)",
							border: HAIRLINE,
							backgroundColor: "var(--ui-neutral-bg-tint)",
							textDecoration: "none",
							maxInlineSize: "34rem",
						}),
						fg("neutral"),
						hover(raw({ borderColor: "var(--ui-brand-border-strong)" })),
						focusVisible(raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" })),
					]}
				>
					<span mix={[headingFont(), fg("neutral.emphasis"), raw({ fontSize: "1.125rem" })]}>
						{post.title}
					</span>
					<span mix={[leading("relaxed")]}>{post.description}</span>
				</a>
				<RowMeta post={post} context={context} />
			</>
		);
	};
}

namespace RowMeta {
	export interface Props extends StreamRow.Props {
		children?: RemixNode;
	}
}

/** The line under a row: its date, whatever the row adds, then its tags. */
export function RowMeta(handle: Handle<RowMeta.Props>) {
	return () => {
		let { children, context, post } = handle.props;
		return (
			<p
				mix={[
					m(0),
					hstack({ gap: 3, align: "baseline" }),
					raw({ flexWrap: "wrap", rowGap: "0.25rem" }),
					text("sm"),
					fg("neutral.muted"),
				]}
			>
				<a
					href={context.href(post.path)}
					mix={[fg("inherit"), textDecoration("none"), hover(fg("neutral.emphasis"))]}
				>
					<PostDate date={post.date} />
				</a>
				{children}
				<TagLinks tags={post.tags} context={context} />
			</p>
		);
	};
}

namespace TagLinks {
	export interface Props {
		tags: string[];
		context: DemoBlogContext;
	}
}

/** A post's tags as `#tag` links to each tag's page. */
export function TagLinks(handle: Handle<TagLinks.Props>) {
	return () => (
		<span mix={[hstack({ gap: 2, align: "baseline" }), raw({ flexWrap: "wrap" })]}>
			{handle.props.tags.map((tag) => (
				<a
					key={tag}
					href={handle.props.context.href(`tags/${tag}`)}
					mix={[quietLink(), raw({ textDecoration: "none" })]}
				>
					#{tag}
				</a>
			))}
		</span>
	);
}

namespace Stream {
	export interface Props {
		posts: DemoBlogPost[];
		context: DemoBlogContext;
		/**
		 * Rules the stream under a sticky heading per month, as a log reads; off for a short
		 * list such as search results or related posts.
		 * @default true
		 */
		months?: boolean;
	}
}

/** A list of posts in date order, ruled by month so a reader always knows when they are. */
export function Stream(handle: Handle<Stream.Props>) {
	return () => {
		let { context, months = true, posts } = handle.props;
		if (!months) {
			return (
				<ol data-slot="stream" mix={[m(0), p(0), listStyle("none")]}>
					{posts.map((post) => (
						<StreamRow key={post.path} post={post} context={context} />
					))}
				</ol>
			);
		}
		let groups: Array<{ month: string; posts: DemoBlogPost[] }> = [];
		for (let post of posts) {
			let month = post.date.slice(0, 7);
			let group = groups.at(-1);
			if (group?.month === month) group.posts.push(post);
			else groups.push({ month, posts: [post] });
		}
		return (
			<div data-slot="stream" mix={[vstack({ gap: 0, align: "stretch" })]}>
				{groups.map((group) => (
					<section key={group.month} aria-labelledby={`month-${group.month}`}>
						<h2
							id={`month-${group.month}`}
							mix={[
								m(0),
								raw({
									position: "sticky",
									insetBlockStart: 0,
									zIndex: 1,
									paddingBlock: "0.625rem",
									backgroundColor: "var(--ui-bg)",
									borderBlockEnd: HAIRLINE,
									fontFamily: "var(--ui-font-sans)",
									fontSize: "0.75rem",
									letterSpacing: "0.1em",
									textTransform: "uppercase",
									fontWeight: 600,
								}),
								fg("neutral.muted"),
							]}
						>
							{monthLabel(group.month)}
						</h2>
						<ol mix={[m(0), p(0), listStyle("none")]}>
							{group.posts.map((post) => (
								<StreamRow key={post.path} post={post} context={context} />
							))}
						</ol>
					</section>
				))}
			</div>
		);
	};
}

/** `2026-11` as "November 2026". */
function monthLabel(month: string): string {
	return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", {
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	});
}

namespace TypeFilter {
	export interface Props {
		context: DemoBlogContext;
		/** The kind the list is narrowed to, `null` for everything. */
		current: string | null;
		/** How many posts each kind holds in the list being filtered. */
		counts: Array<{ kind: string; count: number }>;
		/** Builds the address of the same list narrowed to a kind, `null` for everything. */
		href: (kind: string | null) => string;
		total: number;
	}
}

/**
 * The kinds as a row of links, each with its count, the current one marked; it scrolls
 * sideways on a phone rather than wrapping into a block that pushes the stream down.
 */
export function TypeFilter(handle: Handle<TypeFilter.Props>) {
	return () => {
		let { context, counts, current, href, total } = handle.props;
		let options: Array<{ kind: string | null; label: string; count: number }> = [
			{ kind: null, label: "Everything", count: total },
			...counts.map((entry) => ({
				kind: entry.kind,
				label: context.site.kinds[entry.kind]?.label ?? entry.kind,
				count: entry.count,
			})),
		];
		return (
			<nav
				aria-label="Filter by type"
				data-slot="type-filter"
				mix={[
					raw({
						overflowX: "auto",
						marginInline: "-1rem",
						paddingInline: "1rem",
						scrollbarWidth: "none",
					}),
				]}
			>
				<ul mix={[m(0), p(0), listStyle("none"), hstack({ gap: 1, align: "center" })]}>
					{options.map((option) => {
						let selected = option.kind === current;
						return (
							<li key={option.kind ?? "all"} mix={[raw({ flexShrink: 0 })]}>
								<a
									href={href(option.kind)}
									aria-current={selected ? "page" : undefined}
									mix={[
										hstack({ gap: 1, align: "baseline" }),
										raw({
											paddingInline: "0.75rem",
											paddingBlock: "0.375rem",
											borderRadius: "999px",
											textDecoration: "none",
											border: "1px solid transparent",
										}),
										text("sm"),
										fg("neutral"),
										hover(raw({ backgroundColor: "var(--ui-neutral-bg-tint)" })),
										focusVisible(
											raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
										),
										when(
											"&[aria-current]",
											raw({
												borderColor: "var(--ui-neutral-border-strong)",
												color: "var(--ui-neutral-fg-emphasis)",
												fontWeight: 600,
											}),
										),
									]}
								>
									{option.label}
									<span mix={[font("mono"), raw({ fontSize: "0.75rem" }), fg("neutral.muted")]}>
										{option.count}
									</span>
								</a>
							</li>
						);
					})}
				</ul>
			</nav>
		);
	};
}

namespace Pager {
	export interface Props {
		page: number;
		pageCount: number;
		pageHref: (page: number) => string;
	}
}

/** Newer and Older, with where the reader is between them; a log pages back in time. */
export function Pager(handle: Handle<Pager.Props>) {
	return () => {
		let { page, pageCount, pageHref } = handle.props;
		if (pageCount <= 1) return null;
		return (
			<nav
				aria-label="Pages"
				data-slot="feed-pager"
				mix={[
					hstack({ gap: 4, align: "center", justify: "between" }),
					raw({ paddingBlock: "1.5rem" }),
				]}
			>
				{page > 1 ? (
					<a href={pageHref(page - 1)} rel="prev" mix={[pagerLink()]}>
						<ArrowLeftIcon size={16} aria-hidden="true" />
						Newer
					</a>
				) : (
					<span />
				)}
				<span mix={[text("sm"), fg("neutral.muted"), font("mono")]}>
					Page {page} of {pageCount}
				</span>
				{page < pageCount ? (
					<a href={pageHref(page + 1)} rel="next" mix={[pagerLink()]}>
						Older
						<ArrowRightIcon size={16} aria-hidden="true" />
					</a>
				) : (
					<span />
				)}
			</nav>
		);
	};
}

/** A pager link, a padded target with its arrow. */
function pagerLink() {
	return [
		hstack({ gap: 2, align: "center" }),
		raw({
			paddingInline: "0.875rem",
			paddingBlock: "0.5rem",
			borderRadius: "var(--ui-radius-md)",
			border: HAIRLINE,
			textDecoration: "none",
		}),
		fg("neutral.emphasis"),
		weight("medium"),
		hover(raw({ backgroundColor: "var(--ui-neutral-bg-tint)" })),
		focusVisible(raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" })),
	];
}

namespace Portrait {
	export interface Props {
		initials: string;
		/** The square's side, in rem. @default 2.5 */
		size?: number;
	}
}

/** The author's initials on the brand tint, standing in for a photo the demo does not have. */
export function Portrait(handle: Handle<Portrait.Props>) {
	return () => {
		let size = handle.props.size ?? 2.5;
		return (
			<span
				aria-hidden="true"
				mix={[
					hstack({ align: "center", justify: "center" }),
					raw({
						inlineSize: `${size}rem`,
						blockSize: `${size}rem`,
						flexShrink: 0,
						borderRadius: "50%",
						backgroundColor: "var(--ui-brand-bg-tint)",
						border: "1px solid var(--ui-brand-border)",
						fontFamily: "var(--demo-blog-heading-font)",
						fontSize: `${size * 0.38}rem`,
					}),
					fg("brand"),
					weight("semibold"),
				]}
			>
				{handle.props.initials}
			</span>
		);
	};
}

namespace Column {
	export interface Props {
		children: RemixNode;
		/** The column's widest; the stream's measure when omitted. */
		measure?: string;
	}
}

/** The centred column every Low Tide page reads in, padded off the screen's edges. */
export function Column(handle: Handle<Column.Props>) {
	return () => (
		<div
			mix={[
				vstack({ gap: 0, align: "stretch" }),
				raw({
					inlineSize: "100%",
					maxInlineSize: `calc(${handle.props.measure ?? STREAM_MEASURE} + 2rem)`,
					marginInline: "auto",
					paddingInline: "1rem",
					paddingBlock: "2rem 4rem",
				}),
				media(
					GUTTER_QUERY,
					raw({
						maxInlineSize: `calc(${handle.props.measure ?? STREAM_MEASURE} + ${GUTTER} + 1.5rem + 2rem)`,
					}),
				),
			]}
		>
			{handle.props.children}
		</div>
	);
}
