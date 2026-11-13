/**
 * The compose dialog: one native `<dialog>` in the shell that New post, Reply, Quote and the
 * `n` key open in place, with the field focused. Its body is a frame loaded from the compose
 * address of the control that opened it, and a post lands back on the page it was written on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { Dialog } from "@sdxc/ui";
import { Frame } from "remix/component";

import type { PostView } from "~/resources/views/demo-apps/chorus/state";

import { ComposeOpener } from "~/resources/views/demo-apps/chorus/compose-opener";
import { ComposeReturn } from "~/resources/views/demo-apps/chorus/compose-return";
import { ChorusComposer } from "~/resources/views/demo-apps/chorus/composer";
import { href } from "~/resources/views/demo-apps/chorus/data";
import { PersonAvatar } from "~/resources/views/demo-apps/chorus/parts";

/** The dialog's id, which New post buttons name in `commandfor`. */
export const COMPOSE_DIALOG = "chorus-compose";

/** The frame inside the dialog holding the composer, which each compose control reloads. */
export const COMPOSE_FRAME = "chorus-compose-body";

/** The id of the dialog's title, which names it for assistive tech. */
const TITLE_ID = "chorus-compose-title";

/** From here the dialog floats near the top of the screen; below it fills the phone. */
const FLOATING = "(min-width: 40rem)";

/**
 * Renders the dialog closed, its body loaded for a new post. Opened, it floats near the top of
 * a tablet or desktop screen, as tall as its content, and fills a phone; a press outside it or
 * Escape closes it, keeping what was typed.
 */
export function ComposeDialog(handle: Handle<{ page: string }>) {
	return () => (
		<>
			<Dialog
				id={COMPOSE_DIALOG}
				aria-labelledby={TITLE_ID}
				closedby="any"
				data-slot="chorus-compose"
				mix={[
					raw({
						gap: "0",
						padding: "0",
						inset: "0",
						margin: "0",
						inlineSize: "100%",
						maxInlineSize: "none",
						blockSize: "100dvh",
						maxBlockSize: "none",
						borderRadius: "0",
						backgroundColor: "var(--ui-bg)",
						[`@media ${FLOATING}`]: {
							insetBlock: "5vh auto",
							marginInline: "auto",
							marginBlock: "0 auto",
							maxInlineSize: "37.5rem",
							blockSize: "auto",
							maxBlockSize: "90vh",
							borderRadius: "1rem",
						},
					}),
				]}
			>
				<div
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							minBlockSize: "3.25rem",
							paddingInline: "0.5rem",
						}),
					]}
				>
					<Dialog.Close
						commandfor={COMPOSE_DIALOG}
						aria-label="Close"
						mix={[raw({ position: "static", borderRadius: "999px" })]}
					/>
				</div>
				<Frame
					name={COMPOSE_FRAME}
					src={href(`compose?return=${encodeURIComponent(handle.props.page)}`)}
				/>
			</Dialog>
			<ComposeOpener dialog={COMPOSE_DIALOG} frame={COMPOSE_FRAME} />
		</>
	);
}

/** A post shown above a reply or inside a quote: its author and text, without its actions. */
function PostPreview(handle: Handle<{ post: PostView }>) {
	return () => {
		let { post } = handle.props;
		return (
			<span
				mix={[
					raw({
						display: "grid",
						minInlineSize: "0",
						gap: "0.125rem",
						fontSize: "0.9375rem",
						lineHeight: "1.4",
					}),
				]}
			>
				<span mix={[raw({ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" })]}>
					<strong>{post.person.name}</strong>{" "}
					<span mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>@{post.person.handle}</span>
				</span>
				<span
					mix={[
						raw({
							display: "-webkit-box",
							WebkitBoxOrient: "vertical",
							WebkitLineClamp: "4",
							overflow: "hidden",
							overflowWrap: "anywhere",
						}),
					]}
				>
					{post.text}
				</span>
			</span>
		);
	};
}

namespace ComposeBody {
	export interface Props {
		/** The post being replied to, shown above the field and joined to it by a line. */
		replyTo?: PostView;
		/** The post being quoted, shown under the field. */
		quote?: PostView;
		/** The page a post sent without script returns to. */
		page: string;
	}
}

/**
 * The dialog's body, the content of its frame: the title that names the dialog, the post a
 * reply answers, and the composer posting to `compose` with the page to return to.
 */
export function ComposeBody(handle: Handle<ComposeBody.Props>) {
	return () => {
		let { page, quote, replyTo } = handle.props;
		let title = "New post";
		if (replyTo) title = `Reply to ${replyTo.person.name}`;
		else if (quote) title = "Quote post";
		return (
			<div>
				<h2
					id={TITLE_ID}
					mix={[
						raw({
							position: "absolute",
							inlineSize: "1px",
							blockSize: "1px",
							overflow: "hidden",
							clipPath: "inset(50%)",
						}),
					]}
				>
					{title}
				</h2>
				{replyTo ? (
					<div
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "2.5rem minmax(0, 1fr)",
								columnGap: "0.75rem",
								padding: "0.25rem 1rem 0",
							}),
						]}
					>
						<span
							mix={[
								raw({
									display: "grid",
									gridTemplateRows: "auto 1fr",
									justifyItems: "center",
									"&::after": {
										content: '""',
										inlineSize: "2px",
										marginBlockStart: "0.25rem",
										backgroundColor: "var(--ui-neutral-border)",
									},
								}),
							]}
						>
							<PersonAvatar person={replyTo.person} />
						</span>
						<span mix={[raw({ display: "grid", gap: "0.5rem", paddingBlockEnd: "0.75rem" })]}>
							<PostPreview post={replyTo} />
							<span mix={[raw({ fontSize: "0.9375rem", color: "var(--ui-neutral-fg-muted)" })]}>
								Replying to{" "}
								<span mix={[raw({ color: "var(--ui-brand-fg)" })]}>@{replyTo.person.handle}</span>
							</span>
						</span>
					</div>
				) : null}
				<ChorusComposer
					id="dialog"
					from="compose"
					placeholder={replyTo ? "Post your reply" : "Share something with your circle"}
					submit={replyTo ? "Reply" : "Post"}
					replyTo={replyTo?.id}
					quote={quote?.id}
					autofocus
					tall={!replyTo}
					attachment={
						quote ? (
							<span
								mix={[
									raw({
										display: "grid",
										gridTemplateColumns: "1.5rem minmax(0, 1fr)",
										gap: "0.5rem",
										padding: "0.75rem",
										borderRadius: "1rem",
										border: "1px solid var(--ui-neutral-border)",
									}),
								]}
							>
								<PersonAvatar person={quote.person} size={1.5} />
								<PostPreview post={quote} />
							</span>
						) : undefined
					}
					fields={<ComposeReturn page={page} root={href()} />}
				/>
			</div>
		);
	};
}
