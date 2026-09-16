/**
 * Checks the rules the media proxy stands on: that only an address this app signed is
 * retrieved, that the addresses it refuses are the ones that would reach somebody's own
 * network, that a redirect chain is bounded and re-checked at every hop, and that what
 * goes out carries nothing about the reader.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Base64Url } from "@sdxc/crypto";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import {
	hostOf,
	isRetrievable,
	MAX_IMAGE_BYTES,
	mediaUrl,
	proxyImages,
	readWithin,
	retrieveImage,
	servedType,
	verifiedSource,
} from "~/app/lib/media";

/** One image's address, which is what every signed pair in here is taken over. */
const IMAGE = "https://cdn.example/photo.png";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

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
		["a name resolving to this machine", "http://localhost/a.png"],
		["a non-standard port", "https://cdn.example:8080/a.png"],
		["a plaintext port on a secure scheme", "https://cdn.example:80/a.png"],
	])("refuses %s", (_label, url) => {
		expect(isRetrievable(new URL(url))).toBe(false);
	});

	test.each(["file:///etc/passwd", "ftp://cdn.example/a.png", "data:image/png;base64,AA"])(
		"refuses the scheme in %s",
		(url) => {
			expect(isRetrievable(new URL(url))).toBe(false);
		},
	);

	test.each([
		"https://cdn.example/a.png",
		"https://cdn.example:443/a.png",
		"http://cdn.example:80/a.png",
		"https://203.0.113.10/a.png",
	])("retrieves %s", (url) => {
		expect(isRetrievable(new URL(url))).toBe(true);
	});
});

describe("retrieving an image", () => {
	test("sends no cookie, no referrer and a user agent naming the product", async () => {
		let seen: Headers | null = null;

		server.use(
			http.get(IMAGE, ({ request }) => {
				seen = request.headers;
				return HttpResponse.arrayBuffer(new ArrayBuffer(4), {
					headers: { "content-type": "image/png" },
				});
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
			http.get(IMAGE, () => HttpResponse.redirect("https://cdn2.example/photo.png", 302)),
			http.get("https://cdn2.example/photo.png", () =>
				HttpResponse.arrayBuffer(new ArrayBuffer(4), {
					headers: { "content-type": "image/png" },
				}),
			),
		);

		let response = await retrieveImage(IMAGE);

		expect(response?.ok).toBe(true);
		expect(servedType(response as Response)).toBe("image/png");
	});

	test("refuses a redirect aimed at a private address", async () => {
		server.use(
			http.get(IMAGE, () => HttpResponse.redirect("http://169.254.169.254/latest/meta-data", 302)),
		);

		expect(await retrieveImage(IMAGE)).toBeNull();
	});

	test("refuses a chain that runs past three hops", async () => {
		for (let hop of [0, 1, 2, 3, 4]) {
			server.use(
				http.get(`https://cdn.example/hop-${hop}.png`, () =>
					HttpResponse.redirect(`https://cdn.example/hop-${hop + 1}.png`, 302),
				),
			);
		}

		expect(await retrieveImage("https://cdn.example/hop-0.png")).toBeNull();
	});

	test("refuses to fetch an address it would not retrieve at all", async () => {
		expect(await retrieveImage("file:///etc/passwd")).toBeNull();
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

	test("reads a body inside the cap and refuses one past it", async () => {
		let inside = new Response(new Uint8Array(new ArrayBuffer(32)));
		expect((await readWithin(inside.body))?.byteLength).toBe(32);

		let past = new Response(new Uint8Array(new ArrayBuffer(MAX_IMAGE_BYTES + 1)));
		expect(await readWithin(past.body)).toBeNull();
	});
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
