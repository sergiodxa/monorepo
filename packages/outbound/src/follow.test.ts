/**
 * Exercises `follow` against MSW: the final response answered whatever its status,
 * every hop re-checked, the redirect limit, the headers each hop sends, DNS checks per
 * hop, and one deadline that covers the chain and the body read after it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { follow } from "./follow.js";
import { readText } from "./read.js";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** A DoH JSON answer naming `addresses` for whichever type was asked. */
function dnsAnswer(addresses: Record<"A" | "AAAA", string[]>) {
	return http.get("https://cloudflare-dns.com/dns-query", ({ request }) => {
		let url = new URL(request.url);
		let type: "A" | "AAAA" = url.searchParams.get("type") === "AAAA" ? "AAAA" : "A";
		let name = url.searchParams.get("name") ?? "";
		return HttpResponse.json({
			Status: 0,
			Answer: addresses[type].map((data) => ({
				name,
				type: type === "A" ? 1 : 28,
				TTL: 60,
				data,
			})),
		});
	});
}

describe("follow", () => {
	test("answers the final response whatever its status, with where the chain ended", async () => {
		server.use(
			http.get(
				"https://example.com/old",
				() => new HttpResponse(null, { status: 301, headers: { location: "/gone" } }),
			),
			http.get("https://example.com/gone", () => new HttpResponse("Gone", { status: 410 })),
		);

		let result = await follow("https://example.com/old");

		expect(isSuccess(result)).toBe(true);
		if (!isSuccess(result)) return;
		expect(result.data.response.status).toBe(410);
		expect(result.data.url.href).toBe("https://example.com/gone");
		expect(result.data.redirects).toBe(1);
	});

	test("refuses the first URL before any request", async () => {
		let result = await follow("http://169.254.169.254/latest/meta-data");
		expect(isFailure(result) && result.error.code).toBe("refused-address");
	});

	test("refuses a redirect into a private address before requesting it", async () => {
		server.use(
			http.get("https://example.com/hop", () => HttpResponse.redirect("http://127.0.0.1/", 302)),
		);

		let result = await follow("https://example.com/hop");

		expect(isFailure(result) && result.error.code).toBe("refused-address");
		expect(isFailure(result) && result.error.url).toBe("http://127.0.0.1/");
	});

	test("holds every hop to the caller's policy", async () => {
		server.use(
			http.get("https://example.com/port", () =>
				HttpResponse.redirect("https://example.com:8443/", 302),
			),
		);

		let result = await follow("https://example.com/port", { ports: "default" });

		expect(isFailure(result) && result.error.code).toBe("refused-port");
	});

	test("follows into a private host under hosts: any", async () => {
		server.use(
			http.get("https://example.com/in", () => HttpResponse.redirect("http://localhost/x", 302)),
			http.get("http://localhost/x", () => HttpResponse.text("inside")),
		);

		let result = await follow("https://example.com/in", { hosts: "any" });

		expect(isSuccess(result) && result.data.url.href).toBe("http://localhost/x");
	});

	test("stops a chain longer than the redirect limit", async () => {
		server.use(
			http.get("https://example.com/loop/:n", ({ params }) =>
				HttpResponse.redirect(`https://example.com/loop/${Number(params.n) + 1}`, 302),
			),
		);

		let result = await follow("https://example.com/loop/0", { maxRedirects: 2 });

		expect(isFailure(result) && result.error.code).toBe("too-many-redirects");
		expect(isFailure(result) && result.error.url).toBe("https://example.com/loop/0");
	});

	test("answers a redirect without a usable Location as the response", async () => {
		server.use(
			http.get("https://example.com/nowhere", () => new HttpResponse(null, { status: 302 })),
		);

		let result = await follow("https://example.com/nowhere");

		expect(isSuccess(result) && result.data.response.status).toBe(302);
	});

	test("sends the same headers on every hop", async () => {
		let seen: (string | null)[] = [];
		server.use(
			http.get("https://example.com/a", ({ request }) => {
				seen.push(request.headers.get("user-agent"));
				return HttpResponse.redirect("https://example.org/b", 302);
			}),
			http.get("https://example.org/b", ({ request }) => {
				seen.push(request.headers.get("user-agent"));
				return HttpResponse.text("ok");
			}),
		);

		await follow("https://example.com/a", { headers: { "user-agent": "Example/1.0" } });

		expect(seen).toEqual(["Example/1.0", "Example/1.0"]);
	});

	test("reports a rejected fetch as a retryable network failure", async () => {
		server.use(http.get("https://example.com/down", () => HttpResponse.error()));

		let result = await follow("https://example.com/down");

		expect(isFailure(result) && result.error.code).toBe("network");
		expect(isFailure(result) && result.error.retryable).toBe(true);
	});

	test("reports a chain that outlives the deadline as a timeout", async () => {
		server.use(
			http.get("https://example.com/slow", async () => {
				await delay(500);
				return HttpResponse.text("late");
			}),
		);

		let result = await follow("https://example.com/slow", { timeout: 50 });

		expect(isFailure(result) && result.error.code).toBe("timeout");
		expect(isFailure(result) && result.error.retryable).toBe(true);
	});

	test("holds the body read after the chain to the same deadline", async () => {
		server.use(
			http.get("https://example.com/drip", () => {
				let stream = new ReadableStream<Uint8Array>({
					async pull(controller) {
						await delay(40);
						controller.enqueue(new TextEncoder().encode("x"));
					},
				});
				return new HttpResponse(stream);
			}),
		);

		let followed = await follow("https://example.com/drip", { timeout: "150 milliseconds" });
		expect(isSuccess(followed)).toBe(true);
		if (!isSuccess(followed)) return;

		let started = Date.now();
		let read = await readText(followed.data.response, { maxBytes: 1024 });

		expect(isFailure(read) && read.error.code).toBe("timeout");
		expect(Date.now() - started).toBeLessThan(1_000);
	});

	test("combines the caller's signal with the deadline", async () => {
		server.use(
			http.get("https://example.com/held", async () => {
				await delay(500);
				return HttpResponse.text("late");
			}),
		);

		let controller = new AbortController();
		let pending = follow("https://example.com/held", {
			timeout: "1 minute",
			signal: controller.signal,
		});
		controller.abort();

		let result = await pending;
		expect(isFailure(result) && result.error.code).toBe("network");
	});

	describe("resolve", () => {
		test("refuses a name whose records point inside a network", async () => {
			server.use(dnsAnswer({ A: ["10.0.0.5"], AAAA: [] }));

			let result = await follow("https://rebind.example.com/", { resolve: true });

			expect(isFailure(result) && result.error.code).toBe("refused-address");
		});

		test("checks every hop's name, not only the first", async () => {
			server.use(
				http.get("https://cloudflare-dns.com/dns-query", ({ request }) => {
					let url = new URL(request.url);
					let name = url.searchParams.get("name");
					let asksA = url.searchParams.get("type") === "A";
					let data = name === "inside.example.org" ? "192.168.1.1" : "93.184.216.34";
					return HttpResponse.json({
						Status: 0,
						Answer: asksA ? [{ name, type: 1, TTL: 60, data }] : [],
					});
				}),
				http.get("https://example.com/hop", () =>
					HttpResponse.redirect("https://inside.example.org/", 302),
				),
			);

			let result = await follow("https://example.com/hop", { resolve: true });

			expect(isFailure(result) && result.error.code).toBe("refused-address");
			expect(isFailure(result) && result.error.url).toBe("https://inside.example.org/");
		});

		test("requests a name that resolves only to public addresses", async () => {
			server.use(
				dnsAnswer({ A: ["93.184.216.34"], AAAA: ["2606:2800:220:1:248:1893:25c8:1946"] }),
				http.get("https://example.com/", () => HttpResponse.text("ok")),
			);

			let result = await follow("https://example.com/", { resolve: true });

			expect(isSuccess(result) && result.data.response.status).toBe(200);
		});
	});
});
