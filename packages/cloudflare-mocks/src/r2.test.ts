/**
 * Tests for the R2 mock: stored bytes come back byte for byte, etags are real MD5 digests,
 * ranges and conditionals behave as the platform's do, `list` groups by delimiter, and a
 * multipart upload assembles in part order.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { beforeEach, describe, expect, test } from "vitest";

import type { R2BucketMock } from "./r2.js";

import { createR2Bucket } from "./r2.js";

/** MD5 of `"hello"`, which R2 reports as the object's etag. */
const HELLO_ETAG = "5d41402abc4b2a76b9719d911017c592";

describe("createR2Bucket", () => {
	let bucket: R2BucketMock;

	beforeEach(() => {
		bucket = createR2Bucket();
	});

	test("stores and reads text back", async () => {
		await bucket.put("greeting.txt", "hello");

		let object = await bucket.get("greeting.txt");

		expect(object?.size).toBe(5);
		expect(await object?.text()).toBe("hello");
	});

	test("computes a real MD5 etag", async () => {
		let stored = await bucket.put("greeting.txt", "hello");

		expect(stored?.etag).toBe(HELLO_ETAG);
		expect(stored?.httpEtag).toBe(`"${HELLO_ETAG}"`);
		expect(stored?.checksums.toJSON().md5).toBe(HELLO_ETAG);
	});

	test("returns null for a missing key", async () => {
		expect(await bucket.get("missing.txt")).toBeNull();
		expect(await bucket.head("missing.txt")).toBeNull();
	});

	test("reads metadata without a body through head", async () => {
		await bucket.put("a.json", '{"a":1}', {
			httpMetadata: { contentType: "application/json" },
			customMetadata: { owner: "tenant-1" },
		});

		let object = await bucket.head("a.json");

		expect(object?.httpMetadata?.contentType).toBe("application/json");
		expect(object?.customMetadata).toEqual({ owner: "tenant-1" });
	});

	test("writes stored HTTP metadata onto response headers", async () => {
		await bucket.put("a.json", "{}", {
			httpMetadata: { contentType: "application/json", cacheControl: "max-age=60" },
		});

		let object = await bucket.head("a.json");
		let headers = new Headers();
		object?.writeHttpMetadata(headers);

		expect(headers.get("content-type")).toBe("application/json");
		expect(headers.get("cache-control")).toBe("max-age=60");
	});

	test("reads HTTP metadata supplied as headers", async () => {
		await bucket.put("a.json", "{}", {
			httpMetadata: new Headers({ "content-type": "application/json" }),
		});

		let object = await bucket.head("a.json");

		expect(object?.httpMetadata?.contentType).toBe("application/json");
	});

	test("reads a byte range by offset and length", async () => {
		await bucket.put("alphabet.txt", "abcdefghij");

		let object = await bucket.get("alphabet.txt", { range: { offset: 2, length: 3 } });

		expect(await object?.text()).toBe("cde");
		expect(object?.range).toEqual({ offset: 2, length: 3 });
	});

	test("reads a suffix range", async () => {
		await bucket.put("alphabet.txt", "abcdefghij");

		let object = await bucket.get("alphabet.txt", { range: { suffix: 3 } });

		expect(await object?.text()).toBe("hij");
	});

	test("reads a range from a Range header", async () => {
		await bucket.put("alphabet.txt", "abcdefghij");

		let object = await bucket.get("alphabet.txt", {
			range: new Headers({ range: "bytes=0-2" }),
		});

		expect(await object?.text()).toBe("abc");
	});

	test("returns the object without a body when a conditional read fails", async () => {
		await bucket.put("greeting.txt", "hello");

		let object = await bucket.get("greeting.txt", { onlyIf: { etagMatches: "different" } });

		expect(object).not.toBeNull();
		expect("body" in (object as object)).toBe(false);
	});

	test("serves the body when a conditional read passes", async () => {
		await bucket.put("greeting.txt", "hello");

		let object = await bucket.get("greeting.txt", { onlyIf: { etagMatches: HELLO_ETAG } });

		expect(await (object as R2ObjectBody).text()).toBe("hello");
	});

	test("skips a conditional write when the condition fails", async () => {
		await bucket.put("greeting.txt", "hello");

		let result = await bucket.put("greeting.txt", "replaced", {
			onlyIf: { etagMatches: "different" },
		});

		expect(result).toBeNull();
		let object = await bucket.get("greeting.txt");
		expect(await object?.text()).toBe("hello");
	});

	test("allows a create-if-absent conditional write", async () => {
		let created = await bucket.put("new.txt", "value", {
			onlyIf: { etagDoesNotMatch: "*" },
		});

		expect(created).not.toBeNull();
	});

	test("rejects a write whose supplied md5 does not match the bytes", async () => {
		await expect(bucket.put("greeting.txt", "hello", { md5: "0".repeat(32) })).rejects.toThrow(
			/did not match/,
		);
	});

	test("accepts a write whose supplied md5 matches", async () => {
		let stored = await bucket.put("greeting.txt", "hello", { md5: HELLO_ETAG });

		expect(stored?.etag).toBe(HELLO_ETAG);
	});

	test("reads a body only once", async () => {
		await bucket.put("greeting.txt", "hello");
		let object = await bucket.get("greeting.txt");

		expect(await object?.text()).toBe("hello");
		expect(object?.bodyUsed).toBe(true);
		await expect(object?.text()).rejects.toThrow(/already been used/);
	});

	test("reads a body as bytes, json, and a blob", async () => {
		await bucket.put("a.json", '{"a":1}');

		let asJson = await bucket.get("a.json");
		let parsed = await asJson?.json<{ a: number }>();
		expect(parsed).toEqual({ a: 1 });

		let asBytes = await bucket.get("a.json");
		expect(await asBytes?.bytes()).toEqual(new TextEncoder().encode('{"a":1}'));

		let asBlob = await bucket.get("a.json");
		expect(await (await asBlob?.blob())?.text()).toBe('{"a":1}');
	});

	test("reads a body as a stream", async () => {
		await bucket.put("greeting.txt", "hello");
		let object = await bucket.get("greeting.txt");

		expect(await new Response(object?.body as unknown as BodyInit).text()).toBe("hello");
	});

	test("stores bytes, blobs, streams, and null", async () => {
		await bucket.put("bytes", new TextEncoder().encode("bytes"));
		await bucket.put("blob", new Blob(["blob"]));
		await bucket.put("stream", new Response("stream").body as unknown as ReadableStream);
		await bucket.put("empty", null);

		expect(await (await bucket.get("bytes"))?.text()).toBe("bytes");
		expect(await (await bucket.get("blob"))?.text()).toBe("blob");
		expect(await (await bucket.get("stream"))?.text()).toBe("stream");
		expect((await bucket.head("empty"))?.size).toBe(0);
	});

	test("deletes one key and many keys", async () => {
		await bucket.put("a", "1");
		await bucket.put("b", "2");
		await bucket.put("c", "3");

		await bucket.delete("a");
		await bucket.delete(["b", "c"]);

		expect(bucket.keys).toEqual([]);
	});

	test("lists keys in order, filtered by prefix", async () => {
		await bucket.put("posts/b", "2");
		await bucket.put("posts/a", "1");
		await bucket.put("pages/a", "3");

		let listed = await bucket.list({ prefix: "posts/" });

		expect(listed.objects.map((object) => object.key)).toEqual(["posts/a", "posts/b"]);
		expect(listed.truncated).toBe(false);
	});

	test("omits metadata from a listing unless include asks for it", async () => {
		await bucket.put("a", "1", {
			httpMetadata: { contentType: "text/plain" },
			customMetadata: { owner: "x" },
		});

		let without = await bucket.list();
		expect(without.objects[0]?.httpMetadata).toBeUndefined();

		let with_ = await bucket.list({ include: ["httpMetadata", "customMetadata"] });
		expect(with_.objects[0]?.httpMetadata?.contentType).toBe("text/plain");
		expect(with_.objects[0]?.customMetadata).toEqual({ owner: "x" });
	});

	test("collapses keys under a delimiter into prefixes", async () => {
		await bucket.put("posts/a/1", "1");
		await bucket.put("posts/a/2", "2");
		await bucket.put("posts/b/1", "3");
		await bucket.put("posts/top", "4");

		let listed = await bucket.list({ prefix: "posts/", delimiter: "/" });

		expect(listed.delimitedPrefixes).toEqual(["posts/a/", "posts/b/"]);
		expect(listed.objects.map((object) => object.key)).toEqual(["posts/top"]);
	});

	test("paginates with a cursor", async () => {
		await bucket.put("a", "1");
		await bucket.put("b", "2");
		await bucket.put("c", "3");

		let first = await bucket.list({ limit: 2 });
		expect(first.objects.map((object) => object.key)).toEqual(["a", "b"]);
		expect(first.truncated).toBe(true);

		let cursor = first.truncated ? first.cursor : undefined;
		let second = await bucket.list({ limit: 2, cursor });

		expect(second.objects.map((object) => object.key)).toEqual(["c"]);
		expect(second.truncated).toBe(false);
	});

	test("resumes a listing after a given key", async () => {
		await bucket.put("a", "1");
		await bucket.put("b", "2");

		let listed = await bucket.list({ startAfter: "a" });

		expect(listed.objects.map((object) => object.key)).toEqual(["b"]);
	});

	test("assembles a multipart upload in part order", async () => {
		let upload = await bucket.createMultipartUpload("big.txt", {
			httpMetadata: { contentType: "text/plain" },
		});

		let first = await upload.uploadPart(1, "hello ");
		let second = await upload.uploadPart(2, "world");

		let completed = await upload.complete([first, second]);

		expect(completed.key).toBe("big.txt");

		let object = await bucket.get("big.txt");
		expect(await object?.text()).toBe("hello world");
		expect(object?.httpMetadata?.contentType).toBe("text/plain");
	});

	test("keeps a multipart upload invisible until it completes", async () => {
		let upload = await bucket.createMultipartUpload("big.txt");
		await upload.uploadPart(1, "hello");

		expect(await bucket.head("big.txt")).toBeNull();
	});

	test("rejects parts listed out of order", async () => {
		let upload = await bucket.createMultipartUpload("big.txt");
		let first = await upload.uploadPart(1, "a");
		let second = await upload.uploadPart(2, "b");

		await expect(upload.complete([second, first])).rejects.toThrow(/ascending/);
	});

	test("rejects completing with a part that was never uploaded", async () => {
		let upload = await bucket.createMultipartUpload("big.txt");

		await expect(upload.complete([{ partNumber: 1, etag: "x" }])).rejects.toThrow(/never uploaded/);
	});

	test("discards an aborted multipart upload", async () => {
		let upload = await bucket.createMultipartUpload("big.txt");
		await upload.uploadPart(1, "a");
		await upload.abort();

		await expect(upload.complete([{ partNumber: 1, etag: "x" }])).rejects.toThrow(/does not exist/);
	});

	test("resumes an upload by id", async () => {
		let upload = await bucket.createMultipartUpload("big.txt");
		let part = await upload.uploadPart(1, "a");

		let resumed = bucket.resumeMultipartUpload("big.txt", upload.uploadId);
		let completed = await resumed.complete([part]);

		expect(completed.key).toBe("big.txt");
	});

	test("gives every bucket its own isolated objects", async () => {
		let other = createR2Bucket();
		await bucket.put("a", "1");

		expect(other.keys).toEqual([]);
	});
	test("discards its objects and in-flight uploads on reset", async () => {
		let bucket = createR2Bucket();
		await bucket.put("a.txt", "hello");
		let upload = await bucket.createMultipartUpload("b.txt");

		bucket.reset();

		expect(bucket.keys).toHaveLength(0);
		expect(await bucket.get("a.txt")).toBeNull();
		await expect(
			bucket.resumeMultipartUpload("b.txt", upload.uploadId).complete([]),
		).rejects.toThrow();
	});
});
