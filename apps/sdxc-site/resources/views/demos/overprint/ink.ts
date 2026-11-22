/**
 * The poster's two inks and three faces, named once so every band prints with the same drums:
 * a fluorescent pink and a riso blue that overprint to violet, a condensed black display face,
 * a grotesk for reading and a mono for times and prices.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Fluorescent pink: the first drum, spent on the word "Over", actions and the main stage. */
export const PINK = "var(--op-pink)";

/** Riso blue: the second drum, the body text's ink and the side stage. */
export const BLUE = "var(--op-blue)";

/** How overprinted inks combine: multiply on paper, screen on the dark sheet. */
export const BLEND = "var(--op-blend)";

/** The paper the page is printed on. */
export const PAPER = "var(--ui-bg)";

/**
 * A condensed black face from what the reader already has: Impact on desktops, Avenir Next
 * Condensed on Apple phones, Roboto Condensed on Android.
 */
export const DISPLAY =
	"Impact, 'Avenir Next Condensed', 'Futura Condensed ExtraBold', 'Roboto Condensed', 'Arial Narrow', sans-serif-condensed, sans-serif";

/** A neutral grotesk for reading, so the display face carries all the noise. */
export const SANS = "'Helvetica Neue', Helvetica, Arial, ui-sans-serif, system-ui, sans-serif";

/** A mono for times, prices and seat counts, which line up in columns. */
export const MONO = "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

/**
 * Risograph grain: fractal noise as a tile of dark specks, laid over the whole page so paper
 * and ink alike look printed. The tile is 180px, so the repeat never lines up with a column.
 */
export const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.6 1.05'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`;

/**
 * A halftone screen in one ink: dots on a 7px grid, which a mask grades from solid to
 * nothing so a flat shape reads as a printed tone.
 *
 * @param ink The ink the dots print in.
 * @param size The dot pitch, any CSS length.
 * @returns A `background-image` value.
 */
export function halftone(ink: string, size = "7px"): string {
	return `radial-gradient(circle at center, ${ink} 0 calc(${size} * 0.32), transparent calc(${size} * 0.36)) 0 0 / ${size} ${size}`;
}
