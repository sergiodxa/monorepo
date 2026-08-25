/**
 * Flags an Avatar or Logo image the moment it fails to load by setting an
 * attribute its own styling hides behind, revealing the fallback markup
 * stacked beneath it; clears the attribute again once a later `src` loads
 * successfully.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/ui";

import { createElement, createMixin, on } from "remix/ui";

/**
 * Attribute {@link imageFallback} sets on its host image once it fails to
 * load, and removes once a later `src` loads successfully; the image's own
 * `css()` styling hides itself behind this attribute to reveal its fallback.
 */
export const IMAGE_ERROR_ATTRIBUTE = "data-image-error";

/** DOM event type dispatched on a host image by {@link imageFallback} whenever loading it succeeds or fails. */
const IMAGE_FALLBACK_EVENT = "ui:image-fallback" as const;

declare global {
	interface HTMLElementEventMap {
		[IMAGE_FALLBACK_EVENT]: ImageFallbackEvent;
	}
}

/**
 * Dispatched on an Avatar or Logo image by {@link imageFallback} whenever
 * loading it succeeds or fails, so a consumer can react without polling
 * {@link IMAGE_ERROR_ATTRIBUTE} off the DOM itself.
 */
export class ImageFallbackEvent extends Event {
	/** `true` once the image has failed to load and its fallback is now revealed, `false` once it loads successfully. */
	readonly fallback: boolean;

	/**
	 * @param fallback Whether the image's fallback is now revealed.
	 */
	constructor(fallback: boolean) {
		super(IMAGE_FALLBACK_EVENT, { bubbles: true });
		this.fallback = fallback;
	}
}

/**
 * Sets or clears {@link IMAGE_ERROR_ATTRIBUTE} on an Avatar or Logo image
 * on load, error, and mount — mount also checks `complete`/`naturalWidth`
 * since an already-cached image never fires either event again.
 *
 * @returns A mixin descriptor for an Avatar or Logo image's `mix` prop.
 * @example
 * <div mix={[css({ position: "relative", display: "inline-grid" })]}>
 *   <span mix={[css({ gridArea: "1 / 1" })]}>{initials}</span>
 *   <img
 *     src={avatarUrl}
 *     alt={name}
 *     mix={[
 *       imageFallback(),
 *       css({ gridArea: "1 / 1", "&[data-image-error]": { display: "none" } }),
 *     ]}
 *   />
 * </div>
 */
export const imageFallback: MixinFactory<HTMLImageElement> = createMixin<HTMLImageElement>(
	(handle) => {
		let isFallback = false;

		/** Sets or clears {@link IMAGE_ERROR_ATTRIBUTE} on `host` and reports the transition, unless it already matches `fallback`. */
		function setFallback(host: HTMLImageElement, fallback: boolean): void {
			if (fallback === isFallback) return;
			isFallback = fallback;

			if (fallback) host.setAttribute(IMAGE_ERROR_ATTRIBUTE, "");
			else host.removeAttribute(IMAGE_ERROR_ATTRIBUTE);

			host.dispatchEvent(new ImageFallbackEvent(fallback));
		}

		handle.addEventListener("insert", (event) => {
			let host = event.node;
			if (host.src !== "" && host.complete && host.naturalWidth === 0) {
				setFallback(host, true);
			}
		});
		handle.addEventListener("remove", () => {
			isFallback = false;
		});

		return () =>
			createElement(handle.element, {
				mix: [
					on<HTMLImageElement, "load">("load", (event) => {
						setFallback(event.currentTarget, false);
					}),
					on<HTMLImageElement, "error">("error", (event) => {
						setFallback(event.currentTarget, true);
					}),
				],
			});
	},
);
