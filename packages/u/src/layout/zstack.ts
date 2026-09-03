/**
 * Every direct child shares one grid cell (`grid-area: 1 / 1`), so they
 * overlap while still counting toward the grid's intrinsic sizing — the
 * host sizes to its largest child just as it would with only one child
 * present.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { if as ifUtility } from "../general/if.js";
import { compose, utility } from "../internal/descriptor.js";
import { when } from "../state/when.js";

import type { AlignItemsValue } from "./items.js";

import { grid } from "./grid.js";
import { items } from "./items.js";

export interface ZStackOptions {
	/** Sets `align-items`. */
	align?: AlignItemsValue;
	/**
	 * Sets `justify-items` using the same self-alignment keywords as `align`,
	 * since `justify-items` positions a grid item within its own cell.
	 */
	justify?: AlignItemsValue;
}

/**
 * A grid-overlay stack for layering children on top of each other. Composes
 * `u.grid()` and, when given, `u.items()` for `align-items`; `justify-items`
 * has no dedicated utility, so it's set directly.
 *
 * @example u.zstack({ align: "center", justify: "center" })
 * @example css({ display: "grid", alignItems: "center", justifyItems: "center", "& > *": { gridArea: "1 / 1" } })
 */
export function zstack<Node extends Element = Element>(options: ZStackOptions = {}) {
	let justifyItems = ifUtility(
		options.justify !== undefined,
		utility<Node>(() => ({ justifyItems: options.justify as AlignItemsValue })),
	);
	let overlay = when<Node>(
		"& > *",
		utility<Node>(() => ({ gridArea: "1 / 1" })),
	);

	return compose<Node>(
		[
			grid<Node>(),
			ifUtility(options.align !== undefined, items<Node>(options.align as AlignItemsValue)),
			justifyItems,
			overlay,
		],
		(styles) => styles,
	);
}
