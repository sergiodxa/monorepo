/**
 * A small pointer glyph anchoring an overlay surface — a popover, a menu, a
 * tooltip — visually back to the trigger it floats beside. It renders as an
 * absolutely positioned host holding whatever arrow shape a consumer draws
 * as its child (typically an inline `<svg>`), oriented and offset by the
 * `data-placement` attribute contract.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { fill } from "@sdxc/u/color";
import { calc, pointerEvents, var as varUtility } from "@sdxc/u/general";
import { absolute, insBe, insBs, insIe, insIs, insLeft, insRight } from "@sdxc/u/layout";
import { mb, mi } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { rotate } from "@sdxc/u/transform";
import { attrs } from "remix/ui";

/**
 * Side of the overlay {@link OverlayArrow} attaches to when `placement` is
 * left unset. Matches the side an overlay renders on when its own placement
 * request goes unanswered by the positioning engine.
 */
const DEFAULT_PLACEMENT: OverlayArrow.Placement = "bottom";

/**
 * `aria-hidden="true"` applied through {@link attrs} unless a consumer
 * overrides it, keeping the purely decorative pointer glyph out of the
 * accessibility tree.
 */
const DEFAULT_ARIA_HIDDEN = "true";

/**
 * Prop types for {@link OverlayArrow}.
 */
export namespace OverlayArrow {
	/**
	 * Side (and, for the four corner variants, alignment) of the trigger an
	 * overlay renders relative to. {@link OverlayArrow} reads only the leading
	 * segment; the `-start`/`-end` suffix carries no visual effect on the arrow.
	 */
	export type Placement =
		| "top"
		| "top-start"
		| "top-end"
		| "bottom"
		| "bottom-start"
		| "bottom-end"
		| "left"
		| "left-start"
		| "left-end"
		| "right"
		| "right-start"
		| "right-end";

	/**
	 * Every native `<div>` attribute, plus the `mix` passthrough, plus the
	 * `placement` that drives which edge of the overlay the arrow attaches to.
	 */
	export interface Props extends TagProps<"div"> {
		/**
		 * Side of the trigger the overlay renders on. Defaults to
		 * {@link DEFAULT_PLACEMENT}.
		 */
		placement?: Placement;
	}
}

/**
 * Renders a decorative pointer glyph, rotating to point back at the trigger
 * from whichever edge the overlay attaches to. `"left"`/`"right"` name a
 * physical viewport side, so the arrow keeps attaching there under any `dir`.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the arrow's markup.
 * @example
 * <Popover>
 * 	<OverlayArrow placement="bottom">
 * 		<svg width={12} height={12} viewBox="0 0 12 12">
 * 			<path d="M0 0 L6 6 L12 0" />
 * 		</svg>
 * 	</OverlayArrow>
 * 	{content}
 * </Popover>
 */
export function OverlayArrow(handle: Handle<OverlayArrow.Props>) {
	return () => {
		let { placement, mix, ...rest } = handle.props;
		let resolvedPlacement = placement ?? DEFAULT_PLACEMENT;

		return (
			<div
				data-placement={resolvedPlacement}
				{...rest}
				mix={[
					attrs({ "aria-hidden": DEFAULT_ARIA_HIDDEN }),
					absolute(),
					fill("neutral.tint"),
					pointerEvents(),
					when('&[data-placement^="bottom"]', [
						mi("auto"),
						rotate(180),
						insBs(calc(`${varUtility("ui-overlay-arrow-offset", "0.5rem")} * -1`)),
						insIs("0"),
						insIe("0"),
					]),
					when('&[data-placement^="top"]', [
						mi("auto"),
						insBe(calc(`${varUtility("ui-overlay-arrow-offset", "0.5rem")} * -1`)),
						insIs("0"),
						insIe("0"),
					]),
					when('&[data-placement^="left"]', [
						mb("auto"),
						rotate(-90),
						insLeft("100%"),
						insBs("0"),
						insBe("0"),
					]),
					when('&[data-placement^="right"]', [
						mb("auto"),
						rotate(90),
						insRight("100%"),
						insBs("0"),
						insBe("0"),
					]),
					mix,
				]}
			/>
		);
	};
}
