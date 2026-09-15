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

/** Every method a controller may call, each one a spy answering whatever a test sets. */
export interface UserStoreDouble {
	ensureUser: ReturnType<typeof vi.fn>;
	getSettings: ReturnType<typeof vi.fn>;
	setRefreshInterval: ReturnType<typeof vi.fn>;
	listFeeds: ReturnType<typeof vi.fn>;
	getFeed: ReturnType<typeof vi.fn>;
	followFeed: ReturnType<typeof vi.fn>;
	unfollowFeed: ReturnType<typeof vi.fn>;
	readingQueue: ReturnType<typeof vi.fn>;
	feedTimeline: ReturnType<typeof vi.fn>;
	markRead: ReturnType<typeof vi.fn>;
}

/** An empty page of a timeline, which is what a store answers before anything is stored. */
export const EMPTY_TIMELINE: UserStore.TimelineResult = {
	ok: true,
	items: [],
	feeds: [],
	cursors: { next: null, prev: null },
};

/** The preferences a reader has before they change any of them. */
export const DEFAULT_SETTINGS: UserStore.Settings = {
	subject: "01J0READER0000000000000000",
	refreshIntervalHours: 1,
	lastRefreshedAt: null,
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
	return {
		ensureUser: vi.fn(async () => DEFAULT_SETTINGS),
		getSettings: vi.fn(async () => DEFAULT_SETTINGS),
		setRefreshInterval: vi.fn(async () => ({ ok: true, settings: DEFAULT_SETTINGS })),
		listFeeds: vi.fn(async () => []),
		getFeed: vi.fn(async () => null),
		followFeed: vi.fn(async () => ({ ok: false, reason: "not-found", feedId: null })),
		unfollowFeed: vi.fn(async () => true),
		readingQueue: vi.fn(async () => EMPTY_TIMELINE),
		feedTimeline: vi.fn(async () => EMPTY_TIMELINE),
		markRead: vi.fn(async () => true),
	};
}
