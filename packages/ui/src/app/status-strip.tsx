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

import { bg, border, fg, outline } from "@sdxc/u/color";
import { opacity, rounded, shadow } from "@sdxc/u/effects";
import { cursor, mergeMix, pointerEvents, raw } from "@sdxc/u/general";
import { absolute, basis, container, flex, grow, hstack, relative, vstack } from "@sdxc/u/layout";
import { bs, minIs, p, pb, pi } from "@sdxc/u/size";
import { z } from "@sdxc/u/stacking";
import { focusVisible, hover } from "@sdxc/u/state";
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
		tooltip?: TagProps<"span">["mix"];
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
 * Picks where a bar's tooltip anchors from its position in the strip.
 *
 * @param index The bar's position, oldest first.
 * @param count How many bars the strip draws.
 * @returns `start` near the oldest end, `end` near the newest, `center` between.
 */
function tooltipAlign(index: number, count: number): "start" | "center" | "end" {
	let share = count <= 1 ? 0.5 : index / (count - 1);
	if (share < EDGE_SHARE) return "start";
	if (share > 1 - EDGE_SHARE) return "end";
	return "center";
}

/**
 * Renders one bar per period as a button named by its label and value, inside a toolbar named by
 * `label`, then the caption. The newest bar is the strip's one Tab stop, and {@link StatusStripKeys}
 * moves it with the arrows; a bar's tooltip shows on hover and keyboard focus with no script.
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
						 * Both gaps live in one rule, so the wide gap always wins at its width whatever
						 * order the stylesheet layers land in.
						 */
						raw({
							gap: "1px",
							[`@container ${STRIP_CONTAINER} (min-width: 30rem)`]: {
								gap: "var(--ui-status-strip-gap, 2px)",
							},
						}),
						parts?.bars,
					]}
				>
					{periods.map((period, index) => {
						let name = period.value ? `${period.label}, ${period.value}` : period.label;

						return (
							<button
								key={index}
								type="button"
								tabIndex={index === periods.length - 1 ? 0 : -1}
								aria-label={name}
								data-slot="status-strip-bar"
								data-status={period.status}
								data-align={tooltipAlign(index, periods.length)}
								mix={[
									relative(),
									grow(),
									basis("0%"),
									p(0),
									border("none"),
									cursor("default"),
									minIs(0),
									rounded("var(--ui-status-strip-radius, 1px)"),
									/**
									 * Every status shares one rule, so a status always paints over the default
									 * whatever order the stylesheet layers land in.
									 */
									raw({
										backgroundColor: "var(--ui-neutral-border)",
										'&[data-status="up"]': { backgroundColor: "var(--ui-success-bg-solid)" },
										'&[data-status="degraded"]': { backgroundColor: "var(--ui-warning-bg-solid)" },
										'&[data-status="down"]': { backgroundColor: "var(--ui-danger-bg-solid)" },
										'&[data-status="no-data"]': {
											backgroundColor: "transparent",
											backgroundImage:
												"repeating-linear-gradient(-45deg, var(--ui-neutral-border, color-mix(in oklab, CanvasText 16%, transparent)) 0 1.5px, transparent 1.5px 4px)",
											boxShadow:
												"inset 0 0 0 1px var(--ui-neutral-border, color-mix(in oklab, CanvasText 16%, transparent))",
										},
									}),
									hover(opacity(80)),
									focusVisible([outline({ color: "brand.ring", offset: 1 }), z(1)]),
									parts?.bar,
								]}
							>
								<span
									aria-hidden="true"
									data-slot="status-strip-tooltip"
									mix={[
										absolute(),
										pi(2),
										pb(1),
										rounded("md"),
										fg("neutral.onSolid"),
										bg("neutral.solid"),
										shadow("md"),
										z(10),
										text("xs"),
										tabularNums(),
										pointerEvents(),
										/**
										 * Display and alignment read the bar's state from one rule, so the shown state
										 * always beats the hidden one whatever order the layers land in. A hidden
										 * tooltip takes no box at all, so the bars at the edges never widen a page, and
										 * a shown one wraps inside the strip's width.
										 */
										raw({
											display: "none",
											alignItems: "center",
											columnGap: "0.375rem",
											flexWrap: "wrap",
											inlineSize: "max-content",
											maxInlineSize: "100cqi",
											boxSizing: "border-box",
											insetBlockEnd: "calc(100% + var(--ui-status-strip-tooltip-gap, 0.375rem))",
											'[data-align="start"] > &': { insetInlineStart: "0" },
											'[data-align="end"] > &': { insetInlineEnd: "0" },
											'[data-align="center"] > &': { insetInlineStart: "50%", translate: "-50% 0" },
											":is(:hover, :focus-visible) > &": { display: "flex" },
										}),
										parts?.tooltip,
									]}
								>
									<span mix={[opacity(75)]}>{period.label}</span>
									{period.value ? <span mix={[weight("semibold")]}>{period.value}</span> : null}
								</span>
							</button>
						);
					})}
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
