/**
 * A Privacy Pass origin over a test issuer, for tests that drive `/privacy-pass` or a
 * contact form an attested visitor posts. The issuer's keys are served from memory, so no
 * test ever reaches a real issuer's directory.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TestIssuer } from "@sdxc/privacy-pass/testing";

import { importTokenKey, MemoryRedemptionStore, PrivacyPass } from "@sdxc/privacy-pass";
import { answerChallenge, createTestIssuer } from "@sdxc/privacy-pass/testing";
import { success, unwrap } from "@sdxc/result";

/** An origin and the issuer whose tokens it accepts. */
export interface TestPrivacyPass {
	issuer: TestIssuer;
	privacyPass: PrivacyPass;
}

/**
 * Creates an origin that accepts tokens from a freshly generated issuer.
 *
 * @returns The origin, and the issuer a test signs tokens with.
 */
export async function createTestPrivacyPass(): Promise<TestPrivacyPass> {
	let issuer = await createTestIssuer();
	let key = unwrap(await importTokenKey(issuer.tokenKey));
	let privacyPass = new PrivacyPass({
		issuer: "issuer.test",
		keys: { keys: async () => success([key]) },
		store: new MemoryRedemptionStore(),
	});
	return { issuer, privacyPass };
}

/**
 * Answers `/privacy-pass` the way a device holding tokens does: reads the challenge, signs a
 * token for it, and repeats the request with the token.
 *
 * @param fetch Sends a request to the app, with the origin installed.
 * @param issuer The issuer the origin trusts.
 * @param url The `/privacy-pass` URL.
 * @returns The response to the request carrying the token.
 */
export async function redeemToken(
	fetch: (request: Request) => Promise<Response>,
	issuer: TestIssuer,
	url: string,
): Promise<Response> {
	let challenged = await fetch(new Request(url));
	let header = challenged.headers.get("WWW-Authenticate") ?? "";
	let authorization = await answerChallenge(issuer, header);
	return fetch(new Request(url, { headers: { Authorization: authorization } }));
}
