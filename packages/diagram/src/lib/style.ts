/**
 * The paint every diagram shares. Lines and text take `currentColor` and fills
 * read `--diagram-fill` and `--diagram-tint`, so a diagram follows the page's
 * color and color scheme with no stylesheet.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The stroke of every outline and line. */
export const STROKE = { stroke: "currentColor", "stroke-width": "1.5" };

/** The fill of node bodies and anything that must hide a line behind it. */
export const BACKGROUND = "fill: var(--diagram-fill, Canvas)";

/** The fill of notes, block labels and group headers, a shade off the background. */
export const TINT = "fill: var(--diagram-tint, color-mix(in srgb, currentColor 8%, Canvas))";
