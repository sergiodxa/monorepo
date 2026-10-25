/**
 * Tests for the version-5 UUIDs the iCalendar mapping keys objects by, checked against the
 * keys draft-ietf-calext-jscalendar-icalendar prints and RFC 9562's DNS-namespace example.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import { MAPPING_NAMESPACE, uuidv5 } from "./uuid5.js";

test.each([
	["mailto:organizer@example.com", "251d3e9f-d83f-534c-8c45-c2896c75670c"],
	["mailto:hcabot@example.com", "0b235cc4-f04d-5fc4-98a3-c066650b3fbf"],
	["https://example.com/myurl", "6669391a-2c73-5b89-9cfe-7a6c95a855e3"],
])("derives the mapping draft's key for %s", (name, key) => {
	expect(uuidv5(MAPPING_NAMESPACE, name)).toBe(key);
});

test("matches RFC 9562's example for www.example.com in the DNS namespace", () => {
	expect(uuidv5("6ba7b810-9dad-11d1-80b4-00c04fd430c8", "www.example.com")).toBe(
		"2ed6657d-e927-568b-95e1-2665a8aea6a2",
	);
});

test("hashes names longer than one SHA-1 block", () => {
	expect(uuidv5(MAPPING_NAMESPACE, "x".repeat(200))).toMatch(
		/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
	);
});
