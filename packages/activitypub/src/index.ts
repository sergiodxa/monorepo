/**
 * ActivityPub for one local actor: the `Federation` runtime that serves its documents and
 * inbox and runs every queued step, the `ActorKeys` it signs with, a `RemoteResolver` for
 * remote documents, and the ActivityStreams vocabulary read and written as plain functions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { CollectionInit, CollectionItem, PageInit } from "./collections.js";
export type { ActivityPubFetchErrorCode } from "./errors.js";
export type { DeliveryErrorCode } from "./lib/delivery-post.js";
export type { InboxErrorCode } from "./lib/inbox-error.js";
export type { FollowDecision, HandleReason } from "./lib/inbox-handle.js";
export type { BlockedCheck, Verification, VerifiedFetch } from "./lib/inbox-receive.js";
export type { Summary, SummaryAuthor } from "./lib/inbox-summarize.js";
export type { ActivityPub } from "./lib/types.js";
export type { TombstoneInit } from "./lib/tombstone.js";
export type {
	ResolvedKey,
	ResolveOptions,
	Resolver,
	ResolverOptions,
	ResolverSigner,
	ResolverTtl,
} from "./remote.js";
export type {
	Follower,
	FollowerStore,
	KeyProvider,
	LocalObjects,
	SeenActivities,
	StorePage,
} from "./store.js";

export {
	collection,
	collectionPage,
	orderedCollection,
	orderedCollectionPage,
} from "./collections.js";
export { actorLink } from "./discovery.js";
export {
	ActivityPubError,
	ActivityPubFetchError,
	ActivityPubParseError,
	FederationError,
} from "./errors.js";
export { Federation } from "./federation.js";
export { ActorKeys } from "./keys.js";
export {
	ACTIVITY_ACCEPT,
	ACTIVITY_CONTENT_TYPE,
	ACTIVITY_JSON,
	ACTIVITY_TYPES,
	ACTOR_TYPES,
	AS2_CONTEXT,
	DATA_INTEGRITY_CONTEXT,
	LD_JSON,
	LD_JSON_ACTIVITY,
	MULTIKEY_CONTEXT,
	PUBLIC,
	SECURITY_CONTEXT,
} from "./lib/constants.js";
export { MAX_ACTIVITY_BYTES } from "./lib/delivery-fan-out.js";
export { DELIVERY_BACKOFF, DeliveryError } from "./lib/delivery-post.js";
export { InboxError } from "./lib/inbox-error.js";
export { parseActivity, parseActor, parseCollection, parseObject } from "./lib/parse.js";
export { wantsActivity } from "./lib/response.js";
export { EXTENSION_CONTEXT, stringify } from "./lib/stringify.js";
export { tombstone } from "./lib/tombstone.js";
export { RemoteResolver } from "./remote.js";
