/**
 * The panel beside a conversation: a thread (the message, its replies and a reply box) or the
 * conversation's details (about, members with their presence, pinned messages), each with a
 * close link back to the conversation alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { EmojiPicker } from "@sdxc/emoji/ui";
import { XIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { LinkButton } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";
import { Marker } from "@sdxc/ui/chat/marker";

import type { Conversation } from "~/resources/views/demo-apps/parley/data";
import type { Place } from "~/resources/views/demo-apps/parley/messages";
import type { Entry } from "~/resources/views/demo-apps/parley/model";
import type { VisitorState } from "~/resources/views/demo-apps/parley/state";

import { ChatComposer } from "~/resources/views/demo-apps/parley/conversation";
import {
	ME_HANDLE,
	actionHref,
	conversationPage,
	conversationTitle,
	findPerson,
	href,
} from "~/resources/views/demo-apps/parley/data";
import { EmojiGrid } from "~/resources/views/demo-apps/parley/emoji-panel";
import {
	Days,
	RunGroup,
	messageAnchor,
	withParam,
	withoutParam,
} from "~/resources/views/demo-apps/parley/messages";
import { daysOf, entriesOf, timeOf, whenOf } from "~/resources/views/demo-apps/parley/model";
import { Face, MessageText, PRESENCE_LABEL } from "~/resources/views/demo-apps/parley/parts";
import { TO_MAIN } from "~/resources/views/demo-apps/parley/shell";

namespace PanelFrame {
	export interface Props {
		title: string;
		/** A quieter second line, such as the conversation's name. */
		detail?: string;
		/** Where the close link leads: the conversation without the panel. */
		close: string;
		/** Tabs or other controls under the title. */
		nav?: RemixNode;
		children: RemixNode;
	}
}

/** The panel's chrome: a title row with its close link over content that scrolls on its own. */
function PanelFrame(handle: Handle<PanelFrame.Props>) {
	return () => {
		let { title, detail, close, nav, children } = handle.props;
		return (
			<section
				aria-label={title}
				mix={[
					raw({
						display: "grid",
						gridTemplateRows: "auto auto minmax(0, 1fr)",
						blockSize: "100%",
						minBlockSize: "0",
						backgroundColor: "var(--ui-bg)",
					}),
				]}
			>
				<header
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							paddingInline: "1.25rem 0.5rem",
							blockSize: "3rem",
							borderBlockEnd: "1px solid var(--ui-neutral-border)",
						}),
					]}
				>
					<h2 mix={[raw({ margin: "0", fontSize: "1rem", fontWeight: "700" })]}>{title}</h2>
					{detail === undefined ? null : (
						<span mix={[raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })]}>
							{detail}
						</span>
					)}
					<span mix={[raw({ flex: "1" })]} />
					<LinkButton
						href={close}
						{...TO_MAIN}
						variant="ghost"
						color="neutral"
						size="sm"
						aria-label={`Close ${title.toLowerCase()}`}
						mix={[raw({ inlineSize: "2rem", paddingInline: "0" })]}
					>
						<XIcon size={16} aria-hidden="true" />
					</LinkButton>
				</header>
				{nav ?? <span />}
				<div mix={[raw({ overflowY: "auto", minBlockSize: "0" })]}>{children}</div>
			</section>
		);
	};
}

namespace ThreadPanel {
	export interface Props {
		conversation: Conversation;
		entry: Entry;
		place: Place;
		now: number;
		editing?: string;
		draft?: string;
	}
}

/** A thread: the message it hangs off, a count of its replies, the replies and a reply box. */
export function ThreadPanel(handle: Handle<ThreadPanel.Props>) {
	return () => {
		let { conversation, entry, place, now, editing, draft } = handle.props;
		let close = href(withoutParam(withoutParam(place.back, "thread"), "edit"));
		let count = entry.replies.length;
		return (
			<PanelFrame title="Thread" detail={conversationTitle(conversation)} close={close}>
				<div mix={[raw({ display: "grid", alignContent: "start", paddingBlock: "0.75rem 0" })]}>
					<RunGroup
						run={{ author: entry.author, entries: [entry] }}
						place={place}
						inThread
						editing={editing}
						now={now}
					/>
					<Marker
						variant="separator"
						mix={[raw({ paddingInline: "1.25rem", paddingBlock: "0.5rem" })]}
					>
						<Marker.Content>
							{count === 0 ? "No replies yet" : `${count} ${count === 1 ? "reply" : "replies"}`}
						</Marker.Content>
					</Marker>
					<div data-live-log={`thread-${entry.id}`}>
						<Days
							days={daysOf(entry.replies, undefined, now)}
							place={place}
							inThread
							editing={editing}
							now={now}
							plain
						/>
					</div>
					<ChatComposer
						conversation={conversation}
						place={place}
						parent={entry.id}
						draft={draft}
						id={`thread-composer-${entry.id}`}
					/>
				</div>
			</PanelFrame>
		);
	};
}

/** The details tabs, in order. */
const TABS = [
	{ id: "about", label: "About" },
	{ id: "members", label: "Members" },
	{ id: "pins", label: "Pinned" },
] as const;

/** A details tab's id. */
export type DetailsTab = (typeof TABS)[number]["id"];

/** Reads a details tab from the address, or `undefined` for anything else. */
export function detailsTab(value: string | null): DetailsTab | undefined {
	return TABS.find((tab) => tab.id === value)?.id;
}

/** One label and value in the About tab. */
function Fact(handle: Handle<{ label: string; children: RemixNode }>) {
	return () => (
		<div mix={[raw({ display: "grid", gap: "0.125rem" })]}>
			<dt
				mix={[raw({ fontSize: "0.75rem", fontWeight: "600", color: "var(--ui-neutral-fg-muted)" })]}
			>
				{handle.props.label}
			</dt>
			<dd mix={[raw({ margin: "0", fontSize: "0.875rem" })]}>{handle.props.children}</dd>
		</div>
	);
}

namespace DetailsPanel {
	export interface Props {
		conversation: Conversation;
		state: VisitorState;
		tab: DetailsTab;
		place: Place;
		now: number;
	}
}

/** The conversation's details: what it is, who is in it and present, and what is pinned. */
export function DetailsPanel(handle: Handle<DetailsPanel.Props>) {
	return () => {
		let { conversation, state, tab, place, now } = handle.props;
		let base = withoutParam(place.back, "details");
		let close = href(base);
		let members = conversation.members.flatMap((handle) => findPerson(handle) ?? []);
		let pinned = entriesOf(conversation, state, now).filter((entry) => entry.pinned);
		let creator = conversation.created ? findPerson(conversation.created.by) : undefined;
		let visibility = "Public to everyone at Fernhill";
		if (conversation.kind === "dm") visibility = "Direct message";
		if (conversation.private) visibility = "Private: only members can see and join it";
		let nav = (
			<nav
				aria-label="Details"
				mix={[
					raw({
						display: "flex",
						gap: "0.25rem",
						paddingInline: "1rem",
						borderBlockEnd: "1px solid var(--ui-neutral-border)",
					}),
				]}
			>
				{TABS.map((candidate) => (
					<a
						href={href(withParam(base, "details", candidate.id))}
						{...TO_MAIN}
						aria-current={candidate.id === tab ? "page" : undefined}
						mix={[
							raw({
								paddingInline: "0.5rem",
								paddingBlock: "0.625rem",
								fontSize: "0.875rem",
								fontWeight: "600",
								textDecoration: "none",
								color: "var(--ui-neutral-fg-muted)",
								borderBlockEnd: "2px solid transparent",
								marginBlockEnd: "-1px",
								"&[aria-current=page]": {
									color: "var(--ui-neutral-fg-emphasis)",
									borderBlockEndColor: "var(--ui-brand-bg-solid)",
								},
								"&:hover": { color: "var(--ui-neutral-fg-emphasis)" },
								"&:focus-visible": { outline: "2px solid var(--ui-brand-ring)" },
							}),
						]}
					>
						{candidate.label}
						{candidate.id === "members" ? ` · ${members.length}` : ""}
						{candidate.id === "pins" && pinned.length > 0 ? ` · ${pinned.length}` : ""}
					</a>
				))}
			</nav>
		);
		return (
			<PanelFrame title="Details" detail={conversationTitle(conversation)} close={close} nav={nav}>
				{tab === "about" ? (
					<dl mix={[raw({ display: "grid", gap: "1rem", margin: "0", padding: "1.25rem" })]}>
						<Fact label={conversation.kind === "channel" ? "Topic" : "Status"}>
							{conversation.kind === "channel"
								? conversation.topic
								: (findPerson(conversation.name)?.status ?? "No status")}
						</Fact>
						{conversation.purpose === undefined ? null : (
							<Fact label="Purpose">{conversation.purpose}</Fact>
						)}
						{creator === undefined || conversation.created === undefined ? null : (
							<Fact label="Created">
								By {creator.name}, {Math.round(conversation.created.daysAgo / 30)} months ago
							</Fact>
						)}
						<Fact label="Visibility">{visibility}</Fact>
					</dl>
				) : null}
				{tab === "members" ? (
					<ul mix={[raw({ listStyle: "none", margin: "0", padding: "0.5rem 0" })]}>
						{members.map((person) => (
							<li>
								<a
									href={
										person.handle === ME_HANDLE || person.bot
											? undefined
											: href(conversationPage(`d:${person.handle}`))
									}
									{...TO_MAIN}
									mix={[
										raw({
											display: "grid",
											gridTemplateColumns: "auto minmax(0, 1fr) auto",
											alignItems: "center",
											gap: "0.75rem",
											paddingInline: "1.25rem",
											paddingBlock: "0.5rem",
											color: "inherit",
											textDecoration: "none",
											"&[href]:hover": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
											"&:focus-visible": {
												outline: "2px solid var(--ui-brand-ring)",
												outlineOffset: "-2px",
											},
										}),
									]}
								>
									<Face person={person} size="md" presence />
									<span mix={[raw({ display: "grid", minInlineSize: "0" })]}>
										<span mix={[raw({ fontWeight: "600", fontSize: "0.875rem" })]}>
											{person.name}
											{person.handle === ME_HANDLE ? " (you)" : ""}
										</span>
										<span
											mix={[
												raw({
													fontSize: "0.75rem",
													color: "var(--ui-neutral-fg-muted)",
													overflow: "hidden",
													textOverflow: "ellipsis",
													whiteSpace: "nowrap",
												}),
											]}
										>
											{person.status ?? person.title}
										</span>
									</span>
									<span
										mix={[
											raw({
												display: "inline-flex",
												alignItems: "center",
												gap: "0.375rem",
												fontSize: "0.75rem",
												color: "var(--ui-neutral-fg-muted)",
											}),
										]}
									>
										{PRESENCE_LABEL[person.presence]}
									</span>
								</a>
							</li>
						))}
					</ul>
				) : null}
				{tab === "pins" && pinned.length === 0 ? (
					<Empty>
						<Empty.Title>Nothing pinned yet</Empty.Title>
						<Empty.Description>
							Pin a message from its menu to keep it here for everyone.
						</Empty.Description>
					</Empty>
				) : null}
				{tab === "pins" && pinned.length > 0 ? (
					<ul
						mix={[
							raw({
								listStyle: "none",
								margin: "0",
								padding: "1rem",
								display: "grid",
								gap: "0.75rem",
							}),
						]}
					>
						{pinned.map((entry) => (
							<li
								mix={[
									raw({
										display: "grid",
										gap: "0.375rem",
										padding: "0.75rem",
										borderRadius: "var(--ui-radius-md)",
										border: "1px solid var(--ui-neutral-border)",
									}),
								]}
							>
								<span
									mix={[
										raw({
											display: "flex",
											alignItems: "center",
											gap: "0.5rem",
											fontSize: "0.8125rem",
										}),
									]}
								>
									<Face person={entry.author} size="xs" />
									<strong>{entry.author.name}</strong>
									<span mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>
										{whenOf(entry.at, now)}
										{whenOf(entry.at, now) === timeOf(entry.at) ? "" : ` · ${timeOf(entry.at)}`}
									</span>
								</span>
								<div
									mix={[raw({ fontSize: "0.875rem", maxBlockSize: "10rem", overflow: "hidden" })]}
								>
									<MessageText text={entry.text} />
								</div>
								<a
									href={`${href(base)}#${messageAnchor(entry.id)}`}
									mix={[
										raw({
											fontSize: "0.8125rem",
											color: "var(--ui-brand-fg)",
											fontWeight: "600",
										}),
									]}
								>
									View in conversation
								</a>
							</li>
						))}
					</ul>
				) : null}
			</PanelFrame>
		);
	};
}

namespace ReactPanel {
	export interface Props {
		conversation: Conversation;
		entry: Entry;
		place: Place;
	}
}

/**
 * The reaction picker as a page of its own, for a visitor without script: every emoji is a
 * submit button in one form that reacts to the message and returns to the conversation.
 */
export function ReactPanel(handle: Handle<ReactPanel.Props>) {
	return () => {
		let { conversation, entry, place } = handle.props;
		let back = withoutParam(place.back, "react");
		return (
			<PanelFrame title="Add reaction" detail={conversationTitle(conversation)} close={href(back)}>
				<form
					method="post"
					action={actionHref(place.page)}
					mix={[raw({ display: "grid", gap: "0.75rem", padding: "1rem" })]}
				>
					<input type="hidden" name="intent" value="react" />
					<input type="hidden" name="id" value={entry.id} />
					<input type="hidden" name="on" value="1" />
					<input type="hidden" name="return" value={back} />
					<p
						mix={[raw({ margin: "0", fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}
					>
						Reacting to {entry.author.name}: “{entry.text.slice(0, 80)}
						{entry.text.length > 80 ? "…" : ""}”
					</p>
					<EmojiPicker mix={[raw({ inlineSize: "100%", boxSizing: "border-box" })]}>
						<EmojiGrid submit="emoji" />
					</EmojiPicker>
				</form>
			</PanelFrame>
		);
	};
}
