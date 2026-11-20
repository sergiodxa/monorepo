/**
 * The paint every diagram shares. Lines and text take `currentColor` and fills
 * read CSS custom properties, so a diagram follows the page's color and color
 * scheme with no stylesheet — and `accent` / `muted` roles tint a shape without
 * hard-coding hex colors into the SVG.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A semantic role a flowchart node or subgraph may carry. */
export type Role = "accent" | "muted";

/** Soft outline shared by nodes, groups and connectors. */
export const STROKE = {
	stroke: "var(--diagram-stroke, color-mix(in srgb, currentColor 48%, Canvas))",
	"stroke-width": "1.25",
};

/** Outline for an accent-marked shape: full accent color, slightly heavier. */
export const ACCENT_STROKE = {
	stroke: "var(--diagram-accent, currentColor)",
	"stroke-width": "1.5",
};

/** Outline for a muted shape: a quieter mix so it recedes from neighbors. */
export const MUTED_STROKE = {
	stroke: "var(--diagram-muted-stroke, color-mix(in srgb, currentColor 28%, Canvas))",
	"stroke-width": "1.15",
};

/** The fill of node bodies and anything that must hide a line behind it. */
export const BACKGROUND = "fill: var(--diagram-fill, Canvas)";

/** The fill of notes, block labels and group frames, a shade off the background. */
export const TINT = "fill: var(--diagram-tint, color-mix(in srgb, currentColor 6%, Canvas))";

/** Fill for an accent-marked shape: accent mixed lightly into the node fill. */
export const ACCENT_FILL =
	"fill: var(--diagram-accent-fill, color-mix(in srgb, var(--diagram-accent, currentColor) 14%, var(--diagram-fill, Canvas)))";

/** Fill for a muted shape: almost the page fill, so the node stays readable but quiet. */
export const MUTED_FILL =
	"fill: var(--diagram-muted-fill, color-mix(in srgb, currentColor 3%, var(--diagram-fill, Canvas)))";

/** Caption color for group headers and secondary labels. */
export const CAPTION = "var(--diagram-caption, color-mix(in srgb, currentColor 68%, Canvas))";

/** Corner radius of default rectangular nodes. */
export const NODE_RADIUS = 10;

/** Corner radius of subgraph, namespace and composite-state frames. */
export const GROUP_RADIUS = 14;

/** Font size of a visible diagram title. */
export const TITLE_SIZE = 16;

/** Vertical space reserved for a visible title above the drawing. */
export const TITLE_BAND = 32;

/** Fill and outline for a node or group, driven by its optional role. */
export interface Paint {
	fill: string;
	outline: Record<string, string>;
}

/**
 * Resolves the fill and outline a shape should use. Groups default to the tint
 * fill so nested frames read as soft cards against the page.
 *
 * @param role - Semantic role from `:::accent`, `:::muted` or `class … accent`
 * @param surface - Whether the shape is a node body or a grouping frame
 * @returns Fill style string and stroke attribute map
 */
export function paint(role: Role | undefined, surface: "node" | "group" = "node"): Paint {
	if (role === "accent") return { fill: ACCENT_FILL, outline: { ...ACCENT_STROKE } };
	if (role === "muted") return { fill: MUTED_FILL, outline: { ...MUTED_STROKE } };
	if (surface === "group") return { fill: TINT, outline: { ...STROKE } };
	return { fill: BACKGROUND, outline: { ...STROKE } };
}

/**
 * @param name - A Mermaid class name written after `:::` or in a `class` statement
 * @returns The matching role, when the name is one this package draws
 */
export function roleOf(name: string | undefined): Role | undefined {
	if (name === "accent" || name === "muted") return name;
	return undefined;
}
