/**
 * Route definitions for the blog Atom feeds: the combined site feed, plus the feed of each
 * kind's topic beside its page, one per RSS feed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { get, route } from "remix/routes";

/**
 * Typed Atom feed URL helpers, keyed by the same stream names as the RSS routes.
 */
export default route({
	feed: get("/atom.xml"),
	topic: get("/:topic.atom"),
});
