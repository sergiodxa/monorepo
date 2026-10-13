/**
 * Tests the paging test helper: it reads one relation out of a `Link` header
 * and returns path plus query, including when another link's target holds a comma.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { parseLink } from "./paging";

describe("parseLink", () => {
	test("returns the path and query of the named relation", () => {
		expect(parseLink('<https://api.example.com/monitors?cursor=abc>; rel="next"', "next")).toBe(
			"/monitors?cursor=abc",
		);
	});

	test("keeps a comma inside another link's target from hiding next", () => {
		expect(
			parseLink(
				'</assets/a,b.css>; rel="preload"; as="style", <https://api.example.com/x?page=2>; rel="next"',
			),
		).toBe("/x?page=2");
	});

	test("answers null when the header is missing or the relation is absent", () => {
		expect(parseLink(null)).toBeNull();
		expect(parseLink('<https://api.example.com/x>; rel="prev"')).toBeNull();
	});
});
