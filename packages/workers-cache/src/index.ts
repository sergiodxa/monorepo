/**
 * Public surface of the workers cache package: the tag vocabulary builder, the
 * `Cache-Tag` serializer, purging, the cache status reader, the cache interface
 * these all speak to, and a recording double for tests. Nothing here touches a
 * request, so jobs and scheduled handlers use the same functions handlers do.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type {
	CacheInterface,
	CachePolicy,
	CacheStatus,
	CacheTag,
	PurgeByPrefix,
	PurgeByTags,
	PurgeEverything,
	PurgeOptions,
	PurgeSelector,
} from "./types";
export type { CacheTags, TagVocabulary } from "./create-tags";
export type { RecordingCache, RecordingCacheOptions } from "./recording-cache";

export { cacheStatus } from "./cache-status";
export { cacheTag } from "./cache-tag";
export { CacheTagError } from "./cache-tag-error";
export { createTags } from "./create-tags";
export {
	CACHE_CONTROL_HEADER,
	CACHE_STATUS_HEADER,
	CACHE_TAG_HEADER,
	CACHEABLE_METHODS,
	CACHEABLE_STATUS_CODES,
	MAX_CACHE_TAG_HEADER_LENGTH,
	MAX_TAG_LENGTH,
	NON_CACHEABLE_POLICY,
} from "./platform";
export { purge } from "./purge";
export { PurgeError } from "./purge-error";
export { createRecordingCache } from "./recording-cache";
