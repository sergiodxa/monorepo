/**
 * Reads the data a lookup carries off a matched element — its value, its raw
 * attributes, whether the markup disables it — so a caller can assert on a match
 * without looking the element up a second time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { visibleText } from "./text.js";

/**
 * Reads a control's value as the markup spells it: the `value` attribute of an
 * input, the text of a textarea, and the value of the option a select marks as
 * selected, which is the first one when the markup marks none.
 */
export function valueOf(element: Element): string | undefined {
	switch (element.localName.toLowerCase()) {
		case "input":
			return element.getAttribute("value") ?? "";
		case "textarea":
			return element.textContent ?? "";
		case "select":
			return selectedValue(element);
		case "button":
		case "option":
			return element.getAttribute("value") ?? undefined;
		default:
			return undefined;
	}
}

/**
 * Reports whether the markup disables a control, through its own attribute, an
 * `aria-disabled` claim, or the disabled `<fieldset>` it sits in.
 */
export function isDisabled(element: Element): boolean {
	if (element.hasAttribute("disabled")) return true;
	if (element.getAttribute("aria-disabled") === "true") return true;
	return Boolean(element.closest("fieldset[disabled]"));
}

/** Reads every attribute as the markup spelled it, so a caller asserts on raw values. */
export function attributesOf(element: Element): Record<string, string> {
	let attributes: Record<string, string> = {};
	for (let attribute of Array.from(element.attributes)) {
		attributes[attribute.name] = attribute.value;
	}
	return attributes;
}

/** Applies a select's submitted value, which falls back to an option's own text. */
function selectedValue(element: Element): string | undefined {
	let options = Array.from(element.querySelectorAll("option"));
	let selected = options.find((option) => option.hasAttribute("selected")) ?? options.at(0);
	if (!selected) return undefined;
	return selected.getAttribute("value") ?? visibleText(selected);
}
