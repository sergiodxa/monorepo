/**
 * What each tier allows, and the pure rules that turn a billing snapshot into the tier a
 * reader is on. Nothing here reaches a database, a platform or a clock, so every limit and
 * every lapse decision is decidable from its arguments alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { TIER_BUDGETS, TIER_SAVED_LIMITS } from "~/database/schema";

/**
 * The three prices the product sells, ordered from least to most. The `CHECK` constraint
 * on `settings.tier` repeats these names, so the database refuses anything else.
 */
export const TIERS = ["free", "paid", "premium"] as const;

/** One of the prices {@link TIERS} offers. */
export type Tier = (typeof TIERS)[number];

/**
 * Where a tier came from. It is what reconciliation reads to decide which rows it may
 * lower: a tier a person granted outlives whatever the platform says about the money.
 */
export const TIER_SOURCES = ["default", "billing", "grant"] as const;

/** One of the origins {@link TIER_SOURCES} offers. */
export type TierSource = (typeof TIER_SOURCES)[number];

/** What a reader is on before anything has said otherwise. */
export const DEFAULT_TIER: Tier = "free";

/** What a tier's origin is before anything has said otherwise. */
export const DEFAULT_TIER_SOURCE: TierSource = "default";

/**
 * How long a lapsed reader keeps everything they were paying for. Long enough to cover a
 * card that expired while somebody was away, and short of the shortest calendar month so
 * a lapse never hands out a second free period.
 */
export const GRACE_PERIOD_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * How long a tier may go unconfirmed before a sign-in re-reads it. A lost delivery is
 * repaired well inside {@link GRACE_PERIOD_MS}, so it can never be what drops somebody.
 */
export const TIER_STALE_MS = 24 * 60 * 60 * 1000;

/** The counts a tier caps, named so a refusal says which one refused. */
export type LimitName = "feeds" | "saved" | "rules" | "posts";

/** What one tier allows, as every enforcement point reads it. */
export interface TierLimits {
	/** Subscriptions the reader may hold, which is the cap that bounds the worst case. */
	feeds: number;
	/** Posts the reader may keep saved. */
	saved: number;
	/** Filter rules the reader may have. */
	rules: number;
	/** Posts the reader's object may hold before it reclaims, and then refuses. */
	posts: number;
	/** How often the reader's own object wakes to compare heads; `null` arms no alarm. */
	checkIntervalMs: number | null;
	/** How far back a search reaches, in days; `null` searches everything stored. */
	searchWindowDays: number | null;
	/** Whether folders and tags may be created. */
	folders: boolean;
	/** Whether the reader's filter rules run on synchronization. */
	filterRules: boolean;
	/** Whether a post's full text is extracted. */
	fullText: boolean;
	/** Whether the MCP server accepts a session. */
	mcp: boolean;
	/** Whether the public API accepts a request. */
	publicApi: boolean;
	/** Whether digests are sent by email. */
	emailDigests: boolean;
	/** Whether sources other than feeds may be added. */
	nonFeedSources: boolean;
	/** Whether the AI surfaces answer. */
	ai: boolean;
}

/**
 * Every tier's allowance, spelled once. A number here is both what a limit check compares
 * against and what the copy telling a reader they are over it prints.
 */
export const TIER_LIMITS: Record<Tier, TierLimits> = {
	free: {
		feeds: 50,
		saved: TIER_SAVED_LIMITS.free,
		rules: 0,
		posts: TIER_BUDGETS.free,
		checkIntervalMs: null,
		searchWindowDays: 30,
		folders: false,
		filterRules: false,
		fullText: false,
		mcp: false,
		publicApi: false,
		emailDigests: false,
		nonFeedSources: false,
		ai: false,
	},
	paid: {
		feeds: 200,
		saved: TIER_SAVED_LIMITS.paid,
		rules: 50,
		posts: TIER_BUDGETS.paid,
		checkIntervalMs: 30 * 60 * 1000,
		searchWindowDays: null,
		folders: true,
		filterRules: true,
		fullText: true,
		mcp: true,
		publicApi: true,
		emailDigests: false,
		nonFeedSources: false,
		ai: false,
	},
	premium: {
		feeds: 500,
		saved: TIER_SAVED_LIMITS.premium,
		rules: 200,
		posts: TIER_BUDGETS.premium,
		checkIntervalMs: 5 * 60 * 1000,
		searchWindowDays: null,
		folders: true,
		filterRules: true,
		fullText: true,
		mcp: true,
		publicApi: true,
		emailDigests: true,
		nonFeedSources: true,
		ai: true,
	},
};

/**
 * The product slug each paid tier is sold under, which is the name a checkout addresses
 * and the name a snapshot reports back among the products a customer holds.
 */
export const TIER_PRODUCTS: Record<Exclude<Tier, "free">, string> = {
	paid: "reader-paid",
	premium: "reader-premium",
};

/**
 * Subscription statuses under which a held product grants its tier. A lapse keeps the
 * reader on their tier through the grace period rather than through the status, so a
 * status that is not settled grants nothing and the grace rule decides what happens.
 */
export const ENTITLING_STATUSES = ["active", "trialing"] as const;

/** Where a tier is compared from, so "higher than" is one comparison rather than a table. */
export function tierRank(tier: Tier): number {
	return TIERS.indexOf(tier);
}

/** What a tier allows, for a call site holding only the name. */
export function limitsOf(tier: Tier): TierLimits {
	return TIER_LIMITS[tier];
}

/** Whether a submitted value is one of the tiers the column's `CHECK` allows. */
export function isTier(value: string): value is Tier {
	return TIERS.some((offered) => offered === value);
}

/** Whether a submitted value is one of the origins the column's `CHECK` allows. */
export function isTierSource(value: string): value is TierSource {
	return TIER_SOURCES.some((offered) => offered === value);
}

/**
 * The highest tier a set of held product slugs grants, which is `free` for a reader
 * holding nothing this app sells.
 *
 * @param products - Product slugs, as a snapshot reports them.
 */
export function tierForProducts(products: readonly (string | null)[]): Tier {
	let held: Tier = DEFAULT_TIER;

	for (let [tier, slug] of Object.entries(TIER_PRODUCTS)) {
		if (!products.includes(slug)) continue;
		if (tierRank(tier as Tier) > tierRank(held)) held = tier as Tier;
	}

	return held;
}

/** One subscription of a snapshot, in the two fields the tier is derived from. */
export interface SnapshotSubscription {
	productSlug: string | null;
	status: string;
}

/**
 * The tier a snapshot's settled subscriptions grant. A subscription the platform has not
 * settled grants nothing, which is what leaves the lapse to {@link effectiveTier}.
 *
 * @param subscriptions - What the customer holds, as the platform reports it.
 */
export function entitledTier(subscriptions: readonly SnapshotSubscription[]): Tier {
	let settled = subscriptions.filter((subscription) =>
		ENTITLING_STATUSES.some((status) => status === subscription.status),
	);

	return tierForProducts(settled.map((subscription) => subscription.productSlug));
}

/** What the platform says is true right now, reduced to what the lapse rule reads. */
export interface TierSnapshot {
	/** The tier the snapshot's settled products grant. */
	entitled: Tier;
	/** Whether the reader asked for the subscription to stop renewing. */
	cancelled: boolean;
}

/** The stored row the lapse rule is decided against. */
export interface StoredTier {
	tier: Tier;
	/** When the lapse window runs out, or `null` while the reader has not lapsed. */
	graceUntil: number | null;
}

/** The tier and lapse window a snapshot leaves the reader on. */
export interface TierDecision {
	tier: Tier;
	graceUntil: number | null;
}

/**
 * Decides what a snapshot does to a stored tier. An upgrade lands at once, a deliberate
 * cancellation drops as the reader asked, and anything else that would lower the tier
 * opens a lapse window first and drops only once it has run out.
 *
 * @param snapshot - What the platform says the reader holds.
 * @param stored - The tier and lapse window the reader is on now.
 * @param now - Epoch milliseconds the decision is made at.
 * @example let next = effectiveTier({ entitled: "free", cancelled: false }, stored, Date.now());
 */
export function effectiveTier(
	snapshot: TierSnapshot,
	stored: StoredTier,
	now: number,
): TierDecision {
	if (tierRank(snapshot.entitled) >= tierRank(stored.tier)) {
		return { tier: snapshot.entitled, graceUntil: null };
	}

	if (snapshot.cancelled) return { tier: snapshot.entitled, graceUntil: null };

	if (stored.graceUntil === null) return { tier: stored.tier, graceUntil: now + GRACE_PERIOD_MS };

	if (now < stored.graceUntil) return { tier: stored.tier, graceUntil: stored.graceUntil };

	return { tier: snapshot.entitled, graceUntil: null };
}

/**
 * What a limit refused, carried on every refusal that crosses the object boundary so the
 * caller renders the exact sentence — how many they hold, how many the tier allows —
 * rather than a generic failure.
 */
export interface LimitRefusal {
	/** Which limit refused. */
	limit: LimitName;
	/** How many the reader holds. */
	current: number;
	/** How many the tier allows. */
	allowed: number;
	tier: Tier;
}

/**
 * Whether one more of something fits inside a tier.
 *
 * @param tier - The tier the reader is on
 * @param limit - Which count is being added to
 * @param current - How many the reader holds already
 */
export function withinLimit(tier: Tier, limit: LimitName, current: number): boolean {
	return current < TIER_LIMITS[tier][limit];
}

/**
 * The numbers a refusal is described by, which are the numbers the sentence shown to the
 * reader is built from.
 *
 * @param tier - The tier the reader is on
 * @param limit - Which count refused
 * @param current - How many the reader holds
 */
export function limitRefusal(tier: Tier, limit: LimitName, current: number): LimitRefusal {
	return { limit, current, allowed: TIER_LIMITS[tier][limit], tier };
}

/**
 * How many over a limit a reader is, which is zero for one they are inside. It is what an
 * over-limit panel prints beside each limit rather than a percentage or a bar.
 *
 * @param refusal - The limit and the two numbers it was measured with
 */
export function overBy(refusal: LimitRefusal): number {
	return Math.max(0, refusal.current - refusal.allowed);
}
