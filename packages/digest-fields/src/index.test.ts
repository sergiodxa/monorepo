/**
 * Tests for the digest fields against the examples of RFC 9530 Appendix B and the
 * draft-cavage `Digest` header, covering parse and stringify round trips, every failure
 * code, and the rule that every supported entry must match.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Base64 } from "@sdxc/crypto";
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { DigestErrorCode } from "./index.js";

import { DigestError, digest, parse, stringify, verify } from "./index.js";

/** The JSON object followed by an LF that RFC 9530 Appendix B digests. */
const ITEM = '{"hello": "world"}\n';

/** RFC 9530 Figure 12: sha-256 of `ITEM`. */
const ITEM_SHA_256 = "RK/0qy18MlBSVnWgjwz6lZEWjP/lF5HF9bvEF8FabDg=";

/** RFC 9530 §2: sha-512 of `ITEM`. */
const ITEM_SHA_512 =
	"YMAam51Jz/jOATT6/zvHrLVgOYTGFy1d6GJiOHTohq4yP+pgk4vf2aCsyRZOtw8MjkM7iw7yZ/WkppmM44T3qg==";

/** RFC 9530 Figure 14: sha-256 of empty content. */
const EMPTY_SHA_256 = "47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=";

/** RFC 9530 Figure 16: sha-256 of the partial content `"world"}` and an LF. */
const PARTIAL_SHA_256 = "jjcgBDWNAtbYUXI37CVG3gRuGOAjaaDRGpIUFsdyepQ=";

/** The draft-cavage-12 Appendix C request body and its `Digest`. */
const CAVAGE_BODY = '{"hello": "world"}';
const CAVAGE_DIGEST = "SHA-256=X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=";

/**
 * Asserts a result failed with a `DigestError` of the given code.
 *
 * @param result - The result to inspect.
 * @param code - The expected code.
 */
function expectCode(result: { status: string; error?: unknown }, code: DigestErrorCode): void {
	expect(result.status).toBe("failure");
	expect(result.error).toBeInstanceOf(DigestError);
	expect((result.error as DigestError).code).toBe(code);
}

describe("digest", () => {
	test("matches the RFC 9530 sha-256 and sha-512 examples", async () => {
		expect(Base64.encode(unwrap(await digest(ITEM, "sha-256")))).toBe(ITEM_SHA_256);
		expect(Base64.encode(unwrap(await digest(ITEM, "sha-512")))).toBe(ITEM_SHA_512);
		expect(Base64.encode(unwrap(await digest("", "sha-256")))).toBe(EMPTY_SHA_256);
		expect(Base64.encode(unwrap(await digest('"world"}\n', "sha-256")))).toBe(PARTIAL_SHA_256);
	});

	test("refuses an algorithm outside sha-256 and sha-512", async () => {
		// @ts-expect-error -- exercising a name the type rules out
		expectCode(await digest(ITEM, "md5"), "unsupported-algorithm");
	});
});

describe("parse", () => {
	test("reads a multi-algorithm Content-Digest", () => {
		let parsed = unwrap(
			parse(`sha-256=:${ITEM_SHA_256}:, sha-512=:${ITEM_SHA_512}:`, "content-digest"),
		);
		expect(Object.keys(parsed)).toEqual(["sha-256", "sha-512"]);
		expect(Base64.encode(parsed["sha-256"] ?? new Uint8Array())).toBe(ITEM_SHA_256);
	});

	test("reads Want-Repr-Digest and Want-Content-Digest preferences", () => {
		expect(unwrap(parse("sha-512=3, sha-256=10, unixsum=0", "want-repr-digest"))).toEqual({
			"sha-512": 3,
			"sha-256": 10,
			unixsum: 0,
		});
		expect(unwrap(parse("sha-256=1", "want-content-digest"))).toEqual({ "sha-256": 1 });
	});

	test("reads the legacy Digest with any algorithm case", () => {
		let parsed = unwrap(parse(`${CAVAGE_DIGEST}, sha-512=${ITEM_SHA_512}`, "digest"));
		expect(Object.keys(parsed)).toEqual(["sha-256", "sha-512"]);
	});

	test("skips a legacy entry outside sha-256/sha-512 that is not base64", () => {
		expect(Object.keys(unwrap(parse(`${CAVAGE_DIGEST}, UNIXsum=30637`, "digest")))).toEqual([
			"sha-256",
		]);
	});

	test("fails on a Content-Digest member that is not a byte sequence", () => {
		expectCode(parse('sha-256="abc"', "content-digest"), "malformed");
	});

	test("fails on text that is not a Structured Field Dictionary", () => {
		expectCode(parse("SHA-256=:abc:", "repr-digest"), "malformed");
	});

	test("fails on a preference outside 0 to 10", () => {
		expectCode(parse("sha-256=11", "want-content-digest"), "malformed");
		expectCode(parse("sha-256=1.5", "want-content-digest"), "malformed");
	});

	test("fails on a legacy sha-256 value that is not base64", () => {
		expectCode(parse("SHA-256=not*base64", "digest"), "malformed");
		expectCode(parse("=abc", "digest"), "malformed");
	});
});

describe("stringify", () => {
	test("writes a Content-Digest that parses back", async () => {
		let bytes = unwrap(await digest(ITEM, "sha-256"));
		let text = unwrap(stringify({ "sha-256": bytes }, "content-digest"));

		expect(text).toBe(`sha-256=:${ITEM_SHA_256}:`);
		expect(unwrap(parse(text, "content-digest"))).toEqual({ "sha-256": bytes });
	});

	test("writes the legacy Digest with uppercase names", async () => {
		let bytes = unwrap(await digest(CAVAGE_BODY, "sha-256"));
		expect(unwrap(stringify({ "sha-256": bytes }, "digest"))).toBe(CAVAGE_DIGEST);
		expect(unwrap(stringify({ "SHA-256": bytes }, "digest"))).toBe(CAVAGE_DIGEST);
	});

	test("writes preferences", () => {
		expect(unwrap(stringify({ "sha-512": 3, "sha-256": 10 }, "want-repr-digest"))).toBe(
			"sha-512=3, sha-256=10",
		);
	});

	test("answers an empty string for an empty value", () => {
		expect(unwrap(stringify({}, "content-digest"))).toBe("");
		expect(unwrap(stringify({}, "digest"))).toBe("");
	});

	test("fails on a key the field cannot carry", () => {
		expectCode(stringify({ "SHA-256": new Uint8Array([1]) }, "content-digest"), "invalid");
		expectCode(stringify({ "sha 256": new Uint8Array([1]) }, "digest"), "invalid");
	});

	test("fails on a preference outside 0 to 10", () => {
		expectCode(stringify({ "sha-256": 11 }, "want-repr-digest"), "invalid");
	});
});

describe("verify", () => {
	test("accepts the RFC 9530 Content-Digest of a body", async () => {
		let headers = new Headers({
			"content-digest": `sha-256=:${ITEM_SHA_256}:, sha-512=:${ITEM_SHA_512}:`,
		});
		expect(isSuccess(await verify(headers, ITEM, { field: "content-digest" }))).toBe(true);
	});

	test("accepts Repr-Digest over empty content", async () => {
		let headers = new Headers({ "repr-digest": `sha-256=:${EMPTY_SHA_256}:` });
		expect(isSuccess(await verify(headers, new Uint8Array(), { field: "repr-digest" }))).toBe(true);
	});

	test("accepts the draft-cavage Digest", async () => {
		let headers = new Headers({ digest: CAVAGE_DIGEST });
		expect(isSuccess(await verify(headers, CAVAGE_BODY, { field: "digest" }))).toBe(true);
	});

	test("fails when the body changed", async () => {
		let headers = new Headers({ "content-digest": `sha-256=:${ITEM_SHA_256}:` });
		expectCode(await verify(headers, "tampered", { field: "content-digest" }), "mismatch");
	});

	test("fails when any supported entry mismatches", async () => {
		let headers = new Headers({
			"content-digest": `sha-256=:${ITEM_SHA_256}:, sha-512=:${Base64.encode(new Uint8Array(64))}:`,
		});
		expectCode(await verify(headers, ITEM, { field: "content-digest" }), "mismatch");
	});

	test("fails when a legacy algorithm repeats, whichever entry matches", async () => {
		let forged = `SHA-256=${Base64.encode(new Uint8Array(32))}`;
		let headers = new Headers({ digest: `${forged}, ${CAVAGE_DIGEST}` });
		expectCode(await verify(headers, CAVAGE_BODY, { field: "digest" }), "malformed");
	});

	test("fails when the field is absent", async () => {
		expectCode(await verify(new Headers(), ITEM, { field: "content-digest" }), "missing");
	});

	test("fails when the field is malformed", async () => {
		let headers = new Headers({ "content-digest": "sha-256=nope" });
		expectCode(await verify(headers, ITEM, { field: "content-digest" }), "malformed");
	});

	test("fails when no entry uses an algorithm it computes", async () => {
		let headers = new Headers({ "content-digest": "md5=:AAAA:" });
		let result = await verify(headers, ITEM, { field: "content-digest" });
		expectCode(result, "unsupported-algorithm");
		expect(isFailure(result)).toBe(true);
	});
});
