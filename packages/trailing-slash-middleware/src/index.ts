/**
 * Router middleware that gives every path one canonical trailing-slash form,
 * answering the other form with a `308` to the canonical URL so each resource
 * lives at a single address for search engines, caches, and relative links.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { createRedirectResponse } from "remix/response/redirect";

/** Configures which form of a path `trailingSlash()` treats as canonical. */
export interface TrailingSlashOptions {
	/**
	 * `"never"` makes `/posts` canonical; `"always"` makes `/posts/` canonical,
	 * except that a path whose last segment contains a `.` (`/robots.txt`) keeps
	 * the form it arrived in.
	 *
	 * @default "never"
	 */
	mode?: "never" | "always";
}

/**
 * Creates a middleware that redirects a request to the canonical form of its
 * path with `308 Permanent Redirect`, so a `POST` is repeated with its method
 * and body. `/` is always canonical, and only the path changes.
 *
 * @param options - Picks the canonical form; omitted, trailing slashes are stripped.
 * @returns The middleware, answering before the handler whenever it redirects.
 * @example
 * createRouter({ middleware: [trailingSlash()] });
 * @example
 * createRouter({ middleware: [trailingSlash({ mode: "always" })] });
 */
export function trailingSlash(options: TrailingSlashOptions = {}): Middleware {
	let mode = options.mode ?? "never";

	return function trailingSlashMiddleware(context, next) {
		let url = new URL(context.request.url);
		let canonical = canonicalPathname(url.pathname, mode);
		if (canonical === url.pathname) return next();

		url.pathname = canonical;
		return createRedirectResponse(url.href, 308);
	};
}

/**
 * Resolves the canonical form of `pathname`. A run of trailing slashes counts
 * as one, so `/posts///` reaches its canonical form in a single redirect. In
 * `"always"` mode a slash-free path whose last segment contains `.` is a file
 * and stays slash-free; a slashed one keeps its single slash.
 */
function canonicalPathname(pathname: string, mode: "never" | "always"): string {
	let base = pathname.replace(/\/+$/, "");
	if (base === "") return "/";
	if (mode === "never") return base;
	if (base === pathname && isFileLike(base)) return base;
	return `${base}/`;
}

/** A last segment with a `.` names a file (`robots.txt`, `app.min.js`, `.well-known`'s `security.txt`). */
function isFileLike(pathname: string): boolean {
	return pathname.slice(pathname.lastIndexOf("/") + 1).includes(".");
}
