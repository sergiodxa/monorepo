/**
 * Exercises the publisher half: the `Link` header a publisher advertises its hubs and topic
 * with (§4), and the `hub.mode=publish` ping public hubs accept when a topic changes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { links, publish, publishRequest } from "./publisher.js";

import { WebSubRequestError } from "./index.js";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** The hub every ping in this file goes to. */
const HUB = "https://hub.example.com/";

/** The feeds the publisher in this file serves. */
const FEEDS = ["https://blog.example.com/rss", "https://blog.example.com/articles.rss"];

describe(links, () => {
	test("writes every hub and the topic with quoted relations", () => {
		expect(links({ hubs: [HUB, "https://second.example.com/"], self: FEEDS[0] ?? "" })).toBe(
			`<${HUB}>; rel="hub", <https://second.example.com/>; rel="hub", <${FEEDS[0]}>; rel="self"`,
		);
	});

	test("writes only the topic when no hub is advertised", () => {
		expect(links({ hubs: [], self: "https://blog.example.com/rss" })).toBe(
			`<https://blog.example.com/rss>; rel="self"`,
		);
	});

	test("percent-encodes the characters that would end a target early", () => {
		expect(links({ hubs: [], self: "https://blog.example.com/a b>c" })).toBe(
			`<https://blog.example.com/a%20b%3Ec>; rel="self"`,
		);
	});
});

describe(publishRequest, () => {
	test("writes hub.mode=publish with one hub.url per topic", async () => {
		let request = unwrap(publishRequest(HUB, FEEDS));
		let form = new URLSearchParams(await request.text());

		expect(request.method).toBe("POST");
		expect(request.headers.get("content-type")).toBe("application/x-www-form-urlencoded");
		expect(form.get("hub.mode")).toBe("publish");
		expect(form.getAll("hub.url")).toEqual(FEEDS);
	});

	test("accepts a single topic as a string", async () => {
		let form = new URLSearchParams(await unwrap(publishRequest(HUB, FEEDS[0] ?? "")).text());
		expect(form.getAll("hub.url")).toEqual([FEEDS[0]]);
	});

	test("refuses a hub that is not an absolute URL, and a ping with no topic", () => {
		let refused = publishRequest("/hub", FEEDS);
		expect(isFailure(refused) && refused.error).toBeInstanceOf(WebSubRequestError);
		expect(isFailure(publishRequest(HUB, []))).toBe(true);
	});
});

describe(publish, () => {
	test("pings the hub for several topics and succeeds on any 2xx", async () => {
		let pinged: string[] = [];
		server.use(
			http.post(HUB, async ({ request }) => {
				pinged = new URLSearchParams(await request.text()).getAll("hub.url");
				return new HttpResponse(null, { status: 204 });
			}),
		);

		expect(isSuccess(await publish(HUB, FEEDS))).toBe(true);
		expect(pinged).toEqual(FEEDS);
	});

	test("reports a hub's refusal with its status", async () => {
		server.use(http.post(HUB, () => new HttpResponse("bad topic", { status: 400 })));

		let result = await publish(HUB, FEEDS);
		expect(isFailure(result) && result.error.status).toBe(400);
	});

	test("reports an unreachable hub with no status", async () => {
		server.use(http.post(HUB, () => HttpResponse.error()));

		let result = await publish(HUB, FEEDS);
		expect(isFailure(result) && result.error.status).toBeNull();
	});
});
