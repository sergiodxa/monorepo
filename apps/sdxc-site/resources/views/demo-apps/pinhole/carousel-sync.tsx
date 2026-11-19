/**
 * Client island in every multi-photo post: reveals the arrows, keeps the dots and the `n / N`
 * count on the photo in view, and likes the post on a double tap with a burst over the photo.
 * Without script the photos still swipe and scroll on native snap, with the first dot marked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { clientEntry, createMixin } from "remix/component";

/** How long the heart burst shows after a double tap. */
const BURST_MS = 900;

/**
 * Wires one post's media until `signal` aborts.
 *
 * @param root The media's root, which holds the viewport, arrows, dots and count.
 * @param signal Ends the wiring.
 */
function wire(root: HTMLElement, signal: AbortSignal): void {
	let viewport = root.querySelector<HTMLElement>("[data-carousel-viewport]");
	if (viewport === null) return;
	let slides = [...viewport.querySelectorAll<HTMLElement>("[data-carousel-slide]")];
	let dots = [...root.querySelectorAll<HTMLElement>("[data-carousel-dot]")];
	let steps = [...root.querySelectorAll<HTMLButtonElement>("[data-carousel-step]")];
	let count = root.querySelector<HTMLElement>("[data-carousel-count]");
	let burstTimer: ReturnType<typeof setTimeout> | undefined;

	/** The slide nearest the viewport's start. */
	function currentIndex(): number {
		let width = viewport!.clientWidth;
		if (width === 0) return 0;
		let rtl = getComputedStyle(viewport!).direction === "rtl";
		let position = rtl ? -viewport!.scrollLeft : viewport!.scrollLeft;
		return Math.min(slides.length - 1, Math.max(0, Math.round(position / width)));
	}

	/** Marks the dot and count for the slide in view and disables the arrow at either end. */
	function sync() {
		let index = currentIndex();
		dots.forEach((dot, position) => dot.toggleAttribute("data-current", position === index));
		if (count !== null) count.textContent = `${index + 1} / ${slides.length}`;
		for (let step of steps) {
			let forward = step.dataset.carouselStep === "1";
			step.disabled = forward ? index >= slides.length - 1 : index <= 0;
		}
	}

	/** Scrolls one slide in the arrow's direction. */
	function step(button: HTMLButtonElement) {
		let rtl = getComputedStyle(viewport!).direction === "rtl";
		let direction = Number(button.dataset.carouselStep) * (rtl ? -1 : 1);
		viewport!.scrollBy({ left: direction * viewport!.clientWidth, behavior: "smooth" });
	}

	/** Likes the post, once, and plays the burst every time. */
	function like() {
		let form = root.closest("article")?.querySelector<HTMLFormElement>("[data-like] form");
		if (form !== null && form !== undefined && !form.hasAttribute("data-pressed")) {
			form.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
		}
		root.removeAttribute("data-burst");
		void root.offsetWidth;
		root.setAttribute("data-burst", "");
		clearTimeout(burstTimer);
		burstTimer = setTimeout(() => root.removeAttribute("data-burst"), BURST_MS);
	}

	for (let button of steps) {
		button.hidden = false;
		button.addEventListener("click", () => step(button), { signal });
	}
	viewport.addEventListener("scroll", sync, { passive: true, signal });
	viewport.addEventListener("dblclick", like, { signal });
	root.setAttribute("data-carousel-ready", "");
	sync();
	signal.addEventListener("abort", () => clearTimeout(burstTimer));
}

/** Wires the media the marker sits in from the moment it is inserted until it is removed. */
const carouselWiring = createMixin<HTMLElement>((handle) => {
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

/** The island: a hidden marker beside the post's media that wires it once mounted. */
export const CarouselSync = clientEntry(import.meta.url, function CarouselSync() {
	return () => <span hidden data-carousel-sync="" mix={[carouselWiring()]} />;
});
