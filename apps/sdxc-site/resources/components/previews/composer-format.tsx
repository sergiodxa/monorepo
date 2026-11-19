/**
 * Live preview island for `ComposerFormat`. The row edits the composer it sits in, so the
 * preview is a composer with text to select: a button or its shortcut wraps the selection in
 * Markdown, a second press takes it off, and Undo reverts either.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { Composer, ComposerSubmit } from "@sdxc/ui/chat";
import { ComposerFormat } from "@sdxc/ui/chat/composer-format";
import { clientEntry } from "remix/component";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const CODE = `<Composer method="post" action="/messages">
	<Composer.Input name="body" aria-label="Message" placeholder="Select a word, then press ⌘B" />
	<Composer.Toolbar>
		<ComposerFormat
			labels={{
				bold: "Bold",
				italic: "Italic",
				strike: "Strikethrough",
				code: "Code",
				link: "Link",
				quote: "Quote",
				list: "List",
			}}
		/>
		<ComposerSubmit labels={{ send: "Send message", stop: "Stop" }} />
	</Composer.Toolbar>
</Composer>`;

/** A composer with the formatting row, hydrated so the page loads this example's chunk alone. */
export const ComposerFormatPreview = clientEntry(import.meta.url, function ComposerFormatPreview() {
	return () => (
		<Composer method="post" action="/examples/composer-format" mix={[is("28rem")]}>
			<Composer.Input
				name="body"
				aria-label="Message"
				placeholder="Select a word, then press ⌘B"
				value="Ship the release notes today"
			/>
			<Composer.Toolbar>
				<ComposerFormat
					labels={{
						bold: "Bold",
						italic: "Italic",
						strike: "Strikethrough",
						code: "Code",
						link: "Link",
						quote: "Quote",
						list: "List",
					}}
				/>
				<ComposerSubmit labels={{ send: "Send message", stop: "Stop" }} />
			</Composer.Toolbar>
		</Composer>
	);
});

export default { code: CODE, render: () => <ComposerFormatPreview /> };
