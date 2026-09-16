/**
 * The media proxy's own rules: minting the signed address a remote image is reached
 * through, verifying one that comes back, deciding which addresses this app is willing to
 * retrieve, and rewriting a sanitized body so every image in it points here.
 *
 * A reader's browser talks to one origin while they read. The publisher learns that one
 * server fetched an image — a hit count — and nothing about who asked for it, which is the
 * whole of what this buys and the reason every bound below is worth paying for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Base64Url, hmac, timingSafeEqual } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import { env } from "cloudflare:workers";

import routes from "~/routes/web";

/**
 * How much of the MAC the address carries. Sixteen bytes is more work to forge than
 * anybody will do for one image fetch, and it keeps the path short enough that a page of
 * images is not mostly signatures.
 */
const SIGNATURE_BYTES = 16;

/** The schemes an image may be retrieved over, which are the two a browser would have used. */
const FETCHABLE_SCHEMES = new Set(["http:", "https:"]);

/** The port each scheme may name, so a signed URL cannot reach a service on some other one. */
const DEFAULT_PORTS: Record<string, string> = { "http:": "80", "https:": "443" };

/** How many hops a redirect chain may take before it is treated as somewhere not to go. */
export const MAX_REDIRECTS = 3;

/**
 * The most an image may weigh. Past this the response is something other than an image for
 * a reading page, and reading it to the end would spend memory on a stranger's choice.
 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * The types this app re-serves, named rather than echoed: a `Content-Type` copied from a
 * stranger's response is a stranger deciding how the reader's browser reads the bytes.
 */
export const SERVED_TYPES = new Set([
	"image/avif",
	"image/gif",
	"image/jpeg",
	"image/png",
	"image/webp",
]);

/**
 * Where a proxied image is held. The edge cache and nothing else: keeping a copy of the
 * internet's images in a store of this app's own would cost roughly a hundred times the
 * fetch it saves, for a second copy of what the colo already holds.
 */
export const MEDIA_CACHE = "media";

/** How long a proxied image is held, by the edge and by the browser that asked for it. */
export const MEDIA_CACHE_CONTROL = "public, max-age=604800, immutable";

/** What this app calls itself when it fetches an image, which names the product and nothing else. */
export const MEDIA_USER_AGENT = "SergioReader/1.0 (+https://reader.sergiodxa.com)";

/** An IPv4 address written out, which is the only form a host check can read a range off. */
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u;

/** The secret the signature is taken under, whose rotation is this route's revocation. */
function secret(): string {
	return env.MEDIA_PROXY_SECRET;
}

/** The first {@link SIGNATURE_BYTES} of the MAC over an encoded source, base64url'd. */
async function signatureFor(source: string): Promise<string | null> {
	let mac = await hmac.sign(secret(), source);
	if (isFailure(mac)) return null;
	return Base64Url.encode(mac.data.slice(0, SIGNATURE_BYTES));
}

/**
 * The address a remote image is reached at through this app.
 *
 * Without the signature this route would be an open proxy: anybody could hand it any URL
 * and spend this app's address and egress on whatever they liked, which is the single risk
 * deciding whether the route may exist at all. There is no expiry — an expiring address
 * breaks an image on a page rendered a moment ago, and replaying a valid one re-fetches an
 * image this app chose to fetch.
 *
 * @param url - The image's absolute address, as the publisher's markup gave it.
 * @returns The proxy path, or the address itself when the MAC could not be taken.
 * @example <img src={await mediaUrl("https://cdn.example/a.png")} />
 */
export async function mediaUrl(url: string): Promise<string> {
	let source = Base64Url.encode(url);
	let signature = await signatureFor(source);
	if (signature === null) return url;

	return routes.media.href({ signature, source });
}

/**
 * The absolute address a signed pair names, or `null` for a pair this app did not mint.
 *
 * The comparison is constant-time and the decode runs first, so a truncated, absent or
 * simply wrong signature all fail the same way and in the same time.
 *
 * @param signature - The base64url MAC the address carried.
 * @param source - The base64url of the image's absolute address.
 */
export async function verifiedSource(signature: string, source: string): Promise<string | null> {
	let offered = Base64Url.decode(signature);
	if (isFailure(offered)) return null;

	let mac = await hmac.sign(secret(), source);
	if (isFailure(mac)) return null;

	if (offered.data.length !== SIGNATURE_BYTES) return null;
	if (!timingSafeEqual(mac.data.slice(0, SIGNATURE_BYTES), offered.data)) return null;

	let decoded = Base64Url.decode(source);
	if (isFailure(decoded)) return null;

	return new TextDecoder().decode(decoded.data);
}

/**
 * Reports whether an IPv4 literal names a range that belongs to whoever is asking rather
 * than to the internet: this Worker's own loopback, a private network, the link-local
 * block a cloud metadata service lives in, and the reserved ranges around them.
 */
function isPrivateIpv4(host: string): boolean {
	let match = IPV4.exec(host);
	if (match === null) return false;

	let parts = match.slice(1).map((part) => Number.parseInt(part, 10));
	if (parts.some((part) => !Number.isFinite(part) || part > 255)) return true;

	let [a = 0, b = 0] = parts;

	if (a === 0 || a === 10 || a === 127) return true;
	if (a === 169 && b === 254) return true;
	if (a === 172 && b >= 16 && b <= 31) return true;
	if (a === 192 && b === 168) return true;
	if (a === 100 && b >= 64 && b <= 127) return true;
	if (a === 192 && b === 0) return true;
	if (a === 198 && (b === 18 || b === 19)) return true;
	if (a >= 224) return true;

	return false;
}

/**
 * Reports whether an IPv6 literal names loopback, a link-local address or a unique-local
 * one. A bracketed host is how a URL spells IPv6, and an embedded IPv4 address is read as
 * the IPv4 address it is.
 */
function isPrivateIpv6(host: string): boolean {
	if (!host.startsWith("[") || !host.endsWith("]")) return false;

	let address = host.slice(1, -1).toLowerCase();
	if (address === "::1" || address === "::") return true;

	let embedded = address.split(":").at(-1) ?? "";
	if (IPV4.test(embedded) && isPrivateIpv4(embedded)) return true;

	let head = address.split(":").at(0) ?? "";
	if (/^fe[89ab]/u.test(head)) return true;
	if (/^f[cd]/u.test(head)) return true;

	return address.startsWith("::ffff:");
}

/**
 * Whether this app is willing to retrieve an address: an ordinary web scheme, on that
 * scheme's own port, at a host that is not an address of ours written as a literal.
 *
 * Pinning what a name resolves to is not something a Worker can do, so this does not
 * defeat DNS rebinding on its own. What holds is architectural: this Worker reaches its
 * own storage through bindings rather than URLs, so a request that escapes here reaches
 * the public internet and nothing of this app's.
 *
 * @param url - The address about to be fetched, on the first hop or on any later one.
 */
export function isRetrievable(url: URL): boolean {
	if (!FETCHABLE_SCHEMES.has(url.protocol)) return false;
	if (url.port !== "" && url.port !== DEFAULT_PORTS[url.protocol]) return false;

	let host = url.hostname.toLowerCase();
	if (host.length === 0) return false;
	if (isPrivateIpv4(host)) return false;
	if (isPrivateIpv6(host)) return false;

	return host !== "localhost" && !host.endsWith(".localhost");
}

/** The host an event names, which is a CDN rather than the article an address would identify. */
export function hostOf(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return "";
	}
}

/** Every `src` a sanitized body carries, in the order the markup wrote them. */
const IMAGE_SOURCE = /(<img\b[^>]*?\ssrc=")([^"]*)(")/giu;

/**
 * Rewrites every image in a sanitized body to the address it is reached at through this
 * app, so a rendered article makes no request to any host but this one.
 *
 * It runs over markup the sanitizer produced, where every `src` is already an absolute
 * `http:` or `https:` URL emitted with its quotes escaped, which is what lets the rewrite
 * read the attribute without parsing the document a second time.
 *
 * @param html - The sanitized body, as the extractor answered with it.
 * @example await proxyImages(article.html);
 */
export async function proxyImages(html: string): Promise<string> {
	let sources = [...html.matchAll(IMAGE_SOURCE)].map((match) => match[2] ?? "");
	if (sources.length === 0) return html;

	let proxied = new Map<string, string>();
	for (let source of new Set(sources)) {
		proxied.set(source, await mediaUrl(decodeEntities(source)));
	}

	return html.replaceAll(IMAGE_SOURCE, (_, open: string, source: string, close: string) => {
		return `${open}${proxied.get(source) ?? source}${close}`;
	});
}

/** Reads back the three entities the serializer writes into an attribute value. */
function decodeEntities(value: string): string {
	return value
		.replaceAll("&quot;", `"`)
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.replaceAll("&amp;", "&");
}

/**
 * The address a publisher's own mark is reached at, or `null` for a feed that publishes
 * none, so a rail drawn from a cache asks this app for its icons like everything else.
 *
 * @param url - The image the feed named, as the catalog stored it.
 */
export async function proxiedImage(url: string | null): Promise<string | null> {
	if (url === null) return null;
	if (!URL.canParse(url)) return null;

	let parsed = new URL(url);
	if (!FETCHABLE_SCHEMES.has(parsed.protocol)) return null;

	return await mediaUrl(parsed.href);
}

/**
 * Reads a response body to the end, refusing one that passes {@link MAX_IMAGE_BYTES}
 * rather than holding it. A stream rather than `arrayBuffer()`, so a declared length of
 * one kilobyte followed by a gigabyte of bytes is refused at the cap rather than at the
 * end.
 *
 * @param body - The response's stream, which is cancelled when the cap is reached.
 * @returns The bytes, or `null` for a body that ran past the cap.
 */
export async function readWithin(
	body: ReadableStream<Uint8Array> | null,
): Promise<Uint8Array<ArrayBuffer> | null> {
	if (body === null) return null;

	let reader = body.getReader();
	let chunks: Uint8Array[] = [];
	let total = 0;

	while (true) {
		let { done, value } = await reader.read();
		if (done) break;
		if (value === undefined) continue;

		total += value.byteLength;
		if (total > MAX_IMAGE_BYTES) {
			await reader.cancel();
			return null;
		}

		chunks.push(value);
	}

	let bytes = new Uint8Array(new ArrayBuffer(total));
	let at = 0;
	for (let chunk of chunks) {
		bytes.set(chunk, at);
		at += chunk.byteLength;
	}

	return bytes;
}

/**
 * The type this app will re-serve a response as, or `null` for a response that is not an
 * image it is willing to hand a reader. `image/svg+xml` is refused however it is declared:
 * an SVG is a script document a browser will run when it is named as an image.
 *
 * @param response - The publisher's response, read for its declared type alone.
 */
export function servedType(response: Response): string | null {
	let declared = (response.headers.get("content-type") ?? "")
		.split(";")
		.at(0)
		?.trim()
		.toLowerCase();
	if (declared === undefined) return null;
	return SERVED_TYPES.has(declared) ? declared : null;
}

/**
 * Retrieves an image, following redirects by hand so every hop is checked the way the
 * first one was, carrying no cookie, no referrer and a user agent naming this product.
 *
 * @param url - The verified address the signature named.
 * @returns The final response, or `null` when a hop refused the checks or the chain ran on.
 */
export async function retrieveImage(url: string): Promise<Response | null> {
	let current: URL;
	try {
		current = new URL(url);
	} catch {
		return null;
	}

	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		if (!isRetrievable(current)) return null;

		let response = await fetch(current, {
			redirect: "manual",
			headers: { accept: "image/*", "user-agent": MEDIA_USER_AGENT },
		});

		let location = response.headers.get("location");
		if (response.status < 300 || response.status >= 400 || location === null) return response;

		try {
			current = new URL(location, current);
		} catch {
			return null;
		}
	}

	return null;
}
