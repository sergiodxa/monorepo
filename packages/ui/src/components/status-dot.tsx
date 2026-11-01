/**
 * A small coloured dot that names a record's state beside its label, plus a dot cluster that
 * summarises a set of states as `n/N`. The tone comes from a semantic role, and only an
 * in-progress state pulses, so a list polled every few seconds stays still between changes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { animationHost, keyframes } from "@sdxc/u/animation";
import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { mergeMix, raw } from "@sdxc/u/general";
import { inlineFlex, items, relative, shrink } from "@sdxc/u/layout";
import { motionSafe } from "@sdxc/u/responsive";
import { bs, is } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { fontSize, nowrap, tabularNums } from "@sdxc/u/typography";

import type { SemanticColor } from "../utils/semantic-color.js";

/** Semantic role a dot takes when `color` is omitted: a state the page cannot name yet. */
const DEFAULT_COLOR: StatusDot.Color = "neutral";

/** Dot diameter, overridable through `--ui-status-dot-size`. */
const DOT_SIZE = "var(--ui-status-dot-size, 0.5rem)";

/**
 * Prop types for {@link StatusDot} and its compound parts.
 */
export namespace StatusDot {
	/**
	 * The role a state reads in: up or ok is `success`, degraded or pending is `warning`, down
	 * or failed is `danger`, paused or unknown is `neutral`, in progress is `brand`.
	 */
	export type Color = SemanticColor;

	/**
	 * Every native `<span>` attribute plus the dot's tone. Children are the visible label; a dot
	 * without one needs `aria-label` naming the state.
	 */
	export interface Props extends TagProps<"span"> {
		/** Semantic role of the state. Defaults to {@link DEFAULT_COLOR}. */
		color?: Color;
		/**
		 * Marks a state still in progress (queued, deploying, checking): the dot pulses until the
		 * state settles, and holds still for visitors who prefer reduced motion.
		 */
		pulse?: boolean;
		/** The state's name, such as "Up" or "Deploying". */
		children?: RemixNode;
	}

	/**
	 * Every native `<span>` attribute plus the states to draw and the count they summarise.
	 */
	export interface SummaryProps extends TagProps<"span"> {
		/** One dot per chosen state, drawn overlapping in this order; an empty list shows `n/N` alone. */
		colors?: Color[];
		/** How many states are chosen, the `n` of `n/N`. */
		count: number;
		/** How many states exist, the `N` of `n/N`. */
		total: number;
		/** What the summary announces in full, such as "4 of 5 statuses shown". */
		label: string;
	}
}

/**
 * Renders a dot and its label. With a label the dot is `aria-hidden`, since the text already
 * names the state; without one the host becomes `role="img"` and its `aria-label` is the name.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the dot's markup.
 * @example <StatusDot color="success">{t("monitor.up")}</StatusDot>
 * @example <StatusDot color="brand" pulse>{t("deploy.building")}</StatusDot>
 * @example <StatusDot color="danger" aria-label={t("monitor.down")} />
 */
export function StatusDot(handle: Handle<StatusDot.Props>) {
	return () => {
		let { color, pulse, children, mix, ...rest } = handle.props;
		let labelled = children !== undefined && children !== null && children !== false;

		return (
			<span
				role={labelled ? undefined : "img"}
				{...rest}
				data-slot="status-dot"
				data-color={color ?? DEFAULT_COLOR}
				data-pulse={pulse ? "" : undefined}
				mix={mergeMix(
					[inlineFlex(), items("center"), raw({ gap: "0.5em" }), fontSize("sm"), nowrap()],
					mix,
				)}
			>
				<Dot pulse={pulse} />
				{labelled ? <span data-slot="status-dot-label">{children}</span> : null}
			</span>
		);
	};
}

/**
 * Props for {@link Dot}, the one circle every status part draws.
 */
interface DotProps {
	/** Whether the circle pulses while its state is in progress. */
	pulse?: boolean;
	/** Overlap offset for a dot inside a cluster. */
	overlap?: boolean;
	/** Tone when the dot stands outside a coloured host. */
	color?: StatusDot.Color;
}

/**
 * Draws one `aria-hidden` circle coloured by the nearest `data-color`, its own or its host's.
 * The pulse is a ring that grows and fades from the dot, so the dot itself keeps its colour
 * steady for anyone reading it.
 *
 * @param handle Runtime handle carrying the dot's tone and motion.
 * @returns The render function producing the circle.
 */
function Dot(handle: Handle<DotProps>) {
	return () => {
		let { pulse, overlap, color } = handle.props;

		return (
			<span
				aria-hidden="true"
				data-slot="status-dot-dot"
				data-color={color}
				mix={[
					relative(),
					shrink(0),
					is(DOT_SIZE),
					bs(DOT_SIZE),
					rounded("full"),
					bg("neutral.strong"),
					when(':is([data-color="success"] > &, &[data-color="success"])', bg("success.solid")),
					when(':is([data-color="warning"] > &, &[data-color="warning"])', bg("warning.solid")),
					when(':is([data-color="danger"] > &, &[data-color="danger"])', bg("danger.solid")),
					when(':is([data-color="brand"] > &, &[data-color="brand"])', bg("brand.solid")),
					overlap
						? raw({
								boxShadow: "0 0 0 2px var(--ui-bg, Canvas)",
								"&:not(:first-child)": { marginInlineStart: "-0.1875rem" },
							})
						: undefined,
					pulse
						? [
								keyframes("ui-status-dot-pulse", {
									from: { opacity: 0.6, transform: "scale(1)" },
									to: { opacity: 0, transform: "scale(2.5)" },
								}),
								when(
									"&::after",
									raw({
										content: '""',
										position: "absolute",
										inset: 0,
										borderRadius: "inherit",
										backgroundColor: "inherit",
										opacity: 0,
									}),
								),
								motionSafe(
									when(
										"&::after",
										animationHost("ui-status-dot-pulse", {
											duration: "1.6s",
											easing: "cubic-bezier(0, 0, 0.2, 1)",
											iterationCount: "infinite",
										}),
									),
								),
							]
						: undefined,
				]}
			/>
		);
	};
}

/**
 * Renders a compact summary of several states, overlapping dots followed by `n/N`, for a
 * filter trigger that shows which statuses are on. The figures are visual; `label` is what
 * assistive technology reads.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the summary's markup.
 * @example <StatusDot.Summary colors={["success", "warning"]} count={2} total={5} label={t("filters.statusCount", { count: 2, total: 5 })} />
 */
StatusDot.Summary = function StatusDotSummary(handle: Handle<StatusDot.SummaryProps>) {
	return () => {
		let { colors, count, total, label, mix, ...rest } = handle.props;

		return (
			<span
				{...rest}
				data-slot="status-dot-summary"
				mix={mergeMix(
					[inlineFlex(), items("center"), raw({ gap: "0.375em" }), fontSize("sm"), nowrap()],
					mix,
				)}
			>
				<span aria-hidden="true" mix={[inlineFlex(), items("center")]}>
					{(colors ?? []).map((color, index) => (
						<Dot key={index} color={color} overlap />
					))}
				</span>
				<span aria-hidden="true" mix={[tabularNums(), fg("neutral.muted")]}>
					{count}/{total}
				</span>
				<span mix={[visuallyHidden()]}>{label}</span>
			</span>
		);
	};
};
