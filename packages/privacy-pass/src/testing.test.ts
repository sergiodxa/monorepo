/**
 * Tests for the testing entry: an origin whose issuer is an MSW handler serving the test
 * issuer's directory redeems the token `answerChallenge` writes for its own challenge.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { unwrap } from "@sdxc/result";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { IssuerDirectory } from "./directory.js";
import { PrivacyPass } from "./privacy-pass.js";
import { MemoryRedemptionStore } from "./store.js";
import { answerChallenge, createTestIssuer, issuerDirectoryResponse } from "./testing.js";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("testing", () => {
	test("redeems a test token against the issuer's served directory", async () => {
		let issuer = await createTestIssuer();
		let directory = new IssuerDirectory({ issuer: "issuer.example.com" });
		server.use(http.get(directory.url, () => issuerDirectoryResponse(issuer)));
		let privacyPass = new PrivacyPass({
			issuer: "issuer.example.com",
			keys: directory,
			store: new MemoryRedemptionStore(),
		});

		let challenge = unwrap(await privacyPass.challenge());
		let redeemed = await privacyPass.redeem(await answerChallenge(issuer, challenge));

		expect(unwrap(redeemed).tokenKeyId).toBeTypeOf("string");
	});
});
