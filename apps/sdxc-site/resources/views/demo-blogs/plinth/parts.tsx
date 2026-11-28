/**
 * Plinth's index parts: the table-like row every post is listed as (date, type code, title,
 * meta), the year-ruled list those rows sit in, the type filter with its counts, the pager and
 * the side modules. Every list on the blog is built from these, so a post reads the same way
 * wherever it is listed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { ArrowLeftIcon, ArrowRightIcon, ArrowUpRightIcon, ChevronDownIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { cursor, listStyle, raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { focusVisible, hover, open, when } from "@sdxc/u/state";
import {
	font,
	leading,
	tabularNums,
	text,
	textDecoration,
	tracking,
	weight,
} from "@sdxc/u/typography";
import { Pagination } from "@sdxc/ui";

import type { DemoBlogPost } from "~/app/services/demo-blogs";
import type { DemoBlogContext } from "~/resources/views/demo-blogs";

import { groupByYear } from "~/app/services/demo-blogs";
import { pageWindow } from "~/app/services/page-window";
import { FEED_PAGE, SUBSCRIBE_PAGE } from "~/resources/views/demo-blogs";
import { linkHost, NewsletterForm, PostBody, PostDate } from "~/resources/views/demo-blogs/parts";
import { PAGE_MAX } from "~/resources/views/demo-blogs/plinth/frame";

/** The short code each kind carries in the index's fixed type column. */
export const KIND_CODES: Record<string, string> = {
	articles: "ART",
	tutorials: "TUT",
	notes: "NOTE",
	links: "LINK",
	glossary: "TERM",
};

/** The width from which a row sets out on one line, date and meta in columns of their own. */
export const WIDE_QUERY = "(min-width: 48rem)";

/** The width from which the side modules move into a column beside the index. */
export const RAIL_QUERY = "(min-width: 64rem)";

/** The rule between rows, a hairline in the page's border colour. */
const HAIRLINE = "1px solid var(--ui-neutral-border)";

/** The heavy rule over a year or a module, ink on paper and paper on ink. */
export const HEAVY_RULE = "3px solid var(--ui-neutral-fg-emphasis)";

/** The row's columns on a phone: the type code, then everything else under the title. */
const NARROW_COLUMNS = "4.25rem minmax(0, 1fr)";

/** The row's columns from {@link WIDE_QUERY}: date, type code, title and meta. */
const WIDE_COLUMNS = "6.5rem 4.25rem minmax(0, 1fr) minmax(0, auto)";

/** A focus ring in the signal colour, offset clear of the element. */
export function focusRing() {
	return focusVisible(raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }));
}

/** A title link: ink until hovered, then underlined in the signal colour. */
export function titleLink() {
	return [
		fg("neutral.emphasis"),
		textDecoration("none"),
		hover(
			raw({
				textDecoration: "underline",
				textDecorationColor: "var(--ui-brand-fg)",
				textDecorationThickness: "2px",
				textUnderlineOffset: "0.18em",
			}),
		),
		focusRing(),
	];
}

/** A link in running copy, underlined in the signal colour. */
export function inlineLink() {
	return [
		fg("neutral.emphasis"),
		raw({
			textDecorationLine: "underline",
			textDecorationColor: "var(--ui-brand-fg)",
			textDecorationThickness: "2px",
			textUnderlineOffset: "0.18em",
		}),
		hover(fg("brand")),
		focusRing(),
	];
}

/** The small monospace caps used for eyebrows, dates and counts. */
export function monoLabel() {
	return [
		font("mono"),
		raw({ fontSize: "0.75rem", textTransform: "uppercase" }),
		tracking("0.06em"),
		tabularNums(),
	];
}

namespace Container {
	export interface Props {
		children: RemixNode;
		/** The content's widest; the page's when omitted. */
		measure?: string;
		/** Space above and below. @default "2.5rem 5rem" */
		block?: string;
	}
}

/** The centred column every Plinth page sits in, 16px off a phone's edges and 32px off a desk's. */
export function Container(handle: Handle<Container.Props>) {
	return () => (
		<div
			mix={[
				raw({
					inlineSize: "100%",
					maxInlineSize: handle.props.measure ?? PAGE_MAX,
					marginInline: "auto",
					paddingInline: "1rem",
					paddingBlock: handle.props.block ?? "2.5rem 5rem",
					boxSizing: "border-box",
					[`@media ${WIDE_QUERY}`]: { paddingInline: "2rem" },
				}),
			]}
		>
			{handle.props.children}
		</div>
	);
}

namespace Masthead {
	export interface Props {
		/** The monospace line above the title ("Archive", "Topic"). */
		eyebrow: string;
		title: RemixNode;
		lead?: RemixNode;
		/** Anything set under the lead, such as a count or a form. */
		children?: RemixNode;
	}
}

/** A page's title block: a mono eyebrow, a display title and a lead, ruled off below. */
export function Masthead(handle: Handle<Masthead.Props>) {
	return () => {
		let { children, eyebrow, lead, title } = handle.props;
		return (
			<header
				data-slot="plinth-masthead"
				mix={[
					vstack({ gap: 4, align: "stretch" }),
					raw({ paddingBlockEnd: "2rem", marginBlockEnd: "2rem", borderBlockEnd: HEAVY_RULE }),
				]}
			>
				<p mix={[m(0), monoLabel(), fg("brand"), weight("bold")]}>{eyebrow}</p>
				<h1
					mix={[
						m(0),
						raw({ fontSize: "clamp(2.5rem, 1.7rem + 4vw, 5.25rem)", maxInlineSize: "18ch" }),
						leading(0.95),
						fg("neutral.emphasis"),
					]}
				>
					{title}
				</h1>
				{lead === undefined ? null : (
					<p
						mix={[
							m(0),
							raw({
								fontSize: "clamp(1.0625rem, 1rem + 0.4vw, 1.3125rem)",
								maxInlineSize: "40rem",
							}),
							leading("relaxed"),
							fg("neutral"),
						]}
					>
						{lead}
					</p>
				)}
				{children}
			</header>
		);
	};
}

namespace TypeCode {
	export interface Props {
		kind: string;
		/** Where the code links to, the feed narrowed to its kind; plain text when omitted. */
		href?: string;
	}
}

/**
 * A kind's short code in a fixed-width box: filled ink for long reads, outlined for the short
 * kinds, so weight separates them before the label is read.
 */
export function TypeCode(handle: Handle<TypeCode.Props>) {
	return () => {
		let { href, kind } = handle.props;
		let long = kind === "articles" || kind === "tutorials";
		let style = [
			hstack({ align: "center", justify: "center" }),
			monoLabel(),
			weight("bold"),
			raw({
				inlineSize: "3.75rem",
				blockSize: "1.375rem",
				boxSizing: "border-box",
				border: "1.5px solid var(--ui-neutral-fg-emphasis)",
				fontSize: "0.6875rem",
				textDecoration: "none",
				backgroundColor: long ? "var(--ui-neutral-fg-emphasis)" : "transparent",
				color: long ? "var(--ui-bg)" : "var(--ui-neutral-fg-emphasis)",
			}),
		];
		let code = KIND_CODES[kind] ?? kind.slice(0, 4).toUpperCase();
		if (href === undefined) {
			return (
				<span data-slot="plinth-type-code" mix={style}>
					{code}
				</span>
			);
		}
		return (
			<a
				href={href}
				data-slot="plinth-type-code"
				mix={[...style, hover(raw({ borderColor: "var(--ui-brand-fg)" })), focusRing()]}
			>
				{code}
			</a>
		);
	};
}

namespace IndexRow {
	export interface Props {
		post: DemoBlogPost;
		context: DemoBlogContext;
		/** `day` when a year heading above already says the year. @default "short" */
		dateStyle?: "day" | "short";
	}
}

/**
 * One post as a row of the index: date, type code, title and meta, on one line from
 * {@link WIDE_QUERY} and on two below it. A note opens in place behind a native disclosure.
 */
export function IndexRow(handle: Handle<IndexRow.Props>) {
	return () => {
		let { context, post } = handle.props;
		let layout = context.site.kinds[post.kind]?.layout ?? "article";
		if (layout === "note") {
			return (
				<li data-slot="plinth-row" data-kind={post.kind} mix={[raw({ borderBlockEnd: HAIRLINE })]}>
					<details
						mix={[
							open(raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })),
							when("&[open] [data-chevron]", raw({ rotate: "180deg" })),
						]}
					>
						<summary
							mix={[
								rowGrid(),
								listStyle("none"),
								cursor("pointer"),
								when("&::-webkit-details-marker", raw({ display: "none" })),
								hover(raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })),
								focusRing(),
							]}
						>
							<RowCells {...handle.props}>
								<span mix={[fg("neutral.emphasis"), weight("semibold")]}>{post.title}</span>
							</RowCells>
						</summary>
						<NotePanel post={post} context={context} />
					</details>
				</li>
			);
		}
		return (
			<li
				data-slot="plinth-row"
				data-kind={post.kind}
				mix={[
					rowGrid(),
					raw({ borderBlockEnd: HAIRLINE }),
					hover(raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })),
				]}
			>
				<RowCells {...handle.props}>
					<a href={context.href(post.path)} mix={[titleLink(), weight("semibold")]}>
						{post.title}
					</a>
					{layout === "term" ? (
						<span mix={[text("sm"), fg("neutral"), leading("snug")]}>{post.description}</span>
					) : null}
				</RowCells>
			</li>
		);
	};
}

/** The row's grid: two lines on a phone, four columns on one line from {@link WIDE_QUERY}. */
function rowGrid() {
	return raw({
		display: "grid",
		gridTemplateColumns: NARROW_COLUMNS,
		gridTemplateAreas: '"code title" "code info"',
		columnGap: "1rem",
		rowGap: "0.25rem",
		alignItems: "baseline",
		paddingBlock: "0.875rem",
		paddingInline: "0.5rem",
		[`@media ${WIDE_QUERY}`]: {
			gridTemplateColumns: WIDE_COLUMNS,
			gridTemplateAreas: '"date code title meta"',
			paddingBlock: "0.75rem",
		},
	});
}

namespace RowCells {
	export interface Props extends IndexRow.Props {
		/** The title cell's content: a link, or the note's title inside its summary. */
		children: RemixNode;
	}
}

/**
 * The cells every row shares. On a phone the date joins the meta under the title; from
 * {@link WIDE_QUERY} each takes its own column, so dates and codes align down the page.
 */
function RowCells(handle: Handle<RowCells.Props>) {
	return () => {
		let { children, context, dateStyle = "short", post } = handle.props;
		return (
			<>
				<span
					mix={[
						raw({ gridArea: "code", alignSelf: "start", paddingBlockStart: "0.125rem" }),
						hstack({ align: "center" }),
					]}
				>
					<TypeCode kind={post.kind} />
				</span>
				<span
					mix={[
						raw({ gridArea: "title", minInlineSize: 0, fontSize: "1.0625rem" }),
						vstack({ gap: 1, align: "start" }),
						leading("snug"),
					]}
				>
					{children}
				</span>
				<span
					mix={[
						raw({
							gridArea: "info",
							display: "flex",
							flexWrap: "wrap",
							columnGap: "0.75rem",
							rowGap: "0.25rem",
							alignItems: "baseline",
							[`@media ${WIDE_QUERY}`]: { display: "contents" },
						}),
					]}
				>
					<span
						mix={[
							monoLabel(),
							fg("neutral.muted"),
							raw({ [`@media ${WIDE_QUERY}`]: { gridArea: "date" } }),
						]}
					>
						<PostDate date={post.date} style={dateStyle} />
					</span>
					<span
						mix={[
							monoLabel(),
							fg("neutral.muted"),
							hstack({ gap: 2, align: "center" }),
							raw({ [`@media ${WIDE_QUERY}`]: { gridArea: "meta", justifySelf: "end" } }),
						]}
					>
						<RowMeta post={post} context={context} />
					</span>
				</span>
			</>
		);
	};
}

/** What a row's meta column says for its kind: minutes and series part, a link's host, a note's toggle. */
function RowMeta(handle: Handle<IndexRow.Props>) {
	return () => {
		let { context, post } = handle.props;
		let layout = context.site.kinds[post.kind]?.layout ?? "article";
		if (layout === "note") {
			return (
				<>
					<span>{post.minutes} min</span>
					<ChevronDownIcon
						size={16}
						aria-hidden="true"
						data-chevron=""
						mix={[raw({ transition: "rotate 150ms" })]}
					/>
				</>
			);
		}
		if (layout === "bookmark" && post.url !== undefined) {
			return (
				<a
					href={post.url}
					rel="noreferrer"
					mix={[
						hstack({ gap: 1, align: "center" }),
						fg("brand"),
						textDecoration("none"),
						focusRing(),
					]}
				>
					<ArrowUpRightIcon size={14} aria-hidden="true" />
					{linkHost(post.url)}
				</a>
			);
		}
		if (layout === "term") return <span>Definition</span>;
		return (
			<>
				{post.series !== undefined && post.part !== undefined ? (
					<span mix={[fg("brand")]}>
						Part {post.part}/{context.posts.filter((other) => other.series === post.series).length}
					</span>
				) : null}
				<span>{post.minutes} min</span>
			</>
		);
	};
}

namespace NotePanel {
	export interface Props {
		post: DemoBlogPost;
		context: DemoBlogContext;
	}
}

/** A note's body opened under its row, indented to the title column, with its permalink. */
function NotePanel(handle: Handle<NotePanel.Props>) {
	return () => {
		let { context, post } = handle.props;
		return (
			<div
				data-slot="plinth-note-panel"
				mix={[
					vstack({ gap: 3, align: "stretch" }),
					raw({
						paddingBlock: "0 1.25rem",
						paddingInline: "0.5rem",
						maxInlineSize: "46rem",
						[`@media ${WIDE_QUERY}`]: { paddingInlineStart: "calc(10.75rem + 2.5rem)" },
					}),
				]}
			>
				{post.body === null ? (
					<p mix={[m(0), fg("neutral")]}>{post.description}</p>
				) : (
					<PostBody document={post.body} preset="docs" />
				)}
				<a
					href={context.href(post.path)}
					mix={[
						monoLabel(),
						fg("brand"),
						textDecoration("none"),
						hover(textDecoration("underline")),
						focusRing(),
					]}
				>
					Permalink →
				</a>
			</div>
		);
	};
}

namespace IndexList {
	export interface Props {
		posts: DemoBlogPost[];
		context: DemoBlogContext;
		/**
		 * Rules the list under a heading per year with its count; off for a short list such as
		 * related posts.
		 * @default true
		 */
		years?: boolean;
	}
}

/** Posts as the index: rows in date order, ruled by year so a row needs only its day and month. */
export function IndexList(handle: Handle<IndexList.Props>) {
	return () => {
		let { context, posts, years = true } = handle.props;
		if (!years) {
			return (
				<ol
					data-slot="plinth-index"
					mix={[m(0), p(0), listStyle("none"), raw({ borderBlockStart: HAIRLINE })]}
				>
					{posts.map((post) => (
						<IndexRow key={post.path} post={post} context={context} />
					))}
				</ol>
			);
		}
		return (
			<div data-slot="plinth-index" mix={[vstack({ gap: 8, align: "stretch" })]}>
				{groupByYear(posts).map((group) => (
					<section key={group.year} aria-labelledby={`year-${group.year}`} data-slot="plinth-year">
						<h2
							id={`year-${group.year}`}
							mix={[
								m(0),
								hstack({ gap: 3, align: "baseline", justify: "between" }),
								raw({ borderBlockStart: HEAVY_RULE, paddingBlock: "0.5rem", fontSize: "1.75rem" }),
								leading(1),
								fg("neutral.emphasis"),
							]}
						>
							<span>{group.year}</span>
							<span
								mix={[
									monoLabel(),
									fg("neutral.muted"),
									weight("normal"),
									raw({ letterSpacing: "0.06em" }),
								]}
							>
								{group.posts.length} {group.posts.length === 1 ? "entry" : "entries"}
							</span>
						</h2>
						<ol mix={[m(0), p(0), listStyle("none")]}>
							{group.posts.map((post) => (
								<IndexRow key={post.path} post={post} context={context} dateStyle="day" />
							))}
						</ol>
					</section>
				))}
			</div>
		);
	};
}

namespace KindFilter {
	export interface Props {
		context: DemoBlogContext;
		/** The kind the list is narrowed to, `null` for everything. */
		current: string | null;
		/** How many posts each kind holds in the list being filtered. */
		counts: Array<{ kind: string; count: number }>;
		total: number;
		/** Builds the address of the same list narrowed to a kind, `null` for everything. */
		href: (kind: string | null) => string;
	}
}

/**
 * The kinds as a ruled bar of links, each with its code and count, the current one filled in
 * ink. It wraps on a phone, so every choice stays visible without a sideways scroll.
 */
export function KindFilter(handle: Handle<KindFilter.Props>) {
	return () => {
		let { context, counts, current, href, total } = handle.props;
		let options: Array<{ kind: string | null; label: string; count: number }> = [
			{ kind: null, label: "All", count: total },
			...counts.map((entry) => ({
				kind: entry.kind,
				label: context.site.kinds[entry.kind]?.label ?? entry.kind,
				count: entry.count,
			})),
		];
		return (
			<nav aria-label="Filter by type" data-slot="plinth-type-filter">
				<ul
					mix={[
						m(0),
						p(0),
						listStyle("none"),
						hstack({ gap: 0, align: "stretch" }),
						raw({ flexWrap: "wrap" }),
					]}
				>
					{options.map((option) => (
						<li
							key={option.kind ?? "all"}
							mix={[raw({ marginInlineEnd: "-2px", marginBlockEnd: "-2px" })]}
						>
							<a
								href={href(option.kind)}
								aria-current={option.kind === current ? "page" : undefined}
								mix={[
									hstack({ gap: 2, align: "baseline" }),
									raw({
										paddingInline: "0.875rem",
										paddingBlock: "0.5rem",
										border: "2px solid var(--ui-neutral-fg-emphasis)",
										textDecoration: "none",
									}),
									text("sm"),
									weight("semibold"),
									fg("neutral.emphasis"),
									hover(raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })),
									focusRing(),
									when(
										"&[aria-current]",
										raw({
											backgroundColor: "var(--ui-neutral-fg-emphasis)",
											color: "var(--ui-bg)",
										}),
									),
								]}
							>
								{option.label}
								<span
									mix={[font("mono"), raw({ fontSize: "0.75rem", opacity: 0.75 }), tabularNums()]}
								>
									{option.count}
								</span>
							</a>
						</li>
					))}
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

/** Numbered pages with Newer and Older either side, nothing at all for a single page. */
export function Pager(handle: Handle<Pager.Props>) {
	return () => {
		let { page, pageCount, pageHref } = handle.props;
		if (pageCount <= 1) return null;
		return (
			<Pagination
				aria-label="Index pages"
				data-slot="plinth-pager"
				mix={[raw({ paddingBlock: "2rem 0" })]}
			>
				<Pagination.List>
					{page > 1 ? (
						<Pagination.Item>
							<Pagination.Link href={pageHref(page - 1)} rel="prev" aria-label="Newer entries">
								<ArrowLeftIcon size={16} aria-hidden="true" />
							</Pagination.Link>
						</Pagination.Item>
					) : null}
					{pageWindow(page, pageCount).map((item) =>
						item.kind === "gap" ? (
							<Pagination.Item key={`gap-${item.after}`}>
								<Pagination.Link aria-disabled="true">…</Pagination.Link>
							</Pagination.Item>
						) : (
							<Pagination.Item key={item.page}>
								<Pagination.Link
									href={pageHref(item.page)}
									aria-current={item.page === page ? "page" : undefined}
								>
									{item.page}
								</Pagination.Link>
							</Pagination.Item>
						),
					)}
					{page < pageCount ? (
						<Pagination.Item>
							<Pagination.Link href={pageHref(page + 1)} rel="next" aria-label="Older entries">
								<ArrowRightIcon size={16} aria-hidden="true" />
							</Pagination.Link>
						</Pagination.Item>
					) : null}
				</Pagination.List>
			</Pagination>
		);
	};
}

namespace Module {
	export interface Props {
		title: string;
		/** The module's `data-slot`, for a page that points at it. */
		slot?: string;
		children: RemixNode;
	}
}

/** A side module: a heavy rule, a caps title and its list, the unit the index's rail is built of. */
export function Module(handle: Handle<Module.Props>) {
	return () => {
		let { children, slot, title } = handle.props;
		let id = `module-${title.toLowerCase().replaceAll(" ", "-")}`;
		return (
			<section
				aria-labelledby={id}
				data-slot={slot}
				mix={[
					vstack({ gap: 3, align: "stretch" }),
					raw({ borderBlockStart: HEAVY_RULE, paddingBlockStart: "0.75rem" }),
				]}
			>
				<h2
					id={id}
					mix={[
						m(0),
						raw({ fontSize: "0.9375rem", textTransform: "uppercase" }),
						tracking("0.04em"),
						fg("neutral.emphasis"),
					]}
				>
					{title}
				</h2>
				{children}
			</section>
		);
	};
}

namespace RailList {
	export interface Props {
		posts: DemoBlogPost[];
		context: DemoBlogContext;
		/** Numbers the entries, for a list whose order is the point, such as a series. */
		numbered?: boolean;
		/** The post being read, marked rather than linked. */
		current?: string;
	}
}

/** A module's list of posts: titles with their code, or numbered parts of a series. */
export function RailList(handle: Handle<RailList.Props>) {
	return () => {
		let { context, current, numbered = false, posts } = handle.props;
		return (
			<ol mix={[m(0), p(0), listStyle("none"), vstack({ gap: 0, align: "stretch" })]}>
				{posts.map((post, index) => (
					<li
						key={post.path}
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "2rem minmax(0, 1fr)",
								gap: "0.5rem",
								paddingBlock: "0.625rem",
								borderBlockEnd: HAIRLINE,
							}),
						]}
					>
						<span
							mix={[monoLabel(), fg("brand"), weight("bold"), raw({ paddingBlockStart: "0.2rem" })]}
						>
							{numbered ? String(index + 1).padStart(2, "0") : (KIND_CODES[post.kind] ?? "")}
						</span>
						{post.path === current ? (
							<span
								aria-current="page"
								mix={[weight("bold"), fg("neutral.emphasis"), leading("snug")]}
							>
								{post.title}
							</span>
						) : (
							<a
								href={context.href(post.path)}
								mix={[titleLink(), weight("medium"), leading("snug")]}
							>
								{post.title}
							</a>
						)}
					</li>
				))}
			</ol>
		);
	};
}

namespace TopicLinks {
	export interface Props {
		context: DemoBlogContext;
		tags: Array<{ tag: string; count: number }>;
	}
}

/** Topics as outlined chips with their counts, each to its topic's page. */
export function TopicLinks(handle: Handle<TopicLinks.Props>) {
	return () => {
		let { context, tags } = handle.props;
		return (
			<ul
				mix={[
					m(0),
					p(0),
					listStyle("none"),
					hstack({ gap: 2, align: "center" }),
					raw({ flexWrap: "wrap" }),
				]}
			>
				{tags.map((entry) => (
					<li key={entry.tag}>
						<a
							href={context.href(`tags/${entry.tag}`)}
							mix={[
								hstack({ gap: 2, align: "baseline" }),
								raw({
									paddingInline: "0.625rem",
									paddingBlock: "0.25rem",
									border: HAIRLINE,
									textDecoration: "none",
								}),
								text("sm"),
								fg("neutral.emphasis"),
								hover(raw({ borderColor: "var(--ui-neutral-fg-emphasis)" })),
								focusRing(),
							]}
						>
							{entry.tag}
							<span mix={[font("mono"), raw({ fontSize: "0.75rem" }), fg("neutral.muted")]}>
								{entry.count}
							</span>
						</a>
					</li>
				))}
			</ul>
		);
	};
}

namespace SubscribeBlock {
	export interface Props {
		context: DemoBlogContext;
	}
}

/** The newsletter in an outlined block, the one sign-up a page offers, at its end. */
export function SubscribeBlock(handle: Handle<SubscribeBlock.Props>) {
	return () => {
		let { context } = handle.props;
		return (
			<section
				aria-labelledby="plinth-subscribe"
				data-slot="plinth-subscribe-block"
				mix={[
					vstack({ gap: 4, align: "stretch" }),
					raw({ marginBlockStart: "3rem", padding: "1.5rem", border: HEAVY_RULE }),
				]}
			>
				<h2 id="plinth-subscribe" mix={[m(0), raw({ fontSize: "1.5rem" }), fg("neutral.emphasis")]}>
					Every other Sunday, in your inbox
				</h2>
				<p mix={[m(0), fg("neutral")]}>
					Everything published since the last letter, with a line on why it matters. Or follow the{" "}
					<a href={context.href(FEED_PAGE)} mix={[inlineLink()]}>
						RSS feed
					</a>
					.
				</p>
				<NewsletterForm action={context.href(SUBSCRIBE_PAGE)} />
			</section>
		);
	};
}
