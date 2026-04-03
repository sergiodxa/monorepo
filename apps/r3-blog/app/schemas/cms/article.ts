import { defaulted, object, optional, string } from "remix/data-schema";

export const ArticleSchema = object({
	title: defaulted(string(), "Untitled article"),
	slug: optional(string()),
	locale: defaulted(string(), "en"),
	excerpt: optional(string()),
	canonical_url: optional(string()),
	content: defaulted(string(), ""),
	published_at: optional(string()),
});
