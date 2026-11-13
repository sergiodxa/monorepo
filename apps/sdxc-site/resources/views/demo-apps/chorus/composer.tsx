/**
 * The post composer: the writer's avatar, a field that grows with its text, and a footer with
 * the character ring and the Post button. It posts to the page it sits on; with script a new
 * post opens its own page in the main frame and a reply lands in place, and the ring counts as
 * you type while Post waits until there is something within the limit to send.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { Button } from "@sdxc/ui";
import { CharacterCount } from "@sdxc/ui/character-count";

import { ComposeSubmit } from "~/resources/views/demo-apps/chorus/compose-submit";
import { ME, POST_LIMIT, href } from "~/resources/views/demo-apps/chorus/data";
import { COUNT_LABELS } from "~/resources/views/demo-apps/chorus/labels";
import { PersonAvatar } from "~/resources/views/demo-apps/chorus/parts";
import { EmojiTextarea } from "~/resources/views/demo-apps/emoji-textarea";
import { MAIN_FRAME } from "~/resources/views/demo-apps/main-frame";

namespace Composer {
	export interface Props {
		/** Distinguishes the field when a page has two composers. */
		id: string;
		/** The page the composer sits on and posts to, which a refused post is answered on again. */
		from: string;
		/** The field's placeholder and accessible name. */
		placeholder: string;
		/** The submit button's text. @default "Post" */
		submit?: string;
		/** What was typed, kept after a refused post. */
		value?: string;
		/** Why the last post was refused, shown under the field. */
		issue?: string;
		/** The post replied to. */
		replyTo?: string;
		/** The post quoted, sent with the new post. */
		quote?: string;
		/** Drawn under the field, such as the quoted post's preview. */
		attachment?: RemixNode;
		/** More fields the form sends, such as the page a dialog's post returns to. */
		fields?: RemixNode;
		/** Opens with the field focused, for the compose page. */
		autofocus?: boolean;
		/** Grows the field taller from the start, for the compose page. */
		tall?: boolean;
	}
}

/** Renders the composer as a form posting to its own page with the `compose` intent. */
export function ChorusComposer(handle: Handle<Composer.Props>) {
	return () => {
		let {
			attachment,
			autofocus,
			fields,
			from,
			id,
			issue,
			placeholder,
			quote,
			replyTo,
			submit = "Post",
			tall,
			value = "",
		} = handle.props;
		let fieldId = `chorus-draft-${id}`;
		let issueId = `${fieldId}-issue`;

		return (
			<form
				method="post"
				action={href(from)}
				data-slot="chorus-composer"
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "2.5rem minmax(0, 1fr)",
						columnGap: "0.75rem",
						padding: "0.75rem 1rem",
					}),
				]}
			>
				<input type="hidden" name="intent" value="compose" />
				{fields}
				{replyTo ? null : <ComposeSubmit frame={MAIN_FRAME} />}
				{replyTo ? <input type="hidden" name="replyTo" value={replyTo} /> : null}
				{quote ? <input type="hidden" name="quote" value={quote} /> : null}
				<PersonAvatar person={ME} />
				<div
					mix={[
						raw({
							display: "grid",
							gap: "0.5rem",
							minInlineSize: "0",
							gridTemplateColumns: "minmax(0, 1fr)",
						}),
					]}
				>
					<EmojiTextarea
						id={fieldId}
						name="text"
						variant="chorus"
						aria-label={placeholder}
						placeholder={placeholder}
						autofocus={autofocus}
						rows={tall ? 4 : 2}
						tall={tall}
						defaultValue={value}
						aria-invalid={issue ? "true" : undefined}
						aria-describedby={issue ? issueId : undefined}
					/>
					{issue ? (
						<p
							id={issueId}
							mix={[raw({ margin: "0", fontSize: "0.875rem", color: "var(--ui-danger-fg)" })]}
						>
							{issue}
						</p>
					) : null}
					{attachment}
					<div
						mix={[
							raw({
								display: "flex",
								alignItems: "center",
								justifyContent: "flex-end",
								gap: "0.75rem",
								paddingBlockStart: "0.5rem",
								borderBlockStart: "1px solid var(--ui-neutral-border)",
							}),
						]}
					>
						<CharacterCount
							for={fieldId}
							max={POST_LIMIT}
							value={value}
							holdSubmit
							labels={COUNT_LABELS}
						/>
						<Button
							type="submit"
							variant="solid"
							color="brand"
							mix={[
								raw({
									"--ui-button-radius": "999px",
									paddingInline: "1.125rem",
									fontWeight: "700",
								}),
							]}
						>
							{submit}
						</Button>
					</div>
				</div>
			</form>
		);
	};
}
