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
} from "./types.js";
export type { CacheTags, TagVocabulary } from "./create-tags.js";
export type { RecordingCache, RecordingCacheOptions } from "./recording-cache.js";

export { cacheStatus } from "./cache-status.js";
export { cacheTag } from "./cache-tag.js";
export { CacheTagError } from "./cache-tag-error.js";
export { createTags } from "./create-tags.js";
export {
	CACHE_CONTROL_HEADER,
	CACHE_STATUS_HEADER,
	CACHE_TAG_HEADER,
	CACHEABLE_METHODS,
	CACHEABLE_STATUS_CODES,
	MAX_CACHE_TAG_HEADER_LENGTH,
	MAX_TAG_LENGTH,
	NON_CACHEABLE_POLICY,
} from "./platform.js";
export { purge } from "./purge.js";
export { PurgeError } from "./purge-error.js";
export { createRecordingCache } from "./recording-cache.js";
