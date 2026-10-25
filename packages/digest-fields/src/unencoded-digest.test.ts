/**
 * Tests for `Unencoded-Digest` and `Want-Unencoded-Digest` against the examples of HTTP
 * Unencoded Digest (draft-ietf-httpbis-unencoded-digest-05), including the gzip-coded full
 * and partial responses whose integrity fields each cover different bytes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Base64, Hex } from "@sdxc/crypto";
import { isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { DigestErrorCode } from "./index.js";

import { DigestError, decodeContent, digest, parse, stringify, verify } from "./index.js";

/** The draft's representation data with no content coding applied. */
const UNENCODED = "An unexceptional string\n";

/** Draft §3: sha-256 of `UNENCODED`. */
const UNENCODED_SHA_256 = "5Bv3NIx05BPnh0jMph6v1RJ5Q7kl9LKMtQxmvc9+Z7Y=";

/** Draft §3: sha-512 of `UNENCODED`. */
const UNENCODED_SHA_512 =
	"WjyMuMD9EI/v0RoJchcevbo6lF498VyE9564OgXf+98iJptoSvb1Czo9uVJu2bVU/tOv90huiMG3+YaMX1kipw==";

/** Draft Figure 2: the gzip-coded representation the server sends. */
const GZIPPED = unwrap(
	Hex.decode(
		"1f8b0800791f086400ff73cc5328cd4bad484e2d28c9cccf4bcc51282e29cacc4be702007eaf074418000000",
	),
);

/** Draft Figure 2: `Repr-Digest`, sha-256 of `GZIPPED`. */
const GZIPPED_SHA_256 = "kwcdt3RBGcsLaj7QSz9AW8MuwJaLjOJqUU/jKixF2oU=";

/** Draft Figure 4: `Content-Digest` of the first ten bytes of `GZIPPED`. */
const PART_SHA_256 = "SotB7Pa5A7iHSBdh9mg1Ev/ktAzrxU4Z8ldcCIUyfI4=";

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

/**
 * Codes bytes with a platform compression stream, for stacking codings the draft lists.
 *
 * @param bytes - The bytes to code.
 * @param format - The stream format.
 */
async function compress(bytes: Uint8Array, format: CompressionFormat): Promise<Uint8Array> {
	let stream = new Blob([bytes.slice()]).stream().pipeThrough(new CompressionStream(format));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

describe("Unencoded-Digest", () => {
	test("matches the draft's sha-256 and sha-512 of the unencoded data", async () => {
		expect(Base64.encode(unwrap(await digest(UNENCODED, "sha-256")))).toBe(UNENCODED_SHA_256);
		expect(Base64.encode(unwrap(await digest(UNENCODED, "sha-512")))).toBe(UNENCODED_SHA_512);
	});

	test("parses the draft's multi-algorithm field and writes it back", () => {
		let text = `sha-256=:${UNENCODED_SHA_256}:, sha-512=:${UNENCODED_SHA_512}:`;
		let parsed = unwrap(parse(text, "unencoded-digest"));

		expect(Object.keys(parsed)).toEqual(["sha-256", "sha-512"]);
		expect(unwrap(stringify(parsed, "unencoded-digest"))).toBe(text);
	});

	test("ignores parameters on a member", () => {
		let parsed = unwrap(parse(`sha-256=:${UNENCODED_SHA_256}:;future=1`, "unencoded-digest"));
		expect(Base64.encode(parsed["sha-256"] ?? new Uint8Array())).toBe(UNENCODED_SHA_256);
	});

	test("fails on a member that is not a byte sequence", () => {
		expectCode(parse("sha-256=10", "unencoded-digest"), "malformed");
		expectCode(stringify({ "SHA-256": new Uint8Array([1]) }, "unencoded-digest"), "invalid");
	});

	test("equals Repr-Digest when no content coding applies", async () => {
		let digests = { "sha-256": unwrap(await digest(UNENCODED, "sha-256")) };
		expect(unwrap(stringify(digests, "unencoded-digest"))).toBe(
			unwrap(stringify(digests, "repr-digest")),
		);

		let headers = new Headers({ "unencoded-digest": `sha-256=:${UNENCODED_SHA_256}:` });
		expect(isSuccess(await verify(headers, UNENCODED, { field: "unencoded-digest" }))).toBe(true);
		expect(
			isSuccess(await verify(headers, UNENCODED, { field: "unencoded-digest", decode: true })),
		).toBe(true);
	});
});

describe("Want-Unencoded-Digest", () => {
	test("reads the draft's examples", () => {
		expect(unwrap(parse("sha-256=1", "want-unencoded-digest"))).toEqual({ "sha-256": 1 });
		expect(unwrap(parse("sha-512=3, sha-256=10, unixsum=0", "want-unencoded-digest"))).toEqual({
			"sha-512": 3,
			"sha-256": 10,
			unixsum: 0,
		});
	});

	test("writes preferences and refuses a weight outside 0 to 10", () => {
		expect(unwrap(stringify({ "sha-512": 3, "sha-256": 10 }, "want-unencoded-digest"))).toBe(
			"sha-512=3, sha-256=10",
		);
		expectCode(stringify({ "sha-256": 11 }, "want-unencoded-digest"), "invalid");
		expectCode(parse("sha-256=11", "want-unencoded-digest"), "malformed");
	});
});

describe("verifying a content-coded message", () => {
	/** Draft Figure 2: the full gzip-coded 200 response. */
	let full = new Headers({
		"content-encoding": "gzip",
		"repr-digest": `sha-256=:${GZIPPED_SHA_256}:`,
		"unencoded-digest": `sha-256=:${UNENCODED_SHA_256}:`,
	});

	test("checks Unencoded-Digest against the decoded gzip body", async () => {
		expect(
			isSuccess(await verify(full, GZIPPED, { field: "unencoded-digest", decode: true })),
		).toBe(true);
	});

	test("checks Repr-Digest against the coded bytes of the same response", async () => {
		expect(isSuccess(await verify(full, GZIPPED, { field: "repr-digest" }))).toBe(true);
		expect(isSuccess(await verify(full, GZIPPED, { field: "repr-digest", decode: true }))).toBe(
			true,
		);
	});

	test("checks a body the client already decoded without decode", async () => {
		expect(isSuccess(await verify(full, UNENCODED, { field: "unencoded-digest" }))).toBe(true);
		expectCode(await verify(full, GZIPPED, { field: "unencoded-digest" }), "mismatch");
	});

	test("checks each integrity field of the draft's 206 partial response", async () => {
		let part = GZIPPED.slice(0, 10);
		let partial = new Headers({
			"content-encoding": "gzip",
			"content-range": "bytes 0-9/44",
			"content-digest": `sha-256=:${PART_SHA_256}:`,
			"repr-digest": `sha-256=:${GZIPPED_SHA_256}:`,
			"unencoded-digest": `sha-256=:${UNENCODED_SHA_256}:`,
		});

		expect(isSuccess(await verify(partial, part, { field: "content-digest" }))).toBe(true);
		expect(isSuccess(await verify(partial, GZIPPED, { field: "repr-digest" }))).toBe(true);
		expect(
			isSuccess(await verify(partial, GZIPPED, { field: "unencoded-digest", decode: true })),
		).toBe(true);
	});

	test("decodes stacked codings last applied first", async () => {
		let coded = await compress(
			await compress(new TextEncoder().encode(UNENCODED), "gzip"),
			"deflate",
		);
		let headers = new Headers({ "unencoded-digest": `sha-256=:${UNENCODED_SHA_256}:` });
		headers.append("content-encoding", "x-gzip");
		headers.append("content-encoding", "identity, DEFLATE");

		expect(
			new TextDecoder().decode(unwrap(await decodeContent(coded, headers.get("content-encoding")))),
		).toBe(UNENCODED);
		expect(
			isSuccess(await verify(headers, coded, { field: "unencoded-digest", decode: true })),
		).toBe(true);
	});

	test("fails with coding on a coding it cannot decode or a corrupt body", async () => {
		let brotli = new Headers({
			"content-encoding": "br",
			"unencoded-digest": full.get("unencoded-digest") ?? "",
		});
		expectCode(
			await verify(brotli, GZIPPED, { field: "unencoded-digest", decode: true }),
			"coding",
		);
		expectCode(
			await verify(full, GZIPPED.slice(0, 10), { field: "unencoded-digest", decode: true }),
			"coding",
		);
		expectCode(await decodeContent(UNENCODED, "gzip"), "coding");
	});

	test("fails with mismatch when the decoded body changed", async () => {
		let tampered = await compress(new TextEncoder().encode("A tampered string\n"), "gzip");
		expectCode(
			await verify(full, tampered, { field: "unencoded-digest", decode: true }),
			"mismatch",
		);
	});
});
