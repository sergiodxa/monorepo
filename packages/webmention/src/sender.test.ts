/**
 * Exercises the sender: which links an entry notifies, the plan that keeps removed
 * links in the set, and delivery against mocked endpoints, refusals included.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { outboundLinks, plan, send } from "./sender.js";

import { WebmentionFetchError, WebmentionSendError } from "./index.js";

/** What every send in this file asks under. */
const AGENT = "ExampleSender/1.0 (+https://example.com/sender)";

/** The post doing the mentioning. */
const SOURCE = new URL("https://example.com/articles/hello");

/** The page it mentions. */
const TARGET = new URL("https://ada.example/notes/1");

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Serves the target page advertising `endpoint` in its `Link` header. */
function targetAdvertising(endpoint: string) {
	return http.get(
		TARGET.href,
		() => new HttpResponse(null, { headers: { Link: `<${endpoint}>; rel="webmention"` } }),
	);
}

describe("outboundLinks", () => {
	test("keeps other origins' links, resolved, once each, in document order", () => {
		let html = `<p>
			<a href="https://ada.example/notes/1">Ada</a>
			<a href="/articles/other">mine</a>
			<a href="https://example.com/about">mine too</a>
			<a href="//bob.example/post">Bob</a>
			<a href="https://ada.example/notes/1">Ada again</a>
			<a href="mailto:someone@ada.example">mail</a>
			<a href="#top">top</a>
			<img src="https://img.example/photo.jpg">
			<map><area href="https://carol.example/" alt=""></map>
		</p>`;

		expect(outboundLinks(html, SOURCE).map((url) => url.href)).toEqual([
			"https://ada.example/notes/1",
			"https://bob.example/post",
			"https://carol.example/",
		]);
	});

	test("answers nothing for empty content", () => {
		expect(outboundLinks("", SOURCE)).toEqual([]);
	});
});

describe("plan", () => {
	test("notifies current links and the ones removed since", () => {
		let a = new URL("https://a.example/");
		let b = new URL("https://b.example/");
		let c = new URL("https://c.example/");

		let { targets } = plan([a, b], [new URL("https://b.example/"), c]);

		expect(targets.map((url) => url.href)).toEqual([a.href, b.href, c.href]);
	});

	test("notifies every past target on delete", () => {
		let past = [new URL("https://a.example/"), new URL("https://b.example/")];
		expect(plan([], past).targets).toEqual(past);
	});
});

describe("send", () => {
	test("posts the pair to the discovered endpoint, keeping its query string", async () => {
		let received: { url: string; body: string; type: string | null } | null = null;
		server.use(
			targetAdvertising("/webmention?key=1"),
			http.post("https://ada.example/webmention", async ({ request }) => {
				received = {
					url: request.url,
					body: await request.text(),
					type: request.headers.get("content-type"),
				};
				return new HttpResponse(null, { status: 202 });
			}),
		);

		let result = await send({ source: SOURCE, target: TARGET }, { userAgent: AGENT });

		expect(isSuccess(result) && result.data).toEqual({
			status: "sent",
			endpoint: new URL("https://ada.example/webmention?key=1"),
			code: 202,
			location: null,
		});
		let params = new URLSearchParams(received!.body);
		expect(received!.url).toBe("https://ada.example/webmention?key=1");
		expect(received!.type).toContain("application/x-www-form-urlencoded");
		expect(params.get("source")).toBe(SOURCE.href);
		expect(params.get("target")).toBe(TARGET.href);
	});

	test("reports the status page a 201 names, absolute", async () => {
		server.use(
			targetAdvertising("https://ada.example/webmention"),
			http.post(
				"https://ada.example/webmention",
				() => new HttpResponse(null, { status: 201, headers: { Location: "/status/9" } }),
			),
		);

		let result = await send({ source: SOURCE, target: TARGET }, { userAgent: AGENT });

		expect(isSuccess(result) && result.data.status === "sent" && result.data.location).toBe(
			"https://ada.example/status/9",
		);
	});

	test("answers no-endpoint for a target advertising none", async () => {
		server.use(http.get(TARGET.href, () => HttpResponse.html("<p>No endpoint here.</p>")));

		let result = await send({ source: SOURCE, target: TARGET }, { userAgent: AGENT });

		expect(isSuccess(result) && result.data).toEqual({ status: "no-endpoint" });
	});

	test("reports an endpoint's refusal with its status", async () => {
		server.use(
			targetAdvertising("https://ada.example/webmention"),
			http.post("https://ada.example/webmention", () => new HttpResponse("no", { status: 400 })),
		);

		let result = await send({ source: SOURCE, target: TARGET }, { userAgent: AGENT });

		expect(isFailure(result) && result.error).toBeInstanceOf(WebmentionSendError);
		expect(isFailure(result) && (result.error as WebmentionSendError).status).toBe(400);
	});

	test("posts nothing to an endpoint on a private host", async () => {
		server.use(targetAdvertising("http://192.168.1.1/webmention"));

		let result = await send({ source: SOURCE, target: TARGET }, { userAgent: AGENT });

		expect(isFailure(result) && result.error).toBeInstanceOf(WebmentionFetchError);
		expect(isFailure(result) && (result.error as WebmentionFetchError).retryable).toBe(false);
	});

	test("reports an endpoint that never answers as retryable", async () => {
		server.use(
			targetAdvertising("https://ada.example/webmention"),
			http.post("https://ada.example/webmention", () => HttpResponse.error()),
		);

		let result = await send({ source: SOURCE, target: TARGET }, { userAgent: AGENT });

		expect(isFailure(result) && (result.error as WebmentionFetchError).retryable).toBe(true);
	});
});
