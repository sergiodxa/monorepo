/**
 * Starts loading a sticker before the viewer shows it: when a gallery tile is pointed at or
 * focused, its slide's artwork loads, and while a slide is on screen its neighbours load too, so
 * opening a sticker or stepping to the next one shows the art as soon as the message.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, EntryComponent, MixinFactory } from "remix/component";

import { hidden } from "@sdxc/u/layout";
import { clientEntry, createMixin } from "remix/component";

/** Props of the preload island. */
type StickerPreloadProps = Record<never, never>;

/**
 * Loads every still-lazy image in the slide at `index`, by switching it to eager loading. An
 * index outside the track, or a slide already loaded, is left as it is.
 */
function loadSlide(slides: ReadonlyArray<HTMLElement>, index: number): void {
	for (let image of slides[index]?.querySelectorAll<HTMLImageElement>('img[loading="lazy"]') ??
		[]) {
		image.loading = "eager";
	}
}

/**
 * Attaches the preloading to the band around the element: the gallery's triggers name their
 * slide by `data-lightbox-index`, and the viewer's track holds one slide per sticker in order.
 */
const stickerPreload: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
	HTMLElement,
	[],
	ElementProps
>((handle) => {
	let controller: AbortController | undefined;
	let observer: IntersectionObserver | undefined;

	handle.addEventListener("insert", (event) => {
		controller?.abort();
		observer?.disconnect();
		let band = event.node.closest("section");
		let track = band?.querySelector<HTMLElement>("[data-lightbox-track]");
		if (!band || !track) return;

		let slides = Array.from(track.querySelectorAll<HTMLElement>("[data-lightbox-slide]"));
		controller = new AbortController();

		/** Loads the slide a pointed-at or focused tile opens. */
		function preloadTrigger(target: EventTarget | null) {
			if (!(target instanceof Element)) return;
			let trigger = target.closest<HTMLElement>("[data-lightbox-index]");
			if (trigger) loadSlide(slides, Number(trigger.dataset.lightboxIndex));
		}

		band.addEventListener("pointerover", (over) => preloadTrigger(over.target), {
			signal: controller.signal,
		});
		band.addEventListener("focusin", (focus) => preloadTrigger(focus.target), {
			signal: controller.signal,
		});

		observer = new IntersectionObserver(
			(entries) => {
				for (let entry of entries) {
					if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) continue;
					let index = slides.indexOf(entry.target);
					loadSlide(slides, index - 1);
					loadSlide(slides, index);
					loadSlide(slides, index + 1);
				}
			},
			{ root: track, threshold: 0.5 },
		);
		for (let slide of slides) observer.observe(slide);
	});

	handle.addEventListener("remove", () => {
		controller?.abort();
		observer?.disconnect();
		controller = undefined;
		observer = undefined;
	});
});

/**
 * The island: a hidden span placed inside the gallery band whose viewer it preloads. The
 * viewer works without it, loading each sticker when its slide comes into view.
 */
export const StickerPreload: EntryComponent<StickerPreloadProps> = clientEntry(
	import.meta.url,
	function StickerPreload() {
		return () => <span mix={[hidden(), stickerPreload()]} />;
	},
);
