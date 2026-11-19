/**
 * Remembers the poster a visitor is looking at, so the home and product pages can show it on
 * the "Recently viewed" shelf next time. The browser writes the cookie once script runs; a
 * visit without script keeps the shelf empty, and every other screen works the same.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { clientEntry } from "remix/component";

namespace RecentLive {
	export interface Props {
		/** The poster being viewed. */
		poster: string;
		/** The cookie's name. */
		cookie: string;
		/** The path the cookie is scoped to, the app's own. */
		path: string;
		/** How many posters the list keeps. */
		limit: number;
	}
}

/** Reads one cookie's value from `document.cookie`, or `""`. */
function readCookie(name: string): string {
	for (let pair of document.cookie.split(";")) {
		let [key = "", ...value] = pair.trim().split("=");
		if (key === name) {
			try {
				return decodeURIComponent(value.join("="));
			} catch {
				return "";
			}
		}
	}
	return "";
}

/** Puts the viewed poster at the front of the recently viewed cookie. */
export const RecentLive = clientEntry(
	import.meta.url,
	function RecentLive(handle: Handle<RecentLive.Props>) {
		handle.queueTask(() => {
			let { cookie, limit, path, poster } = handle.props;
			let ids = readCookie(cookie)
				.split(",")
				.filter((id) => id !== "" && id !== poster);
			let next = [poster, ...ids].slice(0, limit).join(",");
			document.cookie = `${cookie}=${encodeURIComponent(next)}; Path=${path}; Max-Age=604800; SameSite=Lax`;
		});
		return () => <span hidden data-hw-recent="" />;
	},
);
