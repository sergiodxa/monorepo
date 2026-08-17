/**
 * Unit tests for {@link "./json-ld"}: content that carries a `</script` sequence, an
 * HTML comment opener, or a full injected tag must come out unable to close the script
 * element, while still parsing back to the exact text it went in as. This is the escape
 * hatch a hostile or merely careless description would otherwise walk through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { SchemaOrg } from "./schema";

import { serializeJsonLd } from "./json-ld";

/** A minimal valid node whose description carries whatever a test needs to smuggle. */
function nodeWithDescription(description: string): SchemaOrg.WebSite {
	return {
		"@context": "https://schema.org",
		"@type": "WebSite",
		name: "Example",
		url: "https://example.com",
		description,
	};
}

describe("serializeJsonLd", () => {
	test("escapes a `</script` sequence inside content", () => {
		let hostile = 'Ends the tag early: </script><script>alert("xss")</script>';
		let serialized = serializeJsonLd(nodeWithDescription(hostile));

		expect(serialized).not.toContain("</script");
		expect(serialized).not.toContain("<script");
		expect(serialized).toContain("\\u003c/script");
	});

	test("keeps the escaped content parsing back to the original text", () => {
		let hostile = 'Ends the tag early: </script><script>alert("xss")</script>';
		let parsed = JSON.parse(serializeJsonLd(nodeWithDescription(hostile))) as SchemaOrg.WebSite;

		expect(parsed.description).toBe(hostile);
	});

	test("escapes an HTML comment opener, the other way out of a script element", () => {
		let serialized = serializeJsonLd(nodeWithDescription("<!-- hidden -->"));

		expect(serialized).not.toContain("<!--");
		expect(serialized).toContain("\\u003c!--");
	});

	test("escapes every `<` in the payload, not just the first", () => {
		let serialized = serializeJsonLd(nodeWithDescription("< < <"));

		expect(serialized).not.toContain("<");
		expect(serialized.match(/\\u003c/g)).toHaveLength(3);
	});

	test("leaves `&` alone, so descriptions keep the text they were given", () => {
		let parsed = JSON.parse(
			serializeJsonLd(nodeWithDescription("Monitors & alerts")),
		) as SchemaOrg.WebSite;

		expect(parsed.description).toBe("Monitors & alerts");
	});

	test("serializes several nodes as one array", () => {
		let serialized = serializeJsonLd([nodeWithDescription("First"), nodeWithDescription("Second")]);
		let parsed = JSON.parse(serialized) as SchemaOrg.WebSite[];

		expect(serialized.startsWith("[")).toBe(true);
		expect(parsed).toHaveLength(2);
		expect(parsed[1]?.description).toBe("Second");
	});
});
