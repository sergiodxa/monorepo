/**
 * Questions to ask of a user agent — the platform family and the form factor —
 * so a call site states what it needs rather than repeating the matching. Each
 * one reads the current request by default, and takes a source to read instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getContext } from "remix/middleware/async-context";
import { RequestContext } from "remix/router";

import type { UserAgent } from "./types.js";

import { CurrentUserAgent } from "./middleware.js";

/**
 * What a question can be asked about: a user agent already read, or a request
 * context carrying one.
 */
export type UserAgentSource = UserAgent | RequestContext<any, any>;

/**
 * The user agent a question answers about. Omitting the source reads the current
 * request, and a call stack running outside a request reads the unknown agent,
 * so a question asked from a script or a test answers rather than throws.
 *
 * @param source - The user agent, or the context holding one.
 * @returns The user agent to match against.
 */
function agentOf(source?: UserAgentSource): UserAgent {
	if (source === undefined) {
		try {
			return getContext().get(CurrentUserAgent);
		} catch {
			return CurrentUserAgent.defaultValue;
		}
	}

	if (source instanceof RequestContext) return source.get(CurrentUserAgent);

	return source;
}

/**
 * Whether the request came from one of Apple's operating systems: macOS, iOS or
 * iPadOS.
 *
 * @param source - The user agent, or the context holding one; defaults to the current request.
 * @returns `true` on an Apple system.
 * @example
 * let shortcut = isApplePlatform() ? "⌘K" : "Ctrl K";
 */
export function isApplePlatform(source?: UserAgentSource): boolean {
	let { name } = agentOf(source).os;
	return name === "macOS" || name === "iOS" || name === "iPadOS";
}

/**
 * Whether the request came from Android, phones and tablets alike.
 *
 * @param source - The user agent, or the context holding one; defaults to the current request.
 * @returns `true` on Android.
 * @example
 * let store = isAndroid() ? "play-store" : "app-store";
 */
export function isAndroid(source?: UserAgentSource): boolean {
	return agentOf(source).os.name === "Android";
}

/**
 * Whether the request came from a phone.
 *
 * @param source - The user agent, or the context holding one; defaults to the current request.
 * @returns `true` on a phone.
 * @example
 * let perPage = isMobile() ? 10 : 50;
 */
export function isMobile(source?: UserAgentSource): boolean {
	return agentOf(source).device.type === "mobile";
}

/**
 * Whether the request came from a tablet.
 *
 * @param source - The user agent, or the context holding one; defaults to the current request.
 * @returns `true` on a tablet.
 * @example
 * let columns = isTablet() ? 2 : 3;
 */
export function isTablet(source?: UserAgentSource): boolean {
	return agentOf(source).device.type === "tablet";
}

/**
 * Whether the request came from a computer. An iPad asked for the desktop site
 * sends the string a Mac sends, and answers here as a desktop.
 *
 * @param source - The user agent, or the context holding one; defaults to the current request.
 * @returns `true` on a computer.
 * @example
 * let showKeyboardHints = isDesktop();
 */
export function isDesktop(source?: UserAgentSource): boolean {
	return agentOf(source).device.type === "desktop";
}

/**
 * Whether the request came from a handheld — a phone or a tablet — which is what
 * decides between a pointer-sized and a finger-sized target.
 *
 * @param source - The user agent, or the context holding one; defaults to the current request.
 * @returns `true` on a phone or a tablet.
 * @example
 * let hitArea = isTouch() ? "44px" : "28px";
 */
export function isTouch(source?: UserAgentSource): boolean {
	let { type } = agentOf(source).device;
	return type === "mobile" || type === "tablet";
}
