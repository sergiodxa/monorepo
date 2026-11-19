/**
 * Links every element that shares one `data-map-key` across a page, so pointing at or focusing a
 * listing row lights up its pin on a map and the reverse. Without script nothing is lit and
 * each row and pin still works as its own link or button.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createElement, createMixin, on } from "remix/component";

/** Attribute naming the record a row or pin stands for. */
export const MAP_KEY_ATTRIBUTE = "data-map-key";

/** Attribute present on every element of the record under the pointer or focus. */
export const MAP_HIGHLIGHTED_ATTRIBUTE = "data-highlighted";

/**
 * Sets or clears {@link MAP_HIGHLIGHTED_ATTRIBUTE} on every element in `host`'s document that
 * carries `key`, the host included.
 *
 * @param host Element the pointer or focus moved on.
 * @param key Record key every linked element carries.
 * @param lit Whether the record is lit.
 */
function setLinked(host: HTMLElement, key: string, lit: boolean): void {
	let linked = host.ownerDocument.querySelectorAll<HTMLElement>(
		`[${MAP_KEY_ATTRIBUTE}="${CSS.escape(key)}"]`,
	);
	for (let element of [host, ...linked]) {
		if (lit) element.setAttribute(MAP_HIGHLIGHTED_ATTRIBUTE, "");
		else element.removeAttribute(MAP_HIGHLIGHTED_ATTRIBUTE);
	}
}

/**
 * Lights every element sharing `key` while the host is pointed at or holds focus, and keeps
 * them lit until both the pointer and the focus have left it. The host gets `data-map-key`
 * too, so a row and a pin each carrying `mapLink` light one another.
 *
 * @param key Record key, such as a listing id.
 * @example <li mix={mapLink(stay.id)}><a href={stay.url}>{stay.name}</a></li>
 * @example <MapCanvas.Pin x={120} y={80} label="$182" mapKey={stay.id} />
 */
export const mapLink = createMixin<HTMLElement, [key: string]>((handle) => {
	return (key) =>
		createElement(handle.element, {
			[MAP_KEY_ATTRIBUTE]: key,
			mix: [
				on<HTMLElement, "pointerenter">("pointerenter", (event) => {
					setLinked(event.currentTarget, key, true);
				}),
				on<HTMLElement, "pointerleave">("pointerleave", (event) => {
					let host = event.currentTarget;
					if (host.matches(":focus-within")) return;
					setLinked(host, key, false);
				}),
				on<HTMLElement, "focusin">("focusin", (event) => {
					setLinked(event.currentTarget, key, true);
				}),
				on<HTMLElement, "focusout">("focusout", (event) => {
					let host = event.currentTarget;
					let next = event.relatedTarget;
					if (next instanceof Node && host.contains(next)) return;
					if (host.matches(":hover")) return;
					setLinked(host, key, false);
				}),
			],
		});
});

/** The element with a `data-map-key` an event happened in, if any. */
function keyedAncestor(target: EventTarget | null): HTMLElement | null {
	return target instanceof Element ? target.closest<HTMLElement>(`[${MAP_KEY_ATTRIBUTE}]`) : null;
}

/**
 * Links every `data-map-key` row and pin in the host's document at once, by listening on the
 * document, so markup rendered on the server lights up without each row being an island. The
 * listeners go when the host leaves the page.
 *
 * @example <span hidden mix={mapLinks()} />
 */
export const mapLinks = createMixin<HTMLElement>((handle) => {
	let controller: AbortController | undefined;

	handle.addEventListener("insert", (event) => {
		controller?.abort();
		controller = new AbortController();
		let document = event.node.ownerDocument;
		let options = { signal: controller.signal };

		/** Lights the record under a pointer or focus move, and unlights the one it left. */
		function move(from: EventTarget | null, to: EventTarget | null) {
			let left = keyedAncestor(from);
			let entered = keyedAncestor(to);
			if (left === entered) return;
			let leftKey = left?.getAttribute(MAP_KEY_ATTRIBUTE);
			let enteredKey = entered?.getAttribute(MAP_KEY_ATTRIBUTE);
			if (left !== null && leftKey !== null && leftKey !== undefined && leftKey !== enteredKey) {
				setLinked(left, leftKey, false);
			}
			if (entered !== null && enteredKey !== null && enteredKey !== undefined) {
				setLinked(entered, enteredKey, true);
			}
		}

		document.addEventListener(
			"pointerover",
			(event) => move(event.relatedTarget, event.target),
			options,
		);
		document.addEventListener(
			"pointerout",
			(event) => {
				if (event.relatedTarget === null) move(event.target, null);
			},
			options,
		);
		document.addEventListener(
			"focusin",
			(event) => move(event.relatedTarget, event.target),
			options,
		);
		document.addEventListener(
			"focusout",
			(event) => {
				if (event.relatedTarget === null) move(event.target, null);
			},
			options,
		);
	});

	handle.addEventListener("remove", () => {
		controller?.abort();
		controller = undefined;
	});
});
