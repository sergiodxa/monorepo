/**
 * The cookie an app shell keeps its collapsed sidebar in, and the server-side reader for it.
 * The browser writes it when the sidebar toggles; the server reads it before rendering, so the
 * first paint already has the width the person left it at.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The cookie the shell's toggle writes `"true"` or `"false"` under. */
export const APP_SHELL_COOKIE = "ui-app-shell-collapsed";

/**
 * Whether the sidebar was left collapsed, read from a request's `Cookie` header. A missing
 * header, a missing cookie or any value other than `"true"` reads as expanded.
 *
 * @param cookieHeader The request's `Cookie` header.
 * @param name The cookie name, for an app that renamed it on the shell.
 * @returns `true` when the sidebar renders as the icon rail.
 * @example
 * <AppShell collapsed={readAppShellCookie(request.headers.get("Cookie"))} … />
 */
export function readAppShellCookie(
	cookieHeader: string | null | undefined,
	name: string = APP_SHELL_COOKIE,
): boolean {
	if (!cookieHeader) return false;
	for (let part of cookieHeader.split(";")) {
		let index = part.indexOf("=");
		if (index === -1) continue;
		if (part.slice(0, index).trim() !== name) continue;
		return part.slice(index + 1).trim() === "true";
	}
	return false;
}
