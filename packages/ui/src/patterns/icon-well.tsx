/**
 * A rounded square tile that holds a marketing metaphor glyph — a quiet
 * hairline ring by default, or a brand-tinted badge. Distinct from
 * product-chrome icons and UI chrome: wells are the claim-cell affordance size.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import type { Feature } from "../components/feature.js";

import { iconTile } from "../styles/card-grid.js";

/** Side length {@link IconWell} applies when `size` is omitted. */
const DEFAULT_SIZE: IconWell.Size = "md";

/** Tile chrome {@link IconWell} applies when `tone` is omitted. */
const DEFAULT_TONE: IconWell.Tone = "quiet";

/** Side length on the spacing scale for each footprint: 2rem, 2.5rem, 3rem. */
const SIDE_BY_SIZE: Record<IconWell.Size, number> = { sm: 8, md: 10, lg: 12 };

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
	 * Tile chrome: a `quiet` hairline ring in the heading ink, or a `brand`
	 * tinted and bordered badge for a claim that should read as a highlight.
	 */
	export type Tone = Feature.IconTone;

	/**
	 * Props accepted by {@link IconWell}.
	 */
	export interface Props extends TagProps<"span"> {
		/** Footprint. Defaults to {@link DEFAULT_SIZE}. */
		size?: Size;
		/** Tile chrome. Defaults to {@link DEFAULT_TONE}. */
		tone?: Tone;
		/** Glyph rendered inside the well — typically an `@sdxc/icons` icon. */
		children: RemixNode;
	}
}

/**
 * Centers a glyph in a rounded square so marketing claim icons share one size
 * language across bands, with the same tile {@link Feature.Icon} draws.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the well's markup.
 * @example
 * <IconWell><ZapIcon size={18} aria-hidden="true" /></IconWell>
 * @example
 * <IconWell tone="brand"><ZapIcon size={18} aria-hidden="true" /></IconWell>
 */
export function IconWell(handle: Handle<IconWell.Props>) {
	return () => {
		let { mix, size, tone, ...rest } = handle.props;
		let resolvedSize = size ?? DEFAULT_SIZE;
		let resolvedTone = tone ?? DEFAULT_TONE;

		return (
			<span
				{...rest}
				data-slot="icon-well"
				data-size={resolvedSize}
				data-tone={resolvedTone}
				mix={[iconTile(resolvedTone, SIDE_BY_SIZE[resolvedSize]), mix]}
			/>
		);
	};
}
