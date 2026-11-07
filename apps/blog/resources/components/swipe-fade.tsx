/**
 * Tells a sideways-scrolling row which of its edges hide more cards: it sets `data-fade` on
 * the row to `start`, `end`, `both` or `none` as the reader scrolls or the row resizes, so
 * the row's CSS fades only the edges with something past them and hides the swipe hint once
 * every card fits.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, EntryComponent, MixinFactory } from "remix/component";

import { hidden } from "@sdxc/u/layout";
import { clientEntry, createMixin } from "remix/component";

/** Props of the fade island. */
type SwipeFadeProps = Record<never, never>;

/** Which edges of `row` have cards past them, as the `data-fade` value the CSS reads. */
function fadeOf(row: HTMLElement): "start" | "end" | "both" | "none" {
	let before = row.scrollLeft > 1;
	let after = row.scrollLeft + row.clientWidth < row.scrollWidth - 1;
	if (before && after) return "both";
	if (before) return "start";
	if (after) return "end";
	return "none";
}

/**
 * Watches the `[data-swipe]` row beside the element: on scroll and on resize it writes the
 * row's `data-fade` on the next frame, so the layout the write changes never re-enters the
 * observer that triggered it.
 */
const swipeFade: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
	HTMLElement,
	[],
	ElementProps
>((handle) => {
	let controller: AbortController | undefined;
	let observer: ResizeObserver | undefined;

	handle.addEventListener("insert", (event) => {
		controller?.abort();
		observer?.disconnect();
		let row = event.node.parentElement?.querySelector<HTMLElement>("[data-swipe]");
		if (!row) return;

		let frame = 0;
		let update = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => row.setAttribute("data-fade", fadeOf(row)));
		};
		controller = new AbortController();
		controller.signal.addEventListener("abort", () => cancelAnimationFrame(frame));
		row.addEventListener("scroll", update, { passive: true, signal: controller.signal });
		observer = new ResizeObserver(update);
		observer.observe(row);
		update();
	});

	handle.addEventListener("remove", () => {
		controller?.abort();
		observer?.disconnect();
		controller = undefined;
		observer = undefined;
	});
});

/**
 * The island: a hidden span placed beside the row it watches. The row fades its trailing
 * edge before it loads, and keeps doing so if it never does.
 */
export const SwipeFade: EntryComponent<SwipeFadeProps> = clientEntry(
	import.meta.url,
	function SwipeFade() {
		return () => <span mix={[hidden(), swipeFade()]} />;
	},
);
