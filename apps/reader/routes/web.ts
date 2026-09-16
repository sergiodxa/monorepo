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
 * @example routes.feed.href({ feed: "01J..." });
 */
export default route({
	home: get("/"),

	/** GET = the OIDC callback ("index"), POST = starts the authorization flow ("action"). */
	auth: form("/auth"),

	/** GET = the confirmation page ("index"), POST = destroys the session ("action"). */
	logout: form("/logout"),

	/**
	 * Every post from every followed feed, and the app's landing spot after sign-in. The
	 * header's controls narrow it in place: `show` picks a read state, `q` a set of words,
	 * and the two compose, so a reader searching inside their unread posts is one URL.
	 *
	 * GET = the queue ("index"), POST = follows a feed ("action"). Following is posted here
	 * rather than to the subscriptions, because a refusal is answered with this page: an
	 * address the reader is left on has to be one they can reload, and a reload of an
	 * address that answers no `GET` re-sends the submission that got them there.
	 */
	reading: form("/reading"),

	/** Takes every unread post out of the queue at once. */
	readAll: post("/reading/read"),

	/**
	 * One feed's posts, and the ways to act on that feed. It lives under the queue because
	 * it is the same list narrowed to one publisher, and no `GET` answers `/reading/read`,
	 * so the pattern the two share never decides between them.
	 */
	feed: get("/reading/:feed"),

	/**
	 * One post, read here rather than at the publisher: what the feed gave — title,
	 * author, date, excerpt and the link — and underneath it the article itself, fetched
	 * when the reader opens this and held for nobody in particular.
	 *
	 * It sits under the feed whose page lists it, so the address says where the post came
	 * from as well as which post it is, and a reader who lands on it from a link has the
	 * way back in the URL they arrived on.
	 */
	post: get("/reading/:feed/:item"),

	/**
	 * One folder's posts: every feed filed there, read as one stream. It lives under the
	 * queue for the reason one feed's page does — it is that same list narrowed to a group
	 * the reader chose — and takes a segment of its own rather than sharing the feed's, so
	 * the two patterns never decide between each other.
	 */
	folder: get("/reading/folders/:folder"),

	/**
	 * The folders themselves. A reader meets a folder in the rail and on its own surface,
	 * so these are the addresses the forms on those surfaces act against.
	 */
	folders: {
		create: post("/folders"),
		rename: post("/folders/:folderId"),
		delete: del("/folders/:folderId"),
		/**
		 * Files one feed, beside the paths that refresh and set the span on it, so the feed's
		 * page reaches it with a plain form. It accepts a folder the reader already has or a
		 * name for a new one, which is where most folders come from.
		 */
		file: post("/feeds/:feedId/folder"),
	},

	/**
	 * The posts a reader asked to keep, which no rule that deletes a post reaches. Its own
	 * address rather than a narrowing of {@link reading}: keeping a post is a decision about
	 * that post rather than a state the queue can be filtered by, and the list of them is
	 * somewhere a reader goes back to.
	 */
	saved: get("/saved"),

	/**
	 * The kept posts under one label, read as one stream. Its own address, the way the
	 * saved list is: a label is why a reader kept something, and the list of what they kept
	 * for one reason is somewhere they go back to and can keep a link to.
	 */
	tag: get("/tags/:tag"),

	/**
	 * The labels themselves, and the two ways one reaches a post. A reader meets a label as
	 * a chip on a post they kept and on its own surface, so these are the addresses the
	 * forms on those surfaces act against.
	 */
	tags: {
		create: post("/tags"),
		rename: post("/tags/:tagId"),
		delete: del("/tags/:tagId"),
		/**
		 * Puts a label on one post, which keeps the post as it does — one gesture, with no
		 * ordering between two verbs for a reader to get wrong.
		 */
		apply: post("/items/:itemId/tags"),
		/** Takes one label off one post, which deletes neither. */
		remove: del("/items/:itemId/tags/:tagId"),
	},

	/**
	 * The rules a reader writes about what a post says, and the preview of one they are
	 * still typing. Its own address because a rule is configured once and read back later,
	 * and because the preview is a page they arrive at with a query rather than a step in a
	 * flow they have to redo.
	 *
	 * GET = the rules and whatever a candidate in the query would have caught ("index"),
	 * POST = writes a rule ("action"). Writing posts here so a refusal is answered with the
	 * page the reader is left standing on.
	 */
	rules: form("/rules"),

	/** The ways one rule, and one previewed page, are acted on. */
	rule: {
		update: post("/rules/:ruleId"),
		delete: del("/rules/:ruleId"),
		/**
		 * Acts on the posts a previewed candidate matched, which is bounded by that page. A
		 * path of its own rather than a segment a rule id could also spell, so the two
		 * patterns never decide between each other.
		 */
		apply: post("/rules/previewed"),
	},

	/**
	 * The queries a reader kept. Nothing here renders posts: a saved search is a link, and
	 * the rail draws it as the queue's own address, so these are the addresses the forms
	 * beside that list act against. A second renderer of one list is a second place for the
	 * two to disagree.
	 */
	searches: {
		create: post("/searches"),
		delete: del("/searches/:searchId"),
	},

	/**
	 * The subscriptions themselves. Nothing here renders a page: a reader meets their feeds
	 * in the rail and one feed on {@link reading}'s own surface, so these are the addresses
	 * the forms on those surfaces act against.
	 */
	feeds: {
		unfollow: del("/feeds/:feedId"),
		/** Its own path rather than a `POST` on the feed, so a form can reach it directly. */
		refresh: post("/feeds/:feedId/refresh"),
		/**
		 * Checks every followed feed. A `POST` on the collection, mirroring the way
		 * `refresh` reads on one feed.
		 */
		refreshAll: post("/feeds/refresh"),
		/** Takes one feed's unread posts out of the queue, leaving every other feed alone. */
		read: post("/feeds/:feedId/read"),
		/**
		 * Sets how long this feed's posts stay in the reader's timeline. A path of its own,
		 * the way `refresh` and `read` are, so the feed's page reaches it with a plain form.
		 */
		velocity: post("/feeds/:feedId/velocity"),
		/**
		 * The subscription list as OPML, for carrying it to another reader. A path of its
		 * own rather than a segment under `/feeds`, which `unfollow` would read as a feed id.
		 */
		/**
		 * Pins a feed to the strip above the queue, or takes the pin off. A path of its own,
		 * the way `refresh` and `velocity` are, so the feed's page reaches it with a form.
		 */
		pin: post("/feeds/:feedId/pin"),
		/**
		 * Decides whether a scheduled check finding posts here is worth interrupting the
		 * reader for. A path of its own, the way `pin` and `velocity` are, so the feed's page
		 * reaches it with a plain form.
		 */
		notify: post("/feeds/:feedId/notify"),
		/**
		 * Decides whether this feed's links carry the address exactly as the publisher wrote
		 * it. A path of its own, the way `notify` and `velocity` are, so the feed's page
		 * reaches it with a plain form.
		 */
		linkParameters: post("/feeds/:feedId/link-parameters"),
		export: get("/feeds.opml"),
		/** Subscribes to every feed in an uploaded OPML document. */
		import: post("/feeds/import"),
	},

	items: {
		/** Its own path rather than a `PATCH` on the item, so a form can reach it directly. */
		read: post("/items/:itemId/read"),
		/** Keeps a post, or stops keeping it, beside the route that marks one read. */
		save: post("/items/:itemId/save"),
		/**
		 * Where the browser reports that a post's title was clicked, named by the link's
		 * own `ping` attribute. The browser posts here itself while following the title
		 * through to the publisher, so opening a post marks it read and the title stays an
		 * ordinary link to the address the publisher gave.
		 */
		open: post("/items/:itemId/open"),
	},

	/**
	 * The band of the sidebar that changes: the feeds a reader follows and how many posts
	 * of each are waiting. It is its own address so the page can redraw that band alone
	 * after marking a post read, instead of fetching the whole document to move a number.
	 *
	 * Nothing links here. It answers a fragment of the chrome rather than a page, which is
	 * why it sits apart from the addresses a reader arrives at.
	 */
	sidebar: {
		feeds: get("/sidebar/feeds"),
	},

	/**
	 * What the app does on the reader's behalf, and the two ways their subscription list
	 * travels. A `GET` alone: the transfers post to their own addresses under {@link feeds},
	 * and how often a feed is checked is one number for every reader rather than a choice.
	 */
	settings: get("/settings"),

	/**
	 * What the reader may change about how their pages look. A `POST` of its own beside the
	 * page that draws it, so a form submits the scheme and the face and nothing else, and so
	 * the response that stores the answer is the one that sets the cookie carrying it.
	 */
	appearance: post("/settings/appearance"),

	/**
	 * The Model Context Protocol endpoint, plus the page explaining it. `form()` answers
	 * both an agent's `POST` and a browser's `GET` to `/mcp`, so pasting the address into a
	 * browser explains what is served there rather than refusing the method.
	 */
	mcp: form("/mcp"),

	/**
	 * The tokens a reader mints for an agent. They sit under the settings page that draws
	 * them, and each acts on one row so a form submits one answer rather than the surface.
	 */
	tokens: {
		/** Mints one, which is the only moment its value exists outside the reader's client. */
		create: post("/settings/tokens"),
		/** Stops one answering, from the next call onwards. */
		revoke: del("/settings/tokens/:tokenId"),
	},

	/**
	 * How the reader is reached when a check finds something, and which browsers it is
	 * reached on. They sit under the settings page that draws them, and each is a `POST` of
	 * its own so a form submits one answer rather than the whole surface.
	 */
	notifications: {
		/** Turns the push and email channels on or off. */
		channels: post("/settings/notifications"),
		/** Sets the window the reader is left alone in, in their own hours. */
		quietHours: post("/settings/notifications/quiet-hours"),
		/**
		 * Where a browser hands over the endpoint the push service gave it. Nothing links
		 * here: it answers a script that has just subscribed, and answers JSON rather than a
		 * page.
		 */
		devices: post("/settings/notifications/devices"),
		/** Revokes one browser, which is the only thing the settings page knows a device by. */
		forget: del("/settings/notifications/devices/:deviceId"),
		/**
		 * Where the only participant that knows the reader's time zone reports it. Posted once
		 * when it differs from what is stored, because quiet hours without a zone are quiet
		 * hours in UTC.
		 */
		timeZone: post("/settings/notifications/time-zone"),
	},

	/**
	 * What a reader does about their plan. Both are `POST`s that end in a redirect to a page
	 * the platform hosts: this app never draws a card field, so there is nothing here to
	 * answer a `GET` with.
	 */
	billing: {
		/** Opens a hosted checkout for one of the paid tiers, named by the `:plan` segment. */
		checkout: post("/billing/checkout/:plan"),
		/** Opens the hosted page where a card, an invoice or a cancellation is dealt with. */
		portal: post("/billing/portal"),
	},

	/**
	 * Every remote image a reading surface shows, fetched by this app and handed on from
	 * here, so a reader's browser talks to one origin while they read and a publisher learns
	 * that one server asked for a picture.
	 *
	 * `:source` is the base64url of the image's absolute address and `:signature` the MAC
	 * this app took over it. Both segments are required: without the signature the route is
	 * an open proxy, and anybody could spend this app's address and egress on any URL they
	 * liked.
	 */
	media: get("/media/:signature/:source"),

	/**
	 * Where the payment platform delivers. Nobody links here and no reader arrives here:
	 * it answers a signed delivery, and a forged one is the only thing it closes the door
	 * on.
	 */
	webhooks: {
		billing: post("/webhooks/billing"),
	},

	/**
	 * Where a publisher's hub delivers. Nobody links here and no reader arrives here: the
	 * `GET` answers the hub's verification and the `POST` its notification, which is the
	 * shape a form route already describes.
	 *
	 * `:feedId` is the catalog's id, so a delivery reaches the right object with no lookup,
	 * and `:token` is an unguessable value minted per feed — the id appears in
	 * administrative URLs and in logs, and anything that can post here can make this app
	 * fetch.
	 */
	websub: form("/websub/:feedId/:token"),
});
