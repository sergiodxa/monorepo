/**
 * The border, tinted background, and emphasized foreground one semantic
 * color role contributes to a bordered, tinted panel — a full-width status
 * or placeholder panel's coloring for a single `&[data-color="..."]` branch
 * — read from that color's own `--ui-*` variables, so the panel follows
 * whatever values the active theme assigns them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SemanticColor } from "./semantic-color.js";

/**
 * The `borderColor`, `backgroundColor`, and `color` declarations a tinted
 * panel sets for one {@link SemanticColor}.
 */
export interface SemanticColorPanelStyle {
	/** Border color, read from that color's `--ui-*-border` variable. */
	borderColor: string;
	/** Tinted background color, read from that color's `--ui-*-bg-tint` variable. */
	backgroundColor: string;
	/** Emphasized foreground color, read from that color's `--ui-*-fg-emphasis` variable. */
	color: string;
}

/**
 * Builds the border, tinted background, and emphasized foreground one
 * semantic color contributes to a tinted panel, each read from that color's
 * own `--ui-*` variables.
 *
 * @param color The semantic color to build the style for.
 * @returns The `borderColor`, `backgroundColor`, and `color` declarations for `color`.
 * @example
 * semanticColorPanelStyle("danger");
 * // { borderColor: "var(--ui-danger-border)", backgroundColor: "var(--ui-danger-bg-tint)", color: "var(--ui-danger-fg-emphasis)" }
 */
export function semanticColorPanelStyle(color: SemanticColor): SemanticColorPanelStyle {
	return {
		borderColor: `var(--ui-${color}-border)`,
		backgroundColor: `var(--ui-${color}-bg-tint)`,
		color: `var(--ui-${color}-fg-emphasis)`,
	};
}
