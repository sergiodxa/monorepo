/**
 * Live example for `CharacterCount` on an empty bio field: the ring rests unfilled and the
 * Save button stays disabled until there is something to save, then fills as you type.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { Button } from "@sdxc/ui";
import { CharacterCount } from "@sdxc/ui/character-count";

/** The source the page shows, matching the markup below apart from the preview's sizing. */
const CODE = `<input id="bio" name="bio" aria-label="Bio" />
<CharacterCount
	for="bio"
	max={60}
	warn={10}
	holdSubmit
	labels={{ remaining: "{count} characters left", over: "{count} characters over the limit" }}
/>
<Button type="submit">Save</Button>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Short field",
	code: CODE,
	render: () => (
		<form
			method="post"
			action="/examples/character-count"
			mix={[
				raw({
					display: "flex",
					alignItems: "center",
					gap: "0.75rem",
					inlineSize: "min(100%, 26rem)",
				}),
			]}
		>
			<input
				id="preview-bio"
				name="bio"
				aria-label="Bio"
				placeholder="A line about you"
				mix={[
					raw({
						flex: "1 1 auto",
						minInlineSize: "0",
						blockSize: "2.5rem",
						paddingInline: "0.75rem",
						borderRadius: "0.5rem",
						border: "1px solid var(--ui-neutral-border)",
						background: "transparent",
						color: "inherit",
						font: "inherit",
					}),
				]}
			/>
			<CharacterCount
				for="preview-bio"
				max={60}
				warn={10}
				holdSubmit
				labels={{ remaining: "{count} characters left", over: "{count} characters over the limit" }}
			/>
			<Button type="submit">Save</Button>
		</form>
	),
};
