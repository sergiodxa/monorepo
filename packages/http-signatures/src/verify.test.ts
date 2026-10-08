/**
 * Tests for `verify` against the signatures RFC 9421 Appendix B and draft-cavage-12
 * Appendix C publish, a request in the shape Mastodon delivers, and every failure code the
 * checks produce, in the order they run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { Base64, sha256 } from "@sdxc/crypto";
import { failure, isFailure, success, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import {
	CAVAGE_PUBLIC_PEM,
	ECC_P256_PUBLIC_PEM,
	ED25519_PUBLIC_PEM,
	RSA_PSS_PUBLIC_PEM,
	cavageRequest,
	importEd25519Private,
	importPublic,
	rfc9421Request,
	TEST_BODY,
} from "./fixtures/keys.js";
import { verifyWith } from "./lib/algorithms.js";

import type { HttpSignatureErrorCode, KeyLookup, VerifyOptions } from "./index.js";

import { HttpSignatureError, verify } from "./index.js";

/** The `created` time of every RFC 9421 Appendix B signature. */
const RFC_9421_NOW = new Date("2021-04-20T02:07:55Z");

/** The `Date` of the draft-cavage-12 Appendix C request. */
const CAVAGE_NOW = new Date("2014-01-05T21:31:40Z");

/** The B.2.3 signature, full coverage with rsa-pss-sha512. */
const B23_INPUT =
	'sig-b23=("date" "@method" "@path" "@query" "@authority" "content-type" "content-digest" "content-length");created=1618884473;keyid="test-key-rsa-pss"';
const B23_SIGNATURE =
	"sig-b23=:bbN8oArOxYoyylQQUU6QYwrTuaxLwjAC9fbY2F6SVWvh0yBiMIRGOnMYwZ/5MR6fb0Kh1rIRASVxFkeGt683+qRpRRU5p2voTp768ZrCUb38K0fUxN0O0iC59DzYx8DFll5GmydPxSmme9v6ULbMFkl+V5B1TP/yPViV7KsLNmvKiLJH1pFkh/aYA2HXXZzNBXmIkoQoLd7YfW91kE9o/CCoC1xMy7JA1ipwvKvfrs65ldmlu9bpG6A9BmzhuzF8Eim5f8ui9eH8LZH896+QIF61ka39VBrohr9iyMUJpvRX2Zbhl5ZJzSRxpJyoEZAFL2FUo5fTIztsDZKEgM4cUA==:";

/** The draft-cavage-12 C.3 signature, over the headers it actually signed. */
const CAVAGE_C3 =
	'keyId="Test",algorithm="rsa-sha256",headers="(request-target) host date content-type digest content-length",signature="vSdrb+dS3EceC9bcwHSo4MlyKS59iFIrhgYkz8+oVLEEzmYZZvRs8rgOp+63LEM3v+MFHB32NfpB2bEKBIvB1q52LaEUHFv120V01IL+TAD48XaERZFukWgHoBTLMhYS2Gb51gWxpeIq8knRmPnYePbF5MOkR0Zkly4zKH7s1dE="';

/**
 * A key lookup that answers one key for one id.
 *
 * @param id - The key id it knows.
 * @param key - The key to answer.
 */
function lookup(id: string, key: CryptoKey): KeyLookup {
	return async (keyId) => success(keyId === id ? key : null);
}

/**
 * Asserts a result failed with an `HttpSignatureError` of the given code.
 *
 * @param result - The result.
 * @param code - The expected code.
 */
function expectCode(result: Result<unknown, Error>, code: HttpSignatureErrorCode): void {
	if (!isFailure(result)) throw new Error(`expected ${code}, got success`);
	expect(result.error).toBeInstanceOf(HttpSignatureError);
	expect((result.error as HttpSignatureError).code).toBe(code);
}

describe("RFC 9421 Appendix B", () => {
	test("B.2.1: the minimal signature verifies and is refused as insufficient", async () => {
		let key = await importPublic(RSA_PSS_PUBLIC_PEM, { name: "RSA-PSS", hash: "SHA-512" });
		let base =
			'"@signature-params": ();created=1618884473;keyid="test-key-rsa-pss";nonce="b3k2pp5k7z-50gnwp.yemd"';
		let signature = unwrap(
			Base64.decode(
				"d2pmTvmbncD3xQm8E9ZV2828BjQWGgiwAaw5bAkgibUopemLJcWDy/lkbbHAve4cRAtx31Iq786U7it++wgGxbtRxf8Udx7zFZsckzXaJMkA7ChG52eSkFxykJeNqsrWH5S+oxNFlD4dzVuwe8DhTSja8xxbR/Z2cOGdCbzR72rgFWhzx2VjBqJzsPLMIQKhO4DGezXehhWwE56YCE+O6c0mKZsfxVrogUvA4HELjVKWmAvtl6UnCh8jYzuVG5WSb/QEVPnP5TmcAnLH1g+s++v6d4s8m0gCw1fV5/SITLq9mhho8K3+7EPYTU8IU1bLhdxO5Nyt8C8ssinQ98Xw9Q==",
			),
		);
		expect(
			await verifyWith("rsa-pss-sha512", key, signature, new TextEncoder().encode(base)),
		).toEqual(success(undefined));

		let request = rfc9421Request({
			"signature-input":
				'sig-b21=();created=1618884473;keyid="test-key-rsa-pss";nonce="b3k2pp5k7z-50gnwp.yemd"',
			signature: `sig-b21=:${Base64.encode(signature)}:`,
		});
		expectCode(
			await verify(request, {
				key: lookup("test-key-rsa-pss", key),
				maxAge: "1 hour",
				now: RFC_9421_NOW,
			}),
			"insufficient-coverage",
		);
	});

	test("B.2.2: selective coverage without the method is refused", async () => {
		let key = await importPublic(RSA_PSS_PUBLIC_PEM, { name: "RSA-PSS", hash: "SHA-512" });
		let request = rfc9421Request({
			"signature-input":
				'sig-b22=("@authority" "content-digest" "@query-param";name="Pet");created=1618884473;keyid="test-key-rsa-pss";tag="header-example"',
			signature:
				"sig-b22=:LjbtqUbfmvjj5C5kr1Ugj4PmLYvx9wVjZvD9GsTT4F7GrcQEdJzgI9qHxICagShLRiLMlAJjtq6N4CDfKtjvuJyE5qH7KT8UCMkSowOB4+ECxCmT8rtAmj/0PIXxi0A0nxKyB09RNrCQibbUjsLS/2YyFYXEu4TRJQzRw1rLEuEfY17SARYhpTlaqwZVtR8NV7+4UKkjqpcAoFqWFQh62s7Cl+H2fjBSpqfZUJcsIk4N6wiKYd4je2U/lankenQ99PZfB4jY3I5rSV2DSBVkSFsURIjYErOs0tFTQosMTAoxk//0RoKUqiYY8Bh0aaUEb0rQl3/XaVe4bXTugEjHSw==:",
		});
		expectCode(
			await verify(request, {
				key: lookup("test-key-rsa-pss", key),
				maxAge: "1 hour",
				now: RFC_9421_NOW,
			}),
			"insufficient-coverage",
		);
	});

	test("B.2.3: full coverage verifies", async () => {
		let key = await importPublic(RSA_PSS_PUBLIC_PEM, { name: "RSA-PSS", hash: "SHA-512" });
		let request = rfc9421Request({ "signature-input": B23_INPUT, signature: B23_SIGNATURE });
		let declared: Array<string | null> = [];

		let verified = unwrap(
			await verify(request, {
				key: async (keyId, algorithm) => {
					declared.push(algorithm);
					return success(keyId === "test-key-rsa-pss" ? key : null);
				},
				maxAge: "1 hour",
				now: RFC_9421_NOW,
			}),
		);

		expect(verified).toEqual({
			scheme: "rfc9421",
			keyId: "test-key-rsa-pss",
			label: "sig-b23",
			created: new Date(1618884473000),
			components: [
				"date",
				"@method",
				"@path",
				"@query",
				"@authority",
				"content-type",
				"content-digest",
				"content-length",
			],
		});
		expect(declared).toEqual([null]);
	});

	test("B.2.4: the ecdsa-p256-sha256 signature verifies over its base", async () => {
		let key = await importPublic(ECC_P256_PUBLIC_PEM, { name: "ECDSA", namedCurve: "P-256" });
		let base = [
			'"@status": 200',
			'"content-type": application/json',
			'"content-digest": sha-512=:mEWXIS7MaLRuGgxOBdODa3xqM1XdEvxoYhvlCFJ41QJgJc4GTsPp29l5oGX69wWdXymyU0rjJuahq4l5aGgfLQ==:',
			'"content-length": 23',
			'"@signature-params": ("@status" "content-type" "content-digest" "content-length");created=1618884473;keyid="test-key-ecc-p256"',
		].join("\n");
		let signature = unwrap(
			Base64.decode(
				"wNmSUAhwb5LxtOtOpNa6W5xj067m5hFrj0XQ4fvpaCLx0NKocgPquLgyahnzDnDAUy5eCdlYUEkLIj+32oiasw==",
			),
		);
		expect(
			await verifyWith("ecdsa-p256-sha256", key, signature, new TextEncoder().encode(base)),
		).toEqual(success(undefined));
	});

	test("B.2.6: the ed25519 signature verifies, and signing reproduces it", async () => {
		let key = await importPublic(ED25519_PUBLIC_PEM, { name: "Ed25519" });
		let base = [
			'"date": Tue, 20 Apr 2021 02:07:55 GMT',
			'"@method": POST',
			'"@path": /foo',
			'"@authority": example.com',
			'"content-type": application/json',
			'"content-length": 18',
			'"@signature-params": ("date" "@method" "@path" "@authority" "content-type" "content-length");created=1618884473;keyid="test-key-ed25519"',
		].join("\n");
		let published =
			"wqcAqbmYJ2ji2glfAMaRy4gruYYnx2nEFN2HN6jrnDnQCK1u02Gb04v9EDgwUPiu4A0w6vuQv5lIp5WPpBKRCw==";

		expect(
			await verifyWith(
				"ed25519",
				key,
				unwrap(Base64.decode(published)),
				new TextEncoder().encode(base),
			),
		).toEqual(success(undefined));

		let produced = await crypto.subtle.sign(
			"Ed25519",
			await importEd25519Private(),
			new TextEncoder().encode(base),
		);
		expect(Base64.encode(new Uint8Array(produced))).toBe(published);
	});
});

describe("draft-cavage-12 Appendix C", () => {
	test("C.3: the all-headers signature verifies", async () => {
		let key = await importPublic(CAVAGE_PUBLIC_PEM, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" });
		let verified = unwrap(
			await verify(cavageRequest({ signature: CAVAGE_C3 }), {
				key: lookup("Test", key),
				maxAge: "1 hour",
				now: CAVAGE_NOW,
			}),
		);

		expect(verified).toEqual({
			scheme: "draft-cavage",
			keyId: "Test",
			label: null,
			created: CAVAGE_NOW,
			components: ["(request-target)", "host", "date", "content-type", "digest", "content-length"],
		});
	});

	test("C.3: the signature also verifies from Authorization", async () => {
		let key = await importPublic(CAVAGE_PUBLIC_PEM, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" });
		let request = cavageRequest({ authorization: `Signature ${CAVAGE_C3}` });
		let verified = await verify(request, {
			key: lookup("Test", key),
			maxAge: "1 hour",
			now: CAVAGE_NOW,
		});
		expect(unwrap(verified).keyId).toBe("Test");
	});

	test("C.2: the basic signature leaves out the body digest", async () => {
		let key = await importPublic(CAVAGE_PUBLIC_PEM, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" });
		let signature =
			'keyId="Test",algorithm="rsa-sha256",headers="(request-target) host date",signature="qdx+H7PHHDZgy4y/Ahn9Tny9V3GP6YgBPyUXMmoxWtLbHpUnXS2mg2+SbrQDMCJypxBLSPQR2aAjn7ndmw2iicw3HMbe8VfEdKFYRqzic+efkb3nndiv/x1xSHDJWeSWkx3ButlYSuBskLu6kd9Fswtemr3lgdDEmn04swr2Os0="';
		let options: VerifyOptions = { key: lookup("Test", key), maxAge: "1 hour", now: CAVAGE_NOW };

		expectCode(await verify(cavageRequest({ signature }), options), "insufficient-coverage");

		let get = new Request("https://example.com/foo?param=value&pet=dog", {
			headers: { host: "example.com", date: "Sun, 05 Jan 2014 21:31:40 GMT", signature },
		});
		let post = await verify(new Request(get, { method: "POST" }), options);
		expect(unwrap(post).components).toEqual(["(request-target)", "host", "date"]);
	});

	test("C.1: the default signature covers only the date", async () => {
		let key = await importPublic(CAVAGE_PUBLIC_PEM, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" });
		let signature =
			'keyId="Test",algorithm="rsa-sha256",signature="SjWJWbWN7i0wzBvtPl8rbASWz5xQW6mcJmn+ibttBqtifLN7Sazz6m79cNfwwb8DMJ5cou1s7uEGKKCs+FLEEaDV5lp7q25WqS+lavg7T8hc0GppauB6hbgEKTwblDHYGEtbGmtdHgVCk9SuS13F0hZ8FD0k/5OxEPXe5WozsbM="';
		expectCode(
			await verify(cavageRequest({ signature }), {
				key: lookup("Test", key),
				maxAge: "1 hour",
				now: CAVAGE_NOW,
			}),
			"insufficient-coverage",
		);
	});
});

describe("a request in the shape Mastodon delivers", () => {
	test("verifies hs2019 over (request-target) host date digest content-type", async () => {
		let pair = await crypto.subtle.generateKey(
			{
				name: "RSASSA-PKCS1-v1_5",
				modulusLength: 2048,
				publicExponent: new Uint8Array([1, 0, 1]),
				hash: "SHA-256",
			},
			true,
			["sign", "verify"],
		);
		let body = JSON.stringify({
			"@context": "https://www.w3.org/ns/activitystreams",
			id: "https://mastodon.example/users/alice#follows/1",
			type: "Follow",
			actor: "https://mastodon.example/users/alice",
			object: "https://blog.example/actor",
		});
		let date = "Wed, 07 Oct 2026 12:00:00 GMT";
		let digest = `SHA-256=${Base64.encode(unwrap(await sha256(body)))}`;
		let signingString = [
			"(request-target): post /inbox",
			"host: blog.example",
			`date: ${date}`,
			`digest: ${digest}`,
			"content-type: application/activity+json",
		].join("\n");
		let signature = await crypto.subtle.sign(
			"RSASSA-PKCS1-v1_5",
			pair.privateKey,
			new TextEncoder().encode(signingString),
		);
		let keyId = "https://mastodon.example/users/alice#main-key";

		let request = new Request("https://blog.example/inbox", {
			method: "POST",
			headers: {
				host: "blog.example",
				date,
				digest,
				"content-type": "application/activity+json",
				signature: `keyId="${keyId}",algorithm="hs2019",headers="(request-target) host date digest content-type",signature="${Base64.encode(new Uint8Array(signature))}"`,
			},
			body,
		});

		let verified = unwrap(
			await verify(request, {
				key: lookup(keyId, pair.publicKey),
				maxAge: "1 hour",
				now: new Date("2026-10-07T12:00:30Z"),
			}),
		);
		expect(verified.scheme).toBe("draft-cavage");
		expect(verified.keyId).toBe(keyId);
		expect(verified.components).toEqual([
			"(request-target)",
			"host",
			"date",
			"digest",
			"content-type",
		]);
	});
});

describe("failures", () => {
	/** An RFC 9421 request signed as B.2.3, verified with its key and time. */
	async function b23(
		headers: Record<string, string>,
		options: Partial<VerifyOptions> = {},
		body?: string,
	) {
		let key = await importPublic(RSA_PSS_PUBLIC_PEM, { name: "RSA-PSS", hash: "SHA-512" });
		let request = rfc9421Request({
			"signature-input": B23_INPUT,
			signature: B23_SIGNATURE,
			...headers,
		});
		return verify(request, {
			key: lookup("test-key-rsa-pss", key),
			maxAge: "1 hour",
			now: RFC_9421_NOW,
			...(body !== undefined && { body }),
			...options,
		});
	}

	test("unsigned: no signature field", async () => {
		expectCode(
			await verify(rfc9421Request(), { key: async () => success(null), maxAge: "1 hour" }),
			"unsigned",
		);
	});

	test("unsigned: Signature-Input without a matching Signature", async () => {
		expectCode(await b23({ signature: "other=:AAAA:" }), "unsigned");
		expectCode(await b23({}, { label: "sig-other" }), "unsigned");
	});

	test("malformed: a field that does not parse", async () => {
		expectCode(await b23({ "signature-input": "sig-b23=(" }), "malformed");
		expectCode(
			await verify(cavageRequest({ signature: 'keyId="Test",signature=' }), {
				key: async () => success(null),
				maxAge: "1 hour",
			}),
			"malformed",
		);
	});

	test("malformed: a body already read and not passed", async () => {
		let request = rfc9421Request({ "signature-input": B23_INPUT, signature: B23_SIGNATURE });
		await request.text();
		expectCode(
			await verify(request, { key: async () => success(null), maxAge: "1 hour" }),
			"malformed",
		);
	});

	test("digest-mismatch: a body that differs from Content-Digest", async () => {
		expectCode(await b23({}, {}, `${TEST_BODY} `), "digest-mismatch");
	});

	test("missing-component: a covered header the request lacks", async () => {
		let key = await importPublic(RSA_PSS_PUBLIC_PEM, { name: "RSA-PSS", hash: "SHA-512" });
		let request = new Request("https://example.com/foo?param=Value&Pet=dog", {
			method: "POST",
			headers: { "signature-input": B23_INPUT, signature: B23_SIGNATURE },
		});
		expectCode(
			await verify(request, {
				key: lookup("test-key-rsa-pss", key),
				maxAge: "1 hour",
				now: RFC_9421_NOW,
			}),
			"missing-component",
		);
	});

	test("stale-signature: too old, from the future, or expired", async () => {
		expectCode(await b23({}, { now: new Date("2021-04-20T03:20:00Z") }), "stale-signature");
		expectCode(await b23({}, { now: new Date("2021-04-20T01:50:00Z") }), "stale-signature");
		expectCode(
			await b23({}, { now: new Date("2021-04-20T03:10:00Z"), clockSkew: 0 }),
			"stale-signature",
		);
		expect(unwrap(await b23({}, { now: new Date("2021-04-20T03:10:00Z") })).keyId).toBe(
			"test-key-rsa-pss",
		);
		expect(unwrap(await b23({}, { now: new Date("2021-04-20T02:10:00Z") })).keyId).toBe(
			"test-key-rsa-pss",
		);
	});

	test("stale-signature: past expires", async () => {
		let pair = await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"]);
		let input =
			'sig1=("@method" "@target-uri" "date");created=1618884473;expires=1618884533;keyid="k"';
		let request = new Request("https://example.com/", {
			headers: {
				date: "Tue, 20 Apr 2021 02:07:55 GMT",
				"signature-input": input,
				signature: "sig1=:AAAA:",
			},
		});
		expectCode(
			await verify(request, {
				key: lookup("k", pair.publicKey),
				maxAge: "1 hour",
				clockSkew: 0,
				now: new Date("2021-04-20T02:09:00Z"),
			}),
			"stale-signature",
		);
	});

	test("key-unavailable: the lookup fails or finds nothing", async () => {
		expectCode(await b23({}, { key: async () => success(null) }), "key-unavailable");
		expectCode(await b23({}, { key: async () => failure(new Error("gone")) }), "key-unavailable");
	});

	test("unsupported-algorithm: a key no algorithm uses, or one that contradicts alg", async () => {
		let sha512 = await importPublic(RSA_PSS_PUBLIC_PEM, {
			name: "RSASSA-PKCS1-v1_5",
			hash: "SHA-512",
		});
		expectCode(await b23({}, { key: async () => success(sha512) }), "unsupported-algorithm");

		let rsa = await importPublic(RSA_PSS_PUBLIC_PEM, {
			name: "RSASSA-PKCS1-v1_5",
			hash: "SHA-256",
		});
		expectCode(await b23({}, { key: async () => success(rsa) }), "invalid-signature");

		let declared = B23_INPUT.replace(
			'keyid="test-key-rsa-pss"',
			'keyid="test-key-rsa-pss";alg="ed25519"',
		);
		expectCode(await b23({ "signature-input": declared }), "unsupported-algorithm");

		expectCode(
			await verify(cavageRequest({ signature: CAVAGE_C3.replace("rsa-sha256", "hmac-sha256") }), {
				key: async () => success(rsa),
				maxAge: "1 hour",
				now: CAVAGE_NOW,
			}),
			"unsupported-algorithm",
		);
	});

	test("invalid-signature: the signature does not verify", async () => {
		let tampered = B23_SIGNATURE.replace("bbN8", "bbN9");
		expectCode(await b23({ signature: tampered }), "invalid-signature");
		expectCode(await b23({ "content-length": "19" }), "invalid-signature");
	});

	test("insufficient-coverage: a body without a covered digest", async () => {
		let pair = await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"]);
		let input = 'sig1=("@method" "@target-uri" "date");created=1618884473;keyid="k"';
		let request = new Request("https://example.com/", {
			method: "POST",
			headers: {
				date: "Tue, 20 Apr 2021 02:07:55 GMT",
				"signature-input": input,
				signature: "sig1=:AAAA:",
			},
			body: "payload",
		});
		expectCode(
			await verify(request, {
				key: lookup("k", pair.publicKey),
				maxAge: "1 hour",
				now: RFC_9421_NOW,
			}),
			"insufficient-coverage",
		);
	});
});
