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
 * Applies `grid-template-columns`/`-rows`/`-areas` from whichever option
 * keys are given, leaving the others untouched. Each value is a raw CSS
 * string passed straight through — grid tracks and named areas vary too
 * continuously (fractional units, `repeat()`, `minmax()`, quoted area
 * strings) for a named scale to usefully cover. Pair with {@link repeat}
 * for the extremely common `repeat(count, track)` shape, so a typo in
 * "repeat" or a missing comma doesn't silently produce an invalid track
 * list.
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
