/**
 * Resolves the connecting client's IP address from whichever header the platform
 * in front of the app sets, parsed into an `IP` so a forged, conflicting or
 * malformed header never becomes a rate limit key or a stored address.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { IP } from "@sdxc/ip";
import { isSuccess } from "@sdxc/result";

/**
 * Headers that hosting platforms and proxies set to the connecting client's
 * address, each carrying exactly one address (CloudFront's with a port).
 */
export const CLIENT_IP_HEADERS = Object.freeze([
	"CF-Connecting-IP",
	"Fly-Client-IP",
	"Fastly-Client-IP",
	"True-Client-IP",
	"X-Azure-ClientIP",
	"DO-Connecting-IP",
	"Oxygen-Buyer-IP",
	"X-Nf-Client-Connection-IP",
	"X-AppEngine-User-IP",
	"CloudFront-Viewer-Address",
	"X-Envoy-External-Address",
	"X-Real-IP",
	"X-Client-IP",
	"X-Cluster-Client-IP",
] as const);

/**
 * Headers every proxy appends to, read from the right because the entries on
 * the left are whatever the client wrote.
 */
export const FORWARDED_HEADERS = Object.freeze([
	"Forwarded",
	"X-Forwarded-For",
	"X-Vercel-Forwarded-For",
] as const);

/**
 * Returns the client's address from the header the platform set. On Cloudflare
 * Workers, whose runtime marks the request with `cf`, only `CF-Connecting-IP`
 * counts. Elsewhere every header in `CLIENT_IP_HEADERS` the request carries must
 * name the same address, and only without any of them does the last entry of
 * `Forwarded` or `X-Forwarded-For` answer. A conflict, a malformed value or no
 * header at all answers `null`, so a client adding its own header can never pick
 * an address, only lose its own.
 *
 * @param source - The incoming request, or its headers.
 * @returns The parsed address, or `null` when no single address can be trusted.
 * @example
 * let key = getClientIP(request)?.network({ v4: 32, v6: 64 }).toString() ?? "unknown";
 */
export function getClientIP(source: Request | Headers): IP | null {
	if (source instanceof Request && "cf" in source && source.cf) {
		return parse(source.headers.get("CF-Connecting-IP"));
	}
	let headers = source instanceof Request ? source.headers : source;
	let direct = agreed(CLIENT_IP_HEADERS.map((name) => singleAddress(headers, name)));
	if (direct !== undefined) return direct;
	let forwarded = agreed(
		FORWARDED_HEADERS.map((name) =>
			lastEntry(headers.get(name), name === "Forwarded" ? forwardedFor : (entry) => entry),
		),
	);
	return forwarded ?? null;
}

/**
 * Reads a single-address header. `CloudFront-Viewer-Address` always ends in the
 * viewer's port, after an unbracketed IPv6 address too, so its last colon
 * group is dropped.
 */
function singleAddress(headers: Headers, name: string): string | null {
	let value = headers.get(name);
	if (value === null || name !== "CloudFront-Viewer-Address") return value;
	let match = /^(.+):\d{1,5}$/.exec(value);
	return match?.[1] ?? "";
}

/**
 * Answers the one address every present value names, `null` when they disagree
 * or one is malformed, and `undefined` when no value is present.
 */
function agreed(values: (string | null)[]): IP | null | undefined {
	let found: IP | undefined;
	for (let value of values) {
		if (value === null) continue;
		let ip = parse(value);
		if (ip === null || (found && !found.equals(ip))) return null;
		found = ip;
	}
	return found;
}

/**
 * Reads the address the nearest proxy appended to a list header, port dropped.
 * The list is split on every comma, so a quote a client opens in its own entry
 * cannot reach across into the proxy's.
 */
function lastEntry(value: string | null, read: (entry: string) => string | null): string | null {
	if (value === null) return null;
	let address = read(value.slice(value.lastIndexOf(",") + 1));
	return address === null ? "" : withoutPort(address.trim());
}

/** Parses text into an `IP`, answering `null` for anything that is not exactly one address. */
function parse(text: string | null): IP | null {
	if (text === null) return null;
	let ip = IP.parse(text);
	return isSuccess(ip) ? ip.data : null;
}

/** Reads the `for` parameter of one RFC 7239 `Forwarded` element, unquoted. */
function forwardedFor(element: string): string | null {
	for (let pair of element.split(";")) {
		let [key, ...rest] = pair.split("=");
		if (key?.trim().toLowerCase() !== "for") continue;
		let value = rest.join("=").trim();
		if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
			value = value.slice(1, -1);
		}
		return value;
	}
	return null;
}

/**
 * Drops the port a proxy may append to a list entry (`192.0.2.1:4711`,
 * `[2001:db8::1]:4711`), keeping a bare IPv6 address whole.
 */
function withoutPort(text: string): string {
	let bracketed = /^(\[[^\]]+\])(?::\d+)?$/.exec(text);
	if (bracketed?.[1]) return bracketed[1];
	let v4 = /^([\d.]+):\d+$/.exec(text);
	if (v4?.[1]) return v4[1];
	return text;
}
