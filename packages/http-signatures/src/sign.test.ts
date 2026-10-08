/**
 * Tests for `sign`: the RFC 9421 B.2.6 signature reproduced byte for byte, sign-then-verify
 * round trips for every algorithm under both schemes, the headers it adds, the defaults it
 * covers, and the failures for keys and components it cannot sign with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isFailure, success, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { importEd25519Private, rfc9421Request, TEST_BODY } from "./fixtures/keys.js";

import type { Algorithm, HttpSignatureErrorCode, Scheme } from "./index.js";

import {
	HttpSignatureError,
	parseCavageSignature,
	parseSignatureInput,
	sign,
	verify,
} from "./index.js";

/** The Web Crypto key generation parameters for each algorithm. */
const GENERATE: Record<Algorithm, RsaHashedKeyGenParams | EcKeyGenParams | AlgorithmIdentifier> = {
	"rsa-v1_5-sha256": {
		name: "RSASSA-PKCS1-v1_5",
		modulusLength: 2048,
		publicExponent: new Uint8Array([1, 0, 1]),
		hash: "SHA-256",
	},
	"rsa-pss-sha512": {
		name: "RSA-PSS",
		modulusLength: 2048,
		publicExponent: new Uint8Array([1, 0, 1]),
		hash: "SHA-512",
	},
	"ecdsa-p256-sha256": { name: "ECDSA", namedCurve: "P-256" },
	ed25519: { name: "Ed25519" },
};

/** The time every round trip signs at and verifies against. */
const NOW = new Date("2026-10-07T12:00:00Z");

/**
 * Generates a key pair for an algorithm.
 *
 * @param algorithm - The algorithm.
 */
async function generate(algorithm: Algorithm): Promise<CryptoKeyPair> {
	return (await crypto.subtle.generateKey(GENERATE[algorithm], false, [
		"sign",
		"verify",
	])) as CryptoKeyPair;
}

/** An activity delivery to an inbox, unsigned. */
function inboxPost(): Request {
	return new Request("https://blog.example/inbox", {
		method: "POST",
		headers: { "content-type": "application/activity+json" },
		body: TEST_BODY,
	});
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

describe("sign", () => {
	test("reproduces the RFC 9421 B.2.6 ed25519 signature", async () => {
		let signed = unwrap(
			await sign(rfc9421Request(), {
				scheme: "rfc9421",
				key: { id: "test-key-ed25519", privateKey: await importEd25519Private() },
				components: ["date", "@method", "@path", "@authority", "content-type", "content-length"],
				created: new Date(1618884473000),
				label: "sig-b26",
			}),
		);

		expect(signed.headers.get("signature-input")).toBe(
			'sig-b26=("date" "@method" "@path" "@authority" "content-type" "content-length");created=1618884473;keyid="test-key-ed25519"',
		);
		expect(signed.headers.get("signature")).toBe(
			"sig-b26=:wqcAqbmYJ2ji2glfAMaRy4gruYYnx2nEFN2HN6jrnDnQCK1u02Gb04v9EDgwUPiu4A0w6vuQv5lIp5WPpBKRCw==:",
		);
		expect(signed.headers.get("date")).toBe("Tue, 20 Apr 2021 02:07:55 GMT");
		expect(await signed.text()).toBe(TEST_BODY);
	});

	for (let scheme of ["rfc9421", "draft-cavage"] satisfies Scheme[]) {
		for (let algorithm of Object.keys(GENERATE) as Algorithm[]) {
			test(`${scheme} with ${algorithm} verifies after signing`, async () => {
				let pair = await generate(algorithm);
				let signed = unwrap(
					await sign(inboxPost(), {
						scheme,
						key: { id: "https://blog.example/actor#main-key", privateKey: pair.privateKey },
						body: TEST_BODY,
						created: NOW,
					}),
				);

				let verified = unwrap(
					await verify(signed, {
						key: async () => success(pair.publicKey),
						maxAge: "1 hour",
						now: NOW,
					}),
				);
				expect(verified.scheme).toBe(scheme);
				expect(verified.keyId).toBe("https://blog.example/actor#main-key");
			});
		}
	}

	test("rfc9421 writes Date, Content-Digest and the default coverage", async () => {
		let pair = await generate("rsa-v1_5-sha256");
		let signed = unwrap(
			await sign(inboxPost(), {
				scheme: "rfc9421",
				key: { id: "k", privateKey: pair.privateKey, algorithm: "rsa-v1_5-sha256" },
				body: TEST_BODY,
				created: NOW,
			}),
		);

		expect(signed.headers.get("date")).toBe("Wed, 07 Oct 2026 12:00:00 GMT");
		expect(signed.headers.get("content-digest")).toBe(
			"sha-256=:X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=:",
		);
		expect(signed.headers.get("signature-input")).toBe(
			'sig1=("@method" "@target-uri" "content-digest" "content-type" "date");created=1791374400;keyid="k"',
		);
	});

	test("draft-cavage writes Digest and Mastodon's coverage with hs2019", async () => {
		let pair = await generate("rsa-v1_5-sha256");
		let signed = unwrap(
			await sign(inboxPost(), {
				scheme: "draft-cavage",
				key: { id: "k", privateKey: pair.privateKey },
				body: TEST_BODY,
				created: NOW,
			}),
		);

		expect(signed.headers.get("digest")).toBe(
			"SHA-256=X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=",
		);
		let header = unwrap(parseCavageSignature(signed.headers.get("signature") ?? ""));
		expect(header).toMatchObject({
			keyId: "k",
			algorithm: "hs2019",
			created: null,
			headers: ["(request-target)", "host", "date", "digest", "content-type"],
		});
	});

	test("covers no digest and no content-type for a bodiless GET", async () => {
		let pair = await generate("ed25519");
		let get = new Request("https://remote.example/users/alice");
		let rfc = unwrap(
			await sign(get, { scheme: "rfc9421", key: { id: "k", privateKey: pair.privateKey } }),
		);
		let cavage = unwrap(
			await sign(get, { scheme: "draft-cavage", key: { id: "k", privateKey: pair.privateKey } }),
		);

		expect(rfc.headers.has("content-digest")).toBe(false);
		expect(
			unwrap(parseSignatureInput(rfc.headers.get("signature-input") ?? "")).sig1?.components,
		).toEqual([{ name: "@method" }, { name: "@target-uri" }, { name: "date" }]);
		expect(unwrap(parseCavageSignature(cavage.headers.get("signature") ?? "")).headers).toEqual([
			"(request-target)",
			"host",
			"date",
		]);
		expect(
			unwrap(await verify(cavage, { key: async () => success(pair.publicKey), maxAge: "1 minute" }))
				.components,
		).toEqual(["(request-target)", "host", "date"]);
	});

	test("keeps an existing Date", async () => {
		let pair = await generate("ed25519");
		let request = new Request("https://remote.example/", {
			headers: { date: "Mon, 05 Oct 2026 00:00:00 GMT" },
		});
		let signed = unwrap(
			await sign(request, { scheme: "rfc9421", key: { id: "k", privateKey: pair.privateKey } }),
		);
		expect(signed.headers.get("date")).toBe("Mon, 05 Oct 2026 00:00:00 GMT");
	});

	test("writes expires, nonce and tag, and adds a second label next to the first", async () => {
		let pair = await generate("ed25519");
		let key = { id: "k", privateKey: pair.privateKey };
		let first = unwrap(
			await sign(inboxPost(), { scheme: "rfc9421", key, body: TEST_BODY, created: NOW }),
		);
		let second = unwrap(
			await sign(first, {
				scheme: "rfc9421",
				key,
				created: NOW,
				expires: new Date(NOW.getTime() + 60_000),
				nonce: "n-1",
				tag: "web-bot-auth",
				label: "sig2",
				components: ["@method", "@authority", "@path"],
			}),
		);
		expectCode(
			await sign(first, {
				scheme: "rfc9421",
				key,
				components: [{ name: "@query-param", params: { name: "a" } }],
			}),
			"missing-component",
		);

		let inputs = unwrap(parseSignatureInput(second.headers.get("signature-input") ?? ""));
		expect(Object.keys(inputs)).toEqual(["sig1", "sig2"]);
		expect(inputs.sig2?.params).toEqual({
			created: NOW,
			expires: new Date(NOW.getTime() + 60_000),
			nonce: "n-1",
			keyid: "k",
			tag: "web-bot-auth",
		});

		let verified = await verify(second, {
			key: async () => success(pair.publicKey),
			maxAge: "1 hour",
			now: NOW,
			label: "sig1",
		});
		expect(unwrap(verified).label).toBe("sig1");
	});

	test("unsupported-algorithm: a key no algorithm uses, or one that contradicts it", async () => {
		let sha512 = (await crypto.subtle.generateKey(
			{ ...(GENERATE["rsa-v1_5-sha256"] as RsaHashedKeyGenParams), hash: "SHA-512" },
			false,
			["sign", "verify"],
		)) as CryptoKeyPair;
		expectCode(
			await sign(inboxPost(), {
				scheme: "rfc9421",
				key: { id: "k", privateKey: sha512.privateKey },
			}),
			"unsupported-algorithm",
		);

		let ed = await generate("ed25519");
		expectCode(
			await sign(inboxPost(), {
				scheme: "draft-cavage",
				key: { id: "k", privateKey: ed.privateKey, algorithm: "rsa-v1_5-sha256" },
			}),
			"unsupported-algorithm",
		);
	});

	test("malformed: a component object under cavage, or a label that is not a key", async () => {
		let pair = await generate("ed25519");
		let key = { id: "k", privateKey: pair.privateKey };
		expectCode(
			await sign(inboxPost(), { scheme: "draft-cavage", key, components: [{ name: "date" }] }),
			"malformed",
		);
		expectCode(
			await sign(inboxPost(), { scheme: "rfc9421", key, label: "Not A Key" }),
			"malformed",
		);
	});

	test("missing-component: a covered header the request lacks", async () => {
		let pair = await generate("ed25519");
		let key = { id: "k", privateKey: pair.privateKey };
		expectCode(
			await sign(inboxPost(), { scheme: "draft-cavage", key, components: ["x-missing"] }),
			"missing-component",
		);
	});
});
