/**
 * Tests for `etag()`.
 *
 * The tag is pinned to the digest of a known payload, so a change in how bytes
 * are hashed or encoded fails here: a tag that stops tracking the content it
 * describes serves stale bodies to every client that already holds one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { etag } from "./etag.js";

/** Base64url of the SHA-256 digest of "hello world". */
const HELLO_WORLD_DIGEST = "uU0nuZNNPgilLlLX2n2r-sSE7-N6U4DukIj3rOLvzek";

describe(etag, () => {
	test("derives a strong quoted base64url tag from the bytes", async () => {
		expect(unwrap(await etag("hello world"))).toBe(`"${HELLO_WORLD_DIGEST}"`);
	});

	test("marks a weak tag with the W/ prefix", async () => {
		expect(unwrap(await etag("hello world", { weak: true }))).toBe(`W/"${HELLO_WORLD_DIGEST}"`);
	});

	test("is strong when weak is not asked for", async () => {
		expect(unwrap(await etag("hello world", { weak: false })).startsWith("W/")).toBe(false);
	});

	test("uses only characters that need no escaping in a header", async () => {
		expect(unwrap(await etag("hello world"))).toMatch(/^"[A-Za-z0-9_-]+"$/);
	});

	test("changes when the content changes", async () => {
		let first = unwrap(await etag("hello world"));
		let second = unwrap(await etag("hello world!"));

		expect(first).not.toBe(second);
	});

	test("is stable for the same content", async () => {
		expect(unwrap(await etag("payload"))).toBe(unwrap(await etag("payload")));
	});

	test("reads text and its UTF-8 bytes as the same content", async () => {
		let fromText = unwrap(await etag("hello world"));
		let fromBytes = unwrap(await etag(new TextEncoder().encode("hello world")));

		expect(fromText).toBe(fromBytes);
	});
});
