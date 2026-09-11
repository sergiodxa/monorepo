/**
 * Computes an element's accessible name the way HTML-AAM and AccName do — through
 * `aria-label`, `aria-labelledby`, an associated `<label>`, an `alt`, and finally the
 * subtree's text — and normalizes it, since that is the form every query compares.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { computeAccessibleName } from "dom-accessibility-api";

import type { DOMElement } from "./dom.js";

import { normalize } from "./text.js";
import { inlineStyle } from "./visibility.js";

/** The element the name computation reads, spelled in the ambient DOM it is typed against. */
type NameSubject = Parameters<typeof computeAccessibleName>[0];

/** The style hook the name computation calls, likewise spelled in the ambient DOM. */
type NameStyle = NonNullable<Parameters<typeof computeAccessibleName>[1]>["getComputedStyle"];

/**
 * Reads the name a person addressing the element by voice or by label would use,
 * whitespace-normalized, and empty for an element that names nothing.
 */
export function accessibleName(element: DOMElement): string {
	// The computation walks the tree through the same members this package declares, and
	// its types name them in whatever DOM its own compilation sees, so the two vocabularies
	// meet here as a cast and the parsed element travels through unchanged.
	return normalize(
		computeAccessibleName(element as unknown as NameSubject, {
			computedStyleSupportsPseudoElements: false,
			getComputedStyle: inlineStyle as unknown as NameStyle,
		}),
	);
}
