/**
 * The ActivityStreams 2.0 vocabulary as ActivityPub servers exchange it: types that read
 * every wire variation as one shape, `parse*` for untrusted JSON, `stringify` with the
 * `@context` Mastodon expects, and the errors the rest of the package answers with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { ActivityPubFetchErrorCode } from "./errors.js";
export type { ActivityPub } from "./lib/types.js";
export type { TombstoneInit } from "./lib/tombstone.js";
export type {
	Follower,
	FollowerStore,
	KeyProvider,
	LocalObjects,
	SeenActivities,
	StorePage,
} from "./store.js";

export { ActivityPubError, ActivityPubFetchError, ActivityPubParseError } from "./errors.js";
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
export { parseActivity, parseActor, parseCollection, parseObject } from "./lib/parse.js";
export { EXTENSION_CONTEXT, stringify } from "./lib/stringify.js";
export { tombstone } from "./lib/tombstone.js";
