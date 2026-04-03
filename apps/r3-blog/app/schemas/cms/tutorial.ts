import { defaulted, object, optional, string } from "remix/data-schema";

export const TutorialSchema = object({
	title: defaulted(string(), "Untitled tutorial"),
	slug: optional(string()),
	excerpt: defaulted(string(), ""),
	tags: optional(string()),
	content: defaulted(string(), ""),
	published_at: optional(string()),
});
