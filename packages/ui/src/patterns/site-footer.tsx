/**
 * Site footer for marketing and product pages: a brand block, titled link columns that
 * never leave a short last row, optional newsletter and social slots, a legal row and a
 * full-width brand wordmark that closes the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { combine, raw } from "@sdxc/u/general";
import { container } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

import type { HeadingLevel } from "../components/heading-scope.js";
import type { LinkPrefetch } from "../utils/link-prefetch.js";

import {
	HeadingScope,
	readAmbientLevel,
	resolveHeadingLevel,
	TAG_BY_LEVEL,
} from "../components/heading-scope.js";
import { marketingContainer, marketingHairline } from "../styles/marketing.js";
import { prefetchAttribute } from "../utils/link-prefetch.js";

/** Container the footer's layout steps query: the full width of the footer host. */
const CONTAINER = "ui-site-footer";

/** Translucent rule between the footer's rows. */
const HAIRLINE = "var(--ui-marketing-hairline, color-mix(in oklch, CanvasText 8%, transparent))";

/** Accessible name {@link SiteFooter} gives its outline entry when `label` is omitted. */
const DEFAULT_LABEL = "Footer";

/** Where {@link SiteFooter} draws the newsletter when `newsletterPlacement` is omitted. */
const DEFAULT_NEWSLETTER_PLACEMENT: SiteFooter.NewsletterPlacement = "column";

/** Layout steps the link grid re-plans at, narrowest first after the phone base. */
const STEPS = ["md", "lg", "xl"] as const;

/**
 * Prop types for {@link SiteFooter}.
 */
export namespace SiteFooter {
	/**
	 * Where the newsletter slot sits: under the tagline in the brand block, or as a full
	 * band above the brand block and the columns.
	 */
	export type NewsletterPlacement = "column" | "band";

	/** One destination in a link column. */
	export interface Link {
		/** Visible link text. */
		label: RemixNode;
		/** Destination URL. */
		href: string;
	}

	/** A titled group of links; the title renders as a heading one level below the footer's. */
	export interface Column {
		/** Column heading, such as "Product". */
		title: RemixNode;
		/** Links listed under the title, in order. */
		links: Link[];
	}

	/**
	 * Props accepted by {@link SiteFooter}.
	 */
	export interface Props extends Omit<TagProps<"footer">, "children"> {
		/** The brand mark, usually a home link wrapping the logo. */
		brand?: RemixNode;
		/** One or two lines under the brand mark in the muted ink. */
		tagline?: RemixNode;
		/** Link columns; any count lays out without a short last row. */
		columns: Column[];
		/** A newsletter form the page supplies, placed by `newsletterPlacement`. */
		newsletter?: RemixNode;
		/** Defaults to {@link DEFAULT_NEWSLETTER_PLACEMENT}. */
		newsletterPlacement?: NewsletterPlacement;
		/**
		 * Icon links with an `aria-label` each. The footer sizes every direct child to a
		 * 1.25rem glyph inside a 44px hit area on a phone, 36px from the `md` container.
		 */
		social?: RemixNode;
		/** The bottom row: copyright and legal links, with `social` at its inline end. */
		legal?: RemixNode;
		/**
		 * A brand wordmark, usually an SVG, drawn full width in the brand ink as the last
		 * thing on the page and hidden from assistive technology.
		 */
		wordmark?: RemixNode;
		/** Visually hidden heading naming the footer in the outline. Defaults to {@link DEFAULT_LABEL}. */
		label?: RemixNode;
		/**
		 * Level of that hidden heading; column titles render one below it. Defaults to one
		 * below the ambient `HeadingScope`, so a footer on a bare page opens with `<h2>`.
		 */
		level?: HeadingLevel;
		/** Draws the hairline along the footer's top edge. Defaults to `true`. */
		ruled?: boolean;
		/**
		 * When the column links start loading their pages. Defaults to `"none"`; `"intent"`
		 * warms a destination as the visitor hovers or focuses it.
		 */
		prefetch?: LinkPrefetch;
	}

	/** Props accepted by the internal column renderer. */
	export interface ColumnProps {
		/** The column to render. */
		column: Column;
		/** Prefetch mode for the column's links. */
		prefetch?: LinkPrefetch;
	}
}

/**
 * Renders the page footer: a measured column holding an optional newsletter band, the
 * brand block beside or above the link columns, the legal row, then the wordmark. Column
 * counts per row derive from `columns.length` at every container step, so 3 or 5
 * columns never strand one alone on a row.
 *
 * @param handle Runtime handle carrying the host `<footer>`'s props.
 * @returns The render function producing the footer's markup.
 * @example
 * <SiteFooter
 * 	brand={<a href="/" aria-label="Keel home"><KeelLogo /></a>}
 * 	tagline={t("footer.tagline")}
 * 	columns={[{ title: t("footer.product"), links: [{ label: t("footer.pricing"), href: "/pricing" }] }]}
 * 	legal={<p>© 2026 Keel</p>}
 * />
 */
export function SiteFooter(handle: Handle<SiteFooter.Props>) {
	return () => {
		let {
			brand,
			columns,
			label,
			legal,
			level,
			mix,
			newsletter,
			newsletterPlacement,
			prefetch,
			ruled,
			social,
			tagline,
			wordmark,
			...rest
		} = handle.props;
		let resolvedLevel = level ?? (Math.min((readAmbientLevel(handle) ?? 1) + 1, 6) as HeadingLevel);
		let placement = newsletterPlacement ?? DEFAULT_NEWSLETTER_PLACEMENT;
		let columnNewsletter = placement === "column" ? newsletter : undefined;
		let bandNewsletter = placement === "band" ? newsletter : undefined;
		let hasBrandBlock = Boolean(brand || tagline || columnNewsletter);
		let LabelTag = TAG_BY_LEVEL[resolvedLevel];

		return (
			<footer
				{...rest}
				data-slot="site-footer"
				data-columns={columns.length}
				mix={[
					container(CONTAINER),
					raw({
						inlineSize: "100%",
						paddingBlockStart:
							"var(--ui-site-footer-space, clamp(3rem, 2.32rem + 2.91cqi, 4.5rem))",
					}),
					ruled === false ? [] : marketingHairline(),
					mix,
				]}
			>
				<LabelTag mix={[visuallyHidden()]}>{label ?? DEFAULT_LABEL}</LabelTag>
				<HeadingScope level={Math.min(resolvedLevel + 1, 6) as HeadingLevel}>
					<div mix={[marketingContainer(), raw({ display: "flow-root" })]}>
						{bandNewsletter ? (
							<div
								data-slot="site-footer-newsletter"
								data-placement="band"
								mix={[
									raw({
										paddingBlockEnd: "3rem",
										marginBlockEnd: "3rem",
										borderBlockEnd: `1px solid ${HAIRLINE}`,
									}),
								]}
							>
								{bandNewsletter}
							</div>
						) : null}

						<div data-slot="site-footer-main" mix={[mainGrid(columns.length, hasBrandBlock)]}>
							{hasBrandBlock ? (
								<div
									data-slot="site-footer-brand"
									mix={[
										raw({
											display: "flex",
											flexDirection: "column",
											alignItems: "flex-start",
											gap: "1rem",
											minInlineSize: "0",
										}),
									]}
								>
									{brand ? (
										<div
											data-slot="site-footer-mark"
											mix={[raw({ color: "var(--ui-neutral-fg-emphasis)" })]}
										>
											{brand}
										</div>
									) : null}
									{tagline ? (
										<p
											data-slot="site-footer-tagline"
											mix={[
												raw({
													margin: "0",
													maxInlineSize: "22rem",
													fontSize: "0.875rem",
													lineHeight: "1.5rem",
													color: "var(--ui-neutral-fg-muted)",
													textWrap: "pretty",
												}),
											]}
										>
											{tagline}
										</p>
									) : null}
									{columnNewsletter ? (
										<div
											data-slot="site-footer-newsletter"
											data-placement="column"
											mix={[
												raw({
													inlineSize: "100%",
													maxInlineSize: "24rem",
													marginBlockStart: "0.5rem",
												}),
											]}
										>
											{columnNewsletter}
										</div>
									) : null}
								</div>
							) : null}

							{columns.length > 0 ? (
								<div data-slot="site-footer-columns" mix={[linkGrid(columns.length)]}>
									{columns.map((column, index) => (
										<FooterColumn key={index} column={column} prefetch={prefetch} />
									))}
								</div>
							) : null}
						</div>

						{legal || social ? (
							<div data-slot="site-footer-bottom" mix={[bottomRow()]}>
								{legal ? (
									<div data-slot="site-footer-legal" mix={[legalRow()]}>
										{legal}
									</div>
								) : null}
								{social ? (
									<div data-slot="site-footer-social" mix={[socialRow()]}>
										{social}
									</div>
								) : null}
							</div>
						) : null}

						{wordmark ? (
							<div
								aria-hidden="true"
								data-slot="site-footer-wordmark"
								mix={[
									raw({
										display: "block",
										inlineSize: "100%",
										color: "var(--ui-brand-fg)",
										lineHeight: "0.8",
										marginBlockEnd: "-0.12em",
									}),
									when(
										"& > :is(svg, img)",
										raw({ display: "block", inlineSize: "100%", blockSize: "auto" }),
									),
								]}
							>
								{wordmark}
							</div>
						) : null}
					</div>
				</HeadingScope>
			</footer>
		);
	};
}

/**
 * One titled link column. The title is a heading at the scope's level, sized as a quiet
 * 0.875rem label so the outline stays sequential without a large type step.
 */
function FooterColumn(handle: Handle<SiteFooter.ColumnProps>) {
	return () => {
		let { column, prefetch } = handle.props;
		let linkPrefetch = prefetchAttribute(prefetch ?? "none");
		let Tag = TAG_BY_LEVEL[resolveHeadingLevel(handle)];

		return (
			<div data-slot="site-footer-column" mix={[raw({ minInlineSize: "0" })]}>
				<Tag
					data-slot="site-footer-column-title"
					mix={[
						raw({
							margin: "0 0 0.25rem",
							fontSize: "0.875rem",
							fontWeight: "600",
							lineHeight: "1.25rem",
							letterSpacing: "normal",
							color: "var(--ui-neutral-fg-emphasis)",
						}),
					]}
				>
					{column.title}
				</Tag>
				<ul mix={[raw({ listStyle: "none", margin: "0", padding: "0", columnGap: "1.5rem" })]}>
					{column.links.map((link, index) => (
						<li key={index} mix={[raw({ display: "flex", breakInside: "avoid" })]}>
							<a href={link.href} data-rmx-prefetch={linkPrefetch} mix={[footerLink()]}>
								{link.label}
							</a>
						</li>
					))}
				</ul>
			</div>
		);
	};
}

/**
 * A footer link: body ink at rest with no underline, emphasis ink on hover, and block
 * padding that makes a 44px row on a phone and a 36px row from the `md` container.
 */
function footerLink() {
	return combine([
		raw({
			paddingBlock: "0.75rem",
			fontSize: "0.875rem",
			lineHeight: "1.25rem",
			color: "var(--ui-neutral-fg)",
			textDecoration: "none",
			overflowWrap: "anywhere",
			transition: "color 150ms",
		}),
		when("&:hover", raw({ color: "var(--ui-neutral-fg-emphasis)" })),
		at("md", CONTAINER, raw({ paddingBlock: "0.5rem" })),
	]);
}

/**
 * How many link columns share a row at each step. A count that splits evenly keeps its
 * own row width; an odd count on a two-up row is the only remainder, and
 * {@link lastColumnSpan} widens that last column across the row.
 */
function columnPlan(count: number): Record<"base" | (typeof STEPS)[number], number> {
	return {
		base: count <= 2 ? count : 2,
		md: count <= 4 ? count : evenSplit(count, [3]),
		lg: count <= 5 ? count : evenSplit(count, [3]),
		xl: count <= 6 ? count : evenSplit(count, [4, 3]),
	};
}

/** The first candidate that divides `count`, else two per row. */
function evenSplit(count: number, candidates: number[]) {
	return candidates.find((candidate) => count % candidate === 0) ?? 2;
}

/**
 * The link columns' grid: tracks per step from {@link columnPlan}, with wider gaps once
 * the footer reaches the `md` container.
 */
function linkGrid(count: number) {
	let plan = columnPlan(count);

	return combine([
		raw({
			display: "grid",
			gridTemplateColumns: tracks(plan.base),
			columnGap: "1.5rem",
			rowGap: "2rem",
			minInlineSize: "0",
		}),
		lastColumnSpan(count, plan.base),
		...STEPS.map((step) =>
			at(step, CONTAINER, [
				raw({ gridTemplateColumns: tracks(plan[step]), columnGap: "2rem" }),
				lastColumnSpan(count, plan[step]),
			]),
		),
	]);
}

/** `count` equal tracks that shrink below their content instead of overflowing. */
function tracks(count: number) {
	return `repeat(${Math.max(count, 1)}, minmax(0, 1fr))`;
}

/**
 * Stretches the last column across its row when `perRow` leaves it alone there, and
 * flows its links in two columns so the row reads as full.
 */
function lastColumnSpan(count: number, perRow: number) {
	let spans = count % perRow !== 0;

	return when("& > :last-child", [
		raw({ gridColumn: spans ? "1 / -1" : "auto" }),
		when("& > ul", raw({ columns: spans ? "2" : "auto" })),
	]);
}

/**
 * The brand block and the link grid: stacked on phones and tablets, side by side once
 * the footer is wide enough for every column to keep a readable width beside the brand.
 */
function mainGrid(count: number, hasBrandBlock: boolean) {
	let isWide = count >= 5;

	return combine([
		raw({
			display: "grid",
			gridTemplateColumns: "minmax(0, 1fr)",
			rowGap: "3rem",
			columnGap: "4rem",
		}),
		hasBrandBlock
			? at(
					isWide ? "2xl" : "xl",
					CONTAINER,
					raw({
						gridTemplateColumns: isWide
							? "minmax(0, 1fr) minmax(0, 3fr)"
							: "minmax(0, 1fr) minmax(0, 2fr)",
					}),
				)
			: [],
	]);
}

/** The ruled bottom row: legal at the start, social at the inline end, wrapping on phones. */
function bottomRow() {
	return raw({
		display: "flex",
		flexWrap: "wrap",
		alignItems: "center",
		justifyContent: "space-between",
		gap: "1rem 2rem",
		marginBlockStart: "3rem",
		paddingBlock: "2rem",
		borderBlockStart: `1px solid ${HAIRLINE}`,
		fontSize: "0.875rem",
		lineHeight: "1.25rem",
		color: "var(--ui-neutral-fg-muted)",
	});
}

/**
 * The legal slot: its children flow in a wrapping row, and its links read in the body ink
 * without an underline, padded to a 44px target on a phone and 28px from `md`.
 */
function legalRow() {
	return combine([
		raw({
			display: "flex",
			flexWrap: "wrap",
			alignItems: "center",
			gap: "0 1.5rem",
			minInlineSize: "0",
		}),
		when("& > *", raw({ margin: "0" })),
		when(
			"& a",
			raw({
				display: "inline-block",
				paddingBlock: "0.75rem",
				color: "var(--ui-neutral-fg)",
				textDecoration: "none",
				transition: "color 150ms",
			}),
		),
		when("& a:hover", raw({ color: "var(--ui-neutral-fg-emphasis)" })),
		at("md", CONTAINER, when("& a", raw({ paddingBlock: "0.25rem" }))),
	]);
}

/**
 * The social slot: each direct child becomes a centered hit area (44px on a phone, 36px
 * from `md`) around a 1.25rem glyph, with negative inline margins so the outer glyphs line
 * up with the content edges.
 */
function socialRow() {
	return combine([
		raw({ display: "flex", flexWrap: "wrap", alignItems: "center", marginInline: "-0.75rem" }),
		when(
			"& > *",
			raw({
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				inlineSize: "2.75rem",
				blockSize: "2.75rem",
				color: "var(--ui-neutral-fg)",
				textDecoration: "none",
				transition: "color 150ms",
			}),
		),
		when("& > *:hover", raw({ color: "var(--ui-neutral-fg-emphasis)" })),
		when("& > * > :is(svg, img)", raw({ inlineSize: "1.25rem", blockSize: "1.25rem" })),
		at("md", CONTAINER, [
			raw({ marginInline: "-0.5rem" }),
			when("& > *", raw({ inlineSize: "2.25rem", blockSize: "2.25rem" })),
		]),
	]);
}
