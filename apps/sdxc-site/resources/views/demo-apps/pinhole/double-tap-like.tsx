/**
 * Client island in every post's media: a double tap on the photo likes the post, once, through
 * the post's own like toggle, and plays a heart burst over the photo every time. Without
 * script the heart under the post is the way to like it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { clientEntry, createMixin } from "remix/component";

/** How long the heart burst shows after a double tap. */
const BURST_MS = 900;

/**
 * Likes the post a media box belongs to on a double tap until `signal` aborts.
 *
 * @param root The media's root, which the burst is drawn over.
 * @param signal Ends the wiring.
 */
function wire(root: HTMLElement, signal: AbortSignal): void {
	let burstTimer: ReturnType<typeof setTimeout> | undefined;

	/** Presses the like toggle unless the post is liked already, then restarts the burst. */
	function like() {
		let form = root
			.closest("[data-pinhole-item]")
			?.querySelector<HTMLFormElement>("[data-like] form");
		if (form !== null && form !== undefined && !form.hasAttribute("data-pressed")) {
			form.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
		}
		root.removeAttribute("data-burst");
		void root.offsetWidth;
		root.setAttribute("data-burst", "");
		clearTimeout(burstTimer);
		burstTimer = setTimeout(() => root.removeAttribute("data-burst"), BURST_MS);
	}

	root.addEventListener("dblclick", like, { signal });
	signal.addEventListener("abort", () => clearTimeout(burstTimer));
}

/** Wires the media the marker sits in from the moment it is inserted until it is removed. */
const doubleTapWiring = createMixin<HTMLElement>((handle) => {
	let controller: AbortController | undefined;

	handle.addEventListener("insert", (event) => {
		controller?.abort();
		let root = event.node.closest<HTMLElement>("[data-pinhole-media]");
		if (root === null) return;
		controller = new AbortController();
		wire(root, controller.signal);
	});

	handle.addEventListener("remove", () => {
		controller?.abort();
		controller = undefined;
	});
});

/** The island: a hidden marker inside the post's media. */
export const DoubleTapLike = clientEntry(import.meta.url, function DoubleTapLike() {
	return () => <span hidden data-double-tap-like="" mix={[doubleTapWiring()]} />;
});
