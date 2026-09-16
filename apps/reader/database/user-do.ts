/**
 * The per-reader Durable Object and the typed surface the Worker reaches it through. One
 * object holds one person's settings, the feeds they follow and their own copy of every
 * post from them, so the reading queue is a single indexed query over their own rows
 * rather than a merge across feeds.
 *
 * It fetches nothing. A feed is retrieved once, by the object named after that feed, and
 * what this holds is a projection of it: the items this reader has ruled on, in the order
 * their timeline reads. The two are joined by a cursor — the greatest revision this reader
 * has accounted for — and a reader finds out there is more by comparing that against the
 * head the feed publishes, rather than by being told.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Log } from "@sdxc/logger";
import type { KeysetQuery, OrderByTuple, OrderDirection } from "@sdxc/pagination";
import type { Predicate, SqlStatement } from "remix/data-table";

import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { Feed } from "@sdxc/feed";
import { Mailer } from "@sdxc/mail";
import { CloudflareTransport } from "@sdxc/mail/cloudflare";
import { decodeCursor, encodeCursor, InvalidCursorError, Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { TypeID } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";
import { DurableObject, env } from "cloudflare:workers";
import {
	and,
	Database,
	getTableColumns,
	inList,
	isNull,
	lt,
	notNull,
	rawSql,
	sql,
} from "remix/data-table";

import type { LimitRefusal, Tier, TierLimits, TierSource } from "~/app/lib/entitlement";
import type { FeedStore } from "~/database/feed-do";
import type {
	RuleAction,
	RuleField,
	SelectFeed,
	SelectFeedItem,
	SelectFolder,
	SelectPushSubscription,
	SelectRule,
	SelectSearch,
	SelectSettings,
	SelectTag,
	ReadingFace,
	Theme,
	Velocity,
} from "~/database/schema";

import {
	DEFAULT_TIER,
	DEFAULT_TIER_SOURCE,
	effectiveTier,
	isTier,
	isTierSource,
	limitRefusal,
	limitsOf,
	searchFloor,
	tierRank,
	withinLimit,
} from "~/app/lib/entitlement";
import { features, flagsFor } from "~/app/lib/flags";
import {
	foldRuleText,
	foldRuleValue,
	isRuleAction,
	isRuleField,
	matchesRule,
} from "~/app/lib/rule-match";
import {
	checkIntervalFor,
	dormancyMultiplier,
	earliestDue,
	nextCheckAt,
	SWEEP_INTERVAL_MS,
} from "~/app/lib/schedule";
import { foldTagName } from "~/app/lib/tag-name";
import { logger } from "~/bootstrap/logger";
import { feedStore } from "~/database/feed-do";
import { KEYS_PER_BULK_READ, readHeads } from "~/database/feed-head";
import { runMigrations } from "~/database/migrations";
import { countNotifiedFeeds, notify } from "~/database/notify";
import { chunked, insertChunkSize } from "~/database/refresh";
import { registerFeed } from "~/database/registry";
import {
	DEFAULT_READING_FACE,
	DEFAULT_THEME,
	DEFAULT_VELOCITY,
	feedItems,
	feeds,
	folders,
	itemTags,
	PIN_LIMIT,
	pushSubscriptions,
	QUIET_FROM_HOUR,
	QUIET_TO_HOUR,
	RULE_PREVIEW_POSTS,
	rules,
	SAVED_SEARCH_LIMIT,
	SEARCH_NAME_LENGTH,
	READING_FACES,
	SEARCH_READ_STATES,
	searches,
	settings,
	THEMES,
	TAG_LIMIT,
	tags,
	TAGS_PER_ITEM,
	VELOCITIES,
	VELOCITY_WINDOW_MS,
} from "~/database/schema";

/** The row `settings` holds, which the `CHECK` on its primary key keeps to exactly one. */
const SETTINGS_ID = 1;

/**
 * Feeds one request synchronizes behind the page it has already answered. A reader back
 * after a month with two hundred stale feeds gets their timeline first, the most useful of
 * those feeds behind it, and the rest over the following minutes.
 */
const SYNC_FEEDS_PER_REQUEST = 8;

/** Feeds synchronized at once, so one slow object does not pace the rest of the batch. */
const SYNC_CONCURRENCY = 4;

/** Pages of one feed a single run walks, so no feed can hold the object indefinitely. */
const SYNC_PAGES_PER_FEED = 5;

/**
 * How long the catch-up alarm waits before carrying on with whatever a run left behind.
 * A minute rather than an interval, because leftover work is work a reader is waiting for.
 */
const CATCH_UP_MS = 60 * 1000;

/** Posts a timeline page holds when the caller names no limit. */
const DEFAULT_PAGE_LIMIT = 50;

/** The largest page a caller may ask for, so one call cannot read the whole timeline. */
const MAX_PAGE_LIMIT = 100;

/** Ids one `IN` list carries, held under the same 100-parameter ceiling. */
const IDS_PER_LOOKUP = 90;

/**
 * Unread posts the strip shows per pinned feed. Enough to say a publication has moved
 * without a busy pin burying a quiet one, since the strip sits above the river rather
 * than becoming the page.
 */
const PINNED_POSTS = 3;

/**
 * The ordering both timelines read in, spelled once and shared. A cursor records the
 * exact column names it was minted for, so a page minted under one spelling of this
 * ordering cannot be followed under another.
 */
const NEWEST_FIRST = [
	["published_at", "desc"],
	["id", "desc"],
] as const;

/**
 * Feeds one on-demand run talks to at once. It paces a run by the slowest origin rather
 * than by the sum of them, while keeping a reader's object, which has one thread, from
 * opening a socket per feed — the same bound the scheduled refresh works under.
 */
const ON_DEMAND_CONCURRENCY = 6;

/**
 * The character that takes a wildcard's meaning away inside a `LIKE` pattern, so a reader
 * searching for a title holding `%` or `_` is looking for those characters.
 */
const LIKE_ESCAPE = "\\";

/** A day in milliseconds, which is what a search window and a search step are counted in. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The id a step's boundary cursor carries. Both ordering columns descend, so an id no
 * stored id sorts below leaves the next step resuming strictly under the floor — which is
 * exactly where the step that minted it stopped looking.
 */
const BELOW_EVERY_ID = "";

/**
 * The comparisons a keyset seek is spelled with, which is the whole grammar
 * {@link Pagination.byKeyset} builds out of an ordering and hands to a query.
 */
const SEEK_OPERATORS: Record<string, string> = { eq: "=", gt: ">", lt: "<" };

/**
 * Unread posts per feed, as the feed list shows them. `feed_items_feed_timeline_idx` leads
 * with `feed_id`, so rows arrive already gathered by the column this groups on and nothing
 * has to stand in for that order; the unread index holds exactly the rows being counted and
 * still loses, because it leads with `published_at`, the order the timeline reads in.
 */
const UNREAD_COUNTS_SQL =
	"SELECT feed_id, COUNT(*) AS unread FROM feed_items WHERE read_at IS NULL GROUP BY feed_id";

/**
 * The columns a timeline page reads. Both ordering columns stay in it, since the cursor
 * is minted by reading the sort values off the row that came back, and the body stays out
 * of it, since a list renders none of it.
 */
type TimelineRow = Pick<
	SelectFeedItem,
	| "id"
	| "feed_id"
	| "title"
	| "url"
	| "summary"
	| "author"
	| "published_at"
	| "read_at"
	| "saved_at"
	| "flagged_at"
>;

/**
 * The rules one synchronization run evaluates, and what each of them has matched so far in
 * it. The table is read once for the run rather than once per item, and the counts are held
 * here until the run ends, so fifty rules cost at most fifty small updates however many
 * items arrived.
 */
interface RuleRun {
	rules: SelectRule[];
	/** Items each rule decided, by rule id, counted as the run goes. */
	matched: Map<string, number>;
}

/** What one page of arriving items became, which is what a run counts itself by. */
interface Materialized {
	/** Items written as this reader's own copies. */
	written: number;
	/** Items refused for being older than the subscription's velocity. */
	skipped: number;
	/** Items a rule decided, dropped and written alike. */
	ruled: number;
}

/** What every matching rule together says about one arriving item. */
interface RuleVerdict {
	drop: boolean;
	read: boolean;
	flag: boolean;
}

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
		/** Epoch milliseconds of the last synchronization, or `null` before the first one. */
		lastRefreshedAt: number | null;
		/** What every limit check on this object compares against. */
		tier: Tier;
		/** Whether the platform put the tier there or a person did. */
		tierSource: TierSource;
		/** When the lapse window runs out, or `null` while the reader has not lapsed. */
		graceUntil: number | null;
		/** Epoch milliseconds a snapshot last confirmed the tier, and `0` before the first. */
		tierCheckedAt: number;
		/**
		 * How the reader's pages are painted. It rides along with the rest of the row because
		 * the two paths that read it — the settings page and the sign-in callback — are asking
		 * for the row anyway, and both reconcile the cookie against what comes back.
		 */
		presentation: Presentation;
	}

	/**
	 * What a reader may change about how their pages look, as one row of `settings` reads.
	 *
	 * It is two fields rather than a whole settings object because the document shell asks
	 * for it on every page the reader is signed in on, and because it is what the cookie
	 * carrying the answer to the first paint holds.
	 */
	export interface Presentation {
		/** The scheme every page is painted in, in the vocabulary `<html>` wears. */
		theme: Theme;
		/** The face a post's title and its words are set in, which never reaches the chrome. */
		face: ReadingFace;
	}

	/** What the platform says a reader holds, as the one writer of the tier takes it. */
	export interface TierSnapshot {
		/** The tier the snapshot's settled products grant. */
		entitled: Tier;
		/** Whether the reader asked for the subscription to stop renewing. */
		cancelled: boolean;
		/** Epoch milliseconds the platform answered at. */
		readAt: number;
		/** Whether this snapshot speaks for the platform or for a person. */
		source: TierSource;
	}

	/** What a snapshot did to the stored tier, or why it left it alone. */
	export type TierResult =
		| { ok: true; from: Tier; to: Tier; graceUntil: number | null }
		| {
				ok: false;
				/**
				 * `stale` for a snapshot read before the stored one, so the later read wins
				 * whichever write arrives second; `granted` for a tier a person put there,
				 * which the platform is not allowed to lower.
				 */
				reason: "stale" | "granted";
				tier: Tier;
				graceUntil: number | null;
		  };

	/** What a limit refused, as a caller renders the sentence about it. */
	export type Limit = LimitRefusal;

	/** What the reader is entitled to, and where they stand against it. */
	export interface Entitlement {
		tier: Tier;
		source: TierSource;
		graceUntil: number | null;
		tierCheckedAt: number;
		limits: TierLimits;
		/** Every limit the reader is over, with how many they hold and how many they may. */
		over: LimitRefusal[];
		/** How many feeds they follow. */
		feeds: number;
		/** How many posts they have saved. */
		saved: number;
		/** How many posts their object holds. */
		posts: number;
	}

	/** A followed feed, with the unread count the feed list shows beside it. */
	export interface FeedSummary {
		/** This app's own handle for the subscription, which its URLs are built from. */
		id: string;
		/** The feed itself, which names the object holding it and the head it publishes. */
		feedId: string;
		feedUrl: string;
		siteUrl: string | null;
		title: string;
		description: string | null;
		imageUrl: string | null;
		/** How long a post from this feed stays in this reader's timeline. */
		velocity: Velocity;
		unreadCount: number;
		/** The group the reader filed it into, or `null` for a subscription they have not. */
		folderId: string | null;
		/** That group's name, carried beside the id so a rail draws it without a second read. */
		folderTitle: string | null;
		/** When the reader pinned it, or `null` for a subscription they have not pinned. */
		pinnedAt: number | null;
		/** Whether a scheduled check that finds posts here is worth interrupting them for. */
		notify: boolean;
		/**
		 * Whether this feed's links are rendered with the address exactly as the publisher
		 * wrote it, rather than with its campaign metadata and click identifiers removed.
		 */
		keepLinkParameters: boolean;
		/**
		 * What the feed publishes, in posts per day, as the feed's own object measured it,
		 * or `null` before any conversation with that object has reported one.
		 */
		postsPerDay: number | null;
	}

	/** One of the reader's labels, which is the whole of what a tag is. */
	export interface Tag {
		id: string;
		/** The name as the reader typed it, which is the one drawn. */
		name: string;
		/** The case-folded form uniqueness and matching are taken over. */
		slug: string;
	}

	/** Why a label was not made, renamed, applied or found. */
	export type TagFailure =
		/** No label or post of the reader's has that id. */
		| "not-found"
		/** The reader already has as many labels as this holds. */
		| "tag-limit"
		/** The name was empty, too long, or held characters no chip could draw. */
		| "tag-name-invalid"
		/** Another label of theirs already reads under that name. */
		| "tag-exists"
		/** The post already carries as many labels as one post may. */
		| "post-tag-limit"
		/** Labelling keeps the post, and the shelf that keeps it is full. */
		| "saved-full"
		/** The reader's plan does not make labels, which deletes none they have. */
		| "not-entitled";

	export type TagResult =
		| { ok: true; tag: Tag }
		| { ok: false; reason: Exclude<TagFailure, "tag-exists" | "saved-full"> }
		/** The label already reading under that name, so a refusal can name it. */
		| { ok: false; reason: "tag-exists"; tag: Tag };

	/**
	 * What labelling a post did. `saved` is `true` on a post this kept as it labelled it,
	 * which is the one gesture: a label is a reason to have kept something, so applying one
	 * keeps it.
	 */
	export type TagItemResult =
		| { ok: true; tag: Tag; saved: boolean }
		| { ok: false; reason: Exclude<TagFailure, "saved-full"> }
		| { ok: false; reason: "saved-full"; limit: Limit };

	/**
	 * What deleting a label did. `items` counts the posts that stop carrying it, which is
	 * the only consequence there is: no post is deleted and none is unsaved.
	 */
	export type TagRemoval =
		| { ok: true; name: string; items: number }
		| { ok: false; reason: "not-found" };

	/**
	 * One of the reader's rules, which reads as a sentence: when the `field` of a post
	 * contains `value`, `action` it.
	 */
	export interface Rule {
		id: string;
		/** The subscription it is scoped to, or `null` for one covering every feed. */
		feedId: string | null;
		field: RuleField;
		/** The text it looks for, in the spelling the reader gave it. */
		value: string;
		action: RuleAction;
		/**
		 * How many items this rule has decided. A match counts against every rule that
		 * matched it, so the number answers whether a rule is doing anything rather than how
		 * many posts were affected.
		 */
		matches: number;
		/** When it last decided one, or `null` for a rule that has never matched. */
		lastMatchedAt: number | null;
	}

	/** A rule as a form submits it, before anything has been checked about it. */
	export interface RuleDraft {
		/** The subscription to scope it to, or `null` to cover every feed. */
		feedId?: string | null;
		field: string;
		value: string;
		action: string;
	}

	/** Why a rule was not written, previewed or found. */
	export type RuleFailure =
		/** No rule of the reader's has that id. */
		| "not-found"
		/** The field is not one a rule may read. */
		| "invalid-field"
		/** The action is not one a rule may take. */
		| "invalid-action"
		/** The term was empty or longer than a filter can usefully be. */
		| "invalid-value"
		/** The rule names a feed this reader does not follow. */
		| "not-following"
		/** The reader's plan runs no rules, which deletes none they have. */
		| "not-entitled"
		/** The reader has as many rules as their tier allows; `limit` says how many. */
		| "rule-limit";

	export type RuleResult =
		| { ok: true; rule: Rule }
		| { ok: false; reason: Exclude<RuleFailure, "rule-limit"> }
		| { ok: false; reason: "rule-limit"; limit: Limit };

	/** What deleting a rule did, which is nothing to any post the reader holds. */
	export type RuleRemoval = { ok: true } | { ok: false; reason: "not-found" };

	/**
	 * What a candidate rule would have caught among the posts the reader still holds. It
	 * writes nothing and creates no rule: it is the one place this feature looks backwards,
	 * and it looks without touching.
	 */
	export type RulePreview =
		| {
				ok: true;
				/** Posts the preview read, which is at most the newest page of them. */
				scanned: number;
				matched: number;
				items: Item[];
				feeds: FeedRef[];
		  }
		| { ok: false; reason: Exclude<RuleFailure, "rule-limit" | "not-found"> };

	/**
	 * What a one-off over a previewed page did. It is an act on the posts the reader looked
	 * at rather than a rule granted the power to reach backwards, so it is bounded by the
	 * same page the preview was.
	 */
	export type RuleSweep =
		| { ok: true; scanned: number; matched: number; affected: number }
		| { ok: false; reason: Exclude<RuleFailure, "rule-limit" | "not-found"> };

	/** Why a subscription could not be pinned. */
	export type PinResult =
		| { ok: true; pinned: boolean }
		| { ok: false; reason: "not-following" }
		/** As many feeds are pinned as the strip holds; `allowed` says how many that is. */
		| { ok: false; reason: "pin-limit"; allowed: number };

	/**
	 * One pinned subscription and the newest few posts of it the reader has not read, as
	 * the strip above the river draws them.
	 */
	export interface PinnedFeed {
		feed: FeedRef;
		items: Item[];
	}

	/** One of the reader's groups of subscriptions, which is the whole of what a folder is. */
	export interface Folder {
		id: string;
		title: string;
	}

	/**
	 * Where a feed is being filed: a folder that exists, a name to file it under — which
	 * creates the folder when the reader has none by that name — or `null` to unfile it.
	 */
	export type FolderTarget = { folderId: string } | { title: string } | null;

	/** Why a folder was not created, renamed or found. */
	export type FolderFailure =
		/** No folder of the reader's has that id. */
		| "not-found"
		/** The name held nothing but space, which no rail could draw a row for. */
		| "invalid-title"
		/** The reader already has a folder by that name, and two would read alike. */
		| "duplicate-title";

	export type FolderResult = { ok: true; folder: Folder } | { ok: false; reason: FolderFailure };

	/**
	 * What filing a feed did. `moved` counts the posts that followed the subscription into
	 * the folder, which is the write a reader pays for once so every page of the folder is
	 * a seek, and `folder` is `null` for a feed put back among the unfiled.
	 */
	export type FileResult =
		| { ok: true; folder: Folder | null; moved: number }
		| { ok: false; reason: "not-following" | "not-found" | "invalid-title" };

	/**
	 * What deleting a folder did. A folder holds no posts, so `feeds` counts the
	 * subscriptions that came back unfiled and no post was deleted to produce it.
	 */
	export type FolderRemoval =
		| { ok: true; title: string; feeds: number }
		| { ok: false; reason: "not-found" };

	/**
	 * The feed one timeline item came from, carried alongside the items rather than
	 * joined into them: a join would qualify the ordering columns, and a cursor records
	 * the exact column names it was minted for.
	 */
	export interface FeedRef {
		id: string;
		title: string;
		siteUrl: string | null;
		/**
		 * Whether this feed's links are rendered with the address exactly as the publisher
		 * wrote it, which a page needs beside the title because it decides what each row's
		 * link says.
		 */
		keepLinkParameters: boolean;
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
		/** When the reader asked to keep it, or `null` for a post under the ordinary rules. */
		savedAt: number | null;
		/**
		 * When a rule marked it on arrival, or `null` for a post no rule flagged. The mark
		 * carries no exemption: a flagged post ages out and is reclaimed like any other.
		 */
		flaggedAt: number | null;
		/**
		 * The labels on this post, which only the two surfaces that draw chips ask for. The
		 * river answers with an empty list rather than a second read on every page of it.
		 */
		tags: Tag[];
	}

	/** One post opened on its own page, with what the reader's tier allows doing to it. */
	export interface OpenedPost {
		item: Item;
		/** The subscription it came from, so the page names the publisher above the article. */
		feed: FeedSummary | null;
		/**
		 * The one audio or video file the post arrived with, or `null` for the posts arriving
		 * with none. It belongs to the opened post rather than to {@link Item}, because a
		 * player appears where a post is read and never on a row of a list.
		 */
		enclosure: FeedStore.Enclosure | null;
		/**
		 * Whether this reader's tier carries full-text extraction. Answered here rather
		 * than beside the page, so the tier is read from the row that holds it and a
		 * surface that forgets to ask is offered nothing.
		 */
		fullText: boolean;
	}

	/** Where in a timeline to read from, and how much of it. */
	export interface TimelineOptions {
		/** An opaque keyset cursor carrying its own direction, or `null` for the first page. */
		cursor?: string | null;
		limit?: number;
	}

	/** Which posts of the reading queue a page holds, by whether the reader has read them. */
	export type ReadState =
		/** Every stored post, read and unread alike. */
		| "all"
		/** Posts the reader has yet to read. */
		| "unread"
		/** Posts the reader has read. */
		| "read";

	/** Where in the reading queue to read from, how much of it, and which posts. */
	export interface ReadingQueueOptions extends TimelineOptions {
		/**
		 * Which posts the page holds. Unread when the caller names none, so a view that
		 * offers no filter shows the queue a reader still has ahead of them.
		 */
		readState?: ReadState;
		/**
		 * Words a post's title, summary or author has to contain, which narrow the page
		 * alongside {@link readState}. Text holding nothing but space narrows nothing, so an
		 * empty search box reads as the whole queue.
		 */
		query?: string;
		/** One subscription the page is narrowed to, or `null` for every followed feed. */
		feedId?: string | null;
		/** One folder the page is narrowed to, or `null` for every followed feed. */
		folderId?: string | null;
	}

	/** Why a search page stopped where it did, which is what the list says beneath it. */
	export type SearchStop =
		/** At the step's own floor, with more of the reader's archive below it. */
		| "step"
		/** At the oldest post the reader's tier lets a search reach. */
		| "window"
		/** At the oldest post stored, so there is nothing further to search. */
		| "archive";

	/**
	 * How far one search page reached, and what stopped it there. A search that shows
	 * nothing has to say what it looked at, because the confusing failure is the one where
	 * the post exists and the search was never allowed to reach it.
	 */
	export interface SearchSpan {
		/** Epoch milliseconds of the oldest moment this page's scan looked at. */
		reachedAt: number;
		/** Days the reader's tier lets a search reach, or `null` for everything stored. */
		windowDays: number | null;
		stoppedAt: SearchStop;
	}

	/** A query the reader kept, which is a narrowing of the queue and nothing more. */
	export interface SavedSearch {
		id: string;
		name: string;
		query: string;
		readState: ReadState;
		/** The subscription it is scoped to, or `null` for one across every followed feed. */
		feedId: string | null;
	}

	/** What a reader submits to keep a query, or to change one they kept. */
	export interface SavedSearchDraft {
		name: string;
		query: string;
		readState: ReadState;
		feedId: string | null;
	}

	/** Why a query was not kept. */
	export type SavedSearchFailure =
		/** The name was blank, or longer than a rail row can carry. */
		| "invalid-name"
		/** The query held nothing but space, which narrows nothing. */
		| "invalid-query"
		/** Another saved search already answers to that name. */
		| "duplicate-name"
		/** No saved search of this reader's has that id. */
		| "not-found";

	/** What keeping or changing a query did, or why it was refused. */
	export type SavedSearchResult =
		| { ok: true; search: SavedSearch }
		| { ok: false; reason: SavedSearchFailure }
		| {
				ok: false;
				/** The shelf is full, and the newest is refused rather than the oldest evicted. */
				reason: "full";
				limit: number;
		  };

	/** What forgetting a saved search did, or why there was nothing to forget. */
	export type SavedSearchRemoval = { ok: true } | { ok: false; reason: "not-found" };

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
				/**
				 * How far a search page reached and what stopped it there, or `null` for a page
				 * of a list nobody searched, which walks to wherever its cursor takes it.
				 */
				search: SearchSpan | null;
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
		| "already-following"
		/** The reader holds as many feeds as their tier allows; `limit` says how many. */
		| "over-limit";

	export type FollowResult =
		| { ok: true; feed: FeedSummary; items: number }
		| {
				ok: false;
				reason: Exclude<FollowFailure, "over-limit">;
				feedId: string | null;
		  }
		| { ok: false; reason: "over-limit"; feedId: null; limit: Limit };

	/** What a sweep of every followed feed got through. */
	export interface CheckAllResult {
		/** Feeds the sweep reached. */
		checked: number;
		/** Feeds that answered with something the reader had not seen. */
		withNewPosts: number;
		/** Posts the sweep brought in across all of them. */
		inserted: number;
		/** Feeds whose origin refused, timed out, or sent something that is not a feed. */
		failed: number;
	}

	/** One subscription as an export carries it, which is all OPML has room for. */
	export interface FeedExport {
		title: string;
		feedUrl: string;
		siteUrl: string | null;
		/** The folder it is filed in, which the document writes as the outline around it. */
		folder: string | null;
	}

	/** One subscription an import found, with the folder its document filed it under. */
	export interface ImportEntry {
		feedUrl: string;
		/** The name of the outline around it, or `null` for one listed at the top level. */
		folder?: string | null;
	}

	/** What an OPML document's subscriptions became. */
	export interface ImportResult {
		/** Feeds now followed that were not before. */
		added: number;
		/** Feeds in the document that were already followed. */
		alreadyFollowing: number;
		/** Feeds in the document that could not be retrieved, with the URL each one names. */
		failed: string[];
	}

	/** Why a reader's own check of one feed never reached the origin's answer. */
	export type CheckFailure =
		/** Not a feed this reader follows, so there was nothing to check. */
		| "not-following"
		/** The origin refused, timed out, or sent back something that is not a feed. */
		| "check-failed";

	/**
	 * What checking one feed on the spot came back with. `inserted` counts the posts the
	 * reader had not seen, which is the answer they asked the question for; `updated`
	 * counts entries the publisher revised. A 304 reports both as zero, since the stored
	 * copy is current and the reader's answer is the same either way.
	 */
	export type CheckResult =
		| { ok: true; inserted: number; updated: number }
		| { ok: false; reason: CheckFailure };

	/**
	 * What the reader has waiting that they have not got yet, worked out by comparing each
	 * subscription's cursor against the head its feed published. It is a count and the
	 * feeds it came from, never a promise of fresher posts: the page has already been read
	 * out of local storage by the time this is known.
	 */
	export interface Freshness {
		/** The subscriptions with something above their cursor, as this app's own feed ids. */
		stale: string[];
		count: number;
	}

	/** A page of the queue, and what is known to be missing from it. */
	export interface OpenResult {
		timeline: TimelineResult;
		freshness: Freshness;
	}

	/** What one synchronization run got through, for the log and for the alarm. */
	export interface SyncRun {
		/** Feeds this run brought up to date. */
		synchronized: number;
		/** Posts it materialized across all of them. */
		items: number;
		/** Feeds it left behind, which the catch-up alarm carries on with. */
		remaining: number;
		/** Feeds holding back because the object is over budget with nothing to reclaim. */
		paused: number;
		/**
		 * Items the reader's rules decided, dropped and written alike. It is what says a rule
		 * is acting on arrivals, which nothing in the timeline could show.
		 */
		ruled: number;
	}

	/**
	 * What one retention sweep took, and the two numbers that say what it was measured
	 * against. A reclamation is only readable beside the budget it was made under, and the
	 * budget is only readable beside the tier that set it.
	 */
	export interface Sweep {
		/** Posts dropped for being older than the velocity their reader set. */
		aged: number;
		/** Posts taken back from what was read and not saved, on an object over budget. */
		reclaimed: number;
		/** Feeds left holding, because nothing of theirs was the reader's to lose. */
		paused: number;
		/** The tier the object's own settings carried when it ran. */
		tier: Tier;
		/** The posts that tier allows, which is what the counts above were compared to. */
		budget: number;
	}

	/** Setting a velocity the `CHECK` constraint would refuse is reported, never thrown. */
	export type VelocityResult =
		| { ok: true; feed: FeedSummary }
		| { ok: false; reason: "not-following" | "invalid-velocity" };

	/**
	 * Why a post could not be kept. A full shelf refuses the next save rather than
	 * evicting the oldest, because evicting deletes the one thing a reader explicitly
	 * asked to keep.
	 */
	export type SaveFailure = "not-found" | "full";

	export type SaveResult =
		| { ok: true; saved: boolean }
		| { ok: false; reason: "not-found" }
		| { ok: false; reason: "full"; limit: Limit };

	/**
	 * What started a synchronization. Only a wake notifies: buzzing a phone about a page the
	 * reader is looking at is the fastest way to get the feature turned off, and keeping
	 * delivery off the request path means no page waits on a push service.
	 */
	export type SyncTrigger = "request" | "scheduled";

	/** One browser the reader asked to be reached on, as the settings page lists it. */
	export interface Device {
		id: string;
		/** The push service's own host, which is what a reader recognizes a row by. */
		service: string;
		/** What the browser called itself when it registered, for naming the row. */
		userAgent: string | null;
		lastDeliveredAt: number | null;
		createdAt: number;
	}

	/** What a browser hands over when it subscribes, which is the whole of a registration. */
	export interface DeviceRegistration {
		endpoint: string;
		/** The client's public key as the Push API hands it over. */
		p256dh: string;
		/** The client's auth secret as the Push API hands it over. */
		auth: string;
		userAgent?: string | null;
		/** The language that browser is reading the app in, which its copy is written in. */
		locale?: string;
	}

	/** Everything the notification surface draws, in one read. */
	export interface Notifications {
		push: boolean;
		email: boolean;
		/** Whether the reader's plan sends email at all, which the object decides. */
		emailAllowed: boolean;
		/** Where email would go, or `null` before a sign-in wrote one. */
		address: string | null;
		timeZone: string;
		quietHours: boolean;
		quietFrom: number;
		quietTo: number;
		/** Subscriptions the reader opted in, which is what says whether anything is configured. */
		feeds: number;
		devices: Device[];
	}

	/** The window a reader is left alone in, as a form submits it. */
	export interface QuietHours {
		enabled: boolean;
		from: number;
		to: number;
	}

	/**
	 * Turning a channel on is refused rather than silently ignored when the plan does not
	 * sell it, so the page says what happened instead of drawing a switch that does nothing.
	 */
	export type ChannelResult =
		| { ok: true; notifications: Notifications }
		| { ok: false; reason: "not-entitled" };

	/** Opting one subscription in or out, which is refused for a feed nobody follows. */
	export type NotifyFeedResult =
		| { ok: true; notify: boolean }
		| { ok: false; reason: "not-following" };

	/**
	 * Answering for one subscription's link parameters, refused for a feed nobody follows.
	 */
	export type LinkParametersResult =
		| { ok: true; keepLinkParameters: boolean }
		| { ok: false; reason: "not-following" };
}

/**
 * One reader's storage, addressed by their OIDC subject. Every method is RPC: the Worker
 * renders the HTML and this object answers with data, so it stays a store rather than a
 * nested application.
 */
export class UserDO extends DurableObject<Cloudflare.Env> {
	/** The reader's own SQLite, built once because the storage handle outlives every call. */
	#db: Database;

	/**
	 * Opens the reader's database and applies whatever schema has not run yet.
	 *
	 * @param ctx - The object's storage, alarms and concurrency gate.
	 * @param env - The Worker's bindings.
	 */
	constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
		super(ctx, env);

		let adapter = createSQLStorageDatabaseAdapter(ctx.storage.sql);

		/**
		 * Auto-managed timestamps read this clock, which answers epoch milliseconds so a
		 * written timestamp binds, sorts and encodes into a cursor as the integer every
		 * column of this schema holds.
		 */
		this.#db = new Database(adapter, { now: () => Date.now() });

		/**
		 * A constructor cannot await, and the runtime holds every request behind this, so
		 * each method below reads a schema that already exists.
		 */
		void ctx.blockConcurrencyWhile(() => runMigrations(adapter));
	}

	/**
	 * Creates the reader's row if this is their first sign-in, and arms the refresh
	 * schedule. Idempotent, because it runs on every completed sign-in rather than once:
	 * there is no user table and no sign-up step, so a first login is what creates a
	 * reader.
	 */
	async ensureUser(subject: string, email?: string | null): Promise<UserStore.Settings> {
		let row = await this.#settingsRow(subject);

		/**
		 * The address is written on every sign-in rather than on the first, which is what
		 * picks up a changed one for free. It is what the email channel sends to, since an
		 * alarm has no ID token to read it off.
		 */
		if (email && email !== row.email) {
			row = await this.#db.update(settings, { id: SETTINGS_ID }, { email });
		}

		/**
		 * A tier bought while the object was asleep takes effect at the sign-in that
		 * follows it rather than at a wake the old tier never armed.
		 */
		await this.#reschedule(row);

		return toSettings(row);
	}

	/** The reader's preferences, or `null` for an object no sign-in has reached yet. */
	async getSettings(): Promise<UserStore.Settings | null> {
		let row = await this.#db.find(settings, { id: SETTINGS_ID });
		return row === null ? null : toSettings(row);
	}

	/**
	 * Records the scheme and the reading face, and answers what is now stored.
	 *
	 * Both values are narrowed here rather than at the form, so a submission nothing on the
	 * page could have produced writes the default instead of reaching the `CHECK` that would
	 * refuse it.
	 *
	 * @param input - The scheme and the face the reader picked.
	 */
	async setPresentation(input: { theme: string; face: string }): Promise<UserStore.Presentation> {
		await this.#settingsRow();

		let updated = await this.#db.update(
			settings,
			{ id: SETTINGS_ID },
			{
				theme: isTheme(input.theme) ? input.theme : DEFAULT_THEME,
				reading_face: isReadingFace(input.face) ? input.face : DEFAULT_READING_FACE,
			},
		);

		return toPresentation(updated);
	}

	/**
	 * Writes what the platform says this reader holds, and answers what that did to their
	 * tier. It is the only way the column moves: this object never computes a tier, never
	 * raises one, and has no path to the platform or to the catalog through which it could.
	 *
	 * Upgrades land at once, a cancellation the reader asked for drops as they asked, and
	 * anything else that would lower the tier opens a fortnight's grace and drops only once
	 * that has run out. Nothing is deleted either way.
	 *
	 * @param snapshot - What the platform answered, and when it answered it.
	 * @example let applied = await userStore(subject).setTier({ entitled, cancelled, readAt, source });
	 */
	async setTier(snapshot: UserStore.TierSnapshot): Promise<UserStore.TierResult> {
		let row = await this.#settingsRow();
		let current = storedTier(row);
		let source = storedTierSource(row);
		let graceUntil = row.grace_until;

		/**
		 * A read taken before the one already stored says nothing newer, so the later read
		 * wins whichever of the two writes arrives second.
		 */
		if (snapshot.readAt < row.tier_checked_at) {
			return { ok: false, reason: "stale", tier: current, graceUntil };
		}

		/**
		 * A tier a person granted outlives what the platform says about the money, which is
		 * what makes a staff account, a comp and a trial expressible in this column.
		 */
		if (
			source === "grant" &&
			snapshot.source === "billing" &&
			tierRank(snapshot.entitled) < tierRank(current)
		) {
			return { ok: false, reason: "granted", tier: current, graceUntil };
		}

		let decided =
			snapshot.source === "grant"
				? { tier: snapshot.entitled, graceUntil: null }
				: effectiveTier(
						{ entitled: snapshot.entitled, cancelled: snapshot.cancelled },
						{ tier: current, graceUntil },
						Date.now(),
					);

		await this.#db.update(
			settings,
			{ id: SETTINGS_ID },
			{
				tier: decided.tier,
				tier_source: snapshot.source,
				grace_until: decided.graceUntil,
				tier_checked_at: snapshot.readAt,
			},
		);

		this.#record("job", {
			event: "user.tier",
			from: current,
			to: decided.tier,
			expiresAt: decided.graceUntil,
			source: snapshot.source,
		});

		/**
		 * An upgrade takes effect at once rather than at whatever wake the tier it replaced
		 * had already armed, and a drop to free stops the wakes with the same write.
		 */
		await this.#reschedule({
			...row,
			tier: decided.tier,
			grace_until: decided.graceUntil,
		});

		return { ok: true, from: current, to: decided.tier, graceUntil: decided.graceUntil };
	}

	/**
	 * What this reader may do, and where they stand against it. Every number comes from
	 * this object's own rows, so the panel that explains an over-limit state costs the same
	 * local queries a limit check does.
	 *
	 * A limit the reader is over is reported rather than acted on: a tier change deletes
	 * nothing, and coming back is one column write.
	 */
	async entitlement(): Promise<UserStore.Entitlement> {
		let row = await this.#settingsRow();
		let tier = storedTier(row);

		let [followed, saved, posts] = await Promise.all([
			this.#db.count(feeds, { where: isNull("unfollowed_at") }),
			this.#db.count(feedItems, { where: notNull("saved_at") }),
			this.#db.count(feedItems),
		]);

		let measured: UserStore.Limit[] = [
			limitRefusal(tier, "feeds", followed),
			limitRefusal(tier, "saved", saved),
			limitRefusal(tier, "posts", posts),
		];

		return {
			tier,
			source: storedTierSource(row),
			graceUntil: row.grace_until,
			tierCheckedAt: row.tier_checked_at,
			limits: limitsOf(tier),
			over: measured.filter((refusal) => refusal.current > refusal.allowed),
			feeds: followed,
			saved,
			posts,
		};
	}

	/**
	 * How many feeds the reader follows, which is what tells an empty queue apart from an
	 * empty subscription list without reading a page of feeds to count it.
	 */
	async countFeeds(): Promise<number> {
		return await this.#db.count(feeds, { where: isNull("unfollowed_at") });
	}

	/**
	 * Checks every followed feed now, reporting what the sweep as a whole found.
	 *
	 * Each feed is asked of the object that owns it, so a reader sweeping their
	 * subscriptions fetches nothing themselves and a feed two of them share is retrieved
	 * once. What comes back into this object afterwards is the reader's own copy.
	 */
	async checkAllFeedsNow(): Promise<UserStore.CheckAllResult> {
		let result: UserStore.CheckAllResult = {
			checked: 0,
			withNewPosts: 0,
			inserted: 0,
			failed: 0,
		};

		try {
			let followed = await this.#subscriptions();
			let now = Date.now();

			await inParallel(followed, async (feed) => {
				let refreshed = await feedStore(feed.feed_id).refresh("manual");

				if (!refreshed.ok) {
					result.failed += 1;
					return;
				}

				result.checked += 1;

				let synchronized = await this.#syncFeed(feed);
				result.inserted += synchronized.items;
				if (synchronized.items > 0) result.withNewPosts += 1;
			});

			// A reader's own sweep brings their posts up to date exactly as the scheduled one
			// does, so the settings page reports it the same way rather than reading stale.
			await this.#stampRefreshed(now);
		} catch (error) {
			/**
			 * Reported rather than rejected, for the reason the alarm resolves: a reader who
			 * asked gets the count of what did get through, and a caller rendering a page is
			 * not taken down because one origin was unreachable.
			 */
			console.error("reader sweep of every feed failed", error);
		}

		return result;
	}

	/**
	 * Marks every unread post of one feed read, and reports how many that was.
	 *
	 * One statement rather than a page read and a row written per post, so clearing a feed
	 * a reader let pile up costs the same as clearing one they are caught up on.
	 */
	async markFeedRead(feedId: string): Promise<number> {
		let unread = and({ feed_id: feedId }, isNull("read_at"));

		/**
		 * Counted before the write rather than read back from it. What a write reports is
		 * rows of storage, and a post lives in the table and in whichever partial indexes it
		 * qualifies for, so marking one read writes several rows. The reader is told about
		 * posts.
		 */
		let posts = await this.#db.count(feedItems, { where: unread });
		if (posts === 0) return 0;

		await this.#db.updateMany(feedItems, { read_at: Date.now() }, { where: unread });

		return posts;
	}

	/** Marks every unread post read across every feed, and reports how many that was. */
	async markAllRead(): Promise<number> {
		/** Counted rather than read back from the write, for the reason one feed's sweep is. */
		let posts = await this.#db.count(feedItems, { where: isNull("read_at") });
		if (posts === 0) return 0;

		await this.#db.updateMany(feedItems, { read_at: Date.now() }, { where: isNull("read_at") });

		return posts;
	}

	/** Every subscription, in the shape an export writes them. */
	async exportFeeds(): Promise<UserStore.FeedExport[]> {
		// The whole list, unpaged: a document holding some of a reader's subscriptions is
		// one they would restore an incomplete library from.
		let rows = await this.#db.findMany(feeds, {
			where: isNull("unfollowed_at"),
			orderBy: [
				["created_at", "desc"],
				["id", "desc"],
			],
		});

		/** The folder names read once for the whole list, since a document groups by them. */
		let byId = new Map((await this.listFolders()).map((folder) => [folder.id, folder.title]));

		return rows.map((row) => ({
			title: row.title,
			feedUrl: row.feed_url,
			siteUrl: row.site_url,
			folder: row.folder_id === null ? null : (byId.get(row.folder_id) ?? null),
		}));
	}

	/**
	 * Follows each URL that is not already followed, files what it followed under the folder
	 * its document named, and reports what became of the rest. One unreachable feed in a
	 * document of fifty leaves the other forty-nine followed.
	 *
	 * A feed the reader already follows stays exactly where they put it: a document arriving
	 * from somewhere else is not a licence to refile a list somebody has already organized.
	 *
	 * @param entries - The subscriptions the document listed, each with its folder's name.
	 */
	async importFeeds(entries: readonly UserStore.ImportEntry[]): Promise<UserStore.ImportResult> {
		let result: UserStore.ImportResult = { added: 0, alreadyFollowing: 0, failed: [] };

		// A document listing the same URL twice names one subscription, and the second pass
		// would otherwise race the first into the unique index on `feed_url`.
		let requested = new Map<string, UserStore.ImportEntry>();
		for (let entry of entries) {
			if (!requested.has(entry.feedUrl)) requested.set(entry.feedUrl, entry);
		}

		/**
		 * One promise per folder name, so twenty feeds filed under Tech await the same
		 * creation rather than twenty of them reading an empty table at once and racing each
		 * other into the unique index on the title.
		 */
		let opened = new Map<string, Promise<SelectFolder>>();
		let folderByTitle = (title: string): Promise<SelectFolder> => {
			let pending = opened.get(title) ?? this.#folderByTitle(title);
			opened.set(title, pending);
			return pending;
		};

		await inParallel([...requested.values()], async (entry) => {
			try {
				let followed = await this.followFeed(entry.feedUrl);

				if (followed.ok) {
					result.added += 1;

					let title = entry.folder?.trim() ?? "";
					if (title.length > 0) {
						let folder = await folderByTitle(title);
						await this.fileFeed(followed.feed.id, { folderId: folder.id });
					}
				} else if (followed.reason === "already-following") result.alreadyFollowing += 1;
				else result.failed.push(entry.feedUrl);
			} catch {
				// Whatever went wrong belongs to this URL alone, so the rest of the document
				// still lands and the reader is told which one did not.
				result.failed.push(entry.feedUrl);
			}
		});

		return result;
	}

	/**
	 * Every followed feed in the order their names read, each with its unread count.
	 *
	 * Unpaged, because the one place a reader meets this list is the rail, which draws all
	 * of it and scrolls within its own column. A page of it would be a rail that stops
	 * partway down somebody's subscriptions with no way on.
	 */
	async listFeeds(): Promise<UserStore.FeedSummary[]> {
		let [rows, unread, filed] = await Promise.all([
			/**
			 * The names, in order, so an eye running down the rail finds a feed by its name.
			 * Bytes are what SQLite compares, which the index carries; the reader's own
			 * language orders what comes back, where the request's locale is.
			 */
			this.#db.findMany(feeds, {
				where: isNull("unfollowed_at"),
				orderBy: [
					["title", "asc"],
					["id", "asc"],
				],
			}),
			this.#unreadCounts(),
			/**
			 * The whole folder list read once and carried onto the rows, so a rail drawn under
			 * folder names costs the same read it costs without them.
			 */
			this.listFolders(),
		]);

		let byId = new Map(filed.map((folder) => [folder.id, folder]));

		return rows.map((row) =>
			toFeedSummary(
				row,
				unread.get(row.id) ?? 0,
				row.folder_id === null ? null : (byId.get(row.folder_id) ?? null),
			),
		);
	}

	/** One followed feed, or `null` when this reader does not follow it. */
	async getFeed(feedId: string): Promise<UserStore.FeedSummary | null> {
		let row = await this.#db.find(feeds, { id: feedId });
		if (row === null || row.unfollowed_at !== null) return null;

		let unread = await this.#db.count(feedItems, {
			where: and({ feed_id: feedId }, isNull("read_at")),
		});

		return toFeedSummary(row, unread, await this.#folderOf(row));
	}

	/**
	 * Subscribes to whatever feed `input` leads to, accepting either a feed URL or a page
	 * that advertises one, and stores the page of posts the feed hands back so the queue is
	 * never empty the moment a feed is followed.
	 *
	 * The feed itself is fetched by the object named after it, which is what makes the
	 * second follower of a feed cost no request at all: they reach an object that has
	 * already done the work and is already being polled for everybody.
	 */
	async followFeed(input: string): Promise<UserStore.FollowResult> {
		let target = normalizeFeedUrl(input);
		if (target === null) return { ok: false, reason: "invalid-url", feedId: null };

		let pasted = await this.#subscriptionByUrl(target);
		if (pasted !== null) return await this.#follow(pasted);

		/**
		 * Checked here rather than in the form that offers it, because an OPML import, the
		 * public API and a replayed submission all reach this method without passing one.
		 * A feed already followed is answered above, so nothing this refuses would have left
		 * the count where it was.
		 */
		let room = await this.#roomForFeed();
		if (room !== null) return { ok: false, reason: "over-limit", feedId: null, limit: room };

		/**
		 * The one external request made outside a feed's own object, and the step that
		 * decides what two people are following: it reports the address the response finally
		 * came from, so a person who pastes a site and a person who pastes its feed converge
		 * on one name.
		 */
		let discovered = await Feed.discover(target);
		if (isFailure(discovered)) return { ok: false, reason: "unreachable", feedId: null };

		let [advertised] = discovered.data;
		if (advertised === undefined) return { ok: false, reason: "not-found", feedId: null };

		let feedUrl = advertised.url;

		let resolved = await this.#subscriptionByUrl(feedUrl);
		if (resolved !== null) return await this.#follow(resolved);

		/**
		 * The URL is exchanged for an id once, here, and written down from then on. The
		 * unique index the exchange goes through is what makes two people following one feed
		 * in the same second come out with one id, and so with one object.
		 */
		let feedId: string;
		try {
			feedId = await registerFeed(feedUrl, advertised.title ?? feedUrl);
		} catch {
			return { ok: false, reason: "unreachable", feedId: null };
		}

		let joined = await feedStore(feedId).subscribe(this.#subject(), feedUrl);
		if (!joined.ok) return { ok: false, reason: joined.reason, feedId: null };

		let now = Date.now();
		let subscriptionId = TypeID.fromUUID("feed", generateUUID()).toString();

		/**
		 * Written straight through rather than inside a transaction scope. A Durable Object
		 * refuses `BEGIN` and `SAVEPOINT` outright, and has no need of them: every write a
		 * turn makes is coalesced into one atomic commit and discarded together if the turn
		 * throws.
		 */
		let created = await this.#db.create(
			feeds,
			{
				id: subscriptionId,
				feed_id: feedId,
				feed_url: joined.feed.feedUrl,
				site_url: joined.feed.siteUrl,
				title: joined.feed.title,
				description: joined.feed.description,
				language: joined.feed.language,
				image_url: joined.feed.imageUrl,
				cursor: 0,
				velocity: DEFAULT_VELOCITY,
				unfollowed_at: null,
				/**
				 * Stamped from the measurement the feed's object already took and already
				 * returned, which is what the rail's quiet group is derived from.
				 */
				posts_per_day: joined.feed.postsPerDay,
			},
			{ returnRow: true },
		);

		/**
		 * The first page of a new subscription is an arrival like any other, so a rule the
		 * reader wrote before they followed this feed acts on it.
		 */
		let run = await this.#ruleRun();
		let materialized = await this.#materialize(
			subscriptionId,
			joined.items,
			DEFAULT_VELOCITY,
			now,
			null,
			run,
		);

		await this.#countMatches(run, now);

		let stored = materialized.written;

		/**
		 * Set to the head the feed reported alongside the page, so a subscription starts
		 * current and what reaches the reader from here is what the feed publishes next.
		 *
		 * Not the greatest revision among the items handed over: a feed numbers entries in
		 * the order it discovered them, which is the order the document listed them, so
		 * whether a newest-first page carries the highest revisions or the lowest is a
		 * decision the publisher made. Reading the head makes a new subscription mean the
		 * same thing either way — the newest page, and everything after it.
		 *
		 * This is not the cursor taking its value from the shared index. That head is a hint
		 * which may lag; this one came back from the feed itself, in the same answer as the
		 * items, and names exactly what that object had decided by the time it answered.
		 */
		await this.#db.update(feeds, { id: subscriptionId }, { cursor: joined.head });

		await this.#stampRefreshed(now);

		return { ok: true, feed: toFeedSummary(created, stored), items: stored };
	}

	/**
	 * Retrieves one feed on the spot and reports what came back, for a reader who knows a
	 * site has just published and would rather not wait out the schedule.
	 *
	 * It resolves however the retrieval went, so a feed whose origin is down answers the
	 * reader instead of failing the request they made.
	 *
	 * @param feedId - The subscription to check.
	 * @example let checked = await userStore(subject).checkFeedNow(feedId);
	 */
	async checkFeedNow(feedId: string): Promise<UserStore.CheckResult> {
		let feed = await this.#db.find(feeds, { id: feedId });
		if (feed === null) return { ok: false, reason: "not-following" };

		/**
		 * Asked for by a person rather than by the schedule, so the feed's own backoff is
		 * told to stand aside: a feed that has been failing is exactly the one they came
		 * here to ask about.
		 */
		let refreshed = await feedStore(feed.feed_id).refresh("manual");
		if (!refreshed.ok) return { ok: false, reason: "check-failed" };

		let now = Date.now();

		try {
			let synchronized = await this.#syncFeed(feed);

			// The origin answered, so this reader's copy is current as of now — a 304 included,
			// which says the stored copy was already the current one.
			await this.#stampRefreshed(now);

			return { ok: true, inserted: synchronized.items, updated: 0 };
		} catch (error) {
			/**
			 * The feed answered and this reader's copy did not follow, which is the same news
			 * to somebody standing in front of a page: they asked for this feed to be checked
			 * and it has not been. Told as a refusal rather than thrown, so the page they are
			 * on renders with the outcome on it.
			 */
			console.error("reader synchronization of one feed failed", error);

			return { ok: false, reason: "check-failed" };
		}
	}

	/**
	 * Drops a subscription and every post behind it, and tells the feed it has one fewer
	 * subscriber — which is what eventually stops the feed being polled at all.
	 *
	 * The posts go first, so a turn that fails between the two leaves the feed still
	 * followed rather than its posts orphaned under a subscription that is gone. Saved posts
	 * are the exception: they survive, and the subscription's row survives with them to hold
	 * the feed's name, marked as no longer followed so every list leaves it out.
	 */
	async unfollowFeed(feedId: string): Promise<boolean> {
		let feed = await this.#db.find(feeds, { id: feedId });
		if (feed === null) return false;

		let dropped = and({ feed_id: feedId }, isNull("saved_at"));

		/** The labels of what is going are cleared in the same batch the posts go in. */
		let doomed = await this.#db.query(feedItems).where(dropped).select("id").all();
		await this.#forgetTags(doomed.map((row) => row.id));

		await this.#db.deleteMany(feedItems, { where: dropped });

		/**
		 * A rule scoped to this feed goes with the subscription: it is one the reader can no
		 * longer see or reason about, and one they would be astonished to find working again
		 * if they followed the feed a second time.
		 */
		await this.#db.deleteMany(rules, { where: { feed_id: feedId } });

		let saved = await this.#db.count(feedItems, { where: { feed_id: feedId } });

		if (saved > 0) {
			await this.#db.update(feeds, { id: feedId }, { unfollowed_at: Date.now() });
		} else {
			await this.#db.delete(feeds, { id: feedId });
		}

		/**
		 * Told after this reader's own state is settled: the feed's answer decides nothing
		 * here, and a failure to reach it must not leave a reader still following something
		 * they asked to be rid of.
		 */
		await feedStore(feed.feed_id).unsubscribe(this.#subject());

		return true;
	}

	/**
	 * The first page of the queue, and what the reader has waiting that they have not got
	 * yet — which is the question the reading page actually asks.
	 *
	 * The page comes out of local storage and is answered immediately. The staleness beside
	 * it is derived rather than stored: each subscription's cursor is compared against the
	 * head its feed published, so there is no flag to leave set, nothing a lost message can
	 * miss, and no path that can write one and forget the other.
	 *
	 * @param options - Which posts the page holds, where to page from, and how much of it.
	 * @example let opened = await userStore(viewer.id).openReader({ readState: "unread" });
	 */
	async openReader(options: UserStore.ReadingQueueOptions = {}): Promise<UserStore.OpenResult> {
		let [timeline, subscriptions, row] = await Promise.all([
			this.readingQueue(options),
			this.#subscriptions(),
			this.#settingsRow(),
		]);

		let started = Date.now();
		let heads = await readHeads(subscriptions.map((feed) => feed.feed_id));

		let stale = subscriptions
			.filter((feed) => (heads.get(feed.feed_id) ?? 0) > feed.cursor)
			.map((feed) => feed.id);

		/**
		 * An open is what dormancy is measured from, so stamping it here and rescheduling
		 * from the stamp puts a returning reader back on the cadence they pay for before
		 * the wake that would otherwise have run on a backed-off one.
		 */
		await this.#db.update(settings, { id: SETTINGS_ID }, { last_opened_at: started });
		await this.#reschedule({ ...row, last_opened_at: started });

		/**
		 * How many reads covered the subscription list is the number worth watching: a check
		 * that stops being one round trip is visible here before a reader notices it.
		 */
		this.#record("job", {
			event: "user.freshness",
			trigger: "open",
			tier: leasedTier(row, started),
			feeds: subscriptions.length,
			reads: Math.ceil(subscriptions.length / KEYS_PER_BULK_READ),
			stale: stale.length,
			durationMs: Date.now() - started,
		});

		return { timeline, freshness: { stale, count: stale.length } };
	}

	/**
	 * Brings stale subscriptions up to date, a bounded number at a time, and reports what it
	 * left behind.
	 *
	 * Nothing renders behind this. It runs after a page has been answered, so a reader back
	 * after a month gets their timeline in one indexed seek and the feeds they are missing
	 * over the seconds and minutes after it.
	 *
	 * @param feedIds - The subscriptions to bring up to date; every stale one when omitted.
	 * @param trigger - What started it, which is the whole of what decides whether the run
	 * ends in a notification.
	 */
	async synchronize(
		feedIds?: string[],
		trigger: UserStore.SyncTrigger = "request",
	): Promise<UserStore.SyncRun> {
		return await this.#runSync(await this.#staleSubscriptions(feedIds), trigger);
	}

	/**
	 * Brings an already-derived list of stale subscriptions up to date, a bounded number at
	 * a time, and reports what it left behind.
	 *
	 * The staleness is taken as given so a caller that has just read the heads pays for one
	 * bulk read rather than two: the comparison is the same one either way, and reading it
	 * twice would double the only line of this work that grows with the subscription list.
	 *
	 * @param due - The subscriptions with something above their cursor.
	 */
	async #runSync(
		due: SelectFeed[],
		trigger: UserStore.SyncTrigger = "request",
	): Promise<UserStore.SyncRun> {
		let run: UserStore.SyncRun = {
			synchronized: 0,
			items: 0,
			remaining: 0,
			paused: 0,
			ruled: 0,
		};

		try {
			let batch = due.slice(0, SYNC_FEEDS_PER_REQUEST);
			run.remaining = Math.max(0, due.length - batch.length);

			/** Read once for the whole run, so every feed in it decides against one set. */
			let ruleRun = await this.#ruleRun();

			await inParallel(
				batch,
				async (feed) => {
					let synchronized = await this.#syncFeed(feed, ruleRun);

					run.items += synchronized.items;
					run.ruled += synchronized.ruled;
					run.synchronized += 1;
					if (synchronized.paused) run.paused += 1;
				},
				SYNC_CONCURRENCY,
			);

			/** One small update per rule that matched anything, with the run's whole total. */
			await this.#countMatches(ruleRun, Date.now());

			await this.#runSweep(Date.now(), run.paused);
			await this.#stampRefreshed(Date.now());

			/** Whatever a run could not reach carries on in a minute rather than an interval. */
			if (run.remaining > 0) {
				await this.#armCatchUp();
				this.#record("job", { event: "user.sync.deferred", remaining: run.remaining });
			}

			/**
			 * Last, after every row is written and every cursor has advanced, so a delivery
			 * that fails costs nothing but itself and can strand nothing behind it.
			 */
			if (trigger === "scheduled") await this.#notify();
		} catch (error) {
			/**
			 * Reported rather than rejected, for the reason the alarm resolves: this runs
			 * behind a page that has already been sent, and a reader is not shown an error for
			 * work they never asked to wait for.
			 */
			console.error("reader synchronization failed", error);
		}

		return run;
	}

	/**
	 * Changes how long a feed's posts stay in this reader's timeline, and applies it at
	 * once, so the choice is visible in the list rather than at the next sweep.
	 *
	 * @param feedId - The subscription to set it on.
	 * @param velocity - One of the answers the column's `CHECK` allows.
	 */
	async setVelocity(feedId: string, velocity: string): Promise<UserStore.VelocityResult> {
		if (!isVelocity(velocity)) return { ok: false, reason: "invalid-velocity" };

		let feed = await this.#db.find(feeds, { id: feedId });
		if (feed === null) return { ok: false, reason: "not-following" };

		let updated = await this.#db.update(feeds, { id: feedId }, { velocity });
		await this.#ageOut(updated, Date.now());

		let unread = await this.#db.count(feedItems, {
			where: and({ feed_id: feedId }, isNull("read_at")),
		});

		return { ok: true, feed: toFeedSummary(updated, unread, await this.#folderOf(updated)) };
	}

	/**
	 * One post and the subscription it came from, for the page that reads it on its own.
	 *
	 * The tier comes back with it because extraction is a tier's to allow and the tier
	 * lives on this object's own row: deciding it here means the page renders what the
	 * reader is entitled to rather than what it remembered to check.
	 *
	 * @param itemId - The post to open.
	 * @returns The post, its feed and what the tier allows, or `null` for a post this
	 * reader does not hold.
	 */
	async openPost(itemId: string): Promise<UserStore.OpenedPost | null> {
		let row = await this.#db.find(feedItems, { id: itemId });
		if (row === null) return null;

		let [labels, feed, settingsRow] = await Promise.all([
			this.#tagsFor([row.id]),
			this.getFeed(row.feed_id),
			this.#settingsRow(),
		]);

		return {
			item: { ...toItem(row), tags: labels.get(row.id) ?? [] },
			feed,
			enclosure:
				row.enclosure_url === null
					? null
					: {
							url: row.enclosure_url,
							type: row.enclosure_type,
							length: row.enclosure_length,
						},
			fullText: limitsOf(storedTier(settingsRow)).fullText,
		};
	}

	/**
	 * Keeps a post, or stops keeping it. A kept post is exempt from every rule that deletes
	 * one: the budget's reclamation, its feed's velocity, and the sweep behind both.
	 *
	 * A full shelf refuses rather than making room, because making room would delete the one
	 * thing in this object a reader explicitly asked to keep.
	 *
	 * @param itemId - The post to keep.
	 * @param saved - Whether to keep it; `false` puts it back under whatever rule would take it.
	 */
	async saveItem(itemId: string, saved = true): Promise<UserStore.SaveResult> {
		let item = await this.#db.find(feedItems, { id: itemId });
		if (item === null) return { ok: false, reason: "not-found" };

		if (!saved) {
			/**
			 * The labels go with the keeping. They described something kept, so the post returns
			 * to whatever rule would have taken it, unlabelled.
			 */
			await this.#forgetTags([itemId]);
			await this.#db.update(feedItems, { id: itemId }, { saved_at: null });
			await this.#dropIfSpent(item.feed_id);

			return { ok: true, saved: false };
		}

		if (item.saved_at !== null) return { ok: true, saved: true };

		let tier = storedTier(await this.#settingsRow());
		let kept = await this.#db.count(feedItems, { where: notNull("saved_at") });

		if (!withinLimit(tier, "saved", kept)) {
			return { ok: false, reason: "full", limit: limitRefusal(tier, "saved", kept) };
		}

		await this.#db.update(feedItems, { id: itemId }, { saved_at: Date.now() });

		return { ok: true, saved: true };
	}

	/**
	 * The posts this reader asked to keep, newest first, paged by the keyset every other
	 * list in this app pages by.
	 *
	 * @param options - Where to page from, and how much of it.
	 */
	savedQueue(options: UserStore.TimelineOptions = {}): Promise<UserStore.TimelineResult> {
		return this.#page(this.#timeline().where(notNull("saved_at")), options, true);
	}

	/**
	 * The posts across every followed feed, newest first, narrowed to the read state the
	 * caller chooses and to the words they searched for. It answers the unread ones when
	 * they choose no state, and every post when they search for nothing.
	 *
	 * Each state is served by an index of its own, so paging the read posts of a reader
	 * who has read years of them costs what paging the unread ones does. A search rides on
	 * those same indexes for its ordering and matches the text off the row, which is what
	 * lets the two narrowings compose into one read.
	 *
	 * @param options - Which posts to page, where to page from, and how much of it.
	 * @example let page = await userStore(viewer.id).readingQueue({ readState: "all" });
	 * @example let found = await userStore(viewer.id).readingQueue({ query: "remix" });
	 */
	readingQueue(options: UserStore.ReadingQueueOptions = {}): Promise<UserStore.TimelineResult> {
		let readState = options.readState ?? "unread";
		let pattern = likePattern(options.query ?? "");
		let feedId = options.feedId ?? null;
		let folderId = options.folderId ?? null;

		if (pattern !== null) {
			return this.#searchedPage(
				{
					query: (floor) =>
						new SearchQuery(this.#db, {
							pattern,
							readState,
							floor,
							feedId,
							folderId,
							seek: [],
							orderBy: [],
							limit: null,
						}),
					examined: (from, reachedAt) =>
						this.#countBetween(reachedAt, from, { readState, feedId, folderId }),
					scoped: feedId !== null || folderId !== null,
					withTags: false,
				},
				options,
			);
		}

		let timeline = this.#timeline();
		let narrowing = readStateWhere(readState);
		let narrowed = narrowing === null ? timeline : timeline.where(narrowing);

		if (feedId !== null) narrowed = narrowed.where({ feed_id: feedId });
		if (folderId !== null) narrowed = narrowed.where({ folder_id: folderId });

		return this.#page(narrowed, options);
	}

	/** One feed's posts, read and unread alike, newest first. */
	feedTimeline(
		feedId: string,
		options: UserStore.TimelineOptions = {},
	): Promise<UserStore.TimelineResult> {
		return this.#page(this.#timeline().where({ feed_id: feedId }), options);
	}

	/**
	 * One folder's posts, read and unread alike, newest first — every post of every feed
	 * filed there, as one stream.
	 *
	 * The folder is on the post itself, so this is the page one feed's timeline is with the
	 * leading column changed: one equality, a range on the cursor, and fifty entries walked
	 * from where it lands. Neither the reader's history nor how many feeds are in the folder
	 * enters what a page costs.
	 *
	 * @param folderId - The folder being read.
	 * @param options - Where to page from, and how much of it.
	 */
	folderTimeline(
		folderId: string,
		options: UserStore.TimelineOptions = {},
	): Promise<UserStore.TimelineResult> {
		return this.#page(this.#timeline().where({ folder_id: folderId }), options);
	}

	/**
	 * Every folder the reader has, in the order their names read.
	 *
	 * Unpaged, for the reason the subscription list is: the rail draws all of them, and a
	 * folder list is shorter than the feeds under it.
	 */
	async listFolders(): Promise<UserStore.Folder[]> {
		let rows = await this.#db.findMany(folders, { orderBy: [["title", "asc"]] });
		return rows.map(toFolder);
	}

	/** One folder, or `null` when the reader has none by that id. */
	async getFolder(folderId: string): Promise<UserStore.Folder | null> {
		let row = await this.#db.find(folders, { id: folderId });
		return row === null ? null : toFolder(row);
	}

	/**
	 * Makes a folder to file feeds into. The name is the whole of it: there is no parent to
	 * choose and no position to set, so the list reads in the order the names do.
	 *
	 * @param title - What to call it, which no other folder of this reader's may be called.
	 */
	async createFolder(title: string): Promise<UserStore.FolderResult> {
		let name = title.trim();
		if (name.length === 0) return { ok: false, reason: "invalid-title" };

		let taken = await this.#db.findOne(folders, { where: { title: name } });
		if (taken !== null) return { ok: false, reason: "duplicate-title" };

		let folder = toFolder(await this.#createFolder(name));
		this.#record("job", { event: "user.folder", action: "create", folderId: folder.id });

		return { ok: true, folder };
	}

	/**
	 * Renames a folder, which touches one row: everything else holds its id.
	 *
	 * @param folderId - The folder to rename.
	 * @param title - What to call it instead.
	 */
	async renameFolder(folderId: string, title: string): Promise<UserStore.FolderResult> {
		let name = title.trim();
		if (name.length === 0) return { ok: false, reason: "invalid-title" };

		let folder = await this.#db.find(folders, { id: folderId });
		if (folder === null) return { ok: false, reason: "not-found" };

		let taken = await this.#db.findOne(folders, { where: { title: name } });
		if (taken !== null && taken.id !== folderId) return { ok: false, reason: "duplicate-title" };

		let renamed = await this.#db.update(folders, { id: folderId }, { title: name });
		this.#record("job", { event: "user.folder", action: "rename", folderId });

		return { ok: true, folder: toFolder(renamed) };
	}

	/**
	 * Deletes a folder, which deletes no post: its feeds come back unfiled, exactly as they
	 * were before anybody made it, and their posts come with them.
	 *
	 * @param folderId - The folder to delete.
	 */
	async deleteFolder(folderId: string): Promise<UserStore.FolderRemoval> {
		let folder = await this.#db.find(folders, { id: folderId });
		if (folder === null) return { ok: false, reason: "not-found" };

		let filed = await this.#db.count(feeds, { where: { folder_id: folderId } });

		await this.#db.updateMany(feeds, { folder_id: null }, { where: { folder_id: folderId } });
		await this.#db.updateMany(feedItems, { folder_id: null }, { where: { folder_id: folderId } });
		await this.#db.delete(folders, { id: folderId });

		this.#record("job", {
			event: "user.folder",
			action: "delete",
			folderId,
			feeds: filed,
		});

		return { ok: true, title: folder.title, feeds: filed };
	}

	/**
	 * Files a feed into a folder, or takes it out of the one it is in.
	 *
	 * The subscription moves and its posts move with it, which is what every later page of
	 * that folder is a seek because of. The write is bounded by this feed's share of the
	 * budget and is paid once, where the reader filed the feed, rather than on every page
	 * they read it on.
	 *
	 * Filing by name creates the folder when the reader has none by that name, which is
	 * where most folders come from and what lets an import file a feed under the name its
	 * document used.
	 *
	 * @param feedId - The subscription to file.
	 * @param target - The folder, the name to file it under, or `null` to unfile it.
	 */
	async fileFeed(feedId: string, target: UserStore.FolderTarget): Promise<UserStore.FileResult> {
		let feed = await this.#db.find(feeds, { id: feedId });
		if (feed === null || feed.unfollowed_at !== null) {
			return { ok: false, reason: "not-following" };
		}

		let folder: SelectFolder | null = null;

		if (target !== null && "folderId" in target) {
			folder = await this.#db.find(folders, { id: target.folderId });
			if (folder === null) return { ok: false, reason: "not-found" };
		}

		if (target !== null && "title" in target) {
			let name = target.title.trim();
			if (name.length === 0) return { ok: false, reason: "invalid-title" };
			folder = await this.#folderByTitle(name);
		}

		let folderId = folder === null ? null : folder.id;

		/**
		 * Counted before the write rather than read back from it, for the reason marking a
		 * feed read is: what a write reports is rows of storage, and a post lives in the
		 * table and in whichever partial indexes it qualifies for.
		 */
		let moved = await this.#db.count(feedItems, { where: { feed_id: feedId } });

		await this.#db.update(feeds, { id: feedId }, { folder_id: folderId });
		await this.#db.updateMany(feedItems, { folder_id: folderId }, { where: { feed_id: feedId } });

		this.#record("job", {
			event: "user.folder",
			action: folderId === null ? "unfile" : "file",
			folderId,
			feedId: feed.feed_id,
			items: moved,
		});

		return { ok: true, folder: folder === null ? null : toFolder(folder), moved };
	}

	/**
	 * Every label the reader has, in the order their names read.
	 *
	 * Unpaged, for the reason the folder list is: the picker draws all of them, and the cap
	 * on how many there may be is what keeps that one read.
	 */
	async listTags(): Promise<UserStore.Tag[]> {
		let rows = await this.#db.findMany(tags, { orderBy: [["name", "asc"]] });
		return rows.map(toTag);
	}

	/** One label, or `null` when the reader has none by that id. */
	async getTag(tagId: string): Promise<UserStore.Tag | null> {
		let row = await this.#db.find(tags, { id: tagId });
		return row === null ? null : toTag(row);
	}

	/**
	 * Makes a label to put on the posts the reader keeps.
	 *
	 * Uniqueness is over the folded name, so a reader who already has `Rust` and asks for
	 * `rust` is told they have it and which one it is rather than given a second row nothing
	 * could tell apart.
	 *
	 * @param name - What to call it, which no other label of this reader's may be called.
	 */
	async createTag(name: string): Promise<UserStore.TagResult> {
		let entitled = await this.#mayLabel();
		if (!entitled) return { ok: false, reason: "not-entitled" };

		let folded = foldTagName(name);
		if (folded === null) return { ok: false, reason: "tag-name-invalid" };

		let taken = await this.#db.findOne(tags, { where: { slug: folded.slug } });
		if (taken !== null) return { ok: false, reason: "tag-exists", tag: toTag(taken) };

		let held = await this.#db.count(tags);
		if (held >= TAG_LIMIT) {
			this.#record("job", { event: "user.tag.refused", reason: "tag-limit", tags: held });
			return { ok: false, reason: "tag-limit" };
		}

		let tag = toTag(await this.#createTag(folded.name, folded.slug));
		this.#record("job", { event: "user.tag.created", tagId: tag.id, tags: held + 1, items: 0 });

		return { ok: true, tag };
	}

	/**
	 * Renames a label, which writes one row and rewrites no post: everything else holds it
	 * by its id, which a name never was.
	 *
	 * A name whose folded form is another label's is refused and names that one. Merging is
	 * a different verb — it is destructive, the two sets could never be told apart again,
	 * and a reader who wanted it asked for a rename.
	 *
	 * @param tagId - The label to rename.
	 * @param name - What to call it instead.
	 */
	async renameTag(tagId: string, name: string): Promise<UserStore.TagResult> {
		let entitled = await this.#mayLabel();
		if (!entitled) return { ok: false, reason: "not-entitled" };

		let folded = foldTagName(name);
		if (folded === null) return { ok: false, reason: "tag-name-invalid" };

		let tag = await this.#db.find(tags, { id: tagId });
		if (tag === null) return { ok: false, reason: "not-found" };

		let taken = await this.#db.findOne(tags, { where: { slug: folded.slug } });
		if (taken !== null && taken.id !== tagId) {
			return { ok: false, reason: "tag-exists", tag: toTag(taken) };
		}

		let renamed = await this.#db.update(
			tags,
			{ id: tagId },
			{ name: folded.name, slug: folded.slug },
		);

		let items = await this.#db.count(itemTags, { where: { tag_id: tagId } });
		this.#record("job", {
			event: "user.tag.renamed",
			tagId,
			tags: await this.#db.count(tags),
			items,
		});

		return { ok: true, tag: toTag(renamed) };
	}

	/**
	 * Deletes a label, which deletes no post and unsaves none: losing the label is not
	 * losing the thing it was on, and a reader who wanted the posts gone unsaves them.
	 *
	 * @param tagId - The label to delete.
	 */
	async deleteTag(tagId: string): Promise<UserStore.TagRemoval> {
		let tag = await this.#db.find(tags, { id: tagId });
		if (tag === null) return { ok: false, reason: "not-found" };

		let items = await this.#db.count(itemTags, { where: { tag_id: tagId } });

		await this.#db.deleteMany(itemTags, { where: { tag_id: tagId } });
		await this.#db.delete(tags, { id: tagId });

		this.#record("job", {
			event: "user.tag.deleted",
			tagId,
			tags: await this.#db.count(tags),
			items,
		});

		return { ok: true, name: tag.name, items };
	}

	/**
	 * Puts a label on a post, keeping the post as it does.
	 *
	 * One gesture rather than two verbs with an order to get wrong: a label is a reason to
	 * have kept something, and a reason without the keeping is a promise this design cannot
	 * honour — the post would sit under a rule that may take it tomorrow. So labelling the
	 * post past the shelf's last place is refused for exactly the reason keeping it is, and
	 * nothing is written.
	 *
	 * @param itemId - The post to label.
	 * @param target - The label, by id, or the name to label it with.
	 * @param create - Whether a name the reader has no label for makes one. A rule applies
	 * labels and may not create them, so no rule grows the list past its cap, invents a name
	 * that passed no validation, or resurrects a deleted one.
	 */
	async tagItem(
		itemId: string,
		target: { tagId: string } | { name: string },
		create = true,
	): Promise<UserStore.TagItemResult> {
		let entitled = await this.#mayLabel();
		if (!entitled) return { ok: false, reason: "not-entitled" };

		let item = await this.#db.find(feedItems, { id: itemId });
		if (item === null) return { ok: false, reason: "not-found" };

		let tag = await this.#resolveTag(target, create);
		if (!tag.ok) return tag;

		let carried = await this.#db.count(itemTags, { where: { item_id: itemId } });
		let already = await this.#db.find(itemTags, { tag_id: tag.tag.id, item_id: itemId });

		if (already === null && carried >= TAGS_PER_ITEM) {
			this.#record("job", { event: "user.tag.refused", reason: "post-tag-limit", tags: carried });
			return { ok: false, reason: "post-tag-limit" };
		}

		/**
		 * Kept before it is labelled, so a refused shelf leaves no label on a post the rules
		 * may take. A post already kept passes this without touching the mark.
		 */
		let saved = item.saved_at !== null;
		if (!saved) {
			let kept = await this.saveItem(itemId, true);

			if (!kept.ok) {
				if (kept.reason === "full") {
					this.#record("job", { event: "user.tag.refused", reason: "saved-full", tags: carried });
					return { ok: false, reason: "saved-full", limit: kept.limit };
				}

				return { ok: false, reason: "not-found" };
			}
		}

		/**
		 * The composite primary key makes a second application a no-op the database decides,
		 * so this is written once whether or not the label was already there.
		 */
		if (already === null) {
			await this.#db.create(itemTags, {
				tag_id: tag.tag.id,
				item_id: itemId,
				published_at: item.published_at,
				created_at: Date.now(),
			});
		}

		this.#record("job", {
			event: "user.item.tagged",
			tagId: tag.tag.id,
			itemId,
			saved: !saved,
		});

		return { ok: true, tag: tag.tag, saved: !saved };
	}

	/**
	 * Takes one label off one post, which deletes neither. A label applied by a rule is the
	 * same row as one applied by hand, so taking it off is the same write: rules run on
	 * arrival, and nothing re-applies a label to a post already ruled on.
	 *
	 * @param itemId - The post to take it off.
	 * @param tagId - The label to remove.
	 */
	async untagItem(itemId: string, tagId: string): Promise<{ ok: true; removed: boolean }> {
		let row = await this.#db.find(itemTags, { tag_id: tagId, item_id: itemId });
		if (row === null) return { ok: true, removed: false };

		await this.#db.delete(itemTags, { tag_id: tagId, item_id: itemId });

		return { ok: true, removed: true };
	}

	/**
	 * The kept posts under one label, newest first, paged by the keyset every other list in
	 * this app pages by.
	 *
	 * The seek is written against the join table's own copies of the ordering columns, which
	 * is what makes a page a range scan down one index rather than a filter, a join and a
	 * sort into a temporary b-tree — while the projection returns the post's own `id` and
	 * `published_at` under those names, so this list mints the app's one cursor shape rather
	 * than a second spelling no other list could follow.
	 *
	 * @param tagId - The label being read.
	 * @param options - Where to page from, and how much of it.
	 */
	taggedQueue(
		tagId: string,
		options: UserStore.ReadingQueueOptions = {},
	): Promise<UserStore.TimelineResult> {
		let pattern = likePattern(options.query ?? "");

		if (pattern === null) {
			return this.#page(
				new TaggedQuery(this.#db, {
					tagId,
					pattern: null,
					floor: null,
					seek: [],
					orderBy: [],
					limit: null,
				}),
				options,
				true,
			);
		}

		return this.#searchedPage(
			{
				query: (floor) =>
					new TaggedQuery(this.#db, {
						tagId,
						pattern,
						floor,
						seek: [],
						orderBy: [],
						limit: null,
					}),
				examined: (from, reachedAt) => this.#countTaggedBetween(tagId, reachedAt, from),
				scoped: true,
				withTags: true,
			},
			options,
		);
	}

	/**
	 * Every rule the reader has written, in the order they wrote them.
	 *
	 * Read whole, because the table is capped at a few dozen rows: there is no paging, no
	 * search over it and no index beyond the primary key, and the list a reader reasons
	 * about is the list they can see at once.
	 */
	/**
	 * The queries the reader kept, in the order their names read, which is the order the
	 * rail draws them in.
	 *
	 * Unpaged and countless. The table is capped at {@link SAVED_SEARCH_LIMIT} rows, and a
	 * number beside each entry would be a scan per entry on every page of the app, paid by
	 * readers who are not searching.
	 */
	async listSearches(): Promise<UserStore.SavedSearch[]> {
		let rows = await this.#db.findMany(searches, {
			orderBy: [
				["name", "asc"],
				["id", "asc"],
			],
		});

		return rows.map(toSavedSearch);
	}

	/** One saved search, or `null` when the reader has none by that id. */
	async getSearch(searchId: string): Promise<UserStore.SavedSearch | null> {
		let row = await this.#db.find(searches, { id: searchId });
		return row === null ? null : toSavedSearch(row);
	}

	/**
	 * Keeps a query, so a search worth typing twice is typed once.
	 *
	 * A full shelf refuses rather than making room: the twenty-first is the one the reader
	 * is asking for, and evicting one of the twenty they chose would answer a request they
	 * did not make.
	 *
	 * @param draft - The name, the words, the read state and whatever feed it is scoped to.
	 */
	async createSearch(draft: UserStore.SavedSearchDraft): Promise<UserStore.SavedSearchResult> {
		let checked = await this.#searchDraft(draft);
		if (!checked.ok) return checked;

		let held = await this.#db.count(searches);
		if (held >= SAVED_SEARCH_LIMIT) {
			this.#record("job", { event: "user.search.refused", reason: "full", searches: held });
			return { ok: false, reason: "full", limit: SAVED_SEARCH_LIMIT };
		}

		let written = await this.#db.create(
			searches,
			{
				id: TypeID.fromUUID("search", generateUUID()).toString(),
				name: checked.name,
				query: checked.query,
				read_state: checked.readState,
				feed_id: checked.feedId,
			},
			{ returnRow: true },
		);

		this.#record("job", {
			event: "user.search.saved",
			searchId: written.id,
			searches: held + 1,
			readState: checked.readState,
			scoped: checked.feedId !== null,
		});

		return { ok: true, search: toSavedSearch(written) };
	}

	/**
	 * Rewrites a saved search, which changes the address the rail draws and nothing else:
	 * the row holds a narrowing, so there is no stored result for it to disagree with.
	 *
	 * @param searchId - The saved search to rewrite.
	 * @param draft - What it holds instead.
	 */
	async updateSearch(
		searchId: string,
		draft: UserStore.SavedSearchDraft,
	): Promise<UserStore.SavedSearchResult> {
		let stored = await this.#db.find(searches, { id: searchId });
		if (stored === null) return { ok: false, reason: "not-found" };

		let checked = await this.#searchDraft(draft, searchId);
		if (!checked.ok) return checked;

		let written = await this.#db.update(
			searches,
			{ id: searchId },
			{
				name: checked.name,
				query: checked.query,
				read_state: checked.readState,
				feed_id: checked.feedId,
			},
		);

		return { ok: true, search: toSavedSearch(written) };
	}

	/** Forgets a saved search, which deletes no post and changes no list but the rail's. */
	async deleteSearch(searchId: string): Promise<UserStore.SavedSearchRemoval> {
		let stored = await this.#db.find(searches, { id: searchId });
		if (stored === null) return { ok: false, reason: "not-found" };

		await this.#db.delete(searches, { id: searchId });
		this.#record("job", { event: "user.search.forgotten", searchId });

		return { ok: true };
	}

	/**
	 * A submitted saved search, as the columns take it, or the refusal explaining why it is
	 * not one. Every path that writes the table goes through it, so a name nobody can read
	 * and a query that narrows nothing are refused wherever they are submitted from.
	 *
	 * @param draft - What was submitted.
	 * @param excluding - A saved search the name may already belong to, which is the one
	 * being rewritten.
	 */
	async #searchDraft(
		draft: UserStore.SavedSearchDraft,
		excluding: string | null = null,
	): Promise<
		| {
				ok: true;
				name: string;
				query: string;
				readState: UserStore.ReadState;
				feedId: string | null;
		  }
		| { ok: false; reason: UserStore.SavedSearchFailure }
	> {
		let name = draft.name.trim();
		if (name.length === 0 || name.length > SEARCH_NAME_LENGTH) {
			return { ok: false, reason: "invalid-name" };
		}

		/** The same emptiness the queue reads as no narrowing at all, refused as a saved one. */
		if (likePattern(draft.query) === null) return { ok: false, reason: "invalid-query" };

		let taken = await this.#db.findOne(searches, { where: { name } });
		if (taken !== null && taken.id !== excluding) return { ok: false, reason: "duplicate-name" };

		let feedId = draft.feedId;
		if (feedId !== null && (await this.#db.find(feeds, { id: feedId })) === null) {
			feedId = null;
		}

		return {
			ok: true,
			name,
			query: draft.query,
			readState: isReadState(draft.readState) ? draft.readState : "all",
			feedId,
		};
	}

	async listRules(): Promise<UserStore.Rule[]> {
		let rows = await this.#db.findMany(rules, {
			orderBy: [
				["created_at", "asc"],
				["id", "asc"],
			],
		});

		return rows.map(toRule);
	}

	/** One rule, or `null` when the reader has none by that id. */
	async getRule(ruleId: string): Promise<UserStore.Rule | null> {
		let row = await this.#db.find(rules, { id: ruleId });
		return row === null ? null : toRule(row);
	}

	/**
	 * Writes a rule, which acts on tomorrow's arrivals and reaches back into nothing.
	 *
	 * The count is checked here rather than in the form, because the form is one of several
	 * ways to reach this object and the cap is a property of the reader rather than of the
	 * page they happened to use.
	 *
	 * @param draft - The field, the text and the action, with the feed it is scoped to.
	 */
	async createRule(draft: UserStore.RuleDraft): Promise<UserStore.RuleResult> {
		let tier = storedTier(await this.#settingsRow());
		if (!limitsOf(tier).filterRules) return { ok: false, reason: "not-entitled" };

		let checked = await this.#ruleDraft(draft);
		if (!checked.ok) return checked;

		let held = await this.#db.count(rules);
		if (!withinLimit(tier, "rules", held)) {
			this.#record("job", { event: "user.rule.refused", reason: "rule-limit", rules: held });
			return { ok: false, reason: "rule-limit", limit: limitRefusal(tier, "rules", held) };
		}

		let written = await this.#db.create(
			rules,
			{
				id: TypeID.fromUUID("rule", generateUUID()).toString(),
				feed_id: checked.feedId,
				field: checked.field,
				value: checked.value,
				action: checked.action,
				matches: 0,
				last_matched_at: null,
			},
			{ returnRow: true },
		);

		this.#record("job", {
			event: "user.rule.created",
			ruleId: written.id,
			field: checked.field,
			action: checked.action,
			rules: held + 1,
		});

		return { ok: true, rule: toRule(written) };
	}

	/**
	 * Rewrites a rule, which changes what arrives from here and nothing the reader holds.
	 *
	 * The counters are left where they are: they measure the rule, and a rule whose term was
	 * corrected is the same rule the reader has been watching.
	 *
	 * @param ruleId - The rule to rewrite.
	 * @param draft - What it should say instead.
	 */
	async updateRule(ruleId: string, draft: UserStore.RuleDraft): Promise<UserStore.RuleResult> {
		let tier = storedTier(await this.#settingsRow());
		if (!limitsOf(tier).filterRules) return { ok: false, reason: "not-entitled" };

		let existing = await this.#db.find(rules, { id: ruleId });
		if (existing === null) return { ok: false, reason: "not-found" };

		let checked = await this.#ruleDraft(draft);
		if (!checked.ok) return checked;

		let written = await this.#db.update(
			rules,
			{ id: ruleId },
			{
				feed_id: checked.feedId,
				field: checked.field,
				value: checked.value,
				action: checked.action,
			},
		);

		return { ok: true, rule: toRule(written) };
	}

	/**
	 * Deletes a rule, which deletes no post: a rule that dropped posts never wrote them, and
	 * one that marked or flagged them leaves those marks where they are.
	 *
	 * @param ruleId - The rule to delete.
	 */
	async deleteRule(ruleId: string): Promise<UserStore.RuleRemoval> {
		let existing = await this.#db.find(rules, { id: ruleId });
		if (existing === null) return { ok: false, reason: "not-found" };

		await this.#db.delete(rules, { id: ruleId });
		this.#record("job", { event: "user.rule.deleted", ruleId, rules: await this.#db.count(rules) });

		return { ok: true };
	}

	/**
	 * What a candidate rule would have caught among the reader's newest posts.
	 *
	 * This is the whole of the retroactivity this feature has, and it is read-only: nothing
	 * is written, no rule is created and no post is touched. It is also the answer to "why is
	 * this rule not working", since it matches against posts the reader can still see.
	 *
	 * @param draft - The candidate, which may never have been written.
	 */
	async previewRule(draft: UserStore.RuleDraft): Promise<UserStore.RulePreview> {
		let checked = await this.#ruleDraft(draft);
		if (!checked.ok) return checked;

		let scanned = await this.#newestPosts(checked.feedId);
		let matched = scanned.filter((row) =>
			matchesRule(toRuleSubject(row), { field: checked.field, value: foldRuleText(checked.value) }),
		);

		/** The terms a reader filters by are their own words, so the event carries none. */
		this.#record("job", {
			event: "user.rule.preview",
			field: checked.field,
			action: checked.action,
			scanned: scanned.length,
			matched: matched.length,
		});

		let items = matched.map(toItem);

		return {
			ok: true,
			scanned: scanned.length,
			matched: matched.length,
			items,
			feeds: await this.#feedRefs(items),
		};
	}

	/**
	 * Applies a candidate's action to the posts it matched among the reader's newest ones.
	 *
	 * It is bounded by the page the preview was, so it is an act taken on specific posts the
	 * reader looked at rather than a rule granted the power to reach backwards, and it runs
	 * whether or not the candidate was ever saved as a rule.
	 *
	 * @param draft - The candidate whose matches are being acted on.
	 */
	async applyPreviewedRule(draft: UserStore.RuleDraft): Promise<UserStore.RuleSweep> {
		let checked = await this.#ruleDraft(draft);
		if (!checked.ok) return checked;

		let scanned = await this.#newestPosts(checked.feedId);
		let matched = scanned.filter((row) =>
			matchesRule(toRuleSubject(row), { field: checked.field, value: foldRuleText(checked.value) }),
		);

		let ids = matched.map((row) => row.id);
		let now = Date.now();

		if (checked.action === "drop") {
			await this.#forgetTags(ids);

			for (let batch of chunked(ids, IDS_PER_LOOKUP)) {
				await this.#db.deleteMany(feedItems, { where: inList("id", batch) });
			}
		} else {
			let mark = checked.action === "mark_read" ? { read_at: now } : { flagged_at: now };

			for (let batch of chunked(ids, IDS_PER_LOOKUP)) {
				await this.#db.updateMany(feedItems, mark, { where: inList("id", batch) });
			}
		}

		this.#record("job", {
			event: "user.rule.applied",
			field: checked.field,
			action: checked.action,
			scanned: scanned.length,
			matched: matched.length,
		});

		return { ok: true, scanned: scanned.length, matched: matched.length, affected: ids.length };
	}

	/**
	 * Everything the notification surface draws: how the reader is reached, the window they
	 * are left alone in, how many feeds they opted in and every device they registered.
	 */
	async notifications(): Promise<UserStore.Notifications> {
		let row = await this.#settingsRow();
		return await this.#notifications(row);
	}

	/**
	 * Decides how a notified feed reaches the reader.
	 *
	 * Email is refused here rather than hidden in the form, because the switch and the plan
	 * can disagree: a lapse leaves a reader's stored answer alone and stops the sending, and
	 * the refusal is what lets the page say so.
	 *
	 * @param input - Which channels to turn on.
	 */
	async setChannels(input: { push: boolean; email: boolean }): Promise<UserStore.ChannelResult> {
		let row = await this.#settingsRow();

		if (input.email && !limitsOf(leasedTier(row, Date.now())).emailDigests) {
			return { ok: false, reason: "not-entitled" };
		}

		let updated = await this.#db.update(
			settings,
			{ id: SETTINGS_ID },
			{ notify_push: input.push, notify_email: input.email },
		);

		return { ok: true, notifications: await this.#notifications(updated) };
	}

	/**
	 * Sets the window the reader is left alone in, in their own hours.
	 *
	 * An hour outside the day is clamped rather than refused, so a submission nothing on the
	 * page could have produced still leaves a window somebody can read.
	 *
	 * @param input - Whether the window applies, and the two local hours it runs between.
	 */
	async setQuietHours(input: UserStore.QuietHours): Promise<UserStore.Notifications> {
		await this.#settingsRow();

		let updated = await this.#db.update(
			settings,
			{ id: SETTINGS_ID },
			{
				quiet_hours: input.enabled,
				quiet_from: clampHour(input.from, QUIET_FROM_HOUR),
				quiet_to: clampHour(input.to, QUIET_TO_HOUR),
			},
		);

		return await this.#notifications(updated);
	}

	/**
	 * Records the zone quiet hours are computed in, as the only participant that knows it
	 * reported it. A reader signed in from two zones keeps whichever opened the app last, on
	 * every device, which is acceptable because a suppressed notification is held rather
	 * than dropped.
	 *
	 * @param timeZone - An IANA name, as `Intl.DateTimeFormat` resolved it.
	 */
	async setTimeZone(timeZone: string): Promise<boolean> {
		let row = await this.#settingsRow();
		if (!isTimeZone(timeZone) || timeZone === row.time_zone) return false;

		await this.#db.update(settings, { id: SETTINGS_ID }, { time_zone: timeZone });

		return true;
	}

	/**
	 * Records a browser the reader asked to be reached on, or updates the one already
	 * holding that endpoint.
	 *
	 * A browser that re-subscribes hands back the endpoint it already had, so this is an
	 * upsert on it: a reader signing in twice on one device keeps one row and receives one
	 * notification rather than two.
	 *
	 * @param input - The endpoint and key material the Push API handed the browser.
	 */
	async registerDevice(input: UserStore.DeviceRegistration): Promise<{ devices: number }> {
		await this.#settingsRow();

		let existing = await this.#db.findOne(pushSubscriptions, {
			where: { endpoint: input.endpoint },
		});

		let values = {
			p256dh: input.p256dh,
			auth: input.auth,
			user_agent: input.userAgent ?? null,
			locale: input.locale ?? "en",
			failure_count: 0,
		};

		if (existing === null) {
			await this.#db.create(pushSubscriptions, {
				id: TypeID.fromUUID("push", generateUUID()).toString(),
				endpoint: input.endpoint,
				...values,
			});
		} else {
			await this.#db.update(pushSubscriptions, { id: existing.id }, values);
		}

		let devices = await this.#db.count(pushSubscriptions, {});
		this.#record("job", { event: "push.registered", devices });

		return { devices };
	}

	/** Forgets one device, which is how a reader revokes a browser they no longer read in. */
	async forgetDevice(deviceId: string): Promise<boolean> {
		return await this.#db.delete(pushSubscriptions, { id: deviceId });
	}

	/**
	 * Decides whether a check that finds posts in one subscription is worth interrupting the
	 * reader for. It is a judgement about a publisher, so it is stored on the subscription
	 * and shared by every device.
	 *
	 * @param feedId - The subscription being opted in or out.
	 * @param wanted - Whether to hear about it.
	 */
	async setFeedNotify(feedId: string, wanted = true): Promise<UserStore.NotifyFeedResult> {
		let feed = await this.#db.find(feeds, { id: feedId });
		if (feed === null) return { ok: false, reason: "not-following" };

		let updated = await this.#db.update(feeds, { id: feedId }, { notify: wanted });

		return { ok: true, notify: updated.notify };
	}

	/**
	 * Decides whether this feed's links carry the address exactly as the publisher wrote it.
	 * It is an answer about one publisher's server rather than about the reader, so it is
	 * stored on the subscription and holds wherever that feed's posts are drawn.
	 *
	 * @param feedId - The subscription being answered for.
	 * @param wanted - Whether to render its links unmodified.
	 */
	async setFeedLinkParameters(
		feedId: string,
		wanted = true,
	): Promise<UserStore.LinkParametersResult> {
		let feed = await this.#db.find(feeds, { id: feedId });
		if (feed === null) return { ok: false, reason: "not-following" };

		let updated = await this.#db.update(feeds, { id: feedId }, { keep_link_parameters: wanted });

		return { ok: true, keepLinkParameters: updated.keep_link_parameters };
	}

	/**
	 * Pins a subscription, or takes the pin off, so the feeds a reader never wants to miss
	 * are drawn above the river rather than at whatever letter their names start with.
	 *
	 * @param feedId - The subscription to pin.
	 * @param pinned - Whether to pin it; `false` puts it back among the rest.
	 */
	async pinFeed(feedId: string, pinned = true): Promise<UserStore.PinResult> {
		let feed = await this.#db.find(feeds, { id: feedId });
		if (feed === null || feed.unfollowed_at !== null) {
			return { ok: false, reason: "not-following" };
		}

		if (!pinned) {
			if (feed.pinned_at !== null) {
				await this.#db.update(feeds, { id: feedId }, { pinned_at: null });
			}

			this.#record("job", { event: "user.feed.pinned", feedId: feed.feed_id, pinned: false });

			return { ok: true, pinned: false };
		}

		if (feed.pinned_at !== null) return { ok: true, pinned: true };

		let held = await this.#db.count(feeds, {
			where: and(isNull("unfollowed_at"), notNull("pinned_at")),
		});

		if (held >= PIN_LIMIT) return { ok: false, reason: "pin-limit", allowed: PIN_LIMIT };

		await this.#db.update(feeds, { id: feedId }, { pinned_at: Date.now() });
		this.#record("job", { event: "user.feed.pinned", feedId: feed.feed_id, pinned: true });

		return { ok: true, pinned: true };
	}

	/**
	 * The strip above the river: every pinned feed, and the newest few posts of it the
	 * reader has not read.
	 *
	 * Its own question, bounded by the pins rather than by how much anybody published, and
	 * carrying no cursor. The river beneath it runs the statement it runs today under the
	 * predicate it runs today, so a pinned feed's newest post appears in both — one
	 * screenful of duplication rather than a predicate the reader can change mid-scroll,
	 * which is the class of bug the keyset design exists to make impossible.
	 */
	async pinnedStrip(): Promise<UserStore.PinnedFeed[]> {
		let pinned = await this.#db.findMany(feeds, {
			where: and(isNull("unfollowed_at"), notNull("pinned_at")),
			/** Pin order is an ordering the reader produced, which is what the timestamp is for. */
			orderBy: [
				["pinned_at", "asc"],
				["id", "asc"],
			],
			limit: PIN_LIMIT,
		});

		let strip: UserStore.PinnedFeed[] = [];

		for (let feed of pinned) {
			/** One seek per pinned feed down the index that already leads with the feed. */
			let rows = await this.#timeline()
				.where(and({ feed_id: feed.id }, isNull("read_at")))
				.orderBy("published_at", "desc")
				.orderBy("id", "desc")
				.limit(PINNED_POSTS)
				.all();

			strip.push({
				feed: {
					id: feed.id,
					title: feed.title,
					siteUrl: feed.site_url,
					keepLinkParameters: feed.keep_link_parameters,
				},
				items: rows.map(toItem),
			});
		}

		return strip;
	}

	/**
	 * Writes down what one feed publishes, as that feed's own object measured it.
	 *
	 * The measurement is taken once per feed and shared by everybody following it, so the
	 * reader is asked nothing and nothing is recomputed here — a local recount would measure
	 * this reader's velocity as much as the publisher's rate.
	 *
	 * @param feedId - The subscription the rate belongs to.
	 * @param postsPerDay - What the feed publishes, or `null` before anything is known.
	 */
	async recordPublishingRate(feedId: string, postsPerDay: number | null): Promise<void> {
		if (postsPerDay === null) return;

		let feed = await this.#db.find(feeds, { id: feedId });
		if (feed === null || feed.posts_per_day === postsPerDay) return;

		await this.#db.update(feeds, { id: feedId }, { posts_per_day: postsPerDay });
	}

	/** Marks one post read or unread. `false` when no such post is stored. */
	async markRead(itemId: string, read = true): Promise<boolean> {
		let written = await this.#db.updateMany(
			feedItems,
			{ read_at: read ? Date.now() : null },
			{ where: { id: itemId } },
		);

		return (written.affectedRows ?? 0) > 0;
	}

	/**
	 * Runs whatever the three due times say is due, advances them, and arms the next wake.
	 *
	 * What a wake is for is derived rather than remembered: the alarm carries no identity,
	 * so leftovers, a scheduled check and the retention sweep each have one due time with
	 * one writer, and no job can arm a wake another silently consumes. A wake that finds
	 * nothing due re-arms and returns, which is a clock moving under a schedule.
	 *
	 * Leftovers run first, because leftovers are work a reader is already waiting for.
	 *
	 * It never rejects. A rejected alarm is retried by the platform, which would re-run a
	 * check against objects that already answered.
	 */
	override async alarm(): Promise<void> {
		let now = Date.now();
		let row = await this.#settingsRow();

		/** An expired lease is free here, before anything is scheduled from it. */
		let tier = leasedTier(row, now);
		let interval = checkIntervalFor(tier, row.last_opened_at, now);

		let due = {
			catchUp: isDue(row.next_catch_up_at, now),
			check: isDue(row.next_check_at, now),
			sweep: isDue(row.next_sweep_at, now),
		};

		try {
			if (due.catchUp) {
				await this.#db.update(settings, { id: SETTINGS_ID }, { next_catch_up_at: null });
				await this.synchronize(undefined, "scheduled");
			}

			if (due.check) await this.#scheduledCheck(tier);

			if (due.sweep) await this.#runSweep(Date.now());
		} catch (error) {
			console.error("reader alarm failed", error);
		}

		this.#record("alarm", {
			event: "user.scheduled",
			tier,
			interval,
			dormancy: dormancyMultiplier(row.last_opened_at, now),
			due: Object.entries(due)
				.filter(([, wasDue]) => wasDue)
				.map(([job]) => job)
				.join(","),
		});

		/**
		 * Re-armed whatever the jobs did, and from the row as they left it, since a due time
		 * advanced on a path that does not arm leaves an object that has stopped waking and
		 * shows nothing but silence.
		 */
		await this.#reschedule(await this.#settingsRow());
	}

	/**
	 * The reader's settings row, written on first use when nothing has written it yet.
	 *
	 * Every path that touches settings comes through here, so the row's existence stops
	 * depending on which entry point reached the object first. A session outlives a
	 * deploy and there is no sign-up step, so a reader can hold an object that following
	 * a feed created and no sign-in ever provisioned: reading their cadence answered
	 * nothing, writing it failed on the missing row, and stamping a refresh matched none.
	 *
	 * @param subject - The reader this object holds, for a caller that already knows it.
	 */
	async #settingsRow(subject: string = this.#subject()): Promise<SelectSettings> {
		let stored = await this.#db.find(settings, { id: SETTINGS_ID });
		if (stored !== null) return stored;

		return await this.#db.create(
			settings,
			{ id: SETTINGS_ID, subject, last_refreshed_at: null },
			{ returnRow: true },
		);
	}

	/**
	 * Whether this reader has room for another subscription, answering the refusal to
	 * report when they have not and `null` when they have.
	 *
	 * Both numbers are rows of this object, so the comparison is one local query in code
	 * that was going to read the count anyway.
	 */
	async #roomForFeed(): Promise<UserStore.Limit | null> {
		let tier = storedTier(await this.#settingsRow());
		let followed = await this.#db.count(feeds, { where: isNull("unfollowed_at") });

		if (withinLimit(tier, "feeds", followed)) return null;

		return limitRefusal(tier, "feeds", followed);
	}

	/**
	 * Posts this reader's object holds before it reclaims, and then refuses, which is the
	 * budget of the tier they are on.
	 *
	 * The tier is read from this object's own settings, so the sweep and the back-pressure
	 * check decide from a local row rather than from a billing store that can be slow or
	 * absent. A tier recorded too low pauses a feed and deletes nothing, which is what makes
	 * a copied value safe to act on here.
	 *
	 * The scale on top of it takes the reader as its subject, because the person who meets
	 * a budget is the one who notices: a rule can widen it for them without moving what
	 * anybody else on their tier was sold.
	 */
	async #budget(tier?: Tier): Promise<number> {
		let applied = tier ?? storedTier(await this.#settingsRow());
		let client = await flagsFor(this.#subject());
		let scale = await client.get(features.readerBudgetScale);

		return Math.max(1, Math.round(limitsOf(applied).posts * scale));
	}

	/**
	 * Writes one wide event about what this object just did.
	 *
	 * Opened here rather than read off the request, because a Durable Object answers in its
	 * own context and the log the Worker opened for the request does not reach it. Counts
	 * and feed identifiers only: nothing about what the reader reads, beyond the subject
	 * this object is already named for.
	 *
	 * @param kind - What kind of invocation produced this, which the platform groups by.
	 * @param fields - The event's name and its measurements.
	 */
	#record(kind: Log.Kind, fields: Log.Fields): void {
		logger.open(kind, fields).emit();
	}

	/**
	 * The reader this object holds, which is the name it was addressed by.
	 *
	 * Only an id built from a raw hex string or minted unique carries no name, and this
	 * object's rows are keyed on the reader's subject, so such an id leaves nothing to
	 * write one as. That is a mistake in how the object was reached rather than news
	 * about the reader, so it is raised where it was made.
	 */
	#subject(): string {
		let name = this.ctx.id.name;

		if (name === undefined) {
			throw new Error("UserDO must be addressed by name: its rows are keyed on that subject");
		}

		return name;
	}

	/**
	 * Records that this reader's posts were just brought up to date, which is what the
	 * settings page reports back to them.
	 */
	async #stampRefreshed(now: number): Promise<void> {
		await this.#settingsRow();
		await this.#db.update(settings, { id: SETTINGS_ID }, { last_refreshed_at: now });
	}

	/**
	 * Says leftovers are due in a minute, and arms whatever that makes earliest.
	 *
	 * It writes a due time rather than the alarm, so a catch-up a minute out cannot consume
	 * the wake a scheduled check was armed for and leave nothing to re-arm it.
	 */
	async #armCatchUp(): Promise<void> {
		await this.#db.update(
			settings,
			{ id: SETTINGS_ID },
			{ next_catch_up_at: Date.now() + CATCH_UP_MS },
		);

		await this.#arm();
	}

	/**
	 * Points the object's one alarm at the earliest due time it is holding, and clears it
	 * when it is holding none — which is what makes a reader on a tier that buys no wake
	 * cost their storage and nothing else.
	 */
	async #arm(): Promise<void> {
		let row = await this.#settingsRow();
		let next = earliestDue([row.next_catch_up_at, row.next_check_at, row.next_sweep_at]);

		if (next === null) {
			await this.ctx.storage.deleteAlarm();
			return;
		}

		await this.ctx.storage.setAlarm(next);
	}

	/**
	 * Writes the due times this reader's tier and last open imply, and arms the alarm at
	 * the earliest of them.
	 *
	 * The check lands on a grid phase-shifted by the subject, so recomputing it on every
	 * open answers the same moment rather than pushing the wake away from a reader who
	 * keeps opening the app. The sweep's due time is kept where it is for the same reason,
	 * and set only when the tier has a wake to run it on.
	 *
	 * @param row - The settings row as the caller's own writes left it.
	 */
	async #reschedule(row: SelectSettings): Promise<void> {
		let now = Date.now();
		let interval = checkIntervalFor(leasedTier(row, now), row.last_opened_at, now);

		await this.#db.update(
			settings,
			{ id: SETTINGS_ID },
			{
				next_check_at: interval === null ? null : nextCheckAt(this.#subject(), interval, now),
				next_sweep_at: interval === null ? null : (row.next_sweep_at ?? now + SWEEP_INTERVAL_MS),
			},
		);

		await this.#arm();
	}

	/**
	 * The freshness comparison a reader pays for, run without a reader waiting on it.
	 *
	 * Exactly what an open does, minus the timeline nobody is there to read: the heads are
	 * read once, in bulk, and the stale list they derive is handed straight to the same
	 * bounded synchronization a request works under. The bounds do not move because nobody
	 * is waiting — a bigger batch holds this single-threaded object longer and widens the
	 * burst the feed objects take — so leftovers go to the catch-up as they always do.
	 *
	 * @param tier - The tier the lease left the reader on, for the event this writes.
	 */
	async #scheduledCheck(tier: Tier): Promise<void> {
		let started = Date.now();
		let followed = await this.#subscriptions();
		let heads = await readHeads(followed.map((feed) => feed.feed_id));

		let stale = followed.filter((feed) => (heads.get(feed.feed_id) ?? 0) > feed.cursor);

		this.#record("alarm", {
			event: "user.freshness",
			trigger: "scheduled",
			tier,
			feeds: followed.length,
			reads: Math.ceil(followed.length / KEYS_PER_BULK_READ),
			stale: stale.length,
			durationMs: Date.now() - started,
		});

		/**
		 * A check that found nothing still answers for whatever an earlier one deferred: the
		 * summary is about everything since the last notification rather than about this
		 * check, so a gap or a quiet window that has since passed is honoured here.
		 */
		if (stale.length === 0) {
			await this.#notify();
			return;
		}

		await this.#runSync(stale, "scheduled");
	}

	/**
	 * The notification surface as one read, from a settings row the caller already has.
	 *
	 * `emailAllowed` is decided here rather than on the page, so a plan that lapsed closes
	 * the channel wherever it is drawn and wherever it is submitted.
	 *
	 * @param row - The settings row as the caller's own writes left it.
	 */
	async #notifications(row: SelectSettings): Promise<UserStore.Notifications> {
		let [devices, opted] = await Promise.all([
			this.#db.findMany(pushSubscriptions, { orderBy: [["created_at", "desc"]] }),
			countNotifiedFeeds(this.#db),
		]);

		return {
			push: row.notify_push,
			email: row.notify_email,
			emailAllowed: limitsOf(leasedTier(row, Date.now())).emailDigests,
			address: row.email,
			timeZone: row.time_zone,
			quietHours: row.quiet_hours,
			quietFrom: row.quiet_from,
			quietTo: row.quiet_to,
			feeds: opted,
			devices: devices.map(toDevice),
		};
	}

	/**
	 * Tells the reader what has arrived since the last time they were told, and moves the
	 * one timestamp all of it is derived from when at least one channel accepted.
	 *
	 * Advanced on one acceptance rather than on all of them: requiring all would let a
	 * single broken endpoint re-notify every working one on every check, and requiring none
	 * would drop the notification whenever the first send failed.
	 */
	async #notify(): Promise<void> {
		let now = Date.now();
		let row = await this.#settingsRow();

		let outcome = await notify({
			db: this.#db,
			row,
			now,
			mayEmail: limitsOf(leasedTier(row, now)).emailDigests,
			mailer: this.#mailer(),
			appUrl: this.env.APP_URL || null,
			record: (kind, fields) => this.#record(kind, fields),
		});

		if (outcome.notified) {
			await this.#db.update(settings, { id: SETTINGS_ID }, { last_notified_at: now });
		}
	}

	/**
	 * The mailer this object sends through, or `null` on a deployment with no email binding.
	 *
	 * Constructed here rather than taken off a request, because an alarm has none: the
	 * middleware that publishes a mailer per request never runs in an object.
	 */
	#mailer(): Mailer | null {
		if (!this.env.EMAIL || !this.env.EMAIL_FROM) return null;

		return new Mailer({
			transport: new CloudflareTransport(this.env.EMAIL),
			from: { email: this.env.EMAIL_FROM },
		});
	}

	/**
	 * Takes what the reader has agreed to lose and moves the sweep's own due time on, so a
	 * velocity window closes a day at a time whether or not anything synchronized.
	 *
	 * @param now - Epoch milliseconds the velocities are measured against.
	 * @param pausedByRun - Feeds a synchronization behind this held back for want of room.
	 */
	async #runSweep(now: number, pausedByRun = 0): Promise<void> {
		let swept = await this.#sweep(now);
		let row = await this.#settingsRow();

		if (row.next_sweep_at !== null) {
			await this.#db.update(
				settings,
				{ id: SETTINGS_ID },
				{ next_sweep_at: now + SWEEP_INTERVAL_MS },
			);
		}

		/**
		 * The tier and the figure it carried are on the event because a sweep is read after
		 * the fact: what it reclaimed means one thing against half a million posts and
		 * another against three, and the budget it applied is what tells the two apart.
		 */
		this.#record("job", {
			event: "user.retention",
			aged: swept.aged,
			reclaimed: swept.reclaimed,
			paused: swept.paused + pausedByRun,
			tier: swept.tier,
			budget: swept.budget,
		});
	}

	/**
	 * The folder by that exact name, made when the reader has none by it.
	 *
	 * The upsert is what the unique title buys: filing by name is idempotent, so a document
	 * naming one folder over twenty feeds creates it once and files twenty feeds into it.
	 *
	 * @param title - The name, already trimmed to what a rail would draw.
	 */
	async #folderByTitle(title: string): Promise<SelectFolder> {
		let existing = await this.#db.findOne(folders, { where: { title } });
		return existing ?? (await this.#createFolder(title));
	}

	/**
	 * Whether this reader's plan makes labels. An entitlement that lapses leaves every row
	 * in place: they keep their posts and their labels and can still read by them, and the
	 * only thing they cannot do is make new ones.
	 */
	async #mayLabel(): Promise<boolean> {
		return limitsOf(storedTier(await this.#settingsRow())).folders;
	}

	/**
	 * The label a caller named: one they hold by id, one they hold by name, or a new one
	 * where naming is allowed to make it.
	 *
	 * @param target - The label, by id, or the name to reach it by.
	 * @param create - Whether an unheld name makes a label rather than being refused.
	 */
	async #resolveTag(
		target: { tagId: string } | { name: string },
		create: boolean,
	): Promise<
		| { ok: true; tag: UserStore.Tag }
		| { ok: false; reason: Exclude<UserStore.TagFailure, "saved-full"> }
	> {
		if ("tagId" in target) {
			let row = await this.#db.find(tags, { id: target.tagId });
			return row === null ? { ok: false, reason: "not-found" } : { ok: true, tag: toTag(row) };
		}

		let folded = foldTagName(target.name);
		if (folded === null) return { ok: false, reason: "tag-name-invalid" };

		let existing = await this.#db.findOne(tags, { where: { slug: folded.slug } });
		if (existing !== null) return { ok: true, tag: toTag(existing) };

		if (!create) return { ok: false, reason: "not-found" };

		let held = await this.#db.count(tags);
		if (held >= TAG_LIMIT) return { ok: false, reason: "tag-limit" };

		return { ok: true, tag: toTag(await this.#createTag(folded.name, folded.slug)) };
	}

	/** Writes one label row, minting the id every join row and every URL holds it by. */
	async #createTag(name: string, slug: string): Promise<SelectTag> {
		return await this.#db.create(
			tags,
			{ id: TypeID.fromUUID("tag", generateUUID()).toString(), name, slug },
			{ returnRow: true },
		);
	}

	/**
	 * Clears the labels of posts that are going.
	 *
	 * Four paths remove a post — unsaving, the velocity sweep, the budget's reclamation and
	 * unfollowing a feed — and each of them comes through here in the same batch it deletes
	 * with. A cascade would be tidier and would put the correctness of a bulk sweep behind
	 * whether a pragma is set the way the platform happens to set it today; each of those
	 * methods already owns its deletes, so writing both is one line and depends on nothing.
	 *
	 * @param itemIds - The posts whose labels go with them.
	 */
	async #forgetTags(itemIds: readonly string[]): Promise<void> {
		if (itemIds.length === 0) return;

		for (let batch of chunked([...itemIds], IDS_PER_LOOKUP)) {
			await this.#db.deleteMany(itemTags, { where: inList("item_id", batch) });
		}
	}

	/**
	 * The labels on a page of posts, keyed by post, read through the index that serves that
	 * direction. Only the two surfaces that draw chips ask for it, so no page of the river
	 * pays for a read it prints nothing from.
	 *
	 * @param itemIds - The posts on the page being drawn.
	 */
	async #tagsFor(itemIds: readonly string[]): Promise<Map<string, UserStore.Tag[]>> {
		let byItem = new Map<string, UserStore.Tag[]>();
		if (itemIds.length === 0) return byItem;

		let held = new Map((await this.listTags()).map((tag) => [tag.id, tag]));

		for (let batch of chunked([...itemIds], IDS_PER_LOOKUP)) {
			let rows = await this.#db.findMany(itemTags, { where: inList("item_id", batch) });

			for (let row of rows) {
				let tag = held.get(row.tag_id);
				if (tag === undefined) continue;

				byItem.set(row.item_id, [...(byItem.get(row.item_id) ?? []), tag]);
			}
		}

		return byItem;
	}

	/** Writes one folder row, minting the id every other row holds it by. */
	async #createFolder(title: string): Promise<SelectFolder> {
		return await this.#db.create(
			folders,
			{ id: TypeID.fromUUID("folder", generateUUID()).toString(), title },
			{ returnRow: true },
		);
	}

	/** The folder one subscription is filed in, or `null` for an unfiled one. */
	async #folderOf(feed: SelectFeed): Promise<UserStore.Folder | null> {
		if (feed.folder_id === null) return null;

		let row = await this.#db.find(folders, { id: feed.folder_id });
		return row === null ? null : toFolder(row);
	}

	/** Every feed this reader still follows, which is every list and sweep's starting point. */
	async #subscriptions(): Promise<SelectFeed[]> {
		return await this.#db.findMany(feeds, { where: isNull("unfollowed_at") });
	}

	/**
	 * The subscriptions with something above their cursor, newest news first.
	 *
	 * The heads are read in bulk, one request per hundred feeds rather than one per feed,
	 * so a reader following two hundred pays the latency of a reader following two.
	 *
	 * @param feedIds - Narrows the question to these subscriptions, when the caller knows.
	 */
	async #staleSubscriptions(feedIds?: string[]): Promise<SelectFeed[]> {
		let followed = await this.#subscriptions();
		let asked =
			feedIds === undefined ? followed : followed.filter((feed) => feedIds.includes(feed.id));

		let heads = await readHeads(asked.map((feed) => feed.feed_id));

		return asked.filter((feed) => (heads.get(feed.feed_id) ?? 0) > feed.cursor);
	}

	/**
	 * Brings one subscription up to date, a page at a time, and stops where the reader has
	 * no room left.
	 *
	 * The cursor is written after the items, never before. A run that dies between the two
	 * leaves a cursor pointing at work already done, and the retry upserts rows it already
	 * wrote, which changes nothing; a cursor advanced first would skip whatever it skipped
	 * past, permanently, and no later check would notice, because the comparison that would
	 * have caught it is the one the cursor just satisfied.
	 *
	 * What the cursor may pass is anything the reader has ruled on: an item stored and an
	 * item dropped for being older than this feed's velocity are both decided. An item whose
	 * write failed, or that this run never reached, is neither.
	 *
	 * An empty page answered under a higher head takes the cursor to that head. A tick can be
	 * spent on a row that was never written, and this reader would otherwise sit below a head
	 * they can never reach; the head here is the true one, read from the feed in the same call.
	 */
	async #syncFeed(
		feed: SelectFeed,
		shared: RuleRun | null = null,
	): Promise<{ items: number; paused: boolean; ruled: number }> {
		let stored = 0;
		let skipped = 0;
		let ruled = 0;
		let cursor = feed.cursor;
		let now = Date.now();
		let started = now;

		/**
		 * A run covering several feeds reads the rules once and counts across all of them, so
		 * the counters are written once for the run; a feed synchronized on its own reads and
		 * writes its own.
		 */
		let run = shared ?? (await this.#ruleRun());

		/**
		 * A reader over their budget with nothing left to reclaim stops taking posts rather
		 * than deleting ones nobody agreed to lose. The subscription stays stale and says so,
		 * which is back-pressure rather than data loss: nothing they have is taken, and what
		 * they have not got yet waits.
		 */
		if (await this.#isPaused(feed)) return { items: 0, paused: true, ruled: 0 };

		for (let page = 0; page < SYNC_PAGES_PER_FEED; page += 1) {
			let answered = await feedStore(feed.feed_id).getItemsAfter(cursor);

			/**
			 * The rate rides on the page this run was already reading, so keeping the reader's
			 * own copy of it current costs no extra call and no walk over subscriptions.
			 */
			await this.recordPublishingRate(feed.id, answered.postsPerDay);

			if (answered.items.length === 0) {
				if (answered.head > cursor) {
					cursor = answered.head;
					await this.#db.update(feeds, { id: feed.id }, { cursor });
				}

				break;
			}

			let materialized = await this.#materialize(
				feed.id,
				answered.items,
				feed.velocity,
				now,
				feed.folder_id,
				run,
			);

			stored += materialized.written;
			skipped += materialized.skipped;
			ruled += materialized.ruled;

			cursor = greatestRevision(answered.items);
			await this.#db.update(feeds, { id: feed.id }, { cursor });

			if (answered.head <= cursor) break;
		}

		/** A feed synchronized on its own owns the run, so its counters are written here. */
		if (shared === null) await this.#countMatches(run, Date.now());

		this.#record("job", {
			event: "user.sync",
			feedId: feed.feed_id,
			items: stored,
			skipped,
			ruled,
			cursorFrom: feed.cursor,
			cursorTo: cursor,
			durationMs: Date.now() - started,
		});

		return { items: stored, paused: false, ruled };
	}

	/**
	 * Decides a feed's items and writes the ones this reader keeps, while they are still in
	 * memory and before any of them is a row.
	 *
	 * Velocity is applied first: an item already older than this subscription's velocity is
	 * not stored at all, so a reader returning after a month to a feed they read for
	 * headlines materializes the last few hours, and the rules never see the rest. It is also
	 * the honest order for the counters, since an item velocity refused was never in the
	 * timeline for a rule to have done anything to.
	 *
	 * Then every applicable rule runs, and `drop` dominates: an item one rule would flag and
	 * another would drop is dropped. A rule reaches only items this reader does not have —
	 * an item the publisher edited is applied as an ordinary edit — so the ids a rule matched
	 * are read back before anything is acted on, which is the one query rules add and is paid
	 * only when a rule fires.
	 *
	 * @param folderId - The folder the subscription is filed in as this run holds it, which
	 * the copies are written into so an item arriving twice lands where its feed is now.
	 * @param run - The rules this run evaluates and the tally they are counted into, or
	 * `null` for a path that takes no rules.
	 */
	async #materialize(
		subscriptionId: string,
		incoming: readonly FeedStore.Item[],
		velocity: Velocity,
		now: number,
		folderId: string | null = null,
		run: RuleRun | null = null,
	): Promise<Materialized> {
		let window = VELOCITY_WINDOW_MS[velocity];
		let fresh = incoming.filter((item) => window === null || item.publishedAt >= now - window);
		let skipped = incoming.length - fresh.length;

		if (fresh.length === 0) return { written: 0, skipped, ruled: 0 };

		let applicable = (run?.rules ?? []).filter(
			(rule) => rule.feed_id === null || rule.feed_id === subscriptionId,
		);

		let verdicts = new Map<string, RuleVerdict>();
		let credits = new Map<string, string[]>();

		for (let item of applicable.length === 0 ? [] : fresh) {
			for (let rule of applicable) {
				if (!matchesRule(item, { field: rule.field, value: foldRuleText(rule.value) })) continue;

				let verdict = verdicts.get(item.id) ?? { drop: false, read: false, flag: false };
				if (rule.action === "drop") verdict.drop = true;
				if (rule.action === "mark_read") verdict.read = true;
				if (rule.action === "flag") verdict.flag = true;

				verdicts.set(item.id, verdict);
				credits.set(item.id, [...(credits.get(item.id) ?? []), rule.id]);
			}
		}

		/**
		 * A page on which nothing matched is written exactly as it was before rules existed:
		 * no read-back, no marks, and nothing to count.
		 */
		if (verdicts.size === 0) {
			await this.#writeItems(subscriptionId, fresh, now, folderId, null);
			return { written: fresh.length, skipped, ruled: 0 };
		}

		let held = await this.#heldItems([...verdicts.keys()]);

		let marks = new Map<string, { readAt: number | null; flaggedAt: number | null }>();
		let write: FeedStore.Item[] = [];
		let ruled = 0;

		for (let item of fresh) {
			let verdict = held.has(item.id) ? undefined : verdicts.get(item.id);

			if (verdict === undefined) {
				write.push(item);
				continue;
			}

			ruled += 1;
			for (let ruleId of credits.get(item.id) ?? []) {
				run?.matched.set(ruleId, (run.matched.get(ruleId) ?? 0) + 1);
			}

			if (verdict.drop) continue;

			write.push(item);
			marks.set(item.id, {
				readAt: verdict.read ? now : null,
				flaggedAt: verdict.flag ? now : null,
			});
		}

		await this.#writeItems(subscriptionId, write, now, folderId, marks);

		return { written: write.length, skipped, ruled };
	}

	/**
	 * Writes a page of items as this reader's own copies, in the chunks the bind limit
	 * allows.
	 *
	 * @param marks - The arrival marks a rule left on some of them, or `null` for a page no
	 * rule decided.
	 */
	async #writeItems(
		subscriptionId: string,
		incoming: readonly FeedStore.Item[],
		now: number,
		folderId: string | null,
		marks: Map<string, { readAt: number | null; flaggedAt: number | null }> | null,
	): Promise<void> {
		if (incoming.length === 0) return;

		for (let chunk of chunked([...incoming], insertChunkSize())) {
			await this.#db.exec(...upsertItems(subscriptionId, chunk, now, folderId, marks));
		}
	}

	/**
	 * Which of these ids this reader already holds, read through the primary key and chunked
	 * to the bind limit every lookup here works under.
	 *
	 * @param itemIds - The ids a rule matched, which are the only ones worth asking about.
	 */
	async #heldItems(itemIds: readonly string[]): Promise<Set<string>> {
		let held = new Set<string>();

		for (let batch of chunked([...itemIds], IDS_PER_LOOKUP)) {
			let rows = await this.#db.query(feedItems).where(inList("id", batch)).select("id").all();
			for (let row of rows) held.add(row.id);
		}

		return held;
	}

	/**
	 * Reads a submitted rule as one this object will act on, or answers why it is not one.
	 *
	 * Both named lists are checked here as well as by the column's `CHECK`, so a caller gets
	 * a refusal it can render rather than a constraint violation, and a rule naming a feed
	 * the reader does not follow is refused rather than stored as a rule about nothing.
	 *
	 * @param draft - The rule as a form submitted it.
	 */
	async #ruleDraft(draft: UserStore.RuleDraft): Promise<
		| {
				ok: true;
				feedId: string | null;
				field: RuleField;
				value: string;
				action: RuleAction;
		  }
		| { ok: false; reason: Exclude<UserStore.RuleFailure, "rule-limit" | "not-found"> }
	> {
		if (!isRuleField(draft.field)) return { ok: false, reason: "invalid-field" };
		if (!isRuleAction(draft.action)) return { ok: false, reason: "invalid-action" };

		let term = foldRuleValue(draft.value);
		if (term === null) return { ok: false, reason: "invalid-value" };

		let feedId = draft.feedId ?? null;

		if (feedId !== null) {
			let feed = await this.#db.find(feeds, { id: feedId });
			if (feed === null || feed.unfollowed_at !== null)
				return { ok: false, reason: "not-following" };
		}

		return { ok: true, feedId, field: draft.field, value: term.value, action: draft.action };
	}

	/**
	 * The reader's newest posts, which is the page both the preview and the one-off over it
	 * are bounded by: one seek down the timeline index, and never a scan of everything the
	 * object holds.
	 *
	 * @param feedId - The subscription to read, or `null` for every feed at once.
	 */
	async #newestPosts(feedId: string | null): Promise<TimelineRow[]> {
		let query = this.#timeline();

		return await (feedId === null ? query : query.where({ feed_id: feedId }))
			.orderBy("published_at", "desc")
			.orderBy("id", "desc")
			.limit(RULE_PREVIEW_POSTS)
			.all();
	}

	/** The rules a run evaluates, read whole, with nothing counted against them yet. */
	async #ruleRun(): Promise<RuleRun> {
		return { rules: await this.#db.findMany(rules), matched: new Map() };
	}

	/**
	 * Writes what a run's rules matched, one small update per rule that matched anything.
	 *
	 * @param run - The run whose tally is being settled.
	 * @param now - Epoch milliseconds the run finished at, which is when each rule last
	 * matched.
	 */
	async #countMatches(run: RuleRun, now: number): Promise<void> {
		for (let [ruleId, count] of run.matched) {
			if (count === 0) continue;

			let rule = await this.#db.find(rules, { id: ruleId });
			if (rule === null) continue;

			await this.#db.update(
				rules,
				{ id: ruleId },
				{ matches: rule.matches + count, last_matched_at: now },
			);
		}

		run.matched.clear();
	}

	/**
	 * Lets go of a feed the reader unfollowed once the last post they kept from it goes.
	 *
	 * Such a row outlives the subscription for one reason — to hold the feed's name for the
	 * saved list to show — so it has nothing left to do the moment that list stops naming
	 * it. A feed the reader still follows is untouched.
	 *
	 * @param subscriptionId - The feed the unsaved post belonged to.
	 */
	async #dropIfSpent(subscriptionId: string): Promise<void> {
		let feed = await this.#db.find(feeds, { id: subscriptionId });
		if (feed === null || feed.unfollowed_at === null) return;

		let kept = await this.#db.count(feedItems, {
			where: and({ feed_id: subscriptionId }, notNull("saved_at")),
		});

		if (kept > 0) return;

		let doomed = await this.#db
			.query(feedItems)
			.where({ feed_id: subscriptionId })
			.select("id")
			.all();

		await this.#forgetTags(doomed.map((row) => row.id));
		await this.#db.deleteMany(feedItems, { where: { feed_id: subscriptionId } });
		await this.#db.delete(feeds, { id: subscriptionId });
	}

	/**
	 * Whether this subscription has to stop taking posts: the object is over its budget, and
	 * this feed is over the share of it that its reader's other feeds leave.
	 */
	async #isPaused(feed: SelectFeed): Promise<boolean> {
		/**
		 * The share this feed is held to, then its own rows, and the object's whole count
		 * only for a feed already over that share. A feed inside its share cannot pause
		 * whatever else the object holds, so the common answer costs two counts a small
		 * table and one index answer rather than a scan of every post the reader has.
		 */
		let budget = await this.#budget();
		let followed = await this.#db.count(feeds, { where: isNull("unfollowed_at") });
		let held = await this.#db.count(feedItems, { where: { feed_id: feed.id } });

		if (held <= shareOf(followed, budget)) return false;

		/**
		 * At the budget rather than past it: the figure is one number with two consequences,
		 * and refusing is what it does when reclaiming has nothing left to take. An object
		 * sitting exactly on it has no room for the next post either.
		 */
		return (await this.#db.count(feedItems)) >= budget;
	}

	/**
	 * Takes what the reader has agreed to lose, and nothing else.
	 *
	 * Two rules, and both are the reader's own: a velocity they set on a feed, and a budget
	 * they are over. Nothing is deleted for being old on an object with room for it — a
	 * sweep that dropped posts read a year ago would fire on an object holding a thousand
	 * rows as readily as on one holding a million, and take reading history from somebody
	 * using a thousandth of their space.
	 *
	 * The budget it holds the object to is the one the reader's tier carries, so an upgrade
	 * raises it with the column write that records it and a downgrade lowers it without
	 * taking a post: an object over a lowered budget with nothing read has nothing to
	 * reclaim, and stopping is what it does then.
	 *
	 * @param now - Epoch milliseconds the velocities are measured against.
	 */
	async #sweep(now: number): Promise<UserStore.Sweep> {
		let tier = storedTier(await this.#settingsRow());
		let budget = await this.#budget(tier);
		let swept = { aged: 0, reclaimed: 0, paused: 0, tier, budget };
		let followed = await this.#subscriptions();

		for (let feed of followed) swept.aged += await this.#ageOut(feed, now);

		let total = await this.#db.count(feedItems);
		if (total < budget) return swept;

		/**
		 * The share is applied only while the object is over budget, which is what keeps the
		 * division from being destructive: a reader under it keeps everything, so following a
		 * second feed does not halve the history of the first.
		 */
		let share = shareOf(followed.length, budget);

		for (let feed of followed) {
			let held = await this.#db.count(feedItems, { where: { feed_id: feed.id } });
			if (held <= share) continue;

			let reclaimed = await this.#reclaim(feed.id, held - share);
			swept.reclaimed += reclaimed;

			/** Nothing left that was read, so this feed holds rather than losing unread posts. */
			if (reclaimed < held - share) swept.paused += 1;
		}

		return swept;
	}

	/**
	 * Drops the posts of one feed that are older than the velocity its reader set, and
	 * answers how many went. A saved post stays: it is the one answer that outlives every
	 * rule here.
	 */
	async #ageOut(feed: SelectFeed, now: number): Promise<number> {
		let window = VELOCITY_WINDOW_MS[feed.velocity];
		if (window === null) return 0;

		let past = and({ feed_id: feed.id }, lt("published_at", now - window), isNull("saved_at"));

		/**
		 * Named before the delete rather than counted, since what a write reports is rows of
		 * storage and the labels of what is going are cleared in the same batch.
		 */
		let doomed = await this.#db.query(feedItems).where(past).select("id").all();
		if (doomed.length === 0) return 0;

		await this.#forgetTags(doomed.map((row) => row.id));
		await this.#db.deleteMany(feedItems, { where: past });

		return doomed.length;
	}

	/**
	 * Takes back up to `excess` of one feed's posts, oldest first, from what the reader has
	 * already read and has not saved. It answers how many it got, which is short of what was
	 * asked for exactly when there is nothing left the reader agreed to lose.
	 */
	async #reclaim(subscriptionId: string, excess: number): Promise<number> {
		let reclaimable = await this.#db
			.query(feedItems)
			.where(and({ feed_id: subscriptionId }, notNull("read_at"), isNull("saved_at")))
			.select("id")
			.orderBy("published_at", "asc")
			.orderBy("id", "asc")
			.limit(excess)
			.all();

		if (reclaimable.length === 0) return 0;

		await this.#forgetTags(reclaimable.map((row) => row.id));

		for (let batch of chunked(
			reclaimable.map((row) => row.id),
			IDS_PER_LOOKUP,
		)) {
			await this.#db.deleteMany(feedItems, { where: inList("id", batch) });
		}

		/**
		 * The posts it named, rather than what the deletes reported: a write reports rows of
		 * storage, and this number decides whether the feed has anything left to give back.
		 */
		return reclaimable.length;
	}

	/**
	 * The subscription already holding `feedUrl`, or `null` for a feed nobody here follows.
	 *
	 * It finds a row the reader has unfollowed as readily as one they follow, because such
	 * a row is still theirs: it was kept to hold the name of a feed they saved posts from,
	 * and following that feed again is picking it back up rather than starting a second one.
	 */
	async #subscriptionByUrl(feedUrl: string): Promise<SelectFeed | null> {
		return await this.#db.findOne(feeds, { where: { feed_url: feedUrl } });
	}

	/**
	 * Answers a follow of a feed this object already has a row for: already following when
	 * the reader still follows it, and picked back up when only its saved posts were left.
	 */
	async #follow(existing: SelectFeed): Promise<UserStore.FollowResult> {
		if (existing.unfollowed_at === null) {
			return { ok: false, reason: "already-following", feedId: existing.id };
		}

		/**
		 * Taking a subscription back off the shelf adds to the count exactly as a new one
		 * does, so it is held to the same cap.
		 */
		let room = await this.#roomForFeed();
		if (room !== null) return { ok: false, reason: "over-limit", feedId: null, limit: room };

		let revived = await this.#db.update(feeds, { id: existing.id }, { unfollowed_at: null });
		await feedStore(existing.feed_id).subscribe(this.#subject(), existing.feed_url);

		let synchronized = await this.#syncFeed(revived);
		let unread = await this.#db.count(feedItems, {
			where: and({ feed_id: existing.id }, isNull("read_at")),
		});

		return {
			ok: true,
			feed: toFeedSummary(revived, unread, await this.#folderOf(revived)),
			items: synchronized.items,
		};
	}

	/** The columns a timeline page reads, ordered and seeked by whoever pages it. */
	#timeline() {
		return this.#db
			.query(feedItems)
			.select(
				"id",
				"feed_id",
				"title",
				"url",
				"summary",
				"author",
				"published_at",
				"read_at",
				"saved_at",
				"flagged_at",
			);
	}

	/**
	 * Pages a composed timeline and resolves the feeds its posts came from.
	 *
	 * The ordering is left off the query handed in: `Pagination.byKeyset()` owns it,
	 * because it needs the sort keys both to seek and to mint the cursor.
	 *
	 * @param withTags - Whether the page's posts carry the labels on them, which the two
	 * surfaces that draw chips ask for and no surface rendering a river does.
	 */
	async #page<whereArg, columnArg>(
		query: KeysetQuery<TimelineRow, whereArg, columnArg>,
		options: UserStore.TimelineOptions,
		withTags = false,
	): Promise<UserStore.TimelineResult> {
		let page = await Pagination.byKeyset(query, {
			orderBy: NEWEST_FIRST,
			cursor: options.cursor,
			limit: pageLimit(options.limit),
		});

		if (isFailure(page)) {
			/**
			 * A cursor the reader's browser carried from an older ordering is news about
			 * the request; anything else here is a broken query, which belongs to whoever
			 * wrote it rather than to the person reading.
			 */
			if (page.error instanceof InvalidCursorError) return { ok: false, reason: "bad-cursor" };
			throw page.error;
		}

		let items = page.data.items.map(toItem);

		if (withTags) {
			let labels = await this.#tagsFor(items.map((item) => item.id));
			items = items.map((item) => ({ ...item, tags: labels.get(item.id) ?? [] }));
		}

		return {
			ok: true,
			items,
			feeds: await this.#feedRefs(items),
			cursors: page.data.cursors,
			search: null,
		};
	}

	/**
	 * One page of a searched list: the step's floor, the page inside it, the boundary the
	 * page stopped at, and the record of what the walk cost.
	 *
	 * A search adopts the ordering of the list it narrows and adds a predicate to it, so
	 * everything that differs between the queue and a label's posts is in the plan handed
	 * in and everything that is the same about a bounded search is here.
	 *
	 * @param plan - How the narrowed list is read, and how far its walk is measured.
	 * @param options - Where to page from, how much of it, and which posts.
	 */
	async #searchedPage(
		plan: SearchPlan,
		options: UserStore.ReadingQueueOptions,
	): Promise<UserStore.TimelineResult> {
		let started = Date.now();
		let readState = options.readState ?? "unread";

		let tier = storedTier(await this.#settingsRow());
		let windowDays = limitsOf(tier).searchWindowDays;
		let windowFloor = searchFloor(tier, started);

		let client = await flagsFor(this.#subject());
		let stepDays = await client.get(features.searchStepDays);

		/**
		 * Where this step starts. A page walking back from a cursor starts at that cursor's
		 * own moment; the newest page starts now; and a page walking up towards the newest
		 * is bounded above by its cursor already, so it takes the window alone.
		 */
		let from = searchStartsAt(options.cursor ?? null, started);
		let floor = stepFloorOf(from, stepDays, windowFloor);

		let page = await this.#page(plan.query(floor), options, plan.withTags);
		if (!page.ok) return page;

		let limit = pageLimit(options.limit);
		let filled = page.items.length >= limit;
		let last = page.items.at(-1) ?? null;
		let oldest = await this.#oldestPostAt();

		/**
		 * A filled page stopped at its last post rather than at the floor, so that is how far
		 * this scan actually looked and what the sentence under the list names.
		 */
		let reachedAt = filled && last !== null ? last.publishedAt : (floor ?? oldest ?? started);
		let stoppedAt = searchStop({ filled, floor, windowFloor, oldest });

		let examined = from === null ? page.items.length : await plan.examined(from, reachedAt);

		/**
		 * No query text. What a person searched for is the most revealing thing this object
		 * holds, and none of the questions this event answers needs it.
		 */
		this.#record("job", {
			event: "user.search",
			windowDays,
			stepDays,
			examined,
			matched: page.items.length,
			exhausted: !filled,
			readState,
			scoped: plan.scoped,
			durationMs: Date.now() - started,
		});

		return {
			...page,
			cursors: boundaryCursors(page.cursors, {
				filled,
				floor,
				from,
				resumable: (options.cursor ?? null) !== null,
				stoppedAt,
			}),
			search: { reachedAt, windowDays, stoppedAt },
		};
	}

	/**
	 * When the oldest post this reader holds was published, or `null` for an object holding
	 * none. It is one row off the timeline index, which is what lets a search say it reached
	 * the end of the archive rather than guess at it.
	 */
	async #oldestPostAt(): Promise<number | null> {
		let { rows = [] } = await this.#db.exec(
			sql`select "published_at" from feed_items order by "published_at" asc, "id" asc limit 1`,
		);

		let published = rows[0]?.published_at;
		return typeof published === "number" ? published : null;
	}

	/**
	 * How many of the reader's posts a walk between two moments visited, counted off the
	 * same index the walk ran down, so the number costs index rows and no table rows.
	 *
	 * @param since - Epoch milliseconds the walk reached.
	 * @param until - Epoch milliseconds it started at.
	 * @param narrowing - The read state and any scope the walk itself ran under.
	 */
	async #countBetween(
		since: number,
		until: number,
		narrowing: {
			readState: UserStore.ReadState;
			feedId: string | null;
			folderId: string | null;
		},
	): Promise<number> {
		let where = sql`"published_at" >= ${since} and "published_at" <= ${until}`;

		let state = readStateSql(narrowing.readState);
		if (state !== null) where = sql`${where} and ${state}`;

		if (narrowing.feedId !== null) where = sql`${where} and "feed_id" = ${narrowing.feedId}`;
		if (narrowing.folderId !== null) where = sql`${where} and "folder_id" = ${narrowing.folderId}`;

		let { rows = [] } = await this.#db.exec(
			sql`select count(*) as examined from feed_items where ${where}`,
		);

		let examined = rows[0]?.examined;
		return typeof examined === "number" ? examined : 0;
	}

	/** The same count for a label's posts, taken off the join table's own ordering columns. */
	async #countTaggedBetween(tagId: string, since: number, until: number): Promise<number> {
		let { rows = [] } = await this.#db.exec(
			sql`select count(*) as examined from item_tags
				where "tag_id" = ${tagId} and "published_at" >= ${since} and "published_at" <= ${until}`,
		);

		let examined = rows[0]?.examined;
		return typeof examined === "number" ? examined : 0;
	}

	/** The feeds a page's posts came from, for labelling them. */
	async #feedRefs(items: readonly UserStore.Item[]): Promise<UserStore.FeedRef[]> {
		let ids = [...new Set(items.map((item) => item.feedId))];

		let refs: UserStore.FeedRef[] = [];
		for (let batch of chunked(ids, IDS_PER_LOOKUP)) {
			let rows = await this.#db.findMany(feeds, { where: inList("id", batch) });
			refs.push(
				...rows.map((row) => ({
					id: row.id,
					title: row.title,
					siteUrl: row.site_url,
					keepLinkParameters: row.keep_link_parameters,
				})),
			);
		}

		return refs;
	}

	/** Unread posts per feed, keyed by feed id; a feed with none is absent. */
	async #unreadCounts(): Promise<Map<string, number>> {
		let { rows = [] } = await this.#db.exec(UNREAD_COUNTS_SQL);

		let counts = new Map<string, number>();
		for (let row of rows) {
			let { feed_id: feedId, unread } = row;
			if (typeof feedId === "string" && typeof unread === "number") counts.set(feedId, unread);
		}

		return counts;
	}
}

/**
 * How one searched list is read, which is everything a bounded search needs beyond the
 * ordering the list it narrows already owns.
 */
interface SearchPlan {
	/**
	 * The page to read, bounded by the floor the step and the window decided between them.
	 *
	 * @param floor - Epoch milliseconds the walk stops at, or `null` to reach every post.
	 */
	query: (floor: number | null) => KeysetQuery<TimelineRow, Predicate, string>;
	/**
	 * How many posts the walk visited, counted off the same index range it walked. A post
	 * published at either end counts, so a span whose ends fall on ties counts those ties.
	 *
	 * @param from - Epoch milliseconds the walk started at.
	 * @param reachedAt - Epoch milliseconds it got to.
	 */
	examined: (from: number, reachedAt: number) => Promise<number>;
	/** Whether the search was narrowed to one feed, one folder or one label. */
	scoped: boolean;
	/** Whether the page's posts carry the labels on them. */
	withTags: boolean;
}

/**
 * Where a search page's walk starts, as epoch milliseconds, or `null` for a page whose
 * cursor already bounds it above.
 *
 * A cursor that no longer decodes leaves the page to the pager, which refuses it and says
 * so, so this reads it for the moment it carries and answers with the clock otherwise.
 *
 * @param cursor - The cursor this page was asked for by, or `null` for the newest.
 * @param now - Epoch milliseconds the search is being run at.
 */
function searchStartsAt(cursor: string | null, now: number): number | null {
	if (cursor === null) return now;

	let decoded = decodeCursor(cursor);
	if (isFailure(decoded)) return now;
	if (decoded.data.direction === "before") return null;

	let at = decoded.data.values[decoded.data.columns.indexOf("published_at")];
	return typeof at === "number" ? at : now;
}

/**
 * The floor one search page walks to: the later of the tier's window and a step back from
 * where the page starts, so neither bound can be walked past.
 *
 * @param from - Epoch milliseconds the walk starts at, or `null` for a page bounded above.
 * @param stepDays - How far back one page reaches, as the flag answered it.
 * @param windowFloor - The oldest moment the tier allows, or `null` for every stored post.
 */
function stepFloorOf(
	from: number | null,
	stepDays: number,
	windowFloor: number | null,
): number | null {
	if (from === null) return windowFloor;

	let step = from - stepDays * DAY_MS;
	return windowFloor === null ? step : Math.max(step, windowFloor);
}

/** What stopped a search page where it did, decided before the copy that says it. */
function searchStop(at: {
	filled: boolean;
	floor: number | null;
	windowFloor: number | null;
	oldest: number | null;
}): UserStore.SearchStop {
	if (at.filled) return "step";
	if (at.floor === null) return "archive";
	if (at.oldest === null || at.floor <= at.oldest) return "archive";
	if (at.windowFloor !== null && at.floor === at.windowFloor) return "window";

	return "step";
}

/**
 * The cursors a search page offers, which is where it differs from every other list here:
 * a step that fills no page still continues, so the boundary is minted from the floor the
 * scan reached rather than from a row that came back.
 *
 * Both are spelled with the ordering columns every other list mints, so a reader who
 * searches, pages, clears the box and keeps paging follows one the plain timeline seeks
 * with.
 *
 * @param minted - What the pager minted from the rows this page returned.
 * @param at - Where the step started, where it stopped, and what stopped it there.
 */
function boundaryCursors(
	minted: { next: string | null; prev: string | null },
	at: {
		filled: boolean;
		floor: number | null;
		from: number | null;
		/** Whether the reader arrived here by a cursor, and so has a step above them. */
		resumable: boolean;
		stoppedAt: UserStore.SearchStop;
	},
): { next: string | null; prev: string | null } {
	let next = minted.next;

	if (!at.filled) {
		next = at.stoppedAt === "archive" || at.floor === null ? null : cursorAt("after", at.floor);
	}

	/**
	 * A step holding nothing still has a way back to the step above it, which the pager
	 * cannot mint because no row came back to mint it from.
	 */
	let resumes = at.resumable && at.from !== null;
	let prev = minted.prev ?? (resumes ? cursorAt("before", at.from ?? 0) : null);

	return { next, prev };
}

/**
 * One end of a step as a cursor, carrying the moment it stopped at and an id no stored id
 * sorts below, so the step that follows skips nothing that was never examined.
 *
 * @param direction - Which edge of the step this marks.
 * @param at - Epoch milliseconds the step reached.
 */
function cursorAt(direction: "after" | "before", at: number): string | null {
	let cursor = encodeCursor(direction, ["published_at", "id"], [at, BELOW_EVERY_ID]);
	return isFailure(cursor) ? null : cursor.data;
}

/** Everything one composed search statement is built from. */
interface SearchState {
	/** The `LIKE` pattern, already escaped, that all three searched columns are matched against. */
	pattern: string;
	/** Which posts the match is narrowed to, spelled beside it in the same statement. */
	readState: UserStore.ReadState;
	/**
	 * Epoch milliseconds the walk stops at, or `null` for one that reaches every stored
	 * post. It is a second comparison on the same leading column the seek uses, so it ends
	 * the index range early rather than filtering rows out of it.
	 */
	floor: number | null;
	/** One subscription the match is narrowed to, or `null` for every followed feed. */
	feedId: string | null;
	/**
	 * One folder the match is narrowed to, or `null` for every feed. The folder is
	 * denormalized onto the post, so this is one bound parameter rather than a list of the
	 * folder's feeds.
	 */
	folderId: string | null;
	/** Seek predicates the pager composed, which narrow the match to one page. */
	seek: readonly Predicate[];
	/** The ordering the pager owns, which is also what it mints cursors from. */
	orderBy: readonly OrderByTuple[];
	/** Posts the statement reads, or `null` before the pager has set one. */
	limit: number | null;
}

/**
 * A post search, as a query {@link Pagination.byKeyset} can seek, order and limit.
 *
 * The match is a `LIKE` carrying an `ESCAPE` clause, which is what lets somebody search
 * for a post whose title holds `%` or `_` instead of having those characters read as
 * wildcards. The query builder's own operators emit no such clause, so the statement is
 * spelled out here and the pager's seek predicate is folded into it: one page, one read.
 *
 * It costs a scan of the reader's posts, bounded by {@link SearchState.floor}: a match
 * that may begin anywhere in the text is one no index answers, so the timeline index
 * serves the ordering and the floor decides how much of it a page walks.
 */
class SearchQuery implements KeysetQuery<TimelineRow, Predicate, string> {
	#db: Database;
	#state: SearchState;

	/**
	 * @param db - The reader's database.
	 * @param state - The pattern to match, and whatever the pager has composed so far.
	 */
	constructor(db: Database, state: SearchState) {
		this.#db = db;
		this.#state = state;
	}

	where(input: Predicate): SearchQuery {
		return new SearchQuery(this.#db, { ...this.#state, seek: [...this.#state.seek, input] });
	}

	orderBy(column: string, direction: OrderDirection): SearchQuery {
		return new SearchQuery(this.#db, {
			...this.#state,
			orderBy: [...this.#state.orderBy, [column, direction]],
		});
	}

	limit(value: number): SearchQuery {
		return new SearchQuery(this.#db, { ...this.#state, limit: value });
	}

	async all(): Promise<TimelineRow[]> {
		let { rows = [] } = await this.#db.exec(searchStatement(this.#state));
		return rows.map(toTimelineRow);
	}
}

/** Everything one composed page of a label's posts is built from. */
interface TaggedState {
	/** The label whose posts the page holds, which is the equality the index opens with. */
	tagId: string;
	/**
	 * The `LIKE` pattern a searched label's posts are matched against, or `null` for the
	 * whole label. A search adopts this list's ordering and adds a predicate to it, so the
	 * page still seeks and mints cursors on the join table's own copies of the keys.
	 */
	pattern: string | null;
	/** Epoch milliseconds the walk stops at, or `null` for one that reaches every post. */
	floor: number | null;
	/** Seek predicates the pager composed, which narrow the label's posts to one page. */
	seek: readonly Predicate[];
	/** The ordering the pager owns, which is also what it mints cursors from. */
	orderBy: readonly OrderByTuple[];
	/** Posts the statement reads, or `null` before the pager has set one. */
	limit: number | null;
}

/**
 * The kept posts under one label, as a query {@link Pagination.byKeyset} can seek, order
 * and limit.
 *
 * It is spelled out here rather than built by the query builder because the seek runs
 * against the join table's own copies of the ordering columns while the projection returns
 * the post's: one index carries the equality and both ordering columns in that order, so a
 * page is a range scan down it, and the page still mints the cursor shape every other list
 * in this app mints.
 *
 * `saved_at is not null` appears nowhere in it. Every row of the join table belongs to a
 * kept post by construction, so the join is the filter.
 */
class TaggedQuery implements KeysetQuery<TimelineRow, Predicate, string> {
	#db: Database;
	#state: TaggedState;

	/**
	 * @param db - The reader's database.
	 * @param state - The label to read, and whatever the pager has composed so far.
	 */
	constructor(db: Database, state: TaggedState) {
		this.#db = db;
		this.#state = state;
	}

	where(input: Predicate): TaggedQuery {
		return new TaggedQuery(this.#db, { ...this.#state, seek: [...this.#state.seek, input] });
	}

	orderBy(column: string, direction: OrderDirection): TaggedQuery {
		return new TaggedQuery(this.#db, {
			...this.#state,
			orderBy: [...this.#state.orderBy, [column, direction]],
		});
	}

	limit(value: number): TaggedQuery {
		return new TaggedQuery(this.#db, { ...this.#state, limit: value });
	}

	async all(): Promise<TimelineRow[]> {
		let { rows = [] } = await this.#db.exec(taggedStatement(this.#state));
		return rows.map(toTimelineRow);
	}
}

/**
 * The ordering columns as the join table spells them, which is what the seek and the order
 * are written against. `id` is the post's, and the join row's copy of it is `item_id`.
 *
 * @param column - The ordering column the pager named.
 */
function quoteJoinColumn(column: string): string {
	if (column === "published_at") return `t."published_at"`;
	if (column === "id") return `t."item_id"`;

	throw new Error("a label's page seeks on the two columns its index carries alone");
}

/** The statement one page of a label's posts runs as. */
function taggedStatement(state: TaggedState): SqlStatement {
	let narrowed = sql`t."tag_id" = ${state.tagId}`;

	if (state.pattern !== null) {
		let pattern = state.pattern;

		narrowed = sql`${narrowed} and (i."title" like ${pattern} escape ${LIKE_ESCAPE}
			or i."summary" like ${pattern} escape ${LIKE_ESCAPE}
			or i."author" like ${pattern} escape ${LIKE_ESCAPE})`;
	}

	if (state.floor !== null) narrowed = sql`${narrowed} and t."published_at" >= ${state.floor}`;

	let where = state.seek.reduce(
		(left, right) => sql`${left} and ${seekSql(right, quoteJoinColumn)}`,
		narrowed,
	);

	// The pager appends the ordering it owns before reading, and the fallback keeps a
	// statement built without one reading the way this list is defined to.
	let ordering = state.orderBy.length === 0 ? NEWEST_FIRST : state.orderBy;
	let orderBy = ordering
		.map(
			([column, direction]) => `${quoteJoinColumn(column)} ${direction === "asc" ? "asc" : "desc"}`,
		)
		.join(", ");

	return sql`select i."id", i."feed_id", i."title", i."url", i."summary", i."author",
			i."published_at", i."read_at", i."saved_at", i."flagged_at"
		from item_tags t
		join feed_items i on i."id" = t."item_id"
		where ${where}
		order by ${rawSql(orderBy)}
		limit ${state.limit ?? DEFAULT_PAGE_LIMIT}`;
}

/**
 * The statement one page of a search runs as.
 *
 * `author` joins the match because it is on the row the scan already fetches, so it costs
 * nothing, and somebody looking for a byline is looking for a post.
 */
function searchStatement(state: SearchState): SqlStatement {
	let pattern = state.pattern;

	let match = sql`("title" like ${pattern} escape ${LIKE_ESCAPE}
		or "summary" like ${pattern} escape ${LIKE_ESCAPE}
		or "author" like ${pattern} escape ${LIKE_ESCAPE})`;

	let matched = match;

	let narrowed = readStateSql(state.readState);
	if (narrowed !== null) matched = sql`${matched} and ${narrowed}`;

	if (state.floor !== null) matched = sql`${matched} and "published_at" >= ${state.floor}`;
	if (state.feedId !== null) matched = sql`${matched} and "feed_id" = ${state.feedId}`;
	if (state.folderId !== null) matched = sql`${matched} and "folder_id" = ${state.folderId}`;

	let where = state.seek.reduce((left, right) => sql`${left} and ${seekSql(right)}`, matched);

	// The pager appends the ordering it owns before reading, and the fallback keeps a
	// statement built without one reading the way a search is defined to.
	let ordering = state.orderBy.length === 0 ? NEWEST_FIRST : state.orderBy;
	let orderBy = ordering
		.map(([column, direction]) => `${quoteColumn(column)} ${direction === "asc" ? "asc" : "desc"}`)
		.join(", ");

	return sql`select "id", "feed_id", "title", "url", "summary", "author", "published_at", "read_at", "saved_at", "flagged_at"
		from feed_items
		where ${where}
		order by ${rawSql(orderBy)}
		limit ${state.limit ?? DEFAULT_PAGE_LIMIT}`;
}

/**
 * One seek predicate as SQL. `Pagination.byKeyset` builds these out of the ordering it was
 * given, so the comparisons and the `and`/`or` nesting below are the whole of what arrives.
 *
 * @param predicate - What the pager composed for this page.
 * @param quote - How an ordering column is spelled in the statement being built, which a
 * page seeking a join table's own copies of those columns answers differently.
 */
function seekSql(
	predicate: Predicate,
	quote: (column: string) => string = quoteColumn,
): SqlStatement {
	if (predicate.type === "logical") {
		let parts = predicate.predicates.map((nested) => seekSql(nested, quote));
		let joiner = predicate.operator === "and" ? " and " : " or ";

		return rawSql(
			`(${parts.map((part) => part.text).join(joiner)})`,
			parts.flatMap((part) => part.values),
		);
	}

	if (predicate.type === "comparison" && predicate.valueType === "value") {
		let operator = SEEK_OPERATORS[predicate.operator];

		if (operator !== undefined) {
			return rawSql(`${quote(predicate.column)} ${operator} ?`, [predicate.value]);
		}
	}

	throw new Error("a composed page seeks on comparisons of its ordering columns alone");
}

/**
 * One column of `feed_items` as a SQL identifier. It accepts only a name the table
 * declares, so a statement written by hand cannot reach a column the schema has dropped.
 */
function quoteColumn(column: string): string {
	if (!(column in getTableColumns(feedItems))) {
		throw new Error(`feed_items declares no column named "${column}"`);
	}

	return `"${column}"`;
}

/** One row of the search statement, read back into the shape a timeline page is built from. */
function toTimelineRow(row: Record<string, unknown>): TimelineRow {
	let { feed_id: feedId, published_at: publishedAt, read_at: readAt, saved_at: savedAt } = row;

	return {
		id: typeof row.id === "string" ? row.id : "",
		feed_id: typeof feedId === "string" ? feedId : "",
		title: typeof row.title === "string" ? row.title : "",
		url: typeof row.url === "string" ? row.url : null,
		summary: typeof row.summary === "string" ? row.summary : null,
		author: typeof row.author === "string" ? row.author : null,
		published_at: typeof publishedAt === "number" ? publishedAt : 0,
		read_at: typeof readAt === "number" ? readAt : null,
		saved_at: typeof savedAt === "number" ? savedAt : null,
		flagged_at: typeof row.flagged_at === "number" ? row.flagged_at : null,
	};
}

/**
 * What somebody typed, as a `LIKE` pattern that looks for exactly that text. The escape
 * character is escaped first, so escaping a wildcard afterwards cannot be undone by it.
 *
 * @param query - The text somebody typed into the search box.
 * @returns The pattern to match, or `null` when the box held nothing but space.
 */
function likePattern(query: string): string | null {
	let trimmed = query.trim();
	if (trimmed.length === 0) return null;

	let escaped = trimmed
		.replaceAll(LIKE_ESCAPE, LIKE_ESCAPE + LIKE_ESCAPE)
		.replaceAll("%", `${LIKE_ESCAPE}%`)
		.replaceAll("_", `${LIKE_ESCAPE}_`);

	return `%${escaped}%`;
}

/**
 * Runs `work` over every value, {@link ON_DEMAND_CONCURRENCY} of them at a time.
 *
 * Whatever one value's turn did stops there, so the worker that took it carries on to the
 * next rather than retiring with the queue half read.
 *
 * @param values - What to work through.
 * @param work - What one value's turn does.
 */
async function inParallel<value>(
	values: readonly value[],
	work: (value: value) => Promise<void>,
	concurrency: number = ON_DEMAND_CONCURRENCY,
): Promise<void> {
	let next = 0;

	let workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
		while (next < values.length) {
			let value = values[next++];
			if (value === undefined) return;
			await work(value).catch(() => undefined);
		}
	});

	await Promise.allSettled(workers);
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

/** A settings row as the RPC boundary reports it. */
function toSettings(row: SelectSettings): UserStore.Settings {
	return {
		subject: row.subject,
		lastRefreshedAt: row.last_refreshed_at,
		tier: storedTier(row),
		tierSource: storedTierSource(row),
		graceUntil: row.grace_until,
		tierCheckedAt: row.tier_checked_at,
		presentation: toPresentation(row),
	};
}

/**
 * The tier a settings row holds. The column carries a `CHECK` listing exactly these
 * names, so a value outside them is a row no statement of this app could have written,
 * and the free tier is the answer that refuses rather than grants.
 */
function storedTier(row: SelectSettings): Tier {
	return isTier(row.tier) ? row.tier : DEFAULT_TIER;
}

/**
 * The tier a settings row buys right now. A lease whose window has run out is free until
 * a snapshot says otherwise, which is what bounds the cost of a subscription that lapsed
 * and a billing integration that went quiet: nothing has to arrive for the wakes to stop.
 *
 * @param row - The settings row the object is deciding from.
 * @param now - Epoch milliseconds the lease is measured at.
 */
function leasedTier(row: SelectSettings, now: number): Tier {
	if (row.grace_until !== null && row.grace_until <= now) return DEFAULT_TIER;
	return storedTier(row);
}

/** Whether a due time has arrived, which a job with no due time never has. */
function isDue(at: number | null, now: number): boolean {
	return at !== null && at <= now;
}

/** Where a settings row's tier came from, read under the same rule as the tier itself. */
function storedTierSource(row: SelectSettings): TierSource {
	return isTierSource(row.tier_source) ? row.tier_source : DEFAULT_TIER_SOURCE;
}

/** A label row as the RPC boundary reports it. */
function toTag(row: SelectTag): UserStore.Tag {
	return { id: row.id, name: row.name, slug: row.slug };
}

/** A rule row as the RPC boundary reports it, counters included. */
function toRule(row: SelectRule): UserStore.Rule {
	return {
		id: row.id,
		feedId: row.feed_id,
		field: row.field,
		value: row.value,
		action: row.action,
		matches: row.matches,
		lastMatchedAt: row.last_matched_at,
	};
}

/** A saved search as the RPC boundary reports it. */
function toSavedSearch(row: SelectSearch): UserStore.SavedSearch {
	return {
		id: row.id,
		name: row.name,
		query: row.query,
		readState: isReadState(row.read_state) ? row.read_state : "all",
		feedId: row.feed_id,
	};
}

/** Whether a submitted value is one of the read states the column's `CHECK` allows. */
function isReadState(value: string): value is UserStore.ReadState {
	return SEARCH_READ_STATES.some((offered) => offered === value);
}

/** A stored post as the matching language reads it, which is four of its columns. */
function toRuleSubject(row: TimelineRow) {
	return { title: row.title, url: row.url, summary: row.summary, author: row.author };
}

/** A folder row as the RPC boundary reports it, which is its id and its name. */
function toFolder(row: SelectFolder): UserStore.Folder {
	return { id: row.id, title: row.title };
}

/**
 * A feed row and its unread count as the feed list renders them.
 *
 * @param folder - The group it is filed in, which a caller that has already read the
 * reader's folders passes rather than making this read one per row.
 */
function toFeedSummary(
	row: SelectFeed,
	unreadCount: number,
	folder: UserStore.Folder | null = null,
): UserStore.FeedSummary {
	return {
		id: row.id,
		feedId: row.feed_id,
		feedUrl: row.feed_url,
		siteUrl: row.site_url,
		title: row.title,
		description: row.description,
		imageUrl: row.image_url,
		velocity: row.velocity,
		unreadCount,
		folderId: row.folder_id,
		folderTitle: folder === null ? null : folder.title,
		pinnedAt: row.pinned_at,
		postsPerDay: row.posts_per_day,
		notify: row.notify,
		keepLinkParameters: row.keep_link_parameters,
	};
}

/**
 * An hour of the day, or the default for anything outside one. A submission nothing on the
 * page could have produced still leaves a window a reader can read and change.
 *
 * @param value - The hour submitted.
 * @param fallback - The hour to use for a value outside the day.
 */
function clampHour(value: number, fallback: number): number {
	if (!Number.isInteger(value) || value < 0 || value > 23) return fallback;
	return value;
}

/**
 * Whether the platform recognizes an IANA zone name. A name it does not know would put
 * quiet hours in UTC forever without saying so, so it is refused at the one place it is
 * written.
 *
 * @param value - The name a browser reported.
 */
function isTimeZone(value: string): boolean {
	try {
		new Intl.DateTimeFormat("en-GB", { timeZone: value });
		return true;
	} catch {
		return false;
	}
}

/** One registered device as the RPC boundary reports it, with the endpoint left behind. */
function toDevice(row: SelectPushSubscription): UserStore.Device {
	return {
		id: row.id,
		service: serviceOf(row.endpoint),
		userAgent: row.user_agent,
		lastDeliveredAt: row.last_delivered_at,
		createdAt: row.created_at,
	};
}

/**
 * The push service a device is reached through, by host alone. The rest of an endpoint is
 * a bearer capability for that device, so it stays inside the object and never reaches a
 * page that is only naming a row to revoke.
 *
 * @param endpoint - The URL the push service gave the browser.
 */
function serviceOf(endpoint: string): string {
	try {
		return new URL(endpoint).host;
	} catch {
		return "";
	}
}

/** One timeline row as the RPC boundary reports it. */
function toItem(row: TimelineRow): UserStore.Item {
	return {
		id: row.id,
		feedId: row.feed_id,
		title: row.title,
		url: row.url,
		summary: row.summary,
		author: row.author,
		publishedAt: row.published_at,
		readAt: row.read_at,
		savedAt: row.saved_at,
		flaggedAt: row.flagged_at,
		/** Filled in by the two surfaces that draw chips, and by no page of the river. */
		tags: [],
	};
}

/** How a reader's pages look, as one row of `settings` reads. */
function toPresentation(row: SelectSettings): UserStore.Presentation {
	return {
		theme: isTheme(row.theme) ? row.theme : DEFAULT_THEME,
		face: isReadingFace(row.reading_face) ? row.reading_face : DEFAULT_READING_FACE,
	};
}

/** Whether a value is one of the schemes the column and the theme contract both name. */
export function isTheme(value: unknown): value is Theme {
	return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/** Whether a value is one of the faces a reading surface may be set in. */
export function isReadingFace(value: unknown): value is ReadingFace {
	return typeof value === "string" && (READING_FACES as readonly string[]).includes(value);
}

/**
 * Reads what somebody pasted as an HTTP URL, so a bare `example.com` reaches discovery
 * the way typing it into a browser would. The fragment is dropped: it addresses a place
 * inside a document rather than a document, so two pastes differing only by one name the
 * same subscription.
 */
function normalizeFeedUrl(input: string): string | null {
	let trimmed = input.trim();
	if (trimmed.length === 0) return null;

	/**
	 * A subscribe button hands out `feed://example.com/rss`, or `feed:` wrapped around a
	 * whole address, and a reader who clicked one and pasted what they got is holding the
	 * feed they meant. The scheme says "this is a feed" rather than how to fetch it, so it
	 * comes off and what is underneath is read as the address it is.
	 */
	let addressed = trimmed.replace(/^feeds?:(\/\/)?/i, "");
	if (addressed.length === 0) return null;

	let candidate = /^[a-z][\d+.a-z-]*:/i.test(addressed) ? addressed : `https://${addressed}`;
	if (!URL.canParse(candidate)) return null;

	let url = new URL(candidate);
	if (url.protocol !== "http:" && url.protocol !== "https:") return null;

	url.hash = "";
	return url.toString();
}

/** Whether a submitted value is one of the velocities the column's `CHECK` allows. */
function isVelocity(value: string): value is Velocity {
	return VELOCITIES.some((offered) => offered === value);
}

/**
 * A feed's share of the reader's budget: the whole of it divided by how many feeds they
 * follow. One feed may fill it alone; a thousand feeds get a thousand posts each, and a
 * quiet feed is never charged for a prolific one.
 *
 * @param followed - How many feeds the reader follows.
 * @param budget - The posts this reader's object holds in all.
 */
function shareOf(followed: number, budget: number): number {
	return Math.max(1, Math.floor(budget / Math.max(1, followed)));
}

/**
 * The greatest revision a page of items accounted for, which is where a cursor lands.
 *
 * @param incoming - The page as the feed answered it, in the order it decided them.
 */
function greatestRevision(incoming: readonly FeedStore.Item[]): number {
	return incoming.reduce((highest, item) => Math.max(highest, item.revision), 0);
}

/** The columns one materialized post is written with, in the order the statement binds them. */
const ITEM_COLUMNS = [
	"id",
	"feed_id",
	"guid",
	"title",
	"url",
	"summary",
	"author",
	"published_at",
	"folder_id",
	"read_at",
	"flagged_at",
	"enclosure_url",
	"enclosure_type",
	"enclosure_length",
	"created_at",
	"updated_at",
] as const;

/**
 * The statement that writes a page of a feed's items as this reader's own copies.
 *
 * An upsert on the canonical id rather than an insert, which is what makes synchronization
 * idempotent: a run that died before it wrote its cursor re-applies the same items on the
 * retry and changes nothing. Three columns are left out of the update deliberately —
 * `read_at`, so a publisher's correction does not resurrect a post the reader has already
 * read; `id`, the key their copy is joined by; and `published_at`, the leading cursor
 * column, whose movement would make a cursor already in flight skip posts mid-scroll.
 * `saved_at` is left out for the same reason as `read_at`: it is the reader's answer, not
 * the publisher's.
 *
 * `folder_id` is written on both paths, because its one source is the subscription this
 * statement is already holding: an item arriving twice lands in the folder its feed is in
 * now, and a move that failed between the subscription and its posts heals here.
 *
 * @param subscriptionId - This reader's own handle for the feed the items came from.
 * @param incoming - The items to write.
 * `read_at` and `flagged_at` are written on insert alone, which is what lets a rule mark an
 * arriving item while leaving both of them the reader's own answer from then on.
 *
 * @param now - Epoch milliseconds the copies are stamped with.
 * @param folderId - The folder that subscription is filed in, or `null` for an unfiled one.
 * @param marks - The arrival marks rules left, by item id, or `null` for a page no rule
 * decided.
 */
function upsertItems(
	subscriptionId: string,
	incoming: readonly FeedStore.Item[],
	now: number,
	folderId: string | null,
	marks: Map<string, { readAt: number | null; flaggedAt: number | null }> | null = null,
): [string, unknown[]] {
	let values: unknown[] = [];

	for (let item of incoming) {
		let mark = marks?.get(item.id);

		values.push(
			item.id,
			subscriptionId,
			item.guid,
			item.title,
			item.url,
			item.summary,
			item.author,
			item.publishedAt,
			folderId,
			mark?.readAt ?? null,
			mark?.flaggedAt ?? null,
			item.enclosure?.url ?? null,
			item.enclosure?.type ?? null,
			item.enclosure?.length ?? null,
			now,
			now,
		);
	}

	let row = `(${ITEM_COLUMNS.map(() => "?").join(", ")})`;
	let columns = ITEM_COLUMNS.map((column) => `"${column}"`).join(", ");

	let statement = [
		`insert into "feed_items" (${columns})`,
		`values ${incoming.map(() => row).join(", ")}`,
		`on conflict ("id") do update set`,
		`"title" = excluded."title",`,
		`"url" = excluded."url",`,
		`"summary" = excluded."summary",`,
		`"author" = excluded."author",`,
		`"folder_id" = excluded."folder_id",`,
		`"enclosure_url" = excluded."enclosure_url",`,
		`"enclosure_type" = excluded."enclosure_type",`,
		`"enclosure_length" = excluded."enclosure_length",`,
		`"updated_at" = excluded."updated_at"`,
	].join(" ");

	return [statement, values];
}

/**
 * What one read state narrows the timeline by, or `null` for the state that narrows
 * nothing. Both predicates are spelled the way the partial index that serves them is, so
 * SQLite reads each page from that index rather than sorting the reader's posts.
 */
function readStateWhere(readState: UserStore.ReadState): Predicate<"read_at"> | null {
	if (readState === "unread") return isNull("read_at");
	if (readState === "read") return notNull("read_at");

	return null;
}

/**
 * What one read state narrows a hand-written statement by, or `null` for the state that
 * narrows nothing. It is the clause {@link readStateWhere} builds as a predicate, spelled
 * out in SQL because the search statement composes its own text rather than going through
 * the query builder, and both spellings match the partial index that serves them.
 *
 * @param readState - Which posts the caller asked for.
 */
function readStateSql(readState: UserStore.ReadState): SqlStatement | null {
	if (readState === "unread") return rawSql(`"read_at" is null`);
	if (readState === "read") return rawSql(`"read_at" is not null`);

	return null;
}

/** The page size a caller asked for, held between one post and {@link MAX_PAGE_LIMIT}. */
function pageLimit(limit: number | undefined): number {
	if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_PAGE_LIMIT;
	return Math.min(Math.max(Math.trunc(limit), 1), MAX_PAGE_LIMIT);
}
