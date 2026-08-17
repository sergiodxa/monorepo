/**
 * Tests for the API client base class: paths resolve against the base URL, verb methods
 * set their own method, and the `before`/`after` hooks see every request and response.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { APIClient } from "./api-client";

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
