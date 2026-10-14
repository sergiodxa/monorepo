/**
 * Live example for `ShortcutList`, the two-column list a keyboard-shortcuts panel shows.
 * Which keyboard the reader has comes from the request, so `keyComboGlyphs()` prints the
 * right caps in the server markup and the example needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { ShortcutList } from "@sdxc/ui";
import { keyComboGlyphs } from "@sdxc/ui/utils";

import type { PreviewRequest } from "~/resources/components/ui-previews.server";

/** The source the page shows, matching the markup below. */
const CODE = `<ShortcutList mix={[is("18rem")]}>
	<ShortcutList.Item keys={keyComboGlyphs("mod+k", appleKeyboard)}>Open search</ShortcutList.Item>
	<ShortcutList.Item keys={keyComboGlyphs("mod+s", appleKeyboard)}>Save the draft</ShortcutList.Item>
	<ShortcutList.Item keys={["?"]}>Show keyboard shortcuts</ShortcutList.Item>
</ShortcutList>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Shortcuts panel",
	code: CODE,
	render: ({ appleKeyboard }: PreviewRequest) => (
		<ShortcutList mix={[is("18rem")]}>
			<ShortcutList.Item keys={keyComboGlyphs("mod+k", appleKeyboard)}>
				Open search
			</ShortcutList.Item>
			<ShortcutList.Item keys={keyComboGlyphs("mod+s", appleKeyboard)}>
				Save the draft
			</ShortcutList.Item>
			<ShortcutList.Item keys={["?"]}>Show keyboard shortcuts</ShortcutList.Item>
		</ShortcutList>
	),
};
