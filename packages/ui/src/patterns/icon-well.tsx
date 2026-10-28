/**
 * A tinted rounded square that holds a marketing metaphor glyph. Distinct from
 * product-chrome icons (~14px stroke) and UI chrome (chevrons, copy, search) —
 * wells are the claim-cell affordance size.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { center, inlineFlex } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";

/** Side length {@link IconWell} applies when `size` is omitted. */
const DEFAULT_SIZE: IconWell.Size = "md";

/**
 * Prop types for {@link IconWell}.
 */
export namespace IconWell {
	/**
	 * Well footprint: compact for dense grids, medium for feature cells, large
	 * for hero metaphors.
	 */
	export type Size = "sm" | "md" | "lg";

	/**
	 * Props accepted by {@link IconWell}.
	 */
	export interface Props extends TagProps<"span"> {
		/** Footprint. Defaults to {@link DEFAULT_SIZE}. */
		size?: Size;
		/** Glyph rendered inside the well — typically an `@sdxc/icons` icon. */
		children: RemixNode;
	}
}

/**
 * Centers a glyph in a brand-tinted rounded square so marketing claim icons
 * share one size language across bands.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the well's markup.
 * @example
 * <IconWell><ZapIcon size={18} aria-hidden="true" /></IconWell>
 */
export function IconWell(handle: Handle<IconWell.Props>) {
	return () => {
		let { mix, size, ...rest } = handle.props;
		let resolvedSize = size ?? DEFAULT_SIZE;
		let side = 10;
		if (resolvedSize === "sm") side = 8;
		else if (resolvedSize === "lg") side = 12;

		return (
			<span
				{...rest}
				data-slot="icon-well"
				data-size={resolvedSize}
				mix={[
					inlineFlex(),
					center(),
					is(side),
					bs(side),
					rounded("lg"),
					bg("brand.tint"),
					fg("brand"),
					border({ color: "brand", width: 1, style: "solid" }),
					mix,
				]}
			/>
		);
	};
}
