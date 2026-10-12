/**
 * Route definitions for the blog JSON Feeds: the combined site feed, plus the feed of each
 * kind's topic beside its page, one per RSS feed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { get, route } from "remix/routes";

/**
 * Typed JSON Feed URL helpers, keyed by the same stream names as the RSS routes. The site's
 * own `/feed.json` is static, so it wins over the `topic` pattern it also matches.
 */
export default route({
	feed: get("/feed.json"),
	topic: get("/:topic.json"),
});
