/**
 * A thin bar rendered in the gap between two items of a reorderable list,
 * marking where a dragged item will land. It holds its space and paints
 * nothing until it becomes the pointer's current drop target, so a list can
 * carry one bar per gap and let each one answer for itself: the gaps stay the
 * same size throughout the drag, and only the one being pointed at is drawn.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { bg } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { bs, is } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { attrs } from "remix/component";

/**
 * Default {@link DropIndicator.Props.isDropTarget}, leaving the bar unpainted
 * until a consumer marks it as the active target.
 */
const DEFAULT_IS_DROP_TARGET = false;

/**
 * Default `aria-hidden` value applied through {@link attrs} unless a
 * consumer overrides it. Assistive technology already hears the drop
 * position through the reorder interaction's own live region.
 */
const DEFAULT_ARIA_HIDDEN = "true";

/**
 * Prop types for {@link DropIndicator}.
 */
export namespace DropIndicator {
	/**
	 * Props accepted by {@link DropIndicator}.
	 */
	export interface Props extends TagProps<"div"> {
		/**
		 * Whether this bar marks the pointer's current drop target. Renders
		 * the host's `data-drop-target` attribute when `true`, which is what
		 * draws the bar. Defaults to {@link DEFAULT_IS_DROP_TARGET}.
		 */
		isDropTarget?: boolean;
	}
}

/**
 * Renders a full-width, hairline-thick, fully rounded bar shaped for the gap
 * between two items in a reorderable list. The host's `data-drop-target`
 * attribute is what paints it: transparent without it, the primary solid color
 * with it.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the bar's markup.
 * @example
 * <DropIndicator isDropTarget={dropTargetKey === item.id} />
 * @example
 * <DropIndicator
 * 	isDropTarget={isCurrentTarget}
 * 	mix={css({ position: "absolute", insetInline: "0", insetBlockStart: "-1px" })}
 * />
 */
export function DropIndicator(handle: Handle<DropIndicator.Props>) {
	return () => {
		let { isDropTarget, mix, ...rest } = handle.props;
		let resolvedIsDropTarget = isDropTarget ?? DEFAULT_IS_DROP_TARGET;

		return (
			<div
				{...rest}
				data-drop-target={resolvedIsDropTarget ? "" : undefined}
				mix={[
					attrs({ "aria-hidden": DEFAULT_ARIA_HIDDEN }),
					is("full"),
					bs("0.125rem"),
					rounded("full"),
					transition("background-color", { duration: 150 }),
					/**
					 * The resting bar paints nothing while keeping its place, so only the targeted gap reads
					 * as marked and the list never reflows when one lights up. The states use exclusive
					 * selectors because each entry compiles into its own cascade layer, landing in any order.
					 */
					when("&:not([data-drop-target])", bg("transparent")),
					when("&[data-drop-target]", bg("brand.solid")),
					mix,
				]}
			/>
		);
	};
}
