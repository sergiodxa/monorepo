/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Which of the anchor's dimensions is measured. `"block"`/`"inline"` resolve
 * against the anchor's writing mode and `"self-block"`/`"self-inline"` against
 * the positioned element's own; `(string & {})` admits any other keyword.
 */
export type AnchorSizeDimension =
	| "block"
	| "inline"
	| "self-block"
	| "self-inline"
	| "width"
	| "height"
	| (string & {});

/**
 * Resolves an `anchor-size()` reference to a plain string, letting a panel
 * track its trigger's size in one browser-maintained declaration. The leading
 * `--` is prepended; `fallback` keeps it valid when no anchor resolves.
 *
 * @example u.minIs(u.anchorSize("trigger", "inline"))
 * @example "anchor-size(--trigger inline)"
 * @example u.anchorSize("trigger", "block")
 * @example "anchor-size(--trigger block)"
 * @example u.anchorSize("trigger", "self-inline")
 * @example "anchor-size(--trigger self-inline)"
 * @example u.anchorSize("trigger", "inline", "12rem")
 * @example "anchor-size(--trigger inline, 12rem)"
 */
export function anchorSize(
	name: string,
	dimension: AnchorSizeDimension,
	fallback?: string,
): string {
	return fallback === undefined
		? `anchor-size(--${name} ${dimension})`
		: `anchor-size(--${name} ${dimension}, ${fallback})`;
}
