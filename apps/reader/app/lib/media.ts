/**
 * The media proxy's own rules: minting the signed address a remote image is reached
 * through, verifying one that comes back, retrieving it within a deadline and a size cap,
 * and rewriting a sanitized body so every image in it points here.
 *
 * A reader's browser talks to one origin while they read. The publisher learns that one
 * server fetched an image — a hit count — and nothing about who asked for it, which is the
 * whole of what this buys and the reason every bound below is worth paying for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Base64Url, hmac, timingSafeEqual } from "@sdxc/crypto";
import { follow, limitBody } from "@sdxc/outbound";
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

/** How many hops a redirect chain may take before it is treated as somewhere not to go. */
export const MAX_REDIRECTS = 3;

/**
 * The most an image may weigh. Past this the response is something other than an image for
 * a reading page, and reading it to the end would spend memory on a stranger's choice.
 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * How long one image may take, the redirect chain and its body together. An origin that
 * answers slower than this is holding a reader's request open, and the page they are
 * reading is better served by a missing image than by a stalled one.
 */
const IMAGE_TIMEOUT = "10 seconds";

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
 * Retrieves an image as an anonymous visitor, from a public address on its scheme's own
 * port, re-checking every redirect; the body carries the deadline and errors past the cap.
 * A name that rebinds past the check still reaches nothing of this app's, held in bindings.
 *
 * @param url - The verified address the signature named.
 * @returns The final response whatever its status, or `null` when a hop was refused, the
 * chain ran on, the deadline passed before an answer, or the origin could not be reached.
 */
export async function retrieveImage(url: string): Promise<Response | null> {
	let followed = await follow(url, {
		headers: { accept: "image/*", "user-agent": MEDIA_USER_AGENT },
		timeout: IMAGE_TIMEOUT,
		ports: "default",
		maxRedirects: MAX_REDIRECTS,
	});
	if (isFailure(followed)) return null;

	return limitBody(followed.data.response, { maxBytes: MAX_IMAGE_BYTES });
}
