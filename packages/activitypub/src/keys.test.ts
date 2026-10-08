/**
 * Generating, importing and publishing an actor's keys: the PEM armor of both halves, the
 * public half derived back from the private key, and signatures that verify end to end.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { sign, verify } from "@sdxc/http-signatures";
import { isFailure, success, unwrap } from "@sdxc/result";
import { beforeAll, describe, expect, test } from "vitest";

import { ActorKeys, importPublicKey } from "./keys.js";

const ACTOR = "https://letters.blog/activitypub/actor";

let generated: ActorKeys.Generated;

beforeAll(async () => {
	generated = unwrap(await ActorKeys.generate());
});

describe("ActorKeys.generate", () => {
	test("armors a PKCS#8 private key and an SPKI public key", () => {
		expect(generated.privateKeyPem).toMatch(
			/^-----BEGIN PRIVATE KEY-----\n[\s\S]+-----END PRIVATE KEY-----\n$/,
		);
		expect(generated.publicKeyPem).toMatch(
			/^-----BEGIN PUBLIC KEY-----\n[\s\S]+-----END PUBLIC KEY-----\n$/,
		);
	});

	test("makes a 2048-bit RSASSA-PKCS1-v1_5 SHA-256 key", async () => {
		let key = unwrap(await importPublicKey(generated.publicKeyPem));
		expect(key.algorithm).toMatchObject({
			name: "RSASSA-PKCS1-v1_5",
			modulusLength: 2048,
			hash: { name: "SHA-256" },
		});
	});
});

describe("ActorKeys.import", () => {
	test("derives the same public key the pair was generated with", async () => {
		let keys = unwrap(
			await ActorKeys.import({ actor: ACTOR, privateKeyPem: generated.privateKeyPem }),
		);

		expect(keys.actor).toBe(ACTOR);
		expect(keys.rsa.id).toBe(`${ACTOR}#main-key`);
		expect(keys.rsa.publicKeyPem).toBe(generated.publicKeyPem);
		expect(keys.rsa.privateKey.extractable).toBe(false);
		expect(keys.ed25519).toBeNull();
	});

	test("signs requests that verify against the published key", async () => {
		let keys = unwrap(
			await ActorKeys.import({ actor: ACTOR, privateKeyPem: generated.privateKeyPem }),
		);
		let publicKey = unwrap(await importPublicKey(keys.publicKey.publicKeyPem));
		let body = new TextEncoder().encode('{"type":"Follow"}');

		let signed = unwrap(
			await sign(
				new Request("https://mastodon.social/inbox", {
					method: "POST",
					headers: { "content-type": "application/activity+json" },
					body,
				}),
				{ scheme: "draft-cavage", key: { id: keys.rsa.id, privateKey: keys.rsa.privateKey }, body },
			),
		);
		let verified = await verify(signed, {
			body,
			maxAge: "1 hour",
			key: async (keyId) => success(keyId === keys.rsa.id ? publicKey : null),
		});

		expect(unwrap(verified).keyId).toBe(`${ACTOR}#main-key`);
	});

	test("refuses a PKCS#1 key, which Mastodon stores, with the PEM label to convert to", async () => {
		let pkcs1 = generated.privateKeyPem.replaceAll("PRIVATE KEY", "RSA PRIVATE KEY");
		let result = await ActorKeys.import({ actor: ACTOR, privateKeyPem: pkcs1 });

		expect(isFailure(result) && result.error.name).toBe("InvalidKeyError");
		expect(isFailure(result) && result.error.message).toContain("PKCS#8");
	});

	test("refuses a PEM whose body is not a private key", async () => {
		let result = await ActorKeys.import({
			actor: ACTOR,
			privateKeyPem: generated.publicKeyPem.replaceAll("PUBLIC KEY", "PRIVATE KEY"),
		});

		expect(isFailure(result) && result.error.name).toBe("InvalidKeyError");
	});
});

describe("ActorKeys#publicKey", () => {
	test("publishes the key under #main-key, owned by the actor", async () => {
		let keys = unwrap(
			await ActorKeys.import({ actor: ACTOR, privateKeyPem: generated.privateKeyPem }),
		);

		expect(keys.id).toBe(`${ACTOR}#main-key`);
		expect(keys.publicKey).toEqual({
			id: `${ACTOR}#main-key`,
			owner: ACTOR,
			publicKeyPem: generated.publicKeyPem,
		});
	});
});

describe("importPublicKey", () => {
	test("imports an Ed25519 SPKI key", async () => {
		let pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
			"sign",
			"verify",
		])) as CryptoKeyPair;
		let spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
		let pem = `-----BEGIN PUBLIC KEY-----\n${btoa(String.fromCharCode(...spki))}\n-----END PUBLIC KEY-----\n`;

		let key = unwrap(await importPublicKey(pem));
		expect(key.algorithm.name).toBe("Ed25519");
		expect(key.usages).toEqual(["verify"]);
	});

	test("refuses text that is not SPKI PEM", async () => {
		let result = await importPublicKey("not a key");
		expect(isFailure(result) && result.error.name).toBe("InvalidKeyError");
	});
});
