/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Applies the `content-visibility: auto` + `contain-intrinsic-size` pair that
 * lets the browser skip rendering work for off-screen rows in a long
 * scrollable list or table body, while reserving `intrinsicSize` as its
 * placeholder size so the scrollbar doesn't jump around as content mounts.
 *
 * @example u.virtualize("auto var(--ui-table-row-size, 2.5rem)")
 * @example css({ contentVisibility: "auto", containIntrinsicSize: "auto var(--ui-table-row-size, 2.5rem)" })
 */
export function virtualize<Node extends Element = Element>(intrinsicSize: string) {
	return utility<Node>(() => ({
		contentVisibility: "auto",
		containIntrinsicSize: intrinsicSize,
	}));
}
