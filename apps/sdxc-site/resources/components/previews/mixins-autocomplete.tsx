/**
 * Live demo for `autocomplete()`: the server-rendered destination field, which the mixin turns
 * from a native `<datalist>` into a styled listbox that filters as the reader types.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import preview from "~/resources/components/previews/autocomplete";

/** What the preview registry reads: the component carrying the mixin, and its source. */
export default {
	code: `// Autocomplete's island runs autocomplete(), so the suggestions filter as you type.\n${preview.code}`,
	render: preview.render,
};
