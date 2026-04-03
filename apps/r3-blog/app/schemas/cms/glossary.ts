import { defaulted, object, optional, string } from "remix/data-schema";

export const GlossarySchema = object({
	term: defaulted(string(), "Untitled term"),
	title: optional(string()),
	slug: optional(string()),
	definition: defaulted(string(), ""),
});
