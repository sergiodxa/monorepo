/**
 * Exercises the policy this package retrieves pages under: which addresses are refused
 * before a request, which statuses read as a refusal or a fault, and how a walk or read
 * that stopped reaches the caller as one of this package's own errors.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { OutboundError } from "@sdxc/outbound";
import { isFailure, isSuccess } from "@sdxc/result";
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { DistillLimitError, DistillRefusedError } from "../index.js";

import {
	addressable,
	MAX_BYTES,
	MAX_REDIRECTS,
	retrieve,
	TIMEOUT_MS,
	toDistillError,
} from "./limits.js";

/** What every retrieval in this file asks under. */
const AGENT = "ExampleClient/1.0 (+https://example.com/client)";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("addressable", () => {
	test("accepts a public HTTP(S) URL", () => {
		let result = addressable("https://example.com/post");
		expect(isSuccess(result) && result.data.href).toBe("https://example.com/post");
	});

	test.each([
		"ftp://example.com/file",
		"http://localhost:8787/",
		"http://127.0.0.1/",
		"http://8.8.8.8/",
		"http://[::1]/",
		"http://printer.local/",
		"http://intranet/",
		"not a url",
	])("refuses %s", (input) => {
		let result = addressable(input);
		expect(isFailure(result) && result.error).toBeInstanceOf(DistillRefusedError);
	});

	test.each(["https://user:pass@example.com/", "https://wiki.corp.internal/", "https://ada.test/"])(
		"refuses %s, a credential or a reserved name",
		(input) => {
			let result = addressable(input);
			expect(isFailure(result) && result.error).toBeInstanceOf(DistillRefusedError);
		},
	);
});

describe("retrieve", () => {
	test("answers a successful response with the final URL of the chain as a string", async () => {
		server.use(
			http.get("https://example.com/old", () =>
				HttpResponse.redirect("https://example.com/new", 301),
			),
			http.get("https://example.com/new", () => HttpResponse.text("hello")),
		);

		let result = await retrieve(new URL("https://example.com/old"), { userAgent: AGENT });

		expect(isSuccess(result)).toBe(true);
		if (!isSuccess(result)) return;
		expect(result.data.response.status).toBe(200);
		expect(result.data.url).toBe("https://example.com/new");
	});

	test.each([401, 402, 403, 429, 451])("reads %i as a refusal", async (status) => {
		server.use(http.get("https://example.com/no", () => new HttpResponse(null, { status })));

		let result = await retrieve(new URL("https://example.com/no"), { userAgent: AGENT });

		expect(isFailure(result) && result.error).toBeInstanceOf(DistillRefusedError);
	});

	test.each([404, 410, 503])("reads %i as a fault", async (status) => {
		server.use(http.get("https://example.com/bad", () => new HttpResponse(null, { status })));

		let result = await retrieve(new URL("https://example.com/bad"), { userAgent: AGENT });

		expect(isFailure(result) && result.error).toBeInstanceOf(DistillLimitError);
	});

	test("refuses a redirect into a private host before requesting it", async () => {
		server.use(
			http.get("https://example.com/hop", () => HttpResponse.redirect("http://127.0.0.1/", 302)),
		);

		let result = await retrieve(new URL("https://example.com/hop"), { userAgent: AGENT });

		expect(isFailure(result) && result.error).toBeInstanceOf(DistillRefusedError);
	});

	test("reads a chain longer than the redirect limit as a limit", async () => {
		server.use(
			http.get("https://example.com/loop/:n", ({ params }) =>
				HttpResponse.redirect(`https://example.com/loop/${Number(params.n) + 1}`, 302),
			),
		);

		let result = await retrieve(new URL("https://example.com/loop/0"), {
			userAgent: AGENT,
			maxRedirects: 2,
		});

		expect(isFailure(result) && result.error).toBeInstanceOf(DistillLimitError);
	});

	test("sends the caller's user agent and asks for HTML", async () => {
		let seen: Headers | null = null;
		server.use(
			http.get("https://example.com/ua", ({ request }) => {
				seen = request.headers;
				return HttpResponse.text("ok");
			}),
		);

		await retrieve(new URL("https://example.com/ua"), { userAgent: AGENT });

		let headers = seen as unknown as Headers;
		expect(headers.get("user-agent")).toBe(AGENT);
		expect(headers.get("accept")).toBe("text/html,application/xhtml+xml");
	});

	test("keeps the deadline when the caller passes its own signal", async () => {
		server.use(
			http.get("https://example.com/slow", async () => {
				await delay(500);
				return HttpResponse.text("late");
			}),
		);

		let caller = new AbortController();
		let result = await retrieve(new URL("https://example.com/slow"), {
			userAgent: AGENT,
			timeoutMs: 20,
			signal: caller.signal,
		});

		expect(isFailure(result) && result.error).toBeInstanceOf(DistillLimitError);
	});
});

describe("toDistillError", () => {
	test.each([
		"invalid-url",
		"refused-scheme",
		"refused-credentials",
		"refused-port",
		"refused-host",
		"refused-address",
	] as const)("reads %s as a refusal", (code) => {
		let error = toDistillError(new OutboundError(code, "https://example.com/", "Refused it"));
		expect(error).toBeInstanceOf(DistillRefusedError);
		expect(error.message).toBe("Refused it");
	});

	test.each(["too-many-redirects", "too-large", "timeout", "network"] as const)(
		"reads %s as a limit",
		(code) => {
			let error = toDistillError(new OutboundError(code, "https://example.com/", "Stopped"));
			expect(error).toBeInstanceOf(DistillLimitError);
			expect(error.message).toBe("Stopped");
		},
	);
});

test("exports the default bounds", () => {
	expect(MAX_BYTES).toBe(2 * 1024 * 1024);
	expect(MAX_REDIRECTS).toBe(5);
	expect(TIMEOUT_MS).toBe(8_000);
});
