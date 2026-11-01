/**
 * The `segmentedTrack()` and `segmentedItem()` style-mixin factories: the recessed track of a
 * segmented control and the segments inside it, with the chosen segment raised on a filled,
 * edged tile in heavier ink, so the choice reads at a glance in light and dark.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UtilityMixin } from "@sdxc/u";

import { combine, raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";

/**
 * Options accepted by {@link segmentedItem}.
 */
export interface SegmentedItemOptions {
	/**
	 * Selector, relative to the segment, that matches while it is the chosen one.
	 *
	 * @default '&[aria-pressed="true"]'
	 */
	selected?: string;
	/**
	 * Selector, relative to the segment, that matches while keyboard focus is on it.
	 *
	 * @default "&:focus-visible"
	 */
	focused?: string;
}

/** Selected-state selector for a segment that is itself a toggle button. */
const DEFAULT_SELECTED = '&[aria-pressed="true"]';

/** Focus selector for a segment that takes focus itself. */
const DEFAULT_FOCUSED = "&:focus-visible";

/**
 * Draws the track the segments sit in: a recessed tint with a hairline edge and an inner
 * padding that leaves room for the chosen segment's edge and the focus ring.
 *
 * @returns A `css()` mixin ready for the track's `mix` prop.
 * @example
 * <div role="group" aria-label={t("range")} mix={[segmentedTrack()]}>{segments}</div>;
 */
export function segmentedTrack<Node extends Element = Element>(): UtilityMixin<Node> {
	return raw<Node>({
		display: "inline-flex",
		alignItems: "center",
		gap: "0.125rem",
		padding: "0.125rem",
		borderRadius: "var(--ui-radius-md, 0.375rem)",
		backgroundColor: "var(--ui-neutral-bg-tint-hover, Canvas)",
		border: "1px solid var(--ui-neutral-border, GrayText)",
	});
}

/**
 * Draws one segment. A resting segment is muted ink on the track and takes a translucent
 * wash on hover; the chosen one is a raised tile edged in the strong border role, which
 * keeps at least 3:1 against the track in either scheme, with emphasis ink in semibold.
 * The states compose into one rule, so the chosen state wins whatever order layers land in.
 *
 * @param options Selectors for the chosen and focused states.
 * @returns A `css()` mixin ready for the segment's `mix` prop.
 * @example
 * <button aria-pressed={active ? "true" : "false"} mix={[segmentedItem()]}>{label}</button>;
 * @example
 * <label mix={[segmentedItem({ selected: "&:has(input:checked)", focused: "&:has(input:focus-visible)" })]} />;
 */
export function segmentedItem<Node extends Element = Element>(
	options: SegmentedItemOptions = {},
): UtilityMixin<Node> {
	let selected = options.selected ?? DEFAULT_SELECTED;
	let focused = options.focused ?? DEFAULT_FOCUSED;
	return combine<Node>([
		raw<Node>({
			border: "1px solid transparent",
			borderRadius: "var(--ui-radius-sm, 0.25rem)",
			backgroundColor: "transparent",
			color: "var(--ui-neutral-fg-muted, GrayText)",
			fontWeight: "500",
			"&:hover": {
				backgroundColor:
					"color-mix(in oklch, var(--ui-neutral-fg-emphasis, CanvasText) 7%, transparent)",
				color: "var(--ui-neutral-fg-emphasis, CanvasText)",
			},
		}),
		when<Node>(
			selected,
			raw<Node>({
				backgroundColor:
					"light-dark(var(--ui-surface-raised, Canvas), var(--ui-neutral-bg-tint-pressed, Canvas))",
				borderColor: "var(--ui-neutral-border-strong, CanvasText)",
				color: "var(--ui-neutral-fg-emphasis, CanvasText)",
				fontWeight: "600",
				boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.12)",
			}),
		),
		when<Node>(
			focused,
			raw<Node>({ outline: "2px solid var(--ui-brand-ring, Highlight)", outlineOffset: "1px" }),
		),
	]);
}
