/**
 * The open conversation in Relay's inbox: a toolbar of triage actions over the subject, the
 * messages with the team's internal notes set apart, and the reply composer at the foot, so
 * reading, deciding and answering happen without leaving the list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	AlarmClockIcon,
	ArchiveIcon,
	ArchiveRestoreIcon,
	CircleCheckIcon,
	CircleIcon,
	EllipsisIcon,
	MailIcon,
	ReplyIcon,
	SendIcon,
	StarIcon,
	UserPlusIcon,
	UserRoundIcon,
} from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, borderEdge, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { listStyle, raw } from "@sdxc/u/general";
import { flexWrap, grow, hstack, vstack } from "@sdxc/u/layout";
import { atQuery } from "@sdxc/u/responsive";
import { m, maxIs, p, pb, pi } from "@sdxc/u/size";
import { leading, text, weight } from "@sdxc/u/typography";
import {
	Avatar,
	Badge,
	Button,
	Header,
	Keyboard,
	LinkButton,
	Menu,
	RelativeTime,
	Section,
	TextArea,
} from "@sdxc/ui";
import { OptimisticToggle } from "@sdxc/ui/app/optimistic-toggle";
import { Skeleton } from "@sdxc/ui/app/skeleton";

import type { Conversation, Message } from "~/resources/views/demo-apps/relay/data";
import type { InboxView } from "~/resources/views/demo-apps/relay/views";

import {
	ME,
	NOW,
	TEAMMATES,
	findCompany,
	findContact,
	findTeammate,
} from "~/resources/views/demo-apps/relay/data";
import { Ghost } from "~/resources/views/demo-apps/relay/ghost";
import { TOGGLE_LABELS } from "~/resources/views/demo-apps/relay/labels";
import { actionHref, conversationPage, href } from "~/resources/views/demo-apps/relay/views";

/**
 * Hides a toolbar label while the reading pane is phone-narrow, so the actions keep one row
 * of icons and the label stays the button's accessible name.
 */
function narrowHidden() {
	return atQuery("ui-split-view (width < 40rem)", visuallyHidden());
}

/** The hidden form every triage button submits through, so a menu row is a plain submit. */
const TRIAGE_FORM = "relay-triage";

/** When a snoozed conversation can come back, as the menu offers it. */
export const SNOOZE_OPTIONS = [
	{ value: "snooze-later", label: "Later today", hint: "18:00" },
	{ value: "snooze-tomorrow", label: "Tomorrow", hint: "09:00" },
	{ value: "snooze-monday", label: "Next Monday", hint: "09:00" },
] as const;

namespace ConversationPane {
	export interface Props {
		view: InboxView;
		conversation: Conversation;
	}
}

/** Names who wrote a message and the initials their avatar shows. */
function author(message: Message, conversation: Conversation): { name: string; initials: string } {
	if (message.from === "contact") {
		let name = findContact(conversation.contactId)?.name ?? "Customer";
		let initials = name
			.split(" ")
			.map((part) => part[0])
			.join("")
			.slice(0, 2);
		return { name, initials };
	}
	let teammate = findTeammate(message.from);
	return { name: teammate?.name ?? "Fernway", initials: teammate?.initials ?? "F" };
}

/** One message: who wrote it and when, over its paragraphs; a note sits on a warm tint. */
function MessageCard(handle: Handle<{ message: Message; conversation: Conversation }>) {
	return () => {
		let { message, conversation } = handle.props;
		let { name, initials } = author(message, conversation);
		let fromCustomer = message.from === "contact";

		return (
			<li
				mix={[
					vstack({ gap: 2, align: "stretch" }),
					p(4),
					rounded("lg"),
					message.note
						? [bg("warning.tint"), border({ color: "warning.border", width: 1 })]
						: border({ color: "neutral.border", width: 1 }),
				]}
			>
				<div mix={[hstack({ gap: 2.5, align: "center" })]}>
					<Avatar size="sm">
						<Avatar.Fallback>{initials}</Avatar.Fallback>
					</Avatar>
					<div mix={[vstack({ gap: 0, align: "start" }), grow(), raw({ minInlineSize: 0 })]}>
						<span mix={[text("sm"), weight("semibold"), fg("neutral.emphasis")]}>{name}</span>
						<span mix={[text("xs"), fg("neutral.muted")]}>
							{roleLine(message.note === true, fromCustomer)}
						</span>
					</div>
					<span mix={[text("xs"), fg("neutral.muted")]}>
						<RelativeTime date={message.at} now={NOW} locale="en" />
					</span>
				</div>
				{message.paragraphs.map((paragraph) => (
					<p mix={[m(0), text("sm"), leading("relaxed"), fg("neutral.emphasis")]}>{paragraph}</p>
				))}
			</li>
		);
	};
}

/**
 * The line under an author's name: who they are to this conversation.
 *
 * @param note Whether the message is an internal note.
 * @param fromCustomer Whether the customer wrote it.
 * @returns The role line.
 */
function roleLine(note: boolean, fromCustomer: boolean): string {
	if (note) return "Internal note · only your team sees this";
	return fromCustomer ? "Customer" : "Fernway support";
}

/**
 * The toolbar above the reading pane: Reply, Assign, Snooze and Archive, the overflow menu,
 * then the star and read toggles, each with the key that runs it.
 */
export function ConversationToolbar(handle: Handle<ConversationPane.Props>) {
	return () => {
		let { view, conversation } = handle.props;
		let page = conversationPage(view, conversation.id);
		let archived = conversation.status === "archived";

		return (
			<div
				role="toolbar"
				aria-label="Conversation actions"
				mix={[
					hstack({ gap: 1, align: "center" }),
					flexWrap(),
					raw({ position: "sticky", insetBlockStart: 0, zIndex: 1 }),
					pi(3),
					pb(2),
					bg(),
					borderEdge("bottom", { width: 1, color: "neutral" }),
				]}
			>
				<form id={TRIAGE_FORM} method="post" action={actionHref(page)} hidden />
				<LinkButton
					href="#relay-reply"
					variant="ghost"
					color="neutral"
					size="sm"
					data-shortcut="r"
					data-shortcut-label="Reply"
					data-shortcut-group="Inbox"
				>
					<ReplyIcon size={16} aria-hidden="true" />
					<span mix={[narrowHidden()]}>Reply</span>
				</LinkButton>
				<Button
					type="button"
					variant="ghost"
					color="neutral"
					size="sm"
					commandfor="relay-assign-menu"
					command="toggle-popover"
					data-shortcut="a"
					data-shortcut-label="Assign conversation"
					data-shortcut-group="Inbox"
				>
					<UserPlusIcon size={16} aria-hidden="true" />
					<span mix={[narrowHidden()]}>Assign</span>
				</Button>
				<Menu id="relay-assign-menu" aria-label="Assign to" placement="bottom-start">
					<Section aria-labelledby="relay-assign-heading">
						<Header id="relay-assign-heading">Assign to</Header>
						{TEAMMATES.map((teammate) => (
							<Menu.Item
								type="submit"
								form={TRIAGE_FORM}
								name="intent"
								value={`assign-${teammate.id}`}
								aria-current={conversation.assigneeId === teammate.id ? "true" : undefined}
							>
								<UserRoundIcon />
								<span mix={[grow()]}>
									{teammate.id === ME ? `${teammate.name} (you)` : teammate.name}
								</span>
								{conversation.assigneeId === teammate.id ? <CircleCheckIcon /> : null}
							</Menu.Item>
						))}
					</Section>
				</Menu>
				<Button
					type="button"
					variant="ghost"
					color="neutral"
					size="sm"
					commandfor="relay-snooze-menu"
					command="toggle-popover"
					data-shortcut="s"
					data-shortcut-label="Snooze conversation"
					data-shortcut-group="Inbox"
				>
					<AlarmClockIcon size={16} aria-hidden="true" />
					<span mix={[narrowHidden()]}>Snooze</span>
				</Button>
				<Menu id="relay-snooze-menu" aria-label="Snooze until" placement="bottom-start">
					<Section aria-labelledby="relay-snooze-heading">
						<Header id="relay-snooze-heading">Snooze until</Header>
						{SNOOZE_OPTIONS.map((option) => (
							<Menu.Item type="submit" form={TRIAGE_FORM} name="intent" value={option.value}>
								<AlarmClockIcon />
								<span mix={[grow()]}>{option.label}</span>
								<span mix={[text("xs"), fg("neutral.muted")]}>{option.hint}</span>
							</Menu.Item>
						))}
					</Section>
				</Menu>
				<Button
					type="submit"
					form={TRIAGE_FORM}
					name="intent"
					value={archived ? "unarchive" : "archive"}
					variant="ghost"
					color="neutral"
					size="sm"
					data-shortcut="e"
					data-shortcut-label={archived ? "Move to inbox" : "Archive conversation"}
					data-shortcut-group="Inbox"
				>
					{archived ? (
						<ArchiveRestoreIcon size={16} aria-hidden="true" />
					) : (
						<ArchiveIcon size={16} aria-hidden="true" />
					)}
					<span mix={[narrowHidden()]}>{archived ? "Move to inbox" : "Archive"}</span>
					<Keyboard mix={[m(0), narrowHidden()]}>E</Keyboard>
				</Button>
				<Button
					type="button"
					variant="ghost"
					color="neutral"
					size="sm"
					commandfor="relay-more-menu"
					command="toggle-popover"
					aria-label="More actions"
					title="More actions"
				>
					<EllipsisIcon size={16} aria-hidden="true" />
				</Button>
				<Menu id="relay-more-menu" aria-label="More actions" placement="bottom-start">
					<Menu.Item
						type="submit"
						form={TRIAGE_FORM}
						name="intent"
						value="mark-unread"
						data-shortcut="u"
						data-shortcut-label="Mark as unread"
						data-shortcut-group="Inbox"
					>
						<MailIcon />
						<span mix={[grow()]}>Mark as unread</span>
						<Keyboard>U</Keyboard>
					</Menu.Item>
					<Menu.Item href={href(`contacts/${conversation.contactId}`)}>
						<UserRoundIcon />
						<span mix={[grow()]}>Open contact</span>
					</Menu.Item>
				</Menu>
				<span mix={[grow()]} />
				<OptimisticToggle
					action={actionHref(page)}
					name="starred"
					pressed={conversation.starred}
					fields={{ intent: "star" }}
					labels={{ label: TOGGLE_LABELS.star, failed: TOGGLE_LABELS.failed }}
					pressedContent={<StarIcon size={16} fill="currentColor" aria-hidden="true" />}
					unpressedContent={<StarIcon size={16} aria-hidden="true" />}
				/>
				<OptimisticToggle
					action={actionHref(page)}
					name="read"
					pressed
					fields={{ intent: "read" }}
					labels={{ label: TOGGLE_LABELS.read, failed: TOGGLE_LABELS.failed }}
					pressedContent={<CircleCheckIcon size={16} aria-hidden="true" />}
					unpressedContent={<CircleIcon size={16} aria-hidden="true" />}
				/>
			</div>
		);
	};
}

/**
 * The subject and who the conversation is with: company, plan, tags and owner. As a ghost
 * it draws the same lines as bars, with no heading or link, for the pane's placeholder.
 */
export function ConversationHeader(
	handle: Handle<{ conversation: Conversation; ghost?: boolean }>,
) {
	return () => {
		let { conversation, ghost = false } = handle.props;
		let contact = findContact(conversation.contactId);
		let company = contact ? findCompany(contact.companyId) : undefined;
		let assignee = conversation.assigneeId ? findTeammate(conversation.assigneeId) : undefined;
		let shown = (node: RemixNode) => (ghost ? <Ghost>{node}</Ghost> : node);
		let badge = (node: RemixNode) => (ghost ? <Ghost box>{node}</Ghost> : node);
		let subjectMix = [
			m(0),
			text("xl"),
			weight("semibold"),
			leading("tight"),
			fg("neutral.emphasis"),
		];

		return (
			<header mix={[vstack({ gap: 2, align: "stretch" })]}>
				{ghost ? (
					<div mix={subjectMix}>{shown(conversation.subject)}</div>
				) : (
					<h2 id="relay-conversation-subject" mix={subjectMix}>
						{conversation.subject}
					</h2>
				)}
				<div
					mix={[hstack({ gap: 2, align: "center" }), flexWrap(), text("sm"), fg("neutral.muted")]}
				>
					{contact && ghost ? <span mix={[weight("medium")]}>{shown(contact.name)}</span> : null}
					{contact && !ghost ? (
						<a
							href={href(`contacts/${contact.id}`)}
							mix={[weight("medium"), fg("brand"), raw({ textDecoration: "none" })]}
						>
							{contact.name}
						</a>
					) : null}
					{company ? <span>{shown(company.name)}</span> : null}
					{company
						? badge(
								<Badge
									variant="secondary"
									color={company.plan === "Enterprise" ? "brand" : "neutral"}
								>
									{company.plan}
								</Badge>,
							)
						: null}
					{conversation.tags.map((tag) =>
						badge(
							<Badge variant="outline" color="neutral">
								{tag}
							</Badge>,
						),
					)}
					<span>{shown(assignee ? `Assigned to ${assignee.name}` : "Unassigned")}</span>
					{conversation.status === "snoozed" && conversation.snoozedUntil ? (
						<span>
							{shown(
								<>
									· Snoozed until{" "}
									<RelativeTime date={conversation.snoozedUntil} now={NOW} locale="en" />
								</>,
							)}
						</span>
					) : null}
				</div>
			</header>
		);
	};
}

/** The reply composer: a plain form, so a reply posts even before any script loads. */
function ReplyComposer(handle: Handle<ConversationPane.Props>) {
	return () => {
		let { view, conversation } = handle.props;
		let contact = findContact(conversation.contactId);
		let firstName = contact?.name.split(" ")[0] ?? "the customer";

		return (
			<form
				id="relay-reply"
				method="post"
				action={actionHref(conversationPage(view, conversation.id))}
				mix={[
					vstack({ gap: 2, align: "stretch" }),
					p(3),
					rounded("lg"),
					border({ color: "neutral.border", width: 1 }),
					bg(),
				]}
			>
				<input type="hidden" name="intent" value="reply" />
				<label for="relay-reply-body" mix={[text("xs"), weight("medium"), fg("neutral.muted")]}>
					Reply to {firstName}
				</label>
				<TextArea
					id="relay-reply-body"
					name="body"
					rows={4}
					required
					placeholder={`Write to ${firstName}…`}
				/>
				<div mix={[hstack({ gap: 2, align: "center", justify: "between" }), flexWrap()]}>
					<span mix={[text("xs"), fg("neutral.muted")]}>
						Sends as Noor Haddad, with your signature
					</span>
					<Button type="submit" size="sm">
						<SendIcon size={14} aria-hidden="true" />
						Send reply
					</Button>
				</div>
			</form>
		);
	};
}

/** The reading column under the toolbar, centred at a comfortable measure. */
function columnMix() {
	return [
		vstack({ gap: 5, align: "stretch" }),
		pi(6),
		pb(5),
		raw({ inlineSize: "100%", boxSizing: "border-box", marginInline: "auto" }),
		maxIs("48rem"),
	];
}

/**
 * Renders the open conversation: toolbar, header, messages and the composer. It is the
 * inbox's `conversation/<id>` frame, so the list answers before the messages are read.
 */
export function ConversationPane(handle: Handle<ConversationPane.Props>) {
	return () => {
		let { view, conversation } = handle.props;

		return (
			<article
				aria-labelledby="relay-conversation-subject"
				mix={[vstack({ gap: 0, align: "stretch" })]}
			>
				<ConversationToolbar view={view} conversation={conversation} />
				<div mix={columnMix()}>
					<ConversationHeader conversation={conversation} />
					<ol
						aria-label="Messages"
						data-slot="relay-messages"
						mix={[vstack({ gap: 3, align: "stretch" }), m(0), p(0), listStyle()]}
					>
						{conversation.messages.map((message) => (
							<MessageCard message={message} conversation={conversation} />
						))}
					</ol>
					<ReplyComposer view={view} conversation={conversation} />
				</div>
			</article>
		);
	};
}

/**
 * One `Skeleton` bar in a box of its own, so the box sets its width (a CSS length or
 * percentage) and the bar its height.
 */
function Bar(handle: Handle<{ width: string; height: string; round?: boolean }>) {
	return () => {
		let { width, height, round = false } = handle.props;
		return (
			<div mix={[raw({ flex: "0 0 auto", inlineSize: width, maxInlineSize: "100%" })]}>
				<Skeleton
					style={`--ui-skeleton-block-size:${height}${round ? ";border-radius:999px" : ""}`}
				/>
			</div>
		);
	};
}

/**
 * One toolbar button's placeholder: an icon square on a phone, a labelled pill beside it.
 * A `keyed` button shows its key's chip once labelled, which stands it a little taller.
 */
function ToolButtonPlaceholder(handle: Handle<{ labelled?: boolean; keyed?: boolean }>) {
	return () => {
		let { labelled = false, keyed = false } = handle.props;
		return (
			<div
				mix={[
					raw({ flex: "0 0 auto", inlineSize: "2rem", "--ui-skeleton-block-size": "2rem" }),
					labelled
						? atQuery(
								"ui-split-view (width >= 40rem)",
								raw({
									inlineSize: keyed ? "7rem" : "5.5rem",
									"--ui-skeleton-block-size": keyed ? "2.125rem" : "2rem",
								}),
							)
						: [],
				]}
			>
				<Skeleton />
			</div>
		);
	};
}

/** The toolbar's placeholder: its row of buttons at their size, with the toggles at the end. */
export function ToolbarPlaceholder() {
	return () => (
		<div
			mix={[
				hstack({ gap: 1, align: "center" }),
				pi(3),
				pb(2),
				bg(),
				borderEdge("bottom", { width: 1, color: "neutral" }),
			]}
		>
			<ToolButtonPlaceholder labelled />
			<ToolButtonPlaceholder labelled />
			<ToolButtonPlaceholder labelled />
			<ToolButtonPlaceholder labelled keyed />
			<ToolButtonPlaceholder />
			<span mix={[grow()]} />
			<ToolButtonPlaceholder />
			<ToolButtonPlaceholder />
		</div>
	);
}

/** One message's placeholder: the author row over two lines of text, in the card's frame. */
function MessagePlaceholder() {
	return () => (
		<li
			mix={[
				vstack({ gap: 2, align: "stretch" }),
				p(4),
				rounded("lg"),
				border({ color: "neutral.border", width: 1 }),
			]}
		>
			<div mix={[hstack({ gap: 2.5, align: "center" })]}>
				<Bar width="2rem" height="2rem" round />
				<Bar width="8rem" height="0.75rem" />
			</div>
			<Bar width="100%" height="0.75rem" />
			<Bar width="70%" height="0.75rem" />
		</li>
	);
}

/**
 * The open conversation's placeholder: the toolbar's row, the header's own lines as bars,
 * and one card per message, so the pane holds its layout while the conversation loads and
 * the first message lands where its card stood.
 */
export function ConversationPlaceholder(handle: Handle<{ conversation: Conversation }>) {
	return () => {
		let { conversation } = handle.props;
		return (
			<div aria-hidden="true" mix={[vstack({ gap: 0, align: "stretch" })]}>
				<ToolbarPlaceholder />
				<div mix={columnMix()}>
					<ConversationHeader conversation={conversation} ghost />
					<ol
						data-slot="relay-messages"
						mix={[vstack({ gap: 3, align: "stretch" }), m(0), p(0), listStyle()]}
					>
						{conversation.messages.map(() => (
							<MessagePlaceholder />
						))}
					</ol>
				</div>
			</div>
		);
	};
}
