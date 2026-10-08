/**
 * Works out where one activity goes: the local actor's followers, paged from the store,
 * and every other addressed actor, resolved to its inbox. Targets are deduplicated by URL,
 * blocked and unavailable servers skipped, and deliveries enqueued in batches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Cache } from "@sdxc/cache";
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Resolver } from "../remote.js";
import type { FollowerStore } from "../store.js";

import { ActivityPubError } from "../errors.js";

import type { DeliveryInput } from "./delivery-post.js";
import type { BlockedCheck } from "./inbox-receive.js";
import type { ActivityPub } from "./types.js";

import { isUnavailable } from "./availability.js";
import { PUBLIC } from "./constants.js";
import { parseActivity } from "./parse.js";

/** Leaves room for the inbox, the actor and the job envelope inside a 128 KB queue message. */
export const MAX_ACTIVITY_BYTES = 120 * 1024;

/** The members ActivityPub §6 strips before delivery, on the activity and its embedded object. */
const BLIND_MEMBERS = ["bto", "bcc"] as const;

/** One fan-out: the local actor sending and the activity as JSON text. */
export interface FanOutInput {
	/** The local actor whose followers receive the activity and whose keys sign it. */
	actor: string;
	/** The activity as JSON text; `bto` and `bcc` are read for addressing and stripped. */
	activity: string;
}

/** Why a fan-out failed: `store` and `enqueue` are retryable, the rest repeat on a retry. */
export type FanOutErrorCode =
	| "invalid-input"
	| "invalid-document"
	| "too-large"
	| "store"
	| "enqueue";

/** What `fanOut` needs. */
export interface FanOutOptions {
	/** The sending actor's document: its `followers` IRI is what addressing names to reach them. */
	actor: Pick<ActivityPub.Actor, "id" | "followers">;
	followers: FollowerStore;
	/** Resolves every other addressed actor to its inbox. */
	resolver: Pick<Resolver, "actor">;
	/** Called once per host; a blocked host receives nothing and its actors are never fetched. */
	blocked: BlockedCheck;
	/** Where `deliver` keeps each origin's failure window. */
	cache: Cache;
	/**
	 * Writes one batch of delivery jobs, of any total size; a failure or rejection fails the
	 * fan-out as retryable.
	 */
	enqueue: (deliveries: DeliveryInput[]) => Promise<Result<void, Error> | void>;
	/** Followers' inboxes read per store page, and the most deliveries per batch. @default 100 */
	pageSize?: number;
	/** The clock origin failure windows are measured against. @default () => new Date() */
	now?: () => Date;
}

/** What a fan-out planned. */
export interface FanOutResult {
	/** Deliveries enqueued, one per distinct inbox URL. */
	inboxes: number;
	/** Targets left out: blocked hosts, unavailable origins, and actors that would not resolve. */
	skipped: number;
}

/**
 * Enqueues one delivery per distinct inbox the activity is addressed to. The sender's
 * followers collection in `to`, `cc`, `bto` or `bcc` (of the activity or its embedded
 * object) pages through `FollowerStore.inboxes`; every other IRI except `PUBLIC` resolves
 * to its actor's `sharedInbox ?? inbox`, and one that fails to resolve is skipped and
 * counted, so one unreachable mention never holds back delivery to every follower.
 *
 * A batch closes at `pageSize` deliveries. A retried fan-out may enqueue some deliveries
 * twice, which receivers absorb by activity id.
 *
 * @param input - The sending actor and the activity.
 * @param options - The stores, the moderation callback and the job writer.
 * @returns The counts, or `too-large` for an activity over 120 KB, `invalid-document`
 *   for one that does not parse, or a retryable `store` or `enqueue` failure.
 * @example let planned = await fanOut(ctx.input, { actor: ACTOR, followers, resolver, blocked, cache, enqueue });
 */
export async function fanOut(
	input: FanOutInput,
	options: FanOutOptions,
): Promise<Result<FanOutResult, ActivityPubError<FanOutErrorCode>>> {
	if (options.actor.id !== input.actor) {
		return failure(
			new ActivityPubError(
				"invalid-input",
				`The fan-out is for ${input.actor} but the actor document is ${options.actor.id}`,
			),
		);
	}

	let json = decode(input.activity);
	if (json === null) {
		return failure(new ActivityPubError("invalid-document", "The activity is not a JSON object"));
	}
	let activity = parseActivity(json);
	if (isFailure(activity)) return activity;

	let payload = withoutBlindMembers(json) ?? input.activity;
	let size = new TextEncoder().encode(payload).byteLength;
	if (size > MAX_ACTIVITY_BYTES) {
		return failure(
			new ActivityPubError(
				"too-large",
				`The activity is ${size} bytes, over the ${MAX_ACTIVITY_BYTES} a delivery can carry`,
			),
		);
	}

	let pageSize = options.pageSize ?? 100;
	let now = options.now ?? (() => new Date());

	let seen = new Set<string>();
	let hosts = new Map<string, boolean>();
	let origins = new Map<string, boolean>();
	let batch: DeliveryInput[] = [];
	let enqueued = 0;
	let skipped = 0;

	/** Whether `host` is blocked, asking the app once per host. */
	async function isBlocked(host: string): Promise<boolean> {
		let known = hosts.get(host);
		if (known !== undefined) return known;
		let answer = await options.blocked(host);
		hosts.set(host, answer);
		return answer;
	}

	/** Whether `origin` has been failing past the window, asking the cache once per origin. */
	async function isDown(origin: string): Promise<boolean> {
		let known = origins.get(origin);
		if (known !== undefined) return known;
		let answer = await isUnavailable(options.cache, origin, now().getTime());
		origins.set(origin, answer);
		return answer;
	}

	/** Writes the pending batch, mapping a failure or a rejection to a retryable `enqueue`. */
	async function flush(): Promise<Result<void, ActivityPubError<FanOutErrorCode>>> {
		if (batch.length === 0) return success(undefined);
		let deliveries = batch;
		batch = [];
		let written: Result<void, Error> | void;
		try {
			written = await options.enqueue(deliveries);
		} catch (cause) {
			return failure(enqueueFailed(cause));
		}
		if (written !== undefined && isFailure(written)) return failure(enqueueFailed(written.error));
		enqueued += deliveries.length;
		return success(undefined);
	}

	/** Adds one target unless it repeats, is not a URL, or sits on a blocked or failing server. */
	async function add(inbox: string): Promise<Result<void, ActivityPubError<FanOutErrorCode>>> {
		let url = URL.parse(inbox);
		if (url === null) {
			skipped++;
			return success(undefined);
		}
		if (seen.has(url.href)) return success(undefined);
		seen.add(url.href);

		if ((await isBlocked(url.hostname)) || (await isDown(url.origin))) {
			skipped++;
			return success(undefined);
		}

		batch.push({ actor: input.actor, activity: payload, inbox: url.href });
		if (batch.length >= pageSize) return flush();
		return success(undefined);
	}

	for (let addressee of addresseesOf(activity.data)) {
		if (addressee === PUBLIC || addressee === options.actor.id) continue;

		if (addressee === options.actor.followers) {
			let cursor: string | null = null;
			do {
				let page = await options.followers.inboxes(input.actor, { cursor, limit: pageSize });
				if (isFailure(page)) {
					return failure(
						new ActivityPubError("store", `Could not list followers: ${page.error.message}`, {
							retryable: true,
							cause: page.error,
						}),
					);
				}
				for (let inbox of page.data.items) {
					let added = await add(inbox);
					if (isFailure(added)) return added;
				}
				cursor = page.data.next;
			} while (cursor !== null);
			continue;
		}

		let url = URL.parse(addressee);
		if (url === null || (await isBlocked(url.hostname))) {
			skipped++;
			continue;
		}
		let actor = await options.resolver.actor(addressee);
		if (isFailure(actor)) {
			skipped++;
			continue;
		}
		let added = await add(actor.data.endpoints.sharedInbox ?? actor.data.inbox);
		if (isFailure(added)) return added;
	}

	let flushed = await flush();
	if (isFailure(flushed)) return flushed;
	return success({ inboxes: enqueued, skipped });
}

/** Every IRI the activity and its embedded object address, each once, in the order written. */
function addresseesOf(activity: ActivityPub.Activity): Set<string> {
	let addressees = new Set<string>();
	let sources: ActivityPub.Object[] = [activity];
	if (typeof activity.object === "object" && activity.object !== null) {
		sources.push(activity.object);
	}
	for (let source of sources) {
		for (let iri of [...source.to, ...source.cc, ...source.bto, ...source.bcc]) addressees.add(iri);
	}
	return addressees;
}

/** The JSON object `text` holds, or `null` for anything else. */
function decode(text: string): Record<string, unknown> | null {
	let json: unknown;
	try {
		json = JSON.parse(text);
	} catch {
		return null;
	}
	if (typeof json !== "object" || json === null || Array.isArray(json)) return null;
	return json as Record<string, unknown>;
}

/**
 * The activity re-serialized without `bto` and `bcc` on it or its embedded object, or
 * `null` when it carries neither, so the text the app wrote is delivered byte for byte.
 */
function withoutBlindMembers(json: Record<string, unknown>): string | null {
	let object = json.object;
	let embedded =
		typeof object === "object" && object !== null && !Array.isArray(object)
			? (object as Record<string, unknown>)
			: null;
	let hasBlind = (record: Record<string, unknown>) =>
		BLIND_MEMBERS.some((member) => member in record);
	if (!hasBlind(json) && (embedded === null || !hasBlind(embedded))) return null;

	let stripped: Record<string, unknown> = { ...json };
	for (let member of BLIND_MEMBERS) delete stripped[member];
	if (embedded !== null) {
		let strippedObject: Record<string, unknown> = { ...embedded };
		for (let member of BLIND_MEMBERS) delete strippedObject[member];
		stripped.object = strippedObject;
	}
	return JSON.stringify(stripped);
}

/** A retryable `enqueue` failure wrapping what the job writer raised. */
function enqueueFailed(cause: unknown): ActivityPubError<FanOutErrorCode> {
	let reason = cause instanceof Error ? cause.message : String(cause);
	return new ActivityPubError("enqueue", `Could not enqueue deliveries: ${reason}`, {
		retryable: true,
		cause,
	});
}
