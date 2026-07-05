/**
 * Unit tests for the blog dashboard's region allow-list (`REGIONS`), which gates the
 * `create` action: arbitrary form input must be rejected before it is cast to a
 * DurableObject location hint. Mirrors the runtime `REGIONS.includes(...)` check.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, mock, test } from "bun:test";

import type { Region } from "~/app/models/blog";

// The controller module reads `env` at import time; provide a minimal stub so it
// loads under `bun test` without the Workers runtime.
mock.module("cloudflare:workers", () => ({
	env: { PLATFORM_DOMAIN: "blog.test" },
	DurableObject: class {},
}));

let { REGIONS } = await import("./blogs");

/** The nine location-hint regions the platform supports. */
let EXPECTED_REGIONS: Region[] = ["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"];

describe("REGIONS allow-list", () => {
	test("contains exactly the nine supported location-hint regions", () => {
		expect([...REGIONS].sort()).toEqual([...EXPECTED_REGIONS].sort());
	});

	test("accepts every supported region", () => {
		for (let region of EXPECTED_REGIONS) {
			expect(REGIONS.includes(region)).toBe(true);
		}
	});

	test("rejects arbitrary form input not on the list", () => {
		for (let input of ["", "us-east-1", "WNAM", "earth", "eu"]) {
			expect(REGIONS.includes(input as Region)).toBe(false);
		}
	});
});
