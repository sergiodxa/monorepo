/**
 * The edge, rounding, tint, and elevation a floating surface — an anchored
 * popover, a hover-revealed card, a navigation panel, a command list — draws
 * on its own host, plus the inset and concentric radius a surface padding a
 * stack of rounded rows shares with them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityMixin } from "@sdxc/u";

import { bg, border } from "@sdxc/u/color";
import { rounded, shadow } from "@sdxc/u/effects";
import { combine, raw, vars } from "@sdxc/u/general";
import { p } from "@sdxc/u/size";

/**
 * The hairline ring plus soft lift an elevated surface draws its edge with,
 * read from the theme's `--ui-shadow-ring`; the fallback is its light value.
 */
export const SHADOW_RING =
	"var(--ui-shadow-ring, 0 0 0 1px rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06), 0 2px 4px 0 rgb(0 0 0 / 0.04))";

/**
 * The gap between a floating surface's edge and the rounded rows it stacks,
 * one source for both the padding and the radius derived from it.
 */
export const SURFACE_PADDING = "var(--ui-surface-padding, 0.25rem)";

/** The radius every row inside a padded surface rounds its own corners with. */
const ROW_RADIUS = "var(--ui-radius-md, 0.375rem)";

/**
 * Composes the shared floating-surface edge, tint, and elevation as a mixin.
 * The edge is a ring shadow in the composite `box-shadow`'s ring slot over a
 * transparent 1px border, which forced-colors mode still paints as a line.
 *
 * @returns A mixin ready for a host element's `mix` prop.
 * @example
 * <div
 * 	popover="auto"
 * 	mix={[
 * 		floatingSurface(),
 * 		css({ margin: "0", inset: "auto" }),
 * 	]}
 * >
 * 	{content}
 * </div>;
 */
export function floatingSurface<Node extends Element = Element>(): UtilityMixin<Node> {
	return combine<Node>([
		rounded<Node>("lg"),
		border<Node>({ color: "transparent", width: 1 }),
		bg<Node>("neutral.tint"),
		shadow<Node>("lg"),
		vars<Node>({ "ui-box-shadow-ring": SHADOW_RING }),
	]);
}

/**
 * Options accepted by {@link surfaceInset}.
 */
export namespace SurfaceInset {
	export interface Options {
		/** Multiple of `--ui-surface-padding` the surface pads its rows by. Defaults to `1`. */
		scale?: number;
	}
}

/**
 * Pads a surface around its rounded rows and rounds the surface concentric
 * with them: its radius is the rows' `--ui-radius-md` plus that padding, so
 * the gap between the two curves stays even whichever tokens an app sets.
 *
 * @param options How many `--ui-surface-padding` steps the surface pads by.
 * @returns A mixin ready for a host element's `mix` prop, after {@link floatingSurface}.
 * @example
 * <Popover id="actions" mix={[surfaceInset()]}>{rows}</Popover>;
 * @example
 * <Popover id="products" mix={[surfaceInset({ scale: 2 })]}>{links}</Popover>;
 */
export function surfaceInset<Node extends Element = Element>(
	options: SurfaceInset.Options = {},
): UtilityMixin<Node> {
	let padding = surfacePadding(options.scale ?? 1);

	return combine<Node>([p<Node>(padding), raw<Node>({ borderRadius: concentricRadius(padding) })]);
}

/**
 * The padding {@link surfaceInset} applies for a given number of
 * `--ui-surface-padding` steps, for a part that pads along one axis only.
 *
 * @param scale Multiple of `--ui-surface-padding`.
 * @returns A CSS length.
 * @example surfacePadding(1) // "var(--ui-surface-padding, 0.25rem)"
 */
export function surfacePadding(scale: number): string {
	return scale === 1 ? SURFACE_PADDING : `calc(${SURFACE_PADDING} * ${scale})`;
}

/**
 * The radius a surface takes to stay concentric with rows set `padding` in
 * from its edge: the rows' own radius plus that gap.
 *
 * @param padding The gap between the surface edge and its rows.
 * @param rowRadius The radius the rows round their corners with. Defaults to `--ui-radius-md`.
 * @returns A CSS length.
 * @example concentricRadius(surfacePadding(1))
 * @example concentricRadius(surfacePadding(1), "var(--ui-radius-sm, 0.25rem)")
 */
export function concentricRadius(padding: string, rowRadius: string = ROW_RADIUS): string {
	return `calc(${rowRadius} + ${padding})`;
}
