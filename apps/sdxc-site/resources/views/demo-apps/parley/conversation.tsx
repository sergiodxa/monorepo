/**
 * A Parley conversation: the channel or DM's top bar, its log opening on the newest line with
 * the "New" divider at the last read, the typing line and the composer (format, mentions,
 * emoji, files), with a thread or the details beside it in a split, or stacked on a phone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { InfoIcon, PaperclipIcon, PinIcon, SearchIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { media } from "@sdxc/u/responsive";
import { Keyboard, LinkButton } from "@sdxc/ui";
import { FileTrigger } from "@sdxc/ui/app/file-trigger";
import { SplitView } from "@sdxc/ui/app/split-view";
import { Composer } from "@sdxc/ui/chat/composer";
import { ComposerFormat } from "@sdxc/ui/chat/composer-format";
import { ComposerSubmit } from "@sdxc/ui/chat/composer-submit";
import { EmojiPicker } from "@sdxc/ui/chat/emoji-picker";
import { MentionMenu } from "@sdxc/ui/chat/mention-menu";
import { MessageScroller } from "@sdxc/ui/chat/message-scroller";

import type { Conversation } from "~/resources/views/demo-apps/parley/data";
import type { Place } from "~/resources/views/demo-apps/parley/messages";
import type { Entry } from "~/resources/views/demo-apps/parley/model";
import type { VisitorState } from "~/resources/views/demo-apps/parley/state";

import { demoAppCookiePath } from "~/resources/views/demo-apps";
import { MAIN_FRAME } from "~/resources/views/demo-apps/main-frame";
import {
	ME_HANDLE,
	PEOPLE,
	SLUG,
	actionHref,
	conversationPage,
	conversationTitle,
	findPerson,
	href,
	streamHref,
} from "~/resources/views/demo-apps/parley/data";
import { COMPOSER_LABELS, SPLIT_LABELS } from "~/resources/views/demo-apps/parley/labels";
import { ParleyLive } from "~/resources/views/demo-apps/parley/live";
import { Days, withParam, withoutParam } from "~/resources/views/demo-apps/parley/messages";
import { daysOf, entriesOf, readAt, unreadOf } from "~/resources/views/demo-apps/parley/model";
import { ChannelGlyph, Face } from "~/resources/views/demo-apps/parley/parts";
import { ParleyPane, TO_MAIN } from "~/resources/views/demo-apps/parley/shell";

/** The cookie the conversation and side panel split is remembered in. */
export const SPLIT_COOKIE = "parley-split";

/** The panel a conversation's address can open beside it. */
export type Panel =
	| { kind: "thread"; entry: Entry }
	| { kind: "details"; tab: "about" | "members" | "pins" };

/** Everyone in the workspace as the mention list offers them, teammates first. */
export function mentionPeople(conversation: Conversation) {
	let members = new Set(conversation.members);
	return PEOPLE.filter((person) => person.handle !== ME_HANDLE)
		.sort((a, b) => Number(members.has(b.handle)) - Number(members.has(a.handle)))
		.map((person) => ({
			id: person.handle,
			handle: person.handle,
			name: person.name,
			detail: members.has(person.handle)
				? person.title
				: `${person.title} · not in this conversation`,
			initials: person.initials,
			color: `oklch(0.88 0.075 ${person.hue})`,
		}));
}

namespace ChatComposer {
	export interface Props {
		conversation: Conversation;
		place: Place;
		/** The message a thread composer replies to. */
		parent?: string;
		/** Text a refused send typed, put back in the field. */
		draft?: string;
		/** The field's id, unique per composer on the page. */
		id: string;
	}
}

/**
 * The composer: a plain multipart form that posts with Enter, with format buttons, mentions on
 * `@`, an emoji grid and file attachments. Without script it is a field and a Send button.
 */
export function ChatComposer(handle: Handle<ChatComposer.Props>) {
	return () => {
		let { conversation, place, parent, draft, id } = handle.props;
		let title = conversationTitle(conversation);
		let placeholder = parent === undefined ? `Message ${title}` : "Reply…";
		return (
			<div
				mix={[
					raw({
						paddingInline: "1rem",
						paddingBlock: "0.25rem max(0.75rem, env(safe-area-inset-bottom))",
					}),
				]}
			>
				<Composer
					method="post"
					action={actionHref(place.page)}
					enctype="multipart/form-data"
					mix={[raw({ "--ui-composer-radius": "var(--ui-radius-lg)" })]}
				>
					<input type="hidden" name="intent" value="send" />
					<input type="hidden" name="return" value={place.back} />
					{parent === undefined ? null : <input type="hidden" name="parent" value={parent} />}
					<Composer.Toolbar
						mix={[
							raw({
								borderBlockEnd: "1px solid var(--ui-neutral-border)",
								paddingBlockEnd: "0.25rem",
								"@media (scripting: none)": { display: "none" },
							}),
						]}
					>
						<ComposerFormat target={id} labels={COMPOSER_LABELS.format} />
					</Composer.Toolbar>
					<Composer.Input
						id={id}
						name="text"
						aria-label={placeholder}
						placeholder={placeholder}
						required
						maxLength={600}
						data-shortcut={parent === undefined ? "mod+/" : undefined}
						data-shortcut-label={parent === undefined ? "Focus the message field" : undefined}
						defaultValue={draft}
					/>

					<MentionMenu
						target={id}
						people={mentionPeople(conversation)}
						labels={{ list: COMPOSER_LABELS.mentions, empty: COMPOSER_LABELS.mentionsEmpty }}
					/>
					<Composer.Toolbar>
						<FileTrigger
							name="files"
							multiple
							variant="ghost"
							size="sm"
							aria-label={COMPOSER_LABELS.attach}
							parts={{
								trigger: [raw({ inlineSize: "2rem", paddingInline: 0, justifyContent: "center" })],
							}}
						>
							<PaperclipIcon size={17} aria-hidden="true" />
						</FileTrigger>
						<EmojiPicker
							id={`${id}-emoji`}
							target={id}
							labels={{
								trigger: COMPOSER_LABELS.emoji,
								search: COMPOSER_LABELS.emojiSearch,
								empty: COMPOSER_LABELS.emojiEmpty,
							}}
						/>
						<Composer.Hint>
							<Keyboard>Enter</Keyboard> to send · <Keyboard>Shift</Keyboard>{" "}
							<Keyboard>Enter</Keyboard> for a new line
						</Composer.Hint>
						<span mix={[media("(hover: none)", raw({ marginInlineStart: "auto" }))]} />
						<ComposerSubmit labels={{ send: COMPOSER_LABELS.send, stop: COMPOSER_LABELS.send }} />
					</Composer.Toolbar>
				</Composer>
			</div>
		);
	};
}

/** The start of a conversation's history: what it is for, or who the DM is with. */
function Beginning(handle: Handle<{ conversation: Conversation }>) {
	return () => {
		let { conversation } = handle.props;
		let person = conversation.kind === "dm" ? findPerson(conversation.name) : undefined;
		let creator = conversation.created ? findPerson(conversation.created.by) : undefined;
		return (
			<header
				mix={[
					raw({
						display: "grid",
						gap: "0.375rem",
						justifyItems: "start",
						paddingInline: "1.25rem",
						paddingBlock: "2rem 1rem",
					}),
				]}
			>
				{person === undefined ? (
					<span
						mix={[
							raw({
								display: "inline-grid",
								placeItems: "center",
								inlineSize: "3.5rem",
								blockSize: "3.5rem",
								borderRadius: "0.875rem",
								color: "var(--ui-brand-fg-emphasis)",
								backgroundColor: "var(--ui-brand-bg-tint)",
							}),
						]}
					>
						<ChannelGlyph conversation={conversation} size={26} />
					</span>
				) : (
					<Face person={person} size="lg" />
				)}
				<h2 mix={[raw({ margin: "0.375rem 0 0", fontSize: "1.375rem", fontWeight: "800" })]}>
					{conversationTitle(conversation)}
				</h2>
				<p
					mix={[raw({ margin: "0", color: "var(--ui-neutral-fg-muted)", maxInlineSize: "38rem" })]}
				>
					{person === undefined
						? `${conversation.purpose ?? conversation.topic}${
								creator === undefined ? "" : ` ${creator.name} created this channel.`
							}`
						: `This is the beginning of your direct messages with ${person.name}, ${person.title.toLowerCase()} in ${person.zone}.`}
				</p>
			</header>
		);
	};
}

namespace ConversationColumn {
	export interface Props {
		conversation: Conversation;
		state: VisitorState;
		now: number;
		place: Place;
		editing?: string;
		current?: string;
		draft?: string;
	}
}

/**
 * The log, the typing line and the composer, in a column whose log opens on the newest line
 * and keeps it in view as lines arrive, without script.
 */
export function ConversationColumn(handle: Handle<ConversationColumn.Props>) {
	return () => {
		let { conversation, state, now, place, editing, current, draft } = handle.props;
		let since = readAt(conversation, state, now);
		let unread = unreadOf(conversation, state, now);
		let days = daysOf(entriesOf(conversation, state, now), since, now);
		return (
			<div
				mix={[
					raw({
						display: "grid",
						gridTemplateRows: "minmax(0, 1fr) auto auto",
						gridTemplateColumns: "minmax(0, 1fr)",
						blockSize: "100%",
						minBlockSize: "0",
					}),
				]}
			>
				<MessageScroller
					mix={[
						raw({
							border: "none",
							borderRadius: "0",
							minBlockSize: "0",
							display: "grid",
							gridTemplateColumns: "minmax(0, 1fr)",
						}),
					]}
				>
					<MessageScroller.Viewport
						tabIndex={0}
						aria-label={`Messages in ${conversationTitle(conversation)}`}
						data-live-viewport=""
						mix={[
							raw({
								display: "flex",
								flexDirection: "column-reverse",
								overflowY: "auto",
								minBlockSize: "0",
							}),
						]}
					>
						<MessageScroller.Content
							data-live-log="log"
							mix={[raw({ paddingBlockEnd: "0.5rem", minInlineSize: "0", maxInlineSize: "100%" })]}
						>
							<Beginning conversation={conversation} />
							<Days days={days} place={place} editing={editing} current={current} now={now} />
						</MessageScroller.Content>
					</MessageScroller.Viewport>
				</MessageScroller>
				<div mix={[raw({ paddingInline: "1.25rem", minBlockSize: "1.5rem" })]}>
					<ParleyLive
						conversation={conversation.key}
						src={streamHref(`live/${conversationPage(conversation.key)}`)}
						action={actionHref(place.page)}
						unread={unread.count > 0}
					/>
				</div>
				<ChatComposer
					conversation={conversation}
					place={place}
					draft={draft}
					id={`composer-${conversation.key.replace(":", "-")}`}
				/>
			</div>
		);
	};
}

namespace HeaderActions {
	export interface Props {
		conversation: Conversation;
		page: string;
		pins: number;
	}
}

/** The top bar's controls: members, pins, search in the conversation and its details. */
function HeaderActions(handle: Handle<HeaderActions.Props>) {
	return () => {
		let { conversation, page, pins } = handle.props;
		let members = conversation.members
			.flatMap((handle) => findPerson(handle) ?? [])
			.filter((person) => !person.bot);
		let base = withoutParam(withoutParam(page, "thread"), "edit");
		let wide = media("(max-width: 40rem)", raw({ display: "none" }));
		return (
			<>
				<span mix={[raw({ display: "contents" }), wide]}>
					{conversation.kind === "channel" ? (
						<LinkButton
							href={href(withParam(base, "details", "members"))}
							{...TO_MAIN}
							variant="outline"
							color="neutral"
							size="sm"
							aria-label={`${members.length} members`}
						>
							<span
								mix={[
									raw({ display: "inline-flex", "& > * + *": { marginInlineStart: "-0.375rem" } }),
								]}
							>
								{members.slice(0, 3).map((person) => (
									<Face person={person} size="xs" />
								))}
							</span>
							{members.length}
						</LinkButton>
					) : null}
					<LinkButton
						href={href(withParam(base, "details", "pins"))}
						{...TO_MAIN}
						variant="ghost"
						color="neutral"
						size="sm"
						aria-label={`${pins} pinned`}
						title="Pinned messages"
					>
						<PinIcon size={16} aria-hidden="true" />
						{pins > 0 ? pins : null}
					</LinkButton>
					<LinkButton
						href={href(`search?in=${encodeURIComponent(conversation.key)}`)}
						{...TO_MAIN}
						variant="ghost"
						color="neutral"
						size="sm"
						aria-label={`Search in ${conversationTitle(conversation)}`}
						title={`Search in ${conversationTitle(conversation)}`}
						mix={[raw({ inlineSize: "2rem", paddingInline: "0" })]}
					>
						<SearchIcon size={16} aria-hidden="true" />
					</LinkButton>
				</span>
				<LinkButton
					href={href(withParam(base, "details", "about"))}
					{...TO_MAIN}
					variant="ghost"
					color="neutral"
					size="sm"
					aria-label="Conversation details"
					title="Conversation details"
					data-shortcut="mod+shift+i"
					data-shortcut-label="Open conversation details"
					data-shortcut-group="Conversation"
					mix={[raw({ inlineSize: "2rem", paddingInline: "0" })]}
				>
					<InfoIcon size={16} aria-hidden="true" />
				</LinkButton>
			</>
		);
	};
}

namespace ConversationScreen {
	export interface Props {
		conversation: Conversation;
		state: VisitorState;
		now: number;
		collapsed: boolean;
		/** The page path with its query, which forms return to. */
		page: string;
		panel?: Panel;
		/** The panel's content, drawn in the split's detail pane. */
		panelContent?: RemixNode;
		editing?: string;
		draft?: string;
		layout?: SplitView.Layout;
	}
}

/** Renders a conversation in the shell's pane, with its panel beside it when one is open. */
export function ConversationScreen(handle: Handle<ConversationScreen.Props>) {
	return () => {
		let { conversation, state, now, collapsed, page, panel, panelContent, editing, draft, layout } =
			handle.props;
		let path = conversationPage(conversation.key);
		let place: Place = { page: path, back: page };
		let entries = entriesOf(conversation, state, now);
		let pins = entries.filter((entry) => entry.pinned).length;
		let person = conversation.kind === "dm" ? findPerson(conversation.name) : undefined;
		let column = (
			<ConversationColumn
				conversation={conversation}
				state={state}
				now={now}
				place={place}
				editing={editing}
				current={panel?.kind === "thread" ? panel.entry.id : undefined}
				draft={draft}
			/>
		);
		return (
			<ParleyPane
				collapsed={collapsed}
				flush
				back={href()}
				title={
					<span mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.375rem" })]}>
						{person === undefined ? (
							<ChannelGlyph conversation={conversation} size={15} />
						) : (
							<Face person={person} size="xs" presence />
						)}
						{person === undefined ? conversation.name : person.name}
					</span>
				}
				detail={person === undefined ? conversation.topic : (person.status ?? person.title)}
				actions={<HeaderActions conversation={conversation} page={page} pins={pins} />}
			>
				<div
					mix={[
						raw({
							blockSize: "calc(100dvh - var(--ui-app-header-height, 3.5rem))",
							minBlockSize: "0",
							"--ui-app-list-width": "34rem",
							"@media (min-width: 48rem)": {
								blockSize: "auto",
								flex: "1 1 0",
								"[data-slot='app-shell-content']:has(&)": {
									display: "flex",
									flexDirection: "column",
								},
								"[data-slot='app-shell-main']:has(&), [data-main-region]:has(&), [data-main-screen]:has(&)":
									{
										display: "flex",
										flexDirection: "column",
										flex: "1 1 0",
										minBlockSize: "0",
									},
							},
						}),
					]}
				>
					{panel === undefined || panelContent === undefined ? (
						column
					) : (
						<SplitView
							id="parley-split"
							cookie={SPLIT_COOKIE}
							cookiePath={demoAppCookiePath(SLUG)}
							list={column}
							detail={panelContent}
							active="detail"
							backHref={href(withoutParam(withoutParam(page, "thread"), "details"))}
							frame={MAIN_FRAME}
							layout={layout}
							keys="view"
							labels={SPLIT_LABELS}
						/>
					)}
				</div>
			</ParleyPane>
		);
	};
}
