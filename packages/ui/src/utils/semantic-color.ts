/**
 * The semantic color role shared by every component that colors itself
 * through one of five tones rather than an arbitrary palette — a status
 * message's tint, a badge's fill, a button's emphasis. Each tone maps to its
 * own set of `--ui-*` variables (border, tint, solid background,
 * foreground, focus ring, …), so a component reads this single literal
 * union and lets the theme resolve every actual color value from it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * One of the five semantic tones a component colors itself with: `"brand"`,
 * `"neutral"`, `"success"`, `"warning"`, or `"danger"`. Every component's own
 * `Color` type resolves to this shared union, keeping tone naming consistent.
 */
export type SemanticColor = "brand" | "neutral" | "success" | "warning" | "danger";
