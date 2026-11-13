/**
 * Quoin's three faces, all from the reader's own system fonts: a high-contrast Didone for
 * the oversized display, a neutral grotesk for reading, and a mono for the captions, the
 * pairing a printed portfolio sets its plates and running heads in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Didot on Apple systems, Bodoni MT on Windows, a transitional serif anywhere else. */
export const DIDONE =
	'Didot, "Bodoni 72", "Bodoni MT", "Big Caslon", "Libre Bodoni", "Times New Roman", serif';

/** Helvetica Neue on Apple systems and Arial elsewhere, for body copy and controls. */
export const GROTESK = '"Helvetica Neue", Helvetica, Arial, sans-serif';

/** The caption face: running heads, figures in tables and the week scale. */
export const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
