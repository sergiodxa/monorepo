/**
 * Loading placeholders: a single static block, plus presets that keep the real
 * height of what they stand in for (a table row, a stat card, a table body, a
 * list), so content lands without the page shifting.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { animationHost, keyframes } from "@sdxc/u/animation";
import { bg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { combine, mergeMix, raw } from "@sdxc/u/general";
import { flex, flexCol, gap, grow, items, shrink } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { bs, is } from "@sdxc/u/size";
import { attrs } from "remix/component";

import { StatCard } from "./stat-card.js";
import { Table } from "./table.js";

/**
 * Default `aria-hidden` value applied through {@link attrs}, keeping a
 * placeholder out of the accessibility tree unless a consumer sets
 * `aria-hidden="false"` to expose a loading label to assistive tech.
 */
const DEFAULT_ARIA_HIDDEN = "true";

/** Bar widths a preset cycles through, so placeholder rows read as text of varied length. */
const BAR_WIDTHS = ["72%", "48%", "60%", "36%", "54%"];

/**
 * Props accepted by {@link Skeleton} and its presets.
 */
export namespace Skeleton {
	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 * A placeholder's box shape comes from the space it renders into, tuned
	 * through `style`, a wrapping layout, or a `css()` mixin via `mix`.
	 */
	export interface Props extends TagProps<"div"> {}

	/**
	 * Names the loading cluster for assistive technology. Given, the preset's
	 * root becomes one busy `role="status"` named by it; left out, the whole
	 * preset stays hidden, for a parent that already announces the wait.
	 */
	export interface Labelled {
		/** What is loading, such as "Loading monitors". */
		label?: string;
	}

	/** Props accepted by {@link Skeleton.Row}. */
	export interface RowProps extends TagProps<"tr"> {
		/** Cells in the row; match the real table's columns. Default: `4`. */
		columns?: number;
	}

	/** Props accepted by {@link Skeleton.Table}. */
	export interface TableProps extends TagProps<"tbody">, Labelled {
		/** Placeholder rows. Default: `5`. */
		rows?: number;
		/** Cells per row; match the real table's columns. Default: `4`. */
		columns?: number;
	}

	/** Props accepted by {@link Skeleton.Stat}. */
	export interface StatProps extends Omit<TagProps<"div">, "children">, Labelled {
		/** Draws the delta pill beside the label, as a card with a delta has. */
		delta?: boolean;
		/** Draws the chart band under the value, as a card with a sparkline has. */
		chart?: boolean;
	}

	/** Props accepted by {@link Skeleton.List}. */
	export interface ListProps extends TagProps<"div">, Labelled {
		/** Placeholder rows. Default: `5`. */
		rows?: number;
		/** Leads each row with a round avatar placeholder. */
		avatar?: boolean;
		/** Text lines per row. Default: `2`. */
		lines?: 1 | 2;
	}
}

/**
 * A sweeping highlight across a placeholder bar while motion is allowed; under
 * reduced motion the bar holds still, since the wait is already visible.
 *
 * @returns A mixin for a placeholder bar.
 */
function shimmerBar<Node extends Element = Element>() {
	return combine<Node>([
		keyframes<Node>("ui-skeleton-shimmer", {
			from: { backgroundPosition: "150% 0" },
			to: { backgroundPosition: "-50% 0" },
		}),
		media<Node>(
			"(prefers-reduced-motion: no-preference)",
			combine<Node>([
				raw<Node>({
					backgroundImage:
						"linear-gradient(90deg, transparent, color-mix(in oklab, var(--ui-bg, Canvas) 45%, transparent), transparent)",
					backgroundSize: "50% 100%",
					backgroundRepeat: "no-repeat",
				}),
				animationHost<Node>("ui-skeleton-shimmer", {
					duration: "var(--ui-skeleton-shimmer-duration, 1.6s)",
					easing: "ease-in-out",
					iterationCount: "infinite",
				}),
			]),
		),
	]);
}

/**
 * Props of one placeholder bar inside a preset.
 */
interface BarProps {
	/** Inline size, as a CSS length or percentage. */
	width: string;
	/** Block size, as a CSS length. Default: `0.75rem`. */
	height?: string;
	/** Draws a pill or a circle instead of a rounded bar. */
	round?: boolean;
}

/**
 * One shimmering placeholder bar, inline-block so it sits on a text line
 * without changing the line's height.
 *
 * @param handle Runtime handle carrying the bar's size.
 * @returns The render function producing the bar's markup.
 */
function SkeletonBar(handle: Handle<BarProps>) {
	return () => {
		let { width, height = "0.75rem", round = false } = handle.props;

		return (
			<span
				data-slot="skeleton-bar"
				mix={[
					raw({
						display: "inline-block",
						verticalAlign: "middle",
						inlineSize: width,
						maxInlineSize: "100%",
						blockSize: height,
						borderRadius: round ? "9999px" : "var(--ui-radius-sm, 0.25rem)",
					}),
					bg("neutral.border"),
					shimmerBar(),
				]}
			/>
		);
	};
}

/**
 * The attributes a preset root carries: one busy, named status when the
 * caller labels the cluster, otherwise hidden whole.
 *
 * @param label What is loading, or `undefined` to hide the preset.
 * @returns Attributes to spread onto the preset's root element.
 */
function busyAttributes(label: string | undefined) {
	if (label === undefined) return { "aria-hidden": "true" as const };
	return { role: "status" as const, "aria-busy": "true" as const, "aria-label": label };
}

/**
 * A static loading placeholder: a rounded block filled with the neutral
 * border color, sized to its container and one text line tall by default.
 * Compose `pulse()` or `shimmer()` through `mix` for a motion cue.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the placeholder's markup.
 * @example
 * <Skeleton mix={[pulse()]} />
 * @example
 * <Skeleton style={{ blockSize: "2.5rem", inlineSize: "2.5rem", borderRadius: "9999px" }} />
 * @example
 * <Skeleton aria-hidden="false" aria-label={t("status.loadingProfile")} />
 */
export function Skeleton(handle: Handle<Skeleton.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				mix={mergeMix(
					[
						attrs({ "aria-hidden": DEFAULT_ARIA_HIDDEN }),
						bs("var(--ui-skeleton-block-size, 1rem)"),
						is("full"),
						rounded("md"),
						bg("neutral.border"),
					],
					mix,
				)}
			/>
		);
	};
}

/**
 * A placeholder table row built from the real `Table.Row` and `Table.Cell`, so it
 * takes `--ui-table-row-block-size` and the table's cell padding and rules; place
 * it in a real table body. Hidden from assistive technology.
 *
 * @param handle Runtime handle carrying the host `<tr>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <Table.Body aria-busy="true">{rows.map((n) => <Skeleton.Row key={n} columns={4} />)}</Table.Body>
 */
Skeleton.Row = function SkeletonRow(handle: Handle<Skeleton.RowProps>) {
	return () => {
		let { columns = 4, mix, ...rest } = handle.props;

		return (
			<Table.Row aria-hidden="true" data-skeleton="row" {...rest} mix={mix}>
				{Array.from({ length: columns }, (_, column) => (
					<Table.Cell key={column}>
						<SkeletonBar width={BAR_WIDTHS[column % BAR_WIDTHS.length]!} />
					</Table.Cell>
				))}
			</Table.Row>
		);
	};
};

/**
 * A placeholder table body of `rows` {@link Skeleton.Row}s, for under the real
 * table header while the first page loads, so the header, columns and height
 * hold still when the data arrives.
 *
 * @param handle Runtime handle carrying the host `<tbody>`'s props.
 * @returns The render function producing the body's markup.
 * @example
 * <Table><Table.Header>…</Table.Header><Skeleton.Table rows={10} columns={5} label={t("monitors.loading")} /></Table>
 */
Skeleton.Table = function SkeletonTable(handle: Handle<Skeleton.TableProps>) {
	return () => {
		let { rows = 5, columns = 4, label, mix, ...rest } = handle.props;
		let busy =
			label === undefined
				? { "aria-hidden": "true" as const }
				: { "aria-busy": "true" as const, "aria-label": label };

		return (
			<Table.Body {...busy} data-skeleton="table" {...rest} mix={mix}>
				{Array.from({ length: rows }, (_, row) => (
					<Skeleton.Row key={row} columns={columns} />
				))}
			</Table.Body>
		);
	};
};

/**
 * A placeholder stat card drawn inside the real `StatCard` frame, with bars on
 * the label and value lines, so it is exactly as tall as the card it precedes;
 * `delta` and `chart` add the parts the real card has.
 *
 * @param handle Runtime handle carrying the card's props.
 * @returns The render function producing the card's markup.
 * @example
 * <StatCard.Group>{[1, 2, 3, 4].map((n) => <Skeleton.Stat key={n} delta />)}</StatCard.Group>
 */
Skeleton.Stat = function SkeletonStat(handle: Handle<Skeleton.StatProps>) {
	return () => {
		let { delta = false, chart = false, label, mix, ...rest } = handle.props;

		return (
			<StatCard {...busyAttributes(label)} data-skeleton="stat" {...rest} mix={mix}>
				<StatCard.Label>
					<SkeletonBar width="6rem" height="0.75rem" />
				</StatCard.Label>
				{delta ? (
					<span mix={[raw({ order: 1, display: "inline-flex", alignItems: "center" })]}>
						<SkeletonBar width="3.5rem" height="var(--ui-stat-delta-block-size, 1.375rem)" round />
					</span>
				) : null}
				<StatCard.Value>
					<SkeletonBar width="5ch" height="1em" />
				</StatCard.Value>
				{chart ? (
					<StatCard.Chart>
						<SkeletonBar width="100%" height="100%" />
					</StatCard.Chart>
				) : null}
			</StatCard>
		);
	};
};

/**
 * A placeholder list of `rows` rows at `--ui-skeleton-list-row-block-size`
 * (3.5rem, a two-line row), each an optional avatar and one or two text bars;
 * set the variable to the real list's row height.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the list's markup.
 * @example
 * <Skeleton.List rows={8} avatar label={t("inbox.loading")} />
 */
Skeleton.List = function SkeletonList(handle: Handle<Skeleton.ListProps>) {
	return () => {
		let { rows = 5, avatar = false, lines = 2, label, mix, ...rest } = handle.props;

		return (
			<div
				{...busyAttributes(label)}
				data-slot="skeleton-list"
				{...rest}
				mix={mergeMix([flex(), flexCol()], mix)}
			>
				{Array.from({ length: rows }, (_, row) => (
					<div
						key={row}
						data-slot="skeleton-list-row"
						mix={[
							flex(),
							items("center"),
							gap(3),
							raw({
								boxSizing: "border-box",
								blockSize: "var(--ui-skeleton-list-row-block-size, 3.5rem)",
								paddingInline: "0.75rem",
							}),
							raw({ borderBlockEnd: "1px solid var(--ui-neutral-border, currentColor)" }),
						]}
					>
						{avatar ? (
							<span mix={[shrink(0), raw({ display: "inline-flex" })]}>
								<SkeletonBar width="2rem" height="2rem" round />
							</span>
						) : null}
						<span mix={[flex(), flexCol(), gap(2), grow()]}>
							<SkeletonBar width={BAR_WIDTHS[row % BAR_WIDTHS.length]!} />
							{lines === 2 ? (
								<SkeletonBar width={BAR_WIDTHS[(row + 2) % BAR_WIDTHS.length]!} height="0.625rem" />
							) : null}
						</span>
					</div>
				))}
			</div>
		);
	};
};
