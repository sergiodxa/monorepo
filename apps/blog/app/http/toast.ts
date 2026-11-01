/**
 * The one-line confirmation a CMS write leaves for the page it redirects to: set as a session
 * flash before the redirect and read once by the CMS layout, which shows it as a toast. A
 * request with no session, such as a test that renders one view, sets and reads nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { Session } from "remix/session";

import { currentRequest } from "~/app/http/current-request";

/** The session key the flash lives under. */
const TOAST_KEY = "toast";

/** A flash as it is stored; anything else in the cookie-backed session reads as none. */
const TOAST = s.object({ color: s.enum_(["success", "danger"]), message: s.string() });

/** What the next page's toast says, and whether it reports a success or a failure. */
export interface CMSToast {
	color: "success" | "danger";
	message: string;
}

/** The request's session, when the session middleware ran for it. */
function currentSession() {
	let ctx = currentRequest();
	return ctx?.has(Session) ? (ctx.get(Session) ?? null) : null;
}

/**
 * Leaves `message` for the page the write redirects to. Past tense and short: "Article saved".
 *
 * @param message What the toast says.
 * @param color `danger` for a write that did not happen.
 */
export function flashToast(message: string, color: CMSToast["color"] = "success"): void {
	currentSession()?.flash(TOAST_KEY, { color, message });
}

/** The flash the previous write left, which the session drops once this request ends. */
export function readToast(): CMSToast | null {
	let parsed = s.parseSafe(TOAST, currentSession()?.get(TOAST_KEY));
	return parsed.success ? parsed.value : null;
}
