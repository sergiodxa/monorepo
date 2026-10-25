/**
 * Checks uptime's Web Bot Auth identity end to end: without a key probes go out as they
 * were and no directory is served; with one, a signed probe verifies against the
 * directory this app serves, and that directory carries its own signature.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { verifyWebBotAuth } from "@sdxc/http-signatures/web-bot-auth";
import { isSuccess } from "@sdxc/result";
import { wellKnown } from "@sdxc/well-known/middleware";
import { http } from "msw";
import { setupServer } from "msw/node";
import { createRouter } from "remix/router";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { APP_ORIGIN } from "~/config/origin";

/** The directory URL a verifier resolves uptime's agent to. */
const DIRECTORY_URL = `${APP_ORIGIN}/.well-known/http-message-signatures-directory`;

/** RFC 9421 B.1.4 `test-key-ed25519` as a private JWK, a published key fit only for tests. */
const TEST_KEY = JSON.stringify({
	kty: "OKP",
	crv: "Ed25519",
	x: "JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs",
	d: "n4Ni-HpISpVObnQMW0wOhCKROaIKqKtW_2ZYb2p9KcU",
});

/** The Worker environment the initializer reads, set per test. */
const ENV = { WEB_BOT_AUTH_KEY: "" };

vi.doMock("cloudflare:workers", () => ({ env: ENV }));

const { signaturesDirectory, signProbe, webBotAuthKey } =
	await import("~/app/initializers/web-bot-auth");

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
	server.resetHandlers();
	ENV.WEB_BOT_AUTH_KEY = "";
});
afterAll(() => server.close());

/** A router serving only the directory, answering 404 for anything it falls through. */
function directoryRouter() {
	let router = createRouter({
		middleware: [wellKnown({ "http-message-signatures-directory": signaturesDirectory })],
	});
	router.route("ANY", "*rest", () => new Response(null, { status: 404 }));
	return router;
}

describe("without WEB_BOT_AUTH_KEY", () => {
	test("sends the probe as it was and serves no directory", async () => {
		let probe = new Request("https://monitored.example.com/");

		let response = await directoryRouter().fetch(DIRECTORY_URL);

		expect(await signProbe(probe)).toBe(probe);
		expect(response.status).toBe(404);
	});

	test("treats a secret that is not a JWK as unset", async () => {
		ENV.WEB_BOT_AUTH_KEY = "not json";

		expect(await webBotAuthKey()).toBeNull();
	});
});

describe("with WEB_BOT_AUTH_KEY", () => {
	test("signs a probe that verifies against the directory this app serves", async () => {
		ENV.WEB_BOT_AUTH_KEY = TEST_KEY;
		let router = directoryRouter();
		server.use(
			http.get(DIRECTORY_URL, ({ request }) => router.fetch(new Request(request.url, request))),
		);

		let signed = await signProbe(new Request("https://monitored.example.com/health"));
		let verified = await verifyWebBotAuth(signed, { components: ["@method", "@path"] });

		expect(signed.headers.get("signature-agent")).toBe(`sig1="${APP_ORIGIN}"`);
		expect(isSuccess(verified) && verified.data.agent).toBe(DIRECTORY_URL);
	});

	test("serves the directory signed by its own key", async () => {
		ENV.WEB_BOT_AUTH_KEY = TEST_KEY;

		let response = await directoryRouter().fetch(DIRECTORY_URL);

		expect(response.headers.get("content-type")).toBe(
			"application/http-message-signatures-directory+json",
		);
		expect(response.headers.get("signature-input")).toContain(
			'tag="http-message-signatures-directory"',
		);
		expect(await response.json()).toEqual({
			keys: [
				{
					kty: "OKP",
					crv: "Ed25519",
					x: "JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs",
					kid: "poqkLGiymh_W0uP6PZFw-dvez3QJT5SolqXBCW38r0U",
					use: "sig",
				},
			],
		});
	});
});
