/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Applies `content-visibility: auto` with `contain-intrinsic-size` so the
 * browser skips rendering off-screen rows in a long list or table, using
 * `intrinsicSize` as a placeholder so the scrollbar doesn't jump on mount.
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
