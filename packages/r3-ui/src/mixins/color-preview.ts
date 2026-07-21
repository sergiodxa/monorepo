/**
 * Live-updates a ColorField's paired swatch preview as the person typing
 * into its text control lands on a value the chosen color notation actually
 * accepts, so the preview keeps pace with every keystroke instead of only
 * catching up once a render happens to run again. Every `input` event
 * bubbling up from the text control runs its current value through
 * `parseColor()`; a successful parse formats the result back out and writes
 * it onto the paired swatch's own `--ui-color-swatch-value` custom property —
 * the same property a swatch already paints its fill from at render time, so
 * a live update here reaches the screen with no further wiring. An
 * in-progress value that doesn't yet parse — a half-typed hex digit, an
 * unfinished `rgb(` call — changes nothing, leaving the swatch showing
 * whatever color it last resolved successfully.
 *
 * Why JS: no CSS selector or HTML attribute can read an `<input>`'s
 * in-progress value and react to it, so reflecting a color change as it's
 * typed — rather than only once the field is submitted and the page
 * re-renders — needs a script watching the value on every keystroke.
 * No-JS baseline: the swatch still renders the correct fill for whatever
 * value the field held the last time the page rendered; a full-page
 * navigation (the field's own form submit, or a reload) always shows the
 * swatch caught up to that value. Only the live, keystroke-by-keystroke
 * preview ahead of that render is unavailable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/ui";

import { createElement, createMixin, on } from "remix/ui";

import { formatRgb, parseColor } from "../utils/color-math";

/**
 * CSS custom property {@link colorPreview} writes a successfully parsed
 * color onto. A swatch already paints its own fill from this same property
 * at render time, so overwriting it here is the whole update — no other
 * attribute or class needs touching for the new color to reach the screen.
 */
const SWATCH_VALUE_PROPERTY = "--ui-color-swatch-value";

/**
 * Selector {@link colorPreview} uses to find its host's paired swatch: any
 * descendant already carrying `data-slot="swatch"`, the attribute a swatch
 * sets on itself the moment it renders, regardless of which component
 * composes it into the field.
 */
const SWATCH_SELECTOR = '[data-slot="swatch"]';

/**
 * Finds the single swatch element nested under `host`, identified by
 * {@link SWATCH_SELECTOR} — the same descendant-lookup shape a paired-input
 * mixin uses to find its own targets beneath a shared host, rather than
 * assuming a fixed position among siblings.
 *
 * @param host ColorField wrapping host the swatch renders inside.
 * @returns The matched swatch element, or `null` when the host renders
 * without one.
 */
function findSwatch(host: HTMLElement): HTMLElement | null {
	return host.querySelector<HTMLElement>(SWATCH_SELECTOR);
}

/**
 * Live-updates a ColorField's paired swatch preview as its text control's
 * value changes, keeping the two in sync between renders rather than only
 * matching once a full render catches up.
 *
 * Apply it to the ColorField's wrapping host — the element containing both
 * the text control and its paired swatch. It listens for the `input` event
 * bubbling up from the text control, so no listener needs attaching to the
 * control itself, and reads the control's current value directly off the
 * event on every firing. Running that value through `parseColor()`: a
 * successful parse formats the result back out and writes it onto the
 * paired swatch's {@link SWATCH_VALUE_PROPERTY} custom property, found
 * beneath the host through {@link findSwatch}; a value that doesn't yet
 * parse — an in-progress edit that hasn't settled into a valid color —
 * changes nothing, leaving the swatch showing whatever color it last
 * resolved successfully. A host that renders without a matching swatch logs
 * a dev-mode warning, once, and otherwise leaves every keystroke a no-op.
 *
 * @returns A mixin descriptor for a ColorField wrapping host's `mix` prop.
 * @example
 * <div mix={colorPreview()}>
 *   <input
 *     type="text"
 *     pattern="#[0-9a-fA-F]{6}"
 *     defaultValue="#3b82f6"
 *     aria-label={t("colorField.label")}
 *   />
 *   <ColorSwatch value="#3b82f6" />
 * </div>
 */
export const colorPreview: MixinFactory<HTMLElement> = createMixin<HTMLElement>((handle) => {
	let hasWarnedMissingSwatch = false;

	return () =>
		createElement(handle.element, {
			mix: [
				on<HTMLElement, "input">("input", (event) => {
					let target = event.target;
					if (!(target instanceof HTMLInputElement)) return;

					let parsed = parseColor(target.value);
					if (parsed === null) return;

					let host = event.currentTarget;
					let swatch = findSwatch(host);
					if (swatch === null) {
						if (import.meta.env.DEV && !hasWarnedMissingSwatch) {
							hasWarnedMissingSwatch = true;
							console.warn(
								`colorPreview(): no element matching ${SWATCH_SELECTOR} found beneath the ColorField host to update.`,
							);
						}
						return;
					}

					swatch.style.setProperty(SWATCH_VALUE_PROPERTY, formatRgb(parsed));
				}),
			],
		});
});
