/**
 * Editor helper that constructs the ChangeEvent object emitted by the Markdown
 * editor, bundling the selected text, its selection range, the current markdown
 * value, and the native DOM change event. It gives toolbar actions a consistent
 * payload describing an edit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ChangeEvent } from "react";

import type { SelectionType } from "./get-selection";

export type ChangeEventType = Record<string, never>;

/**
 * Create a ChangeEvent object
 * @param selected  The selected text
 * @param selection The selection position
 * @param  markdown  The current value
 * @param native The native triggered DOM event
 * @returns The ChangeEvent object
 */
export function createChangeEvent(
	selected: string,
	selection: SelectionType,
	markdown: string,
	native: ChangeEvent<HTMLTextAreaElement>,
) {
	return { selected, selection, markdown, native };
}
