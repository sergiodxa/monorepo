/**
 * The chrome's own copy, the reader wearing it, and the feeds the rail lists under its
 * Feeds heading, which every signed-in page hands the layout along with what that page
 * itself shows.
 *
 * It sits beside the pages rather than inside the layout so the layout stays a thing that
 * prints what it is given, and beside all of them rather than in each so the app's sections
 * are named once however many surfaces lead back to them.
 *
 * The sidebar is on every page, so its list would be a second read of the reader's object on
 * every request — including the pages with no other reason to open it. It holds every feed
 * a reader follows, since the sidebar is now the whole of the subscription list. It is kept in
 * KV instead, holding the four fields a sidebar row draws and nothing else. A cache is a second
 * place the truth lives, so this one is written to be wrong only in ways nobody notices:
 * every change a reader makes themselves clears it as they make it, and what arrives behind
 * their back waits out {@link RAIL_TTL}. A miss, an expiry, or a KV that cannot be reached
 * all end in the same place, which is the object itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Client } from "@sdxc/flags";
import type { i18n } from "@sdxc/i18n";

import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { isFailure } from "@sdxc/result";
import { env, waitUntil } from "cloudflare:workers";

import type { AppLayout } from "~/resources/layouts/app";

import { getViewer } from "~/app/http/middleware/auth";
import { FRAME_PARAM } from "~/app/http/render";
import { features } from "~/app/lib/flags";
import { userStore } from "~/database/user-do";
import { SEARCH_PARAM } from "~/resources/layouts/app";
import routes from "~/routes/web";

/**
 * How long a reader's cached rail list stands.
 *
 * Every count the reader moves themselves is purged as they move it, so this covers only
 * what arrives while they are not looking: the posts a feed published, which are polled
 * once a day and reach the reader when they next open the reader. Minutes against a day is
 * fresh enough that a new post reaches the rail in the same sitting, and long enough that a
 * session's worth of pages costs one read rather than one per page.
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
	/** What the chrome is allowed to offer, which the request's own client answers. */
	flags: Client;
	/** Where the reader is, which is what marks the one thing in the chrome they are on. */
	url: URL;
	/** The request's language, which orders the rail's feeds by their names. */
	locale: string;
}

/**
 * One feed as the cache holds it: the four fields a sidebar row is drawn from and nothing
 * else. Anything more would make this a second copy of the subscription list, which is the
 * shape a cache rots in.
 */
export interface CachedFeed {
	id: string;
	title: string;
	unreadCount: number;
	/** The mark the publisher puts on their own feed, or `null` for one that puts none. */
	imageUrl: string | null;
	/** The folder it is filed in, or `null` for a feed the reader has not filed. */
	folderId: string | null;
	/**
	 * That folder's name, carried here beside the id so the rail draws its headings from
	 * the list it already holds rather than reading the folders a second time.
	 */
	folderTitle: string | null;
}

/**
 * One folder as the rail draws it: the feeds filed there and what they add up to.
 *
 * The count is the sum of the counts beneath it rather than a number of its own, so a
 * heading showing eleven shows it because the rows under it show four, three, three and
 * one — there is no second query to disagree with them.
 */
export interface RailFolder {
	id: string;
	title: string;
	feeds: CachedFeed[];
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
 * @returns Every feed the reader follows, or none of them when neither the cache nor the
 * object answers, since a rail missing its list is a page a reader can still read and act on.
 */
export async function railFeeds(subject: string): Promise<CachedFeed[]> {
	let cached = await railCache().fetch<CachedFeed[]>(
		railKey(subject),
		async () => {
			let followed = await userStore(subject).listFeeds();

			return followed.map((feed) => ({
				id: feed.id,
				title: feed.title,
				unreadCount: feed.unreadCount,
				imageUrl: feed.imageUrl,
				folderId: feed.folderId,
				folderTitle: feed.folderTitle,
			}));
		},
		{ ttl: RAIL_TTL },
	);

	if (isFailure(cached)) return [];

	/**
	 * Read field by field rather than trusted whole: an entry written before a field was
	 * added is still in KV until it expires, and a row drawn from one is a row a reader
	 * sees. Anything the entry does not carry reads as a feed without it.
	 */
	return cached.data.map((feed) => ({
		id: feed.id,
		title: feed.title,
		unreadCount: feed.unreadCount,
		imageUrl: typeof feed.imageUrl === "string" ? feed.imageUrl : null,
		folderId: typeof feed.folderId === "string" ? feed.folderId : null,
		folderTitle: typeof feed.folderTitle === "string" ? feed.folderTitle : null,
	}));
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
export function sortByTitle(feeds: CachedFeed[], locale: string): CachedFeed[] {
	let collator = new Intl.Collator(locale);
	return [...feeds].sort((one, other) => collator.compare(one.title, other.title));
}

/**
 * The rail's folders, each holding the feeds filed in it, in the order their names read.
 *
 * Both the grouping and the counts come off the list the request already holds, so drawing
 * the rail under folder names costs the same read it costs without them. A folder nothing
 * is filed in has no row here, since what a folder draws is the feeds beneath it.
 *
 * @param feeds - The feeds as they were cached or read.
 * @param locale - The request's language, which orders the names.
 * @returns The folders, and the feeds left unfiled, which the rail draws below them.
 */
export function groupByFolder(
	feeds: CachedFeed[],
	locale: string,
): { folders: RailFolder[]; unfiled: CachedFeed[] } {
	let byId = new Map<string, RailFolder>();
	let unfiled: CachedFeed[] = [];

	for (let feed of sortByTitle(feeds, locale)) {
		if (feed.folderId === null) {
			unfiled.push(feed);
			continue;
		}

		let folder = byId.get(feed.folderId) ?? {
			id: feed.folderId,
			/** A feed cached before the name was carried names its folder by nothing else. */
			title: feed.folderTitle ?? feed.folderId,
			feeds: [],
			unreadCount: 0,
		};

		folder.feeds.push(feed);
		folder.unreadCount += feed.unreadCount;
		byId.set(feed.folderId, folder);
	}

	let collator = new Intl.Collator(locale);
	let folders = [...byId.values()].sort((one, other) => collator.compare(one.title, other.title));

	return { folders, unfiled };
}

/**
 * What {@link FRAME_PARAM} carries for the sidebar's feed band, which says the answer is
 * that band rather than a page.
 */
const FRAME_FEEDS = "feeds";

/**
 * The parameter the band's address carries beside it, naming the page the sidebar is being
 * drawn beside. The band is fetched on its own, so which of its rows to light is the one
 * thing it cannot work out from its own address.
 */
export const SIDEBAR_PATH_PARAM = "on";

/**
 * Where the sidebar's feed band is fetched from while a reader is on `currentPath`.
 *
 * @param currentPath - The page the sidebar is drawn beside, which lights one of its rows.
 */
export function sidebarFeedsSrc(currentPath: string): string {
	let params = new URLSearchParams({
		[FRAME_PARAM]: FRAME_FEEDS,
		[SIDEBAR_PATH_PARAM]: currentPath,
	});

	return `${routes.sidebar.feeds.href()}?${params}`;
}

/**
 * The sections' names, the signed-in reader, and where the sidebar's feed band is fetched
 * from, spread into the layout by every page that wears it.
 *
 * The feeds themselves are not here: they are drawn into a frame of their own, so a count
 * beside a feed's name can be redrawn when the reader marks a post read several pages into
 * a queue, without fetching the page they are standing on.
 *
 * @param ctx - The request, for the dictionary the names are read from.
 * @returns Every prop the layout's own chrome is drawn from, ready to spread.
 * @throws If nobody is signed in, which `requireUser` answers for before a page renders.
 */
export async function chrome(ctx: ChromeContext): Promise<{
	nav: AppLayout.Nav;
	viewer: AppLayout.Viewer;
	sidebarFeedsSrc: string;
	currentPath: string;
	searchQuery: string;
}> {
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before a page renders its chrome");

	/** A sidebar naming a list nothing can put a post into is a door onto an empty room. */
	let saving = await ctx.flags.get(features.savedPosts);

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
			saved: saving ? ctx.i18next.t("nav.saved") : null,
			searchLabel: ctx.i18next.t("search.label"),
			searchPlaceholder: ctx.i18next.t("search.placeholder"),
			openSidebar: ctx.i18next.t("nav.openSidebar"),
			settings: ctx.i18next.t("nav.settings"),
			account: ctx.i18next.t("nav.account"),
			logout: ctx.i18next.t("nav.logout"),
		},
		viewer: { name: viewer.name, email: viewer.email, avatar: viewer.avatar },
		sidebarFeedsSrc: sidebarFeedsSrc(ctx.url.pathname),
	};
}
