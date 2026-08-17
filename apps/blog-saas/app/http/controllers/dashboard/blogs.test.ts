/**
 * Unit tests for the two guards the blog dashboard's actions put in front of form
 * input: the region allow-list (`REGIONS`), which must reject anything before it is
 * cast to a DurableObject location hint, and `fieldText`, which must not let a file
 * part become a blog name or a custom domain.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, mock, test } from "bun:test";

import { createEnv } from "@pkg/cloudflare-mocks";

import type { Region } from "~/app/models/blog";

// The controller module reads `env` at import time; supply only the platform domain, so
// it loads under `bun test` without the Workers runtime.
await mock.module("cloudflare:workers", () => ({
	env: createEnv<Cloudflare.Env>({ PLATFORM_DOMAIN: "blog.test" }),
	DurableObject: class {},
}));

let { REGIONS, fieldText } = await import("./blogs");

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

describe("fieldText", () => {
	test("reads the submitted text", () => {
		let formData = new FormData();
		formData.set("name", "My Blog");

		expect(fieldText(formData, "name")).toBe("My Blog");
	});

	test("falls back when the field is absent", () => {
		expect(fieldText(new FormData(), "region", "wnam")).toBe("wnam");
		expect(fieldText(new FormData(), "name")).toBe("");
	});

	test("falls back for a field submitted as a file", () => {
		let formData = new FormData();
		formData.set("name", new File(["content"], "payload.txt"), "payload.txt");

		// Stringifying the entry would store the literal "[object File]" as the name.
		expect(fieldText(formData, "name")).toBe("");
	});
});
