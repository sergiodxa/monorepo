/**
 * Relay's inbox: the sidebar's mailbox, its conversations as two-line rows and the open
 * conversation beside them on one screen. The open conversation is the URL, so j/k, a
 * reload and a shared link all land on the same row, and a phone shows one pane per route.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { MailIcon, StarIcon } from "@sdxc/icons";
import { iife } from "@sdxc/iife";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, borderEdge, fg } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { listStyle, raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { m, p, pb, pi } from "@sdxc/u/size";
import { focusVisible, hover } from "@sdxc/u/state";
import { tabularNums, text, truncate, weight } from "@sdxc/u/typography";
import { HeadingScope, RelativeTime } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";
import { SPLIT_VIEW_ITEM_ATTRIBUTE, SplitView } from "@sdxc/ui/app/split-view";

import type { Conversation } from "~/resources/views/demo-apps/relay/data";
import type { InboxView } from "~/resources/views/demo-apps/relay/views";

import DemoAppFrame from "~/resources/views/demo-apps/frame";
import { ConversationPlaceholder } from "~/resources/views/demo-apps/relay/conversation";
import { NOW, findContact, updatedAt } from "~/resources/views/demo-apps/relay/data";
import { SPLIT_LABELS } from "~/resources/views/demo-apps/relay/labels";
import { RelayShell } from "~/resources/views/demo-apps/relay/shell";
import {
	conversationPage,
	conversationsIn,
	href,
	viewPage,
} from "~/resources/views/demo-apps/relay/views";

/** The cookie the inbox's list width is remembered in. */
export const SPLIT_COOKIE = "relay-split";

namespace InboxScreen {
	export interface Props {
		view: InboxView;
		/** The open conversation, or `null` while none is. */
		selected: Conversation | null;
		/** A conversation just archived, left out of the list while its Undo toast shows. */
		archived?: string;
		/** The remembered list width, from {@link SPLIT_COOKIE}. */
		layout?: SplitView.Layout;
		/** The remembered collapsed sidebar. */
		collapsed: boolean;
	}
}

/**
 * Whether a row reads as unread: the open conversation counts as read, the way opening a
 * message reads it.
 */
function isUnread(conversation: Conversation, selected: Conversation | null): boolean {
	return conversation.unread && conversation.id !== selected?.id;
}

/** One conversation row: sender and time over subject and snippet, with the unread dot. */
function ConversationRow(
	handle: Handle<{
		view: InboxView;
		conversation: Conversation;
		selected: boolean;
		unread: boolean;
	}>,
) {
	return () => {
		let { view, conversation, selected, unread } = handle.props;
		let contact = findContact(conversation.contactId);
		let snippet = conversation.messages.at(-1)?.paragraphs[0] ?? "";

		return (
			<li>
				<a
					href={href(conversationPage(view, conversation.id))}
					{...{ [SPLIT_VIEW_ITEM_ATTRIBUTE]: "" }}
					data-rmx-prefetch="intent"
					aria-current={selected ? "page" : undefined}
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "0.5rem minmax(0, 1fr) auto",
							columnGap: "0.625rem",
							rowGap: "0.125rem",
							alignItems: "baseline",
							textDecoration: "none",
							"--relay-row-muted": "var(--ui-neutral-fg-muted)",
							"--relay-row-strong": "var(--ui-neutral-fg-emphasis)",
							"--relay-row-dot": "var(--ui-brand-bg-solid)",
						}),
						pi(3),
						pb(2.5),
						rounded("lg"),
						fg("neutral.emphasis"),
						transition("background-color"),
						hover(bg("neutral.bg-tint-hover")),
						focusVisible(raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "-2px" })),
						raw({
							'&[aria-current="page"]': {
								backgroundColor: "var(--ui-brand-bg-solid)",
								"--relay-row-muted":
									"color-mix(in oklch, var(--ui-brand-fg-on-solid) 78%, transparent)",
								"--relay-row-strong": "var(--ui-brand-fg-on-solid)",
								"--relay-row-dot": "var(--ui-brand-fg-on-solid)",
							},
						}),
					]}
				>
					<span
						aria-hidden="true"
						mix={[
							raw({
								inlineSize: "0.5rem",
								blockSize: "0.5rem",
								borderRadius: "999px",
								alignSelf: "center",
								background: unread ? "var(--relay-row-dot)" : "transparent",
							}),
						]}
					/>
					<span
						mix={[
							hstack({ gap: 1.5, align: "center" }),
							raw({ minInlineSize: 0, color: "var(--relay-row-strong)" }),
							text("sm"),
							weight(unread ? "semibold" : "medium"),
						]}
					>
						<span mix={[truncate()]}>{contact?.name}</span>
						{conversation.starred ? (
							<StarIcon size={12} fill="currentColor" aria-label="Starred" />
						) : null}
					</span>
					<span mix={[text("xs"), tabularNums(), raw({ color: "var(--relay-row-muted)" })]}>
						<RelativeTime date={updatedAt(conversation)} now={NOW} locale="en" />
					</span>
					{unread ? <span mix={[visuallyHidden()]}>Unread</span> : <span />}
					<span
						mix={[
							truncate(),
							text("sm"),
							raw({ gridColumn: "2 / -1", color: "var(--relay-row-muted)" }),
						]}
					>
						<span
							mix={[
								weight(unread ? "semibold" : "normal"),
								raw({ color: "var(--relay-row-strong)" }),
							]}
						>
							{conversation.subject}
						</span>
						{` — ${snippet}`}
					</span>
				</a>
			</li>
		);
	};
}

/** The list pane: the view's name and counts over its rows, or why it is empty. */
function ConversationList(
	handle: Handle<{ view: InboxView; selected: Conversation | null; archived?: string }>,
) {
	return () => {
		let { view, selected, archived } = handle.props;
		let conversations = conversationsIn(view).filter(
			(conversation) => conversation.id !== archived,
		);
		let unread = conversations.filter((conversation) => isUnread(conversation, selected)).length;
		let summary =
			unread > 0
				? `${unread} unread · ${conversations.length} conversations`
				: `${conversations.length} conversations`;

		return (
			<div mix={[vstack({ gap: 0, align: "stretch" }), raw({ minBlockSize: "100%" })]}>
				<header
					mix={[
						vstack({ gap: 0.5, align: "stretch" }),
						raw({ position: "sticky", insetBlockStart: 0, zIndex: 1 }),
						pi(4),
						pb(3),
						bg(),
						borderEdge("bottom", { width: 1, color: "neutral" }),
					]}
				>
					<h1 mix={[m(0), text("lg"), weight("semibold"), fg("neutral.emphasis")]}>{view.label}</h1>
					<p mix={[m(0), text("xs"), fg("neutral.muted")]}>{summary}</p>
				</header>
				{conversations.length === 0 ? (
					<HeadingScope level={2} mix={[p(4)]}>
						<Empty kind="cleared" size="compact">
							<Empty.Title>{view.empty.title}</Empty.Title>
							<Empty.Description>{view.empty.description}</Empty.Description>
						</Empty>
					</HeadingScope>
				) : (
					<ul
						aria-label={view.label}
						mix={[vstack({ gap: 0.5, align: "stretch" }), m(0), p(2), listStyle()]}
					>
						{conversations.map((conversation) => (
							<ConversationRow
								view={view}
								conversation={conversation}
								selected={conversation.id === selected?.id}
								unread={isUnread(conversation, selected)}
							/>
						))}
					</ul>
				)}
			</div>
		);
	};
}

/**
 * The open conversation's frame: the part names the conversation and carries the view it is
 * read in, which its triage forms return to, so each conversation caches once per view.
 */
export function conversationPart(view: InboxView, conversation: Conversation): string {
	return `conversation/${conversation.id}?view=${view.slug}`;
}

/** The detail pane while nothing is open: a quiet line and the key that opens the first row. */
function NoSelection(handle: Handle<{ view: InboxView }>) {
	return () => {
		let { view } = handle.props;
		let conversations = conversationsIn(view);
		let unread = conversations.filter((conversation) => conversation.unread).length;
		let line = iife(() => {
			if (conversations.length === 0) return "Nothing to read here.";
			let lead = unread > 0 ? `${unread} unread` : `${conversations.length} conversations`;
			return `${lead} in ${view.label}. Press j to open the first one.`;
		});

		return (
			<HeadingScope level={2}>
				<Empty size="compact" icon={<MailIcon />}>
					<Empty.Title>No conversation selected</Empty.Title>
					<Empty.Description>{line}</Empty.Description>
				</Empty>
			</HeadingScope>
		);
	};
}

/**
 * Renders the inbox screen. The panes fill the shell's card below its top bar, so the list
 * and the conversation each scroll on their own while the sidebar and toolbar stay put.
 */
export function InboxScreen(handle: Handle<InboxScreen.Props>) {
	return () => {
		let { view, selected, archived, layout, collapsed } = handle.props;

		return (
			<RelayShell current={`view:${view.slug}`} collapsed={collapsed} crumb={view.label} flush>
				<div
					mix={[
						raw({ blockSize: "calc(100dvh - var(--ui-app-header-height, 3.5rem))" }),
						media(
							"(min-width: 48rem)",
							raw({
								blockSize:
									"calc(100dvh - var(--ui-app-header-height, 3.5rem) - 2 * var(--ui-app-inset-gap, 0.5rem) - 2px)",
							}),
						),
					]}
				>
					<SplitView
						id="relay-inbox"
						list={<ConversationList view={view} selected={selected} archived={archived} />}
						detail={
							selected ? (
								<DemoAppFrame
									app="relay"
									part={conversationPart(view, selected)}
									fallback={<ConversationPlaceholder conversation={selected} />}
								/>
							) : null
						}
						empty={<NoSelection view={view} />}
						active={selected ? "detail" : "list"}
						backHref={href(viewPage(view))}
						layout={layout}
						cookie={SPLIT_COOKIE}
						labels={SPLIT_LABELS}
					/>
				</div>
			</RelayShell>
		);
	};
}
