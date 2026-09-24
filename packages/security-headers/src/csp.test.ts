/**
 * Tests for the Content Security Policy model: keyword quoting, the nonce placeholder, hashes,
 * the parser's handling of several policies and repeated directives, and `merge` with `null`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { CSPParseError, generateNonce, merge, parse, stringify } from "./csp.js";

describe("stringify", () => {
	test("writes the directives in the order the object lists them, keywords quoted", () => {
		let value = stringify({
			defaultSrc: ["none"],
			scriptSrc: ["self"],
			styleSrc: ["self", "unsafe-inline"],
			imgSrc: ["self", "data:", "https://images.example.com"],
			frameAncestors: ["none"],
		});

		expect(value).toBe(
			"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://images.example.com; frame-ancestors 'none'",
		);
	});

	test("quotes every CSP Level 3 keyword", () => {
		let value = stringify({
			scriptSrc: [
				"strict-dynamic",
				"unsafe-hashes",
				"report-sample",
				"wasm-unsafe-eval",
				"unsafe-eval",
				"inline-speculation-rules",
			],
		});

		expect(value).toBe(
			"script-src 'strict-dynamic' 'unsafe-hashes' 'report-sample' 'wasm-unsafe-eval' 'unsafe-eval' 'inline-speculation-rules'",
		);
	});

	test("quotes hashes and literal nonces", () => {
		let value = stringify({ scriptSrc: ["sha256-abc+/=", "sha384-def", "nonce-xyz"] });

		expect(value).toBe("script-src 'sha256-abc+/=' 'sha384-def' 'nonce-xyz'");
	});

	test("substitutes the nonce option for every nonce placeholder", () => {
		let value = stringify(
			{ scriptSrc: ["self", "nonce"], scriptSrcElem: ["nonce"] },
			{ nonce: "cmFuZG9t" },
		);

		expect(value).toBe("script-src 'self' 'nonce-cmFuZG9t'; script-src-elem 'nonce-cmFuZG9t'");
	});

	test("drops the placeholder when no nonce is given", () => {
		expect(stringify({ scriptSrc: ["self", "nonce"] })).toBe("script-src 'self'");
	});

	test("writes 'none' for a list whose only source was the dropped placeholder", () => {
		expect(stringify({ scriptSrc: ["nonce"] })).toBe("script-src 'none'");
	});

	test("writes 'none' for an empty source list", () => {
		expect(stringify({ objectSrc: [] })).toBe("object-src 'none'");
	});

	test("drops a nonce option outside the base64 alphabet", () => {
		expect(stringify({ scriptSrc: ["nonce"] }, { nonce: "a'; script-src *" })).toBe(
			"script-src 'none'",
		);
	});

	test("drops a source that would inject a directive or a policy", () => {
		let value = stringify({
			scriptSrc: ["self", "https://a.example; script-src *", "https://b.example, *"],
		});

		expect(value).toBe("script-src 'self'");
	});

	test("accepts a keyword written already quoted", () => {
		expect(stringify({ scriptSrc: ["'self'"] })).toBe("script-src 'self'");
	});

	test("writes the non-source directives", () => {
		let value = stringify({
			sandbox: ["allow-forms", "allow-scripts"],
			reportTo: "csp",
			reportUri: ["/reports/csp", "https://reports.example.com/csp"],
			upgradeInsecureRequests: true,
			requireTrustedTypesFor: ["script"],
			trustedTypes: ["default", "dompurify", "allow-duplicates"],
		});

		expect(value).toBe(
			"sandbox allow-forms allow-scripts; report-to csp; report-uri /reports/csp https://reports.example.com/csp; upgrade-insecure-requests; require-trusted-types-for 'script'; trusted-types default dompurify 'allow-duplicates'",
		);
	});

	test("writes a bare sandbox for true", () => {
		expect(stringify({ sandbox: true })).toBe("sandbox");
	});

	test("skips directives set to undefined", () => {
		expect(stringify({ scriptSrc: undefined, imgSrc: ["self"] })).toBe("img-src 'self'");
	});
});

describe("parse", () => {
	test("reads one policy into the typed model", () => {
		let result = parse(
			"default-src 'none'; script-src 'self' 'nonce-abc' 'sha256-xyz' https://cdn.example.com; frame-ancestors 'none'",
		);

		expect(result).toEqual({
			status: "success",
			data: [
				{
					directives: {
						defaultSrc: ["none"],
						scriptSrc: ["self", "nonce-abc", "sha256-xyz", "https://cdn.example.com"],
						frameAncestors: ["none"],
					},
					unknown: {},
				},
			],
		});
	});

	test("returns one entry per comma-joined policy", () => {
		let result = parse("script-src 'self', img-src https:");
		if (isFailure(result)) throw result.error;

		expect(result.data.map((policy) => policy.directives)).toEqual([
			{ scriptSrc: ["self"] },
			{ imgSrc: ["https:"] },
		]);
	});

	test("lowercases directive names and keywords", () => {
		let result = parse("Script-SRC 'SELF' 'Unsafe-Inline'");
		if (isFailure(result)) throw result.error;

		expect(result.data[0]?.directives).toEqual({ scriptSrc: ["self", "unsafe-inline"] });
	});

	test("keeps the first of a repeated directive and places the repeat in unknown", () => {
		let result = parse("script-src 'self'; script-src *");
		if (isFailure(result)) throw result.error;

		expect(result.data[0]).toEqual({
			directives: { scriptSrc: ["self"] },
			unknown: { "script-src": ["*"] },
		});
	});

	test("keeps an unmodelled directive verbatim", () => {
		let result = parse("prefetch-src 'self'; block-all-mixed-content");
		if (isFailure(result)) throw result.error;

		expect(result.data[0]?.unknown).toEqual({
			"prefetch-src": ["'self'"],
			"block-all-mixed-content": [],
		});
	});

	test("reads the non-source directives", () => {
		let result = parse(
			"sandbox; report-to csp; report-uri /a /b; upgrade-insecure-requests; require-trusted-types-for 'script'; trusted-types default 'allow-duplicates'",
		);
		if (isFailure(result)) throw result.error;

		expect(result.data[0]?.directives).toEqual({
			sandbox: true,
			reportTo: "csp",
			reportUri: ["/a", "/b"],
			upgradeInsecureRequests: true,
			requireTrustedTypesFor: ["script"],
			trustedTypes: ["default", "allow-duplicates"],
		});
	});

	test("skips empty directives and empty policies", () => {
		let result = parse(" ; script-src 'self';; , ");
		if (isFailure(result)) throw result.error;

		expect(result.data).toEqual([{ directives: { scriptSrc: ["self"] }, unknown: {} }]);
	});

	test("round-trips what stringify writes", () => {
		let directives = {
			defaultSrc: ["self"],
			scriptSrc: ["self", "nonce-abc", "https://challenges.cloudflare.com"],
			sandbox: ["allow-forms"],
			reportTo: "csp",
		};
		let result = parse(stringify(directives));
		if (isFailure(result)) throw result.error;

		expect(result.data[0]?.directives).toEqual(directives);
	});

	test("fails at the position of a character outside the directive grammar", () => {
		let result = parse("script-src 'self' é");

		expect(isFailure(result)).toBe(true);
		if (isSuccess(result)) return;
		expect(result.error).toBeInstanceOf(CSPParseError);
		expect(result.error.position).toBe(18);
	});

	test("fails on a directive name outside the name grammar", () => {
		let result = parse("script_src 'self'");

		expect(isFailure(result)).toBe(true);
		if (isSuccess(result)) return;
		expect(result.error.position).toBe(0);
	});
});

describe("merge", () => {
	test("replaces each directive the override names and keeps the rest", () => {
		let merged = merge(
			{ defaultSrc: ["self"], frameAncestors: ["none"] },
			{ frameAncestors: ["*"], imgSrc: ["https:"] },
		);

		expect(merged).toEqual({ defaultSrc: ["self"], frameAncestors: ["*"], imgSrc: ["https:"] });
	});

	test("removes a directive set to null", () => {
		expect(merge({ defaultSrc: ["self"], sandbox: true }, { sandbox: null })).toEqual({
			defaultSrc: ["self"],
		});
	});

	test("keeps a directive the override sets to undefined", () => {
		expect(merge({ defaultSrc: ["self"] }, { defaultSrc: undefined })).toEqual({
			defaultSrc: ["self"],
		});
	});

	test("leaves the base untouched", () => {
		let base = { defaultSrc: ["self"] };
		merge(base, { defaultSrc: null });

		expect(base).toEqual({ defaultSrc: ["self"] });
	});
});

describe("generateNonce", () => {
	test("returns 16 random bytes as padded base64", () => {
		let nonce = generateNonce();

		expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
		expect(generateNonce()).not.toBe(nonce);
	});
});
