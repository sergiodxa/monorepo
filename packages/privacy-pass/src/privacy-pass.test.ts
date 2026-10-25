/**
 * Tests for the origin flow: a challenge answered by a test issuer's token redeems once,
 * and a token for another challenge, a replay or a forged signature is refused.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { Hex } from "@sdxc/crypto";
import { failure, isFailure, success, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { IssuerKeySource } from "./directory.js";

import { importTokenKey } from "./blind-rsa.js";
import { PrivacyPassError } from "./errors.js";
import { BLIND_RSA_VECTORS, TOKEN_KEY } from "./fixtures/rfc-vectors.js";
import { toPaddedBase64Url } from "./lib/wire.js";
import { PrivacyPass } from "./privacy-pass.js";
import { MemoryRedemptionStore } from "./store.js";
import { answerChallenge, createTestIssuer } from "./testing.js";

/**
 * A key source serving fixed keys.
 *
 * @param tokenKeys - The encoded keys
 * @returns The source
 */
async function staticKeys(...tokenKeys: Uint8Array[]): Promise<IssuerKeySource> {
	let keys = await Promise.all(tokenKeys.map(async (key) => unwrap(await importTokenKey(key))));
	return { keys: async () => success(keys) };
}

/**
 * The `Authorization` value carrying an RFC 9578 vector's token.
 *
 * @param index - The vector
 * @returns The header value
 */
function vectorAuthorization(index: number): string {
	return `PrivateToken token="${toPaddedBase64Url(unwrap(Hex.decode(BLIND_RSA_VECTORS[index]!.token)))}"`;
}

describe("PrivacyPass with fresh redemption contexts", () => {
	test("redeems a token for its own challenge once", async () => {
		let issuer = await createTestIssuer();
		let privacyPass = new PrivacyPass({
			issuer: "issuer.example.com",
			originInfo: ["origin.example.com"],
			keys: await staticKeys(issuer.tokenKey),
			store: new MemoryRedemptionStore(),
			maxAge: "2 minutes",
		});

		let header = unwrap(await privacyPass.challenge());
		let authorization = await answerChallenge(issuer, header);
		let first = await privacyPass.redeem(authorization);
		let second = await privacyPass.redeem(authorization);

		expect(header).toMatch(/^PrivateToken challenge="[^"]+", token-key="[^"]+", max-age=120$/);
		expect(unwrap(first)).toMatchObject({
			tokenType: 2,
			tokenKeyId: Hex.encode(issuer.tokenKeyId),
		});
		expect(isFailure(second) && second.error.code).toBe("unknown-challenge");
	});

	test("issues a different challenge every time", async () => {
		let issuer = await createTestIssuer();
		let privacyPass = new PrivacyPass({
			issuer: "issuer.example.com",
			keys: await staticKeys(issuer.tokenKey),
			store: new MemoryRedemptionStore(),
		});

		let first = unwrap(await privacyPass.challenge());
		let second = unwrap(await privacyPass.challenge());

		expect(first).not.toBe(second);
	});

	test("refuses a valid token for a challenge it never issued", async () => {
		let privacyPass = new PrivacyPass({
			issuer: "issuer.example",
			originInfo: ["origin.example"],
			keys: await staticKeys(unwrap(Hex.decode(TOKEN_KEY))),
			store: new MemoryRedemptionStore(),
		});

		let result = await privacyPass.redeem(vectorAuthorization(0));

		expect(isFailure(result) && result.error.code).toBe("unknown-challenge");
	});

	test("refuses a forged token before consuming its challenge", async () => {
		let issuer = await createTestIssuer();
		let forger = await createTestIssuer();
		let store = new MemoryRedemptionStore();
		let privacyPass = new PrivacyPass({
			issuer: "issuer.example.com",
			keys: await staticKeys(issuer.tokenKey),
			store,
		});
		let header = unwrap(await privacyPass.challenge());

		let forged = await answerChallenge({ ...forger, tokenKeyId: issuer.tokenKeyId }, header);
		let result = await privacyPass.redeem(forged);
		let genuine = await privacyPass.redeem(await answerChallenge(issuer, header));

		expect(isFailure(result) && result.error.code).toBe("invalid-signature");
		expect(isFailure(genuine)).toBe(false);
	});

	test("refuses a token signed by a key the issuer does not list", async () => {
		let issuer = await createTestIssuer();
		let other = await createTestIssuer();
		let privacyPass = new PrivacyPass({
			issuer: "issuer.example.com",
			keys: await staticKeys(issuer.tokenKey),
			store: new MemoryRedemptionStore(),
		});
		let header = unwrap(await privacyPass.challenge());

		let result = await privacyPass.redeem(await answerChallenge(other, header));

		expect(isFailure(result) && result.error.code).toBe("unknown-key");
	});

	test("answers missing-token without credentials", async () => {
		let privacyPass = new PrivacyPass({
			issuer: "issuer.example.com",
			keys: await staticKeys(unwrap(Hex.decode(TOKEN_KEY))),
			store: new MemoryRedemptionStore(),
		});

		let result = await privacyPass.redeem(null);

		expect(isFailure(result) && result.error.code).toBe("missing-token");
	});

	test("answers issuer-unavailable when the keys cannot be read", async () => {
		let privacyPass = new PrivacyPass({
			issuer: "issuer.example.com",
			keys: { keys: async () => failure(new PrivacyPassError("issuer-unavailable", "down")) },
			store: new MemoryRedemptionStore(),
		});

		let result = await privacyPass.challenge();

		expect(isFailure(result) && result.error.code).toBe("issuer-unavailable");
	});
});

describe("PrivacyPass with an empty redemption context", () => {
	test("redeems RFC 9578 vector 2 once and refuses its replay", async () => {
		let privacyPass = new PrivacyPass({
			issuer: "issuer.example",
			originInfo: ["origin.example"],
			redemptionContext: "empty",
			keys: await staticKeys(unwrap(Hex.decode(TOKEN_KEY))),
			store: new MemoryRedemptionStore(),
		});

		let first = await privacyPass.redeem(vectorAuthorization(1));
		let replay = await privacyPass.redeem(vectorAuthorization(1));

		expect(unwrap(first).nonce).toBe(BLIND_RSA_VECTORS[1]!.token.slice(4, 68));
		expect(isFailure(replay) && replay.error.code).toBe("double-spend");
	});

	test("refuses a token for another origin list", async () => {
		let privacyPass = new PrivacyPass({
			issuer: "issuer.example",
			redemptionContext: "empty",
			keys: await staticKeys(unwrap(Hex.decode(TOKEN_KEY))),
			store: new MemoryRedemptionStore(),
		});

		let result = await privacyPass.redeem(vectorAuthorization(1));

		expect(isFailure(result) && result.error.code).toBe("unknown-challenge");
	});

	test("sends the same challenge without max-age", async () => {
		let issuer = await createTestIssuer();
		let privacyPass = new PrivacyPass({
			issuer: "issuer.example.com",
			redemptionContext: "empty",
			keys: await staticKeys(issuer.tokenKey),
			store: new MemoryRedemptionStore(),
		});

		let first = unwrap(await privacyPass.challenge());
		let second = unwrap(await privacyPass.challenge());

		expect(first).toBe(second);
		expect(first).not.toContain("max-age");
		expect(isFailure(await privacyPass.redeem(await answerChallenge(issuer, first)))).toBe(false);
	});
});
