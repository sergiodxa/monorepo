/**
 * Data-schema for validating CMS glossary form submissions. `GlossarySchema`
 * requires a term and definition (defaulting to placeholders when missing) and
 * treats title and slug as optional. Exists to normalize and validate glossary
 * input before it reaches the repository layer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
