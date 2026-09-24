/**
 * Tests for the API client base class: paths resolve against the base URL, verb methods
 * set their own method, the `before`/`after` hooks see every request and response, and
 * every request carries the running invocation's trace unless a subclass narrows it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { runWithTrace, startTrace, toTraceParent } from "@sdxc/trace-context";
import { parse as parseTraceState } from "@sdxc/trace-context/tracestate";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { APIClient } from "./api-client.js";

let server = setupServer(
	http.all("https://api.example.com/*", ({ request }) => {
		return HttpResponse.json({ url: request.url, method: request.method });
	}),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Reads back what the stub observed, so assertions are about the request that was sent. */
async function sent(response: Response): Promise<{ url: string; method: string }> {
	return (await response.json()) as { url: string; method: string };
}

describe("APIClient", () => {
	test("resolves a path against the base URL", async () => {
		let client = new APIClient(new URL("https://api.example.com"));

		expect(await sent(await client.get("/subjects"))).toMatchObject({
			url: "https://api.example.com/subjects",
		});
	});

	test.each([
		["get", "GET"],
		["post", "POST"],
		["put", "PUT"],
		["patch", "PATCH"],
		["delete", "DELETE"],
	] as const)("sends %s as %s", async (verb, method) => {
		let client = new APIClient(new URL("https://api.example.com"));

		expect(await sent(await client[verb]("/thing"))).toMatchObject({ method });
	});

	test("lets a subclass add to every request from one place", async () => {
		class Authenticated extends APIClient {
			protected override async before(request: Request): Promise<Request> {
				request.headers.set("Authorization", "Bearer token");
				return request;
			}
		}

		server.use(
			http.all("https://api.example.com/*", ({ request }) => {
				return HttpResponse.json({ authorization: request.headers.get("Authorization") });
			}),
		);

		let response = await new Authenticated(new URL("https://api.example.com")).get("/thing");

		expect(await response.json()).toEqual({ authorization: "Bearer token" });
	});

	test("lets a subclass see the response and the request that produced it", async () => {
		let seen: string[] = [];

		class Observed extends APIClient {
			protected override async after(request: Request, response: Response): Promise<Response> {
				seen.push(`${request.method} ${new URL(request.url).pathname} -> ${response.status}`);
				return response;
			}
		}

		await new Observed(new URL("https://api.example.com")).post("/thing");

		expect(seen).toEqual(["POST /thing -> 200"]);
	});

	test("lets a subclass replace the response entirely", async () => {
		class Replacing extends APIClient {
			protected override async after(): Promise<Response> {
				return Response.json({ replaced: true });
			}
		}

		let response = await new Replacing(new URL("https://api.example.com")).get("/thing");

		expect(await response.json()).toEqual({ replaced: true });
	});
});

describe("APIClient trace propagation", () => {
	/** Answers with the trace headers the stub received. */
	function echoTraceHeaders() {
		server.use(
			http.all("https://api.example.com/*", ({ request }) => {
				return HttpResponse.json({
					traceparent: request.headers.get("traceparent"),
					tracestate: request.headers.get("tracestate"),
				});
			}),
		);
	}

	let trace = startTrace({ state: unwrap(parseTraceState("rojo=1")) });

	test("injects the current trace into every request", async () => {
		echoTraceHeaders();
		let client = new APIClient(new URL("https://api.example.com"));

		let response = await runWithTrace(trace, () => client.get("/thing"));

		expect(await response.json()).toEqual({
			traceparent: toTraceParent(trace),
			tracestate: "rojo=1",
		});
	});

	test("sends no trace headers outside an invocation", async () => {
		echoTraceHeaders();
		let response = await new APIClient(new URL("https://api.example.com")).get("/thing");

		expect(await response.json()).toEqual({ traceparent: null, tracestate: null });
	});

	test("injects before before(), so a subclass sees and can replace the headers", async () => {
		echoTraceHeaders();
		let seen: string | null = null;

		class Replacing extends APIClient {
			protected override async before(request: Request): Promise<Request> {
				seen = request.headers.get("traceparent");
				request.headers.delete("tracestate");
				return request;
			}
		}

		let response = await runWithTrace(trace, () =>
			new Replacing(new URL("https://api.example.com")).get("/thing"),
		);

		expect(seen).toBe(toTraceParent(trace));
		expect(await response.json()).toMatchObject({ tracestate: null });
	});

	test("keeps a traceparent the caller set in init", async () => {
		echoTraceHeaders();
		let own = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
		let client = new APIClient(new URL("https://api.example.com"));

		let response = await runWithTrace(trace, () =>
			client.get("/thing", { headers: { traceparent: own } }),
		);

		expect(await response.json()).toEqual({ traceparent: own, tracestate: null });
	});

	test("lets a subclass narrow propagation to traceparent or turn it off", async () => {
		echoTraceHeaders();

		class ParentOnly extends APIClient {
			protected override readonly propagateTrace = "traceparent";
		}

		class Untraced extends APIClient {
			protected override readonly propagateTrace = "none";
		}

		let parentOnly = await runWithTrace(trace, () =>
			new ParentOnly(new URL("https://api.example.com")).get("/thing"),
		);
		let untraced = await runWithTrace(trace, () =>
			new Untraced(new URL("https://api.example.com")).get("/thing"),
		);

		expect(await parentOnly.json()).toEqual({
			traceparent: toTraceParent(trace),
			tracestate: null,
		});
		expect(await untraced.json()).toEqual({ traceparent: null, tracestate: null });
	});
});
