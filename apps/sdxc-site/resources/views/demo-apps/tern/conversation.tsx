/**
 * A Tern conversation: the turns in a log that opens at the newest one, each reply with copy,
 * regenerate and feedback, each message with copy and edit, and the composer pinned under
 * them. Every action is a form, so the whole chat works before any script loads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	CheckIcon,
	ChevronDownIcon,
	EllipsisIcon,
	ExternalLinkIcon,
	FileTextIcon,
	FileCodeIcon,
	PaperclipIcon,
	PanelRightOpenIcon,
	PencilIcon,
	PinIcon,
	PinOffIcon,
	RotateCwIcon,
	Share2Icon,
	ThumbsDownIcon,
	ThumbsUpIcon,
	TrashIcon,
} from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { grow, hstack, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { m, p } from "@sdxc/u/size";
import { text, truncate, weight } from "@sdxc/u/typography";
import {
	Button,
	Dialog,
	Header,
	HeadingScope,
	Keyboard,
	LinkButton,
	Menu,
	Section,
} from "@sdxc/ui";
import { FileTrigger } from "@sdxc/ui/app/file-trigger";
import { OptimisticToggle } from "@sdxc/ui/app/optimistic-toggle";
import {
	Attachment,
	Bubble,
	COMPOSER_INPUT_SLOT,
	Composer,
	ComposerSubmit,
	Message,
	MessageScroller,
	STREAM_PENDING_ATTRIBUTE,
	streamTarget,
} from "@sdxc/ui/chat";
import { CopyButton } from "@sdxc/ui/docs/copy-button";

import type { AssistantTurn, FileRef, UserTurn } from "~/resources/views/demo-apps/tern/data";
import type { Thread } from "~/resources/views/demo-apps/tern/thread";

import { absoluteUrl } from "~/config/constants";
import { EmojiTextarea } from "~/resources/views/demo-apps/emoji-textarea";
import { expandEmoji } from "~/resources/views/demo-apps/expand-emoji";
import { TurnActivityView } from "~/resources/views/demo-apps/tern/activity";
import { ReplyBlocks } from "~/resources/views/demo-apps/tern/blocks";
import { MODELS, actionHref, findModel, href } from "~/resources/views/demo-apps/tern/data";
import { COMPOSER_LABELS, MESSAGE_LABELS } from "~/resources/views/demo-apps/tern/labels";
import { TO_MAIN, TernMark } from "~/resources/views/demo-apps/tern/shell";
import {
	THREAD_FIELD,
	threadKey,
	threadPage,
	threadTitle,
	turnsOf,
	writeThread,
} from "~/resources/views/demo-apps/tern/thread";

/** The hidden form every action button submits through, carrying the thread and model. */
export const ACTIONS_FORM = "tern-actions";

/** The reading column's width, shared by the log and the composer so their edges line up. */
const MEASURE = "46rem";

/** Centres a block at the reading measure with the screen's side padding. */
function column() {
	return raw({
		inlineSize: "100%",
		maxInlineSize: `calc(${MEASURE} + 2rem)`,
		marginInline: "auto",
		paddingInline: "1rem",
		boxSizing: "border-box",
	});
}

/** The hidden fields that carry a thread through a form. */
function ThreadFields(handle: Handle<{ thread: Thread }>) {
	return () => {
		let { thread } = handle.props;
		return (
			<>
				<input type="hidden" name={THREAD_FIELD} value={writeThread(thread)} />
				<input type="hidden" name="model" value={thread.model} />
			</>
		);
	};
}

/** The icon a file's card draws for its kind. */
function fileIcon(file: FileRef): RemixNode {
	return /\.(ts|tsx|js|css|json)$/.test(file.name) ? (
		<FileCodeIcon aria-hidden="true" />
	) : (
		<FileTextIcon aria-hidden="true" />
	);
}

/** One small icon button in a message's footer. */
function ActionButton(
	handle: Handle<{
		label: string;
		children: RemixNode;
		form?: string;
		intent?: string;
		commandfor?: string;
		command?: "show-modal";
	}>,
) {
	return () => {
		let { label, children, form, intent, commandfor, command } = handle.props;
		return (
			<Button
				type={form ? "submit" : "button"}
				form={form}
				name={intent ? "intent" : undefined}
				value={intent}
				commandfor={commandfor}
				command={command}
				variant="ghost"
				color="neutral"
				size="sm"
				aria-label={label}
				title={label}
			>
				{children}
			</Button>
		);
	};
}

/** The footer's copy button, a small island that copies the text of the element it names. */
function CopyAction(handle: Handle<{ target: string }>) {
	return () => (
		<span
			mix={[
				raw({
					display: "inline-flex",
					"& [data-slot=copy-button]": {
						position: "static",
						inlineSize: "2rem",
						blockSize: "2rem",
						borderRadius: "var(--ui-radius-md)",
					},
				}),
			]}
		>
			<CopyButton
				target={handle.props.target}
				label={MESSAGE_LABELS.copy}
				copiedLabel={MESSAGE_LABELS.copied}
			/>
		</span>
	);
}

/** The edit dialog for a message: its text in a field, sent again as a new branch. */
function EditDialog(handle: Handle<{ thread: Thread; index: number; turn: UserTurn }>) {
	return () => {
		let { thread, index, turn } = handle.props;
		let id = `tern-edit-${index}`;
		return (
			<Dialog id={id} aria-labelledby={`${id}-title`}>
				<form
					method="post"
					{...TO_MAIN}
					action={actionHref(threadPage(thread))}
					mix={[vstack({ gap: 4, align: "stretch" })]}
				>
					<Dialog.Header>
						<Dialog.Title id={`${id}-title`}>Edit message</Dialog.Title>
						<Dialog.Description>
							Tern answers the edited message again. Later messages are replaced.
						</Dialog.Description>
					</Dialog.Header>
					<input type="hidden" name="intent" value={`edit-${index}`} />
					<ThreadFields thread={thread} />
					<EmojiTextarea
						id={`${id}-field`}
						name="prompt"
						variant="cairn"
						aria-label="Message"
						required
						rows={4}
						defaultValue={turn.text}
					/>
					<Dialog.Footer>
						<Button type="button" variant="ghost" color="neutral" commandfor={id} command="close">
							Cancel
						</Button>
						<Button type="submit">Send edit</Button>
					</Dialog.Footer>
				</form>
			</Dialog>
		);
	};
}

/** A message from Ines: its files, then the text in a bubble at the trailing edge. */
function UserMessage(
	handle: Handle<{ thread: Thread; index: number; turn: UserTurn; readOnly?: boolean }>,
) {
	return () => {
		let { thread, index, turn, readOnly = false } = handle.props;
		let textId = `tern-turn-${index}`;
		return (
			<Message
				aria-label="You said"
				mix={[raw({ "--ui-message-gap": "0px", "--ui-message-content-max-size": "100%" })]}
			>
				<Message.Content mix={[vstack({ gap: 2, align: "end" })]}>
					{turn.files && turn.files.length > 0 ? (
						<Attachment.Group aria-label="Attached files" mix={[raw({ maxInlineSize: "100%" })]}>
							{turn.files.map((file) => (
								<Attachment mix={[raw({ inlineSize: "15rem" })]}>
									<Attachment.Media>{fileIcon(file)}</Attachment.Media>
									<Attachment.Content>
										<Attachment.Title>{file.name}</Attachment.Title>
										<Attachment.Description>{file.detail}</Attachment.Description>
									</Attachment.Content>
								</Attachment>
							))}
						</Attachment.Group>
					) : null}
					<Bubble align="end" variant="muted" mix={[raw({ maxInlineSize: "min(36rem, 85%)" })]}>
						<Bubble.Content
							id={textId}
							mix={[raw({ whiteSpace: "pre-wrap", overflowWrap: "anywhere" })]}
						>
							{expandEmoji(turn.text)}
						</Bubble.Content>
					</Bubble>
				</Message.Content>
				{readOnly ? null : (
					<Message.Footer mix={[raw({ justifyContent: "flex-end" })]}>
						<CopyAction target={textId} />
						<ActionButton
							label={MESSAGE_LABELS.edit}
							commandfor={`tern-edit-${index}`}
							command="show-modal"
						>
							<PencilIcon size={16} aria-hidden="true" />
						</ActionButton>
						<HeadingScope level={2}>
							<EditDialog thread={thread} index={index} turn={turn} />
						</HeadingScope>
					</Message.Footer>
				)}
			</Message>
		);
	};
}

/** The card a reply carries when it wrote the conversation's canvas document. */
function CanvasCard(handle: Handle<{ thread: Thread }>) {
	return () => {
		let { thread } = handle.props;
		let canvas = thread.base?.canvas;
		if (!canvas || thread.base === null) return null;
		return (
			<a
				{...TO_MAIN}
				href={href(`c/${thread.base.id}?canvas=open`)}
				data-rmx-prefetch="intent"
				mix={[
					hstack({ gap: 3, align: "center" }),
					p(3),
					rounded("lg"),
					raw({
						marginBlockStart: "0.75rem",
						maxInlineSize: "22rem",
						textDecoration: "none",
						border: "1px solid var(--ui-neutral-border)",
						color: "inherit",
						"&:hover": { background: "var(--ui-neutral-bg-tint-hover)" },
					}),
				]}
			>
				<span
					mix={[
						raw({
							display: "inline-grid",
							placeItems: "center",
							inlineSize: "2.25rem",
							blockSize: "2.25rem",
							borderRadius: "var(--ui-radius-md)",
							background: "var(--ui-brand-bg-tint)",
							color: "var(--ui-brand-fg)",
						}),
					]}
				>
					{canvas.kind === "code" ? (
						<FileCodeIcon size={18} aria-hidden="true" />
					) : (
						<FileTextIcon size={18} aria-hidden="true" />
					)}
				</span>
				<span mix={[vstack({ gap: 0, align: "start" }), grow(), raw({ minInlineSize: 0 })]}>
					<span mix={[text("sm"), weight("semibold"), truncate(), raw({ maxInlineSize: "100%" })]}>
						{canvas.title}
					</span>
					<span mix={[text("xs"), fg("neutral.muted")]}>
						Version {canvas.version} · Open in canvas
					</span>
				</span>
				<PanelRightOpenIcon size={16} aria-hidden="true" />
			</a>
		);
	};
}

/** A reply from Tern: the model's name, the rendered blocks, and its actions. */
function AssistantMessage(
	handle: Handle<{
		thread: Thread;
		index: number;
		turn: AssistantTurn;
		streaming: boolean;
		readOnly?: boolean;
	}>,
) {
	return () => {
		let { thread, index, turn, streaming, readOnly = false } = handle.props;
		let replyId = `tern-reply-${index}`;
		let page = threadPage(thread);
		let fields = {
			intent: `rate-${index}`,
			[THREAD_FIELD]: writeThread(thread),
			model: thread.model,
		};

		return (
			<Message aria-label="Tern said" mix={[raw({ "--ui-message-gap": "0px" })]}>
				<Message.Header>
					<span mix={[hstack({ gap: 2, align: "center" })]}>
						<TernMark size={20} />
						Tern
					</span>
					<span>{findModel(turn.model).name}</span>
				</Message.Header>
				<Message.Content
					id={replyId}
					{...(streaming ? { [STREAM_PENDING_ATTRIBUTE]: "" } : {})}
					mix={[
						streamTarget(),
						raw({
							minInlineSize: 0,
							"&[data-stream-end=stopped] [data-slot=tern-stopped]": { display: "block" },
						}),
					]}
				>
					{turn.activity ? <TurnActivityView activity={turn.activity} open={streaming} /> : null}
					<div id={`${replyId}-body`}>
						<ReplyBlocks blocks={turn.blocks} id={replyId} />
					</div>
					{turn.canvas ? <CanvasCard thread={thread} /> : null}
					<p
						data-slot="tern-stopped"
						data-stream-skip
						mix={[
							m(0),
							raw({ display: "none", marginBlockStart: "0.5rem" }),
							text("xs"),
							fg("neutral.muted"),
						]}
					>
						{MESSAGE_LABELS.stopped}
					</p>
				</Message.Content>
				{readOnly ? null : (
					<Message.Footer mix={[hstack({ gap: 0.5, align: "center" })]}>
						<CopyAction target={`${replyId}-body`} />
						<ActionButton
							label={MESSAGE_LABELS.regenerate}
							form={ACTIONS_FORM}
							intent={`regenerate-${index}`}
						>
							<RotateCwIcon size={16} aria-hidden="true" />
						</ActionButton>
						<OptimisticToggle
							action={actionHref(page)}
							name="up"
							pressed={turn.rating === "up"}
							fields={fields}
							labels={{ label: MESSAGE_LABELS.good, failed: MESSAGE_LABELS.failed }}
							pressedContent={<ThumbsUpIcon size={16} fill="currentColor" aria-hidden="true" />}
							unpressedContent={<ThumbsUpIcon size={16} aria-hidden="true" />}
						/>
						<OptimisticToggle
							action={actionHref(page)}
							name="down"
							pressed={turn.rating === "down"}
							fields={fields}
							labels={{ label: MESSAGE_LABELS.bad, failed: MESSAGE_LABELS.failed }}
							pressedContent={<ThumbsDownIcon size={16} fill="currentColor" aria-hidden="true" />}
							unpressedContent={<ThumbsDownIcon size={16} aria-hidden="true" />}
						/>
					</Message.Footer>
				)}
			</Message>
		);
	};
}

namespace Turns {
	export interface Props {
		thread: Thread;
		/** The index of the reply to replay as a stream, when the page just answered a send. */
		streaming?: number;
		/** Draws the turns without their actions, for a shared link. */
		readOnly?: boolean;
	}
}

/** Every turn of the thread as log rows. */
export function Turns(handle: Handle<Turns.Props>) {
	return () => {
		let { thread, streaming, readOnly = false } = handle.props;
		return (
			<>
				{turnsOf(thread).map((turn, index) => (
					<MessageScroller.Item messageId={`turn-${index}`} scrollAnchor={turn.role === "user"}>
						{turn.role === "user" ? (
							<UserMessage thread={thread} index={index} turn={turn} readOnly={readOnly} />
						) : (
							<AssistantMessage
								thread={thread}
								index={index}
								turn={turn}
								streaming={streaming === index}
								readOnly={readOnly}
							/>
						)}
					</MessageScroller.Item>
				))}
			</>
		);
	};
}

/**
 * The scrolling log. It lays out from the bottom, so a long chat opens on its newest turn and
 * a streaming reply keeps the newest words in view, all without script.
 */
export function ChatLog(handle: Handle<{ label: string; children: RemixNode }>) {
	return () => (
		<MessageScroller
			mix={[raw({ border: "none", borderRadius: "0", minBlockSize: 0, display: "grid" })]}
		>
			<MessageScroller.Viewport
				tabIndex={0}
				aria-label={handle.props.label}
				mix={[
					raw({
						display: "flex",
						flexDirection: "column-reverse",
						overflowY: "auto",
						minBlockSize: 0,
					}),
				]}
			>
				<MessageScroller.Content
					mix={[column(), raw({ gap: "1.75rem", paddingBlock: "1.5rem 2rem" })]}
				>
					{handle.props.children}
				</MessageScroller.Content>
			</MessageScroller.Viewport>
		</MessageScroller>
	);
}

namespace ChatComposer {
	export interface Props {
		thread: Thread;
		/** The reply's id to replay as a stream. */
		stream?: string;
	}
}

/**
 * The composer under the log: the message field, attach, how to send and the send button,
 * posting the whole thread so the next page shows the conversation with its new reply.
 */
export function ChatComposer(handle: Handle<ChatComposer.Props>) {
	return () => {
		let { thread, stream } = handle.props;
		return (
			<div
				mix={[
					column(),
					raw({
						paddingBlockEnd: "max(0.75rem, env(safe-area-inset-bottom))",
						paddingBlockStart: "0.25rem",
					}),
				]}
			>
				<Composer
					method="post"
					{...TO_MAIN}
					action={actionHref(threadPage(thread))}
					enctype="multipart/form-data"
				>
					<input type="hidden" name="intent" value="send" />
					<ThreadFields thread={thread} />
					<EmojiTextarea
						id={`tern-composer-${threadKey(thread)}`}
						name="prompt"
						variant="plain"
						aria-label={COMPOSER_LABELS.field}
						placeholder={COMPOSER_LABELS.placeholder}
						required
						data-slot={COMPOSER_INPUT_SLOT}
						data-shortcut="mod+/"
						data-shortcut-label="Focus the message field"
					/>
					<Composer.Toolbar>
						<FileTrigger
							name="files"
							multiple
							variant="ghost"
							size="sm"
							aria-label={COMPOSER_LABELS.attach}
							parts={{
								trigger: [
									raw({
										borderRadius: "999px",
										inlineSize: "2.25rem",
										blockSize: "2.25rem",
										paddingInline: 0,
										justifyContent: "center",
									}),
								],
							}}
						>
							<PaperclipIcon size={18} aria-hidden="true" />
						</FileTrigger>
						<Composer.Hint>
							<Keyboard>Enter</Keyboard> to send · <Keyboard>Shift</Keyboard>{" "}
							<Keyboard>Enter</Keyboard> for a new line
						</Composer.Hint>
						<span mix={[media("(hover: none)", raw({ marginInlineStart: "auto" }))]} />
						<ComposerSubmit
							labels={{ send: COMPOSER_LABELS.send, stop: COMPOSER_LABELS.stop }}
							stream={stream}
							streamKey={stream === undefined ? undefined : threadKey(thread)}
						/>
					</Composer.Toolbar>
				</Composer>
				<p
					mix={[
						m(0),
						raw({ paddingBlockStart: "0.5rem", textAlign: "center" }),
						text("xs"),
						fg("neutral.muted"),
					]}
				>
					Tern is a demo. Its replies are written in advance and nothing you send leaves this page.
				</p>
			</div>
		);
	};
}

namespace ModelPicker {
	export interface Props {
		thread: Thread;
		/** The page the model links keep, with `?model=` added; absent when the picker must post. */
		linkPage?: string;
	}
}

/**
 * The top bar's model picker. On a saved chat or a new one each model is a link, so the
 * choice is in the address; on a chat with sends it posts, keeping the thread.
 */
export function ModelPicker(handle: Handle<ModelPicker.Props>) {
	return () => {
		let { thread, linkPage } = handle.props;
		let current = findModel(thread.model);
		return (
			<>
				<Button
					type="button"
					variant="ghost"
					color="neutral"
					size="sm"
					commandfor="tern-model-menu"
					command="toggle-popover"
					aria-label={`Model: ${current.name}`}
					mix={[raw({ whiteSpace: "nowrap", flexShrink: 0 })]}
				>
					<span mix={[weight("semibold")]}>{current.name}</span>
					<ChevronDownIcon size={14} aria-hidden="true" />
				</Button>
				<Menu id="tern-model-menu" aria-label="Choose a model" placement="bottom-end">
					<Section aria-labelledby="tern-model-heading">
						<Header id="tern-model-heading">Model</Header>
						{MODELS.map((model) => {
							let body = (
								<>
									<span mix={[vstack({ gap: 0, align: "start" }), grow()]}>
										<span>{model.name}</span>
										<span mix={[text("xs"), fg("neutral.muted")]}>{model.description}</span>
									</span>
									{model.id === current.id ? <CheckIcon /> : null}
								</>
							);
							return linkPage === undefined ? (
								<Menu.Item
									type="submit"
									form={ACTIONS_FORM}
									name="intent"
									value={`model-${model.id}`}
									aria-current={model.id === current.id ? "true" : undefined}
								>
									{body}
								</Menu.Item>
							) : (
								<Menu.Item
									{...TO_MAIN}
									href={href(`${linkPage}${linkPage.includes("?") ? "&" : "?"}model=${model.id}`)}
									aria-current={model.id === current.id ? "true" : undefined}
								>
									{body}
								</Menu.Item>
							);
						})}
					</Section>
				</Menu>
			</>
		);
	};
}

/** The id of the dialog that hands out a chat's public link. */
const SHARE_DIALOG = "tern-share";

/**
 * Hands out a chat's public link without leaving the chat: the link to copy, and a way to see
 * the read-only page someone opening it gets, in a new tab.
 */
function ShareDialog(handle: Handle<{ id: string; title: string }>) {
	return () => {
		let { id, title } = handle.props;
		let path = href(`share/${id}`);
		return (
			<Dialog id={SHARE_DIALOG} aria-labelledby={`${SHARE_DIALOG}-title`}>
				<HeadingScope level={2}>
					<Dialog.Header>
						<Dialog.Title id={`${SHARE_DIALOG}-title`}>Share “{title}”</Dialog.Title>
						<Dialog.Description>
							Anyone with the link reads the chat as it is now. Messages you send later stay
							private.
						</Dialog.Description>
					</Dialog.Header>
					<div mix={[hstack({ gap: 2, align: "center" }), p(2), rounded("lg"), bg("neutral.tint")]}>
						<code id={`${SHARE_DIALOG}-link`} mix={[grow(), truncate(), text("sm")]}>
							{absoluteUrl(path)}
						</code>
						<CopyButton
							target={`${SHARE_DIALOG}-link`}
							label="Copy link"
							copiedLabel="Link copied"
						/>
					</div>
					<Dialog.Footer>
						<LinkButton href={path} target="_blank" variant="outline" color="neutral">
							<ExternalLinkIcon size={16} aria-hidden="true" />
							Open shared view
						</LinkButton>
						<Button type="button" commandfor={SHARE_DIALOG} command="close">
							Done
						</Button>
					</Dialog.Footer>
				</HeadingScope>
			</Dialog>
		);
	};
}

/** The chat's overflow menu: pin, share and delete. Pin and delete apply to saved chats only. */
export function ChatMenu(handle: Handle<{ thread: Thread }>) {
	return () => {
		let { thread } = handle.props;
		let base = thread.base;
		if (base === null) return null;
		return (
			<>
				<Button
					type="button"
					variant="ghost"
					color="neutral"
					size="sm"
					commandfor={SHARE_DIALOG}
					command="show-modal"
					mix={[media("(max-width: 40rem)", raw({ display: "none" }))]}
				>
					<Share2Icon size={16} aria-hidden="true" />
					Share
				</Button>
				<Button
					type="button"
					variant="ghost"
					color="neutral"
					size="sm"
					commandfor="tern-chat-menu"
					command="toggle-popover"
					aria-label="Chat options"
					title="Chat options"
				>
					<EllipsisIcon size={16} aria-hidden="true" />
				</Button>
				<Menu id="tern-chat-menu" aria-label="Chat options" placement="bottom-end">
					<Menu.Item
						type="submit"
						form={ACTIONS_FORM}
						name="intent"
						value={base.pinned ? "unpin" : "pin"}
					>
						{base.pinned ? <PinOffIcon /> : <PinIcon />}
						{base.pinned ? "Unpin chat" : "Pin chat"}
					</Menu.Item>
					<Menu.Item commandfor={SHARE_DIALOG} command="show-modal">
						<Share2Icon />
						Share chat
					</Menu.Item>
					<Menu.Separator />
					<Menu.Item type="submit" form={ACTIONS_FORM} name="intent" value="delete">
						<TrashIcon />
						Delete chat
					</Menu.Item>
				</Menu>
				<ShareDialog id={base.id} title={base.title} />
			</>
		);
	};
}

namespace ChatColumn {
	export interface Props {
		thread: Thread;
		/** The reply index to replay as a stream. */
		streaming?: number;
	}
}

/**
 * The conversation's whole column: its title for assistive technology, the log, the composer
 * and the hidden form every action button posts through. It fills the shell's card.
 */
export function ChatColumn(handle: Handle<ChatColumn.Props>) {
	return () => {
		let { thread, streaming } = handle.props;
		return (
			<section
				aria-labelledby="tern-chat-title"
				mix={[
					raw({
						display: "grid",
						gridTemplateRows: "minmax(0, 1fr) auto",
						gridTemplateColumns: "minmax(0, 1fr)",
						blockSize: "100%",
						minBlockSize: 0,
					}),
					bg(),
				]}
			>
				<h1 id="tern-chat-title" mix={[visuallyHidden()]}>
					{threadTitle(thread)}
				</h1>
				<form
					id={ACTIONS_FORM}
					method="post"
					{...TO_MAIN}
					action={actionHref(threadPage(thread))}
					hidden
				>
					<ThreadFields thread={thread} />
				</form>
				<ChatLog label="Conversation">
					<Turns thread={thread} streaming={streaming} />
				</ChatLog>
				<ChatComposer
					thread={thread}
					stream={streaming === undefined ? undefined : `tern-reply-${streaming}`}
				/>
			</section>
		);
	};
}

/** The height the chat fills: the viewport below the shell's top bar and inset. */
export function screenHeight() {
	return [
		raw({ blockSize: "calc(100dvh - var(--ui-app-header-height, 3.5rem))" }),
		media(
			"(min-width: 48rem)",
			raw({
				blockSize:
					"calc(100dvh - var(--ui-app-header-height, 3.5rem) - 2 * var(--ui-app-inset-gap, 0.5rem) - 2px)",
			}),
		),
	];
}
