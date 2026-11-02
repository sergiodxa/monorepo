/**
 * Where a stat's delta sits as the group around it changes layout, shared by the delta and
 * every placeholder standing in for it, so a loading card moves its delta by the same
 * container queries the resolved card does and keeps the card's height.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ElementProps, MixinDescriptor } from "remix/component";

import { raw } from "@sdxc/u/general";

import type { CSSStyles } from "../../utils/css-styles.js";

/** Container a stat group measures, so its columns follow the pane it sits in. */
export const STAT_GROUP_CONTAINER = "ui-stat-group";

/**
 * A group from 18rem up to 28rem wide: two columns of compact cards, so a phone shows four
 * stats in two rows. Narrower than 18rem, a group keeps one column of full-size cards.
 */
export const STAT_COMPACT = `@container ${STAT_GROUP_CONTAINER} (min-width: 18rem) and (max-width: 27.9375rem)`;

/**
 * Places the delta at the end of the label's line in a card, and on its own line under the
 * value in ruled columns, tabs and compact cards, where its comparison wraps under the pill
 * before it overflows.
 *
 * @returns A mixin for the delta's host element.
 * @example
 * <span mix={[statDeltaPlacement()]}>{pill}{comparison}</span>
 */
export function statDeltaPlacement<Node extends Element = Element>(): MixinDescriptor<
	Node,
	[styles: CSSStyles],
	ElementProps
> {
	return raw<Node>({
		order: 1,
		justifySelf: "end",
		'[data-stat-group="ruled"] > * > &, [data-stat-group="tabs"] > * > &': {
			order: 3,
			gridColumn: "1 / -1",
			justifySelf: "start",
		},
		[STAT_COMPACT]: {
			"[data-stat-split] > * > &": {
				order: 3,
				gridColumn: "1 / -1",
				justifySelf: "start",
				flexWrap: "wrap",
			},
		},
	});
}
