/**
 * The floating-surface placement shared by every component that anchors a
 * panel against a trigger through CSS anchor positioning — a popover's own
 * surface, and any panel layering its content and motion on top of one. Each
 * of the twelve values names a physical side of the viewport, the same one a
 * positioning engine would choose when flipping the surface to stay in view,
 * so a placement keeps attaching to that same physical side under any `dir`
 * value rather than mirroring for reading direction.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Side of the anchor a floating surface renders against, and — for the four
 * corner variants — which of the anchor's edges it aligns to along the
 * perpendicular axis.
 */
export type AnchorPlacement =
	| "top"
	| "top-start"
	| "top-end"
	| "bottom"
	| "bottom-start"
	| "bottom-end"
	| "left"
	| "left-start"
	| "left-end"
	| "right"
	| "right-start"
	| "right-end";
