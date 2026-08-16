/**
 * Unit tests for the R2-backed key storage: the round trip that has to preserve a
 * file's bytes and name, the missing-object read, and the paging contract
 * `JWK.signingKeys` walks — a cursor while more pages remain, and none on the last.
 * Driven against an in-memory bucket so the assertions are about stored bytes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "bun:test";

import type { R2BucketMock } from "@pkg/cloudflare-mocks";
import type { KeyStorage } from "@pkg/jwt";

import { createR2Bucket } from "@pkg/cloudflare-mocks";

import { createR2KeyStorage } from "~/app/services/r2-key-storage";

let bucket: R2BucketMock;
let storage: KeyStorage;

beforeEach(() => {
	bucket = createR2Bucket();
	storage = createR2KeyStorage(bucket);
});

describe("createR2KeyStorage", () => {
	test("reads back a file it wrote, with its name and type intact", async () => {
		let stored = new File(['{"id":"key-1"}'], "jwks.json", { type: "application/json" });

		await storage.set("jwks:key-1", stored);

		let file = await storage.get("jwks:key-1");

		expect(file).not.toBeNull();
		expect(await file?.text()).toBe('{"id":"key-1"}');
		expect(file?.name).toBe("jwks.json");
		// Compared against the source file's own type rather than the literal, because the
		// runtime normalizes a MIME type on construction and the round trip is what matters.
		expect(file?.type).toBe(stored.type);
	});

	test("answers null for a key nothing was written to", async () => {
		expect(await storage.get("jwks:missing")).toBeNull();
	});

	test("lists only the keys under the requested prefix", async () => {
		await storage.set("jwks:key-1", new File(["a"], "jwks.json"));
		await storage.set("other:thing", new File(["b"], "other.json"));

		let result = await storage.list({ prefix: "jwks:" });

		expect(result.files).toEqual([{ key: "jwks:key-1" }]);
	});

	test("carries a cursor while a page is truncated and drops it on the last", async () => {
		await storage.set("jwks:key-1", new File(["a"], "jwks.json"));
		await storage.set("jwks:key-2", new File(["b"], "jwks.json"));

		let first = await storage.list({ prefix: "jwks:", limit: 1 });

		expect(first.files).toEqual([{ key: "jwks:key-1" }]);
		expect(first.cursor).toBeString();

		let second = await storage.list({ prefix: "jwks:", limit: 1, cursor: first.cursor });

		expect(second.files).toEqual([{ key: "jwks:key-2" }]);
		// The listing is exhausted, and `JWK.signingKeys` pages until the cursor is gone.
		expect(second.cursor).toBeUndefined();
	});

	test("replaces whatever was already stored under a key", async () => {
		await storage.set("jwks:key-1", new File(["first"], "jwks.json"));
		await storage.set("jwks:key-1", new File(["second"], "jwks.json"));

		expect(await (await storage.get("jwks:key-1"))?.text()).toBe("second");
	});
});
