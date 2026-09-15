/**
 * The chrome's own copy, the reader wearing it, and the feeds the rail lists under its
 * Feeds heading, which every signed-in page hands the layout along with what that page
 * itself shows.
 *
 * It sits beside the pages rather than inside the layout so the layout stays a thing that
 * prints what it is given, and beside all of them rather than in each so the app's sections
 * are named once however many surfaces lead back to them.
 *
 * The rail is on every page, so its list would be a second read of the reader's object on
 * every request — including the pages with no other reason to open it. It is kept in KV
 * instead, holding the three fields a rail row draws and nothing else. A cache is a second
 * place the truth lives, so this one is written to be wrong only in ways nobody notices:
 * every change a reader makes themselves clears it as they make it, and what arrives behind
 * their back waits out {@link RAIL_TTL}. A miss, an expiry, or a KV that cannot be reached
 * all end in the same place, which is the object itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { i18n } from "@sdxc/i18n";

import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { isFailure } from "@sdxc/result";
import { env, waitUntil } from "cloudflare:workers";

import type { AppLayout } from "~/resources/layouts/app";

import { getViewer } from "~/app/http/middleware/auth";
import { userStore } from "~/database/user-do";
import { SEARCH_PARAM } from "~/resources/layouts/app";

/**
 * How many feeds the rail draws. A rail is read by running an eye down it, which stops
 * being possible some way before a long subscription list ends; past this the Feeds heading
 * is the way to the whole of it, which is what that heading is a link for.
 *
 * A reader following more than this sees the ones their store lists first, which is the
 * most recently followed — the ones they are still deciding about.
 */
const RAIL_FEED_LIMIT = 20;

/**
 * How long a reader's cached rail list stands.
 *
 * Every count the reader moves themselves is purged as they move it, so this covers only
 * what arrives while they are not looking: the refresh alarm, which runs on the cadence in
 * their own settings and counts that in hours. Minutes against hours is fresh enough that a
 * new post reaches the rail in the same sitting, and long enough that a session's worth of
 * pages costs one read rather than one per page.
 */
const RAIL_TTL = "5 minutes";

/**
 * Namespace for a reader's rail list inside the KV this app shares between the sessions,
 * the provider's discovery document and this, each kept apart by its own prefix.
 */
const RAIL_KEY_PREFIX = "reader:sidebar-feeds";

/** What drawing the chrome needs off the request. */
export interface ChromeContext {
	i18next: i18n;
	/** Where the reader is, which is what marks the one thing in the chrome they are on. */
	url: URL;
	/** The request's language, which orders the rail's feeds by their names. */
	locale: string;
}

/**
 * One feed as the cache holds it: the three fields a rail row is drawn from and nothing
 * else. Anything more would make this a second copy of the subscription list, which is the
 * shape a cache rots in.
 */
interface CachedFeed {
	id: string;
	title: string;
	unreadCount: number;
}

/** Where a reader's rail list is kept. */
function railKey(subject: string): string {
	return `${RAIL_KEY_PREFIX}:${subject}`;
}

/** The KV-backed cache, built per call because the binding is read off the invocation. */
function railCache(): WorkerKVCache {
	return new WorkerKVCache(env.KV, { waitUntil });
}

/**
 * Drops a reader's cached rail list, so the next page they are shown counts their feeds
 * afresh. Called by every controller that changes what the rail draws, which is every
 * controller that marks something read, follows a feed, or lets one go.
 *
 * @param subject - The reader whose list is now out of date.
 */
export async function forgetRailFeeds(subject: string): Promise<void> {
	await railCache().delete(railKey(subject));
}

/**
 * The feeds the rail lists, from the cache where it holds one and from the reader's own
 * object where it does not.
 *
 * @param subject - The reader whose subscriptions are being drawn.
 * @returns The rail's feeds, or none of them when neither the cache nor the object answers,
 * since a rail missing its list is a page a reader can still read and act on.
 */
async function railFeeds(subject: string): Promise<CachedFeed[]> {
	let cached = await railCache().fetch<CachedFeed[]>(
		railKey(subject),
		async () => {
			let page = await userStore(subject).listFeeds({ limit: RAIL_FEED_LIMIT });
			if (!page.ok) return [];

			return page.feeds.map((feed) => ({
				id: feed.id,
				title: feed.title,
				unreadCount: feed.unreadCount,
			}));
		},
		{ ttl: RAIL_TTL },
	);

	return isFailure(cached) ? [] : cached.data;
}

/**
 * The rail's feeds in the order their names read, so a reader looking for one by name runs
 * their eye down the column rather than remembering when they followed it.
 *
 * Ordered by the language the request arrived in rather than by the bytes the names are
 * stored as, which is what puts "ábaco" among the As for a Spanish reader instead of past
 * "Zebra" at the end.
 *
 * Sorted here rather than on the way into the cache: the language belongs to the request
 * and the cache is keyed on the reader alone, so one reader's entry is read back by
 * requests in either language and each orders it for itself.
 *
 * @param feeds - The feeds as they were cached or read.
 * @param locale - The request's language.
 */
function sortByTitle(feeds: CachedFeed[], locale: string): CachedFeed[] {
	let collator = new Intl.Collator(locale);
	return [...feeds].sort((one, other) => collator.compare(one.title, other.title));
}

/**
 * The sections' names, the signed-in reader, and the feeds under the rail's Feeds heading,
 * spread into the layout by every page that wears it.
 *
 * @param ctx - The request, for the dictionary the names are read from.
 * @returns Every prop the layout's own chrome is drawn from, ready to spread.
 * @throws If nobody is signed in, which `requireUser` answers for before a page renders.
 */
export async function chrome(ctx: ChromeContext): Promise<{
	nav: AppLayout.Nav;
	viewer: AppLayout.Viewer;
	feeds: AppLayout.RailFeed[];
	currentPath: string;
	searchQuery: string;
}> {
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before a page renders its chrome");

	return {
		currentPath: ctx.url.pathname,
		/**
		 * What the reader last searched for, put back in the rail's box so refining a search
		 * edits the words rather than retyping them. It reaches the page as an attribute
		 * value, which the renderer escapes quote and all.
		 */
		searchQuery: ctx.url.searchParams.get(SEARCH_PARAM) ?? "",
		nav: {
			label: ctx.i18next.t("nav.label"),
			reading: ctx.i18next.t("nav.reading"),
			feeds: ctx.i18next.t("nav.feeds"),
			search: ctx.i18next.t("nav.search"),
			searchLabel: ctx.i18next.t("search.label"),
			searchPlaceholder: ctx.i18next.t("search.placeholder"),
			subscriptions: ctx.i18next.t("nav.subscriptions"),
			settings: ctx.i18next.t("nav.settings"),
			account: ctx.i18next.t("nav.account"),
			logout: ctx.i18next.t("nav.logout"),
		},
		viewer: { name: viewer.name, email: viewer.email, avatar: viewer.avatar },
		/**
		 * The count becomes the words that say it here, where the dictionary is, so the rail
		 * prints what it is handed the way every other list in this app does. A feed with
		 * nothing waiting carries no label at all: a column of zeroes down a rail is noise.
		 */
		feeds: sortByTitle(await railFeeds(viewer.id), ctx.locale).map((feed) => ({
			id: feed.id,
			title: feed.title,
			unreadCount: feed.unreadCount,
			unreadLabel:
				feed.unreadCount > 0
					? ctx.i18next.t("feeds.index.unread", { count: feed.unreadCount })
					: null,
		})),
	};
}
