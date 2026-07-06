/**
 * Editor helper that reads the current text selection from a textarea, returning
 * its start and end offsets as a SelectionType. It guards that the field is an
 * HTMLTextAreaElement and provides the shared selection shape used across the
 * editor's text-manipulation utilities.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type SelectionType = { start: number; end: number };

/**
 * Get the element selection start and end values
 * @param field The DOM node element
 * @returns The selection start and end
 */
export function getSelection(field: HTMLTextAreaElement) {
	if (!(field instanceof HTMLTextAreaElement)) {
		throw new TypeError("The field must be an HTMLTextAreaElement.");
	}

	return {
		start: field.selectionStart,
		end: field.selectionEnd,
	} as SelectionType;
}
