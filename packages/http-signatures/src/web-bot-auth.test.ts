/**
 * Checks the Web Bot Auth profile against draft-ietf-webbotauth-httpsig-protocol-00's
 * Appendix E vectors (verifying E.1.1, E.2.1 and E.2.2, reproducing E.2.3 byte for byte),
 * then signs and verifies round trips with the directory fetched through MSW.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DirectoryKey } from "@sdxc/well-known/http-message-signatures-directory";

import { MemoryCache } from "@sdxc/cache/memory";
import { Pem } from "@sdxc/crypto";
import { follow } from "@sdxc/outbound";
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import {
	build,
	httpMessageSignaturesDirectory,
} from "@sdxc/well-known/http-message-signatures-directory";
import { respond } from "@sdxc/well-known/response";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { RSA_PSS_PUBLIC_PEM } from "./fixtures/keys.js";
import {
	DIRECTORY_CACHE_PREFIX,
	importWebBotAuthKey,
	parseSignatureAgent,
	signDirectoryResponse,
	signWebBotAuth,
	stringifySignatureAgent,
	verifyWebBotAuth,
	webBotAuthSigner,
} from "./web-bot-auth.js";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** RFC 9421 B.1.4 `test-key-ed25519` as a private JWK, the key of the draft's E.2 vectors. */
const ED25519_PRIVATE_JWK: DirectoryKey = {
	kty: "OKP",
	crv: "Ed25519",
	x: "JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs",
	d: "n4Ni-HpISpVObnQMW0wOhCKROaIKqKtW_2ZYb2p9KcU",
};

/** The thumbprint the draft's E.2 vectors sign under. */
const ED25519_KEYID = "poqkLGiymh_W0uP6PZFw-dvez3QJT5SolqXBCW38r0U";

/** The `created` every vector carries: 2025-01-01T00:00:00Z. */
const VECTOR_CREATED = new Date(1_735_689_600_000);

/** Where the vectors' agent publishes its directory. */
const VECTOR_DIRECTORY =
	"https://signature-agent.test/.well-known/http-message-signatures-directory";

/** A lifetime long enough for the vectors, whose `expires` is in 2124. */
const CENTURY = "36600 days";

/**
 * A cache already holding the vectors' directory, which stands in for a fetch: outbound
 * refuses the reserved `.test` host the vectors name.
 *
 * @param keys - The directory's keys.
 */
async function vectorCache(keys: DirectoryKey[]) {
	let cache = new MemoryCache();
	await cache.write(`${DIRECTORY_CACHE_PREFIX}${VECTOR_DIRECTORY}`, { keys });
	return cache;
}

/**
 * The public half of the vectors' Ed25519 key, as the directory publishes it.
 */
function ed25519PublicKey(): DirectoryKey {
	let { d: _, ...publicKey } = ED25519_PRIVATE_JWK;
	return { ...publicKey, kid: ED25519_KEYID };
}

describe("Appendix E vectors", () => {
	test("E.2.1: the ed25519 signature over a Signature-Agent member verifies", async () => {
		let request = new Request("https://example.com/", {
			headers: {
				"signature-agent": 'agent2="https://signature-agent.test"',
				"signature-input":
					'sig2=("@authority" "signature-agent";key="agent2");created=1735689600;keyid="poqkLGiymh_W0uP6PZFw-dvez3QJT5SolqXBCW38r0U";alg="ed25519";expires=4889289600;nonce="n9p433xm+NJ3ph3upfBIGmsuwHw387YV7Q/F+6BSpGCVjYCqQw6rznNA8PVVLySrAWsv0hQtFioQb6E1YsauiA==";tag="web-bot-auth"',
				signature:
					"sig2=:RdNFx5Bj6au3YgAMQL/RzmUlZE8QZLIaXGRpw985hWnwPfMxT228NMk6ehRS1PSl4e8PhbNZACSanGdhEwYCCg==:",
			},
		});

		let verified = await verifyWebBotAuth(request, {
			cache: await vectorCache([ed25519PublicKey()]),
			now: new Date(VECTOR_CREATED.getTime() + 1000),
			maxLifetime: CENTURY,
		});

		expect(unwrap(verified)).toEqual({
			label: "sig2",
			keyid: ED25519_KEYID,
			agent: VECTOR_DIRECTORY,
			created: VECTOR_CREATED,
			expires: new Date(4_889_289_600_000),
			components: ["@authority", 'signature-agent;key="agent2"'],
		});
	});

	test("E.2.2: the legacy sf-string Signature-Agent verifies, unless legacy is off", async () => {
		let request = new Request("https://example.com/", {
			headers: {
				"signature-agent": '"https://signature-agent.test"',
				"signature-input":
					'sig2=("@authority" "signature-agent");created=1735689600;keyid="poqkLGiymh_W0uP6PZFw-dvez3QJT5SolqXBCW38r0U";alg="ed25519";expires=1735693200;nonce="e8N7S2MFd/qrd6T2R3tdfAuuANngKI7LFtKYI/vowzk4lAZYadIX6wW25MwG7DCT9RUKAJ0qVkU0mEeLElW1qg==";tag="web-bot-auth"',
				signature:
					"sig2=:jdq0SqOwHdyHr9+r5jw3iYZH6aNGKijYp/EstF4RQTQdi5N5YYKrD+mCT1HA1nZDsi6nJKuHxUi/5Syp3rLWBA==:",
			},
		});
		let options = {
			cache: await vectorCache([ed25519PublicKey()]),
			now: new Date(VECTOR_CREATED.getTime() + 1000),
		};

		let verified = await verifyWebBotAuth(request, options);
		let strict = await verifyWebBotAuth(request, { ...options, legacy: false });

		expect(isSuccess(verified) && verified.data.agent).toBe(VECTOR_DIRECTORY);
		expect(isFailure(strict) && strict.error.code).toBe("insufficient-coverage");
	});

	test("E.1.1: the rsa-pss-sha512 signature verifies against a JWK without alg", async () => {
		let spki = unwrap(Pem.decode(RSA_PSS_PUBLIC_PEM, "PUBLIC KEY"));
		let imported = await crypto.subtle.importKey(
			"spki",
			spki,
			{ name: "RSA-PSS", hash: "SHA-512" },
			true,
			["verify"],
		);
		let { kty, n, e } = await crypto.subtle.exportKey("jwk", imported);
		let request = new Request("https://example.com/", {
			headers: {
				"signature-agent": 'agent2="https://signature-agent.test"',
				"signature-input":
					'sig2=("@authority" "signature-agent";key="agent2");created=1735689600;keyid="oD0HwocPBSfpNy5W3bpJeyFGY_IQ_YpqxSjQ3Yd-CLA";alg="rsa-pss-sha512";expires=4889289600;nonce="wcfPQPh7SzkvrIVvhD00vNk9PkxJNY2NVbYl2PVBB4zmUoluSwE7W6bPtF60QA3k8g06FU7PPCD+J58YofY1zg==";tag="web-bot-auth"',
				signature:
					"sig2=:gHzpLNeHaHIO19NaJH9YMW5dcVSi2s0wOMBr6p18vcofS106sfC4KBIS0/szPlBBd1vIcyQ88B6CTEWIhRAiVrb9zfX0mx1aG12CSGWcYkSirHeyTxhbuJvXd27ed6skWoy4PjXItq38936ivUQjfdIwXh1aX6HxkAC3vRnEdSNfntkLWeEuIQ5BLIOBGE39fSwg27Qjq6OVWYas/9/aFUr3HA34MXWYdp+//cvlEKDp3kRoLOw9ro0AOr6srHrTeEtxon2afcws1aZVSlPdd2fZSEIGmw9HAHLDCEkFTERu1gH2k/zIEqgy7CAYXI9E5slog0cLg/Vc6+f8gih33g==:",
			},
		});

		let verified = await verifyWebBotAuth(request, {
			cache: await vectorCache([{ kty: kty ?? "RSA", n, e }]),
			now: new Date(VECTOR_CREATED.getTime() + 1000),
			maxLifetime: CENTURY,
		});

		expect(isSuccess(verified) && verified.data.keyid).toBe(
			"oD0HwocPBSfpNy5W3bpJeyFGY_IQ_YpqxSjQ3Yd-CLA",
		);
	});

	test("E.2.3: signing the directory response reproduces the draft's fields", async () => {
		let key = unwrap(await importWebBotAuthKey(ED25519_PRIVATE_JWK));
		let request = new Request(VECTOR_DIRECTORY, {
			headers: { accept: "application/http-message-signatures-directory+json" },
		});
		let { kty, crv, kid, x } = ed25519PublicKey();
		let response = await respond(
			httpMessageSignaturesDirectory,
			unwrap(build([{ kty, crv, kid, x }])),
		);

		let signed = unwrap(
			await signDirectoryResponse(response, request, {
				keys: [key],
				created: VECTOR_CREATED,
				expiresIn: (4_889_289_600 - 1_735_689_600) * 1000,
			}),
		);

		expect(signed.headers.get("content-digest")).toBe(
			"sha-256=:CADMT2aBdV/rqQr/NIru64ERQkCobVvllA4V0fLFDu0=:",
		);
		expect(signed.headers.get("signature-input")).toBe(
			'binding=("@authority";req "content-digest");created=1735689600;expires=4889289600;keyid="poqkLGiymh_W0uP6PZFw-dvez3QJT5SolqXBCW38r0U";tag="http-message-signatures-directory"',
		);
		expect(signed.headers.get("signature")).toBe(
			"binding=:l6P8R67tm3kujAxbHWio7ll01qrEZ0dKD/WWlGhNYEmTnFZM8Wt0VQ9zqGfvo7T/UMkBxsigzChM1Gpz7gOVBg==:",
		);
	});
});

describe(importWebBotAuthKey, () => {
	test("labels the public half with the thumbprint and drops the private member", async () => {
		let key = unwrap(await importWebBotAuthKey({ ...ED25519_PRIVATE_JWK, kid: "mine" }));

		expect(key.keyid).toBe(ED25519_KEYID);
		expect(key.algorithm).toBe("ed25519");
		expect(key.publicKey).toEqual(ed25519PublicKey());
		expect(key.privateKey.extractable).toBe(false);
	});

	test("publishes a Web Crypto export without its alg, ext and key_ops members", async () => {
		let pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
			"sign",
			"verify",
		])) as CryptoKeyPair;
		let exported = await crypto.subtle.exportKey("jwk", pair.privateKey);

		let key = unwrap(await importWebBotAuthKey(exported as DirectoryKey));

		expect(Object.keys(key.publicKey).sort()).toEqual(["crv", "kid", "kty", "x"]);
	});

	test("refuses a public key", async () => {
		let key = await importWebBotAuthKey(ed25519PublicKey());

		expect(isFailure(key) && key.error.code).toBe("unsupported-algorithm");
	});
});

describe(parseSignatureAgent, () => {
	test("reads members with their type, defaulting to directory", () => {
		let agents = parseSignatureAgent(
			'sig1="https://a.example.com", sig2="https://b.example.com/jwks.json";type=jwks_uri',
		);

		expect(unwrap(agents)).toEqual({
			sig1: { uri: "https://a.example.com", type: "directory" },
			sig2: { uri: "https://b.example.com/jwks.json", type: "jwks_uri" },
		});
	});

	test("reads a legacy String only under a label", () => {
		expect(unwrap(parseSignatureAgent('"https://a.example.com"', "sig1"))).toEqual({
			sig1: { uri: "https://a.example.com", type: "directory" },
		});
		expect(isFailure(parseSignatureAgent('"https://a.example.com"'))).toBe(true);
	});

	test("fails the field for a member that is not an https URI String", () => {
		expect(isFailure(parseSignatureAgent('sig1="http://a.example.com"'))).toBe(true);
		expect(isFailure(parseSignatureAgent("sig1=https"))).toBe(true);
	});

	test("writes type only when it is not directory", () => {
		let text = stringifySignatureAgent({
			sig1: { uri: "https://a.example.com", type: "directory" },
			sig2: { uri: "https://b.example.com/card", type: "cimd" },
		});

		expect(unwrap(text)).toBe(
			'sig1="https://a.example.com", sig2="https://b.example.com/card";type=cimd',
		);
	});
});

/** The agent the round-trip tests sign as. */
const AGENT = "https://bot.example.com";

/** Where `AGENT` publishes its directory. */
const AGENT_DIRECTORY = `${AGENT}/.well-known/http-message-signatures-directory`;

/** The time the round-trip tests sign and verify at. */
const NOW = new Date("2026-10-24T12:00:00Z");

/**
 * Serves the agent's directory through MSW, counting the fetches.
 *
 * @param keys - The directory's keys.
 */
function serveDirectory(keys: DirectoryKey[]) {
	let fetches = { count: 0 };
	server.use(
		http.get(AGENT_DIRECTORY, async ({ request }) => {
			fetches.count++;
			return await respond(httpMessageSignaturesDirectory, unwrap(build(keys)), { request });
		}),
	);
	return fetches;
}

describe("signing and verifying", () => {
	test("signs with the profile's parameters and covers the Signature-Agent member", async () => {
		let key = unwrap(await importWebBotAuthKey(ED25519_PRIVATE_JWK));

		let signed = unwrap(
			await signWebBotAuth(new Request("https://origin.example.com/feed.xml"), {
				key,
				agent: AGENT,
				created: NOW,
			}),
		);

		expect(signed.headers.get("signature-agent")).toBe('sig1="https://bot.example.com"');
		expect(signed.headers.get("signature-input")).toBe(
			`sig1=("@authority" "@method" "@path" "signature-agent";key="sig1");created=${NOW.getTime() / 1000};expires=${NOW.getTime() / 1000 + 300};keyid="${ED25519_KEYID}";tag="web-bot-auth"`,
		);
	});

	test("keeps another signer's Signature-Agent member", async () => {
		let key = unwrap(await importWebBotAuthKey(ED25519_PRIVATE_JWK));
		let request = new Request("https://origin.example.com/", {
			headers: { "signature-agent": 'inner="https://browser.example.com"' },
		});

		let signed = unwrap(
			await signWebBotAuth(request, { key, agent: `${AGENT}/jwks.json`, agentType: "jwks_uri" }),
		);

		expect(signed.headers.get("signature-agent")).toBe(
			'inner="https://browser.example.com", sig1="https://bot.example.com/jwks.json";type=jwks_uri',
		);
	});

	test("refuses coverage without the authority, and an agent that is not https", async () => {
		let key = unwrap(await importWebBotAuthKey(ED25519_PRIVATE_JWK));
		let request = new Request("https://origin.example.com/");

		let uncovered = await signWebBotAuth(request, { key, agent: AGENT, components: ["@path"] });
		let insecure = await signWebBotAuth(request, { key, agent: "http://bot.example.com" });

		expect(isFailure(uncovered) && uncovered.error.code).toBe("insufficient-coverage");
		expect(isFailure(insecure) && insecure.error.code).toBe("malformed");
	});

	test("verifies against the fetched directory, then from the cache", async () => {
		let key = unwrap(await importWebBotAuthKey(ED25519_PRIVATE_JWK));
		let fetches = serveDirectory([key.publicKey]);
		let cache = new MemoryCache();
		let signed = unwrap(
			await signWebBotAuth(new Request("https://origin.example.com/feed.xml"), {
				key,
				agent: AGENT,
				created: NOW,
			}),
		);

		let first = await verifyWebBotAuth(signed, { cache, now: NOW, components: ["@path"] });
		let second = await verifyWebBotAuth(signed, { cache, now: NOW });

		expect(isSuccess(first) && first.data.agent).toBe(AGENT_DIRECTORY);
		expect(isSuccess(second)).toBe(true);
		expect(fetches.count).toBe(1);
	});

	test("verifies a request follow signed, inside the origin that received it", async () => {
		let key = unwrap(await importWebBotAuthKey(ED25519_PRIVATE_JWK));
		serveDirectory([key.publicKey]);
		let agent: string | null = null;
		server.use(
			http.get("https://origin.example.com/feed.xml", async ({ request }) => {
				let verified = await verifyWebBotAuth(request);
				agent = isSuccess(verified) ? verified.data.agent : verified.error.code;
				return HttpResponse.text("<feed/>");
			}),
		);

		let followed = await follow("https://origin.example.com/feed.xml", {
			sign: webBotAuthSigner({ key, agent: AGENT }),
		});

		expect(isSuccess(followed) && followed.data.response.status).toBe(200);
		expect(agent).toBe(AGENT_DIRECTORY);
	});
});

describe("verification failures", () => {
	/**
	 * A request signed at `NOW` by the vectors' key as `AGENT`, with the directory served.
	 *
	 * @param options - Overrides for the signer.
	 */
	async function signedRequest(options: Partial<Parameters<typeof signWebBotAuth>[1]> = {}) {
		let key = unwrap(await importWebBotAuthKey(ED25519_PRIVATE_JWK));
		serveDirectory([key.publicKey]);
		return unwrap(
			await signWebBotAuth(new Request("https://origin.example.com/feed.xml"), {
				key,
				agent: AGENT,
				created: NOW,
				...options,
			}),
		);
	}

	test("unsigned: a signature with another tag", async () => {
		let signed = await signedRequest();
		let headers = new Headers(signed.headers);
		headers.set(
			"signature-input",
			(headers.get("signature-input") ?? "").replace("web-bot-auth", "other"),
		);

		let verified = await verifyWebBotAuth(new Request(signed, { headers }), { now: NOW });

		expect(isFailure(verified) && verified.error.code).toBe("unsigned");
	});

	test("stale-signature: expired, and a lifetime past maxLifetime", async () => {
		let signed = await signedRequest();
		let long = await signedRequest({ expiresIn: "2 days" });

		let expired = await verifyWebBotAuth(signed, { now: new Date(NOW.getTime() + 3_600_000) });
		let tooLong = await verifyWebBotAuth(long, { now: NOW });

		expect(isFailure(expired) && expired.error.code).toBe("stale-signature");
		expect(isFailure(tooLong) && tooLong.error.code).toBe("stale-signature");
	});

	test("insufficient-coverage: a component the verifier requires", async () => {
		let signed = await signedRequest({ components: ["@authority"] });

		let verified = await verifyWebBotAuth(signed, { now: NOW, components: ["@method"] });

		expect(isFailure(verified) && verified.error.code).toBe("insufficient-coverage");
	});

	test("invalid-signature: a request sent to another path", async () => {
		let signed = await signedRequest();
		let moved = new Request("https://origin.example.com/other.xml", { headers: signed.headers });

		let verified = await verifyWebBotAuth(moved, { now: NOW });

		expect(isFailure(verified) && verified.error.code).toBe("invalid-signature");
	});

	test("key-unavailable: a directory without the key", async () => {
		let signed = await signedRequest();
		let other = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
		let jwk = await crypto.subtle.exportKey("jwk", (other as CryptoKeyPair).publicKey);
		server.use(
			http.get(AGENT_DIRECTORY, () =>
				HttpResponse.json({ keys: [{ kty: "OKP", crv: "Ed25519", x: jwk.x, kid: ED25519_KEYID }] }),
			),
		);

		let verified = await verifyWebBotAuth(signed, { now: NOW });

		expect(isFailure(verified) && verified.error.code).toBe("key-unavailable");
	});

	test("key-unavailable: a directory that redirects, which is never followed", async () => {
		let signed = await signedRequest();
		server.use(
			http.get(AGENT_DIRECTORY, () => HttpResponse.redirect("https://elsewhere.example.com/", 302)),
		);

		let verified = await verifyWebBotAuth(signed, { now: NOW });

		expect(isFailure(verified) && verified.error.code).toBe("key-unavailable");
	});

	test("key-unavailable: a directory agent that is not a bare origin", async () => {
		let signed = await signedRequest({ agent: `${AGENT}/keys` });

		let verified = await verifyWebBotAuth(signed, { now: NOW });

		expect(isFailure(verified) && verified.error.code).toBe("key-unavailable");
	});

	test("key-unavailable: a directory that answers 404 is not cached", async () => {
		let signed = await signedRequest();
		server.use(http.get(AGENT_DIRECTORY, () => new HttpResponse(null, { status: 404 })));
		let cache = new MemoryCache();

		let verified = await verifyWebBotAuth(signed, { now: NOW, cache });

		expect(isFailure(verified) && verified.error.code).toBe("key-unavailable");
		expect(unwrap(await cache.read(`${DIRECTORY_CACHE_PREFIX}${AGENT_DIRECTORY}`))).toBeNull();
	});
});
