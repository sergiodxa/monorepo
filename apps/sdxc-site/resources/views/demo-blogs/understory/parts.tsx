/**
 * The pieces Understory's pages are grown from: a card per post whose size and tint follow its
 * kind, the grid that packs them, the filter bar whose state is the address, page intros and
 * the pager. Each kind owns one muted hue, always paired with a text label and a shape.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { ArrowLeftIcon, ArrowRightIcon, ArrowUpRightIcon, SproutIcon } from "@sdxc/icons";
import { iife } from "@sdxc/iife";
import { fg } from "@sdxc/u/color";
import { listStyle, raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { media, motionSafe } from "@sdxc/u/responsive";
import { m, p } from "@sdxc/u/size";
import { focusVisible, hover, when } from "@sdxc/u/state";
import { balance, leading, pretty, text, tracking, weight } from "@sdxc/u/typography";
import { LabelChip } from "@sdxc/ui";

import type { DemoBlogPost } from "~/app/services/demo-blogs";
import type { DemoBlogContext } from "~/resources/views/demo-blogs";

import { linkHost, PostBody, PostDate, formatPostDate } from "~/resources/views/demo-blogs/parts";

/** The width from which cards pack into columns and articles take two of them. */
export const WIDE_QUERY = "(min-width: 44rem)";

/**
 * One muted hue per kind, at OKLCH hue degrees: moss essays, slate tutorials, ochre notes,
 * terracotta links and plum terms. A kind missing here falls back to the moss.
 */
const KIND_HUES: Record<string, number> = {
	articles: 140,
	tutorials: 245,
	notes: 80,
	links: 35,
	glossary: 315,
};

/** The hue a kind's chip and card are tinted with. */
export function kindHue(kind: string): number {
	return KIND_HUES[kind] ?? 140;
}

/**
 * A series part's own title, without the series name it opens with, capitalised to stand alone.
 *
 * @example partTitle("Sync from scratch: merging changes", "Sync from scratch") // "Merging changes"
 */
export function partTitle(title: string, series: string | undefined): string {
	let own =
		series !== undefined && title.startsWith(`${series}: `)
			? title.slice(series.length + 2)
			: title;
	return own.charAt(0).toUpperCase() + own.slice(1);
}

/** One post's kind as its chip reads ("Essay"), the kind's key when the blog lacks it. */
export function kindLabel(context: DemoBlogContext, post: DemoBlogPost): string {
	return context.site.kinds[post.kind]?.singular ?? post.kind;
}

/**
 * A soft card tinted toward a hue: near-white paper in light mode and a deep shade in dark,
 * both fixed in lightness so text on any hue keeps its contrast.
 */
export function tinted(hue: number) {
	return raw({
		position: "relative",
		backgroundColor: `light-dark(oklch(0.988 0.012 ${hue}), oklch(0.228 0.018 ${hue}))`,
		border: `1px solid light-dark(oklch(0.9 0.032 ${hue}), oklch(0.34 0.032 ${hue}))`,
		borderRadius: "var(--ui-radius-lg)",
		boxShadow: "0 1px 2px oklch(0.35 0.03 88 / 0.06), 0 10px 28px -16px oklch(0.35 0.03 88 / 0.22)",
	});
}

/** The labels' humanist sans, small and tracked, for eyebrows and meta lines. */
export function labelFace() {
	return [
		raw({ fontFamily: "var(--understory-label-font, var(--ui-font-sans))" }),
		text("xs"),
		tracking("0.04em"),
	];
}

/** A link reading as part of the text until it is pointed at, then underlined in moss. */
export function quietLink() {
	return [
		raw({ textDecoration: "none", color: "inherit" }),
		hover(
			raw({
				textDecoration: "underline",
				textDecorationColor: "var(--ui-brand-fg)",
				textUnderlineOffset: "0.2em",
			}),
		),
		focusVisible(raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" })),
	];
}

/**
 * Makes a title link cover its whole card, so every pixel of a card follows it while the
 * markup keeps one link per card.
 */
function stretchedLink() {
	return [
		...quietLink(),
		when(
			"&::after",
			raw({ content: '""', position: "absolute", inset: 0, borderRadius: "inherit" }),
		),
	];
}

namespace KindChip {
	export interface Props {
		context: DemoBlogContext;
		post: DemoBlogPost;
	}
}

/** The kind's label as a chip in the kind's hue; the label carries the meaning, the hue echoes it. */
export function KindChip(handle: Handle<KindChip.Props>) {
	return () => {
		let { context, post } = handle.props;
		return (
			<LabelChip hue={kindHue(post.kind)} data-slot="understory-kind">
				{kindLabel(context, post)}
			</LabelChip>
		);
	};
}

namespace TendedBadge {
	export interface Props {
		/** The `updated` date, `YYYY-MM-DD`. */
		date: string;
	}
}

/** "Tended <date>", the garden's freshness signal on a post updated after it went out. */
export function TendedBadge(handle: Handle<TendedBadge.Props>) {
	return () => (
		<span
			data-slot="understory-tended"
			mix={[
				hstack({ gap: 1, align: "center" }),
				...labelFace(),
				raw({
					paddingInline: "0.5rem",
					blockSize: "1.25rem",
					borderRadius: "999px",
					backgroundColor: "var(--ui-brand-bg-tint)",
					color: "var(--ui-brand-fg)",
					border: "1px solid var(--ui-brand-border)",
					whiteSpace: "nowrap",
				}),
				weight("medium"),
			]}
		>
			<SproutIcon size={12} aria-hidden="true" />
			Tended <PostDate date={handle.props.date} style="day" />
		</span>
	);
}

/** A number from a slug, stable across requests, which places an essay card's leaves. */
function seed(slug: string): number {
	let value = 0;
	for (let char of slug) value = (value * 31 + char.charCodeAt(0)) % 9973;
	return value;
}

namespace Canopy {
	export interface Props {
		hue: number;
		slug: string;
	}
}

/**
 * The illustration band on top of a large card: soft overlapping leaves of the kind's hue,
 * placed from the slug so each essay keeps its own canopy. Decorative only.
 */
export function Canopy(handle: Handle<Canopy.Props>) {
	return () => {
		let { hue, slug } = handle.props;
		let n = seed(slug);
		let spot = (shift: number, size: number, lightness: string) =>
			`radial-gradient(${size}rem ${size * 0.7}rem at ${(n * shift) % 100}% ${(n * (shift + 3)) % 100}%, light-dark(oklch(${lightness} 0.06 ${hue}), oklch(0.36 0.05 ${hue})) 0 60%, transparent 62%)`;
		return (
			<div
				aria-hidden="true"
				data-slot="understory-canopy"
				mix={[
					raw({
						flex: "1 1 auto",
						minBlockSize: "5.5rem",
						borderRadius: "calc(var(--ui-radius-lg) - 0.375rem)",
						backgroundColor: `light-dark(oklch(0.94 0.035 ${hue}), oklch(0.29 0.035 ${hue}))`,
						backgroundImage: [
							spot(7, 5, "0.86"),
							spot(13, 3.5, "0.82"),
							spot(17, 6, "0.89"),
							spot(23, 2.5, "0.78"),
						].join(", "),
					}),
				]}
			/>
		);
	};
}

namespace GardenCard {
	export interface Props {
		context: DemoBlogContext;
		post: DemoBlogPost;
		/** Lets a large card take two columns of the grid it sits in. @default true */
		span?: boolean;
	}
}

/**
 * One post as a card shaped by its kind: an essay or tutorial large with its canopy and lead,
 * a note in full, a link naming where it goes, a term as its definition. Each card links once.
 */
export function GardenCard(handle: Handle<GardenCard.Props>) {
	return () => {
		let { context, post, span = true } = handle.props;
		let layout = context.site.kinds[post.kind]?.layout ?? "article";
		let hue = kindHue(post.kind);
		let large = layout === "article";
		return (
			<article
				data-slot={`understory-card-${layout}`}
				mix={[
					tinted(hue),
					vstack({ gap: 3, align: "stretch" }),
					p(large ? 4 : 5),
					raw({ minInlineSize: 0 }),
					large && span ? media(WIDE_QUERY, raw({ gridColumn: "span 2" })) : [],
					layout === "term" ? raw({ alignSelf: "start" }) : [],
					motionSafe(raw({ transition: "transform 160ms ease, box-shadow 160ms ease" })),
					layout === "note"
						? []
						: media("(hover: hover)", hover(raw({ transform: "translateY(-2px)" }))),
				]}
			>
				{large ? <Canopy hue={hue} slug={post.slug} /> : null}
				<CardMeta context={context} post={post} />
				{iife(() => {
					if (layout === "note") return <NoteCardBody context={context} post={post} />;
					if (layout === "bookmark") return <LinkCardBody context={context} post={post} />;
					if (layout === "term") return <TermCardBody context={context} post={post} />;
					return <ArticleCardBody context={context} post={post} />;
				})}
			</article>
		);
	};
}

/** The chip, the date and the tended badge across the top of a card. */
function CardMeta(handle: Handle<KindChip.Props>) {
	return () => {
		let { context, post } = handle.props;
		return (
			<p
				mix={[
					m(0),
					hstack({ gap: 2, align: "center" }),
					raw({ flexWrap: "wrap", position: "relative", zIndex: 1 }),
					...labelFace(),
					fg("neutral.muted"),
				]}
			>
				<KindChip context={context} post={post} />
				<PostDate date={post.date} />
				{post.updated !== undefined ? <TendedBadge date={post.updated} /> : null}
			</p>
		);
	};
}

/** An essay's or tutorial's title, lead and reading time. */
function ArticleCardBody(handle: Handle<KindChip.Props>) {
	return () => {
		let { context, post } = handle.props;
		return (
			<>
				<h3 mix={[m(0), text("2xl"), leading("tight"), balance(), fg("neutral.emphasis")]}>
					<a href={context.href(post.path)} mix={[stretchedLink()]}>
						{post.title}
					</a>
				</h3>
				<p
					mix={[
						m(0),
						fg("neutral"),
						pretty(),
						raw({ fontFamily: "var(--demo-blog-reading-font)" }),
					]}
				>
					{post.description}
				</p>
				<p mix={[m(0), raw({ marginBlockStart: "auto" }), ...labelFace(), fg("neutral.muted")]}>
					{post.minutes} min read
					{post.series !== undefined ? ` · Part ${post.part} of ${post.series}` : ""}
					{post.tags[0] !== undefined ? ` · ${post.tags[0]}` : ""}
				</p>
			</>
		);
	};
}

/** A note in full, its title small above the body, since a note is read where it is listed. */
function NoteCardBody(handle: Handle<KindChip.Props>) {
	return () => {
		let { context, post } = handle.props;
		return (
			<>
				<h3 mix={[m(0), text("lg"), leading("snug"), fg("neutral.emphasis")]}>
					<a href={context.href(post.path)} mix={[quietLink()]}>
						{post.title}
					</a>
				</h3>
				{post.body !== null ? (
					<PostBody document={post.body} preset="chat" />
				) : (
					<p mix={[m(0)]}>{post.description}</p>
				)}
			</>
		);
	};
}

/** A link's destination title and host, then the comment on why it is worth the visit. */
function LinkCardBody(handle: Handle<KindChip.Props>) {
	return () => {
		let { context, post } = handle.props;
		let url = post.url ?? context.href(post.path);
		let cut = post.title.lastIndexOf(" ") + 1;
		let head = post.title.slice(0, cut);
		let last = post.title.slice(cut);
		return (
			<>
				<h3 mix={[m(0), text("lg"), leading("snug"), fg("neutral.emphasis")]}>
					<a href={url} rel="noreferrer" mix={[quietLink()]}>
						{head}
						<span mix={[raw({ whiteSpace: "nowrap" })]}>
							{last}
							<ArrowUpRightIcon
								size={16}
								aria-hidden="true"
								mix={[
									raw({
										display: "inline-block",
										marginInlineStart: "0.25rem",
										verticalAlign: "-0.15em",
									}),
								]}
							/>
						</span>
					</a>
				</h3>
				{post.url !== undefined ? (
					<p mix={[m(0), ...labelFace(), fg("neutral.muted")]}>{linkHost(post.url)}</p>
				) : null}
				<p mix={[m(0), pretty(), raw({ fontFamily: "var(--demo-blog-reading-font)" })]}>
					{post.description}
				</p>
				<a
					href={context.href(post.path)}
					mix={[...quietLink(), ...labelFace(), fg("brand"), raw({ marginBlockStart: "auto" })]}
				>
					Why I keep it
				</a>
			</>
		);
	};
}

/** A term as a definition: the word in small capitals and its one-sentence meaning. */
function TermCardBody(handle: Handle<KindChip.Props>) {
	return () => {
		let { context, post } = handle.props;
		return (
			<dl mix={[m(0), vstack({ gap: 1, align: "stretch" })]}>
				<dt
					mix={[
						text("lg"),
						weight("semibold"),
						fg("neutral.emphasis"),
						raw({ fontFamily: "var(--demo-blog-heading-font)" }),
					]}
				>
					<a
						href={context.href(post.path)}
						mix={[stretchedLink(), raw({ fontVariantCaps: "small-caps", letterSpacing: "0.03em" })]}
					>
						{post.title}
					</a>
				</dt>
				<dd mix={[m(0), text("sm"), fg("neutral"), pretty()]}>{post.description}</dd>
			</dl>
		);
	};
}

namespace CardGrid {
	export interface Props {
		children: RemixNode;
		/** Names the grid for a screenshot or a test. */
		slot?: string;
		/** The narrowest a column gets before the grid drops one. @default "17rem" */
		min?: string;
	}
}

/**
 * The grid cards grow in: one column on a phone, then as many as fit, packed densely so a
 * small card fills the hole a two-column card leaves. The markup keeps the feed's date order.
 */
export function CardGrid(handle: Handle<CardGrid.Props>) {
	return () => {
		let { children, min = "17rem", slot } = handle.props;
		return (
			<div
				data-slot={slot}
				mix={[
					raw({ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 1fr)" }),
					media(
						WIDE_QUERY,
						raw({
							gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}, 100%), 1fr))`,
							gridAutoFlow: "row dense",
							gap: "1.25rem",
						}),
					),
				]}
			>
				{children}
			</div>
		);
	};
}

namespace Wrap {
	export interface Props {
		children: RemixNode;
		/** The widest the content runs. @default "76rem" */
		max?: string;
	}
}

/** The page's centred column with the side gutters every page keeps. */
export function Wrap(handle: Handle<Wrap.Props>) {
	return () => (
		<div
			mix={[
				raw({
					inlineSize: "100%",
					maxInlineSize: handle.props.max ?? "76rem",
					marginInline: "auto",
					paddingInline: "clamp(1rem, 4vw, 2rem)",
					paddingBlock: "2rem 4rem",
					boxSizing: "border-box",
				}),
				vstack({ gap: 8, align: "stretch" }),
			]}
		>
			{handle.props.children}
		</div>
	);
}

namespace PageIntro {
	export interface Props {
		/** The small line above the title ("Topic"). */
		eyebrow?: RemixNode;
		title: RemixNode;
		lead?: RemixNode;
		children?: RemixNode;
	}
}

/** A page's title block: eyebrow, serif title, a lead in the reading face, then any extras. */
export function PageIntro(handle: Handle<PageIntro.Props>) {
	return () => {
		let { children, eyebrow, lead, title } = handle.props;
		return (
			<header mix={[vstack({ gap: 3, align: "start" }), raw({ maxInlineSize: "46rem" })]}>
				{eyebrow !== undefined ? (
					<p
						mix={[
							m(0),
							...labelFace(),
							fg("brand"),
							weight("semibold"),
							raw({ textTransform: "uppercase" }),
						]}
					>
						{eyebrow}
					</p>
				) : null}
				<h1
					mix={[
						m(0),
						raw({ fontSize: "clamp(2rem, 1.4rem + 2.4vw, 3rem)", lineHeight: 1.1 }),
						balance(),
						fg("neutral.emphasis"),
					]}
				>
					{title}
				</h1>
				{lead !== undefined ? (
					<p
						mix={[
							m(0),
							text("lg"),
							pretty(),
							fg("neutral"),
							raw({ fontFamily: "var(--demo-blog-reading-font)" }),
						]}
					>
						{lead}
					</p>
				) : null}
				{children}
			</header>
		);
	};
}

namespace SectionTitle {
	export interface Props {
		children: RemixNode;
		/** A short line after the title, muted. */
		note?: RemixNode;
		id?: string;
	}
}

/** A section's heading inside a page, with a hairline running out to the edge. */
export function SectionTitle(handle: Handle<SectionTitle.Props>) {
	return () => {
		let { children, id, note } = handle.props;
		return (
			<div mix={[hstack({ gap: 3, align: "baseline" }), raw({ flexWrap: "wrap" })]}>
				<h2 id={id} mix={[m(0), text("xl"), fg("neutral.emphasis")]}>
					{children}
				</h2>
				{note !== undefined ? (
					<span mix={[...labelFace(), fg("neutral.muted")]}>{note}</span>
				) : null}
				<span
					aria-hidden="true"
					mix={[raw({ flex: "1 1 4rem", borderBlockStart: "1px dashed var(--ui-neutral-border)" })]}
				/>
			</div>
		);
	};
}

export namespace FilterChips {
	export interface Chip {
		label: string;
		href: string;
		count?: number;
		current: boolean;
		/** The kind's hue, for its dot; none for "Everything". */
		hue?: number;
	}

	export interface Props {
		label: string;
		chips: Chip[];
		slot?: string;
	}
}

/**
 * A row of filter links, the current one filled. Each is a plain link to an address, so the
 * filter lives in the URL and a filtered view can be shared or bookmarked.
 */
export function FilterChips(handle: Handle<FilterChips.Props>) {
	return () => {
		let { chips, label, slot } = handle.props;
		return (
			<nav aria-label={label} data-slot={slot}>
				<ul
					mix={[
						m(0),
						p(0),
						listStyle("none"),
						hstack({ gap: 2, align: "center" }),
						raw({ flexWrap: "wrap" }),
					]}
				>
					{chips.map((chip) => (
						<li>
							<a
								href={chip.href}
								aria-current={chip.current ? "page" : undefined}
								mix={[
									hstack({ gap: 2, align: "center" }),
									raw({
										minBlockSize: "2.25rem",
										paddingInline: "0.875rem",
										borderRadius: "999px",
										border: "1px solid var(--ui-neutral-border)",
										backgroundColor: "var(--ui-surface-raised, var(--ui-bg))",
										textDecoration: "none",
										fontFamily: "var(--understory-label-font, var(--ui-font-sans))",
										fontSize: "0.875rem",
									}),
									fg("neutral.emphasis"),
									hover(raw({ borderColor: "var(--ui-neutral-border-hover)" })),
									focusVisible(
										raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
									),
									when(
										'&[aria-current="page"]',
										raw({
											backgroundColor: "var(--ui-brand-bg-solid)",
											borderColor: "var(--ui-brand-bg-solid)",
											color: "var(--ui-brand-fg-on-solid, white)",
										}),
									),
								]}
							>
								{chip.hue !== undefined ? (
									<span
										aria-hidden="true"
										mix={[
											raw({
												inlineSize: "0.5rem",
												blockSize: "0.5rem",
												borderRadius: "999px",
												backgroundColor: `oklch(0.62 0.1 ${chip.hue})`,
											}),
										]}
									/>
								) : null}
								{chip.label}
								{chip.count !== undefined ? (
									<span mix={[raw({ opacity: 0.7, fontVariantNumeric: "tabular-nums" })]}>
										{chip.count}
									</span>
								) : null}
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

/** "Newer" and "Older" around the page's place, or nothing for a feed that fits one page. */
export function Pager(handle: Handle<Pager.Props>) {
	return () => {
		let { page, pageCount, pageHref } = handle.props;
		if (pageCount <= 1) return null;
		return (
			<nav
				aria-label="Pages"
				data-slot="understory-pager"
				mix={[hstack({ gap: 4, align: "center", justify: "between" })]}
			>
				{page > 1 ? (
					<a href={pageHref(page - 1)} rel="prev" mix={[pagerLink()]}>
						<ArrowLeftIcon size={16} aria-hidden="true" />
						Newer
					</a>
				) : (
					<span />
				)}
				<span mix={[...labelFace(), fg("neutral.muted")]}>
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

/** A pager link, a padded pill with its arrow. */
function pagerLink() {
	return [
		hstack({ gap: 2, align: "center" }),
		raw({
			minBlockSize: "2.5rem",
			paddingInline: "1rem",
			borderRadius: "999px",
			border: "1px solid var(--ui-neutral-border)",
			textDecoration: "none",
		}),
		fg("neutral.emphasis"),
		weight("medium"),
		hover(raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })),
		focusVisible(raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" })),
	];
}

namespace PostRow {
	export interface Props {
		context: DemoBlogContext;
		post: DemoBlogPost;
	}
}

/** One post on a single line of a list: date, kind chip, title and the tended badge. */
export function PostRow(handle: Handle<PostRow.Props>) {
	return () => {
		let { context, post } = handle.props;
		return (
			<li
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "5.5rem minmax(0, 1fr)",
						gap: "0.25rem 1rem",
						alignItems: "baseline",
						paddingBlock: "0.75rem",
						borderBlockEnd: "1px dashed var(--ui-neutral-border)",
					}),
				]}
			>
				<span
					mix={[...labelFace(), fg("neutral.muted"), raw({ fontVariantNumeric: "tabular-nums" })]}
				>
					<time datetime={post.date}>{formatPostDate(post.date, "day")}</time>
				</span>
				<span mix={[hstack({ gap: 2, align: "center" }), raw({ flexWrap: "wrap" })]}>
					<KindChip context={context} post={post} />
					<a
						href={context.href(post.path)}
						mix={[
							quietLink(),
							fg("neutral.emphasis"),
							text("lg"),
							raw({ fontFamily: "var(--demo-blog-heading-font)" }),
						]}
					>
						{post.title}
					</a>
					{post.updated !== undefined ? <TendedBadge date={post.updated} /> : null}
				</span>
			</li>
		);
	};
}

namespace PostRows {
	export interface Props {
		context: DemoBlogContext;
		posts: DemoBlogPost[];
	}
}

/** Posts as a ruled list of {@link PostRow}s, for pages that index rather than display. */
export function PostRows(handle: Handle<PostRows.Props>) {
	return () => {
		let { context, posts } = handle.props;
		return (
			<ul mix={[m(0), p(0), listStyle("none")]}>
				{posts.map((post) => (
					<PostRow context={context} post={post} />
				))}
			</ul>
		);
	};
}
