/**
 * The measures every signed-in page lays its content out by: the reading column, the height
 * a field in a page header stands at, and how a list runs out to the pane's edges. They live
 * apart from the layout so a view rendered in a browser reads them without the shell.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";

/**
 * Width of the measure prose and fields are read at. The page itself fills the pane the
 * sidebar leaves it, since a list of rows is scanned down rather than read across.
 */
export const PAGE_COLUMN = "48rem";

/** Height of a field standing among a page header's actions, matching its small buttons. */
export const BAND_FIELD_HEIGHT = "2rem";

/**
 * Runs a list out to the edges of the page's pane, taking back the gutter the shell keeps
 * around everything else, so a row's hover and rule reach both edges.
 */
export function listBleed() {
	return raw({ marginInline: "calc(-1 * var(--ui-app-gutter, 1rem))" });
}

/**
 * The inline padding a row of a bled list carries, which is the shell's own gutter now spent
 * inside the row, so the row's text stays on the page header's vertical line.
 */
export function listRowGutter() {
	return raw({ paddingInline: "var(--ui-app-gutter, 1rem)" });
}

/**
 * The size a note on the page is drawn at: padded in proportion to the line or two of news
 * it carries, so a sentence about a sweep sits among rows of posts as a remark.
 */
export function pageNote() {
	return [when('&[data-slot="alert"]', [p(2, 3), raw({ gap: "0.5rem", borderRadius: "0.5rem" })])];
}
