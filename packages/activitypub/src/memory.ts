/**
 * In-memory implementations of every store the package calls, for tests and for a local
 * server that needs no persistence. They pass the conformance suite, so a test that runs
 * against them exercises the same contracts a production store is held to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";

import { toMs } from "@sdxc/duration";
import { failure, success } from "@sdxc/result";

import type { ActorKeys } from "./keys.js";
import type { ActivityPub } from "./lib/types.js";
import type {
	Follower,
	FollowerStore,
	KeyProvider,
	LocalObjects,
	SeenActivities,
	StorePage,
} from "./store.js";

/** Matches a cursor this module wrote: the decimal offset of the next item. */
const OFFSET_CURSOR = /^(0|[1-9]\d*)$/;

/**
 * The page of `items` a cursor and limit select. The cursor is the offset of the page's first
 * item, so pages over a list nobody writes to visit every item exactly once.
 */
function page<T>(items: T[], cursor: string | null, limit: number): Result<StorePage<T>, Error> {
	if (!Number.isInteger(limit) || limit < 1) {
		return failure(new RangeError(`A page limit must be a positive integer, got ${limit}.`));
	}

	let start = 0;
	if (cursor !== null) {
		if (!OFFSET_CURSOR.test(cursor)) {
			return failure(new TypeError(`"${cursor}" is not a cursor this store wrote.`));
		}
		start = Number(cursor);
	}

	let end = start + limit;
	return success({
		items: items.slice(start, end),
		next: end < items.length ? String(end) : null,
	});
}

/** The origin of `url`, or `null` for a string no follower id from a parsed actor could be. */
function originOf(url: string): string | null {
	return URL.parse(url)?.origin ?? null;
}

/**
 * Followers held in insertion order, so every listing is stable across pages. A repeated `put`
 * keeps the follower's position, and every read returns a copy the caller may change freely.
 */
export class MemoryFollowerStore implements FollowerStore {
	#followers = new Map<string, Follower>();

	/** @param followers Followers the store starts with, as if each had been `put` in order. */
	constructor(followers: Follower[] = []) {
		for (let follower of followers)
			this.#followers.set(keyOf(follower.actor, follower.id), { ...follower });
	}

	/** Inserts or replaces by `(actor, id)`, refreshing inbox, shared inbox, `followId` and state. */
	async put(follower: Follower): Promise<Result<void, Error>> {
		this.#followers.set(keyOf(follower.actor, follower.id), { ...follower });
		return success(undefined);
	}

	/** The follower in either state, or `null` when `id` does not follow `actor`. */
	async get(actor: string, id: string): Promise<Result<Follower | null, Error>> {
		let follower = this.#followers.get(keyOf(actor, id));
		return success(follower ? { ...follower } : null);
	}

	/** Succeeds whether or not the follower existed. */
	async remove(actor: string, id: string): Promise<Result<void, Error>> {
		this.#followers.delete(keyOf(actor, id));
		return success(undefined);
	}

	/** Drops followers of every local actor whose inbox or shared inbox is `inbox`. */
	async removeInbox(inbox: string): Promise<Result<void, Error>> {
		for (let [key, follower] of this.#followers) {
			if (follower.inbox === inbox || follower.sharedInbox === inbox) this.#followers.delete(key);
		}
		return success(undefined);
	}

	/** Accepted followers of `actor` in insertion order, narrowed to `origin` when given. */
	async list(
		actor: string,
		options: { cursor: string | null; limit: number; origin?: string },
	): Promise<Result<StorePage<Follower>, Error>> {
		let followers = this.#accepted(actor);
		if (options.origin !== undefined) {
			let origin = options.origin;
			followers = followers.filter((follower) => originOf(follower.id) === origin);
		}
		return page(
			followers.map((follower) => ({ ...follower })),
			options.cursor,
			options.limit,
		);
	}

	/** Accepted followers of `actor`, the number the followers collection publishes. */
	async count(actor: string): Promise<Result<number, Error>> {
		return success(this.#accepted(actor).length);
	}

	/** Each distinct `sharedInbox ?? inbox` once, in the order its first follower was added. */
	async inboxes(
		actor: string,
		options: { cursor: string | null; limit: number },
	): Promise<Result<StorePage<string>, Error>> {
		let targets = new Set(this.#accepted(actor).map((one) => one.sharedInbox ?? one.inbox));
		return page([...targets], options.cursor, options.limit);
	}

	/** The accepted followers of `actor`, in insertion order. */
	#accepted(actor: string): Follower[] {
		return [...this.#followers.values()].filter(
			(follower) => follower.actor === actor && follower.state === "accepted",
		);
	}
}

/** The map key of a follower; the separator cannot appear inside an IRI. */
function keyOf(actor: string, id: string): string {
	return `${actor} ${id}`;
}

/** What a `MemorySeenActivities` reads the time from. */
export interface MemorySeenActivitiesOptions {
	/**
	 * Milliseconds since the epoch, read on every claim, which is what lets a test pass a TTL
	 * without waiting for it.
	 *
	 * @default Date.now
	 */
	now?: () => number;
}

/** Claimed activity ids, each held until its TTL passes and then claimable again. */
export class MemorySeenActivities implements SeenActivities {
	#expires = new Map<string, number>();
	#now: () => number;

	/** @param options The clock claims are timed against. */
	constructor(options: MemorySeenActivitiesOptions = {}) {
		this.#now = options.now ?? Date.now;
	}

	/** Fails on a TTL `@sdxc/duration` cannot read, so a mistyped TTL surfaces as an error. */
	async claim(id: string, ttl: DurationInput): Promise<Result<boolean, Error>> {
		let ms = toMs(ttl);
		if (!Number.isFinite(ms) || ms < 0) {
			return failure(new RangeError(`"${String(ttl)}" is not a duration a claim can last.`));
		}

		let now = this.#now();
		for (let [seen, expires] of this.#expires) if (expires <= now) this.#expires.delete(seen);

		if (this.#expires.has(id)) return success(false);
		this.#expires.set(id, now + ms);
		return success(true);
	}
}

/** A fixed set of objects the app serves, found by their `id`. */
export class MemoryLocalObjects implements LocalObjects {
	#objects: Map<string, ActivityPub.Object>;

	/** @param objects The objects served; a later one with a repeated `id` wins. */
	constructor(objects: ActivityPub.Object[] = []) {
		this.#objects = new Map(objects.map((object) => [object.id, object]));
	}

	/** The object served under `id`, or `null` for any other IRI. */
	async find(id: string): Promise<Result<ActivityPub.Object | null, Error>> {
		return success(this.#objects.get(id) ?? null);
	}
}

/** A fixed set of hosted actors' keys, found by actor id. */
export class MemoryKeyProvider implements KeyProvider {
	#keys: Map<string, ActorKeys>;

	/** @param keys The keys of every hosted actor; a later entry for the same actor wins. */
	constructor(keys: ActorKeys[] = []) {
		this.#keys = new Map(keys.map((one) => [one.actor, one]));
	}

	/** The actor's keys, or `null` for an actor this provider does not host. */
	async keysOf(actor: string): Promise<Result<ActorKeys | null, Error>> {
		return success(this.#keys.get(actor) ?? null);
	}
}
