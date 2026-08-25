/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The side of the anchor whose position is read. `"start"`/`"end"` resolve
 * against the anchor's containing block and `"self-start"`/`"self-end"`
 * against the positioned element's own; `(string & {})` admits a percentage.
 */
export type AnchorSide =
	| "top"
	| "right"
	| "bottom"
	| "left"
	| "start"
	| "end"
	| "self-start"
	| "self-end"
	| "center"
	| "inside"
	| "outside"
	| (string & {});

/**
 * Resolves an `anchor()` reference to a plain string — the length an inset
 * utility needs to pin an edge to the anchor's geometry. The leading `--` is
 * prepended; `fallback` keeps the inset valid when no anchor resolves.
 *
 * @example u.insBs(u.anchor("tip", "bottom"))
 * @example "anchor(--tip bottom)"
 * @example u.anchor("menu-button", "self-end")
 * @example "anchor(--menu-button self-end)"
 * @example u.anchor("tip", "bottom", "100%")
 * @example "anchor(--tip bottom, 100%)"
 * @example u.anchor("sidebar", "center", "0px")
 * @example "anchor(--sidebar center, 0px)"
 */
export function anchor(name: string, side: AnchorSide, fallback?: string): string {
	return fallback === undefined
		? `anchor(--${name} ${side})`
		: `anchor(--${name} ${side}, ${fallback})`;
}
