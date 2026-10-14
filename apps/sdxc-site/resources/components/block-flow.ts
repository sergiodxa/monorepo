/**
 * Spacing for a container that lays markdown blocks out as a flex column. Margins do
 * not collapse between flex items, so a block's own margin would stack on the gap and
 * again on the container's padding, leaving a blank line under the last one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mb } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";

/**
 * Hands the column's block spacing to its own `gap`.
 *
 * @returns A mixin for the flex column holding the blocks.
 * @example <div mix={[vstack({ gap: 4 }), blocksUseGap()]}>{children}</div>
 */
export function blocksUseGap() {
	return when("& > *", mb(0));
}
