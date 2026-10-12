/**
 * Route definitions for the blog RSS feeds: the combined site feed, plus the feed of each
 * kind's topic beside its page (`/articles.rss` beside `/articles`).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { get, route } from "remix/routes";

/**
 * Typed feed URL helpers so subscribers can follow everything or a single topic. `topic` is
 * any kind's topic slug the registry names; an author's topic has its feeds under `/topics/`.
 */
export default route({
	feed: get("/rss"),
	topic: get("/:topic.rss"),
});
