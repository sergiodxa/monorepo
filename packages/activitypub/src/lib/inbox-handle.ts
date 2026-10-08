/**
 * The background half of an inbox: the work the protocol itself requires for each verified
 * activity (followers kept, Accept sent, ownership and relevance checked) before the app's
 * own handler sees it, so an app writes only what it does with a reply, a like or a boost.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";

import { currentLog } from "@sdxc/logger";
import { failure, isFailure, success } from "@sdxc/result";

import type { ActivityPubFetchError } from "../errors.js";
import type { Resolver } from "../remote.js";
import type { FollowerStore, KeyProvider, LocalObjects, SeenActivities } from "../store.js";

import { ActivityPubError } from "../errors.js";

import type { BlockedCheck, Received, Verification } from "./inbox-receive.js";
import type { ActivityPub } from "./types.js";

import { parseActivity } from "./parse.js";
import { stringify } from "./stringify.js";

/** Long enough to absorb a sender's quick redeliveries; handlers stay idempotent past it. */
const DEFAULT_SEEN_TTL: DurationInput = "1 day";

/** What the app answers a Follow with: approve it, refuse it, or decide later. */
export type FollowDecision = "accept" | "reject" | "pending";

/** A verified activity as an app's handler receives it, after the package's own checks. */
export interface Inbound<A extends ActivityPub.Activity = ActivityPub.Activity> {
	activity: A;
	/** The sender, fetched through the resolver; trusted, unlike any actor the activity embeds. */
	actor: ActivityPub.Actor;
	/** The origin of the actor, which every ownership check compared against. */
	origin: string;
	verification: Verification;
	/**
	 * What the activity acts on, already trusted: a Create's or Update's object, the local
	 * object a Like or Announce names, the activity an Undo reverts, the Follow an Accept
	 * answers, a Move's target actor. `null` when there is nothing to resolve.
	 */
	object: ActivityPub.Object | null;
	/** The local object or actor the activity concerns, which a reply or like attaches to. */
	target: string | null;
	receivedAt: Date;
}

/**
 * A verified `Delete`. A deleted account's own document is usually gone already, so
 * `actor` is `null` when it could not be fetched.
 */
export interface DeleteInbound extends Omit<Inbound, "actor"> {
	actor: ActivityPub.Actor | null;
	/** What was deleted: one object by its id, or the whole account. */
	deleted: { kind: "object" | "actor"; id: string };
}

/**
 * The app's side of each activity, each called once the package has done the protocol's
 * work. A failure is retried, so a handler must tolerate seeing an activity twice.
 */
export interface Handlers {
	/** Answers the Follow; `null` keeps the default, which `manuallyApprovesFollowers` sets. */
	follow(inbound: Inbound): Promise<Result<FollowDecision | null, Error>>;
	/** An Undo whose reverted activity was the sender's own; a Follow is already removed. */
	undo(inbound: Inbound): Promise<Result<void, Error>>;
	/** A post by the sender that replies to, quotes or mentions something local. */
	create(inbound: Inbound): Promise<Result<void, Error>>;
	/** An edit of such a post, or of the sender's own actor (then `object` is the actor). */
	update(inbound: Inbound): Promise<Result<void, Error>>;
	delete(inbound: DeleteInbound): Promise<Result<void, Error>>;
	/** A Like of a local object; Pleroma's `EmojiReact` arrives here too. */
	like(inbound: Inbound): Promise<Result<void, Error>>;
	/** A boost of a local object. */
	announce(inbound: Inbound): Promise<Result<void, Error>>;
	/** A remote actor approved a Follow a local actor sent. */
	accept(inbound: Inbound): Promise<Result<void, Error>>;
	reject(inbound: Inbound): Promise<Result<void, Error>>;
	/** The sender moved to `object`, which lists it in `alsoKnownAs` and that it names in `movedTo`. */
	move(inbound: Inbound): Promise<Result<void, Error>>;
}

/** What `handle` needs: the local actor, the app's stores, and how to send an answer. */
export interface HandleOptions {
	/** The local actor's document, which Follows name and Accepts are sent as. */
	actor: ActivityPub.Actor;
	/** Tells a local actor from a remote one, beyond `actor` itself. */
	keys: KeyProvider;
	followers: FollowerStore;
	seen: SeenActivities;
	objects: LocalObjects;
	resolver: Resolver;
	blocked: BlockedCheck;
	/** Queues a serialized activity for delivery to one inbox, usually as a delivery job. */
	send: (activity: string, inbox: string) => Promise<Result<void, Error>>;
	on?: Partial<Handlers>;
	/** @default "1 day" */
	seenTtl?: DurationInput;
	/**
	 * The job's attempt, starting at 1. Past the first the claim is skipped, so a retry of
	 * a failed attempt is never mistaken for a redelivery. @default 1
	 */
	attempts?: number;
}

/** Why an activity was acknowledged without reaching a handler, or how a Follow ended. */
export type HandleReason =
	| "blocked"
	| "actor-unavailable"
	| "not-addressed"
	| "not-owner"
	| "unrelated"
	| "unverifiable"
	| "unhandled"
	| "rejected"
	| "pending";

/** What `handle` did with an activity; every outcome is acknowledged, never retried. */
export interface HandleOutcome {
	/** `processed` ran the package's work and the handler, `duplicate` was claimed before. */
	status: "processed" | "duplicate" | "ignored";
	type: string;
	reason: HandleReason | null;
}

/**
 * Processes a verified activity. It claims the id in `seen` (a store failure is logged and
 * processing goes on, since every step is idempotent), re-reads the activity, does the work
 * the protocol requires for its type, then calls the app's handler for it.
 *
 * The sender is the document whose id is the activity's actor, and an object another
 * origin embeds is fetched from its own origin (FEP-c7d3). A failure is retryable when a
 * remote server, a store, a handler or `send` failed transiently; any other is acknowledged.
 *
 * @param input - What `receive` answered, as the job read it through `INBOX_INPUT`.
 * @param options - The local actor, the stores, the resolver, `send` and the handlers.
 * @returns What happened to the activity.
 * @example
 * let outcome = await handle(ctx.input, { actor, keys, followers, seen, objects, resolver, blocked, send, on });
 * if (isFailure(outcome) && outcome.error.retryable) return ctx.retry({ cause: outcome.error });
 */
export async function handle(
	input: Received,
	options: HandleOptions,
): Promise<Result<HandleOutcome, ActivityPubError>> {
	let parsed = parseActivity(input.activity);
	if (isFailure(parsed)) return parsed;
	let activity = parsed.data;

	if ((options.attempts ?? 1) <= 1) {
		let claimed = await options.seen.claim(activity.id, options.seenTtl ?? DEFAULT_SEEN_TTL);
		if (isFailure(claimed)) {
			currentLog()?.warn("activitypub.inbox.seen_unavailable", {
				id: activity.id,
				error: claimed.error.message,
			});
		} else if (!claimed.data) {
			return success(outcome("duplicate", activity, null));
		}
	}

	let objectId = idOf(activity.object);
	let deletesActor = activity.type === "Delete" && objectId === activity.actor;
	let run = new Run(input, activity, options);

	let actor = await options.resolver.actor(activity.actor);
	if (isFailure(actor) || actor.data.id !== activity.actor) {
		if (deletesActor) return run.deleteActor(null);
		if (isFailure(actor) && actor.error.retryable) return failure(actor.error);
		return success(outcome("ignored", activity, "actor-unavailable"));
	}

	let host = URL.parse(activity.actor)?.hostname ?? "";
	if (await options.blocked(host)) {
		if (activity.type === "Follow") return run.follow(actor.data, true);
		return success(outcome("ignored", activity, "blocked"));
	}

	switch (activity.type) {
		case "Follow":
			return run.follow(actor.data, false);
		case "Undo":
			return run.undo(actor.data);
		case "Create":
			return run.post(actor.data, "create");
		case "Update":
			if (objectId === activity.actor) return run.updateActor();
			return run.post(actor.data, "update");
		case "Delete":
			if (deletesActor) return run.deleteActor(actor.data);
			return run.deleteObject(actor.data);
		case "Like":
		case "EmojiReact":
			return run.reaction(actor.data, "like");
		case "Announce":
			return run.reaction(actor.data, "announce");
		case "Accept":
		case "Reject":
			return run.answer(actor.data, activity.type === "Accept" ? "accept" : "reject");
		case "Move":
			return run.move();
		default:
			currentLog()?.note("activitypub.inbox.unhandled", { id: activity.id, type: activity.type });
			return success(outcome("ignored", activity, "unhandled"));
	}
}

/** The outcome of processing one activity, or the failure that stopped it. */
type Handled = Result<HandleOutcome, ActivityPubError>;

/** One activity being processed, with the steps each type runs. */
class Run {
	#input: Received;
	#activity: ActivityPub.Activity;
	#options: HandleOptions;
	#local: ActivityPub.Actor;

	/**
	 * @param input - The job input.
	 * @param activity - The activity read from it.
	 * @param options - What `handle` was given.
	 */
	constructor(input: Received, activity: ActivityPub.Activity, options: HandleOptions) {
		this.#input = input;
		this.#activity = activity;
		this.#options = options;
		this.#local = options.actor;
	}

	/**
	 * A Follow of the local actor: the follower is stored, and an `Accept` embedding the
	 * Follow goes to the follower's own inbox, again on a repeated Follow, since that means
	 * the first never arrived. A blocked server, or the app's `reject`, gets a `Reject`.
	 *
	 * @param actor - The follower.
	 * @param blocked - Whether the follower's server is blocked.
	 */
	async follow(actor: ActivityPub.Actor, blocked: boolean): Promise<Handled> {
		let activity = this.#activity;
		if (idOf(activity.object) !== this.#local.id) return this.#ignored("not-addressed");

		let follow = { id: activity.id, type: "Follow", actor: actor.id, object: this.#local.id };
		if (blocked) return this.#refuse(actor, follow, "blocked");

		let existing = store(await this.#options.followers.get(this.#local.id, actor.id));
		if (isFailure(existing)) return existing;

		let decision: FollowDecision = this.#local.manuallyApprovesFollowers ? "pending" : "accept";
		let answered = await settle(
			this.#options.on?.follow?.(this.#inbound(actor, this.#local, this.#local.id)),
		);
		if (isFailure(answered)) return answered;
		decision = answered.data ?? decision;
		if (decision === "pending" && existing.data?.state === "accepted") decision = "accept";
		if (decision === "reject") return this.#refuse(actor, follow, "rejected");

		let put = store(
			await this.#options.followers.put({
				actor: this.#local.id,
				id: actor.id,
				inbox: actor.inbox,
				sharedInbox: actor.endpoints.sharedInbox,
				followId: activity.id,
				state: decision === "accept" ? "accepted" : "pending",
			}),
		);
		if (isFailure(put)) return put;
		if (decision === "pending") return this.#processed("pending");

		let sent = await this.#send(answerTo("Accept", this.#local.id, follow), actor.inbox);
		if (isFailure(sent)) return sent;
		return this.#processed(null);
	}

	/**
	 * An Undo. A Follow is removed when its id is the stored `followId` or the embedded
	 * Follow is the sender's own; anything else must be an activity by the sender, embedded
	 * from its origin or fetched from there.
	 *
	 * @param actor - The sender.
	 */
	async undo(actor: ActivityPub.Actor): Promise<Handled> {
		let activity = this.#activity;
		let undoneId = idOf(activity.object);
		if (undoneId === null) return this.#ignored("unverifiable");

		let undone = this.#trustedEmbed();
		let reverted = undone !== null && isActivity(undone) ? undone : null;

		if (reverted === null || reverted.type === "Follow") {
			let existing = store(await this.#options.followers.get(this.#local.id, actor.id));
			if (isFailure(existing)) return existing;
			let named =
				existing.data !== null &&
				(existing.data.followId === undoneId ||
					(reverted !== null &&
						reverted.actor === actor.id &&
						idOf(reverted.object) === this.#local.id));
			if (named) {
				let removed = store(await this.#options.followers.remove(this.#local.id, actor.id));
				if (isFailure(removed)) return removed;
				return this.#call(this.#options.on?.undo?.(this.#inbound(actor, reverted, this.#local.id)));
			}
			if (reverted !== null) return this.#ignored("unrelated");
		}

		if (reverted === null) {
			let fetched = await this.#options.resolver.object(undoneId);
			if (isFailure(fetched)) return this.#unreachable(fetched.error, "unverifiable");
			if (!isActivity(fetched.data)) return this.#ignored("unverifiable");
			reverted = fetched.data;
		}
		if (reverted.actor !== actor.id) return this.#ignored("not-owner");

		let target = idOf(reverted.object);
		return this.#call(this.#options.on?.undo?.(this.#inbound(actor, reverted, target)));
	}

	/**
	 * A Create or Update of a post. The post must be the sender's, attributed to it and on
	 * its origin, and must reply to, quote, or mention something local.
	 *
	 * @param actor - The sender.
	 * @param kind - Which handler it reaches.
	 */
	async post(actor: ActivityPub.Actor, kind: "create" | "update"): Promise<Handled> {
		let object = await this.#dereference();
		if (isFailure(object)) return object;
		if (object.data === null) return this.#ignored("unverifiable");

		let post = object.data;
		if (!post.attributedTo.includes(actor.id) || originOf(post.id) !== originOf(actor.id)) {
			return this.#ignored("not-owner");
		}

		let target = await this.#relevance(post);
		if (isFailure(target)) return target;
		if (target.data === null) return this.#ignored("unrelated");

		let inbound = this.#inbound(actor, post, target.data);
		return this.#call(this.#options.on?.[kind]?.(inbound));
	}

	/**
	 * An Update of the sender's own actor: its cached document is dropped and refetched,
	 * and a stored follower picks up a changed inbox or shared inbox.
	 */
	async updateActor(): Promise<Handled> {
		let id = this.#activity.actor;
		await this.#options.resolver.evict(id);
		let fresh = await this.#options.resolver.actor(id, { fresh: true });
		if (isFailure(fresh)) return this.#unreachable(fresh.error, "actor-unavailable");
		let actor = fresh.data;

		let existing = store(await this.#options.followers.get(this.#local.id, id));
		if (isFailure(existing)) return existing;
		if (existing.data !== null) {
			let put = store(
				await this.#options.followers.put({
					...existing.data,
					inbox: actor.inbox,
					sharedInbox: actor.endpoints.sharedInbox,
				}),
			);
			if (isFailure(put)) return put;
		}
		return this.#call(this.#options.on?.update?.(this.#inbound(actor, actor, null)));
	}

	/**
	 * A deleted account: it stops following the local actor and its cached document is
	 * dropped.
	 *
	 * @param actor - The account's document, when it could still be fetched.
	 */
	async deleteActor(actor: ActivityPub.Actor | null): Promise<Handled> {
		let id = this.#activity.actor;
		let removed = store(await this.#options.followers.remove(this.#local.id, id));
		if (isFailure(removed)) return removed;
		await this.#options.resolver.evict(id);
		return this.#call(this.#options.on?.delete?.(this.#deleteInbound(actor, "actor", id, null)));
	}

	/**
	 * A deleted object. Its own origin decides: a refetch that answers `404`, `410` or a
	 * Tombstone confirms the deletion of an object on the sender's origin, and one that
	 * still serves it must name the sender as its author.
	 *
	 * @param actor - The sender.
	 */
	async deleteObject(actor: ActivityPub.Actor): Promise<Handled> {
		let id = idOf(this.#activity.object);
		if (id === null) return this.#ignored("unverifiable");

		let fetched = await this.#options.resolver.object(id, { fresh: true });
		if (isFailure(fetched)) {
			let code = fetched.error.code;
			if (code !== "gone" && code !== "not-found") {
				return this.#unreachable(fetched.error, "unverifiable");
			}
			if (originOf(id) !== originOf(actor.id)) return this.#ignored("not-owner");
		} else if (!fetched.data.attributedTo.includes(actor.id)) {
			return this.#ignored("not-owner");
		}

		let target = await this.#localTarget(id);
		if (isFailure(target)) return target;
		let inbound = this.#deleteInbound(actor, "object", id, target.data);
		return this.#call(this.#options.on?.delete?.(inbound));
	}

	/**
	 * A Like, EmojiReact or Announce, which matters only when it names a local object.
	 *
	 * @param actor - The sender.
	 * @param kind - Which handler it reaches.
	 */
	async reaction(actor: ActivityPub.Actor, kind: "like" | "announce"): Promise<Handled> {
		let id = idOf(this.#activity.object);
		if (id === null) return this.#ignored("unrelated");
		let found = store(await this.#options.objects.find(id));
		if (isFailure(found)) return found;
		if (found.data === null) return this.#ignored("unrelated");
		return this.#call(this.#options.on?.[kind]?.(this.#inbound(actor, found.data, id)));
	}

	/**
	 * An Accept or Reject of a Follow, which must be one a local actor sent to the sender:
	 * an embedded Follow by a local actor on the local origin naming the sender, or a Follow
	 * IRI on the local origin.
	 *
	 * @param actor - The sender.
	 * @param kind - Which handler it reaches.
	 */
	async answer(actor: ActivityPub.Actor, kind: "accept" | "reject"): Promise<Handled> {
		let object = this.#activity.object;
		let localOrigin = originOf(this.#local.id);
		let follow: ActivityPub.Activity | null = null;

		if (typeof object === "string") {
			if (originOf(object) !== localOrigin) return this.#ignored("not-addressed");
		} else if (object !== null && isActivity(object) && object.type === "Follow") {
			let local = await this.#isLocalActor(object.actor);
			if (isFailure(local)) return local;
			let sent =
				local.data && originOf(object.id) === localOrigin && idOf(object.object) === actor.id;
			if (!sent) return this.#ignored("not-addressed");
			follow = object;
		} else {
			return this.#ignored("not-addressed");
		}

		let target = follow?.actor ?? this.#local.id;
		return this.#call(this.#options.on?.[kind]?.(this.#inbound(actor, follow, target)));
	}

	/**
	 * A Move of the sender's account. The target is fetched fresh and must list the sender
	 * in `alsoKnownAs`, and the sender, fetched fresh too, must name the target in `movedTo`,
	 * so neither side can claim the move alone.
	 */
	async move(): Promise<Handled> {
		let activity = this.#activity;
		let mover = activity.actor;
		if (idOf(activity.object) !== mover) return this.#ignored("not-owner");
		if (activity.target === null) return this.#ignored("unverifiable");

		let target = await this.#options.resolver.actor(activity.target, { fresh: true });
		if (isFailure(target)) return this.#unreachable(target.error, "unverifiable");
		if (!target.data.alsoKnownAs.includes(mover)) return this.#ignored("unverifiable");

		let moved = await this.#options.resolver.actor(mover, { fresh: true });
		if (isFailure(moved)) return this.#unreachable(moved.error, "unverifiable");
		if (moved.data.movedTo !== target.data.id) return this.#ignored("unverifiable");

		let inbound = this.#inbound(moved.data, target.data, null);
		return this.#call(this.#options.on?.move?.(inbound));
	}

	/**
	 * The activity's object when it is embedded and has the actor's origin, the only case
	 * an embedded object is trusted as sent.
	 */
	#trustedEmbed(): ActivityPub.Object | null {
		let object = this.#activity.object;
		if (object === null || typeof object === "string") return null;
		return originOf(object.id) === originOf(this.#activity.actor) ? object : null;
	}

	/**
	 * The activity's object, trusted: embedded from the actor's origin, else fetched from
	 * its own. `null` when the activity has no object or it cannot be fetched for good.
	 */
	async #dereference(): Promise<Result<ActivityPub.Object | null, ActivityPubError>> {
		let trusted = this.#trustedEmbed();
		if (trusted !== null) return success(trusted);
		let id = idOf(this.#activity.object);
		if (id === null) return success(null);
		let fetched = await this.#options.resolver.object(id);
		if (isFailure(fetched)) {
			return fetched.error.retryable ? failure(fetched.error) : success(null);
		}
		return success(fetched.data);
	}

	/**
	 * The local thing a post concerns: what it replies to, then what it quotes, when the app
	 * serves it, then a local actor it mentions. `null` when it concerns nothing local.
	 *
	 * @param post - The post.
	 */
	async #relevance(post: ActivityPub.Object): Promise<Result<string | null, ActivityPubError>> {
		for (let id of [post.inReplyTo, post.quote]) {
			if (id === null) continue;
			let found = await this.#localTarget(id);
			if (isFailure(found) || found.data !== null) return found;
		}
		for (let tag of post.tag) {
			if (tag.type !== "Mention") continue;
			let local = await this.#isLocalActor(tag.href);
			if (isFailure(local)) return local;
			if (local.data) return success(tag.href);
		}
		return success(null);
	}

	/**
	 * `id` when the app serves an object under it, else `null`.
	 *
	 * @param id - The IRI to look up.
	 */
	async #localTarget(id: string): Promise<Result<string | null, ActivityPubError>> {
		let found = store(await this.#options.objects.find(id));
		if (isFailure(found)) return found;
		return success(found.data === null ? null : id);
	}

	/**
	 * Whether `id` is the local actor or another actor the app hosts keys for.
	 *
	 * @param id - The actor IRI.
	 */
	async #isLocalActor(id: string): Promise<Result<boolean, ActivityPubError>> {
		if (id === this.#local.id) return success(true);
		let keys = store(await this.#options.keys.keysOf(id));
		if (isFailure(keys)) return keys;
		return success(keys.data !== null);
	}

	/**
	 * Refuses a Follow with a `Reject` embedding it, and forgets the follower.
	 *
	 * @param actor - The follower.
	 * @param follow - The Follow as the Reject embeds it.
	 * @param reason - Why, for the outcome.
	 */
	async #refuse(
		actor: ActivityPub.Actor,
		follow: ActivityPub.Draft<ActivityPub.Activity>,
		reason: "blocked" | "rejected",
	): Promise<Handled> {
		let removed = store(await this.#options.followers.remove(this.#local.id, actor.id));
		if (isFailure(removed)) return removed;
		let sent = await this.#send(answerTo("Reject", this.#local.id, follow), actor.inbox);
		if (isFailure(sent)) return sent;
		return this.#processed(reason === "blocked" ? "blocked" : "rejected");
	}

	/**
	 * Hands a serialized activity to the app's `send`.
	 *
	 * @param activity - The activity to deliver.
	 * @param inbox - Where to.
	 */
	async #send(
		activity: ActivityPub.Draft<ActivityPub.Activity>,
		inbox: string,
	): Promise<Result<void, ActivityPubError>> {
		let sent = await this.#options.send(stringify(activity), inbox);
		if (isFailure(sent)) {
			return failure(
				new ActivityPubError("send", `Could not queue ${activity.type} to ${inbox}`, {
					retryable: true,
					cause: sent.error,
				}),
			);
		}
		return success(undefined);
	}

	/**
	 * Calls a handler, when the app gave one, and answers `processed`.
	 *
	 * @param called - What the handler returned, `undefined` without one.
	 */
	async #call(called: Promise<Result<void, Error>> | undefined): Promise<Handled> {
		let settled = await settle(called);
		if (isFailure(settled)) return settled;
		return this.#processed(null);
	}

	/**
	 * A remote failure: retried when it can clear, else acknowledged as `reason`.
	 *
	 * @param error - The resolver's failure.
	 * @param reason - What the outcome says.
	 */
	#unreachable(error: ActivityPubFetchError, reason: HandleReason): Handled {
		return error.retryable ? failure(error) : this.#ignored(reason);
	}

	/** The Inbound a handler receives. */
	#inbound(
		actor: ActivityPub.Actor,
		object: ActivityPub.Object | null,
		target: string | null,
	): Inbound {
		return {
			activity: this.#activity,
			actor,
			origin: this.#input.origin,
			verification: this.#input.verification,
			object,
			target,
			receivedAt: new Date(this.#input.receivedAt),
		};
	}

	/** The Inbound a `delete` handler receives. */
	#deleteInbound(
		actor: ActivityPub.Actor | null,
		kind: "object" | "actor",
		id: string,
		target: string | null,
	): DeleteInbound {
		return {
			activity: this.#activity,
			actor,
			origin: this.#input.origin,
			verification: this.#input.verification,
			object: null,
			target,
			receivedAt: new Date(this.#input.receivedAt),
			deleted: { kind, id },
		};
	}

	/** A `processed` outcome. */
	#processed(reason: HandleReason | null): Handled {
		return success(outcome("processed", this.#activity, reason));
	}

	/** An `ignored` outcome. */
	#ignored(reason: HandleReason): Handled {
		return success(outcome("ignored", this.#activity, reason));
	}
}

/**
 * An `Accept` or `Reject` of a Follow, embedding it, since some servers match the answer
 * on the embedded Follow rather than its id. The id derives from the Follow's, so a
 * re-sent answer to the same Follow is the same activity.
 *
 * @param type - Which answer.
 * @param local - The local actor answering.
 * @param follow - The Follow answered.
 */
function answerTo(
	type: "Accept" | "Reject",
	local: string,
	follow: ActivityPub.Draft<ActivityPub.Activity>,
): ActivityPub.Draft<ActivityPub.Activity> {
	let path = type === "Accept" ? "accepts" : "rejects";
	return {
		id: `${local}#${path}/${encodeURIComponent(follow.id)}`,
		type,
		actor: local,
		to: typeof follow.actor === "string" ? [follow.actor] : [],
		object: follow,
	};
}

/**
 * Turns a handler's answer into the package's: a missing handler is a success, and a
 * failure is retryable, since the handler may succeed on the next attempt.
 *
 * @param called - The handler's promise, `undefined` without one.
 * @template T - What the handler answers.
 */
async function settle<T>(
	called: Promise<Result<T, Error>> | undefined,
): Promise<Result<T | null, ActivityPubError>> {
	if (called === undefined) return success(null);
	let result = await called;
	if (!isFailure(result)) return result;
	if (result.error instanceof ActivityPubError) return failure(result.error);
	return failure(
		new ActivityPubError("handler", result.error.message, { retryable: true, cause: result.error }),
	);
}

/**
 * A store's answer, its failure made retryable, since a store that failed once can answer
 * the next attempt.
 *
 * @param result - What the store answered.
 * @template T - What the store answers.
 */
function store<T>(result: Result<T, Error>): Result<T, ActivityPubError> {
	if (!isFailure(result)) return result;
	return failure(
		new ActivityPubError("store", result.error.message, { retryable: true, cause: result.error }),
	);
}

/** An outcome for `activity`. */
function outcome(
	status: HandleOutcome["status"],
	activity: ActivityPub.Activity,
	reason: HandleReason | null,
): HandleOutcome {
	return { status, type: activity.type, reason };
}

/** The IRI an activity's `object` names, embedded or not. */
function idOf(object: ActivityPub.Activity["object"]): string | null {
	if (object === null) return null;
	return typeof object === "string" ? object : object.id;
}

/** Whether an embedded object is an activity, which is what names an `actor`. */
function isActivity(object: ActivityPub.Object): object is ActivityPub.Activity {
	return "actor" in object && typeof object.actor === "string";
}

/** The origin of an IRI, or `null` for a string that is not a URL. */
function originOf(iri: string): string | null {
	return URL.parse(iri)?.origin ?? null;
}
