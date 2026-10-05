/**
 * Checks the rules the media proxy stands on: that only an address this app signed is
 * retrieved, that the addresses it refuses are the ones that would reach somebody's own
 * network, that a redirect chain, the wait and the body are bounded, and that what goes
 * out carries nothing about the reader.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Base64Url } from "@sdxc/crypto";
import { readBytes } from "@sdxc/outbound";
import { isFailure } from "@sdxc/result";
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import {
	hostOf,
	MAX_IMAGE_BYTES,
	mediaUrl,
	proxyImages,
	retrieveImage,
	servedType,
	verifiedSource,
} from "~/app/lib/media";

/** One image's address, which is what every signed pair in here is taken over. */
const IMAGE = "https://cdn.example.com/photo.png";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
	server.resetHandlers();
	vi.restoreAllMocks();
});
afterAll(() => server.close());

/** A small PNG-typed answer, which is all a retrieval needs to see to call it an image. */
function image(bytes = 4): Response {
	return HttpResponse.arrayBuffer(new ArrayBuffer(bytes), {
		headers: { "content-type": "image/png" },
	});
}

/**
 * Shortens the ten-second deadline to `ms` while recording what it was asked for, so a
 * test both waits briefly and proves the deadline the proxy set.
 */
function shortenDeadline(ms: number) {
	let timeout = AbortSignal.timeout.bind(AbortSignal);
	return vi.spyOn(AbortSignal, "timeout").mockImplementation(() => timeout(ms));
}

/** The two segments a proxied address carries, read back off the path this app built. */
function pairOf(path: string): { signature: string; source: string } {
	let [, , signature = "", source = ""] = path.split("/");
	return { signature, source };
}

describe("signed addresses", () => {
	test("resolves an address this app minted back to the image it names", async () => {
		let { signature, source } = pairOf(await mediaUrl(IMAGE));

		expect(await verifiedSource(signature, source)).toBe(IMAGE);
	});

	test.each([
		["a wrong signature", (signature: string) => `${signature.slice(0, -2)}xy`],
		["an absent signature", () => ""],
		["a truncated signature", (signature: string) => signature.slice(0, 8)],
		["a signature that is not base64url", () => "not a signature"],
	])("refuses %s", async (_label, mangle) => {
		let { signature, source } = pairOf(await mediaUrl(IMAGE));

		expect(await verifiedSource(mangle(signature), source)).toBeNull();
	});

	test("refuses a source swapped under a signature taken over another one", async () => {
		let { signature } = pairOf(await mediaUrl(IMAGE));
		let other = Base64Url.encode("https://evil.example/anything.png");

		expect(await verifiedSource(signature, other)).toBeNull();
	});
});

describe("addresses this app will retrieve", () => {
	test.each([
		["a loopback literal", "http://127.0.0.1/a.png"],
		["the unspecified address", "http://0.0.0.0/a.png"],
		["a private range", "http://10.1.2.3/a.png"],
		["the other private range", "http://192.168.1.1/a.png"],
		["the carrier-grade range", "http://100.70.0.1/a.png"],
		["a link-local address", "http://169.254.169.254/latest/meta-data"],
		["IPv6 loopback", "http://[::1]/a.png"],
		["a unique-local address", "http://[fd00::1]/a.png"],
		["an IPv6 link-local address", "http://[fe80::1]/a.png"],
		["a documentation address", "http://203.0.113.10/a.png"],
		["an IPv6 documentation address", "http://[2001:db8::1]/a.png"],
		["a NAT64 address carrying a private one", "http://[64:ff9b::a00:1]/a.png"],
		["a Teredo address", "http://[2001::1]/a.png"],
		["an IPv4-mapped private address", "http://[::ffff:10.0.0.1]/a.png"],
		["a name resolving to this machine", "http://localhost/a.png"],
		["a single-label name", "http://intranet/a.png"],
		["a name on the local network", "http://printer.local/a.png"],
		["an internal name", "http://metadata.internal/a.png"],
		["a URL carrying credentials", "https://user:pass@cdn.example.com/a.png"],
		["a non-standard port", "https://cdn.example.com:8080/a.png"],
		["a plaintext port on a secure scheme", "https://cdn.example.com:80/a.png"],
		["the file scheme", "file:///etc/passwd"],
		["the FTP scheme", "ftp://cdn.example.com/a.png"],
		["a data URL", "data:image/png;base64,AA"],
		["text that is no URL", "not a url"],
	])("refuses %s without asking it", async (_label, url) => {
		let asked = 0;
		server.use(
			http.all("*", () => {
				asked += 1;
				return image();
			}),
		);

		expect(await retrieveImage(url)).toBeNull();
		expect(asked).toBe(0);
	});

	test.each([
		"https://cdn.example.com/a.png",
		"https://cdn.example.com:443/a.png",
		"http://cdn.example.com:80/a.png",
		"https://93.184.216.34/a.png",
		"https://[2606:4700:4700::1111]/a.png",
	])("retrieves %s", async (url) => {
		server.use(http.get("*", () => image()));

		expect((await retrieveImage(url))?.ok).toBe(true);
	});
});

describe("retrieving an image", () => {
	test("sends no cookie, no referrer and a user agent naming the product", async () => {
		let seen: Headers | null = null;

		server.use(
			http.get(IMAGE, ({ request }) => {
				seen = request.headers;
				return image();
			}),
		);

		await retrieveImage(IMAGE);

		expect(seen).not.toBeNull();
		expect((seen as unknown as Headers).get("cookie")).toBeNull();
		expect((seen as unknown as Headers).get("referer")).toBeNull();
		expect((seen as unknown as Headers).get("user-agent")).toContain("SergioReader");
	});

	test("follows a redirect and answers with what the last hop served", async () => {
		server.use(
			http.get(IMAGE, () => HttpResponse.redirect("https://cdn2.example.com/photo.png", 302)),
			http.get("https://cdn2.example.com/photo.png", () => image()),
		);

		let response = await retrieveImage(IMAGE);

		expect(response?.ok).toBe(true);
		expect(servedType(response as Response)).toBe("image/png");
	});

	test.each([
		["a private address", "http://169.254.169.254/latest/meta-data"],
		["a name on the local network", "http://router.local/a.png"],
		["a non-standard port", "https://cdn2.example.com:8443/a.png"],
	])("refuses a redirect aimed at %s", async (_label, target) => {
		let asked = 0;
		server.use(
			http.get(IMAGE, () => HttpResponse.redirect(target, 302)),
			http.all("*", () => {
				asked += 1;
				return image();
			}),
		);

		expect(await retrieveImage(IMAGE)).toBeNull();
		expect(asked).toBe(0);
	});

	test("refuses a chain that runs past three hops", async () => {
		for (let hop of [0, 1, 2, 3, 4]) {
			server.use(
				http.get(`https://cdn.example.com/hop-${hop}.png`, () =>
					HttpResponse.redirect(`https://cdn.example.com/hop-${hop + 1}.png`, 302),
				),
			);
		}

		expect(await retrieveImage("https://cdn.example.com/hop-0.png")).toBeNull();
	});

	test("waits ten seconds for an origin and answers null once they pass", async () => {
		let deadline = shortenDeadline(50);
		server.use(
			http.get(IMAGE, async () => {
				await delay(1_000);
				return image();
			}),
		);

		expect(await retrieveImage(IMAGE)).toBeNull();
		expect(deadline).toHaveBeenCalledWith(10_000);
	});

	test("holds a body that is still arriving to the same deadline", async () => {
		shortenDeadline(50);
		server.use(
			http.get(IMAGE, () => {
				let stream = new ReadableStream<Uint8Array>({
					async start(controller) {
						controller.enqueue(new Uint8Array(4));
						await delay(1_000);
						controller.close();
					},
				});
				return new HttpResponse(stream, { headers: { "content-type": "image/png" } });
			}),
		);

		let response = await retrieveImage(IMAGE);
		expect(response?.ok).toBe(true);

		let read = await readBytes(response as Response, { maxBytes: MAX_IMAGE_BYTES });
		expect(isFailure(read) && read.error.code).toBe("timeout");
	});

	test("errors a body that runs past the cap", async () => {
		server.use(
			http.get(IMAGE, () => {
				let stream = new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(new Uint8Array(MAX_IMAGE_BYTES));
						controller.enqueue(new Uint8Array(1));
						controller.close();
					},
				});
				return new HttpResponse(stream, { headers: { "content-type": "image/png" } });
			}),
		);

		let response = await retrieveImage(IMAGE);

		await expect((response as Response).arrayBuffer()).rejects.toMatchObject({
			code: "too-large",
		});
	});

	test("errors a body that declares a length past the cap before reading any of it", async () => {
		server.use(
			http.get(IMAGE, () =>
				HttpResponse.arrayBuffer(new ArrayBuffer(8), {
					headers: {
						"content-type": "image/png",
						"content-length": String(MAX_IMAGE_BYTES + 1),
					},
				}),
			),
		);

		let response = await retrieveImage(IMAGE);

		await expect((response as Response).arrayBuffer()).rejects.toMatchObject({
			code: "too-large",
		});
	});
});

describe("what is served back", () => {
	test.each([
		["image/svg+xml", "an SVG, which is a script document an image tag will name as an image"],
		["text/html", "a page"],
		["application/octet-stream", "bytes of no declared kind"],
	])("refuses %s (%s)", (type) => {
		let response = new Response(null, { headers: { "content-type": type } });

		expect(servedType(response)).toBeNull();
	});

	test.each(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"])(
		"serves %s back under its own name",
		(type) => {
			let response = new Response(null, { headers: { "content-type": `${type}; charset=x` } });

			expect(servedType(response)).toBe(type);
		},
	);
});

describe("rewriting a body", () => {
	test("points every image in a sanitized body at this app", async () => {
		let html = `<p>a</p><img src="https://cdn.example/a.png" alt="a"><img src="https://cdn.example/b.png" alt="b">`;

		let rewritten = await proxyImages(html);

		expect(rewritten).not.toContain("cdn.example");
		expect([...rewritten.matchAll(/src="\/media\//gu)]).toHaveLength(2);
		expect(rewritten).toContain(`alt="a"`);
	});

	test("leaves a body carrying no image exactly as it was", async () => {
		expect(await proxyImages(`<p>a</p>`)).toBe(`<p>a</p>`);
	});
});

describe("what an event may name", () => {
	test("names the host rather than the address that identifies an article", () => {
		expect(hostOf("https://cdn.example/posts/secret-diagnosis/figure-1.png")).toBe("cdn.example");
	});
});
