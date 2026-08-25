/**
 * Live-updates a ColorField's paired swatch preview as the person typing
 * into its text control lands on a value the chosen color notation actually
 * accepts, reflecting every keystroke a script can observe that no CSS
 * selector or HTML attribute can react to on its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/ui";

import { createElement, createMixin, on } from "remix/ui";

import { formatRgb, parseColor } from "../utils/color-math";

/**
 * CSS custom property {@link colorPreview} writes a successfully parsed
 * color onto. A swatch already paints its own fill from this same property,
 * so overwriting it here is the whole update.
 */
const SWATCH_VALUE_PROPERTY = "--ui-color-swatch-value";

/**
 * Selector {@link colorPreview} uses to find its host's paired swatch: any
 * descendant already carrying `data-slot="swatch"`, set the moment a
 * swatch renders, regardless of which component composes it into the field.
 */
const SWATCH_SELECTOR = '[data-slot="swatch"]';

/**
 * Finds the single swatch element nested under `host`, identified by
 * {@link SWATCH_SELECTOR}, regardless of the swatch's position among the
 * host's other descendants.
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
 * value changes, running each `input` event's value through `parseColor()`
 * and writing successful parses onto the swatch found via {@link findSwatch}.
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
