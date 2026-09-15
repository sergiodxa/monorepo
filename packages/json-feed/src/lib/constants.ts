/**
 * The version URL a document declares and the media type it is served under,
 * shared by the parser, the builder and anything sniffing a document's format.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The version URL this package writes, which is JSON Feed 1.1. */
export const VERSION = "https://jsonfeed.org/version/1.1";

/**
 * The prefix every JSON Feed version URL carries, which is what separates a feed
 * from any other JSON a URL might serve.
 */
export const VERSION_PREFIX = "https://jsonfeed.org/version/";

/**
 * The media type JSON Feed documents are served under. A reader discovering a
 * feed prefers this over `application/json`, which carries no such promise.
 */
export const MEDIA_TYPE = "application/feed+json";
