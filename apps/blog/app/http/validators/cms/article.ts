/**
 * Normalizes CMS article form submissions so the repository layer receives
 * validated input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { defaulted, object, optional, string } from "remix/data-schema";

/**
 * A parsed article always carries a title, locale, and content, so a partially
 * filled form still yields a persistable record.
 */
export const ArticleSchema = object({
	title: defaulted(string(), "Untitled article"),
	slug: optional(string()),
	locale: defaulted(string(), "en"),
	excerpt: optional(string()),
	canonical_url: optional(string()),
	content: defaulted(string(), ""),
	published_at: optional(string()),
});
