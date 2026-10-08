/**
 * The synchronous half of an inbox: every check a POSTed activity must pass before it is
 * acknowledged, in the order that refuses the cheapest failures first and never fetches
 * for a blocked server, answering a job-ready `Received` or the status to refuse with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Cache } from "@sdxc/cache";
import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";

import { readBytes } from "@sdxc/outbound";
import { failure, isFailure, success } from "@sdxc/result";

import type { Resolver } from "../remote.js";

import { ActivityPubFetchError } from "../errors.js";

import type { InboxErrorCode } from "./inbox-error.js";
import type { ActivityPub } from "./types.js";

import { recordSuccess } from "./availability.js";
import { isObject } from "./compact.js";
import { ACTIVITY_JSON, LD_JSON } from "./constants.js";
import { InboxError } from "./inbox-error.js";
import { readSignatureHeader, requireSignedDigest, verifySigned } from "./inbox-signature.js";
import { parseActivity } from "./parse.js";

/** Leaves room for the rest of `Received` inside a 128 KB queue message. */
export const DEFAULT_INBOX_MAX_BYTES = 100 * 1024;

/** Mastodon signs at delivery time, so an hour covers its retries' clock and queueing. */
export const DEFAULT_INBOX_MAX_AGE: DurationInput = "1 hour";

/** The ways an activity can be trusted as its actor's. */
export const VERIFICATIONS = ["signature", "proof", "refetched"] as const;

/**
 * How an activity was established as its actor's: the actor's own HTTP signature, an
 * FEP-8b32 proof by the actor on a forwarded activity (not yet produced by `receive`), or
 * a copy fetched from the actor's origin after someone else forwarded it.
 */
export type Verification = (typeof VERIFICATIONS)[number];

/** The media types ActivityPub §7 lets an inbox accept; parameters are ignored. */
const ACCEPTED_MEDIA_TYPES = new Set([ACTIVITY_JSON, LD_JSON]);

/**
 * Says whether requests from a host are refused. The same callback serves `receive`,
 * `handle` and fan-out, so a blocked server can neither deliver, follow nor receive.
 */
export interface BlockedCheck {
	(host: string): boolean | Promise<boolean>;
}

/** What `receive` needs. */
export interface ReceiveOptions {
	/** Resolves the signature's key; its cache is what keeps a known server's request fast. */
	resolver: Resolver;
	blocked: BlockedCheck;
	/** Bodies past this answer `413`. @default 102400 */
	maxBytes?: number;
	/** How old a signature may be, plus five minutes of clock skew. @default "1 hour" */
	maxAge?: DurationInput;
	/** The cache delivery tracks failing origins in; a verified activity clears its origin. */
	cache?: Cache;
	/** @default new Date() */
	now?: Date;
}

/**
 * A verified activity, ready to enqueue: plain JSON that survives a queue round trip, and
 * what `handle` reads back from the queued inbox message.
 */
export interface Received {
	/** The activity as received, or as refetched from its actor's origin, undecoded. */
	activity: Record<string, unknown>;
	/** The activity's actor, which verification established. */
	actor: string;
	/** The actor whose key signed the request: `actor`, or the server that forwarded it. */
	signer: string;
	keyId: string;
	/** The origin of `actor`. */
	origin: string;
	verification: Verification;
	/** ISO 8601. */
	receivedAt: string;
}

/**
 * Verifies a POST to an inbox. The steps run in order and stop at the first failure: the
 * media type, the size, the activity's shape, the blocked hosts of the key and the actor,
 * the signature, its digest and age, the signer's blocked host, then the actor's ownership.
 *
 * A forwarded activity, signed by someone other than its actor, is accepted when its id is
 * on the actor's origin and a fresh copy fetched from there names the same actor; that copy
 * is what `Received` carries. A `Delete` of an account whose key now answers `410` fails
 * `ignored`, which `toResponse` answers with `202` so the sender stops retrying.
 *
 * @param request - The inbox request, its body unread.
 * @param options - The resolver, the blocked check, the limits and the cache.
 * @returns The verified activity, or an `InboxError` whose `status` is the response's.
 * @example
 * let received = await receive(ctx.request, { resolver, blocked });
 * if (isFailure(received)) return received.error.toResponse();
 */
export async function receive(
	request: Request,
	options: ReceiveOptions,
): Promise<Result<Received, InboxError>> {
	let now = options.now ?? new Date();

	if (!ACCEPTED_MEDIA_TYPES.has(essence(request.headers.get("content-type")))) {
		return failure(
			new InboxError(
				"unsupported-media-type",
				`Content-Type ${request.headers.get("content-type") ?? "(none)"} is not ActivityStreams`,
			),
		);
	}

	let read = await readBytes(request, { maxBytes: options.maxBytes ?? DEFAULT_INBOX_MAX_BYTES });
	if (isFailure(read)) {
		let code: InboxErrorCode = read.error.code === "too-large" ? "too-large" : "invalid-activity";
		return failure(new InboxError(code, read.error.message, { cause: read.error }));
	}
	let body = read.data.data;

	let json = decodeJson(body);
	if (isFailure(json)) return json;
	let activity = parseActivity(json.data);
	if (isFailure(activity)) {
		return failure(
			new InboxError("invalid-activity", activity.error.message, { cause: activity.error }),
		);
	}

	let signature = readSignatureHeader(request.headers);
	let hosts = [hostOf(activity.data.actor)];
	if (!isFailure(signature) && signature.data !== null) hosts.push(hostOf(signature.data.keyId));
	for (let host of hosts) {
		if (host !== null && (await options.blocked(host))) {
			return failure(new InboxError("blocked", `${host} is blocked`));
		}
	}

	if (isFailure(signature)) return signature;
	if (signature.data === null) {
		return failure(new InboxError("unsigned", "The request carries no signature"));
	}
	let digest = requireSignedDigest(request.headers, signature.data);
	if (isFailure(digest)) return digest;

	let signed = await verifySigned(request, {
		resolver: options.resolver,
		body,
		maxAge: options.maxAge ?? DEFAULT_INBOX_MAX_AGE,
		now,
	});
	if (isFailure(signed)) {
		if (isDeletedAccount(activity.data, signed.error)) {
			return failure(
				new InboxError("ignored", `${activity.data.actor} was deleted with its key`, {
					cause: signed.error,
				}),
			);
		}
		return signed;
	}

	let { key, verified } = signed.data;
	let signer = key.owner;
	let signerHost = hostOf(signer);
	if (signerHost !== null && (await options.blocked(signerHost))) {
		return failure(new InboxError("blocked", `${signerHost} is blocked`));
	}
	let actor = activity.data.actor;
	let document = json.data;
	let verification: Verification = "signature";

	if (signer !== actor) {
		let refetched = await refetch(activity.data, options.resolver);
		if (isFailure(refetched)) return refetched;
		document = refetched.data;
		verification = "refetched";
	}

	if (options.cache !== undefined) {
		let origin = originOf(signer);
		if (origin !== null) await recordSuccess(options.cache, origin);
	}

	return success({
		activity: document,
		actor,
		signer,
		keyId: verified.keyId,
		origin: originOf(actor) ?? actor,
		verification,
		receivedAt: now.toISOString(),
	});
}

/** What `verifyFetch` needs. */
export interface VerifyFetchOptions {
	resolver: Resolver;
	blocked: BlockedCheck;
	/** @default "1 hour" */
	maxAge?: DurationInput;
	/**
	 * The ids of local actors, whose documents (and the keys inside them) answer unsigned,
	 * because a remote server fetches that key to verify its own signed fetch.
	 */
	actors?: string[];
	/** Other URLs that answer unsigned, such as WebFinger and NodeInfo. */
	exempt?: (url: URL) => boolean;
	/** @default new Date() */
	now?: Date;
}

/** Who signed a GET, or nobody when the URL is exempt. */
export interface VerifiedFetch {
	/** The actor whose key signed the request; `null` for an exempt URL. */
	signer: string | null;
	keyId: string | null;
}

/**
 * Verifies the signature on a GET, for an app that serves secure-mode (authorized) fetches:
 * the blocked host of the key, the signature's age, and the key, refetched once when it no
 * longer verifies. Local actor documents and `exempt` URLs pass unsigned.
 *
 * @param request - The GET.
 * @param options - The resolver, the blocked check, the exemptions and the window.
 * @returns The signer, or an `InboxError` whose `status` is the response's.
 * @example
 * let fetched = await verifyFetch(ctx.request, { resolver, blocked, actors: [ACTOR_ID] });
 * if (isFailure(fetched)) return fetched.error.toResponse();
 */
export async function verifyFetch(
	request: Request,
	options: VerifyFetchOptions,
): Promise<Result<VerifiedFetch, InboxError>> {
	let url = new URL(request.url);
	let page = `${url.origin}${url.pathname}`;
	let isActor = (options.actors ?? []).some((actor) => withoutFragment(actor) === page);
	if (isActor || options.exempt?.(url) === true) return success({ signer: null, keyId: null });

	let signature = readSignatureHeader(request.headers);
	if (!isFailure(signature) && signature.data !== null) {
		let host = hostOf(signature.data.keyId);
		if (host !== null && (await options.blocked(host))) {
			return failure(new InboxError("blocked", `${host} is blocked`));
		}
	}
	if (isFailure(signature)) return signature;
	if (signature.data === null) {
		return failure(new InboxError("unsigned", "The request carries no signature"));
	}

	let signed = await verifySigned(request, {
		resolver: options.resolver,
		maxAge: options.maxAge ?? DEFAULT_INBOX_MAX_AGE,
		...(options.now === undefined ? {} : { now: options.now }),
	});
	if (isFailure(signed)) return signed;
	return success({ signer: signed.data.key.owner, keyId: signed.data.verified.keyId });
}

/**
 * Fetches a forwarded activity from its actor's origin, which is the only server that can
 * vouch for it, and fails `actor-mismatch` unless that copy is the same activity by the
 * same actor.
 *
 * @param activity - The activity as the forwarder sent it.
 * @param resolver - Fetches the copy, bypassing the cache.
 */
async function refetch(
	activity: ActivityPub.Activity,
	resolver: Resolver,
): Promise<Result<Record<string, unknown>, InboxError>> {
	let origin = originOf(activity.actor);
	if (origin === null || originOf(activity.id) !== origin) {
		return failure(
			new InboxError(
				"actor-mismatch",
				`${activity.id} is signed by someone other than ${activity.actor} and is not on its origin`,
			),
		);
	}

	let fetched = await resolver.document(activity.id, { fresh: true });
	if (isFailure(fetched)) {
		return failure(
			new InboxError(
				"actor-mismatch",
				`Could not refetch ${activity.id}: ${fetched.error.message}`,
				{
					cause: fetched.error,
				},
			),
		);
	}
	let copy = parseActivity(fetched.data);
	if (isFailure(copy) || copy.data.id !== activity.id || copy.data.actor !== activity.actor) {
		return failure(
			new InboxError(
				"actor-mismatch",
				`${activity.id} as its origin serves it is another activity`,
			),
		);
	}
	return success(fetched.data);
}

/**
 * Whether a failed verification is a deleted account's `Delete` of itself: its key lookup
 * answered `gone`, so the activity can never verify.
 *
 * @param activity - The activity.
 * @param error - The verification failure.
 */
function isDeletedAccount(activity: ActivityPub.Activity, error: InboxError): boolean {
	if (activity.type !== "Delete" || error.code !== "key-unavailable") return false;
	if (!(error.cause instanceof ActivityPubFetchError) || error.cause.code !== "gone") return false;
	let object = activity.object;
	let objectId = typeof object === "string" ? object : object?.id;
	return objectId === activity.actor;
}

/**
 * Decodes the body as one JSON object.
 *
 * @param body - The bytes received.
 */
function decodeJson(body: Uint8Array): Result<Record<string, unknown>, InboxError> {
	let json: unknown;
	try {
		json = JSON.parse(new TextDecoder().decode(body));
	} catch (cause) {
		return failure(new InboxError("invalid-activity", "The body is not JSON", { cause }));
	}
	if (!isObject(json)) {
		return failure(new InboxError("invalid-activity", "The body is not a JSON object"));
	}
	return success(json);
}

/**
 * The media type of a `Content-Type`, lowercase and without parameters.
 *
 * @param header - The header value.
 */
function essence(header: string | null): string {
	return (header ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
}

/** The host of an IRI, or `null` for a string that is not a URL. */
function hostOf(iri: string): string | null {
	return URL.parse(iri)?.hostname ?? null;
}

/** The origin of an IRI, or `null` for a string that is not a URL. */
function originOf(iri: string): string | null {
	return URL.parse(iri)?.origin ?? null;
}

/** An IRI without its fragment, which is the document a request for it reaches. */
function withoutFragment(iri: string): string {
	let hash = iri.indexOf("#");
	return hash === -1 ? iri : iri.slice(0, hash);
}
