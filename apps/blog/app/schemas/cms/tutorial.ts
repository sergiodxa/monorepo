/**
 * Normalizes CMS tutorial form submissions so the repository layer receives
 * validated input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { defaulted, object, optional, string } from "remix/data-schema";

/**
 * A parsed tutorial always carries a title, excerpt, and content, so a draft
 * can be saved from a partially filled form.
 */
export const TutorialSchema = object({
	title: defaulted(string(), "Untitled tutorial"),
	slug: optional(string()),
	excerpt: defaulted(string(), ""),
	tags: optional(string()),
	content: defaulted(string(), ""),
	published_at: optional(string()),
});
