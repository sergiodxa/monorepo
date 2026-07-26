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

import { fill } from "@pkg/u/color";
import { raw } from "@pkg/u/general";
import { absolute } from "@pkg/u/layout";
import { mb, mi } from "@pkg/u/size";
import { when } from "@pkg/u/state";
import { rotate } from "@pkg/u/transform";
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
const DEFAULT_ARIA_HIDDEN = true;

/**
 * Prop types for {@link OverlayArrow}.
 */
export namespace OverlayArrow {
	/**
	 * Side (and, for the four corner variants, alignment) of the trigger an
	 * overlay renders relative to. {@link OverlayArrow} reads only the leading
	 * segment (`"top"`, `"bottom"`, `"left"`, or `"right"`) to choose which
	 * edge it attaches to and how it's oriented; the `-start`/`-end` suffix
	 * carries no visual effect of its own on the arrow.
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
 * Renders a decorative pointer glyph as an absolutely positioned `<div>`
 * carrying a `data-placement` attribute, filling its child shape with the
 * same tint as the overlay surface it belongs to so the two blend into one
 * shape. The arrow attaches to the edge of the overlay nearest the trigger —
 * the block-start edge when the overlay renders below the trigger
 * (`"bottom"`), the block-end edge when it renders above (`"top"`), and the
 * physical right or left edge when it renders to the trigger's left or right
 * — and rotates to point back toward it. The `"left"`/`"right"` sides name a
 * physical side of the viewport chosen by the positioning engine rather than
 * a reading-direction-relative one, so the arrow keeps attaching to that same
 * physical side under any `dir` value. Its own child (an inline `<svg>`
 * triangle, typically) supplies the actual arrow shape and size.
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
					raw({ pointerEvents: "none" }),
					// `insetBlockStart`/`insetInlineStart`/`insetInlineEnd`/`left`/`right`
					// have no `@pkg/u` equivalent — only the full logical `inset()`
					// shorthand exists, which would also touch the untouched sides here.
					when('&[data-placement^="bottom"]', [
						mi("auto"),
						rotate(180),
						raw({
							insetBlockStart: "calc(var(--ui-overlay-arrow-offset, 0.5rem) * -1)",
							insetInlineStart: "0",
							insetInlineEnd: "0",
						}),
					]),
					when('&[data-placement^="top"]', [
						mi("auto"),
						raw({
							insetBlockEnd: "calc(var(--ui-overlay-arrow-offset, 0.5rem) * -1)",
							insetInlineStart: "0",
							insetInlineEnd: "0",
						}),
					]),
					when('&[data-placement^="left"]', [
						mb("auto"),
						rotate(-90),
						raw({ left: "100%", insetBlockStart: "0", insetBlockEnd: "0" }),
					]),
					when('&[data-placement^="right"]', [
						mb("auto"),
						rotate(90),
						raw({ right: "100%", insetBlockStart: "0", insetBlockEnd: "0" }),
					]),
					mix,
				]}
			/>
		);
	};
}
