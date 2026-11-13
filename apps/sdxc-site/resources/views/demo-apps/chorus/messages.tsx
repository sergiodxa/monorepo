/**
 * Messages: the conversations list, and one conversation as bubbles with a box to answer.
 * Each is its own address loaded into the column's frame, so the nav stays put, a phone
 * shows one pane at a time, and the back link leads up.
 * A post shared from its menu arrives here with the conversation still to pick.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { SendIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { Banner, Button, LinkButton } from "@sdxc/ui";

import type { Conversation, Message, Person } from "~/resources/views/demo-apps/chorus/data";
import type { PostView, VisitorState } from "~/resources/views/demo-apps/chorus/state";

import {
	COLUMN_FRAME,
	CONVERSATIONS,
	ME,
	NOW,
	actionHref,
	findPerson,
	href,
} from "~/resources/views/demo-apps/chorus/data";
import { TitleBar } from "~/resources/views/demo-apps/chorus/feed";
import { PersonAvatar, fullDate, shortAge } from "~/resources/views/demo-apps/chorus/parts";
import { ChorusColumn } from "~/resources/views/demo-apps/chorus/shell";

/**
 * A conversation's messages with the visitor's own sent ones after them, as the visitor reads it.
 *
 * @param conversation The conversation.
 * @param state The visitor's state.
 */
export function messagesWith(conversation: Conversation, state: VisitorState): Message[] {
	let sent = state.messages
		.filter((message) => message.to === conversation.with)
		.map((message) => ({
			from: ME.handle,
			text: message.text,
			at: new Date(message.at).toISOString(),
		}));
	return [...conversation.messages, ...sent];
}

/** The address a shared post adds to a conversation link, so its box opens with the post. */
function shareQuery(share: PostView | undefined): string {
	return share ? `?share=${share.id}` : "";
}

namespace MessagesScreen {
	export interface Props {
		state: VisitorState;
		now: number;
		/** A post the visitor is sending, which every conversation link carries on. */
		share?: PostView;
	}
}

/** The conversations, most recent first, each with its last message. */
export function MessagesScreen(handle: Handle<MessagesScreen.Props>) {
	return () => {
		let { now, share, state } = handle.props;
		return (
			<ChorusColumn current="messages" phoneBar header={<TitleBar title="Messages" />}>
				{share ? (
					<div mix={[raw({ padding: "0.75rem 1rem 0" })]}>
						<Banner
							label="Sharing a post"
							action={
								<LinkButton
									href={href(`post/${share.id}`)}
									variant="outline"
									color="neutral"
									size="sm"
								>
									Cancel
								</LinkButton>
							}
						>
							Pick a conversation to send {share.person.name}'s post.
						</Banner>
					</div>
				) : null}
				<ul
					aria-label="Conversations"
					mix={[raw({ margin: "0", padding: "0", listStyle: "none" })]}
				>
					{CONVERSATIONS.map((conversation) => {
						let person = findPerson(conversation.with);
						if (!person) return null;
						let messages = messagesWith(conversation, state);
						let last = messages[messages.length - 1];
						let age = last ? ageOfMessage(last, now) : 0;
						return (
							<li>
								<a
									href={href(`messages/${person.handle}${shareQuery(share)}`)}
									data-rmx-target={COLUMN_FRAME}
									data-rmx-prefetch="intent"
									mix={[
										raw({
											display: "grid",
											gridTemplateColumns: "2.5rem minmax(0, 1fr)",
											columnGap: "0.75rem",
											alignItems: "center",
											padding: "0.75rem 1rem",
											borderBlockEnd: "1px solid var(--ui-neutral-border)",
											color: "inherit",
											textDecoration: "none",
										}),
										when("&:hover", raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })),
										when(
											"&:focus-visible",
											raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "-2px" }),
										),
									]}
								>
									<PersonAvatar person={person} />
									<span
										mix={[
											raw({
												display: "grid",
												minInlineSize: "0",
												gridTemplateColumns: "minmax(0, 1fr)",
											}),
										]}
									>
										<span
											mix={[
												raw({
													display: "flex",
													gap: "0.25rem",
													whiteSpace: "nowrap",
													minInlineSize: "0",
												}),
											]}
										>
											<strong mix={[raw({ overflow: "hidden", textOverflow: "ellipsis" })]}>
												{person.name}
											</strong>
											<span
												mix={[
													raw({
														color: "var(--ui-neutral-fg-muted)",
														overflow: "hidden",
														textOverflow: "ellipsis",
													}),
												]}
											>
												@{person.handle}
											</span>
											{last ? (
												<span mix={[raw({ color: "var(--ui-neutral-fg-muted)", flexShrink: "0" })]}>
													· {shortAge(age, last.at)}
												</span>
											) : null}
										</span>
										<span
											mix={[
												raw({
													overflow: "hidden",
													textOverflow: "ellipsis",
													whiteSpace: "nowrap",
													fontSize: "0.9375rem",
													color: "var(--ui-neutral-fg-muted)",
												}),
											]}
										>
											{last ? `${last.from === ME.handle ? "You: " : ""}${last.text}` : ""}
										</span>
									</span>
								</a>
							</li>
						);
					})}
				</ul>
			</ChorusColumn>
		);
	};
}

/** How long ago a message was sent: the visitor's against the clock, the rest against the fixtures' now. */
function ageOfMessage(message: Message, now: number): number {
	let reference = Date.parse(message.at) > Date.parse(NOW) ? now : Date.parse(NOW);
	return Math.max(0, reference - Date.parse(message.at));
}

namespace ConversationScreen {
	export interface Props {
		person: Person;
		conversation: Conversation;
		state: VisitorState;
		now: number;
		share?: PostView;
	}
}

/** One conversation: the messages as bubbles, the visitor's on the end side, and the reply box. */
export function ConversationScreen(handle: Handle<ConversationScreen.Props>) {
	return () => {
		let { conversation, now, person, share, state } = handle.props;
		let messages = messagesWith(conversation, state);
		let draft = share
			? `${share.person.name}: “${share.text.slice(0, 120)}” ${href(`post/${share.id}`)}`
			: "";
		return (
			<ChorusColumn
				current="messages"
				compose={false}
				tabBar={false}
				header={
					<TitleBar
						title={person.name}
						subtitle={`@${person.handle}`}
						back={href("messages")}
						backInColumn
					/>
				}
			>
				<ol
					aria-label={`Messages with ${person.name}`}
					mix={[
						raw({
							display: "grid",
							gap: "0.5rem",
							margin: "0",
							padding: "1rem",
							listStyle: "none",
						}),
					]}
				>
					{messages.map((message, index) => {
						let mine = message.from === ME.handle;
						return (
							<li
								id={index === messages.length - 1 ? "latest" : undefined}
								data-mine={mine ? "" : undefined}
								mix={[
									raw({
										display: "grid",
										justifyItems: "start",
										gap: "0.25rem",
										scrollMarginBlockEnd: "8rem",
									}),
									when("&[data-mine]", raw({ justifyItems: "end" })),
								]}
							>
								<p
									mix={[
										raw({
											margin: "0",
											maxInlineSize: "min(80%, 26rem)",
											padding: "0.625rem 0.875rem",
											borderRadius: "1.25rem 1.25rem 1.25rem 0.375rem",
											backgroundColor: "var(--ui-neutral-bg-tint-hover)",
											lineHeight: "1.4",
											overflowWrap: "anywhere",
										}),
										when(
											"[data-mine] > &",
											raw({
												borderRadius: "1.25rem 1.25rem 0.375rem 1.25rem",
												backgroundColor: "var(--ui-brand-bg-solid)",
												color: "white",
											}),
										),
									]}
								>
									<span
										mix={[
											raw({
												position: "absolute",
												inlineSize: "1px",
												overflow: "hidden",
												clipPath: "inset(50%)",
											}),
										]}
									>
										{mine ? "You" : person.name}:{" "}
									</span>
									{message.text}
								</p>
								<time
									datetime={message.at}
									title={fullDate(message.at)}
									mix={[raw({ fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)" })]}
								>
									{shortAge(ageOfMessage(message, now), message.at)}
								</time>
							</li>
						);
					})}
				</ol>
				<form
					method="post"
					action={actionHref(`messages/${person.handle}`)}
					data-rmx-key={`reply-${messages.length}`}
					data-rmx-target={COLUMN_FRAME}
					data-rmx-reset-scroll="manual"
					mix={[
						raw({
							position: "sticky",
							insetBlockEnd: "0",
							marginBlockStart: "auto",
							display: "flex",
							gap: "0.5rem",
							alignItems: "flex-end",
							padding: "0.5rem 1rem",
							borderBlockStart: "1px solid var(--ui-neutral-border)",
							backgroundColor: "var(--ui-bg)",
						}),
					]}
				>
					<textarea
						name="text"
						aria-label={`Message ${person.name}`}
						placeholder="Write a message"
						required
						rows={1}
						defaultValue={draft}
						autofocus={share !== undefined}
						mix={[
							raw({
								flex: "1 1 auto",
								fieldSizing: "content",
								minBlockSize: "2.5rem",
								maxBlockSize: "10rem",
								boxSizing: "border-box",
								padding: "0.5rem 1rem",
								borderRadius: "1.25rem",
								border: "1px solid transparent",
								backgroundColor: "var(--ui-neutral-bg-tint-hover)",
								color: "inherit",
								font: "inherit",
								fontSize: "1rem",
								resize: "none",
								outline: "none",
							}),
							when("&:focus", raw({ borderColor: "var(--ui-brand-border-strong)" })),
						]}
					></textarea>
					<Button
						type="submit"
						variant="solid"
						color="brand"
						aria-label="Send message"
						mix={[
							raw({
								"--ui-button-radius": "999px",
								blockSize: "2.5rem",
								inlineSize: "2.5rem",
								paddingInline: "0",
							}),
						]}
					>
						<SendIcon size={18} aria-hidden="true" />
					</Button>
				</form>
			</ChorusColumn>
		);
	};
}
