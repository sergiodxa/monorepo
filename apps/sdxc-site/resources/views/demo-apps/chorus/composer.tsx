/**
 * The post composer: the writer's avatar, a field that grows with its text, and a footer with
 * the character ring and the Post button. It posts to the page it sits on; with script it can
 * load the answer into the column's frame, where a fresh, empty box replaces it, and the ring
 * counts as you type while Post waits until there is something within the limit to send.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { Button } from "@sdxc/ui";
import { CharacterCount } from "@sdxc/ui/character-count";

import { COLUMN_FRAME, ME, POST_LIMIT, href } from "~/resources/views/demo-apps/chorus/data";
import { COUNT_LABELS } from "~/resources/views/demo-apps/chorus/labels";
import { PersonAvatar } from "~/resources/views/demo-apps/chorus/parts";

namespace Composer {
	export interface Props {
		/** Distinguishes the field when a page has two composers. */
		id: string;
		/** The page the composer sits on and posts to, which a refused post is answered on again. */
		from: string;
		/**
		 * Loads the answer into the column's frame, for a composer whose post lands on the page
		 * it sits on; without it the post loads a whole document.
		 */
		inColumn?: boolean;
		/**
		 * Counts the visitor's posts, so the box the column's frame redraws after a post is a new,
		 * empty one rather than the one holding what was just sent.
		 */
		revision?: number;
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
			from,
			id,
			inColumn = false,
			issue,
			placeholder,
			quote,
			replyTo,
			revision = 0,
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
				data-rmx-key={`composer-${id}-${revision}`}
				data-rmx-target={inColumn ? COLUMN_FRAME : undefined}
				data-rmx-reset-scroll={inColumn ? "manual" : undefined}
				data-rmx-document={inColumn ? undefined : ""}
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
					<textarea
						id={fieldId}
						name="text"
						aria-label={placeholder}
						placeholder={placeholder}
						autofocus={autofocus}
						rows={tall ? 4 : 2}
						defaultValue={value}
						aria-invalid={issue ? "true" : undefined}
						aria-describedby={issue ? issueId : undefined}
						mix={[
							raw({
								fieldSizing: "content",
								minBlockSize: tall ? "7.5rem" : "3.25rem",
								maxBlockSize: "24rem",
								inlineSize: "100%",
								boxSizing: "border-box",
								paddingBlock: "0.5rem",
								paddingInline: "0",
								border: "0",
								resize: "none",
								background: "transparent",
								color: "inherit",
								font: "inherit",
								fontSize: "1.1875rem",
								lineHeight: "1.4",
								outline: "none",
							}),
							when("&::placeholder", raw({ color: "var(--ui-neutral-fg-muted)" })),
						]}
					></textarea>
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
