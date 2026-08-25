/**
 * Normalizes CMS glossary form submissions so the repository layer receives
 * validated input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { defaulted, object, optional, string } from "remix/data-schema";

/**
 * A parsed entry always carries a term and a definition, so a partially filled
 * form still yields a persistable record.
 */
export const GlossarySchema = object({
	term: defaulted(string(), "Untitled term"),
	title: optional(string()),
	slug: optional(string()),
	definition: defaulted(string(), ""),
});
