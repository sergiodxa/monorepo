/**
 * Validates an author's topic URL, so the extension a feed is asked for arrives as one of
 * the formats every topic is served in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { enum_, object, optional, string } from "remix/data-schema";

/**
 * `slug` names the topic; `ext`, when present, asks for its RSS, Atom or JSON Feed. Any other
 * extension fails the whole URL, which the page answers as a missing topic.
 */
export const TopicParamsSchema = object({
	slug: string(),
	ext: optional(enum_(["rss", "atom", "json"])),
});
