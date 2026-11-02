/**
 * Stat cards for a dashboard: a muted label, the value in tabular figures, a delta pill toned
 * by meaning with its comparison, an optional trend and a sentence explaining the number,
 * laid out by a group as cards, ruled columns, or link tabs that switch the chart below.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { mergeMix, raw } from "@sdxc/u/general";
import { block, container, grid, hstack, inlineBlock, inlineFlex, items } from "@sdxc/u/layout";
import { bs, is, minIs, pi } from "@sdxc/u/size";
import { data } from "@sdxc/u/state";
import { nowrap, tabularNums, text, verticalAlign, weight } from "@sdxc/u/typography";

import { STAT_COMPACT, STAT_GROUP_CONTAINER, statDeltaPlacement } from "./styles/stat-delta.js";

/** Column count a group lays out at full width when `columns` is omitted. */
const DEFAULT_COLUMNS = 4;

/** Layout a group uses when `variant` is omitted. */
const DEFAULT_VARIANT: StatCard.Variant = "cards";

/** Whether a skeleton reserves a delta when `delta` is omitted. */
const DEFAULT_SKELETON_DELTA = true;

/** Whether a skeleton's delta reserves a comparison when `comparison` is omitted. */
const DEFAULT_SKELETON_COMPARISON = true;

/** Widths of the bars a skeleton draws per footer line when `footerLines` is set. */
const FOOTER_LINE_WIDTHS = ["90%", "60%"];

/** Whether a skeleton reserves a footer when `footer` is omitted. */
const DEFAULT_SKELETON_FOOTER = true;

/** Width of a comparison's placeholder: about "vs previous 24 hours" in the comparison's text. */
const COMPARISON_BAR = "10em";

/** Decorative arrow drawn in the delta pill for each trend. */
const TREND_ICONS = { up: TrendingUpIcon, down: TrendingDownIcon, flat: MinusIcon };

/** Fallback for the neutral border colour, matching the theme's own default. */
const BORDER = "var(--ui-neutral-border, color-mix(in oklab, CanvasText 16%, transparent))";

/**
 * Prop types for {@link StatCard} and its parts.
 */
export namespace StatCard {
	/**
	 * How a group sets its stats: `cards` boxes each one, `ruled` sets columns under a 1px rule,
	 * and `tabs` joins link cards into one divided strip whose current card underlines.
	 */
	export type Variant = "cards" | "ruled" | "tabs";

	/** Direction the number moved since the comparison period. */
	export type Trend = "up" | "down" | "flat";

	/** Props accepted by {@link StatCard}. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** Makes the whole card a link, such as the metric's chart tab or its detail page. */
		href?: string;
		/** Marks a link card as the metric the page shows, through `aria-current="true"`. */
		current?: boolean;
		children: RemixNode;
	}

	/** Props accepted by {@link StatCard.Group}. */
	export interface GroupProps extends TagProps<"div"> {
		/** @default {@link DEFAULT_VARIANT} */
		variant?: Variant;
		/** Columns at full width; a narrower container shows at most two, compact, then one. */
		columns?: number;
	}

	/** Props accepted by {@link StatCard.Delta}. */
	export interface DeltaProps extends TagProps<"span"> {
		trend: Trend;
		/** Tones a fall as good and a rise as bad, for numbers such as latency or error rate. */
		invert?: boolean;
		/** Spoken before the change, since the arrow is decorative ("Increased by"). */
		trendLabel?: string;
		/** The period it compares with, set after the pill ("vs last week"). */
		comparison?: RemixNode;
	}

	/** Props accepted by {@link StatCard.Skeleton}. */
	export interface SkeletonProps extends Omit<TagProps<"div">, "children"> {
		/**
		 * Reserves a delta pill.
		 *
		 * @default true
		 */
		delta?: boolean;
		/**
		 * Reserves the comparison set after the delta pill, which wraps under the pill in a
		 * narrow card just as the real comparison does.
		 *
		 * @default true
		 */
		comparison?: boolean;
		/** Reserves the trend slot. */
		chart?: boolean;
		/**
		 * Reserves a sentence-long footer, which wraps to a second line in a narrow card.
		 *
		 * @default true
		 */
		footer?: boolean;
		/**
		 * Reserves exactly this many footer lines at every width, for footers whose real sentences
		 * wrap even in a wide card. Unset, the footer wraps where a 40-character sentence does.
		 */
		footerLines?: 1 | 2;
	}
}

/**
 * Picks the delta's tone from its meaning: a rise is good unless `invert` says a fall is.
 *
 * @param trend Direction the number moved.
 * @param invert Whether a fall is the good direction.
 * @returns The semantic role the pill is drawn in.
 */
function deltaTone(trend: StatCard.Trend, invert: boolean): "success" | "danger" | "neutral" {
	if (trend === "flat") return "neutral";
	return (trend === "up") !== invert ? "success" : "danger";
}

/**
 * Renders one stat: a grid that sets the label and delta on one line, the value under them,
 * then the trend and the footer, in that order whatever order the parts are written in. With
 * `href` the whole card is one link, and `current` marks it as the metric being shown.
 *
 * @param handle Runtime handle carrying the card's props.
 * @returns The render function producing the card's markup.
 * @example
 * <StatCard>
 * 	<StatCard.Label>{t("stats.uptime")}</StatCard.Label>
 * 	<StatCard.Value>99.98%</StatCard.Value>
 * 	<StatCard.Delta trend="up" comparison={t("stats.vsLastWeek")}>+0.02%</StatCard.Delta>
 * 	<StatCard.Footer>{t("stats.uptimeFooter")}</StatCard.Footer>
 * </StatCard>
 * @example
 * <StatCard href="?metric=latency" current={metric === "latency"}>…</StatCard>
 */
export function StatCard(handle: Handle<StatCard.Props>) {
	return () => {
		let { href, current, children, mix, ...rest } = handle.props;
		let frame = [
			/**
			 * Every variant's frame lives in one rule keyed off the group, so the variant always
			 * wins over the default card frame whatever order the stylesheet layers land in.
			 */
			raw({
				display: "grid",
				gridTemplateColumns: "minmax(0, 1fr) auto",
				alignItems: "center",
				alignContent: "start",
				columnGap: "0.75rem",
				rowGap: "0.375rem",
				minInlineSize: "0",
				padding: "var(--ui-stat-card-padding, 1.25rem)",
				border: `1px solid ${BORDER}`,
				borderRadius: "var(--ui-radius-lg, 0.75rem)",
				backgroundColor: "var(--ui-bg, Canvas)",
				color: "inherit",
				textDecoration: "none",
				outlineOffset: "-2px",
				transition: "background-color 150ms ease-out",
				'[data-stat-group="ruled"] > &': {
					paddingInline: "0",
					paddingBlockEnd: "0",
					border: "none",
					borderBlockStart: `1px solid ${BORDER}`,
					borderRadius: "0",
					backgroundColor: "transparent",
				},
				'[data-stat-group="tabs"] > &': {
					border: "none",
					borderInlineEnd: `1px solid ${BORDER}`,
					borderBlockEnd: `1px solid ${BORDER}`,
					borderRadius: "0",
					backgroundColor: "transparent",
				},
				"&:is(a):hover": { backgroundColor: "var(--ui-neutral-bg-tint, transparent)" },
				'&[aria-current="true"]': {
					boxShadow: "inset 0 -2px 0 0 var(--ui-brand-fg, currentColor)",
				},
				"&:focus-visible": { outline: "2px solid var(--ui-brand-ring, Highlight)" },
				"@media (prefers-reduced-motion: reduce)": { transition: "none" },
				[STAT_COMPACT]: {
					'[data-stat-split]:not([data-stat-group="ruled"]) > &': {
						padding: "var(--ui-stat-card-padding, 0.875rem)",
					},
				},
			}),
		];

		if (href !== undefined) {
			return (
				<a
					href={href}
					aria-current={current ? "true" : undefined}
					data-slot="stat-card"
					{...(rest as unknown as Omit<TagProps<"a">, "href" | "role">)}
					mix={mergeMix(frame, mix as TagProps<"a">["mix"])}
				>
					{children}
				</a>
			);
		}

		return (
			<div data-slot="stat-card" {...rest} mix={mergeMix(frame, mix)}>
				{children}
			</div>
		);
	};
}

/**
 * Lays stats out by the width of their container: one column, two compact ones from 18rem,
 * two full-size from 28rem, and `columns` from 52rem. `cards` boxes each stat, `ruled` sets them as columns under a 1px rule, and
 * `tabs` joins link cards into one divided strip, the current one underlined.
 *
 * @param handle Runtime handle carrying the group's props.
 * @returns The render function producing the group's markup.
 * @example
 * <StatCard.Group variant="ruled" aria-label={t("stats.overview")}>{cards}</StatCard.Group>
 * @example
 * <StatCard.Group variant="tabs" columns={3} aria-label={t("stats.metrics")}>{tabs}</StatCard.Group>
 */
StatCard.Group = function StatCardGroup(handle: Handle<StatCard.GroupProps>) {
	return () => {
		let { variant, columns, children, mix, ...rest } = handle.props;
		let resolvedVariant = variant ?? DEFAULT_VARIANT;
		let wide = Math.max(1, Math.round(columns ?? DEFAULT_COLUMNS));
		let middle = Math.min(2, wide);
		let tabs = resolvedVariant === "tabs";

		return (
			<div
				role="group"
				data-slot="stat-group"
				data-variant={resolvedVariant}
				{...rest}
				mix={mergeMix(
					[
						block(),
						is("full"),
						minIs(0),
						container(STAT_GROUP_CONTAINER),
						tabs
							? raw({
									border: `1px solid ${BORDER}`,
									borderRadius: "var(--ui-radius-lg, 0.75rem)",
									overflow: "clip",
								})
							: undefined,
					],
					mix,
				)}
			>
				<div
					data-stat-group={resolvedVariant}
					data-stat-split={middle > 1 ? "" : undefined}
					mix={[
						grid(),
						/**
						 * Every column count lives in one rule, so the widest layout that fits always wins
						 * whatever order the stylesheet layers land in.
						 */
						raw({
							gridTemplateColumns: "minmax(0, 1fr)",
							gap: tabs ? "0" : "1rem",
							columnGap: resolvedVariant === "ruled" ? "2rem" : undefined,
							rowGap: resolvedVariant === "ruled" ? "1.5rem" : undefined,
							marginInlineEnd: tabs ? "-1px" : undefined,
							marginBlockEnd: tabs ? "-1px" : undefined,
							[`@container ${STAT_GROUP_CONTAINER} (min-width: 18rem)`]: {
								gridTemplateColumns: `repeat(${middle}, minmax(0, 1fr))`,
							},
							[`@container ${STAT_GROUP_CONTAINER} (min-width: 52rem)`]: {
								gridTemplateColumns: `repeat(${wide}, minmax(0, 1fr))`,
							},
						}),
					]}
				>
					{children}
				</div>
			</div>
		);
	};
};

/**
 * Renders the stat's name in muted 14px text at the start of the first line.
 *
 * @param handle Runtime handle carrying the label's props.
 * @returns The render function producing the label's markup.
 * @example
 * <StatCard.Label>{t("stats.p95")}</StatCard.Label>
 */
StatCard.Label = function StatCardLabel(handle: Handle<TagProps<"div">>) {
	return () => {
		let { mix, ...rest } = handle.props;
		return (
			<div
				data-slot="stat-card-label"
				{...rest}
				mix={mergeMix(
					[
						raw({ order: 0, minInlineSize: "0" }),
						text("sm"),
						weight("medium"),
						fg("neutral.muted"),
					],
					mix,
				)}
			/>
		);
	};
};

/**
 * Renders the number at `--ui-stat-value-size` (30px in a card, 24px in ruled columns, 22px in
 * a compact group), semibold in tabular figures, so values in a row line up and a live update
 * never shifts its width. Pass `—` for an unknown value.
 *
 * @param handle Runtime handle carrying the value's props.
 * @returns The render function producing the value's markup.
 * @example
 * <StatCard.Value>182 ms</StatCard.Value>
 */
StatCard.Value = function StatCardValue(handle: Handle<TagProps<"div">>) {
	return () => {
		let { mix, ...rest } = handle.props;
		return (
			<div
				data-slot="stat-card-value"
				{...rest}
				mix={mergeMix(
					[
						tabularNums(),
						raw({
							order: 2,
							gridColumn: "1 / -1",
							minInlineSize: "0",
							fontSize: "var(--ui-stat-value-size, 1.875rem)",
							lineHeight: "1.2",
							fontWeight: "600",
							letterSpacing: "-0.01em",
							'[data-stat-group="ruled"] > * > &': {
								fontSize: "var(--ui-stat-value-size, 1.5rem)",
							},
							[STAT_COMPACT]: {
								"[data-stat-split] > * > &": { fontSize: "var(--ui-stat-value-size, 1.375rem)" },
							},
						}),
					],
					mix,
				)}
			/>
		);
	};
};

/**
 * Renders the change as a pill toned by meaning (success when it moved the good way, danger
 * when the bad way, neutral when flat) with a decorative arrow, then the comparison in muted
 * text. It sits at the end of the label's line in a card, and under the value elsewhere.
 *
 * @param handle Runtime handle carrying the delta's props.
 * @returns The render function producing the delta's markup.
 * @example
 * <StatCard.Delta trend="up" invert trendLabel={t("stats.increased")} comparison={t("stats.vsLastWeek")}>+12 ms</StatCard.Delta>
 */
StatCard.Delta = function StatCardDelta(handle: Handle<StatCard.DeltaProps>) {
	return () => {
		let { trend, invert, trendLabel, comparison, children, mix, ...rest } = handle.props;
		let tone = deltaTone(trend, invert ?? false);
		let Icon = TREND_ICONS[trend];

		return (
			<span
				data-slot="stat-card-delta"
				data-trend={trend}
				data-tone={tone}
				{...rest}
				mix={mergeMix([hstack({ gap: 1.5, align: "center" }), nowrap(), statDeltaPlacement()], mix)}
			>
				<span
					data-slot="stat-card-delta-pill"
					mix={[
						inlineFlex(),
						items("center"),
						raw({ gap: "0.25rem" }),
						bs("var(--ui-stat-delta-block-size, 1.375rem)"),
						pi(2),
						rounded("full"),
						border({ width: 1, style: "solid" }),
						text("xs"),
						weight("medium"),
						tabularNums(),
						data("tone", "success", [bg("success.tint"), fg("success"), border("success")]),
						data("tone", "danger", [bg("danger.tint"), fg("danger"), border("danger")]),
						data("tone", "neutral", [bg("neutral.tint"), fg("neutral"), border("neutral")]),
					]}
					data-tone={tone}
				>
					<Icon size={12} aria-hidden="true" />
					{trendLabel ? <span mix={[visuallyHidden()]}>{trendLabel}</span> : null}
					{children}
				</span>
				{comparison === undefined ? null : (
					<span data-slot="stat-card-comparison" mix={[text("xs"), fg("neutral.muted")]}>
						{comparison}
					</span>
				)}
			</span>
		);
	};
};

/**
 * Holds a trend under the value, such as a {@link Sparkline}, at `--ui-stat-chart-block-size`
 * across the card's full width.
 *
 * @param handle Runtime handle carrying the slot's props.
 * @returns The render function producing the slot's markup.
 * @example
 * <StatCard.Chart><Sparkline values={latency} label={t("stats.latencyTrend")} area /></StatCard.Chart>
 */
StatCard.Chart = function StatCardChart(handle: Handle<TagProps<"div">>) {
	return () => {
		let { mix, ...rest } = handle.props;
		return (
			<div
				data-slot="stat-card-chart"
				{...rest}
				mix={mergeMix(
					[
						raw({
							order: 4,
							gridColumn: "1 / -1",
							display: "flex",
							alignItems: "stretch",
							minInlineSize: "0",
							blockSize: "var(--ui-stat-chart-block-size, 2.5rem)",
							"--ui-sparkline-block-size": "100%",
						}),
					],
					mix,
				)}
			/>
		);
	};
};

/**
 * Renders the sentence that explains the number ("2 monitors down since 09:14"), muted, under
 * everything else.
 *
 * @param handle Runtime handle carrying the footer's props.
 * @returns The render function producing the footer's markup.
 * @example
 * <StatCard.Footer>{t("stats.incidentsFooter", { count: 2 })}</StatCard.Footer>
 */
StatCard.Footer = function StatCardFooter(handle: Handle<TagProps<"div">>) {
	return () => {
		let { mix, ...rest } = handle.props;
		return (
			<div
				data-slot="stat-card-footer"
				{...rest}
				mix={mergeMix(
					[
						raw({
							order: 5,
							gridColumn: "1 / -1",
							minInlineSize: "0",
							marginBlockStart: "0.25rem",
						}),
						text("sm"),
						fg("neutral.muted"),
					],
					mix,
				)}
			/>
		);
	};
};

/**
 * Stands in for a stat while it loads: the same parts placed by the same container queries,
 * with bars that wrap where a comparison and a 40-character footer sentence wrap, so the card
 * keeps its height when the real one streams in.
 *
 * @param handle Runtime handle carrying the skeleton's props.
 * @returns The render function producing the placeholder's markup.
 * @example
 * <StatCard.Skeleton chart />
 * @example
 * <StatCard.Skeleton comparison={false} footer={false} />
 * @example
 * <StatCard.Skeleton footerLines={2} />
 */
StatCard.Skeleton = function StatCardSkeleton(handle: Handle<StatCard.SkeletonProps>) {
	return () => {
		let { delta, comparison, chart, footer, footerLines, mix, ...rest } = handle.props;

		return (
			<StatCard aria-hidden="true" data-skeleton="" {...rest} mix={mix}>
				<StatCard.Label>
					<StatCardBar width="40%" />
				</StatCard.Label>
				<StatCard.Value>
					<StatCardBar width="5ch" />
				</StatCard.Value>
				{(delta ?? DEFAULT_SKELETON_DELTA) ? (
					<span
						data-slot="stat-card-delta"
						mix={[hstack({ gap: 1.5, align: "center" }), nowrap(), statDeltaPlacement()]}
					>
						<span
							mix={[
								block(),
								is("3.5rem"),
								bs("var(--ui-stat-delta-block-size, 1.375rem)"),
								rounded("full"),
								raw({ backgroundColor: BORDER }),
							]}
						/>
						{(comparison ?? DEFAULT_SKELETON_COMPARISON) ? (
							<span data-slot="stat-card-comparison" mix={[text("xs")]}>
								<StatCardBar width={COMPARISON_BAR} />
							</span>
						) : null}
					</span>
				) : null}
				{chart ? (
					<StatCard.Chart>
						<StatCardBar width="100%" block />
					</StatCard.Chart>
				) : null}
				{(footer ?? DEFAULT_SKELETON_FOOTER) ? (
					<StatCard.Footer>
						{footerLines ? (
							FOOTER_LINE_WIDTHS.slice(0, footerLines).map((width) => (
								<span mix={[block()]}>
									<StatCardBar width={width} />
								</span>
							))
						) : (
							<>
								<StatCardBar width="6em" /> <StatCardBar width="4em" /> <StatCardBar width="5em" />
							</>
						)}
					</StatCard.Footer>
				) : null}
			</StatCard>
		);
	};
};

namespace StatCardBar {
	export interface Props {
		width: string;
		/** Fills the slot's height instead of sitting on the text line. */
		block?: boolean;
	}
}

/**
 * One placeholder bar: an inline block shorter than its line, so the part around it keeps
 * the line height the real text gives it, or a block filling a slot of fixed height.
 */
function StatCardBar(handle: Handle<StatCardBar.Props>) {
	return () => {
		let { width, block: fills } = handle.props;
		return (
			<span
				data-slot="stat-card-skeleton-bar"
				mix={[
					fills ? block() : inlineBlock(),
					is(width),
					bs(fills ? "100%" : "0.75em"),
					verticalAlign("middle"),
					rounded("md"),
					raw({ backgroundColor: BORDER }),
				]}
			/>
		);
	};
}
