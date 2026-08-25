/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles";

import { utility } from "../internal/descriptor";

export interface GridTemplateOptions {
	/** Sets `grid-template-columns`. A raw CSS track-list string (e.g. `"1fr 2fr"`, `"repeat(3, 1fr)"`). */
	columns?: string;
	/** Sets `grid-template-rows`. A raw CSS track-list string. */
	rows?: string;
	/** Sets `grid-template-areas`. A raw CSS string (e.g. `'"header header" "sidebar main"'`). */
	areas?: string;
}

/**
 * Applies `grid-template-columns`/`-rows`/`-areas` from whichever option keys
 * are given. Track lists vary too continuously for a named scale, so values
 * are raw CSS strings; {@link repeat} builds the `repeat(count, track)` shape.
 *
 * @example u.gridTemplate({ columns: "1fr 2fr", rows: "auto 1fr" })
 * @example css({ gridTemplateColumns: "1fr 2fr", gridTemplateRows: "auto 1fr" })
 * @example u.gridTemplate({ areas: '"header header" "sidebar main"' })
 * @example css({ gridTemplateAreas: '"header header" "sidebar main"' })
 * @example u.gridTemplate({ columns: u.repeat(3, 1) })
 * @example css({ gridTemplateColumns: "repeat(3, 1fr)" })
 */
export function gridTemplate<Node extends Element = Element>(options: GridTemplateOptions = {}) {
	return utility<Node>(() => {
		let result: Record<string, string> = {};
		if (options.columns !== undefined) result.gridTemplateColumns = options.columns;
		if (options.rows !== undefined) result.gridTemplateRows = options.rows;
		if (options.areas !== undefined) result.gridTemplateAreas = options.areas;
		return result as CSSStyles;
	});
}
