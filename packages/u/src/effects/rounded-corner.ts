/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { RadiusName } from "../types";

import { utility } from "../internal/descriptor";
import { radius } from "../internal/tokens";

/** A single logical corner, named by its block/inline start/end pair. */
export type LogicalCorner = "start-start" | "start-end" | "end-start" | "end-end";

/** Maps a {@link LogicalCorner} to the logical CSS property it should set. */
const CORNER_PROPERTY: Record<LogicalCorner, string> = {
	"start-start": "borderStartStartRadius",
	"start-end": "borderStartEndRadius",
	"end-start": "borderEndStartRadius",
	"end-end": "borderEndEndRadius",
};

/**
 * Applies a corner radius from the radius scale or a raw CSS length to a
 * single logical corner, instead of all four at once like {@link rounded}.
 * Useful for shapes that round three corners uniformly but flatten or
 * otherwise differentiate the fourth — a chat bubble's "tail" corner, for
 * example.
 *
 * @example u.roundedCorner("end-start", "xs")
 * @example css({ borderEndStartRadius: "var(--ui-radius-xs, 0.125rem)" })
 */
export function roundedCorner<Node extends Element = Element>(
	corner: LogicalCorner,
	name: RadiusName | (string & {}) = "md",
) {
	return utility<Node>(() => ({ [CORNER_PROPERTY[corner]]: radius(name) }));
}
