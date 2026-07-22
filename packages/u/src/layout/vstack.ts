/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens";

import { if as ifUtility } from "../general/if";
import { compose } from "../internal/descriptor";

import type { StackOptions } from "./hstack";
import type { AlignItemsValue } from "./items";
import type { JustifyValue } from "./justify";

import { flex } from "./flex";
import { flexCol } from "./flex-col";
import { gap } from "./gap";
import { items } from "./items";
import { justify } from "./justify";

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
