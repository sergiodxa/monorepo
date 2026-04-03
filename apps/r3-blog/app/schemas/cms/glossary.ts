import { defaulted, object, optional, string } from "remix/data-schema";

/**
 * Validates glossary form payloads and fills defaults for term and definition fields.
 */
export const GlossarySchema = object({
	term: defaulted(string(), "Untitled term"),
	title: optional(string()),
	slug: optional(string()),
	definition: defaulted(string(), ""),
});
