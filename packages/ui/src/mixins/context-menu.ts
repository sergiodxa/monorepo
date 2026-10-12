/**
 * Opens a ContextMenu's popover surface at the pointer position when its
 * host receives a right-click, anchoring it with `@remix-run/ui/anchor`'s
 * point-based positioning since no markup can anchor a floating surface to
 * a pointer position. Without this mixin the host falls back to the
 * platform's native right-click menu.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { anchor, type AnchorOptions, type AnchorPoint } from "@remix-run/ui/anchor";
import { attrs, createElement, createMixin, on, type ElementProps } from "remix/component";

/** Placement `contextMenu()` anchors the surface to when `options` doesn't specify one. */
const DEFAULT_PLACEMENT = "bottom-start";

/** `MouseEvent.button` for the secondary press a pointer asks for a context menu with. */
const SECONDARY_BUTTON = 2;

/**
 * Opens the popover surface identified by `id` at the pointer position on a
 * `contextmenu` event, or the host's bounding box from the keyboard, since a
 * `popover="auto"` surface already handles its own Escape/outside-click dismissal.
 * A pointer's menu opens on the release of the press that asked for it, so the surface
 * stays up until the next press rather than being dismissed by that same one.
 *
 * @param id `id` of the popover surface to open.
 * @param options Anchor placement and offsets forwarded to `@remix-run/ui/anchor`; placement defaults to `"bottom-start"`. Safe to omit — `contextMenu(id)` resets the runtime's trailing current-props argument back to an empty options object.
 * @example
 * <div id="row-1" mix={contextMenu("row-1-menu")}>Row 1</div>
 * <div id="row-1-menu" popover="auto" role="menu">...</div>
 */
export const contextMenu = createMixin<HTMLElement, [id: string, options?: AnchorOptions]>(
	(handle) => {
		let cleanupAnchor: () => void = () => {};

		/**
		 * Read once here, because the mixin's lifetime is only readable while it is being set
		 * up — and the listener that needs it is registered from a pointer event much later.
		 */
		let lifetime = handle.signal;

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
			if (props === options) {
				options = {};
			}

			return createElement(handle.element, {
				mix: [
					attrs({ "aria-controls": id, "aria-haspopup": "menu" }),
					/**
					 * A pointer request opens once its button is released: a `popover="auto"` surface reads
					 * the summoning press's pointerdown and pointerup as a click away. A keyboard request
					 * reports no button and has no release to wait for, so it opens where it stands.
					 */
					on<HTMLElement, "contextmenu">("contextmenu", (event) => {
						event.preventDefault();
						let point = { x: event.clientX, y: event.clientY };

						if (event.button !== SECONDARY_BUTTON) {
							openSurfaceAt(id, point, options);
							return;
						}

						document.addEventListener("pointerup", () => openSurfaceAt(id, point, options), {
							capture: true,
							once: true,
							signal: lifetime,
						});
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
