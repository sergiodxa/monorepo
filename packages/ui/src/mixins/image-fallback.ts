/**
 * Flags an Avatar or Logo image the moment it fails to load, setting an
 * attribute its own styling already keys off to hide itself and reveal the
 * fallback markup — initials, an icon, a placeholder graphic — stacked
 * beneath it. Clears the same attribute again once a later `src` loads
 * successfully.
 *
 * Why JS: the image `error` event is the only reliable signal that a
 * requested image failed to load — no HTML attribute or CSS selector reacts
 * to a broken `src` on its own.
 * No-JS baseline: the image renders in its usual place, stacked above the
 * fallback beneath it; a broken `src` shows the browser's own broken-image
 * treatment (its `alt` text, or a placeholder icon) instead of revealing that
 * fallback.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/ui";

import { createElement, createMixin, on } from "remix/ui";

/**
 * Attribute {@link imageFallback} sets on its host image once it fails to
 * load, and removes again once a later `src` loads successfully — the same
 * attribute the image's own `css()` styling hides itself behind (for
 * example `"&[data-image-error]": { display: "none" }`) to reveal whatever
 * fallback markup renders stacked beneath it.
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
 * loading it succeeds or fails, so a consumer can react — retry with a
 * different source, report the failure to telemetry — without polling
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
 * Flags an Avatar or Logo image with {@link IMAGE_ERROR_ATTRIBUTE} the moment
 * it fails to load, and clears the attribute again once a later `src` loads
 * successfully. The image's own `css()` styling reacts to that attribute to
 * hide the image and reveal whatever fallback markup (initials, an icon, a
 * placeholder graphic) renders stacked beneath it — this mixin never touches
 * that fallback markup itself, only the image it's applied to.
 *
 * A response the browser already resolved from cache before this mixin's
 * `load`/`error` listeners attached wouldn't fire either event again, so on
 * mount this also reads the image's own `complete`/`naturalWidth` state to
 * catch an already-broken cached image retroactively.
 *
 * Dispatches {@link ImageFallbackEvent} on the image whenever this changes
 * whether its fallback is revealed.
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
			// A cached response may have already settled before this listener
			// attached; `complete` with no natural size is the retroactive
			// signal for that, mirroring what the `error` event reports for a
			// load that fails after mount.
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
