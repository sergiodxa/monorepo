/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens.js";

import { if as ifUtility } from "../general/if.js";
import { compose } from "../internal/descriptor.js";

import type { StackOptions } from "./hstack.js";
import type { AlignItemsValue } from "./items.js";
import type { JustifyValue } from "./justify.js";

import { flexCol } from "./flex-col.js";
import { flex } from "./flex.js";
import { gap } from "./gap.js";
import { items } from "./items.js";
import { justify } from "./justify.js";

/**
 * A vertical flex stack. Composes `u.flex()`, `u.flexCol()`, and — from
 * whichever option keys are given — `u.gap()`, `u.items()`, and
 * `u.justify()`.
 *
 * @example u.vstack({ gap: 4, align: "stretch" })
 * @example css({ display: "flex", flexDirection: "column", gap: "calc(var(--ui-spacing, 0.25rem) * 4)", alignItems: "stretch" })
 */
export function vstack<Node extends Element = Element>(options: StackOptions = {}) {
	return compose<Node>(
		[
			flex<Node>(),
			flexCol<Node>(),
			ifUtility(options.gap !== undefined, gap<Node>(options.gap as SpacingValue)),
			ifUtility(options.align !== undefined, items<Node>(options.align as AlignItemsValue)),
			ifUtility(options.justify !== undefined, justify<Node>(options.justify as JustifyValue)),
		],
		(styles) => styles,
	);
}
