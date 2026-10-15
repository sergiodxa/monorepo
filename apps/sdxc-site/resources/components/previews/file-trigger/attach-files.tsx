/**
 * Live example for a `FileTrigger` in the brand outline style taking several files. The
 * trigger is a `<label>` around a visually hidden file input, so the picker opens with no
 * script and the example is plain markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PaperclipIcon } from "@sdxc/icons";
import { FileTrigger } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<FileTrigger name="attachments" multiple color="brand" variant="outline">
	<PaperclipIcon aria-hidden="true" />
	Attach files
</FileTrigger>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Several files",
	code: CODE,
	render: () => (
		<FileTrigger name="attachments" multiple color="brand" variant="outline">
			<PaperclipIcon aria-hidden="true" />
			Attach files
		</FileTrigger>
	),
};
