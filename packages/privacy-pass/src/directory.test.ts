/**
 * Tests for the issuer directory: it imports the Blind RSA keys an issuer publishes,
 * reuses them for the response's `max-age`, and reports a broken directory as unavailable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { Hex } from "@sdxc/crypto";
import { isFailure, unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { IssuerDirectory } from "./directory.js";
import { TOKEN_KEY } from "./fixtures/rfc-vectors.js";
import { toPaddedBase64Url } from "./lib/wire.js";

/** The directory URL of the issuer these tests configure. */
const DIRECTORY_URL = "https://issuer.example.com/.well-known/private-token-issuer-directory";

let server = setupServer();
let tokenKey = toPaddedBase64Url(unwrap(Hex.decode(TOKEN_KEY)));

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
	server.resetHandlers();
	vi.useRealTimers();
});
afterAll(() => server.close());

describe("IssuerDirectory", () => {
	test("imports Blind RSA keys in order and skips other token types", async () => {
		server.use(
			http.get(DIRECTORY_URL, () =>
				HttpResponse.json(
					{
						"issuer-request-uri": "/token-request",
						"token-keys": [
							{ "token-type": 1, "token-key": "AAAA" },
							{ "token-type": 2, "token-key": tokenKey, "not-before": 1686913811 },
						],
					},
					{ headers: { "content-type": "application/private-token-issuer-directory" } },
				),
			),
		);
		let directory = new IssuerDirectory({ issuer: "issuer.example.com" });

		let keys = unwrap(await directory.keys());

		expect(keys).toHaveLength(1);
		expect(keys[0]!.notBefore).toEqual(new Date(1686913811 * 1000));
		expect(toPaddedBase64Url(keys[0]!.tokenKey)).toBe(tokenKey);
	});

	test("reuses the keys until the response's max-age runs out", async () => {
		let requests = 0;
		server.use(
			http.get(DIRECTORY_URL, () => {
				requests++;
				return HttpResponse.json(
					{ "token-keys": [{ "token-type": 2, "token-key": tokenKey }] },
					{ headers: { "cache-control": "public, max-age=60" } },
				);
			}),
		);
		let directory = new IssuerDirectory({ issuer: "issuer.example.com" });

		await Promise.all([directory.keys(), directory.keys()]);
		await directory.keys();
		vi.useFakeTimers({ now: Date.now() + 61_000, toFake: ["Date"] });
		await directory.keys();

		expect(requests).toBe(2);
	});

	test.each([
		["a server error", () => HttpResponse.text("down", { status: 503 })],
		["a body that is not JSON", () => HttpResponse.text("<html>")],
		["a directory without keys", () => HttpResponse.json({ "token-keys": [] })],
		[
			"a key that does not import",
			() => HttpResponse.json({ "token-keys": [{ "token-type": 2, "token-key": "AAAA" }] }),
		],
	])("answers issuer-unavailable for %s", async (_, resolver) => {
		server.use(http.get(DIRECTORY_URL, resolver));
		let directory = new IssuerDirectory({ issuer: "issuer.example.com" });

		let result = await directory.keys();

		expect(isFailure(result) && result.error.code).toBe("issuer-unavailable");
	});
});
