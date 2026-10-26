/**
 * Drives `/privacy-pass` through the real router inside workerd, against the local session
 * KV, with a test issuer standing in for the public one: a challenge for a device without a
 * token, a session marked once a token redeems, and a token refused when spent twice.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PrivacyPass } from "@sdxc/privacy-pass";

import { PrivacyPassError } from "@sdxc/privacy-pass";
import { failure } from "@sdxc/result";
import { env } from "cloudflare:test";
import { describe, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import { createTestPrivacyPass, redeemToken } from "~/app/test/privacy-pass";

const URL_ = "https://blog.test/privacy-pass";

/** A full `App.Env` over the real bindings, with the secrets a local run cannot read. */
function environment(): App.Env {
	return {
		IS_PROD: false,
		CLIENT_ID: "test",
		CLIENT_SECRET: "test",
		COOKIE_SESSION_SECRET: "test",
		AUTH: env.AUTH,
		REDIRECTS: env.REDIRECTS,
		CACHE: env.CACHE,
		MCP_RATE_LIMITER: undefined,
		waitUntil: () => {},
	};
}

/** Sends requests through one router carrying `privacyPass`. */
function appWith(privacyPass: PrivacyPass) {
	let app = createWebRouter(environment(), { privacyPass });
	return (request: Request) => app.fetch(request);
}

describe("GET /privacy-pass", () => {
	test("challenges a device without a token, uncached", async () => {
		let { privacyPass } = await createTestPrivacyPass();
		let response = await appWith(privacyPass)(new Request(URL_));

		expect(response.status).toBe(401);
		expect(response.headers.get("WWW-Authenticate")).toMatch(/^PrivateToken challenge="/);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
	});

	test("redeems a token and starts a session for the device", async () => {
		let { issuer, privacyPass } = await createTestPrivacyPass();
		let response = await redeemToken(appWith(privacyPass), issuer, URL_);

		expect(response.status).toBe(204);
		expect(response.headers.get("set-cookie")).toContain("r3:session=");
	});

	test("refuses a token signed by an issuer it does not trust", async () => {
		let { issuer, privacyPass } = await createTestPrivacyPass();
		let fetch = appWith(privacyPass);
		let redeemed = await redeemToken(fetch, issuer, URL_);
		expect(redeemed.status).toBe(204);

		let other = await createTestPrivacyPass();
		let replayed = await redeemToken(fetch, other.issuer, URL_);

		expect(replayed.status).toBe(401);
		expect(replayed.headers.has("set-cookie")).toBe(false);
	});

	test("answers empty when the issuer cannot be reached, so the form keeps working", async () => {
		let { privacyPass } = await createTestPrivacyPass();
		privacyPass.challenge = async () =>
			failure(new PrivacyPassError("issuer-unavailable", "directory unreachable"));
		let response = await appWith(privacyPass)(new Request(URL_));

		expect(response.status).toBe(204);
		expect(response.headers.has("WWW-Authenticate")).toBe(false);
	});
});
