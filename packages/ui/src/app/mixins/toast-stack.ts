/**
 * Keeps a toast region's `--ui-toast-front-size` equal to the newest toast's
 * height, so folded toasts behind it peek out by the same amount whatever
 * their own length. Server HTML stacks without it until the island hydrates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinDescriptor } from "remix/component";

import { ref } from "remix/component";

/** Custom property the peek stack clamps every folded toast's height to. */
const FRONT_SIZE_PROPERTY = "--ui-toast-front-size";

/**
 * Measures the region's last child (the toast in front) whenever it changes
 * size or a toast arrives or leaves, writing its height onto the region.
 *
 * @returns A mixin ready for a toast region's `mix` prop.
 * @example
 * <div data-slot="region" mix={[toastStack()]}>{toasts}</div>
 */
export function toastStack(): MixinDescriptor<
	HTMLElement,
	[callback: (node: HTMLElement, signal: AbortSignal) => void],
	ElementProps
> {
	return ref((region: HTMLElement, signal: AbortSignal) => {
		if (typeof ResizeObserver === "undefined") return;

		let front: Element | null = null;
		let resize = new ResizeObserver(() => measure());
		let mutation = new MutationObserver(() => track());

		/** Writes the front toast's border-box height, or clears it when the region is empty. */
		function measure(): void {
			if (front instanceof HTMLElement) {
				region.style.setProperty(FRONT_SIZE_PROPERTY, `${front.offsetHeight}px`);
			} else {
				region.style.removeProperty(FRONT_SIZE_PROPERTY);
			}
		}

		/** Follows whichever child is now last, since a new toast always becomes the front one. */
		function track(): void {
			let next = region.lastElementChild;
			if (next !== front) {
				if (front) resize.unobserve(front);
				front = next;
				if (front) resize.observe(front);
			}
			measure();
		}

		mutation.observe(region, { childList: true });
		track();

		signal.addEventListener("abort", () => {
			resize.disconnect();
			mutation.disconnect();
		});
	});
}
