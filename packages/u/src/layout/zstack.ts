import { if as ifUtility } from "../general/if";
import { compose, utility } from "../internal/descriptor";
import { when } from "../state/when";

/**
 * A CSS Grid overlay pattern rather than absolute positioning: every direct
 * child is placed in the same single grid cell (`grid-area: 1 / 1`) instead
 * of being taken out of flow. Overlapping children this way still
 * participate in the grid's intrinsic sizing — the host element sizes to
 * its largest child the same way it would with only one child present —
 * where `position: absolute` children collapse the parent to zero size
 * unless a height is set by hand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { AlignItemsValue } from "./items";

import { grid } from "./grid";
import { items } from "./items";

export interface ZStackOptions {
	/** Sets `align-items`. */
	align?: AlignItemsValue;
	/**
	 * Sets `justify-items`. Takes the same self-alignment keywords as
	 * `align`, not `u.justify()`'s `between`/`around`/`evenly` distribution
	 * keywords — `justify-items` positions a grid item within its own cell
	 * rather than distributing space along a track, so those keywords aren't
	 * valid here.
	 */
	justify?: AlignItemsValue;
}

/**
 * A grid-overlay stack for layering children on top of each other. Composes
 * `u.grid()` and — when given — `u.items()` for `align-items`;
 * `justify-items` has no dedicated utility of its own to compose, so it's
 * set directly. Every direct child is stacked into the same grid cell so
 * they overlap instead of flowing.
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
