/**
 * Relay, the inbox demo: a support inbox and light CRM for Fernway, an invented project
 * tool, with mailboxes, the conversation list and the open conversation on one Mail-like
 * screen, plus contacts, reports and settings. Graphite neutrals, system blue, system type.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Toast } from "@sdxc/ui/app";

import { CompassIcon } from "@sdxc/icons";
import { LinkButton } from "@sdxc/ui";
import { readAppShellCookie } from "@sdxc/ui/app/app-shell";
import { Empty } from "@sdxc/ui/app/empty";
import { readSplitViewLayout } from "@sdxc/ui/app/split-view";
import { TOAST_UNDO_DURATION } from "@sdxc/ui/app/toast";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

import type {
	DemoApp,
	DemoAppRedirect,
	DemoAppRequest,
	DemoAppScreen,
} from "~/resources/views/demo-apps";
import type { ContactsState } from "~/resources/views/demo-apps/relay/contacts";
import type { InboxView } from "~/resources/views/demo-apps/relay/views";

import { ContactScreen } from "~/resources/views/demo-apps/relay/contact";
import { ContactsScreen } from "~/resources/views/demo-apps/relay/contacts";
import { SNOOZE_OPTIONS } from "~/resources/views/demo-apps/relay/conversation";
import {
	CONVERSATIONS,
	TEAMMATES,
	findContact,
	findConversation,
} from "~/resources/views/demo-apps/relay/data";
import { InboxScreen, SPLIT_COOKIE } from "~/resources/views/demo-apps/relay/inbox";
import { ReportsScreen } from "~/resources/views/demo-apps/relay/reports";
import { SETTINGS_PAGES, SettingsScreen } from "~/resources/views/demo-apps/relay/settings";
import { RelayShell, SHELL_COOKIE } from "~/resources/views/demo-apps/relay/shell";
import { RelayThumbnail } from "~/resources/views/demo-apps/relay/thumbnail";
import {
	actionHref,
	conversationPage,
	conversationsIn,
	findView,
	href,
	viewPage,
} from "~/resources/views/demo-apps/relay/views";

/** System blue at hue 257, its 600 step close to the accent Apple's own apps use. */
const BRAND = [
	"oklch(0.97 0.014 255)",
	"oklch(0.932 0.032 255)",
	"oklch(0.882 0.06 255)",
	"oklch(0.809 0.105 255)",
	"oklch(0.714 0.155 256)",
	"oklch(0.65 0.19 256)",
	"oklch(0.6 0.215 257)",
	"oklch(0.53 0.2 258)",
	"oklch(0.45 0.165 259)",
	"oklch(0.38 0.13 260)",
	"oklch(0.28 0.09 262)",
] as const;

/** Graphite: near-neutral greys with a trace of blue, so the chrome recedes behind the mail. */
const NEUTRAL = [
	"oklch(0.972 0.002 260)",
	"oklch(0.948 0.003 260)",
	"oklch(0.905 0.004 260)",
	"oklch(0.85 0.006 260)",
	"oklch(0.72 0.008 260)",
	"oklch(0.6 0.01 260)",
	"oklch(0.5 0.01 260)",
	"oklch(0.42 0.01 260)",
	"oklch(0.33 0.008 260)",
	"oklch(0.235 0.006 260)",
	"oklch(0.17 0.005 260)",
] as const;

/**
 * The system face, soft medium radii, a white reading surface on the graphite frame in
 * light mode, and the inbox's list at Mail's width.
 */
const TOKENS = {
	"--ui-font-sans":
		'-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
	"--ui-radius-md": "0.375rem",
	"--ui-radius-lg": "0.625rem",
	"--ui-bg": "oklch(1 0 0)",
	"--ui-app-sidebar-width": "15rem",
	"--ui-app-list-width": "23rem",
	"--ui-app-inset-radius": "0.625rem",
	"--ui-table-id-max-inline-size": "26ch",
} as const;

/** What a triage form asks for: an action and, for a reply, its text. */
const TRIAGE_FORM = f.object({
	intent: f.field(
		s.enum_([
			"reply",
			"archive",
			"unarchive",
			"star",
			"read",
			"mark-unread",
			...SNOOZE_OPTIONS.map((option) => option.value),
			...TEAMMATES.map((teammate) => `assign-${teammate.id}`),
		]),
	),
	body: f.field(s.defaulted(s.string(), "")),
});

/** What a settings form saves: which section, and the auto-reply switch when it flips. */
const SETTINGS_FORM = f.object({
	section: f.field(s.enum_(["rules", "auto-reply", "signature"])),
	autoReply: f.field(s.defaulted(s.string(), "")),
});

/** Every toast a redirect can name; archiving a conversation offers Undo for that one. */
const TOASTS: Record<string, Omit<Toast.Flash, "id">> = {
	"reply-sent": { color: "success", title: "Reply sent" },
	restored: { title: "Conversation moved to inbox" },
	snoozed: { title: "Conversation snoozed" },
	"marked-unread": { title: "Marked as unread" },
	"rules-saved": { color: "success", title: "Assignment rules saved" },
	"auto-reply-on": { title: "Auto-reply turned on" },
	"auto-reply-off": { title: "Auto-reply turned off" },
	"signature-saved": { color: "success", title: "Signature saved" },
	...Object.fromEntries(
		TEAMMATES.map((teammate) => [
			`assigned-${teammate.id}`,
			{ title: `Assigned to ${teammate.name.split(" ")[0]}` },
		]),
	),
	...Object.fromEntries(
		CONVERSATIONS.map((conversation) => [
			`archived-${conversation.id}`,
			{
				title: "Conversation archived",
				duration: TOAST_UNDO_DURATION,
				action: {
					label: "Undo",
					form: { action: actionHref(`inbox/${conversation.id}`), fields: { intent: "unarchive" } },
				},
			},
		]),
	),
};

/** The screens a visitor reaches by clicking, the inbox first. */
const SCREENS = [
	"",
	"inbox/2048",
	"inbox/2046",
	"mine",
	"mine/2043",
	"unassigned",
	"starred",
	"starred/2046",
	"snoozed",
	"snoozed/2040",
	"archived",
	"archived/2038",
	"billing",
	"billing/2047",
	"bugs",
	"bugs/2045",
	"enterprise",
	"enterprise/2041",
	"contacts",
	"contacts?contact=priya-nair",
	"contacts?plan=Enterprise&sort=-ltv",
	"contacts?q=zebra",
	"contacts?density=comfortable&props=email&props=conversations",
	"contacts?state=loading",
	"contacts?state=first-run",
	"contacts/maya-chen",
	"contacts/grace-liu",
	"reports",
	"reports?state=error",
	"settings",
	"settings/assignment",
	"settings/signature",
];

/** The app's own 404, inside the shell so the sidebar still leads somewhere. */
function notFound(collapsed: boolean): DemoAppScreen {
	return {
		title: "Page not found",
		status: 404,
		body: (
			<RelayShell current="none" collapsed={collapsed} crumb="Not found">
				<Empty icon={<CompassIcon />}>
					<Empty.Title>Nothing lives at this address</Empty.Title>
					<Empty.Description>
						The conversation may have moved, or the link is mistyped. Your inbox is one click away.
					</Empty.Description>
					<Empty.Action>
						<LinkButton href={href()}>Go to Inbox</LinkButton>
					</Empty.Action>
				</Empty>
			</RelayShell>
		),
	};
}

/**
 * Renders a mailbox, with one conversation open when the path names one. A conversation
 * outside the view still opens, so an Undo lands on the conversation it restored.
 */
function inboxScreen(
	view: InboxView,
	conversationId: string | undefined,
	request: DemoAppRequest,
): DemoAppScreen | null {
	let collapsed = readAppShellCookie(request.cookie, SHELL_COOKIE);
	let layout = readSplitViewLayout(request.cookie, SPLIT_COOKIE);
	let selected = conversationId === undefined ? null : (findConversation(conversationId) ?? null);
	if (conversationId !== undefined && selected === null) return null;
	let toast = request.url.searchParams.get("toast") ?? "";
	let archived = toast.startsWith("archived-") ? toast.slice("archived-".length) : undefined;

	return {
		title: selected ? selected.subject : view.label,
		body: (
			<InboxScreen
				view={view}
				selected={selected}
				archived={archived}
				layout={layout}
				collapsed={collapsed}
			/>
		),
	};
}

/** Reads the demo state a contacts link asks for. */
function contactsState(url: URL): ContactsState {
	let state = url.searchParams.get("state");
	return state === "loading" || state === "first-run" ? state : null;
}

/** Answers a page path with its screen, or `null` when no screen lives there. */
function route(request: DemoAppRequest): DemoAppScreen | null {
	let { page, url, cookie } = request;
	let collapsed = readAppShellCookie(cookie, SHELL_COOKIE);
	let [first = "", second, ...rest] = page.split("/");
	if (rest.length > 0) return null;

	if (first === "") {
		let inbox = findView("inbox");
		return inbox ? inboxScreen(inbox, undefined, request) : null;
	}

	let view = findView(first);
	if (view) return inboxScreen(view, second, request);

	if (first === "contacts") {
		if (second === undefined) {
			return {
				title: "Contacts",
				body: <ContactsScreen url={url} collapsed={collapsed} state={contactsState(url)} />,
			};
		}
		let contact = findContact(second);
		return contact
			? { title: contact.name, body: <ContactScreen contact={contact} collapsed={collapsed} /> }
			: null;
	}

	if (first === "reports" && second === undefined) {
		return {
			title: "Reports",
			body: (
				<ReportsScreen collapsed={collapsed} failed={url.searchParams.get("state") === "error"} />
			),
		};
	}

	if (first === "settings") {
		let settingsPage = SETTINGS_PAGES.find((candidate) => candidate === second);
		if (second !== undefined && settingsPage === undefined) return null;
		return {
			title: "Settings",
			body: <SettingsScreen collapsed={collapsed} page={settingsPage ?? null} />,
		};
	}

	return null;
}

/**
 * Picks the conversation to open after one leaves a view, the way Mail moves to the next
 * message: the one below it, else the one above, else the empty view.
 */
function nextPage(view: InboxView, conversationId: string): string {
	let list = conversationsIn(view);
	let index = list.findIndex((conversation) => conversation.id === conversationId);
	let next = index === -1 ? undefined : (list[index + 1] ?? list[index - 1]);
	return next ? conversationPage(view, next.id) : viewPage(view);
}

/** Answers a triage form posted on `<view>/<conversation>`. */
function submitTriage(
	view: InboxView,
	conversationId: string,
	form: FormData,
): DemoAppRedirect | null {
	if (findConversation(conversationId) === undefined) return null;
	let parsed = s.parseSafe(TRIAGE_FORM, form);
	if (!parsed.success) return null;
	let { intent, body } = parsed.value;
	let here = conversationPage(view, conversationId);

	if (intent === "reply")
		return body.trim() === "" ? { page: here } : { page: here, toast: "reply-sent" };
	if (intent === "archive")
		return { page: nextPage(view, conversationId), toast: `archived-${conversationId}` };
	if (intent === "unarchive") return { page: `inbox/${conversationId}`, toast: "restored" };
	if (intent === "mark-unread") return { page: viewPage(view), toast: "marked-unread" };
	if (intent.startsWith("snooze-"))
		return { page: nextPage(view, conversationId), toast: "snoozed" };
	if (intent.startsWith("assign-"))
		return { page: here, toast: `assigned-${intent.slice("assign-".length)}` };
	return { page: here };
}

/** Answers a settings form; the auto-reply switch names its new state in the toast. */
function submitSettings(form: FormData): DemoAppRedirect | null {
	let parsed = s.parseSafe(SETTINGS_FORM, form);
	if (!parsed.success) return null;
	let { section, autoReply } = parsed.value;
	if (section === "signature") return { page: "settings/signature", toast: "signature-saved" };
	if (section === "auto-reply") {
		return {
			page: "settings/assignment",
			toast: autoReply === "" ? "auto-reply-off" : "auto-reply-on",
		};
	}
	return { page: "settings/assignment", toast: "rules-saved" };
}

/**
 * Relay as the gallery and `/demo/apps/relay` read it: its theme, every screen, and where
 * each form returns the visitor with which toast.
 */
export default {
	name: "Relay",
	kind: "Support inbox",
	tagline: "A shared inbox and light CRM for a SaaS support team.",
	artDirection: "Mail-like white on pale grey, system blue, the system font.",
	description:
		"Relay, an invented support inbox: mailboxes, conversations and the open conversation on one screen, with contacts, reports and settings.",
	theme: { brand: BRAND, neutral: NEUTRAL, tokens: TOKENS },
	thumbnail: () => <RelayThumbnail />,
	screens: SCREENS,
	cookies: [SHELL_COOKIE, SPLIT_COOKIE],
	toasts: TOASTS,
	render(request) {
		return route(request) ?? notFound(readAppShellCookie(request.cookie, SHELL_COOKIE));
	},
	submit(page, form) {
		let [first = "", second, ...rest] = page.split("/");
		if (rest.length > 0) return null;
		let view = findView(first);
		if (view && second !== undefined) return submitTriage(view, second, form);
		if (first === "settings" && (second === "assignment" || second === "signature")) {
			return submitSettings(form);
		}
		return null;
	},
} satisfies DemoApp;
