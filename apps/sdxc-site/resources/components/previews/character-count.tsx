/**
 * Live preview for `CharacterCount`: a post box with a 280-character limit, opened on a
 * draft a few characters from the end, so the ring shows its warning and the number left.
 * Type past the limit and the ring turns red, then gives way to the count over.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { Button } from "@sdxc/ui";
import { CharacterCount } from "@sdxc/ui/character-count";

/** A draft 266 characters long, fourteen short of the limit. */
const DRAFT =
	"Shipped the new sign-up form today: three fields instead of nine. Everything else we used to ask for now comes later, when people actually need it. Conversion is up, support tickets are down, and the sales team still gets every answer they asked for. Asking later wins.";

/** The source the page shows, matching the markup below apart from the preview's sizing. */
const CODE = `<form method="post" action="/posts">
	<textarea id="draft" name="text" aria-label="Post">{draft}</textarea>
	<CharacterCount
		for="draft"
		max={280}
		value={draft}
		holdSubmit
		labels={{ remaining: "{count} characters left", over: "{count} characters over the limit" }}
	/>
	<Button type="submit">Post</Button>
</form>

// Check the same count on the server, so the two never disagree:
if (countCharacters(text) > 280) return answerWithIssue();`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<form
			method="post"
			action="/examples/character-count"
			mix={[raw({ display: "grid", gap: "0.5rem", inlineSize: "min(100%, 26rem)" })]}
		>
			<textarea
				id="preview-draft"
				name="text"
				aria-label="Post"
				rows={5}
				defaultValue={DRAFT}
				mix={[
					raw({
						fieldSizing: "content",
						minBlockSize: "6rem",
						padding: "0.75rem",
						borderRadius: "0.75rem",
						border: "1px solid var(--ui-neutral-border)",
						background: "transparent",
						color: "inherit",
						font: "inherit",
						resize: "none",
					}),
				]}
			/>
			<div
				mix={[
					raw({
						display: "flex",
						justifyContent: "flex-end",
						alignItems: "center",
						gap: "0.75rem",
					}),
				]}
			>
				<CharacterCount
					for="preview-draft"
					max={280}
					value={DRAFT}
					holdSubmit
					labels={{
						remaining: "{count} characters left",
						over: "{count} characters over the limit",
					}}
				/>
				<Button type="submit" color="brand">
					Post
				</Button>
			</div>
		</form>
	),
};
