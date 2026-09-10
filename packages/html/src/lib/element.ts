/**
 * Turns a DOM element into the plain snapshot a query answers with, carrying enough
 * — role, name, text, value, raw attributes — for a caller to assert on without
 * querying the document a second time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { HTML } from "../index.js";

import { accessibleName } from "./name.js";
import { roleOf } from "./roles.js";
import { visibleText } from "./text.js";

/**
 * Reads one element as data.
 *
 * @param element - The element a query matched
 * @param position - Its 1-based position among the matches the query considered
 */
export function snapshot(element: Element, position: number): HTML.Element {
	let result: HTML.Element = {
		tag: element.localName.toLowerCase(),
		name: accessibleName(element),
		text: visibleText(element),
		attributes: attributesOf(element),
		disabled: isDisabled(element),
		position,
	};

	let role = roleOf(element);
	if (role !== undefined) result.role = role;

	let value = valueOf(element);
	if (value !== undefined) result.value = value;

	return result;
}

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
