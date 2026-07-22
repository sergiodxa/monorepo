/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { if as ifUtility } from "../general/if";
import { compose, utility } from "../internal/descriptor";

import type { AlignItemsValue } from "./items";
import type { JustifyValue } from "./justify";

import { content } from "./content";
import { items } from "./items";
import { justify } from "./justify";

export interface PlaceOptions {
	/** Sets `align-items` and `justify-items` together. */
	items?: AlignItemsValue;
	/** Sets `align-content` and `justify-content` together. */
	content?: JustifyValue;
}

/**
 * Sets item and/or content placement on both axes from whichever option
 * keys are given, leaving the other untouched when its key is omitted.
 * Composes `u.items()` for `align-items` and `u.content()`/`u.justify()`
 * for `align-content`/`justify-content`; `justify-items` has no dedicated
 * utility of its own to compose, so it's set directly alongside `u.items()`.
 *
 * @example u.place({ items: "center", content: "between" })
 * @example css({ alignItems: "center", justifyItems: "center", alignContent: "space-between", justifyContent: "space-between" })
 */
export function place<Node extends Element = Element>(options: PlaceOptions = {}) {
	let itemsUtility = ifUtility(
		options.items !== undefined,
		compose<Node>(
			[
				items<Node>(options.items as AlignItemsValue),
				utility<Node>(() => ({ justifyItems: options.items as AlignItemsValue })),
			],
			(styles) => styles,
		),
	);
	let contentUtility = ifUtility(
		options.content !== undefined,
		compose<Node>(
			[
				content<Node>(options.content as JustifyValue),
				justify<Node>(options.content as JustifyValue),
			],
			(styles) => styles,
		),
	);
	return compose<Node>([itemsUtility, contentUtility], (styles) => styles);
}
