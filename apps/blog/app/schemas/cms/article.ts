/**
 * Data-schema for validating CMS article form submissions. `ArticleSchema`
 * defaults title, locale, and content when absent and treats slug, excerpt,
 * canonical_url, and published_at as optional. Exists to normalize and validate
 * article input before it reaches the repository layer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { defaulted, object, optional, string } from "remix/data-schema";

/**
 * Validates CMS article form payloads and applies defaults for optional fields.
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
