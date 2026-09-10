/**
 * Computes an element's accessible name the way HTML-AAM and AccName do — through
 * `aria-label`, `aria-labelledby`, an associated `<label>`, an `alt`, and finally the
 * subtree's text — and normalizes it, since that is the form every query compares.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { computeAccessibleName } from "dom-accessibility-api";

import { normalize } from "./text.js";
import { inlineStyle } from "./visibility.js";

/**
 * Reads the name a person addressing the element by voice or by label would use,
 * whitespace-normalized, and empty for an element that names nothing.
 */
export function accessibleName(element: Element): string {
	return normalize(
		computeAccessibleName(element, {
			computedStyleSupportsPseudoElements: false,
			getComputedStyle: inlineStyle,
		}),
	);
}
