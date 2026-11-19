/**
 * Live preview island for `EmojiPicker`. The picker has two jobs, so the preview shows both:
 * in the composer's toolbar a pick lands at the caret, and beside a message an "add reaction"
 * picker is a form whose every emoji is a submit button that posts without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { FaceSlightlySmilingPlusIcon } from "@sdxc/icons";
import { hstack, vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { Composer, ComposerSubmit } from "@sdxc/ui/chat";
import { EmojiPicker } from "@sdxc/ui/chat/emoji-picker";
import { clientEntry } from "remix/component";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const CODE = `<Composer method="post" action="/messages">
	<Composer.Input name="body" aria-label="Message" placeholder="Say something nice" />
	<Composer.Toolbar>
		<EmojiPicker
			id="composer-emoji"
			labels={{ trigger: "Insert emoji", search: "Search emoji", empty: "No emoji found" }}
		/>
		<ComposerSubmit labels={{ send: "Send message", stop: "Stop" }} />
	</Composer.Toolbar>
</Composer>

<form method="post" action="/messages/42/reactions">
	<EmojiPicker
		id="react-42"
		name="emoji"
		variant="outline"
		trigger={<FaceSlightlySmilingPlusIcon size={16} aria-hidden="true" />}
		labels={{ trigger: "Add reaction", search: "Search emoji", empty: "No emoji found" }}
	/>
</form>`;

/** Both modes of the picker, hydrated so the page loads this example's chunk alone. */
export const EmojiPickerPreview = clientEntry(import.meta.url, function EmojiPickerPreview() {
	return () => (
		<div mix={[vstack({ gap: 4, align: "stretch" }), is("26rem")]}>
			<Composer method="post" action="/examples/emoji-picker">
				<Composer.Input name="body" aria-label="Message" placeholder="Say something nice" />
				<Composer.Toolbar>
					<EmojiPicker
						id="preview-composer-emoji"
						labels={{ trigger: "Insert emoji", search: "Search emoji", empty: "No emoji found" }}
					/>
					<ComposerSubmit labels={{ send: "Send message", stop: "Stop" }} />
				</Composer.Toolbar>
			</Composer>

			<form method="post" action="/examples/emoji-picker" mix={[hstack({ gap: 2 })]}>
				<EmojiPicker
					id="preview-react"
					name="emoji"
					variant="outline"
					trigger={<FaceSlightlySmilingPlusIcon size={16} aria-hidden="true" />}
					labels={{ trigger: "Add reaction", search: "Search emoji", empty: "No emoji found" }}
				/>
			</form>
		</div>
	);
});

export default { code: CODE, render: () => <EmojiPickerPreview /> };
