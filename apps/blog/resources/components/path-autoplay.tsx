/**
 * Plays a tabbed tour on its own: marks the tour as playing while it is on screen, and when
 * the active step's progress line finishes growing, checks the next step's radio. The line's
 * CSS sets the pace, so pausing or reducing motion stops the tour with it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, EntryComponent, MixinFactory } from "remix/component";

import { hidden } from "@sdxc/u/layout";
import { clientEntry, createMixin } from "remix/component";

/** The animation whose end advances the tour; the tour's own CSS names it the same. */
export const PATH_ADVANCE_ANIMATION = "tour-advance";

/** Props of the autoplay island. */
type PathAutoplayProps = Record<never, never>;

/**
 * Attaches the autoplay to the tabbed stage in the band around the element: an observer sets
 * `data-autoplay` on the stage while a third of it is visible, and the end of the advance
 * animation checks the following radio, wrapping from the last step to the first.
 */
const pathAutoplay: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
	HTMLElement,
	[],
	ElementProps
>((handle) => {
	let controller: AbortController | undefined;
	let observer: IntersectionObserver | undefined;

	handle.addEventListener("insert", (event) => {
		controller?.abort();
		observer?.disconnect();
		let stage = event.node
			.closest("section")
			?.querySelector<HTMLElement>('[data-slot="tabbed-stage"]');
		if (!stage) return;

		controller = new AbortController();
		observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) stage.setAttribute("data-autoplay", "");
				else stage.removeAttribute("data-autoplay");
			},
			{ threshold: 0.33 },
		);
		observer.observe(stage);

		stage.addEventListener(
			"animationend",
			(end) => {
				if (end.animationName !== PATH_ADVANCE_ANIMATION) return;
				let radios = Array.from(stage.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
				let current = radios.findIndex((radio) => radio.checked);
				let next = radios[(current + 1) % radios.length];
				if (next) next.checked = true;
			},
			{ signal: controller.signal },
		);
	});

	handle.addEventListener("remove", () => {
		controller?.abort();
		observer?.disconnect();
		controller = undefined;
		observer = undefined;
	});
});

/**
 * The island: a hidden span placed inside the band whose tour it plays. The tour works as
 * plain radios before it loads, and keeps working if it never does.
 */
export const PathAutoplay: EntryComponent<PathAutoplayProps> = clientEntry(
	import.meta.url,
	function PathAutoplay() {
		return () => <span mix={[hidden(), pathAutoplay()]} />;
	},
);
