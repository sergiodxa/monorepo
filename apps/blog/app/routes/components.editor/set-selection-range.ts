/**
 * Editor helper that applies a SelectionType back onto a textarea by calling
 * setSelectionRange with a forward direction. It restores or moves the caret and
 * highlighted range after the editor programmatically rewrites the content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SelectionType } from "./get-selection";

/**
 * Set the content selection range in the given field input
 * @param selection The selections positions
 * @param field The DOMNode field
 */
export function setSelectionRange(field: HTMLTextAreaElement, selection: SelectionType) {
	field.setSelectionRange(selection.start, selection.end, "forward");
	return null;
}
