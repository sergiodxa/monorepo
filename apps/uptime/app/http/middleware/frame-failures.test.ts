/**
 * Tests the frame-failure guard: a frame sub-request that throws, answers an error status, or
 * fails while its body streams answers a visible marker the renderer inlines, while a redirect,
 * a healthy fragment, and every request outside a frame pass through untouched.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestHandler } from "remix/router";

import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { frameFailures } from "./frame-failures";

/** One route answering with `handler`, behind the guard, requested as the renderer requests a frame. */
async function fetchFrame(handler: RequestHandler, frame = true) {
	let router = createRouter({ middleware: [frameFailures()] });
	router.get("/fragment", handler);

	let headers = new Headers({ accept: "text/html" });
	if (frame) headers.set("x-remix-frame", "true");

	return await router.fetch(new Request("https://uptime.test/fragment", { headers }));
}

/** An HTML body that delivers `chunk` and then errors, as a fragment failing mid-render does. */
function failingBody(chunk: string) {
	let sent = false;

	return new ReadableStream<Uint8Array>({
		pull(controller) {
			if (sent) return controller.error(new Error("body blew up"));
			sent = true;
			controller.enqueue(new TextEncoder().encode(chunk));
		},
	});
}

describe("frameFailures", () => {
	test("answers a thrown fragment with a 200 marker naming the error", async () => {
		let response = await fetchFrame(() => {
			throw new Error("fragment <blew> up");
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
		expect(await response.text()).toBe("<pre>Frame error: fragment &lt;blew&gt; up</pre>");
	});

	test("answers an error status with a marker naming the status", async () => {
		let response = await fetchFrame(
			() => new Response("<h1>Not Found</h1>", { status: 404, statusText: "Not Found" }),
		);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("<pre>Frame error: 404 Not Found</pre>");
	});

	test("ends a body that errors mid-stream with the marker", async () => {
		let response = await fetchFrame(
			() =>
				new Response(failingBody("<p>partial</p>"), { headers: { "content-type": "text/html" } }),
		);

		expect(await response.text()).toBe("<p>partial</p><pre>Frame error: body blew up</pre>");
	});

	test("passes a healthy fragment and a redirect through", async () => {
		let fragment = await fetchFrame(
			() => new Response("<p>ok</p>", { headers: { "content-type": "text/html" } }),
		);
		let redirect = await fetchFrame(
			() => new Response(null, { status: 302, headers: { location: "/login" } }),
		);

		expect(fragment.status).toBe(200);
		expect(await fragment.text()).toBe("<p>ok</p>");
		expect(redirect.status).toBe(302);
		expect(redirect.headers.get("location")).toBe("/login");
	});

	test("leaves a request outside a frame untouched", async () => {
		let response = await fetchFrame(
			() => new Response("missing", { status: 404, statusText: "Not Found" }),
			false,
		);

		expect(response.status).toBe(404);
		expect(await response.text()).toBe("missing");
	});
});
