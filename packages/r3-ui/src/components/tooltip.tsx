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

import { bg, fg } from "@pkg/u/color";
import { rounded, shadow } from "@pkg/u/effects";
import { pb, pi } from "@pkg/u/size";
import { css } from "remix/ui";

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
 * Selector matching the sibling immediately before {@link Tooltip}'s host —
 * the trigger — while it's pointer-hovered. Read only from inside an
 * `@media (hover: hover)` block (see the render function below), so a coarse
 * pointer that merely taps the trigger never latches into a stuck-open hover
 * state.
 */
const HOVERED_TRIGGER_SELECTOR = "*:hover ~ &";

/**
 * Selector matching {@link Tooltip}'s entered state through either its own
 * native `:popover-open` — set once a consumer's `popovertarget` (or
 * `commandfor`/`command="toggle-popover"`) invoker activates it, or, once
 * broadly supported, an `interestfor` attribute pointing at this host's `id`
 * — or the trigger sibling immediately before it carrying keyboard focus.
 * Unlike {@link HOVERED_TRIGGER_SELECTOR}, this path needs no hover
 * capability, so it stays available to a keyboard or switch-control user
 * regardless of pointer type.
 */
const ENTERED_SELECTOR = "&:popover-open, *:focus-visible ~ &";

/**
 * Prop types for {@link Tooltip}.
 */
export namespace Tooltip {
	/**
	 * Every prop {@link Popover.Props} accepts except `popover` and `role`,
	 * which this component fixes on the consumer's behalf: `popover` is
	 * always `"hint"`, so the tooltip layers over an already-open `"auto"`
	 * popover instead of dismissing it, and `role` is always `"tooltip"`,
	 * satisfying the WAI-ARIA tooltip pattern without a consumer needing to
	 * repeat it.
	 */
	export interface Props extends Omit<Popover.Props, "popover" | "role"> {
		/**
		 * Whether to render a pointer-arrow child pointing back at the trigger.
		 * Defaults to {@link DEFAULT_SHOW_ARROW}.
		 */
		showArrow?: boolean;
	}
}

/**
 * Renders the hint itself through {@link Popover}, inheriting its
 * `popover`-attributed host, `data-placement` contract, and CSS anchor
 * positioning, with `popover` fixed to `"hint"` and `role` fixed to
 * `"tooltip"`. The host stays transparent to layout and fully present in the
 * DOM at all times — its exit state (`opacity: 0`, `scale: 0.95`, and the
 * platform's own `display: none` default for an unopened `[popover]`) lifts
 * the moment the sibling immediately before it (the trigger) is
 * pointer-hovered under `@media (hover: hover)`, carries `:focus-visible`,
 * or the host itself reaches `:popover-open` — the state a `popovertarget`
 * (or `commandfor`) invoker on that same trigger sets when activated, and
 * the state an `interestfor` attribute will set declaratively once that
 * platform feature lands more broadly. A `@starting-style` block paired with
 * `transition-behavior: allow-discrete` animates every one of those entries
 * as a fade paired with a scale, and `@media (prefers-reduced-motion:
 * reduce)` collapses that motion to the opacity fade alone.
 *
 * `showArrow` renders {@link OverlayArrow} as the panel's last child by
 * default, filled to match this host's own solid background instead of
 * {@link OverlayArrow}'s tinted default, so the two read as one continuous
 * shape.
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
					css({
						fontSize: "0.875rem",
						lineHeight: "calc(1.25 / 0.875)",

						opacity: "0",
						scale: "0.95",
						transitionProperty: "opacity, scale, display, overlay",
						transitionDuration: `${durations.fast}ms`,
						transitionTimingFunction: easings.standard,
						transitionBehavior: "allow-discrete",

						[ENTERED_SELECTOR]: {
							display: "block",
							opacity: "1",
							scale: "none",
						},
						"@starting-style": {
							[ENTERED_SELECTOR]: {
								opacity: "0",
								scale: "0.95",
							},
						},

						"@media (hover: hover)": {
							[HOVERED_TRIGGER_SELECTOR]: {
								display: "block",
								opacity: "1",
								scale: "none",
							},
							"@starting-style": {
								[HOVERED_TRIGGER_SELECTOR]: {
									opacity: "0",
									scale: "0.95",
								},
							},
						},

						"@media (prefers-reduced-motion: reduce)": {
							scale: "none",
							transitionProperty: "opacity, display, overlay",
						},
					}),
					mix,
				]}
			>
				{children}
				{resolvedShowArrow && (
					<OverlayArrow
						placement={resolvedPlacement}
						mix={css({ fill: "var(--ui-neutral-bg-solid)" })}
					>
						<svg width={8} height={8} viewBox="0 0 8 8">
							<path d="M0 0 L4 4 L8 0" />
						</svg>
					</OverlayArrow>
				)}
			</Popover>
		);
	};
}
