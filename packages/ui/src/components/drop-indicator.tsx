/**
 * A thin bar rendered in the gap between two items of a reorderable list,
 * marking where a dragged item will land. It sits in a muted ring tone at
 * rest and switches to the primary solid color once it becomes the
 * pointer's current drop target, with the surrounding list's own reorder
 * interaction deciding when it appears and which gap it marks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { bg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { bs, is } from "@pkg/u/size";
import { when } from "@pkg/u/state";
import { attrs } from "remix/ui";

/**
 * Default {@link DropIndicator.Props.isDropTarget}, rendering the bar in
 * its muted resting tone until a consumer marks it as the active target.
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
		 * the host's `data-drop-target` attribute when `true`, switching the
		 * bar to its active color. Defaults to {@link DEFAULT_IS_DROP_TARGET}.
		 */
		isDropTarget?: boolean;
	}
}

/**
 * Renders a full-width, hairline-thick, fully rounded bar shaped for the gap
 * between two items in a reorderable list. Its color follows the host's
 * `data-drop-target` attribute: muted at rest, solid as the active target.
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
					bg("brand.ring"),
					when("&[data-drop-target]", bg("brand.solid")),
					mix,
				]}
			/>
		);
	};
}
