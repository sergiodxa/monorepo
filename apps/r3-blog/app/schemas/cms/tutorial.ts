/**
 * Data-schema for validating CMS tutorial form submissions. `TutorialSchema`
 * defaults title, excerpt, and content when absent and treats slug, tags, and
 * published_at as optional. Exists to normalize and validate tutorial input
 * before it reaches the repository layer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { defaulted, object, optional, string } from "remix/data-schema";

/**
 * Validates CMS tutorial form payloads and applies safe defaults for authoring fields.
 */
export const TutorialSchema = object({
	title: defaulted(string(), "Untitled tutorial"),
	slug: optional(string()),
	excerpt: defaulted(string(), ""),
	tags: optional(string()),
	content: defaulted(string(), ""),
	published_at: optional(string()),
});
