/**
 * A small "+" mark centred on a corner of its positioned ancestor, the registration mark a
 * ruled page draws where a rail meets a rule. Purely decorative: it is hidden from assistive
 * technology and ignores the pointer, so it never changes what a visitor can reach.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { raw } from "@sdxc/u/general";

/** Mark size {@link Crosshair} draws when `size` is omitted. */
const DEFAULT_SIZE: Crosshair.Size = "md";

/** Corner {@link Crosshair} sits on when `corner` is omitted. */
const DEFAULT_CORNER: Crosshair.Corner = "start-start";

/**
 * Edge length of each mark. Both are odd, so the 1px arms sit on whole pixels at the
 * centre of the box.
 */
const SIZES: Record<Crosshair.Size, string> = { sm: "11px", md: "21px" };

/** Ink the arms draw with: the marketing hairline, so marks read as part of the rules. */
const INK = "var(--ui-marketing-hairline, color-mix(in oklch, CanvasText 8%, transparent))";

/**
 * Prop types for {@link Crosshair}.
 */
export namespace Crosshair {
	/** `sm` is an 11px mark for dense grids; `md` is the 21px mark a band corner takes. */
	export type Size = "sm" | "md";

	/**
	 * Corner of the positioned ancestor the mark centres on, as `<block>-<inline>` in
	 * logical terms, so a right-to-left page mirrors the marks with its content.
	 */
	export type Corner = "start-start" | "start-end" | "end-start" | "end-end";

	/**
	 * Props accepted by {@link Crosshair}.
	 */
	export interface Props extends Omit<TagProps<"span">, "children"> {
		/** Corner to centre on. Defaults to {@link DEFAULT_CORNER}. */
		corner?: Corner;
		/** Mark size. Defaults to {@link DEFAULT_SIZE}. */
		size?: Size;
	}
}

/**
 * Draws a "+" in hairline ink, absolutely positioned and centred on one corner of the
 * nearest positioned ancestor by a negative half-size margin on every side. Give the
 * ancestor `position: relative`; logical insets put the mark on the mirrored corner in RTL.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the mark.
 * @example
 * <div mix={[relative()]}>
 * 	<Crosshair corner="start-start" />
 * 	<Crosshair corner="end-end" size="sm" />
 * </div>
 */
export function Crosshair(handle: Handle<Crosshair.Props>) {
	return () => {
		let { corner, mix, size, ...rest } = handle.props;
		let resolvedCorner = corner ?? DEFAULT_CORNER;
		let resolvedSize = size ?? DEFAULT_SIZE;
		let [block, inline] = resolvedCorner.split("-");
		let edge = SIZES[resolvedSize];

		return (
			<span
				aria-hidden="true"
				{...rest}
				data-slot="crosshair"
				data-corner={resolvedCorner}
				data-size={resolvedSize}
				mix={[
					raw({
						position: "absolute",
						display: "block",
						insetBlockStart: block === "start" ? "0" : "auto",
						insetBlockEnd: block === "end" ? "0" : "auto",
						insetInlineStart: inline === "start" ? "0" : "auto",
						insetInlineEnd: inline === "end" ? "0" : "auto",
						margin: `calc(${edge} / -2)`,
						inlineSize: edge,
						blockSize: edge,
						pointerEvents: "none",
						background: `linear-gradient(${INK}, ${INK}) center / 100% 1px no-repeat, linear-gradient(${INK}, ${INK}) center / 1px 100% no-repeat`,
					}),
					mix,
				]}
			/>
		);
	};
}
