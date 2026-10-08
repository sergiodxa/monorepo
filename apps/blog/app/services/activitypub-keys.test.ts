/**
 * Tests the blog's ActivityPub key provider with a freshly generated key: the package's
 * `KeyProvider` suite, the actor it refuses, a missing or invalid secret, and that a good
 * key is read and imported once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ActorKeys } from "@sdxc/activitypub";
import { keyProviderConformance } from "@sdxc/activitypub/testing";
import { isFailure, unwrap } from "@sdxc/result";
import { beforeAll, describe, expect, test } from "vitest";

import { ACTOR_ID } from "~/config/activitypub";

import { BlogKeyProvider } from "./activitypub-keys";

let privateKeyPem = "";
let publicKeyPem = "";

beforeAll(async () => {
	({ privateKeyPem, publicKeyPem } = unwrap(await ActorKeys.generate()));
});

keyProviderConformance({
	name: "BlogKeyProvider",
	create: () => new BlogKeyProvider(async () => privateKeyPem),
	hosted: [ACTOR_ID],
});

describe("BlogKeyProvider", () => {
	test("names the key <actor>#main-key and publishes the generated public half", async () => {
		let keys = unwrap(await new BlogKeyProvider(async () => privateKeyPem).keysOf(ACTOR_ID));

		expect(keys?.rsa.id).toBe(`${ACTOR_ID}#main-key`);
		expect(keys?.rsa.publicKeyPem).toBe(publicKeyPem);
	});

	test("reads and imports the secret once for every later call", async () => {
		let reads = 0;
		let provider = new BlogKeyProvider(async () => {
			reads += 1;
			return privateKeyPem;
		});

		let first = unwrap(await provider.keysOf(ACTOR_ID));
		let second = unwrap(await provider.keysOf(ACTOR_ID));

		expect(second).toBe(first);
		expect(reads).toBe(1);
	});

	test("answers null while the secret is unset, and the keys once it is set", async () => {
		let secret: string | null = null;
		let provider = new BlogKeyProvider(async () => secret);

		expect(unwrap(await provider.keysOf(ACTOR_ID))).toBeNull();

		secret = privateKeyPem;

		expect(unwrap(await provider.keysOf(ACTOR_ID))?.actor).toBe(ACTOR_ID);
	});

	test("fails for a secret that is not a PKCS#8 key", async () => {
		let provider = new BlogKeyProvider(async () => "not a key");

		expect(isFailure(await provider.keysOf(ACTOR_ID))).toBe(true);
	});
});
