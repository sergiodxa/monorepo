/**
 * Relay's mailboxes and saved views: which conversations each one holds, what its empty
 * state says, and the address it answers at, so the sidebar, the list, the palette and the
 * redirects after a triage action all agree on one definition.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Conversation } from "~/resources/views/demo-apps/relay/data";

import { demoAppActionHref, demoAppHref } from "~/resources/views/demo-apps";
import {
	CONVERSATIONS,
	ME,
	findCompany,
	findContact,
} from "~/resources/views/demo-apps/relay/data";

/** Relay's addresses, keyed by page path under the app. */
export const href = demoAppHref("relay");

/** Where Relay's forms post, keyed by the page path the form acts on. */
export const actionHref = demoAppActionHref("relay");

/** The sidebar section a view is listed under. */
export type ViewSection = "mailboxes" | "views";

/** The icon a view's sidebar row draws, named so the shell picks the glyph. */
export type ViewIcon =
	| "inbox"
	| "mine"
	| "unassigned"
	| "starred"
	| "snoozed"
	| "archived"
	| "billing"
	| "bug"
	| "enterprise";

/** One mailbox or saved view of conversations. */
export interface InboxView {
	/** The view's page path; the inbox answers at the app's home. */
	slug: string;
	label: string;
	section: ViewSection;
	icon: ViewIcon;
	/** The `g` + letter sequence that jumps to it, for the views people visit most. */
	shortcut?: string;
	/** Whether the view lists a conversation. */
	matches: (conversation: Conversation) => boolean;
	/** Whether its count shows unread conversations (a triage queue) or all of them. */
	counts: "unread" | "all" | "none";
	/** The empty state's title and line, written for why this view is empty. */
	empty: { title: string; description: string };
}

/** Whether a conversation is still waiting in the inbox. */
function isOpen(conversation: Conversation): boolean {
	return conversation.status === "open";
}

/** Every view, in sidebar order: the mailboxes first, then the saved views. */
export const VIEWS: InboxView[] = [
	{
		slug: "inbox",
		label: "Inbox",
		section: "mailboxes",
		icon: "inbox",
		shortcut: "g i",
		matches: isOpen,
		counts: "unread",
		empty: { title: "All caught up", description: "New conversations land here." },
	},
	{
		slug: "mine",
		label: "Assigned to me",
		section: "mailboxes",
		icon: "mine",
		shortcut: "g m",
		matches: (conversation) => isOpen(conversation) && conversation.assigneeId === ME,
		counts: "unread",
		empty: { title: "All caught up", description: "Nothing is waiting on you." },
	},
	{
		slug: "unassigned",
		label: "Unassigned",
		section: "mailboxes",
		icon: "unassigned",
		shortcut: "g u",
		matches: (conversation) => isOpen(conversation) && conversation.assigneeId === null,
		counts: "all",
		empty: {
			title: "All caught up",
			description: "Every open conversation has an owner. New ones are assigned by your rules.",
		},
	},
	{
		slug: "starred",
		label: "Starred",
		section: "mailboxes",
		icon: "starred",
		matches: (conversation) => conversation.status !== "archived" && conversation.starred,
		counts: "none",
		empty: { title: "No starred conversations", description: "Star one to keep it here." },
	},
	{
		slug: "snoozed",
		label: "Snoozed",
		section: "mailboxes",
		icon: "snoozed",
		matches: (conversation) => conversation.status === "snoozed",
		counts: "none",
		empty: { title: "Nothing snoozed", description: "Snoozed conversations wait here." },
	},
	{
		slug: "archived",
		label: "Archived",
		section: "mailboxes",
		icon: "archived",
		matches: (conversation) => conversation.status === "archived",
		counts: "none",
		empty: { title: "Nothing archived yet", description: "Archived conversations land here." },
	},
	{
		slug: "billing",
		label: "Billing",
		section: "views",
		icon: "billing",
		matches: (conversation) => isOpen(conversation) && conversation.tags.includes("billing"),
		counts: "unread",
		empty: { title: "All caught up", description: "No open billing questions." },
	},
	{
		slug: "bugs",
		label: "Bug reports",
		section: "views",
		icon: "bug",
		matches: (conversation) => isOpen(conversation) && conversation.tags.includes("bug"),
		counts: "unread",
		empty: { title: "All caught up", description: "No open bug reports." },
	},
	{
		slug: "enterprise",
		label: "Enterprise",
		section: "views",
		icon: "enterprise",
		matches: (conversation) => {
			let contact = findContact(conversation.contactId);
			let company = contact ? findCompany(contact.companyId) : undefined;
			return isOpen(conversation) && company?.plan === "Enterprise";
		},
		counts: "unread",
		empty: { title: "All caught up", description: "No open conversations from Enterprise." },
	},
];

/**
 * Finds a view by its slug.
 *
 * @param slug The first segment of the page path.
 * @returns The view, or `undefined` when the segment names no view.
 */
export function findView(slug: string): InboxView | undefined {
	return VIEWS.find((view) => view.slug === slug);
}

/**
 * The conversations a view lists, newest first.
 *
 * @param view The view.
 * @returns Its conversations.
 */
export function conversationsIn(view: InboxView): Conversation[] {
	return CONVERSATIONS.filter(view.matches);
}

/**
 * The number a view's sidebar row shows: unread conversations for a triage queue, all of
 * them for a queue that should stay empty, none for an archive.
 *
 * @param view The view.
 * @returns The count, `0` drawing no pill.
 */
export function viewCount(view: InboxView): number {
	let conversations = conversationsIn(view);
	if (view.counts === "none") return 0;
	if (view.counts === "all") return conversations.length;
	return conversations.filter((conversation) => conversation.unread).length;
}

/**
 * The page path of a view's list, with no conversation open. The inbox is the app's home.
 *
 * @param view The view.
 * @returns The page path.
 */
export function viewPage(view: InboxView): string {
	return view.slug === "inbox" ? "" : view.slug;
}

/**
 * The page path of one conversation open inside a view.
 *
 * @param view The view the list shows.
 * @param conversationId The open conversation.
 * @returns The page path.
 */
export function conversationPage(view: InboxView, conversationId: string): string {
	return `${view.slug}/${conversationId}`;
}
