/**
 * The reader a local machine signs in as, and the library they start with: real feeds
 * followed through the same path a person takes, filed, pinned, partly read and partly
 * kept, so every signed-in screen has something true-to-life to draw on a fresh checkout.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { userStore } from "~/app/models/user-store";

/** Who the development sign-in names, as the ID token it writes carries them. */
export const SEED_USER = {
	subject: "dev-seed-reader",
	name: "Ada Lovelace",
	email: "ada@reader.localhost",
} as const;

/**
 * The feeds the seed follows, each with the folder it is filed in or `null` for none. They
 * are real publications, fetched on the first sign-in, so the queue holds articles with
 * the lengths, images and markup a reader actually meets.
 */
const SEED_FEEDS: ReadonlyArray<{ url: string; folder: string | null }> = [
	{ url: "https://simonwillison.net/atom/everything/", folder: null },
	{ url: "https://jvns.ca/atom.xml", folder: "Engineering" },
	{ url: "https://overreacted.io/rss.xml", folder: "Engineering" },
	{ url: "https://www.joshwcomeau.com/rss.xml", folder: "Web platform" },
	{ url: "https://lea.verou.me/feed.xml", folder: "Web platform" },
	{ url: "https://daringfireball.net/feeds/main", folder: null },
	{ url: "https://blog.cloudflare.com/rss/", folder: null },
	{ url: "https://xkcd.com/atom.xml", folder: null },
];

/** Of every post the seed finds, how many are left unread at the top of the queue. */
const UNREAD_HEAD = 12;

/** How many posts the seed keeps, picked from below the unread head. */
const SAVED_COUNT = 5;

/** The label the first kept posts carry, so the labels surface has one to show. */
const SEED_TAG = "To try";

/**
 * Brings the seed reader's library to its starting state. A reader who already follows
 * anything is left alone, so signing in again keeps whatever was read, kept or changed.
 *
 * @returns How many feeds were followed, `0` for a library that was already there.
 * @example await seedReader();
 */
export async function seedReader(): Promise<number> {
	let store = userStore(SEED_USER.subject);

	await store.ensureUser(SEED_USER.subject, SEED_USER.email);
	if ((await store.countFeeds()) > 0) return 0;

	/**
	 * Granted rather than bought, so the platform's reconciliation leaves it in place and
	 * folders, labels, pins and saved searches are all on screen.
	 */
	await store.setTier({
		entitled: "premium",
		cancelled: false,
		readAt: Date.now(),
		source: "grant",
	});

	let followed: Array<{ feedId: string; folder: string | null }> = [];
	for (let feed of SEED_FEEDS) {
		let result = await store.followFeed(feed.url);
		if (result.ok) followed.push({ feedId: result.feed.id, folder: feed.folder });
	}

	for (let feed of followed) {
		if (feed.folder) await store.fileFeed(feed.feedId, { title: feed.folder });
	}

	let [first] = followed;
	if (first) await store.pinFeed(first.feedId);

	let queue = await store.readingQueue({ readState: "all", limit: 60 });
	if (queue.ok) {
		let below = queue.items.slice(UNREAD_HEAD);
		for (let [index, item] of below.entries()) {
			if (index % 3 !== 2) await store.markRead(item.id);
		}

		let kept = below.slice(0, SAVED_COUNT);
		for (let item of kept) await store.saveItem(item.id);
		for (let item of kept.slice(0, 2)) await store.tagItem(item.id, { name: SEED_TAG });
	}

	await store.createSearch({
		name: "Cloudflare",
		query: "cloudflare",
		readState: "all",
		feedId: null,
	});

	return followed.length;
}
