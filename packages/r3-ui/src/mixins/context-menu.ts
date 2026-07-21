/**
 * Mixin that opens a ContextMenu's popover surface at the pointer position
 * when its host — the ContextMenu trigger area — receives a right-click,
 * anchoring that surface to the pointer with `remix/ui/anchor`'s point-based
 * positioning instead of anchoring it to an element.
 *
 * Why JS: the `contextmenu` event has no HTML equivalent, and nothing in
 * markup can anchor a floating surface to the pointer position that produced
 * it.
 * No-JS baseline: none — a context menu opened by right-click, at the
 * pointer position, cannot be expressed without JavaScript. Without this
 * mixin the host's native browser context menu shows instead, and the
 * element `id` refers to never opens.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { attrs, createElement, createMixin, on, type ElementProps } from "remix/ui";
import { anchor, type AnchorOptions, type AnchorPoint } from "remix/ui/anchor";

/** Placement `contextMenu()` anchors the surface to when `options` doesn't specify one. */
const DEFAULT_PLACEMENT = "bottom-start";

/**
 * Opens the popover surface identified by `id` at the pointer position on a
 * `contextmenu` event, or at the host's own bounding box when opened from the
 * keyboard — the Context Menu key, or Shift+F10. Prevents the platform's
 * native context menu in both cases.
 *
 * The referenced surface owns its own dismissal: a `popover="auto"` surface
 * already closes itself on `Escape` and on an outside click, no further
 * JavaScript required. This mixin only ever opens the surface, so apply it to
 * the trigger area a consumer right-clicks — a row, a card, a canvas — never
 * to the surface itself.
 *
 * @param id `id` of the popover surface to open.
 * @param options Anchor placement and offsets forwarded to `remix/ui/anchor`; placement defaults to `"bottom-start"`.
 * @example
 * <div id="row-1" mix={contextMenu("row-1-menu")}>Row 1</div>
 * <div id="row-1-menu" popover="auto" role="menu">...</div>
 */
export const contextMenu = createMixin<HTMLElement, [id: string, options?: AnchorOptions]>(
	(handle) => {
		let cleanupAnchor: () => void = () => {};

		handle.addEventListener("remove", () => cleanupAnchor());

		/** Shows the surface `id` refers to, if any, and anchors it to `point`, replacing any previous anchor tracking. */
		function openSurfaceAt(id: string, point: AnchorPoint, options: AnchorOptions): void {
			let surface = document.getElementById(id);

			if (!surface) {
				if (import.meta.env.DEV) {
					console.warn(`contextMenu(): no element with id "${id}" found to open.`);
				}
				return;
			}

			if (!surface.matches(":popover-open")) surface.showPopover();

			cleanupAnchor();
			cleanupAnchor = anchor(surface, point, { placement: DEFAULT_PLACEMENT, ...options });
		}

		return (
			id: string,
			options: AnchorOptions = {},
			props: ElementProps = options as ElementProps,
		) => {
			// `options` is optional, so a call site that omits it (`contextMenu(id)`)
			// gets the runtime's trailing current-props argument in its place —
			// reset it back to an empty options object when that happens.
			if (props === options) {
				options = {};
			}

			return createElement(handle.element, {
				mix: [
					attrs({ "aria-controls": id, "aria-haspopup": "menu" }),
					on<HTMLElement, "contextmenu">("contextmenu", (event) => {
						event.preventDefault();
						openSurfaceAt(id, { x: event.clientX, y: event.clientY }, options);
					}),
					on<HTMLElement, "keydown">("keydown", (event) => {
						if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;

						event.preventDefault();
						let rect = event.currentTarget.getBoundingClientRect();
						openSurfaceAt(
							id,
							{ x: rect.left, y: rect.top, width: rect.width, height: rect.height },
							options,
						);
					}),
				],
			});
		};
	},
);
