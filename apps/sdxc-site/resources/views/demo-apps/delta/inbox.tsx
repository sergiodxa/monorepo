/**
 * Delta's notifications as the router reaches them: the inbox drawn from the seeded
 * notifications and the visitor's flags, and every form it posts (a row's Done or Save, the
 * bulk bar, Undo) answered by redirecting back with the flags in the visitor's cookies.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Toast } from "@sdxc/ui/app";
import type { RemixNode } from "remix/component";

import type { DemoAppRedirect, DemoAppRequest } from "~/resources/views/demo-apps";

import { readHistory } from "~/app/services/delta/source";

import type { InboxItem } from "./screens/notifications";
import type { Notification } from "./seed/notifications";

import { loadRuns } from "./ci";
import { actionHref } from "./data";
import { COPY } from "./labels";
import { inboxCookie, readPrefs, undoCookie } from "./prefs";
import { allPulls } from "./pull-records";
import { allIssues, seedBase } from "./records";
import { NotificationsScreen } from "./screens/notifications";
import { buildNotifications } from "./seed/notifications";
import { readState } from "./state";

/** How long a toast offering Undo stays, long enough to reach for it. */
const UNDO_DURATION = 8000;

/** The toasts the inbox's forms name. */
export const INBOX_TOASTS: Record<string, Omit<Toast.Flash, "id">> = {
	"inbox-done": {
		title: COPY.inbox.toasts.done,
		duration: UNDO_DURATION,
		action: { label: COPY.inbox.toasts.undo, form: { action: actionHref("notifications/undo") } },
	},
	"inbox-undone": { title: COPY.inbox.toasts.undone },
	"inbox-read": { title: COPY.inbox.toasts.read },
	"inbox-saved": { title: COPY.inbox.toasts.saved },
};

/** A screen as Delta's router draws it. */
interface Screen {
	title: string;
	nav: string;
	crumb: string;
	body: RemixNode;
}

/**
 * Every notification as of `now`, joined to the runs, commits, issues and pull requests it
 * names, the issues and pull requests as the visitor's own work left them.
 */
async function loadNotifications(now: number, cookie: string | null): Promise<Notification[]> {
	let state = readState(cookie);
	let [{ runs }, history, pulls] = await Promise.all([
		loadRuns(now),
		readHistory(),
		allPulls(state, now),
	]);
	let issues = allIssues(state, seedBase(history.commits[0]?.date, now));
	return buildNotifications(runs, history.commits, now, { issues, pulls });
}

/**
 * Every notification as one visitor sees it: the seed's unread flag, then their own read, saved
 * and done flags over it. A done notification reads as read.
 *
 * @param cookie The request's `Cookie` header.
 * @param now The request's time.
 */
export async function inboxItems(cookie: string | null, now: number): Promise<InboxItem[]> {
	let prefs = readPrefs(cookie);
	return (await loadNotifications(now, cookie)).map((notification) => {
		let flags = prefs.inbox.get(notification.id) ?? {};
		let done = flags.done ?? false;
		return {
			...notification,
			unread: !done && (flags.read === undefined ? notification.unread : !flags.read),
			saved: flags.saved ?? false,
			done,
		};
	});
}

/** Draws the inbox for a request, with the visitor's flags applied. */
export async function inboxScreen(request: DemoAppRequest, now: number): Promise<Screen> {
	let items = await inboxItems(request.cookie, now);
	return {
		title: COPY.inbox.title,
		nav: "notifications",
		crumb: COPY.inbox.title,
		body: <NotificationsScreen items={items} url={request.url} now={now} />,
	};
}

/** The inbox page a form returns to, kept to the inbox's own addresses. */
function returnPage(form: FormData): string {
	let value = form.get("return");
	if (typeof value !== "string") return "notifications";
	return /^notifications(\?[\w=&%.+-]*)?$/.test(value) ? value : "notifications";
}

/** The notification ids a post names, kept to the ones the seed holds. */
async function readIds(values: FormDataEntryValue[]): Promise<string[]> {
	let known = new Set((await loadNotifications(Date.now(), null)).map((item) => item.id));
	return [...new Set(values)].filter((id): id is string => typeof id === "string" && known.has(id));
}

/**
 * Answers the inbox's forms: `notifications/<id>` flips one row's Done or Save, `notifications`
 * applies the bulk bar's action to every checked row, and `notifications/undo` moves the last
 * bulk Done back. Any other page answers `null`, for the next handler to try.
 *
 * @param page The page the form posted to.
 * @param form The posted fields.
 * @param request The post, whose cookies hold the visitor's flags.
 */
export async function submitInbox(
	page: string,
	form: FormData,
	request: DemoAppRequest,
): Promise<DemoAppRedirect | null> {
	if (page !== "notifications" && !page.startsWith("notifications/")) return null;
	let prefs = readPrefs(request.cookie);
	let back = returnPage(form);
	let [, id, ...rest] = page.split("/");
	if (id === "undo" && rest.length === 0) {
		let cookies = prefs.undo.map((undone) => inboxCookie(prefs, undone, { done: false }));
		return { page: back, toast: "inbox-undone", cookies: [...cookies, undoCookie([])] };
	}
	if (id !== undefined) {
		let [known] = await readIds([id]);
		if (known === undefined || rest.length > 0) return null;
		let on = form.get("on") === "true";
		let intent = form.get("intent");
		if (intent === "done") {
			let change = on ? { done: true, read: true } : { done: false };
			return { page: back, cookies: [inboxCookie(prefs, known, change)] };
		}
		if (intent === "save")
			return { page: back, cookies: [inboxCookie(prefs, known, { saved: on })] };
		return null;
	}
	let ids = await readIds(form.getAll("ids"));
	let intent = form.get("intent");
	if (ids.length === 0) return { page: back };
	if (intent === "done") {
		let cookies = ids.map((each) => inboxCookie(prefs, each, { done: true, read: true }));
		return { page: back, toast: "inbox-done", cookies: [...cookies, undoCookie(ids)] };
	}
	if (intent === "undone") {
		let cookies = ids.map((each) => inboxCookie(prefs, each, { done: false }));
		return { page: back, toast: "inbox-undone", cookies };
	}
	if (intent === "read") {
		let cookies = ids.map((each) => inboxCookie(prefs, each, { read: true }));
		return { page: back, toast: "inbox-read", cookies };
	}
	if (intent === "save") {
		let cookies = ids.map((each) => inboxCookie(prefs, each, { saved: true }));
		return { page: back, toast: "inbox-saved", cookies };
	}
	return null;
}
