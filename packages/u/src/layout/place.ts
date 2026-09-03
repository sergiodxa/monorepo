/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { if as ifUtility } from "../general/if.js";
import { compose, utility } from "../internal/descriptor.js";

import type { AlignItemsValue } from "./items.js";
import type { JustifyValue } from "./justify.js";

import { content } from "./content.js";
import { items } from "./items.js";
import { justify } from "./justify.js";

export interface PlaceOptions {
	/** Sets `align-items` and `justify-items` together. */
	items?: AlignItemsValue;
	/** Sets `align-content` and `justify-content` together. */
	content?: JustifyValue;
}

/**
 * Sets item and/or content placement on both axes from whichever option
 * keys are given, so a partial options object emits only the declarations
 * belonging to the keys it carries.
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
