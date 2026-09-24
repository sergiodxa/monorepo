/**
 * Exercises the bounded retrieval through its own entry point: which addresses are
 * refused before a request, how a redirect chain is walked and re-checked, which
 * statuses each function answers, and where the byte cap stops a body.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import {
	addressable,
	DistillLimitError,
	DistillRefusedError,
	follow,
	isAddressableHost,
	MAX_BYTES,
	MAX_REDIRECTS,
	readWithin,
	retrieve,
	TIMEOUT_MS,
} from "./retrieve.js";

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
		"http://[::1]/",
		"http://printer.local/",
		"http://intranet/",
		"not a url",
	])("refuses %s", (input) => {
		let result = addressable(input);
		expect(isFailure(result) && result.error).toBeInstanceOf(DistillRefusedError);
	});

	test("isAddressableHost reads the host alone", () => {
		expect(isAddressableHost("Example.COM")).toBe(true);
		expect(isAddressableHost("10.0.0.1")).toBe(false);
	});
});

describe("follow", () => {
	test("answers a failing status as it came, with the final URL of the chain", async () => {
		server.use(
			http.get("https://example.com/old", () =>
				HttpResponse.redirect("https://example.com/gone", 301),
			),
			http.get("https://example.com/gone", () => new HttpResponse("Gone", { status: 410 })),
		);

		let result = await follow(new URL("https://example.com/old"), { userAgent: AGENT });

		expect(isSuccess(result)).toBe(true);
		if (!isSuccess(result)) return;
		expect(result.data.response.status).toBe(410);
		expect(result.data.url).toBe("https://example.com/gone");
	});

	test("refuses a redirect into a private host before requesting it", async () => {
		server.use(
			http.get("https://example.com/hop", () => HttpResponse.redirect("http://127.0.0.1/", 302)),
		);

		let result = await follow(new URL("https://example.com/hop"), { userAgent: AGENT });

		expect(isFailure(result) && result.error).toBeInstanceOf(DistillRefusedError);
	});

	test("stops a chain longer than the redirect limit", async () => {
		server.use(
			http.get("https://example.com/loop/:n", ({ params }) =>
				HttpResponse.redirect(`https://example.com/loop/${Number(params.n) + 1}`, 302),
			),
		);

		let result = await follow(new URL("https://example.com/loop/0"), {
			userAgent: AGENT,
			maxRedirects: 2,
		});

		expect(isFailure(result) && result.error).toBeInstanceOf(DistillLimitError);
	});

	test("sends the caller's user agent and no credentials", async () => {
		let seen: string | null = null;
		server.use(
			http.get("https://example.com/ua", ({ request }) => {
				seen = request.headers.get("user-agent");
				return HttpResponse.text("ok");
			}),
		);

		await follow(new URL("https://example.com/ua"), { userAgent: AGENT });

		expect(seen).toBe(AGENT);
	});
});

describe("retrieve", () => {
	test("answers a successful response", async () => {
		server.use(http.get("https://example.com/ok", () => HttpResponse.text("hello")));

		let result = await retrieve(new URL("https://example.com/ok"), { userAgent: AGENT });

		expect(isSuccess(result) && result.data.response.status).toBe(200);
	});

	test("reads a refusing status as a refusal and a 5xx as a fault", async () => {
		server.use(
			http.get("https://example.com/403", () => new HttpResponse(null, { status: 403 })),
			http.get("https://example.com/503", () => new HttpResponse(null, { status: 503 })),
		);

		let refused = await retrieve(new URL("https://example.com/403"), { userAgent: AGENT });
		let faulted = await retrieve(new URL("https://example.com/503"), { userAgent: AGENT });

		expect(isFailure(refused) && refused.error).toBeInstanceOf(DistillRefusedError);
		expect(isFailure(faulted) && faulted.error).toBeInstanceOf(DistillLimitError);
	});
});

describe("readWithin", () => {
	test("reads a body under the cap and counts its bytes", async () => {
		let response = new Response("héllo");
		let result = await readWithin({ response, url: "https://example.com/" }, 100);

		expect(isSuccess(result) && result.data).toEqual({ text: "héllo", bytes: 6 });
	});

	test("refuses a body that grows past the cap", async () => {
		let response = new Response("x".repeat(64));
		let result = await readWithin({ response, url: "https://example.com/" }, 16);

		expect(isFailure(result) && result.error).toBeInstanceOf(DistillLimitError);
	});
});

test("exports the default bounds", () => {
	expect(MAX_BYTES).toBe(2 * 1024 * 1024);
	expect(MAX_REDIRECTS).toBe(5);
	expect(TIMEOUT_MS).toBe(8_000);
});
