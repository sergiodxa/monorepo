/**
 * Fetching remote actors, keys and objects safely: every request through
 * `@sdxc/outbound` within a deadline and a size cap, signed when the app asks for
 * authorized fetch, each document checked against the URL it came from, and cached.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Cache } from "@sdxc/cache";
import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";

import { sign } from "@sdxc/http-signatures";
import { release } from "@sdxc/outbound";
import { failure, isFailure, isSuccess, success } from "@sdxc/result";

import type { ActorKeys } from "./keys.js";
import type { FetchTextOptions } from "./lib/fetch.js";
import type { ActivityPub } from "./lib/types.js";

import { ActivityPubFetchError } from "./errors.js";
import { importPublicKey } from "./keys.js";
import { ACTIVITY_ACCEPT } from "./lib/constants.js";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_TIMEOUT,
	decodeObject,
	readSuccess,
	request,
} from "./lib/fetch.js";
import { parseActivity, parseActor, parseObject } from "./lib/parse.js";

/** Mastodon refetches an actor about once a day, so a profile edit reaches it as fast. */
const DEFAULT_ACTOR_TTL: DurationInput = "1 day";

/** Short enough that an edited post is seen again within the hour. */
const DEFAULT_OBJECT_TTL: DurationInput = "1 hour";

/** The namespace of every cache entry, so the resolver shares a store with anything else. */
const CACHE_PREFIX = "activitypub:doc:";

/** Who signs the resolver's GETs: a local actor and its keys. */
export interface ResolverSigner {
	actor: string;
	keys: ActorKeys;
}

/** How long a fetched document is reused, by what it was fetched as. */
export interface ResolverTtl {
	/** @default "1 day" */
	actor?: DurationInput;
	/** @default "1 hour" */
	object?: DurationInput;
}

/** What `createResolver` needs. */
export interface ResolverOptions {
	/** Remote documents, kept as JSON under `activitypub:doc:<iri>`; a failing store is a miss. */
	cache: Cache;
	/** Signs every GET (authorized fetch), which secure-mode Mastodon and GoToSocial require. */
	signer?: ResolverSigner;
	/** Sent on every request; some instances refuse requests without one. */
	userAgent: string;
	ttl?: ResolverTtl;
	/** One deadline for the redirect chain and the body. @default "10 seconds" */
	timeout?: DurationInput;
	/** @default 1048576 */
	maxBytes?: number;
}

/** How one lookup treats the cache. */
export interface ResolveOptions {
	/** Skips the cached copy and refetches, storing what arrives. @default false */
	fresh?: boolean;
}

/** A verified key: the actor that owns it and publishes it, and the key itself. */
export interface ResolvedKey {
	/** The owning actor's id, which an inbox compares with `activity.actor`. */
	owner: string;
	/** A verify-only key for `@sdxc/http-signatures`'s `verify`. */
	publicKey: CryptoKey;
	actor: ActivityPub.Actor;
}

/**
 * Reads remote ActivityPub documents. Every method answers an `ActivityPubFetchError`
 * rather than throwing, and `gone` means the resource was deleted: its cache entry is
 * already evicted, so the caller forgets it too. Tests and the inbox may supply their own.
 */
export interface Resolver {
	/** An actor, fetched at its id. */
	actor(
		iri: string,
		options?: ResolveOptions,
	): Promise<Result<ActivityPub.Actor, ActivityPubFetchError>>;
	/**
	 * The key a signature's `keyId` names, resolved to the actor that publishes it. The
	 * key's `owner` must be that actor and the actor must list the key, so a key document
	 * cannot claim an actor that never vouched for it.
	 */
	key(keyId: string, options?: ResolveOptions): Promise<Result<ResolvedKey, ActivityPubFetchError>>;
	/** An object or an activity; one with an `actor` member reads as an activity. */
	object(
		iri: string,
		options?: ResolveOptions,
	): Promise<Result<ActivityPub.Object | ActivityPub.Activity, ActivityPubFetchError>>;
	/** The decoded document at `iri` after the same checks, for a shape no reader models. */
	document(
		iri: string,
		options?: ResolveOptions,
	): Promise<Result<Record<string, unknown>, ActivityPubFetchError>>;
	/** Forgets the cached copy of `iri`, as after an actor's `Update` or `Delete`. */
	evict(iri: string): Promise<void>;
}

/**
 * Creates the resolver an app keeps for the life of its Worker. A document is accepted
 * only when its `id` has the origin the redirect chain ended at, so only that origin can
 * speak for an id, and a `410` or a `Tombstone` answers `gone`.
 *
 * @param options - The cache, the optional signer, the `User-Agent`, and the bounds.
 * @example let resolver = createResolver({ cache, signer: { actor: ACTOR_ID, keys }, userAgent: USER_AGENT });
 */
export function createResolver(options: ResolverOptions): Resolver {
	let actorTtl = options.ttl?.actor ?? DEFAULT_ACTOR_TTL;
	let objectTtl = options.ttl?.object ?? DEFAULT_OBJECT_TTL;
	let timeout = options.timeout ?? DEFAULT_TIMEOUT;
	let maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

	/** Drops both spellings of the entry, so a fragment never keeps a deleted copy alive. */
	async function evict(iri: string): Promise<void> {
		await Promise.all([
			options.cache.delete(cacheKey(iri)).catch(() => undefined),
			options.cache.delete(cacheKey(withoutFragment(iri))).catch(() => undefined),
		]);
	}

	/**
	 * The headers of one GET, signed with draft-cavage over `(request-target) host date`
	 * when a signer is set, the scheme every server that requires signed GETs accepts.
	 */
	async function headersFor(url: string): Promise<Result<Headers, ActivityPubFetchError>> {
		let headers = new Headers({ accept: ACTIVITY_ACCEPT, "user-agent": options.userAgent });
		if (options.signer === undefined) return success(headers);

		let signed = await sign(new Request(url, { headers }), {
			scheme: "draft-cavage",
			key: { id: options.signer.keys.rsa.id, privateKey: options.signer.keys.rsa.privateKey },
		});
		if (isFailure(signed)) {
			return failure(
				new ActivityPubFetchError(
					"unauthorized",
					url,
					`Could not sign the request: ${signed.error.message}`,
					{
						cause: signed.error,
					},
				),
			);
		}
		return success(new Headers(signed.data.headers));
	}

	/**
	 * Fetches a document. A signed request redirected elsewhere carries a signature over
	 * the first URL, so when the end of the chain refuses it, it is signed for that URL
	 * and asked once more.
	 */
	async function fetchDocument(
		url: string,
	): Promise<Result<Record<string, unknown>, ActivityPubFetchError>> {
		let headers = await headersFor(url);
		if (isFailure(headers)) return headers;
		let fetchOptions: FetchTextOptions = { headers: headers.data, timeout, maxBytes };

		let answered = await request(url, fetchOptions);
		if (isFailure(answered)) return answered;

		let refused = answered.data.response.status === 401 || answered.data.response.status === 403;
		if (refused && options.signer !== undefined && answered.data.url.href !== url) {
			release(answered.data.response.body);
			let final = answered.data.url.href;
			let resigned = await headersFor(final);
			if (isFailure(resigned)) return resigned;
			answered = await request(final, { ...fetchOptions, headers: resigned.data });
			if (isFailure(answered)) return answered;
		}

		let body = await readSuccess(url, answered.data, maxBytes);
		if (isFailure(body)) return body;

		let json = decodeObject(url, body.data.text);
		if (isFailure(json)) return json;

		let id = json.data.id;
		if (typeof id !== "string" || !URL.canParse(id)) {
			return failure(new ActivityPubFetchError("invalid-document", url, `${url} has no id`));
		}
		if (new URL(id).origin !== body.data.url.origin) {
			return failure(
				new ActivityPubFetchError(
					"id-mismatch",
					url,
					`${body.data.url.href} answered a document whose id ${id} is on another origin`,
				),
			);
		}
		return success(json.data);
	}

	/**
	 * The document at `iri`, from the cache unless `fresh`, else fetched and stored. A
	 * Tombstone, cached or fetched, answers `gone` and evicts the entry.
	 */
	async function load(
		iri: string,
		ttl: DurationInput,
		resolveOptions: ResolveOptions | undefined,
	): Promise<Result<Record<string, unknown>, ActivityPubFetchError>> {
		let url = withoutFragment(iri);
		if (!URL.canParse(url)) {
			return failure(new ActivityPubFetchError("refused-url", iri, `${iri} is not a URL`));
		}

		let key = cacheKey(url);
		let json: Record<string, unknown> | null = null;
		if (resolveOptions?.fresh !== true) {
			let cached = await options.cache.read<Record<string, unknown>>(key).catch(() => null);
			if (cached !== null && isSuccess(cached) && isRecord(cached.data)) json = cached.data;
		}

		if (json === null) {
			let fetched = await fetchDocument(url);
			if (isFailure(fetched)) {
				if (fetched.error.code === "gone") await evict(url);
				return fetched;
			}
			json = fetched.data;
			if (json.type !== "Tombstone") {
				await options.cache.write(key, json, { ttl }).catch(() => undefined);
			}
		}

		if (json.type === "Tombstone") {
			await evict(url);
			return failure(new ActivityPubFetchError("gone", url, `${url} was deleted`));
		}
		return success(json);
	}

	/** Reads `json` as an actor, failing `invalid-document` with the parser's explanation. */
	function readActor(url: string, json: unknown): Result<ActivityPub.Actor, ActivityPubFetchError> {
		let actor = parseActor(json);
		if (isFailure(actor)) return failure(invalidDocument(url, actor.error));
		return actor;
	}

	let resolver: Resolver = {
		async actor(iri, resolveOptions) {
			let json = await load(iri, actorTtl, resolveOptions);
			if (isFailure(json)) return json;
			return readActor(iri, json.data);
		},

		async key(keyId, resolveOptions) {
			let json = await load(keyId, actorTtl, resolveOptions);
			if (isFailure(json)) return json;

			let actor: ActivityPub.Actor;
			let asActor = parseActor(json.data);
			if (isSuccess(asActor)) {
				actor = asActor.data;
			} else {
				let owner = claimedOwner(json.data, keyId);
				if (owner === null) {
					return failure(
						new ActivityPubFetchError(
							"invalid-document",
							keyId,
							`${keyId} is neither an actor nor a key with an owner`,
						),
					);
				}
				let fetched = await resolver.actor(owner, resolveOptions);
				if (isFailure(fetched)) return fetched;
				actor = fetched.data;
			}

			let publicKey = actor.publicKey;
			if (publicKey === null || publicKey.id !== keyId) {
				return failure(
					new ActivityPubFetchError("not-found", keyId, `${actor.id} does not publish ${keyId}`),
				);
			}
			if (publicKey.owner !== actor.id) {
				return failure(
					new ActivityPubFetchError(
						"id-mismatch",
						keyId,
						`${keyId} is owned by ${publicKey.owner}, not by ${actor.id}`,
					),
				);
			}

			let imported = await importPublicKey(publicKey.publicKeyPem);
			if (isFailure(imported)) {
				return failure(
					new ActivityPubFetchError("invalid-document", keyId, imported.error.message, {
						cause: imported.error,
					}),
				);
			}
			return success({ owner: actor.id, publicKey: imported.data, actor });
		},

		async object(iri, resolveOptions) {
			let json = await load(iri, objectTtl, resolveOptions);
			if (isFailure(json)) return json;
			let parsed = "actor" in json.data ? parseActivity(json.data) : parseObject(json.data);
			if (isFailure(parsed)) return failure(invalidDocument(iri, parsed.error));
			return parsed;
		},

		document(iri, resolveOptions) {
			return load(iri, objectTtl, resolveOptions);
		},

		evict,
	};
	return resolver;
}

/** The cache entry of a document. */
function cacheKey(iri: string): string {
	return `${CACHE_PREFIX}${iri}`;
}

/** The URL a request is made to; a fragment names a part of the document and is never sent. */
function withoutFragment(iri: string): string {
	let hash = iri.indexOf("#");
	return hash === -1 ? iri : iri.slice(0, hash);
}

/** Whether a cached value is a document, so an entry some other writer left reads as a miss. */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The actor a key document says owns `keyId`: a standalone key's `owner`, or the `owner`
 * of the `publicKey` entry with that id on a document that is not a full actor.
 */
function claimedOwner(json: Record<string, unknown>, keyId: string): string | null {
	if (typeof json.owner === "string") return json.owner;
	let entries = Array.isArray(json.publicKey) ? json.publicKey : [json.publicKey];
	for (let entry of entries) {
		if (!isRecord(entry) || entry.id !== keyId) continue;
		if (typeof entry.owner === "string") return entry.owner;
	}
	return null;
}

/** A document that fetched fine but is not the shape asked for. */
function invalidDocument(url: string, cause: Error): ActivityPubFetchError {
	return new ActivityPubFetchError("invalid-document", url, cause.message, { cause });
}
