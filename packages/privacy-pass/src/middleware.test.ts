/**
 * Tests the router integration: `privacyPass()` publishes the instance, and
 * `redeemOrChallenge()` challenges a client without a token, redeems one that answers, adds the
 * `onRedeem` headers, refuses an untrusted token and stays quiet when the issuer is unavailable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { failure } from "@sdxc/result";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { RedeemOrChallengeOptions } from "./middleware.js";
import type { PrivacyPass } from "./privacy-pass.js";

import { PrivacyPassError } from "./errors.js";
import { privacyPass, redeemOrChallenge } from "./middleware.js";
import { createTestPrivacyPass, redeemThrough } from "./testing.js";

const PRIVACY_PASS_URL = "https://example.com/privacy-pass";

/** Sends requests through a router serving `redeemOrChallenge` behind `privacyPass(instance)`. */
function appWith(instance: PrivacyPass, options?: RedeemOrChallengeOptions) {
	let router = createRouter();
	router.get("/privacy-pass", {
		middleware: [privacyPass(instance)],
		handler: (ctx) => redeemOrChallenge(ctx, options),
	});
	return (request: Request) => router.fetch(request);
}

describe("privacyPass", () => {
	test("publishes the instance as ctx.privacyPass", async () => {
		let { privacyPass: instance } = await createTestPrivacyPass();
		let router = createRouter();
		let seen: PrivacyPass | undefined;
		router.get("/", {
			middleware: [privacyPass(instance)],
			handler: (ctx) => {
				seen = ctx.privacyPass;
				return new Response("ok");
			},
		});

		await router.fetch("https://example.com/");

		expect(seen).toBe(instance);
	});
});

describe("redeemOrChallenge", () => {
	test("challenges a client without a token, uncached", async () => {
		let { privacyPass: instance } = await createTestPrivacyPass();
		let response = await appWith(instance)(new Request(PRIVACY_PASS_URL));

		expect(response.status).toBe(401);
		expect(response.headers.get("WWW-Authenticate")).toMatch(/^PrivateToken challenge="/);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
	});

	test("redeems a token with an empty answer and the onRedeem headers", async () => {
		let { issuer, privacyPass: instance } = await createTestPrivacyPass();
		let redemptions: PrivacyPass.Redemption[] = [];
		let fetch = appWith(instance, {
			onRedeem(redemption) {
				redemptions.push(redemption);
				return { "Set-Cookie": "attested=1; Path=/" };
			},
		});

		let response = await redeemThrough(fetch, issuer, PRIVACY_PASS_URL);

		expect(response.status).toBe(204);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(response.headers.get("Set-Cookie")).toBe("attested=1; Path=/");
		expect(redemptions).toHaveLength(1);
	});

	test("challenges again for a token from an issuer it does not trust", async () => {
		let { privacyPass: instance } = await createTestPrivacyPass();
		let other = await createTestPrivacyPass();
		let response = await redeemThrough(appWith(instance), other.issuer, PRIVACY_PASS_URL);

		expect(response.status).toBe(401);
		expect(response.headers.has("WWW-Authenticate")).toBe(true);
	});

	test("answers empty when the issuer is unavailable", async () => {
		let { privacyPass: instance } = await createTestPrivacyPass();
		instance.challenge = async () =>
			failure(new PrivacyPassError("issuer-unavailable", "directory unreachable"));
		let response = await appWith(instance)(new Request(PRIVACY_PASS_URL));

		expect(response.status).toBe(204);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(response.headers.has("WWW-Authenticate")).toBe(false);
	});
});
