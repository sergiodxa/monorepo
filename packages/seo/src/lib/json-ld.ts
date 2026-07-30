/**
 * Serialization of schema.org nodes into the body of an `application/ld+json` script.
 * It exists so the one escaping rule that keeps page content from closing the script
 * element early is applied in a single place instead of at every call site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SchemaOrg } from "./schema";

/**
 * Serializes one node, or several, for a `<script type="application/ld+json">` body.
 *
 * Every `<` becomes its `<` unicode escape, so no string value inside the data can
 * emit a `</script` or `<!--` sequence and break out of the script element. The JSON
 * stays valid and parses back to the original text, since a JSON parser reads a literal
 * `<` and its unicode escape as the same character. Escaping that one character is
 * enough, so `&` is left alone and descriptions keep the text they were given.
 *
 * @param schema - One node or an array of nodes to place in a single script.
 * @returns The script body as a JSON string, safe to inject unescaped.
 * @example serializeJsonLd(seo.schema.website()) // '{"@context":"https://schema.org",...}'
 */
export function serializeJsonLd(schema: SchemaOrg.Node | SchemaOrg.Node[]): string {
	return JSON.stringify(schema).replaceAll("<", "\\u003c");
}
