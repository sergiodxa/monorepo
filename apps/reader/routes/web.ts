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

	/** Takes every unread post out of the queue at once. */
	readAll: post("/reading/read"),

	/** Posts matching what the reader typed, across every feed they follow. */
	search: get("/search"),

	feeds: {
		index: get("/feeds"),
		show: get("/feeds/:feedId"),
		/**
		 * Shares its path with `feeds.index` and separates on method, so following a feed
		 * posts to the collection it joins and the list URL stays the one bookmarkable page.
		 */
		follow: post("/feeds"),
		unfollow: del("/feeds/:feedId"),
		/** Its own path rather than a `POST` on the feed, so a form can reach it directly. */
		refresh: post("/feeds/:feedId/refresh"),
		/**
		 * Checks every followed feed. A `POST` on the collection, mirroring the way
		 * `refresh` reads on one feed, and no `GET` answers this path so the pattern it
		 * shares with `show` never decides between them.
		 */
		refreshAll: post("/feeds/refresh"),
		/** Takes one feed's unread posts out of the queue, leaving every other feed alone. */
		read: post("/feeds/:feedId/read"),
		/**
		 * The subscription list as OPML, for carrying it to another reader. A path of its
		 * own rather than a segment under `/feeds`, which `show` would read as a feed id.
		 */
		export: get("/feeds.opml"),
		/** Subscribes to every feed in an uploaded OPML document. */
		import: post("/feeds/import"),
	},

	items: {
		/** Its own path rather than a `PATCH` on the item, so a form can reach it directly. */
		read: post("/items/:itemId/read"),
		/**
		 * Where the browser reports that a post's title was clicked, named by the link's
		 * own `ping` attribute. The browser posts here itself while following the title
		 * through to the publisher, so opening a post marks it read and the title stays an
		 * ordinary link to the address the publisher gave.
		 */
		open: post("/items/:itemId/open"),
	},

	/** GET = the preferences form ("index"), POST = saves it ("action"). */
	settings: form("/settings"),
});
