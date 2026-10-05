/**
 * Drives `GET /media/:signature/:source` inside workerd, where the edge cache it writes to
 * exists, with the publishers standing behind MSW: what a reader's browser receives for an
 * image that is served, refused, too large, too slow, or redirected somewhere private.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createRouter } from "remix/router";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { MAX_IMAGE_BYTES, mediaUrl } from "~/app/lib/media";
import routes from "~/routes/web";

import media from "./media";

/** MSW server standing in for the publishers' image hosts. */
let server = setupServer();

let router = createRouter();
router.map(routes.media, media);

beforeAll(() => {
	/**
	 * CI's `.dev.vars` comes from `.env.example`, whose secret is empty and so signs
	 * nothing; every address in this file is minted and verified under this one instead.
	 */
	Object.assign(env, { MEDIA_PROXY_SECRET: "media-route-test-secret" });
	server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
	server.resetHandlers();
	vi.restoreAllMocks();
});
afterAll(() => server.close());

/**
 * An image address no other test uses. The edge cache outlives a test and answers a
 * repeated address from what an earlier test stored, so each test gets its own.
 */
function imageUrl(): string {
	return `https://${crypto.randomUUID()}.example.com/photo.png`;
}

/** Requests an image through the route, by the signed address this app mints for it. */
async function proxied(url: string): Promise<Response> {
	return router.fetch(new Request(new URL(await mediaUrl(url), "https://reader.test")));
}

/** A body that sends `first` straight away and closes only after `ms` milliseconds. */
function trickle(first: Uint8Array, ms: number): ReadableStream<Uint8Array> {
	return new ReadableStream<Uint8Array>({
		async start(controller) {
			controller.enqueue(first);
			await delay(ms);
			controller.close();
		},
	});
}

describe("the media route", () => {
	test("serves an image under its own type and a long cache lifetime", async () => {
		let url = imageUrl();
		server.use(
			http.get(url, () =>
				HttpResponse.arrayBuffer(new ArrayBuffer(16), {
					headers: { "content-type": "image/png" },
				}),
			),
		);

		let response = await proxied(url);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/png");
		expect(response.headers.get("cache-control")).toContain("immutable");
		expect((await response.arrayBuffer()).byteLength).toBe(16);
	});

	test("refuses an address this app did not sign", async () => {
		let response = await router.fetch(
			new Request(
				new URL(routes.media.href({ signature: "AAAA", source: "AAAA" }), "https://reader.test"),
			),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a redirect into a private address without following it", async () => {
		let url = imageUrl();
		let asked = 0;
		server.use(
			http.get(url, () => HttpResponse.redirect("http://169.254.169.254/latest/meta-data", 302)),
			http.all("http://169.254.169.254/*", () => {
				asked += 1;
				return new HttpResponse(null, { status: 200 });
			}),
		);

		let response = await proxied(url);

		expect(response.status).toBe(403);
		expect(asked).toBe(0);
	});

	test("answers 502 for an image past the size cap", async () => {
		let url = imageUrl();
		server.use(
			http.get(
				url,
				() =>
					new HttpResponse(trickle(new Uint8Array(MAX_IMAGE_BYTES + 1), 0), {
						headers: { "content-type": "image/png" },
					}),
			),
		);

		expect((await proxied(url)).status).toBe(502);
	});

	test("answers 403 for an origin that has not answered by the deadline", async () => {
		let timeout = AbortSignal.timeout.bind(AbortSignal);
		let deadline = vi.spyOn(AbortSignal, "timeout").mockImplementation(() => timeout(50));
		let url = imageUrl();
		server.use(
			http.get(url, async () => {
				await delay(1_000);
				return HttpResponse.arrayBuffer(new ArrayBuffer(4), {
					headers: { "content-type": "image/png" },
				});
			}),
		);

		expect((await proxied(url)).status).toBe(403);
		expect(deadline).toHaveBeenCalledWith(10_000);
	});

	test("answers 502 for a body still arriving at the deadline", async () => {
		let timeout = AbortSignal.timeout.bind(AbortSignal);
		vi.spyOn(AbortSignal, "timeout").mockImplementation(() => timeout(50));
		let url = imageUrl();
		server.use(
			http.get(
				url,
				() =>
					new HttpResponse(trickle(new Uint8Array(4), 1_000), {
						headers: { "content-type": "image/png" },
					}),
			),
		);

		expect((await proxied(url)).status).toBe(502);
	});
});
