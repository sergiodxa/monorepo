/**
 * Wayfern's layout measures, shared by the shell and every screen, so a screen's content lines
 * up with the top bar and switches to the phone layout at the same width the bars do.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** From here the destinations sit in the top bar and the tab bar goes. */
export const WIDE = "(min-width: 48rem)";

/** From here results sit beside their map instead of behind a toggle. */
export const SPLIT = "(min-width: 64rem)";

/** The top bar's height, which sticky panels below it clear. */
export const TOP_BAR = "4.5rem";

/** The page gutter every screen lines its content up with. */
export const GUTTER = "clamp(1rem, 4vw, 2.5rem)";

/** The widest a screen's content runs, so grids stay readable on a big screen. */
export const MEASURE = "80rem";
