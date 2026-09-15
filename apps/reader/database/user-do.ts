/**
 * The per-reader Durable Object and the typed surface the Worker reaches it through. One
 * object holds one person's settings, the feeds they follow and every post from them, so
 * the reading queue is a single indexed query over their own rows rather than a merge
 * across feeds, and the refresh schedule lives beside the data it refreshes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DurableObject, env } from "cloudflare:workers";

import type { FeedStatus, RefreshIntervalHours } from "~/database/schema";

/**
 * The values that cross the RPC boundary, and the shapes a controller renders from.
 *
 * Three rules govern everything here. No `Result` crosses: it is structured-cloneable,
 * but the platform serializes an `Error` by name and message and drops the subclass, so
 * an `instanceof` check is always false on the far side. No `Date` crosses, for the same
 * reason every stored timestamp is an integer. And every failure is a discriminated
 * union the caller can switch on, narrowed on this side of the boundary.
 */
export namespace UserStore {
	/** A reader's preferences, as one row of `settings` reads. */
	export interface Settings {
		subject: string;
		refreshIntervalHours: RefreshIntervalHours;
		/** Epoch milliseconds of the last refresh run, or `null` before the first one. */
		lastRefreshedAt: number | null;
	}

	/** A followed feed, with the unread count the feed list shows beside it. */
	export interface FeedSummary {
		id: string;
		feedUrl: string;
		siteUrl: string | null;
		title: string;
		description: string | null;
		imageUrl: string | null;
		lastFetchedAt: number | null;
		lastStatus: FeedStatus | null;
		/** Consecutive failed refreshes, reset by any success including a 304. */
		failureCount: number;
		unreadCount: number;
	}

	/**
	 * The feed one timeline item came from, carried alongside the items rather than
	 * joined into them: a join would qualify the ordering columns, and a cursor records
	 * the exact column names it was minted for.
	 */
	export interface FeedRef {
		id: string;
		title: string;
		siteUrl: string | null;
	}

	/** One post, with the fields a list renders. The body is left in the database. */
	export interface Item {
		id: string;
		feedId: string;
		title: string;
		url: string | null;
		summary: string | null;
		author: string | null;
		publishedAt: number;
		readAt: number | null;
	}

	/** Where in a timeline to read from, and how much of it. */
	export interface TimelineOptions {
		/** An opaque keyset cursor carrying its own direction, or `null` for the first page. */
		cursor?: string | null;
		limit?: number;
	}

	/**
	 * One page of a timeline. A cursor that no longer decodes is reported rather than
	 * silently answered with the first page, which would look to a reader like their
	 * place was lost without saying so.
	 */
	export type TimelineResult =
		| {
				ok: true;
				items: Item[];
				/** Every feed the returned items came from, for labelling them. */
				feeds: FeedRef[];
				cursors: { next: string | null; prev: string | null };
		  }
		| { ok: false; reason: "bad-cursor" };

	/** Why a URL somebody pasted did not become a subscription. */
	export type FollowFailure =
		/** Not a URL, or not one with an HTTP scheme. */
		| "invalid-url"
		/** Reached, but it advertises no RSS or Atom feed. */
		| "not-found"
		/** The origin refused, timed out, or answered with an error status. */
		| "unreachable"
		/** Already followed; `feedId` names the existing subscription. */
		| "already-following";

	export type FollowResult =
		| { ok: true; feed: FeedSummary; items: number }
		| { ok: false; reason: FollowFailure; feedId: string | null };

	/** Setting a cadence the `CHECK` constraint would refuse is reported, never thrown. */
	export type IntervalResult =
		| { ok: true; settings: Settings }
		| { ok: false; reason: "invalid-interval" };
}

/**
 * One reader's storage, addressed by their OIDC subject. Every method is RPC: the Worker
 * renders the HTML and this object answers with data, so it stays a store rather than a
 * nested application.
 */
export class UserDO extends DurableObject<Cloudflare.Env> {
	/**
	 * Creates the reader's row if this is their first sign-in, and arms the refresh
	 * schedule. Idempotent, because it runs on every completed sign-in rather than once:
	 * there is no user table and no sign-up step, so a first login is what creates a
	 * reader.
	 */
	ensureUser(_subject: string): Promise<UserStore.Settings> {
		throw new Error("UserDO.ensureUser is not implemented");
	}

	/** The reader's preferences, or `null` for an object no sign-in has reached yet. */
	getSettings(): Promise<UserStore.Settings | null> {
		throw new Error("UserDO.getSettings is not implemented");
	}

	/**
	 * Changes the refresh cadence and re-arms the alarm unconditionally, so somebody
	 * moving from daily to hourly waits an hour rather than out the rest of the day.
	 */
	setRefreshInterval(_hours: number): Promise<UserStore.IntervalResult> {
		throw new Error("UserDO.setRefreshInterval is not implemented");
	}

	/** Every followed feed, newest subscription first, each with its unread count. */
	listFeeds(): Promise<UserStore.FeedSummary[]> {
		throw new Error("UserDO.listFeeds is not implemented");
	}

	/** One followed feed, or `null` when this reader does not follow it. */
	getFeed(_feedId: string): Promise<UserStore.FeedSummary | null> {
		throw new Error("UserDO.getFeed is not implemented");
	}

	/**
	 * Subscribes to whatever feed `input` leads to, accepting either a feed URL or a page
	 * that advertises one, and stores the posts it carries so the queue is never empty
	 * the moment a feed is followed.
	 */
	followFeed(_input: string): Promise<UserStore.FollowResult> {
		throw new Error("UserDO.followFeed is not implemented");
	}

	/** Drops a subscription and every post behind it. `false` when it was not followed. */
	unfollowFeed(_feedId: string): Promise<boolean> {
		throw new Error("UserDO.unfollowFeed is not implemented");
	}

	/** The unread posts across every followed feed, newest first. */
	readingQueue(_options?: UserStore.TimelineOptions): Promise<UserStore.TimelineResult> {
		throw new Error("UserDO.readingQueue is not implemented");
	}

	/** One feed's posts, read and unread alike, newest first. */
	feedTimeline(
		_feedId: string,
		_options?: UserStore.TimelineOptions,
	): Promise<UserStore.TimelineResult> {
		throw new Error("UserDO.feedTimeline is not implemented");
	}

	/** Marks one post read or unread. `false` when no such post is stored. */
	markRead(_itemId: string, _read?: boolean): Promise<boolean> {
		throw new Error("UserDO.markRead is not implemented");
	}

	/**
	 * Refreshes whatever feeds are due and re-arms the schedule.
	 *
	 * It never rejects. A rejected alarm is retried by the platform, which would re-fetch
	 * every feed because one origin was down, repeatedly, against origins that already
	 * answered.
	 */
	override alarm(): Promise<void> {
		throw new Error("UserDO.alarm is not implemented");
	}
}

/**
 * The storage for one reader, addressed by the OIDC subject rather than the email, which
 * can be reassigned to another person — and renaming a Durable Object strands its storage.
 *
 * @param subject - The signed-in reader's OIDC `sub` claim.
 * @example let feeds = await userStore(viewer.id).listFeeds();
 */
export function userStore(subject: string): DurableObjectStub<UserDO> {
	return env.USER.getByName(subject);
}
