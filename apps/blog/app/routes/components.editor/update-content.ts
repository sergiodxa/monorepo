/**
 * Editor helper that splices a replacement string into the full content at the
 * given selection range, returning the new content string. It is the core edit
 * primitive that toolbar actions use to substitute the selected text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SelectionType } from "./get-selection";

/**
 * Update the selected content with the updated content in the given full content
 * @param content The full content string
 * @param selection The selections positions
 * @param updated The update slice of content
 * @returns The final updated content string
 */
export function updateContent(content: string, selection: SelectionType, updated: string) {
	return content.slice(0, selection.start) + updated + content.slice(selection.end);
}
