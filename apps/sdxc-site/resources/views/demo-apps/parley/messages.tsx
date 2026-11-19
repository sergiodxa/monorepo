/**
 * Parley's message log: days under sticky separators, the "New" divider at the visitor's last
 * read, each run of one person's lines as a message group with reactions, thread summaries and
 * an action bar, and the inline form an edit opens. Every action is a plain form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import {
	EllipsisIcon,
	MessageSquareTextIcon,
	PencilIcon,
	PinIcon,
	PinOffIcon,
	FaceSlightlySmilingPlusIcon,
	TrashIcon,
} from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { Button, LinkButton, Menu } from "@sdxc/ui";
import { Marker } from "@sdxc/ui/chat/marker";
import { MessageGroup } from "@sdxc/ui/chat/message-group";
import { ReactionBar } from "@sdxc/ui/chat/reaction-bar";

import type { Day, Entry, ReactionView, Run } from "~/resources/views/demo-apps/parley/model";

import {
	ME_HANDLE,
	QUICK_REACTIONS,
	actionHref,
	href,
} from "~/resources/views/demo-apps/parley/data";
import { customEmoji, emojiLabel } from "~/resources/views/demo-apps/parley/emoji";
import { MESSAGE_LABELS } from "~/resources/views/demo-apps/parley/labels";
import { timeOf, whenOf } from "~/resources/views/demo-apps/parley/model";
import { Face, Files, MessageText } from "~/resources/views/demo-apps/parley/parts";
import { TO_MAIN } from "~/resources/views/demo-apps/parley/shell";

/** The element id a message's line takes, which a `#hash` and the thread panel point at. */
export function messageAnchor(id: string): string {
	return `msg-${id}`;
}

/** Where a message's forms post and return to. */
export interface Place {
	/** The conversation's page path, which every form posts to. */
	page: string;
	/** The page with its query, which a form returns to, such as `c/design?thread=d4`. */
	back: string;
}

/** Adds a query parameter to a page path that may already carry a query. */
export function withParam(page: string, name: string, value: string): string {
	let [path = "", query = ""] = page.split("?", 2);
	let params = new URLSearchParams(query);
	params.set(name, value);
	return `${path}?${params.toString()}`;
}

/** Drops a query parameter from a page path. */
export function withoutParam(page: string, name: string): string {
	let [path = "", query = ""] = page.split("?", 2);
	let params = new URLSearchParams(query);
	params.delete(name);
	let rest = params.toString();
	return rest === "" ? path : `${path}?${rest}`;
}

/** The hidden fields every message form carries. */
function Hidden(handle: Handle<{ fields: Record<string, string> }>) {
	return () => (
		<>
			{Object.entries(handle.props.fields).map(([name, value]) => (
				<input type="hidden" name={name} value={value} />
			))}
		</>
	);
}

/** Who reacted, for the chip's tooltip. */
function reactors(reaction: ReactionView): string {
	let names = reaction.people.map((person) =>
		person.handle === ME_HANDLE ? "You" : person.name.split(" ")[0],
	);
	return `${names.join(", ")} reacted with ${reaction.emoji}`;
}

/** The address that opens the reaction picker for a message, without script. */
export function reactHref(place: Place, id: string): string {
	return href(withParam(withoutParam(withoutParam(place.back, "thread"), "details"), "react", id));
}

/** The control that opens the emoji picker to react to a message: a link the island upgrades. */
function AddReaction(handle: Handle<{ id: string; place: Place; size: number }>) {
	return () => {
		let { id, place, size } = handle.props;
		return (
			<LinkButton
				href={reactHref(place, id)}
				{...TO_MAIN}
				data-emoji-react={id}
				variant="ghost"
				color="neutral"
				size="sm"
				aria-label={MESSAGE_LABELS.react}
				title={MESSAGE_LABELS.react}
				mix={[raw({ inlineSize: "2rem", paddingInline: "0" })]}
			>
				<FaceSlightlySmilingPlusIcon size={size} aria-hidden="true" />
			</LinkButton>
		);
	};
}

namespace Reactions {
	export interface Props {
		entry: Entry;
		place: Place;
	}
}

/**
 * A message's reactions: each chip a form that toggles the visitor's reaction, the add button,
 * and the template a reaction picked in place is cloned from. The row hides while empty, and is
 * always drawn so a first reaction has somewhere to land.
 */
function Reactions(handle: Handle<Reactions.Props>) {
	return () => {
		let { entry, place } = handle.props;
		let fields = { intent: "react", id: entry.id, return: place.back };
		return (
			<ReactionBar aria-label={MESSAGE_LABELS.reactions}>
				{entry.reactions.map((reaction) => (
					<form method="post" action={actionHref(place.page)}>
						<Hidden fields={{ ...fields, emoji: reaction.emoji }} />
						<ReactionBar.Reaction
							emoji={reaction.emoji}
							image={customEmoji(reaction.emoji)?.src}
							label={emojiLabel(reaction.emoji)}
							count={reaction.people.length}
							pressed={reaction.mine}
							title={reactors(reaction)}
						/>
					</form>
				))}
				<ReactionBar.Add>
					<AddReaction id={entry.id} place={place} size={14} />
				</ReactionBar.Add>
				<ReactionBar.Template>
					<form method="post" action={actionHref(place.page)}>
						<Hidden fields={fields} />
						<input type="hidden" name="emoji" value="" data-reaction-emoji="" />
						<ReactionBar.Reaction emoji="" label="" count={0} />
					</form>
				</ReactionBar.Template>
			</ReactionBar>
		);
	};
}

namespace Actions {
	export interface Props {
		entry: Entry;
		place: Place;
		/** Leaves out "Reply in thread", for a line already in a thread. */
		inThread?: boolean;
	}
}

/**
 * A line's action bar: quick reactions, the full picker, reply in thread and a menu with
 * edit, pin and delete. The menu's items submit a form outside the bar, so they post without
 * script; the menu itself sits beside the bar so a touch screen can open it.
 */
function Actions(handle: Handle<Actions.Props>) {
	return () => {
		let { entry, place, inThread = false } = handle.props;
		let formId = `act-${entry.id}`;
		let menuId = `menu-${entry.id}`;
		let fields = { id: entry.id, return: place.back };
		let iconButton = raw({ inlineSize: "2rem", paddingInline: "0" });
		return (
			<>
				<MessageGroup.Actions aria-label={MESSAGE_LABELS.actions}>
					<form method="post" action={actionHref(place.page)} data-quick-react={entry.id}>
						<Hidden fields={{ ...fields, intent: "react", on: "1" }} />
						{QUICK_REACTIONS.map((emoji) => {
							let custom = customEmoji(emoji);
							return (
								<Button
									type="submit"
									name="emoji"
									value={emoji}
									data-label={emojiLabel(emoji)}
									variant="ghost"
									color="neutral"
									size="sm"
									aria-label={`React with ${emojiLabel(emoji)}`}
									title={emojiLabel(emoji)}
									mix={[iconButton]}
								>
									{custom === undefined ? (
										<span mix={[raw({ fontSize: "1rem" })]}>{emoji}</span>
									) : (
										<img
											src={custom.src}
											alt=""
											mix={[raw({ inlineSize: "1.125rem", blockSize: "1.125rem" })]}
										/>
									)}
								</Button>
							);
						})}
					</form>
					<AddReaction id={entry.id} place={place} size={16} />
					{inThread ? null : (
						<LinkButton
							href={href(withParam(withoutParam(place.back, "details"), "thread", entry.id))}
							{...TO_MAIN}
							variant="ghost"
							color="neutral"
							size="sm"
							aria-label={MESSAGE_LABELS.reply}
							title={MESSAGE_LABELS.reply}
							mix={[iconButton]}
						>
							<MessageSquareTextIcon size={16} aria-hidden="true" />
						</LinkButton>
					)}
					<Button
						type="button"
						variant="ghost"
						color="neutral"
						size="sm"
						commandfor={menuId}
						command="toggle-popover"
						aria-label={MESSAGE_LABELS.more}
						title={MESSAGE_LABELS.more}
						mix={[iconButton]}
					>
						<EllipsisIcon size={16} aria-hidden="true" />
					</Button>
				</MessageGroup.Actions>
				<form id={formId} method="post" action={actionHref(place.page)} hidden>
					<Hidden fields={fields} />
				</form>
				<Menu id={menuId} placement="bottom-end" aria-label={MESSAGE_LABELS.actions}>
					{inThread ? null : (
						<Menu.Item href={href(withParam(place.back, "thread", entry.id))} {...TO_MAIN}>
							<MessageSquareTextIcon size={16} aria-hidden="true" />
							{MESSAGE_LABELS.reply}
						</Menu.Item>
					)}
					<Menu.Item
						type="submit"
						form={formId}
						name="intent"
						value={entry.pinned ? "unpin" : "pin"}
					>
						{entry.pinned ? (
							<PinOffIcon size={16} aria-hidden="true" />
						) : (
							<PinIcon size={16} aria-hidden="true" />
						)}
						{entry.pinned ? MESSAGE_LABELS.unpin : MESSAGE_LABELS.pin}
					</Menu.Item>
					{entry.mine ? (
						<>
							<Menu.Item href={href(`${withParam(place.back, "edit", entry.id)}`)} {...TO_MAIN}>
								<PencilIcon size={16} aria-hidden="true" />
								{MESSAGE_LABELS.edit}
							</Menu.Item>
							<Menu.Separator />
							<Menu.Item type="submit" form={formId} name="intent" value="delete" danger>
								<TrashIcon size={16} aria-hidden="true" />
								{MESSAGE_LABELS.delete}
							</Menu.Item>
						</>
					) : null}
				</Menu>
			</>
		);
	};
}

namespace EditForm {
	export interface Props {
		entry: Entry;
		place: Place;
	}
}

/**
 * The inline edit: the message's text in a field, Save and Cancel. Escape-free and plain, so it
 * works without script; Cancel leads back to the conversation without `?edit`.
 */
function EditForm(handle: Handle<EditForm.Props>) {
	return () => {
		let { entry, place } = handle.props;
		let back = withoutParam(place.back, "edit");
		return (
			<form
				method="post"
				action={actionHref(place.page)}
				mix={[raw({ display: "grid", gap: "0.5rem" })]}
			>
				<Hidden fields={{ intent: "edit", id: entry.id, return: back }} />
				<textarea
					name="text"
					aria-label={MESSAGE_LABELS.edit}
					required
					autofocus
					defaultValue={entry.text}
					mix={[
						raw({
							font: "inherit",
							fontSize: "0.9375rem",
							lineHeight: "1.5",
							padding: "0.5rem 0.625rem",
							borderRadius: "var(--ui-radius-md)",
							border: "1px solid var(--ui-neutral-border-strong)",
							background: "var(--ui-bg)",
							color: "inherit",
							resize: "vertical",
							minBlockSize: "4.5rem",
							fieldSizing: "content",
							"&:focus-visible": {
								outline: "2px solid var(--ui-brand-ring)",
								outlineOffset: "1px",
							},
						}),
					]}
				/>
				<span mix={[raw({ display: "flex", gap: "0.5rem", justifyContent: "flex-end" })]}>
					<LinkButton href={href(back)} {...TO_MAIN} variant="outline" color="neutral" size="sm">
						{MESSAGE_LABELS.cancel}
					</LinkButton>
					<Button type="submit" size="sm">
						{MESSAGE_LABELS.save}
					</Button>
				</span>
			</form>
		);
	};
}

namespace Line {
	export interface Props {
		entry: Entry;
		/** The first line of its run, which carries the face and the name. */
		first: boolean;
		place: Place;
		/** The id whose edit form is open. */
		editing?: string;
		/** The id the thread panel shows, marked current. */
		current?: string;
		inThread?: boolean;
		now: number;
	}
}

/** One message line: face and name on the first of a run, else the gutter time. */
function Line(handle: Handle<Line.Props>) {
	return () => {
		let { entry, first, place, editing, current, inThread = false, now } = handle.props;
		let author = entry.author;
		let time = (
			<time dateTime={new Date(entry.at).toISOString()} title={whenOf(entry.at, now)}>
				{timeOf(entry.at)}
			</time>
		);
		let replies = entry.replies;
		let repliers = [
			...new Map(replies.map((reply) => [reply.author.handle, reply.author])).values(),
		];
		let lastReply = replies.at(-1);
		return (
			<MessageGroup.Item
				id={messageAnchor(entry.id)}
				mentioned={entry.mentionsMe}
				current={current === entry.id}
				data-message={entry.id}
			>
				{first ? (
					<>
						<MessageGroup.Avatar>
							<Face person={author} size="md" />
						</MessageGroup.Avatar>
						<MessageGroup.Header>
							<span>{author.name}</span>
							{author.bot ? (
								<span
									mix={[
										raw({
											fontSize: "0.625rem",
											fontWeight: "700",
											letterSpacing: "0.04em",
											textTransform: "uppercase",
											paddingInline: "0.3125rem",
											borderRadius: "0.25rem",
											color: "var(--ui-neutral-fg)",
											backgroundColor: "var(--ui-neutral-bg-tint-pressed)",
										}),
									]}
								>
									App
								</span>
							) : null}
							{time}
							{entry.pinned ? (
								<span
									mix={[
										raw({
											display: "inline-flex",
											alignItems: "center",
											gap: "0.1875rem",
											fontSize: "0.6875rem",
											color: "var(--ui-brand-fg)",
										}),
									]}
								>
									<PinIcon size={11} aria-hidden="true" />
									Pinned
								</span>
							) : null}
						</MessageGroup.Header>
					</>
				) : (
					<MessageGroup.Time
						dateTime={new Date(entry.at).toISOString()}
						title={whenOf(entry.at, now)}
					>
						{timeOf(entry.at)}
					</MessageGroup.Time>
				)}
				<MessageGroup.Content>
					{editing === entry.id && entry.mine ? (
						<EditForm entry={entry} place={place} />
					) : (
						<MessageText
							text={entry.text}
							edited={
								entry.edited ? (
									<MessageGroup.Edited>{MESSAGE_LABELS.edited}</MessageGroup.Edited>
								) : null
							}
						/>
					)}
					<Files files={entry.files} />
					<Reactions entry={entry} place={place} />
					{!inThread && lastReply !== undefined ? (
						<MessageGroup.Thread
							href={href(withParam(withoutParam(place.back, "details"), "thread", entry.id))}
							{...TO_MAIN}
							avatars={repliers.slice(0, 4).map((person) => (
								<Face person={person} size="xs" />
							))}
						>
							<strong>
								{replies.length} {replies.length === 1 ? "reply" : "replies"}
							</strong>{" "}
							Last reply {whenOf(lastReply.at, now)}
						</MessageGroup.Thread>
					) : null}
				</MessageGroup.Content>
				{editing === entry.id ? null : <Actions entry={entry} place={place} inThread={inThread} />}
			</MessageGroup.Item>
		);
	};
}

namespace RunGroup {
	export interface Props {
		run: Run;
		place: Place;
		editing?: string;
		current?: string;
		inThread?: boolean;
		now: number;
	}
}

/** One run of a person's lines as a message group. */
export function RunGroup(handle: Handle<RunGroup.Props>) {
	return () => {
		let { run, ...rest } = handle.props;
		return (
			<MessageGroup>
				{run.entries.map((entry, index) => (
					<Line entry={entry} first={index === 0} {...rest} />
				))}
			</MessageGroup>
		);
	};
}

/**
 * A day's separator, pinned to the top of the log while its day scrolls under it. Once pinned it
 * drops its rules and keeps only the pill, so the lines never cross the messages passing beneath.
 */
function DaySeparator(handle: Handle<{ label: string }>) {
	return () => (
		<div
			mix={[
				raw({
					position: "sticky",
					insetBlockStart: "0",
					zIndex: "2",
					containerType: "scroll-state",
					pointerEvents: "none",
				}),
			]}
		>
			<Marker
				variant="separator"
				mix={[
					raw({
						paddingBlock: "0.5rem",
						paddingInline: "1.25rem",
						"@container scroll-state(stuck: top)": {
							"&::before, &::after": { opacity: "0" },
						},
					}),
				]}
			>
				<Marker.Content
					mix={[
						raw({
							fontWeight: "600",
							fontSize: "0.75rem",
							paddingInline: "0.75rem",
							paddingBlock: "0.125rem",
							borderRadius: "999px",
							border: "1px solid var(--ui-neutral-border)",
							backgroundColor: "var(--ui-bg)",
							color: "var(--ui-neutral-fg-emphasis)",
							pointerEvents: "auto",
						}),
					]}
				>
					{handle.props.label}
				</Marker.Content>
			</Marker>
		</div>
	);
}

/** The "New" divider before the first line the visitor has not read. */
export function NewDivider() {
	return () => (
		<Marker
			variant="separator"
			color="danger"
			id="new-messages"
			mix={[raw({ paddingInline: "1.25rem", paddingBlock: "0.25rem" })]}
		>
			<Marker.Content>New</Marker.Content>
		</Marker>
	);
}

namespace Days {
	export interface Props {
		days: Day[];
		place: Place;
		editing?: string;
		current?: string;
		inThread?: boolean;
		now: number;
		/** Leaves out the day separators, for a thread that fits in one glance. */
		plain?: boolean;
	}
}

/** Every day of a log: its separator, then its runs, with the "New" divider where it falls. */
export function Days(handle: Handle<Days.Props>) {
	return () => {
		let { days, plain = false, ...rest } = handle.props;
		return (
			<>
				{days.map((day) => (
					<section aria-label={day.label}>
						{plain ? null : <DaySeparator label={day.label} />}
						{day.runs.map((run, index) => (
							<>
								{day.dividerBefore === index ? <NewDivider /> : null}
								<RunGroup run={run} {...rest} />
							</>
						))}
					</section>
				))}
			</>
		);
	};
}

/** Renders one entry alone as a run, for a line the live stream adds to an open log. */
export function LiveRun(
	handle: Handle<{ entry: Entry; place: Place; inThread?: boolean; now: number }>,
) {
	return () => {
		let { entry, ...rest } = handle.props;
		return <RunGroup run={{ author: entry.author, entries: [entry] }} {...rest} />;
	};
}
