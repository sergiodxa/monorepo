/**
 * A "what's new" strip: recent releases as dated entries on one continuous hairline, each
 * marked by a dot on the rule. It shows a product's shipping cadence in a single row, and
 * on a phone the row scrolls sideways inside itself, one entry per snap.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { fg, outline } from "@sdxc/u/color";
import { combine, raw } from "@sdxc/u/general";
import { container } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { focusVisible, when } from "@sdxc/u/state";
import { font, lineClamp, pretty, weight } from "@sdxc/u/typography";

import { Heading } from "../components/heading.js";

/** Container the strip queries to pick its column count. */
const STRIP_CONTAINER = "ui-changelog-strip";

/** Translucent ink the rule draws with. */
const HAIRLINE = "var(--ui-marketing-hairline, color-mix(in oklch, CanvasText 8%, transparent))";

/** Room above the row for the dots, which rise 3px over the rule. */
const DOT_ROOM = "4px";

/**
 * Prop types for {@link ChangelogStrip} and its entries.
 */
export namespace ChangelogStrip {
	/**
	 * Column count at each container step; a missing step keeps the one below it, and a row
	 * with no count yet scrolls sideways.
	 */
	export interface ColumnPlan {
		/** Columns at every width, for a strip too short to scroll. */
		base?: number;
		/** Columns from the `md` container. */
		md?: number;
		/** Columns from the `lg` container. */
		lg?: number;
		/** Columns from the `xl` container. */
		xl?: number;
	}

	/**
	 * Props accepted by {@link ChangelogStrip}.
	 */
	export interface Props extends Omit<TagProps<"div">, "title"> {
		/** Optional heading over the row, at the level of the surrounding heading scope. */
		title?: RemixNode;
		/** Optional link beside the title, such as "View all →". */
		action?: RemixNode;
		/** Accessible name for the list when there is no visible title. */
		"aria-label"?: string;
		/** Two or more {@link ChangelogStrip.Entry} children, newest first. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link ChangelogStrip.Entry}.
	 */
	export interface EntryProps extends Omit<TagProps<"li">, "title"> {
		/** Machine-readable release date (`YYYY-MM-DD`), written to `<time dateTime>`. */
		dateTime: string;
		/** Date as the reader sees it, such as "Oct 28, 2026". */
		date: RemixNode;
		/** Release title. */
		title: RemixNode;
		/** Release page; when set, the whole entry is one link. */
		href?: string;
		/** Summary, clamped to two lines. */
		children?: RemixNode;
	}
}

/**
 * Counts the elements among the strip's children, flattening mapped arrays, so the column
 * plan follows the number of entries a page actually renders.
 *
 * @param children The strip's `children` value.
 * @returns How many entries the strip holds.
 */
function countEntries(children: unknown): number {
	if (Array.isArray(children)) {
		return children.reduce<number>((total, child) => total + countEntries(child), 0);
	}
	return typeof children === "object" && children !== null ? 1 : 0;
}

/**
 * Columns an odd or even count takes from the `md` container: pairs when even, threes when
 * a multiple of three, and none (the row keeps scrolling) when either would orphan one.
 *
 * @param count How many entries the strip holds.
 * @returns The `md` column count, if any.
 */
function mdColumns(count: number): number | undefined {
	if (count % 2 === 0) return 2;
	if (count % 3 === 0) return 3;
	return undefined;
}

/**
 * Picks the columns for each container step so no row ends with a single orphaned entry:
 * an even count pairs up at `md`, four or three across at `lg`, and a count no grid divides
 * cleanly (five) keeps scrolling until five fit across at `xl`.
 *
 * @param count How many entries the strip holds.
 * @returns The columns to apply at each step.
 */
function changelogColumns(count: number): ChangelogStrip.ColumnPlan {
	if (count <= 1) return { base: 1 };
	if (count <= 3) return { md: count };
	if (count === 5) return { xl: 5 };

	let md = mdColumns(count);
	if (count % 4 === 0) return { md, lg: 4 };
	if (count % 3 === 0) return { md, lg: 3 };
	if (count % 4 !== 1) return { md, lg: 4 };
	if (count % 3 !== 1) return { md, lg: 3 };
	return { md };
}

/**
 * Turns the scrolling row into a grid of `columns` equal tracks, with the same rule line
 * running unbroken across each row.
 */
function gridAt(step: "md" | "lg" | "xl", columns: number | undefined) {
	if (!columns) return [];
	return at(step, STRIP_CONTAINER, raw(gridStyles(columns)));
}

/**
 * Grid declarations for `columns` equal tracks, replacing the scrolling row's flex,
 * overflow and snapping.
 */
function gridStyles(columns: number) {
	return {
		display: "grid",
		gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
		rowGap: "2.5rem",
		overflowX: "visible",
		scrollSnapType: "none",
	} as const;
}

/**
 * Renders recent releases as an ordered list on one hairline. The column count comes from
 * the entry count (see {@link changelogColumns}); below the first grid step the list is a
 * snapping sideways row of ~80% wide entries that scrolls inside its own box.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the strip.
 * @example
 * <ChangelogStrip title={t("changelog.title")} action={<a href="/changelog">{t("changelog.all")}</a>}>
 * 	<ChangelogStrip.Entry dateTime="2026-10-28" date="Oct 28" title={t("cl.status")} href="/changelog/status">
 * 		{t("cl.status.body")}
 * 	</ChangelogStrip.Entry>
 * </ChangelogStrip>
 */
export function ChangelogStrip(handle: Handle<ChangelogStrip.Props>) {
	return () => {
		let { action, "aria-label": ariaLabel, children, mix, title, ...rest } = handle.props;
		let plan = changelogColumns(countEntries(children));
		let header =
			title || action ? (
				<div
					data-slot="changelog-strip-header"
					mix={[
						raw({
							display: "flex",
							flexWrap: "wrap",
							alignItems: "baseline",
							justifyContent: "space-between",
							gap: "0.5rem 1.5rem",
							marginBlockEnd: "2rem",
						}),
					]}
				>
					{title ? <Heading>{title}</Heading> : <span />}
					{action ? <div data-slot="changelog-strip-action">{action}</div> : null}
				</div>
			) : null;

		return (
			<div
				{...rest}
				data-slot="changelog-strip"
				mix={[container(STRIP_CONTAINER), raw({ minInlineSize: "0" }), mix]}
			>
				{header}
				<ol
					aria-label={ariaLabel}
					data-slot="changelog-strip-list"
					mix={[
						raw({
							display: "flex",
							margin: "0",
							padding: "0",
							paddingBlockStart: DOT_ROOM,
							marginBlockStart: `-${DOT_ROOM}`,
							listStyle: "none",
							overflowX: "auto",
							overscrollBehaviorInline: "contain",
							scrollSnapType: "x mandatory",
							scrollbarWidth: "thin",
							...(plan.base ? gridStyles(plan.base) : {}),
						}),
						gridAt("md", plan.md),
						gridAt("lg", plan.lg),
						gridAt("xl", plan.xl),
					]}
				>
					{children}
				</ol>
			</div>
		);
	};
}

/**
 * One release: a dot on the rule, the date in mono, the title, and a two-line summary.
 * With `href` the whole entry is a single link whose focus ring sits inside the entry,
 * so the scrolling row never clips it.
 *
 * @param handle Runtime handle carrying the `<li>`'s props.
 * @returns The render function producing the entry.
 */
ChangelogStrip.Entry = function ChangelogStripEntry(handle: Handle<ChangelogStrip.EntryProps>) {
	return () => {
		let { children, date, dateTime, href, mix, title, ...rest } = handle.props;
		let body = (
			<>
				<time
					dateTime={dateTime}
					mix={[
						font("mono"),
						raw({ display: "block", fontSize: "0.75rem", lineHeight: "1rem" }),
						fg("neutral.muted"),
					]}
				>
					{date}
				</time>
				<span
					data-slot="changelog-strip-title"
					mix={[
						raw({
							display: "block",
							marginBlockStart: "0.5rem",
							fontSize: "0.9375rem",
							lineHeight: "1.5rem",
						}),
						weight("medium"),
						fg("neutral.emphasis"),
						pretty(),
					]}
				>
					{title}
				</span>
				{children ? (
					<span
						data-slot="changelog-strip-body"
						mix={[
							raw({ marginBlockStart: "0.25rem", fontSize: "0.9375rem", lineHeight: "1.5rem" }),
							fg("neutral"),
							lineClamp(2),
						]}
					>
						{children}
					</span>
				) : null}
			</>
		);

		return (
			<li
				{...rest}
				data-slot="changelog-strip-entry"
				mix={[
					combine([
						raw({
							position: "relative",
							flex: "0 0 min(80%, 20rem)",
							minInlineSize: "0",
							borderBlockStart: `1px solid ${HAIRLINE}`,
							scrollSnapAlign: "start",
						}),
						when(
							"&::before",
							raw({
								content: '""',
								position: "absolute",
								insetBlockStart: "-4px",
								insetInlineStart: "0",
								inlineSize: "7px",
								blockSize: "7px",
								borderRadius: "9999px",
								backgroundColor: "var(--ui-neutral-fg-muted)",
							}),
						),
						when(
							"&:has(a:hover, a:focus-visible)::before",
							raw({ backgroundColor: "var(--ui-brand-bg-solid)" }),
						),
					]),
					mix,
				]}
			>
				{href ? (
					<a
						href={href}
						data-slot="changelog-strip-link"
						mix={[
							raw({
								display: "block",
								blockSize: "100%",
								paddingBlock: "1.25rem 0.25rem",
								paddingInlineEnd: "1.5rem",
								color: "inherit",
								textDecoration: "none",
								borderRadius: "0.25rem",
							}),
							when(
								"&:hover [data-slot=changelog-strip-title]",
								raw({ textDecoration: "underline", textUnderlineOffset: "0.2em" }),
							),
							focusVisible(outline({ color: "brand.ring", offset: -2 })),
						]}
					>
						{body}
					</a>
				) : (
					<div mix={[raw({ paddingBlock: "1.25rem 0.25rem", paddingInlineEnd: "1.5rem" })]}>
						{body}
					</div>
				)}
			</li>
		);
	};
};
