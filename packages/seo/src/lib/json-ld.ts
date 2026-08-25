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
 * Serializes one node, or several, for a `<script type="application/ld+json">` body,
 * escaping every `<` as its unicode form so embedded content can't emit a `</script`
 * or `<!--` sequence, while the JSON still parses back to the exact original text.
 *
 * @param schema - One node or an array of nodes to place in a single script.
 * @returns The script body as a JSON string, safe to inject unescaped.
 * @example serializeJsonLd(seo.schema.website()) // '{"@context":"https://schema.org",...}'
 */
export function serializeJsonLd(schema: SchemaOrg.Node | SchemaOrg.Node[]): string {
	return JSON.stringify(schema).replaceAll("<", "\\u003c");
}
