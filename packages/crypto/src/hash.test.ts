/**
 * Tests for `sha256`.
 *
 * The digest is checked against the published FIPS 180-2 vector for "abc", so a
 * change in how payloads are encoded before hashing (which would silently break
 * every stored API key digest) fails here instead of in production.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { unwrap } from "@pkg/result";

import { Hex } from "./encoding";
import { sha256 } from "./hash";

describe("sha256", () => {
	test("matches the published digest for 'abc'", async () => {
		let digest = unwrap(await sha256("abc"));

		expect(Hex.encode(digest)).toBe(
			"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
		);
	});

	test("matches the published digest for the empty input", async () => {
		let digest = unwrap(await sha256(""));

		expect(Hex.encode(digest)).toBe(
			"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
		);
	});

	test("hashes text and its UTF-8 bytes identically", async () => {
		let fromText = unwrap(await sha256("abc"));
		let fromBytes = unwrap(await sha256(new TextEncoder().encode("abc")));

		expect(Hex.encode(fromText)).toBe(Hex.encode(fromBytes));
	});

	test("returns 32 bytes", async () => {
		expect(unwrap(await sha256("payload")).length).toBe(32);
	});
});
