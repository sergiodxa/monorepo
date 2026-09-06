/**
 * Web route table. Every pattern here is a published contract — bookmarked, linked from a
 * page, or already sitting in somebody's history — so a pattern is added rather than
 * reshaped, and controllers, middleware, and views build their URLs from this one map.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { del, form, get, post, route } from "remix/routes";

/**
 * The app's route map. Each leaf carries `.href(params)` for building a URL and is the key
 * `bootstrap/app.tsx` maps a controller onto.
 *
 * @example routes.feeds.show.href({ feedId: "01J..." });
 */
export default route({
	home: get("/"),

	/** GET = the OIDC callback ("index"), POST = starts the authorization flow ("action"). */
	auth: form("/auth"),

	/** GET = the confirmation page ("index"), POST = destroys the session ("action"). */
	logout: form("/logout"),

	/** The unread queue across every followed feed, and the app's landing spot after sign-in. */
	reading: get("/reading"),

	feeds: {
		index: get("/feeds"),
		show: get("/feeds/:feedId"),
		/**
		 * Shares its path with `feeds.index` and separates on method, so following a feed
		 * posts to the collection it joins and the list URL stays the one bookmarkable page.
		 */
		follow: post("/feeds"),
		unfollow: del("/feeds/:feedId"),
	},

	items: {
		/** Its own path rather than a `PATCH` on the item, so a form can reach it directly. */
		read: post("/items/:itemId/read"),
	},

	/** GET = the preferences form ("index"), POST = saves it ("action"). */
	settings: form("/settings"),
});
