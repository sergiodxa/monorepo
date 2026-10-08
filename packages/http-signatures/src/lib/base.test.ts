/**
 * Tests for the signature base and the cavage signing string against the texts RFC 9421
 * Appendix B and draft-cavage-12 print, plus the derived-component rules of RFC 9421 §2.2
 * and the failures a component that cannot be covered produces.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Component } from "../types.js";

import { readSignatureInput } from "../fields.js";
import { cavageRequest, rfc9421Request } from "../fixtures/keys.js";

import { messageOf, signatureBase, signingString } from "./base.js";

/**
 * The signature base of a `Signature-Input` member over a request.
 *
 * @param request - The request.
 * @param input - The `Signature-Input` value with one member.
 */
function baseOf(request: Request, input: string) {
	let [member] = Object.values(unwrap(readSignatureInput(input)));
	if (member === undefined) throw new Error("expected one member");
	return signatureBase(messageOf(request), member.input.components, member.serialized);
}

/**
 * The value one component derives to on a request.
 *
 * @param url - The request URL.
 * @param component - The component.
 * @param headers - Request headers.
 */
function valueOf(url: string, component: Component, headers: Record<string, string> = {}) {
	let message = messageOf(new Request(url, { headers }));
	let base = signatureBase(message, [component], "()");
	return base.status === "success"
		? base.data.split("\n")[0]?.split(": ").slice(1).join(": ")
		: base;
}

describe("signatureBase", () => {
	test("B.2.1: an empty component list", () => {
		let input =
			'sig-b21=();created=1618884473;keyid="test-key-rsa-pss";nonce="b3k2pp5k7z-50gnwp.yemd"';
		expect(unwrap(baseOf(rfc9421Request(), input))).toBe(
			'"@signature-params": ();created=1618884473;keyid="test-key-rsa-pss";nonce="b3k2pp5k7z-50gnwp.yemd"',
		);
	});

	test("B.2.2: authority, content-digest and a query parameter", () => {
		let input =
			'sig-b22=("@authority" "content-digest" "@query-param";name="Pet");created=1618884473;keyid="test-key-rsa-pss";tag="header-example"';
		expect(unwrap(baseOf(rfc9421Request(), input))).toBe(
			[
				'"@authority": example.com',
				'"content-digest": sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:',
				'"@query-param";name="Pet": dog',
				'"@signature-params": ("@authority" "content-digest" "@query-param";name="Pet");created=1618884473;keyid="test-key-rsa-pss";tag="header-example"',
			].join("\n"),
		);
	});

	test("B.2.3: full coverage", () => {
		let input =
			'sig-b23=("date" "@method" "@path" "@query" "@authority" "content-type" "content-digest" "content-length");created=1618884473;keyid="test-key-rsa-pss"';
		expect(unwrap(baseOf(rfc9421Request(), input))).toBe(
			[
				'"date": Tue, 20 Apr 2021 02:07:55 GMT',
				'"@method": POST',
				'"@path": /foo',
				'"@query": ?param=Value&Pet=dog',
				'"@authority": example.com',
				'"content-type": application/json',
				'"content-digest": sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:',
				'"content-length": 18',
				'"@signature-params": ("date" "@method" "@path" "@query" "@authority" "content-type" "content-digest" "content-length");created=1618884473;keyid="test-key-rsa-pss"',
			].join("\n"),
		);
	});

	test("B.2.6: the ed25519 example", () => {
		let input =
			'sig-b26=("date" "@method" "@path" "@authority" "content-type" "content-length");created=1618884473;keyid="test-key-ed25519"';
		expect(unwrap(baseOf(rfc9421Request(), input))).toBe(
			[
				'"date": Tue, 20 Apr 2021 02:07:55 GMT',
				'"@method": POST',
				'"@path": /foo',
				'"@authority": example.com',
				'"content-type": application/json',
				'"content-length": 18',
				'"@signature-params": ("date" "@method" "@path" "@authority" "content-type" "content-length");created=1618884473;keyid="test-key-ed25519"',
			].join("\n"),
		);
	});

	test("derives the remaining request components of §2.2", () => {
		let url = "https://WWW.Example.com:443/path/to?param=value&foo=bar#fragment";
		expect(valueOf(url, { name: "@target-uri" })).toBe(
			"https://www.example.com/path/to?param=value&foo=bar",
		);
		expect(valueOf(url, { name: "@authority" })).toBe("www.example.com");
		expect(valueOf("http://example.com:8080/", { name: "@authority" })).toBe("example.com:8080");
		expect(valueOf(url, { name: "@scheme" })).toBe("https");
		expect(valueOf(url, { name: "@request-target" })).toBe("/path/to?param=value&foo=bar");
		expect(valueOf("https://example.com", { name: "@path" })).toBe("/");
		expect(valueOf("https://example.com/path", { name: "@query" })).toBe("?");
	});

	test("encodes query parameters as §2.2.8 does", () => {
		let url =
			"https://www.example.com/parameters?var=this%20is%20a%20big%0Amultiline%20value&bar=with+plus+whitespace&fa%C3%A7ade%22%3A%20=something&qux=";
		expect(valueOf(url, { name: "@query-param", params: { name: "var" } })).toBe(
			"this%20is%20a%20big%0Amultiline%20value",
		);
		expect(valueOf(url, { name: "@query-param", params: { name: "bar" } })).toBe(
			"with%20plus%20whitespace",
		);
		expect(valueOf(url, { name: "@query-param", params: { name: "fa%C3%A7ade%22%3A%20" } })).toBe(
			"something",
		);
		expect(valueOf(url, { name: "@query-param", params: { name: "qux" } })).toBe("");
	});

	test("combines repeated header values and trims them", () => {
		let headers = new Headers();
		headers.append("cache-control", "  max-age=60 ");
		headers.append("cache-control", "must-revalidate");
		let message = messageOf(new Request("https://example.com/"), headers);
		expect(unwrap(signatureBase(message, [{ name: "cache-control" }], "()"))).toBe(
			'"cache-control": max-age=60, must-revalidate\n"@signature-params": ()',
		);
	});

	test("re-serializes a Structured Field and selects a Dictionary member", () => {
		let headers = { "example-dict": " a=1,    b=2;x=1;y=2,   c=(a   b   c)" };
		expect(
			valueOf("https://example.com/", { name: "example-dict", params: { sf: true } }, headers),
		).toBe("a=1, b=2;x=1;y=2, c=(a b c)");
		expect(
			valueOf("https://example.com/", { name: "example-dict", params: { key: "c" } }, headers),
		).toBe("(a b c)");
		expect(
			valueOf("https://example.com/", { name: "example-dict", params: { key: "a" } }, headers),
		).toBe("1");
	});

	test("fails on a missing field or query parameter", () => {
		expect(valueOf("https://example.com/", { name: "x-missing" })).toMatchObject({
			error: { code: "missing-component" },
		});
		expect(
			valueOf("https://example.com/?a=1", { name: "@query-param", params: { name: "b" } }),
		).toMatchObject({ error: { code: "missing-component" } });
	});

	test("fails on a repeated query parameter", () => {
		expect(
			valueOf("https://example.com/?a=1&a=2", { name: "@query-param", params: { name: "a" } }),
		).toMatchObject({ error: { code: "malformed" } });
	});

	test("fails on components a request cannot provide", () => {
		expect(valueOf("https://example.com/", { name: "@status" })).toMatchObject({
			error: { code: "unsupported-component" },
		});
		expect(
			valueOf("https://example.com/", { name: "date", params: { req: true } }, { date: "x" }),
		).toMatchObject({ error: { code: "unsupported-component" } });
	});

	test("fails on a repeated or self-referencing component", () => {
		let message = messageOf(new Request("https://example.com/"));
		expect(signatureBase(message, [{ name: "@method" }, { name: "@method" }], "()")).toMatchObject({
			error: { code: "malformed" },
		});
		expect(signatureBase(message, [{ name: "@signature-params" }], "()")).toMatchObject({
			error: { code: "malformed" },
		});
	});
});

describe("signingString", () => {
	test("C.2 and C.3 of draft-cavage-12", () => {
		let message = messageOf(cavageRequest());
		let params = { algorithm: "rsa-sha256", created: null, expires: null };

		expect(unwrap(signingString(message, ["(request-target)", "host", "date"], params))).toBe(
			"(request-target): post /foo?param=value&pet=dog\nhost: example.com\ndate: Sun, 05 Jan 2014 21:31:40 GMT",
		);
		expect(
			unwrap(
				signingString(
					message,
					["(request-target)", "host", "date", "content-type", "digest", "content-length"],
					params,
				),
			),
		).toBe(
			[
				"(request-target): post /foo?param=value&pet=dog",
				"host: example.com",
				"date: Sun, 05 Jan 2014 21:31:40 GMT",
				"content-type: application/json",
				"digest: SHA-256=X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=",
				"content-length: 18",
			].join("\n"),
		);
	});

	test("§2.3: pseudo-headers, combined values and an empty value", () => {
		let headers = new Headers({
			host: "example.org",
			date: "Tue, 07 Jun 2014 20:51:35 GMT",
			"x-example": "Example header with some whitespace.",
			"x-emptyheader": "",
		});
		headers.append("cache-control", "max-age=60");
		headers.append("cache-control", "must-revalidate");
		let message = messageOf(new Request("https://example.org/foo"), headers);

		expect(
			unwrap(
				signingString(
					message,
					[
						"(request-target)",
						"(created)",
						"host",
						"date",
						"cache-control",
						"x-emptyheader",
						"x-example",
					],
					{ algorithm: "hs2019", created: new Date(1402170695000), expires: null },
				),
			),
		).toBe(
			[
				"(request-target): get /foo",
				"(created): 1402170695",
				"host: example.org",
				"date: Tue, 07 Jun 2014 20:51:35 GMT",
				"cache-control: max-age=60, must-revalidate",
				"x-emptyheader: ",
				"x-example: Example header with some whitespace.",
			].join("\n"),
		);
	});

	test("reads host from the URL when the request has no Host header", () => {
		let message = messageOf(new Request("https://example.net:8443/inbox"), new Headers());
		expect(
			unwrap(
				signingString(message, ["host"], { algorithm: "hs2019", created: null, expires: null }),
			),
		).toBe("host: example.net:8443");
	});

	test("refuses (created) under an rsa algorithm name or without the parameter", () => {
		let message = messageOf(cavageRequest());
		expect(
			signingString(message, ["(created)"], {
				algorithm: "rsa-sha256",
				created: new Date(0),
				expires: null,
			}),
		).toMatchObject({ error: { code: "malformed" } });
		expect(
			signingString(message, ["(expires)"], { algorithm: "hs2019", created: null, expires: null }),
		).toMatchObject({ error: { code: "malformed" } });
	});

	test("fails on a covered header the request lacks", () => {
		let message = messageOf(cavageRequest());
		expect(
			signingString(message, ["x-missing"], { algorithm: "hs2019", created: null, expires: null }),
		).toMatchObject({ error: { code: "missing-component" } });
	});
});
