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
	openPost: ReturnType<typeof vi.fn>;
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
	listRules: ReturnType<typeof vi.fn>;
	listSearches: ReturnType<typeof vi.fn>;
	getSearch: ReturnType<typeof vi.fn>;
	createSearch: ReturnType<typeof vi.fn>;
	updateSearch: ReturnType<typeof vi.fn>;
	deleteSearch: ReturnType<typeof vi.fn>;
	getRule: ReturnType<typeof vi.fn>;
	createRule: ReturnType<typeof vi.fn>;
	updateRule: ReturnType<typeof vi.fn>;
	deleteRule: ReturnType<typeof vi.fn>;
	previewRule: ReturnType<typeof vi.fn>;
	applyPreviewedRule: ReturnType<typeof vi.fn>;
	pinFeed: ReturnType<typeof vi.fn>;
	pinnedStrip: ReturnType<typeof vi.fn>;
	recordPublishingRate: ReturnType<typeof vi.fn>;
	notifications: ReturnType<typeof vi.fn>;
	setChannels: ReturnType<typeof vi.fn>;
	setQuietHours: ReturnType<typeof vi.fn>;
	setTimeZone: ReturnType<typeof vi.fn>;
	registerDevice: ReturnType<typeof vi.fn>;
	forgetDevice: ReturnType<typeof vi.fn>;
	setFeedNotify: ReturnType<typeof vi.fn>;
}

/** An empty page of a timeline, which is what a store answers before anything is stored. */
export const EMPTY_TIMELINE: UserStore.TimelineResult = {
	ok: true,
	items: [],
	feeds: [],
	cursors: { next: null, prev: null },
	search: null,
};

/** No subscriptions, which is what a store answers before anything is followed. */
export const NO_FEEDS: UserStore.FeedSummary[] = [];

/** No folders, which is what a store answers before a reader has filed anything. */
export const NO_FOLDERS: UserStore.Folder[] = [];

/** No labels, which is what a store answers before a reader has made one. */
export const NO_TAGS: UserStore.Tag[] = [];

/** No filters, which is what a store answers before a reader has written one. */
export const NO_RULES: UserStore.Rule[] = [];

/** No kept queries, which is what a store answers before a reader has saved one. */
export const NO_SEARCHES: UserStore.SavedSearch[] = [];

/** A preview that caught nothing, over an object holding nothing to catch. */
export const EMPTY_PREVIEW: UserStore.RulePreview = {
	ok: true,
	scanned: 0,
	matched: 0,
	items: [],
	feeds: [],
};

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

/** Nothing configured, which is what a reader who has never asked to be notified holds. */
export const NO_NOTIFICATIONS: UserStore.Notifications = {
	push: false,
	email: false,
	emailAllowed: false,
	address: null,
	timeZone: "UTC",
	quietHours: false,
	quietFrom: 22,
	quietTo: 7,
	feeds: 0,
	devices: [],
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
		openPost: vi.fn(async () => null),
		listTags: vi.fn(async () => NO_TAGS),
		getTag: vi.fn(async () => null),
		createTag: vi.fn(async () => ({ ok: false, reason: "tag-name-invalid" })),
		renameTag: vi.fn(async () => ({ ok: false, reason: "not-found" })),
		deleteTag: vi.fn(async () => ({ ok: false, reason: "not-found" })),
		tagItem: vi.fn(async () => ({ ok: false, reason: "not-found" })),
		untagItem: vi.fn(async () => ({ ok: true, removed: false })),
		taggedQueue: vi.fn(async () => EMPTY_TIMELINE),
		listRules: vi.fn(async () => NO_RULES),
		listSearches: vi.fn(async () => NO_SEARCHES),
		getSearch: vi.fn(async () => null),
		createSearch: vi.fn(async () => ({ ok: false, reason: "invalid-name" })),
		updateSearch: vi.fn(async () => ({ ok: false, reason: "not-found" })),
		deleteSearch: vi.fn(async () => ({ ok: false, reason: "not-found" })),
		getRule: vi.fn(async () => null),
		createRule: vi.fn(async () => ({ ok: false, reason: "invalid-value" })),
		updateRule: vi.fn(async () => ({ ok: false, reason: "not-found" })),
		deleteRule: vi.fn(async () => ({ ok: false, reason: "not-found" })),
		previewRule: vi.fn(async () => EMPTY_PREVIEW),
		applyPreviewedRule: vi.fn(async () => ({ ok: true, scanned: 0, matched: 0, affected: 0 })),
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
		notifications: vi.fn(async () => NO_NOTIFICATIONS),
		setChannels: vi.fn(async () => ({ ok: true, notifications: NO_NOTIFICATIONS })),
		setQuietHours: vi.fn(async () => NO_NOTIFICATIONS),
		setTimeZone: vi.fn(async () => false),
		registerDevice: vi.fn(async () => ({ devices: 1 })),
		forgetDevice: vi.fn(async () => true),
		setFeedNotify: vi.fn(async () => ({ ok: true, notify: true })),
	};
}
