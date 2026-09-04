/**
 * The trusted-publisher preflight against a mocked GitHub and registry: the identity token is
 * requested for npm's audience and traded per package, a refused package is named with the
 * registry's reason, a job without the id-token permission is told so, and a run outside GitHub
 * Actions makes no request at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { githubIdToken, preflightTrustedPublishers } from "./oidc.js";

const TOKEN_URL = "https://token.actions.example/token?api-version=2";
const EXCHANGE_URL = "https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/";

/** The registry's answer per package, built fresh per request so every response has its own body. */
const REGISTRY = new Map<string, () => Response>([
	["@sdxc/types", () => HttpResponse.json({ token: "npm_short_lived" })],
	[
		"@sdxc/jwt",
		() => HttpResponse.json({ message: "no trusted publisher matches" }, { status: 404 }),
	],
]);

/** The registry's answer for a package no fixture names. */
function unknownPackage(): Response {
	return HttpResponse.json({ message: "unknown" }, { status: 404 });
}

const SERVER = setupServer(
	http.get("https://token.actions.example/token", ({ request }) => {
		let url = new URL(request.url);
		if (request.headers.get("authorization") !== "Bearer github-request-token") {
			return HttpResponse.json({ message: "bad request token" }, { status: 401 });
		}
		if (url.searchParams.get("audience") !== "npm:registry.npmjs.org") {
			return HttpResponse.json({ message: "wrong audience" }, { status: 400 });
		}
		return HttpResponse.json({ value: "github-id-token" });
	}),
	http.post(`${EXCHANGE_URL}*`, ({ request }) => {
		if (request.headers.get("authorization") !== "Bearer github-id-token") {
			return HttpResponse.json({ message: "invalid id token" }, { status: 401 });
		}
		let name = decodeURIComponent(
			new URL(request.url).pathname.slice(new URL(EXCHANGE_URL).pathname.length),
		);
		return (REGISTRY.get(name) ?? unknownPackage)();
	}),
);

beforeAll(() => {
	SERVER.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
	SERVER.resetHandlers();
	vi.unstubAllEnvs();
});

afterAll(() => {
	SERVER.close();
});

/** The environment a GitHub Actions job with `id-token: write` provides. */
function inActionsJob(): void {
	vi.stubEnv("GITHUB_ACTIONS", "true");
	vi.stubEnv("ACTIONS_ID_TOKEN_REQUEST_URL", TOKEN_URL);
	vi.stubEnv("ACTIONS_ID_TOKEN_REQUEST_TOKEN", "github-request-token");
}

describe("preflightTrustedPublishers", () => {
	test("passes when the registry exchanges a token for every package", async () => {
		inActionsJob();

		expect(isSuccess(await preflightTrustedPublishers(["@sdxc/types"]))).toBe(true);
	});

	test("names every refused package with the registry's reason and the settings to check", async () => {
		inActionsJob();
		let result = await preflightTrustedPublishers(["@sdxc/types", "@sdxc/jwt"]);

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.message).toContain("@sdxc/jwt: 404 no trusted publisher matches");
		expect(result.error.message).not.toContain("@sdxc/types:");
		expect(result.error.message).toContain("release.yml");
	});

	test("tells a job without the id-token permission what it is missing", async () => {
		vi.stubEnv("GITHUB_ACTIONS", "true");
		vi.stubEnv("ACTIONS_ID_TOKEN_REQUEST_URL", "");
		vi.stubEnv("ACTIONS_ID_TOKEN_REQUEST_TOKEN", "");
		let result = await preflightTrustedPublishers(["@sdxc/types"]);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toContain("id-token: write");
	});

	test("passes outside GitHub Actions without touching the network", async () => {
		vi.stubEnv("GITHUB_ACTIONS", "");

		expect(isSuccess(await preflightTrustedPublishers(["@sdxc/jwt"]))).toBe(true);
	});
});

describe("githubIdToken", () => {
	test("requests the token for npm's audience and reads its value", async () => {
		inActionsJob();
		let result = await githubIdToken();

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data).toBe("github-id-token");
	});
});
