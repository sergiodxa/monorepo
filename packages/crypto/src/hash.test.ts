/**
 * Tests for `sha256`, `sha384`, and `sha512`.
 *
 * Each digest is checked against the published FIPS 180-2 vector for "abc", so a
 * change in how payloads are encoded before hashing (which would silently break
 * every stored API key digest) is caught here, before it reaches production.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { Hex } from "./encoding";
import { sha256, sha384, sha512 } from "./hash";

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

describe("sha384", () => {
	test("matches the published digest for 'abc'", async () => {
		let digest = unwrap(await sha384("abc"));

		expect(Hex.encode(digest)).toBe(
			"cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7",
		);
	});

	test("matches the published digest for the empty input", async () => {
		let digest = unwrap(await sha384(""));

		expect(Hex.encode(digest)).toBe(
			"38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95b",
		);
	});

	test("hashes text and its UTF-8 bytes identically", async () => {
		let fromText = unwrap(await sha384("abc"));
		let fromBytes = unwrap(await sha384(new TextEncoder().encode("abc")));

		expect(Hex.encode(fromText)).toBe(Hex.encode(fromBytes));
	});

	test("returns 48 bytes", async () => {
		expect(unwrap(await sha384("payload")).length).toBe(48);
	});
});

describe("sha512", () => {
	test("matches the published digest for 'abc'", async () => {
		let digest = unwrap(await sha512("abc"));

		expect(Hex.encode(digest)).toBe(
			"ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
		);
	});

	test("matches the published digest for the empty input", async () => {
		let digest = unwrap(await sha512(""));

		expect(Hex.encode(digest)).toBe(
			"cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e",
		);
	});

	test("hashes text and its UTF-8 bytes identically", async () => {
		let fromText = unwrap(await sha512("abc"));
		let fromBytes = unwrap(await sha512(new TextEncoder().encode("abc")));

		expect(Hex.encode(fromText)).toBe(Hex.encode(fromBytes));
	});

	test("returns 64 bytes", async () => {
		expect(unwrap(await sha512("payload")).length).toBe(64);
	});

	test("distinguishes the digests of the SHA-2 family", async () => {
		let short = unwrap(await sha384("abc"));
		let long = unwrap(await sha512("abc"));

		expect(Hex.encode(long).startsWith(Hex.encode(short))).toBe(false);
	});
});
