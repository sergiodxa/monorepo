/**
 * Live example for an icon-only `FileTrigger` that picks a whole folder. `acceptDirectory`
 * switches the picker to directories and `aria-label` names the input, while the glyph is
 * what a sighted reader clicks; the example is plain markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { FolderIcon } from "@sdxc/icons";
import { FileTrigger } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<FileTrigger name="folder" acceptDirectory variant="outline" aria-label="Choose a folder to import">
	<FolderIcon aria-hidden="true" />
</FileTrigger>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Folder picker",
	code: CODE,
	render: () => (
		<FileTrigger
			name="folder"
			acceptDirectory
			variant="outline"
			aria-label="Choose a folder to import"
		>
			<FolderIcon aria-hidden="true" />
		</FileTrigger>
	),
};
