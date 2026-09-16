/**
 * A stand-in for a reader's Durable Object, so a controller test says what the store
 * answers and asserts what the controller asked it — without a Durable Object, a
 * database, or a feed to fetch.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vi } from "vitest";

import type { UserStore } from "~/database/user-do";

import { TIER_LIMITS } from "~/app/lib/entitlement";

/** Every method a controller may call, each one a spy answering whatever a test sets. */
export interface UserStoreDouble {
	ensureUser: ReturnType<typeof vi.fn>;
	getSettings: ReturnType<typeof vi.fn>;
	entitlement: ReturnType<typeof vi.fn>;
	setTier: ReturnType<typeof vi.fn>;
	listFeeds: ReturnType<typeof vi.fn>;
	countFeeds: ReturnType<typeof vi.fn>;
	checkAllFeedsNow: ReturnType<typeof vi.fn>;
	markFeedRead: ReturnType<typeof vi.fn>;
	markAllRead: ReturnType<typeof vi.fn>;
	exportFeeds: ReturnType<typeof vi.fn>;
	importFeeds: ReturnType<typeof vi.fn>;
	getFeed: ReturnType<typeof vi.fn>;
	followFeed: ReturnType<typeof vi.fn>;
	unfollowFeed: ReturnType<typeof vi.fn>;
	checkFeedNow: ReturnType<typeof vi.fn>;
	readingQueue: ReturnType<typeof vi.fn>;
	feedTimeline: ReturnType<typeof vi.fn>;
	markRead: ReturnType<typeof vi.fn>;
	openReader: ReturnType<typeof vi.fn>;
	synchronize: ReturnType<typeof vi.fn>;
	setVelocity: ReturnType<typeof vi.fn>;
	saveItem: ReturnType<typeof vi.fn>;
	savedQueue: ReturnType<typeof vi.fn>;
	listFolders: ReturnType<typeof vi.fn>;
	getFolder: ReturnType<typeof vi.fn>;
	createFolder: ReturnType<typeof vi.fn>;
	renameFolder: ReturnType<typeof vi.fn>;
	deleteFolder: ReturnType<typeof vi.fn>;
	fileFeed: ReturnType<typeof vi.fn>;
	folderTimeline: ReturnType<typeof vi.fn>;
	listTags: ReturnType<typeof vi.fn>;
	getTag: ReturnType<typeof vi.fn>;
	createTag: ReturnType<typeof vi.fn>;
	renameTag: ReturnType<typeof vi.fn>;
	deleteTag: ReturnType<typeof vi.fn>;
	tagItem: ReturnType<typeof vi.fn>;
	untagItem: ReturnType<typeof vi.fn>;
	taggedQueue: ReturnType<typeof vi.fn>;
	pinFeed: ReturnType<typeof vi.fn>;
	pinnedStrip: ReturnType<typeof vi.fn>;
	recordPublishingRate: ReturnType<typeof vi.fn>;
}

/** An empty page of a timeline, which is what a store answers before anything is stored. */
export const EMPTY_TIMELINE: UserStore.TimelineResult = {
	ok: true,
	items: [],
	feeds: [],
	cursors: { next: null, prev: null },
};

/** No subscriptions, which is what a store answers before anything is followed. */
export const NO_FEEDS: UserStore.FeedSummary[] = [];

/** No folders, which is what a store answers before a reader has filed anything. */
export const NO_FOLDERS: UserStore.Folder[] = [];

/** No labels, which is what a store answers before a reader has made one. */
export const NO_TAGS: UserStore.Tag[] = [];

/** Nothing pinned, which is what a reader opens to before they pin anything. */
export const NO_PINS: UserStore.PinnedFeed[] = [];

/** The preferences a reader has before they change any of them. */
export const DEFAULT_SETTINGS: UserStore.Settings = {
	subject: "01J0READER0000000000000000",
	lastRefreshedAt: null,
	tier: "free",
	tierSource: "default",
	graceUntil: null,
	tierCheckedAt: 0,
};

/** Nothing waiting above any cursor, which is what a reader who is current opens to. */
export const NOTHING_STALE: UserStore.Freshness = { stale: [], count: 0 };

/** A reader on the free tier, inside every limit, which is who a page renders for. */
export const FREE_ENTITLEMENT: UserStore.Entitlement = {
	tier: "free",
	source: "default",
	graceUntil: null,
	tierCheckedAt: 0,
	limits: TIER_LIMITS.free,
	over: [],
	feeds: 0,
	saved: 0,
	posts: 0,
};

/**
 * Builds the store double, every method answering the emptiest valid value so a test
 * overrides only what it is about.
 *
 * @example
 * let store = createUserStoreDouble();
 * vi.doMock("~/database/user-do", () => ({ userStore: () => store }));
 */
export function createUserStoreDouble(): UserStoreDouble {
	/**
	 * Held apart from the rest so opening the reader can answer through it, the way the
	 * object does: a test says what a page holds once, and both the surface that opens the
	 * reader and the frame that pages it read that answer.
	 */
	let readingQueue = vi.fn(
		async (_options: UserStore.ReadingQueueOptions = {}): Promise<UserStore.TimelineResult> =>
			EMPTY_TIMELINE,
	);

	return {
		ensureUser: vi.fn(async () => DEFAULT_SETTINGS),
		getSettings: vi.fn(async () => DEFAULT_SETTINGS),
		entitlement: vi.fn(async () => FREE_ENTITLEMENT),
		setTier: vi.fn(async () => ({ ok: true, from: "free", to: "free", graceUntil: null })),
		listFeeds: vi.fn(async () => NO_FEEDS),
		countFeeds: vi.fn(async () => 0),
		checkAllFeedsNow: vi.fn(async () => ({
			checked: 0,
			withNewPosts: 0,
			inserted: 0,
			failed: 0,
		})),
		markFeedRead: vi.fn(async () => 0),
		markAllRead: vi.fn(async () => 0),
		exportFeeds: vi.fn(async () => []),
		importFeeds: vi.fn(async () => ({ added: 0, alreadyFollowing: 0, failed: [] })),
		getFeed: vi.fn(async () => null),
		followFeed: vi.fn(async () => ({ ok: false, reason: "not-found", feedId: null })),
		unfollowFeed: vi.fn(async () => true),
		checkFeedNow: vi.fn(async () => ({ ok: false, reason: "not-following" })),
		readingQueue,
		feedTimeline: vi.fn(async () => EMPTY_TIMELINE),
		markRead: vi.fn(async () => true),
		/** Nothing waiting, which is what a reader who is current opens to. */
		openReader: vi.fn(async (options: UserStore.ReadingQueueOptions = {}) => ({
			timeline: await readingQueue(options),
			freshness: NOTHING_STALE,
		})),
		synchronize: vi.fn(async () => ({ synchronized: 0, items: 0, remaining: 0, paused: 0 })),
		setVelocity: vi.fn(async () => ({ ok: false, reason: "not-following" })),
		saveItem: vi.fn(async () => ({ ok: true, saved: true })),
		listTags: vi.fn(async () => NO_TAGS),
		getTag: vi.fn(async () => null),
		createTag: vi.fn(async () => ({ ok: false, reason: "tag-name-invalid" })),
		renameTag: vi.fn(async () => ({ ok: false, reason: "not-found" })),
		deleteTag: vi.fn(async () => ({ ok: false, reason: "not-found" })),
		tagItem: vi.fn(async () => ({ ok: false, reason: "not-found" })),
		untagItem: vi.fn(async () => ({ ok: true, removed: false })),
		taggedQueue: vi.fn(async () => EMPTY_TIMELINE),
		pinFeed: vi.fn(async () => ({ ok: false, reason: "not-following" })),
		pinnedStrip: vi.fn(async () => NO_PINS),
		recordPublishingRate: vi.fn(async () => undefined),
		savedQueue: vi.fn(async () => EMPTY_TIMELINE),
		listFolders: vi.fn(async () => NO_FOLDERS),
		getFolder: vi.fn(async () => null),
		createFolder: vi.fn(async () => ({ ok: false, reason: "invalid-title" })),
		renameFolder: vi.fn(async () => ({ ok: false, reason: "not-found" })),
		deleteFolder: vi.fn(async () => ({ ok: false, reason: "not-found" })),
		fileFeed: vi.fn(async () => ({ ok: false, reason: "not-following" })),
		folderTimeline: vi.fn(async () => EMPTY_TIMELINE),
	};
}
