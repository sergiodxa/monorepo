/**
 * A small floating label identifying an otherwise unlabeled control or
 * adding a supplementary hint, riding the same `popover`-attributed host and
 * CSS anchor positioning contract as {@link Popover}. Its reveal is plain
 * `:hover`/`:focus-visible` state read off the sibling immediately before it
 * in the DOM — the trigger — so pointing at or tabbing to that trigger
 * surfaces the hint with no script anywhere in the path.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { bg, fg, fill } from "@pkg/u/color";
import { opacity, rounded, shadow, transition, transitionBehavior } from "@pkg/u/effects";
import { block } from "@pkg/u/layout";
import { media, startingStyle } from "@pkg/u/responsive";
import { pb, pi } from "@pkg/u/size";
import { when } from "@pkg/u/state";
import { scaleProperty } from "@pkg/u/transform";
import { text } from "@pkg/u/typography";

import { durations, easings } from "../animations/tokens";

import { OverlayArrow } from "./overlay-arrow";
import { Popover } from "./popover";

/**
 * Side of the trigger {@link Tooltip} renders against when `placement` is
 * left unset — above the trigger, the most common resting spot for a hint
 * that shouldn't cover the control it describes.
 */
const DEFAULT_PLACEMENT: Popover.Placement = "top";

/**
 * Whether {@link Tooltip} renders its pointer-arrow child when a consumer
 * leaves `showArrow` unset.
 */
const DEFAULT_SHOW_ARROW = true;

/**
 * Selector matching the pointer-hovered trigger — the sibling immediately
 * before {@link Tooltip}'s host — for use only inside `@media (hover: hover)`,
 * wrapped in `:is()` since the style serializer treats a bare selector starting with `*` as a plain declaration.
 */
const HOVERED_TRIGGER_SELECTOR = ":is(*:hover) ~ &";

/**
 * Selector matching {@link Tooltip}'s entered state: native `:popover-open` —
 * set by a `popovertarget` (or `commandfor`/`command="toggle-popover"`)
 * invoker, or an `interestfor` attribute — or keyboard focus on the trigger sibling immediately before it.
 */
const ENTERED_SELECTOR = "&:popover-open, *:focus-visible ~ &";

/**
 * Prop types for {@link Tooltip}.
 */
export namespace Tooltip {
	/**
	 * Every prop {@link Popover.Props} accepts except `popover` and `role`,
	 * fixed here: `popover` is always `"hint"` so the tooltip layers over an
	 * open `"auto"` popover, and `role` is always `"tooltip"` per WAI-ARIA.
	 */
	export interface Props extends Omit<Popover.Props, "popover" | "role"> {
		/**
		 * Whether to render a pointer-arrow child pointing back at the trigger,
		 * filled to match this host's own solid background so the two read as
		 * one continuous shape. Defaults to {@link DEFAULT_SHOW_ARROW}.
		 */
		showArrow?: boolean;
	}
}

/**
 * Renders the hint through {@link Popover}, fixing `popover` to `"hint"` and
 * `role` to `"tooltip"`. The host stays present in the DOM, entering on
 * `:popover-open`, `:focus-visible`, or the trigger's hover, animated via `@starting-style`.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the hint's markup.
 * @example
 * <button popovertarget="save-tooltip" aria-describedby="save-tooltip">
 * 	{t("actions.save")}
 * </button>
 * <Tooltip id="save-tooltip">{t("actions.saveDescription")}</Tooltip>
 * @example
 * <a href="/settings" popovertarget="settings-tooltip" aria-describedby="settings-tooltip">
 * 	<GearIcon aria-hidden />
 * </a>
 * <Tooltip id="settings-tooltip" placement="right" showArrow={false}>
 * 	{t("nav.settings")}
 * </Tooltip>
 */
export function Tooltip(handle: Handle<Tooltip.Props>) {
	return () => {
		let { placement, showArrow, children, mix, ...rest } = handle.props;
		let resolvedPlacement = placement ?? DEFAULT_PLACEMENT;
		let resolvedShowArrow = showArrow ?? DEFAULT_SHOW_ARROW;

		return (
			<Popover
				{...rest}
				popover="hint"
				role="tooltip"
				placement={resolvedPlacement}
				mix={[
					rounded("md"),
					pi(2),
					pb(1),
					shadow("md"),
					bg("neutral.solid"),
					fg("neutral.onSolid"),
					opacity(0),
					transition("opacity, scale, display, overlay", {
						duration: durations.fast,
						easing: easings.standard,
					}),
					text("sm"),
					scaleProperty("0.95"),
					transitionBehavior("allow-discrete"),
					when(ENTERED_SELECTOR, [block(), opacity(100), scaleProperty("none")]),
					startingStyle(when(ENTERED_SELECTOR, [opacity(0), scaleProperty("0.95")])),
					media("(hover: hover)", [
						when(HOVERED_TRIGGER_SELECTOR, [block(), opacity(100), scaleProperty("none")]),
						startingStyle(when(HOVERED_TRIGGER_SELECTOR, [opacity(0), scaleProperty("0.95")])),
					]),
					media("(prefers-reduced-motion: reduce)", [
						transition("opacity, display, overlay", {
							duration: durations.fast,
							easing: easings.standard,
						}),
						scaleProperty("none"),
					]),
					mix,
				]}
			>
				{children}
				{resolvedShowArrow && (
					<OverlayArrow placement={resolvedPlacement} mix={fill("neutral.solid")}>
						<svg width={8} height={8} viewBox="0 0 8 8">
							<path d="M0 0 L4 4 L8 0" />
						</svg>
					</OverlayArrow>
				)}
			</Popover>
		);
	};
}
