/**
 * Live preview island for `TextArea`. The field grows with its content through
 * `field-sizing: content`, and the browser's own `minLength`/`maxLength` decide
 * whether the composer may post — so the example is a review composer that shows
 * both: type past a line and the field grows, post too short and the field reports
 * itself invalid. The island keeps the counter and the error copy current, which is
 * the part the platform leaves to the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { hstack, vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { Button, Description, FieldError, Label, Text, TextArea } from "@sdxc/ui";
import { clientEntry, css, on } from "remix/ui";

/** The shortest review the composer accepts, mirrored onto the field's own `minLength`. */
const MIN_LENGTH = 30;

/** The longest review the composer accepts, mirrored onto the field's own `maxLength`. */
const MAX_LENGTH = 400;

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const TEXTAREA_CODE = `<form>
	<Label htmlFor="preview-review">Your review</Label>
	<TextArea
		id="preview-review"
		name="review"
		required
		rows={3}
		minLength={30}
		maxLength={400}
		placeholder="What did you think of it?"
		aria-describedby="preview-review-hint preview-review-error"
		aria-invalid={message === "" ? undefined : "true"}
		mix={[on<HTMLTextAreaElement, "input">("input", readLength)]}
	/>

	<Description id="preview-review-hint">Reviews are public and show your display name.</Description>
	<FieldError id="preview-review-error" hidden={message === ""}>
		{message}
	</FieldError>

	<Text>{length} / 400</Text>
	<Button type="submit" size="sm">Post review</Button>
</form>`;

/** A review composer that grows and reports itself, hydrated so both are visible. */
export const TextAreaPreview = clientEntry(
	"/resources/components/previews/textarea.tsx#TextAreaPreview",
	function TextAreaPreview(handle: Handle) {
		let length = 0;
		let message = "";

		/** Keeps the counter, and any reported error, current with what has been typed. */
		function readLength(event: Event) {
			let field = event.currentTarget;
			if (!(field instanceof HTMLTextAreaElement)) return;

			length = field.value.length;
			if (message !== "") message = field.validationMessage;

			void handle.update();
		}

		/** Reports the browser's own verdict instead of letting it show a native bubble. */
		function report(event: Event) {
			event.preventDefault();

			let field = event.currentTarget;
			if (!(field instanceof HTMLTextAreaElement)) return;

			message = field.validationMessage;
			void handle.update();
		}

		return () => (
			<form
				mix={[
					vstack({ gap: 2, align: "stretch" }),
					is("26rem"),
					// A docs page has nowhere to post to, so a valid submission clears the
					// composer's own error instead of navigating away from the example.
					on<HTMLFormElement, "submit">("submit", (event) => {
						event.preventDefault();
						message = "";
						void handle.update();
					}),
				]}
			>
				<Label htmlFor="preview-review">Your review</Label>
				<TextArea
					id="preview-review"
					name="review"
					required
					rows={3}
					minLength={MIN_LENGTH}
					maxLength={MAX_LENGTH}
					placeholder="What did you think of it?"
					aria-describedby="preview-review-hint preview-review-error"
					aria-invalid={message === "" ? undefined : "true"}
					mix={[
						css({ resize: "vertical" }),
						on<HTMLTextAreaElement, "input">("input", readLength),
						on<HTMLTextAreaElement, "invalid">("invalid", report),
					]}
				/>

				<Description id="preview-review-hint">
					Reviews are public and show your display name.
				</Description>
				<FieldError id="preview-review-error" hidden={message === ""}>
					{message}
				</FieldError>

				<div mix={[hstack({ gap: 3, align: "center", justify: "between" })]}>
					<Text>
						{length} / {MAX_LENGTH}
					</Text>
					<Button type="submit" size="sm">
						Post review
					</Button>
				</div>
			</form>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: TEXTAREA_CODE, render: () => <TextAreaPreview /> };
