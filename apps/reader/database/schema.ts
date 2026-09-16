/**
 * The reader's schema, declared for `remix/data-table` over the SQL each user object
 * keeps in its own storage. Column names and types mirror `database/migrations/`
 * exactly, since that SQL is what actually creates the tables.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyTable, TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

import type { Tier } from "~/app/lib/entitlement";

/** Payload accepted when writing a row, with database defaults left out. */
type InsertRow<sourceTable extends AnyTable> = Partial<TableRow<sourceTable>>;

/**
 * How long a post from a feed stays in the reader's timeline, measured from when it was
 * published. The `CHECK` constraint in `0006-shared-feed-objects.sql` repeats these
 * names, so the database refuses anything a form somehow lets through.
 *
 * It is a per-subscription answer because two people following one newspaper disagree
 * about it all the time — one wants the day's headlines gone by evening, the other keeps
 * them for the weekend — and neither is wrong, so neither answer belongs in the object
 * they share.
 */
export const VELOCITIES = ["breaking", "news", "article", "essay", "evergreen"] as const;

/** One of the answers {@link VELOCITIES} offers. */
export type Velocity = (typeof VELOCITIES)[number];

/**
 * How long each of them holds a post, and `null` for the one that never lets go.
 *
 * Measured from when the world saw the post rather than from when this system found it,
 * which is the opposite of the rule the feed side prunes by and for the opposite reason:
 * a headline published four hours ago is stale whether it was discovered four hours ago
 * or four minutes ago.
 */
export const VELOCITY_WINDOW_MS: Record<Velocity, number | null> = {
	breaking: 3 * 60 * 60 * 1000,
	news: 18 * 60 * 60 * 1000,
	article: 3 * 24 * 60 * 60 * 1000,
	essay: 14 * 24 * 60 * 60 * 1000,
	evergreen: null,
};

/**
 * What a subscription holds until the reader says otherwise, which is everything. A rule
 * that deletes an unread post is the reader's to ask for, so nothing ages out of a feed
 * they have not set a velocity on.
 */
export const DEFAULT_VELOCITY: Velocity = "evergreen";

/**
 * Posts one reader's object keeps across every feed they follow, by the tier they are on.
 *
 * A budget rather than a per-feed number, because a per-feed number is wrong at both
 * ends: a reader following one feed would be held to a cap sized for somebody following
 * two hundred, and a reader following two hundred would be allowed two hundred times more
 * than one of them. The object is what has a limit, so the object is what gets the figure,
 * and a feed's share of it is this divided by how many feeds the reader follows.
 *
 * Each figure is a count of rows priced at two kilobytes apiece, against the ten
 * gigabytes an object gets: half a gigabyte, three, and six. They sit that far inside the
 * object because a write to a full one fails and takes the sweep that would make room with
 * it, where a budget reached is back-pressure the interface explains.
 */
export const TIER_BUDGETS: Record<Tier, number> = {
	free: 250_000,
	paid: 1_500_000,
	premium: 3_000_000,
};

/**
 * Posts a reader may keep saved, by the tier they are on.
 *
 * The numbers are about what a person can meaningfully keep rather than about storage —
 * the largest of them is fifty megabytes against a budget measured in gigabytes. Reaching
 * one refuses the next save rather than evicting the oldest, because evicting would delete
 * the one thing in this design a reader explicitly asked to keep.
 */
export const TIER_SAVED_LIMITS: Record<Tier, number> = {
	free: 1_000,
	paid: 5_000,
	premium: 25_000,
};

/**
 * Labels one reader may have.
 *
 * A hundred keeps the picker the same kind of thing as the rail: one unpaged read, drawn
 * whole, scannable without a search box of its own. Somebody with four hundred labels has
 * a second junk drawer with a worse interface, and the honest moment to say so is at the
 * hundred-and-first rather than when they are looking for something.
 */
export const TAG_LIMIT = 100;

/**
 * Labels one post may carry. It bounds the join table against the saved cap, and is
 * generous against how anybody labels: a post with eleven reasons to have been kept has
 * none.
 */
export const TAGS_PER_ITEM = 10;

/**
 * How long a label may be, in UTF-16 units. Thirty-two is where a label is still a chip on
 * one line beside four others, and past which somebody is writing a note into a field the
 * search serves better.
 */
export const TAG_NAME_LENGTH = 32;

/**
 * Subscriptions a reader may pin. A feed somebody never wants to miss stops meaning
 * anything at thirty, the strip has to sit above the river without becoming the page, and
 * ten ids sit well inside the hundred-parameter bind limit every lookup here works under.
 */
export const PIN_LIMIT = 10;

/**
 * Below what measured rate a feed is quiet: one post a week, against the thirty-day window
 * the measurement is taken over, so a monthly newsletter at 0.03 and a three-a-month blog
 * at 0.1 are in while a twice-weekly feed is out.
 *
 * It is the same judgement as the rate above which a feed publishes enough to be worth
 * offering a velocity for, read from the other end: that one decides when a feed is busy,
 * this one when it publishes so little that it disappears.
 */
export const QUIET_POSTS_PER_DAY = 1 / 7;

/**
 * The local hour a reader's quiet window opens at when they turn it on and name no hour of
 * their own, which is late enough to cover an evening and early enough to cover a night.
 */
export const QUIET_FROM_HOUR = 22;

/** The local hour that window closes at, which is where an ordinary morning starts. */
export const QUIET_TO_HOUR = 7;

/**
 * Feed titles one notification names. Three is what a sentence carries before it becomes a
 * list, and the count beside them is what says how much the three stand for.
 */
export const NOTIFY_FEED_TITLES = 3;

/**
 * Consecutive transient refusals after which a device is forgotten. An endpoint that has
 * refused across ten checks is not coming back, and any acceptance clears the count.
 */
export const PUSH_FAILURE_LIMIT = 10;

/**
 * What a rule may look at, which is what crosses the RPC boundary from the feed's own
 * object. The `CHECK` constraint in `0011-filter-rules.sql` repeats these names, so the
 * database refuses anything a form somehow lets through.
 *
 * `summary` is the one with a surprise in it: it is capped at what the timeline renders,
 * so a rule matching on it matches the line under the title rather than the article.
 */
export const RULE_FIELDS = ["title", "url", "summary", "author"] as const;

/** One of the fields {@link RULE_FIELDS} offers. */
export type RuleField = (typeof RULE_FIELDS)[number];

/**
 * What a rule does with a post it matched. `drop` refuses the item before it is written,
 * `mark_read` writes it already read, and `flag` writes it with a mark the timeline shows.
 *
 * Saving is absent: a save is exempt from velocity, from the read-age reclamation and from
 * the budget, against a cap that refuses rather than evicts, so a rule that saved would
 * spend a reader's own allowance on machine picks. Flagging carries no exemption, which is
 * what makes it the positive action a rule may take.
 */
export const RULE_ACTIONS = ["drop", "mark_read", "flag"] as const;

/** One of the actions {@link RULE_ACTIONS} offers. */
export type RuleAction = (typeof RULE_ACTIONS)[number];

/**
 * The read states a saved search may be kept under, which are the three the queue itself
 * offers. The `CHECK` constraint in `0014-searches.sql` repeats these names, so the
 * database refuses anything a form somehow lets through.
 */
export const SEARCH_READ_STATES = ["all", "unread", "read"] as const;

/** One of the states {@link SEARCH_READ_STATES} offers. */
export type SearchReadState = (typeof SEARCH_READ_STATES)[number];

/**
 * Queries a reader may keep. Twenty is past where a rail of them is still a list somebody
 * reads down, and the twenty-first is refused rather than evicting one, which is how every
 * other full shelf in this object answers.
 */
export const SAVED_SEARCH_LIMIT = 20;

/**
 * How long a saved search's name may be, in UTF-16 units. Past this a name is a sentence,
 * and a sentence in a rail is a row nobody can read to the end of.
 */
export const SEARCH_NAME_LENGTH = 64;

/**
 * How long the text a rule looks for may be, in UTF-16 units. A filter longer than this is
 * a sentence, and a sentence matches nothing, so the cap is where the field stops being a
 * filter rather than where storage starts to care.
 */
export const RULE_VALUE_LENGTH = 100;

/**
 * How many of the reader's newest posts a candidate rule is previewed against. One indexed
 * page over `(published_at, id)` — the same seek the timeline is — which is what makes the
 * preview the retroactivity this design has, bounded and read-only.
 */
export const RULE_PREVIEW_POSTS = 200;

/**
 * The schemes a document may be painted in. The `CHECK` constraint in
 * `0015-presentation.sql` repeats these names, so the database refuses anything a form
 * somehow lets through.
 *
 * They are the vocabulary the theme layer already reads off an ancestor class, so the
 * stored answer reaches `<html>` untranslated.
 */
export const THEMES = ["system", "light", "dark"] as const;

/** One of the schemes {@link THEMES} offers. */
export type Theme = (typeof THEMES)[number];

/** What a reader is shown until they say otherwise, which is whatever their system says. */
export const DEFAULT_THEME: Theme = "system";

/**
 * The faces a post's title and its words may be set in. The `CHECK` constraint in
 * `0015-presentation.sql` repeats these names.
 */
export const READING_FACES = ["sans", "serif"] as const;

/** One of the faces {@link READING_FACES} offers. */
export type ReadingFace = (typeof READING_FACES)[number];

/** The face reading surfaces are set in until the reader picks the other one. */
export const DEFAULT_READING_FACE: ReadingFace = "sans";

/**
 * How one subscription's posts are drawn. `text` is the dense list every surface renders,
 * and `image` is the picture-first reading a feed of drawings wants.
 *
 * A mode rather than a boolean, so a third rendering is a value rather than a second
 * column, and per subscription for the reason {@link VELOCITIES} is: two people following
 * one comic disagree about whether they want the picture or the line, and neither is wrong.
 */
export const PRESENTATIONS = ["text", "image"] as const;

/** One of the modes {@link PRESENTATIONS} offers. */
export type Presentation = (typeof PRESENTATIONS)[number];

/** How a subscription's posts are drawn until the reader asks for the other mode. */
export const DEFAULT_PRESENTATION: Presentation = "text";

export const settings = table({
	name: "settings",
	primaryKey: ["id"],
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.integer(),
		subject: c.text(),
		last_refreshed_at: c.integer().nullable(),
		/** What every limit check reads, written only by the one RPC that takes a snapshot. */
		tier: c.text().default("free"),
		/** Whether the payment platform put the tier there or a person did. */
		tier_source: c.text().default("default"),
		/** When the lapse window runs out, and `null` while the reader has not lapsed. */
		grace_until: c.integer().nullable(),
		/**
		 * When a snapshot last confirmed the tier. A write carrying an older read is refused,
		 * so two snapshots landing out of order converge on the later one.
		 */
		tier_checked_at: c.integer().default(0),
		/** When the reader last opened the reader, which dormancy is measured from. */
		last_opened_at: c.integer().nullable(),
		/** When the next scheduled freshness check is due, and `null` for a tier arming none. */
		next_check_at: c.integer().nullable(),
		/** When the next retention sweep is due, so a velocity window closes on its own. */
		next_sweep_at: c.integer().nullable(),
		/** When the leftovers of a bounded run carry on, and `null` while there are none. */
		next_catch_up_at: c.integer().nullable(),
		/** Whether a notified feed reaches the reader on the devices they registered. */
		notify_push: c.boolean().default(false),
		/** Whether a notified feed reaches the reader at the address sign-in wrote. */
		notify_email: c.boolean().default(false),
		/**
		 * The IANA zone quiet hours are computed in, captured from the browser that knows it.
		 * A name rather than an offset, so daylight saving is the platform's problem.
		 */
		time_zone: c.text().default("UTC"),
		/** Whether the window below is applied at all. */
		quiet_hours: c.boolean().default(false),
		/** The local hour the quiet window opens at. */
		quiet_from: c.integer().default(QUIET_FROM_HOUR),
		/** The local hour the quiet window closes at. */
		quiet_to: c.integer().default(QUIET_TO_HOUR),
		/**
		 * When a notification last went out, and `null` before the first one. It is the whole
		 * of the notification state: the summary, the minimum gap and the retry after a failed
		 * send are derived from it, so a suppression is a deferral rather than a loss.
		 */
		last_notified_at: c.integer().nullable(),
		/**
		 * Where the email channel sends, written on every completed sign-in. It is never a
		 * key, because an address can be reassigned and the subject naming this object cannot.
		 */
		email: c.text().nullable(),
		/** The scheme every page of this reader's is painted in. */
		theme: c.enum(THEMES).default(DEFAULT_THEME),
		/** The face a post's title and its words are set in, which never reaches the chrome. */
		reading_face: c.enum(READING_FACES).default(DEFAULT_READING_FACE),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

export const feeds = table({
	name: "feeds",
	primaryKey: ["id"],
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		/** This app's own handle for the subscription, which its URLs are built from. */
		id: c.text(),
		/** The catalog's identifier for the feed, which names the object behind it. */
		feed_id: c.text(),
		feed_url: c.text(),
		site_url: c.text().nullable(),
		title: c.text(),
		description: c.text().nullable(),
		language: c.text().nullable(),
		image_url: c.text().nullable(),
		cursor: c.integer().default(0),
		velocity: c.enum(VELOCITIES).default(DEFAULT_VELOCITY),
		unfollowed_at: c.integer().nullable(),
		created_at: c.integer(),
		updated_at: c.integer(),
		/** The group the reader filed this subscription into, or `null` for an unfiled one. */
		folder_id: c.text().nullable(),
		/**
		 * When the reader pinned this subscription, or `null` for one they have not. A
		 * timestamp rather than a boolean, for the reason the other marks here are: it
		 * answers when as well as whether, so pin order is an ordering the reader produced.
		 */
		pinned_at: c.integer().nullable(),
		/**
		 * What the feed publishes, in posts per day, as the feed's own object measured it.
		 * Declared as a decimal here for a column the migration creates as `REAL`, since a
		 * rate below one post a day is the whole of what it is read for.
		 */
		posts_per_day: c.decimal(10, 4).nullable(),
		/**
		 * Whether this reader wants to hear about this publisher. Off at every level and
		 * through every change of state: following, importing and changing plan each leave it
		 * where it was, because a reader who upgrades bought a faster check and not an alarm
		 * clock.
		 */
		notify: c.boolean().default(false),
		/** How this subscription's posts are drawn, which is the reader's own answer for it. */
		presentation: c.enum(PRESENTATIONS).default(DEFAULT_PRESENTATION),
		/**
		 * Whether this feed's links are rendered with the address exactly as the publisher
		 * wrote it. Off, which is what leaves a reader's arrival unattributed; a reader turns
		 * it on for the one publisher whose server routes on a parameter the strip removes.
		 */
		keep_link_parameters: c.boolean().default(false),
	},
});

/**
 * One browser the reader asked to be reached on.
 *
 * `p256dh` and `auth` are the client's public key and auth secret exactly as the Push API
 * hands them over, and are what the payload is encrypted under. `user_agent` is what lets
 * the settings page name a device instead of showing a 200-character URL, and `locale` is
 * the language that browser was reading the app in, which is the language its notification
 * is written in.
 */
export const pushSubscriptions = table({
	name: "push_subscriptions",
	primaryKey: ["id"],
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text(),
		/** The URL the push service gave this browser, which uniqueness is taken over. */
		endpoint: c.text(),
		p256dh: c.text(),
		auth: c.text(),
		user_agent: c.text().nullable(),
		locale: c.text().default("en"),
		last_delivered_at: c.integer().nullable(),
		/** Consecutive transient refusals, cleared by any acceptance. */
		failure_count: c.integer().default(0),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

export const feedItems = table({
	name: "feed_items",
	primaryKey: ["id"],
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text(),
		feed_id: c.text(),
		guid: c.text(),
		title: c.text(),
		url: c.text().nullable(),
		summary: c.text().nullable(),
		author: c.text().nullable(),
		/**
		 * Written on insert and never updated. It leads the timeline's ordering, so
		 * moving a row within that ordering would make a cursor already in flight skip
		 * posts or serve them twice mid-scroll.
		 */
		published_at: c.integer(),
		read_at: c.integer().nullable(),
		saved_at: c.integer().nullable(),
		/**
		 * When a rule marked this post on arrival, or `null` for one no rule flagged. It is
		 * a mark on the timeline and nothing more: a flagged post ages out under its feed's
		 * velocity and is reclaimed by the budget like any other.
		 */
		flagged_at: c.integer().nullable(),
		created_at: c.integer(),
		updated_at: c.integer(),
		/**
		 * The folder of the subscription this post belongs to, copied in when the post is
		 * written, which is what makes a folder's timeline the seek every other timeline is.
		 * It is rewritten whenever the subscription moves, since it is the reader's own
		 * answer rather than the publisher's and it orders nothing.
		 */
		folder_id: c.text().nullable(),
		/**
		 * The one media file the post arrived with, copied from the canonical item. Three
		 * nulls is a post with no audio or video attached, which is most of them.
		 */
		enclosure_url: c.text().nullable(),
		enclosure_type: c.text().nullable(),
		enclosure_length: c.integer().nullable(),
	},
});

/**
 * Named groups of subscriptions, each with a stream of its own.
 *
 * Flat: no parent, no position, no depth. The list is short and it is drawn in the order
 * the names read, the way the rail draws subscriptions, and the unique title in
 * `0007-folders.sql` is what both keeps two rows from reading alike and makes filing by
 * name an upsert.
 */
export const folders = table({
	name: "folders",
	primaryKey: ["id"],
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text(),
		title: c.text(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

/**
 * The labels a reader puts on the posts they kept.
 *
 * Held by an id rather than by the name, which is what makes renaming one write a single
 * row however many posts carry it and keeps a URL built from a label working after it is
 * renamed. {@link tags.slug} is the folded form uniqueness is taken over, so `Rust` and
 * `rust` are one label wearing the name it was first given.
 */
export const tags = table({
	name: "tags",
	primaryKey: ["id"],
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text(),
		/** The name as the reader typed it, which is the one drawn. */
		name: c.text(),
		/** The case-folded form uniqueness and matching are taken over. */
		slug: c.text(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

/**
 * Which posts carry which label, one row per pairing.
 *
 * `published_at` is a copy of the post's own. It is what puts the filter and both ordering
 * columns into one index, since no index spans two tables, and it is safe to copy because
 * that column is frozen against a publisher's edits: it leads the timeline's ordering, and
 * a row moving within that ordering would make an in-flight cursor skip posts. The copy is
 * written once, by the statement that applies the label.
 *
 * Every row here belongs to a saved post by construction, so a query for a reader's kept
 * posts under one label needs no `saved_at` filter: the join is the filter.
 */
export const itemTags = table({
	name: "item_tags",
	primaryKey: ["tag_id", "item_id"],
	columns: {
		tag_id: c.text(),
		item_id: c.text(),
		published_at: c.integer(),
		created_at: c.integer(),
	},
});

/**
 * The rules a reader writes about what a post says, applied as items arrive and before
 * they are written.
 *
 * Every matching rule applies and `drop` dominates, so there is no position column and no
 * ordering: three actions of which one dominates and the other two commute cannot produce
 * an interaction an order would resolve differently.
 *
 * {@link rules.feed_id} is this app's own subscription id rather than the catalog's, and
 * `null` is what makes a rule cover feeds the reader has not followed yet.
 */
export const rules = table({
	name: "rules",
	primaryKey: ["id"],
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text(),
		/** The subscription this rule is scoped to, or `null` for one covering every feed. */
		feed_id: c.text().nullable(),
		field: c.enum(RULE_FIELDS),
		/** The text looked for, matched case-insensitively and as a substring of the field. */
		value: c.text(),
		action: c.enum(RULE_ACTIONS),
		/**
		 * How many items this rule has decided. It is counted against every rule that matched
		 * one, so two overlapping rules each count the same post: the number answers whether
		 * a rule is doing anything rather than how many posts were affected.
		 */
		matches: c.integer().default(0),
		last_matched_at: c.integer().nullable(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

/**
 * The queries a reader kept, each one a narrowing of the reading queue and nothing more.
 *
 * A row here holds what the queue's own controls hold — words, a read state, and the
 * subscription the search is scoped to — so the rail draws it as that queue's address and
 * opening it runs the statement typing those words runs.
 */
export const searches = table({
	name: "searches",
	primaryKey: ["id"],
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text(),
		/** What the reader called it, which is the word the rail draws and orders by. */
		name: c.text(),
		/** The text searched for, exactly as it was typed, since the spacing is part of it. */
		query: c.text(),
		read_state: c.enum(SEARCH_READ_STATES),
		/** The subscription the search is scoped to, or `null` for one across every feed. */
		feed_id: c.text().nullable(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

export type SelectRule = TableRow<typeof rules>;
export type InsertRule = InsertRow<typeof rules>;

export type SelectSearch = TableRow<typeof searches>;
export type InsertSearch = InsertRow<typeof searches>;

export type SelectTag = TableRow<typeof tags>;
export type InsertTag = InsertRow<typeof tags>;
export type SelectItemTag = TableRow<typeof itemTags>;
export type InsertItemTag = InsertRow<typeof itemTags>;

export type SelectFolder = TableRow<typeof folders>;
export type InsertFolder = InsertRow<typeof folders>;

export type SelectSettings = TableRow<typeof settings>;
export type InsertSettings = InsertRow<typeof settings>;
export type SelectFeed = TableRow<typeof feeds>;
export type InsertFeed = InsertRow<typeof feeds>;
export type SelectFeedItem = TableRow<typeof feedItems>;
export type InsertFeedItem = InsertRow<typeof feedItems>;

export type SelectPushSubscription = TableRow<typeof pushSubscriptions>;
export type InsertPushSubscription = InsertRow<typeof pushSubscriptions>;
