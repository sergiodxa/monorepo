/**
 * Every value this package assumes about the platform's cache surface: the
 * header names it reads and writes, the tag character set and size limits, the
 * methods and statuses it will mark cacheable, and the policy a refusal falls
 * back to. Kept in one module so the assumptions can be reviewed together.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Response header carrying the tags an entry can later be purged by. */
export const CACHE_TAG_HEADER = "Cache-Tag";

/** Response header carrying the freshness policy a declaration asked for. */
export const CACHE_CONTROL_HEADER = "Cache-Control";

/** Response header the platform reports its cache decision in. */
export const CACHE_STATUS_HEADER = "cf-cache-status";

/** Maximum characters allowed in a single tag before the platform rejects it. */
export const MAX_TAG_LENGTH = 1024;

/** Maximum characters allowed in the serialized `Cache-Tag` header value. */
export const MAX_CACHE_TAG_HEADER_LENGTH = 16_384;

/** Separator between tags in the serialized header, kept space-free to save bytes. */
export const TAG_SEPARATOR = ",";

/**
 * Printable ASCII, the only range a tag may be built from. Non-ASCII bytes are
 * rejected here rather than being percent-encoded, so a tag never changes shape
 * between the response header and the later purge call.
 */
export const PRINTABLE_ASCII_PATTERN = /^[\x20-\x7E]+$/;

/**
 * Characters that cannot appear inside a tag: whitespace and the two characters
 * that would make a tag list ambiguous once serialized.
 */
export const FORBIDDEN_TAG_CHARACTERS: readonly string[] = [" ", ",", '"'];

/** Request methods whose responses this package is willing to mark cacheable. */
export const CACHEABLE_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD"]);

/**
 * Statuses whose responses may carry cache headers: the heuristically cacheable
 * set from RFC 9111 plus the redirects and `304` that are cacheable when the
 * response states its own freshness, which a declaration always does.
 */
export const CACHEABLE_STATUS_CODES: ReadonlySet<number> = new Set([
	200, 203, 204, 206, 300, 301, 302, 304, 307, 308, 404, 405, 410, 414, 501,
]);

/**
 * The policy a refused declaration is downgraded to. It stops shared caches and
 * the browser alike, because a refusal means the response was about to be
 * stored under rules that would leak one visitor's content to another.
 */
export const NON_CACHEABLE_POLICY = "private, no-store";
