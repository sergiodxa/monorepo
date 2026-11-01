/**
 * Why JS: a letter key that picks a range from anywhere on the page, and a select that
 * submits as soon as it changes, both need a listener HTML does not provide.
 * No-JS baseline: every preset is a submit button and the narrow select has an Apply button.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createElement, createMixin, on } from "remix/component";

import { whileLive } from "../../mixins/while-live.js";
import { RANGE_PICKER_ENHANCED_ATTRIBUTE, RANGE_PICKER_KEY_ATTRIBUTE } from "../range-picker.js";

/**
 * Reports whether a key press belongs to the element that received it: a text field, a
 * select, or editable content keeps its letters, so typing never changes the range.
 *
 * @param target The key event's target.
 * @returns `true` when the target takes typed text.
 */
function isTyping(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;
	return target.matches("input, textarea, select");
}

/**
 * Picks the control `key` names inside `host`: the visible segment or Custom entry, or, when
 * the select stands in for the segments, the select's option, which it selects and submits.
 *
 * @param host The picker's root.
 * @param key The pressed letter, lowercased.
 * @returns `true` when a control took the key.
 */
function pick(host: HTMLElement, key: string): boolean {
	let selector = `[${RANGE_PICKER_KEY_ATTRIBUTE}="${CSS.escape(key)}"]`;
	for (let control of host.querySelectorAll<HTMLElement>(selector)) {
		if (control instanceof HTMLOptionElement) {
			let select = control.closest("select");
			if (!select?.checkVisibility()) continue;
			select.value = control.value;
			select.form?.requestSubmit();
			return true;
		}
		if (!control.checkVisibility()) continue;
		control.click();
		return true;
	}
	return false;
}

/**
 * Adds the picker's keyboard layer and live select: a preset's letter picks it from anywhere
 * on the page outside a text field, and changing the narrow select submits it, hiding its
 * Apply button. Keys with Ctrl, Alt or Meta held pass through to the browser.
 *
 * @returns A mixin descriptor for {@link RangePicker}'s `mix` prop, inside a hydrated island.
 * @example
 * <RangePicker presets={presets} value={range} labels={labels} mix={rangePickerKeys()} />
 */
export const rangePickerKeys = createMixin<HTMLElement>((handle) => {
	let host: HTMLElement | undefined;
	let follow = whileLive(handle, (target: Document, signal) => {
		target.addEventListener(
			"keydown",
			(event) => {
				if (!host || event.defaultPrevented || event.repeat) return;
				if (event.ctrlKey || event.altKey || event.metaKey) return;
				if (event.key.length !== 1 || isTyping(event.target)) return;
				if (pick(host, event.key.toLowerCase())) event.preventDefault();
			},
			{ signal },
		);
	});

	handle.addEventListener("insert", (event) => {
		host = event.node;
		host.setAttribute(RANGE_PICKER_ENHANCED_ATTRIBUTE, "");
	});
	handle.addEventListener("remove", () => {
		host = undefined;
	});

	return () => {
		if (typeof document !== "undefined") follow(document);

		return createElement(handle.element, {
			mix: [
				on<HTMLElement, "change">("change", (event) => {
					if (event.target instanceof HTMLSelectElement) event.target.form?.requestSubmit();
				}),
			],
		});
	};
});
