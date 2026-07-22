/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens";

import { if as ifUtility } from "../general/if";
import { compose } from "../internal/descriptor";

import type { AlignItemsValue } from "./items";
import type { JustifyValue } from "./justify";

import { flex } from "./flex";
import { flexRow } from "./flex-row";
import { gap } from "./gap";
import { items } from "./items";
import { justify } from "./justify";

export interface StackOptions {
	/** Sets `gap` using the spacing scale or a raw CSS length. */
	gap?: SpacingValue;
	/** Sets `align-items`. */
	align?: AlignItemsValue;
	/** Sets `justify-content`, aliasing `between`/`around`/`evenly` the same way `u.justify()` does. */
	justify?: JustifyValue;
}

/**
 * A horizontal flex stack. Composes `u.flex()`, `u.flexRow()`, and — from
 * whichever option keys are given — `u.gap()`, `u.items()`, and
 * `u.justify()`.
 *
 * @example u.hstack({ gap: 4, align: "center", justify: "between" })
 * @example css({ display: "flex", flexDirection: "row", gap: "calc(var(--ui-spacing, 0.25rem) * 4)", alignItems: "center", justifyContent: "space-between" })
 */
export function hstack<Node extends Element = Element>(options: StackOptions = {}) {
	return compose<Node>(
		[
			flex<Node>(),
			flexRow<Node>(),
			ifUtility(options.gap !== undefined, gap<Node>(options.gap as SpacingValue)),
			ifUtility(options.align !== undefined, items<Node>(options.align as AlignItemsValue)),
			ifUtility(options.justify !== undefined, justify<Node>(options.justify as JustifyValue)),
		],
		(styles) => styles,
	);
}
