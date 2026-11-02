/**
 * A row of per-period bars, such as 90 days of uptime: each bar is tinted by its status,
 * hatched where nothing was recorded, and shows its date and value on hover or focus, with a
 * caption naming the window and the summary figure. Bars thin out to fit any container, and
 * form one Tab stop that ←/→, Home and End move through once its island hydrates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps, RemixNode } from "remix/component";

import { bg, fg } from "@sdxc/u/color";
import { mergeMix, raw } from "@sdxc/u/general";
import { container, flex, grow, hstack, relative, vstack } from "@sdxc/u/layout";
import { bs, minIs } from "@sdxc/u/size";
import { nowrap, tabularNums, text, weight } from "@sdxc/u/typography";
import { clientEntry } from "remix/component";

import { statusStripKeys } from "./mixins/status-strip-keys.js";

/** Container the strip measures, so its bars tighten in a narrow card rather than a narrow page. */
const STRIP_CONTAINER = "ui-status-strip";

/**
 * Share of the strip, from either end, inside which a bar's tooltip aligns to that end instead
 * of centring, so a tooltip near the edge stays inside the strip's box.
 */
const EDGE_SHARE = 0.2;

/**
 * Prop types for {@link StatusStrip}.
 */
export namespace StatusStrip {
	/**
	 * What one period recorded: `up` is success, `degraded` warning, `down` danger, `paused`
	 * neutral, and `no-data` a hatched bar that reads as unknown rather than as zero.
	 */
	export type Status = "up" | "degraded" | "down" | "paused" | "no-data";

	/** One period, oldest first in {@link Props.periods}. */
	export interface Period {
		status: Status;
		/** The period's date or name, shown first in its tooltip ("Oct 3"). */
		label: string;
		/** The period's figure, shown after the label ("99.2% · 1,438 of 1,440 checks"). */
		value?: string;
	}

	/** Per-part styling for the parts a strip composes. */
	export interface PartsProps {
		caption?: TagProps<"div">["mix"];
		bars?: TagProps<"div">["mix"];
		bar?: TagProps<"button">["mix"];
	}

	/** Props accepted by {@link StatusStrip}. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		periods: readonly Period[];
		/** Accessible name of the bars' toolbar ("Uptime, last 90 days"). */
		label: string;
		/** The summary figure set in the middle of the caption ("99.95% uptime"). */
		summary?: RemixNode;
		/** Caption under the oldest end ("90 days ago"). */
		start?: RemixNode;
		/** Caption under the newest end ("Today"). */
		end?: RemixNode;
		parts?: PartsProps;
	}
}

/**
 * Pins the tooltips of the bars near either end to that end instead of centring them, so a
 * tooltip near the edge stays inside the strip's box. The rule depends only on the bar count, so
 * every strip of the same length shares it.
 *
 * @param count How many bars the strip draws.
 * @returns The rules aligning the oldest and newest bars' tooltips to their ends.
 */
function edgeRules(count: number): Parameters<typeof raw>[0] {
	let edge = count <= 1 ? 0 : Math.ceil(EDGE_SHARE * (count - 1));
	if (edge === 0) return {};
	let rules: Parameters<typeof raw>[0] = {};
	rules[`& > button:nth-child(-n + ${edge})::after`] = {
		insetInlineStart: "0",
		insetInlineEnd: "auto",
		translate: "none",
	};
	rules[`& > button:nth-last-child(-n + ${edge})::after`] = {
		insetInlineStart: "auto",
		insetInlineEnd: "0",
		translate: "none",
	};
	return rules;
}

/**
 * Renders one bar per period as a button named by its label and value, inside a toolbar named by
 * `label`, then the caption. The newest bar is the strip's one Tab stop, and {@link StatusStripKeys}
 * moves it with the arrows; a bar's tooltip shows its name on hover and keyboard focus with no script.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the strip's markup.
 * @example
 * <StatusStrip
 * 	label={t("monitor.uptimeWindow")}
 * 	summary={t("monitor.uptime", { percent: "99.95" })}
 * 	start={t("time.daysAgo", { count: 90 })}
 * 	end={t("time.today")}
 * 	periods={days.map((day) => ({ status: day.status, label: formatDay(day.date), value: formatUptime(day) }))}
 * />
 */
export function StatusStrip(handle: Handle<StatusStrip.Props>) {
	return () => {
		let { periods, label, summary, start, end, parts, mix, ...rest } = handle.props;
		let hasCaption = summary !== undefined || start !== undefined || end !== undefined;

		return (
			<div
				data-slot="status-strip"
				{...rest}
				mix={mergeMix(
					[vstack({ gap: 1.5, align: "stretch" }), minIs(0), container(STRIP_CONTAINER)],
					mix,
				)}
			>
				<div
					role="toolbar"
					aria-label={label}
					data-slot="status-strip-bars"
					mix={[
						relative(),
						flex(),
						bs("var(--ui-status-strip-block-size, 2rem)"),
						/**
						 * Every bar and its tooltip is painted from this one rule, so a bar's markup is only
						 * its status, Tab order and name. Both gaps, every status and the tooltip's shown
						 * state share it, so each always wins whatever order the stylesheet layers land in.
						 */
						raw({
							gap: "1px",
							[`@container ${STRIP_CONTAINER} (min-width: 30rem)`]: {
								gap: "var(--ui-status-strip-gap, 2px)",
							},
							"& > button": {
								position: "relative",
								flexGrow: "1",
								flexBasis: "0%",
								minInlineSize: "0",
								padding: "0",
								border: "none",
								cursor: "default",
								borderRadius: "var(--ui-status-strip-radius, 1px)",
								backgroundColor: "var(--ui-neutral-border)",
							},
							'& > [data-status="up"]': { backgroundColor: "var(--ui-success-bg-solid)" },
							'& > [data-status="degraded"]': { backgroundColor: "var(--ui-warning-bg-solid)" },
							'& > [data-status="down"]': { backgroundColor: "var(--ui-danger-bg-solid)" },
							'& > [data-status="no-data"]': {
								backgroundColor: "transparent",
								backgroundImage:
									"repeating-linear-gradient(-45deg, var(--ui-neutral-border, color-mix(in oklab, CanvasText 16%, transparent)) 0 1.5px, transparent 1.5px 4px)",
								boxShadow:
									"inset 0 0 0 1px var(--ui-neutral-border, color-mix(in oklab, CanvasText 16%, transparent))",
							},
							"& > button:hover": { opacity: "0.8" },
							"& > button:focus-visible": {
								outline: "2px solid var(--ui-brand-ring)",
								outlineOffset: "1px",
								zIndex: "1",
							},
							/**
							 * The tooltip is the bar's own generated box reading its accessible name, so it
							 * needs no markup and no script. Hidden, it takes no box at all, so the bars at the
							 * edges never widen a page, and shown it wraps inside the strip's width.
							 */
							"& > button::after": {
								content: "attr(aria-label)",
								position: "absolute",
								zIndex: "10",
								display: "none",
								boxSizing: "border-box",
								inlineSize: "max-content",
								maxInlineSize: "100cqi",
								insetBlockEnd: "calc(100% + var(--ui-status-strip-tooltip-gap, 0.375rem))",
								insetInlineStart: "50%",
								translate: "-50% 0",
								paddingInline: "calc(var(--ui-spacing, 0.25rem) * 2)",
								paddingBlock: "var(--ui-spacing, 0.25rem)",
								borderRadius: "var(--ui-radius-md, 0.375rem)",
								color: "var(--ui-neutral-fg-on-solid)",
								backgroundColor: "var(--ui-neutral-bg-solid)",
								boxShadow:
									"var(--ui-shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1))",
								fontSize: "var(--ui-text-xs, 0.75rem)",
								lineHeight: "var(--ui-leading-xs, calc(1 / 0.75))",
								fontWeight: "500",
								fontVariantNumeric: "tabular-nums",
								textAlign: "start",
								whiteSpace: "normal",
								pointerEvents: "none",
							},
							"& > button:is(:hover, :focus-visible)::after": { display: "block" },
						}),
						raw(edgeRules(periods.length)),
						parts?.bars,
					]}
				>
					{periods.map((period, index) => (
						<button
							key={index}
							type="button"
							tabIndex={index === periods.length - 1 ? 0 : -1}
							aria-label={period.value ? `${period.label}, ${period.value}` : period.label}
							data-status={period.status}
							mix={parts?.bar}
						/>
					))}
				</div>
				<StatusStripKeys />
				{hasCaption ? (
					<div
						data-slot="status-strip-caption"
						mix={[
							hstack({ gap: 2, align: "center" }),
							text("xs"),
							fg("neutral.muted"),
							nowrap(),
							tabularNums(),
							parts?.caption,
						]}
					>
						{start === undefined ? null : <span>{start}</span>}
						<StatusStripRule />
						{summary === undefined ? null : (
							<span data-slot="status-strip-summary" mix={[fg("neutral"), weight("medium")]}>
								{summary}
							</span>
						)}
						{summary === undefined ? null : <StatusStripRule />}
						{end === undefined ? null : <span>{end}</span>}
					</div>
				) : null}
			</div>
		);
	};
}

/**
 * Client island behind {@link StatusStrip}'s keyboard navigation: a hidden marker whose
 * `statusStripKeys()` walks the strip it sits in. Loads from `@sdxc/ui/app/status-strip#StatusStripKeys`
 * once the app's browser entry maps it; until then the newest bar stays the strip's one Tab stop.
 */
export const StatusStripKeys: EntryComponent<Record<never, never>> = clientEntry(
	"@sdxc/ui/app/status-strip#StatusStripKeys",
	function StatusStripKeys() {
		return () => <span hidden data-slot="status-strip-keys" mix={[statusStripKeys()]} />;
	},
);

/** The hairline filling the caption between its words, so the summary sits centred in the window. */
function StatusStripRule() {
	return () => <span aria-hidden="true" mix={[grow(), bs("1px"), bg("neutral.border")]} />;
}
